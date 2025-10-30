// import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Ajv from 'ajv';

// Initialize OpenAI client
// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY || 'your_openai_api_key_here'
// });

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your_gemini_api_key_here');


// System prompt for UML diagram generation (friendly for novices and experts)
const SYSTEM_PROMPT = `Eres un asistente que genera diagramas de clases UML en formato JSON para usuarios con distintos niveles de experiencia (desde novatos hasta diseñadores expertos).

OBJETIVO: Producir SÓLO un único objeto JSON válido que siga el esquema descrito (elements, relationships). No incluyas texto explicativo ni markdown en la respuesta.

COMPORTAMIENTO:
- Si la entrada del usuario contiene suficiente detalle, genera clases (elements) y relaciones (relationships) con atributos, métodos, visibilidades y posiciones.
- Si falta información importante o la entrada es ambigua, NO inventes suposiciones arriesgadas. En su lugar, incluye un campo opcional "clarifyingQuestions": ["..."], con preguntas cortas y concretas que el frontend pueda presentar al usuario (por ejemplo: "¿La clase Pedido debe tener un atributo cantidad de tipo int?").
- Para salidas aptas para novatos: genera modelos simples y legibles usando tipos básicos (string, int, bool, Date). Si el tipo es incierto, usa "string" y marca el atributo con "inferred": true para indicar que fue inferido.
- Para usuarios expertos: si la entrada ya contiene firmas de métodos o tipos detallados, conserva ese nivel de detalle en el JSON.
- Posiciones: asigna posiciones razonables (separación mínima de ~200px entre clases) para facilitar la colocación en el canvas.
- IDs: usa cadenas únicas para id.

ESQUEMA RESUMIDO (obligatorio):
{
  "elements": [ { id, type, name, attributes[], methods[], position } ],
  "relationships": [ { id, type, sourceId, targetId, cardinality } ],
  optional: "clarifyingQuestions": [string]
}

REGLAS IMPORTANTES:
1) Devuelve SÓLO JSON que cumpla el esquema (sin texto adicional).
2) Si tienes dudas importantes sobre el modelo, usa "clarifyingQuestions" en lugar de inventar detalles.
3) Incluye la propiedad "inferred": true en atributos cuyo tipo fue adivinado.
4) Usa nombres y tipos claros; para tipos desconocidos, default a "string".
5) No incluyas explicaciones; el frontend manejará la interacción con el usuario si se requieren aclaraciones.`;

// JSON Schema para validar la estructura esperada del diagrama UML
const DIAGRAM_SCHEMA = {
    type: 'object',
    properties: {
        elements: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id','type','name'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    name: { type: 'string' },
                    attributes: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string' },
                                inferred: { type: 'boolean' },
                                visibility: { type: 'string' },
                                isPrimaryKey: { type: 'boolean' }
                            }
                        }
                    },
                    methods: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                returnType: { type: 'string' },
                                parameters: { type: 'array' },
                                visibility: { type: 'string' }
                            }
                        }
                    },
                    position: {
                        type: 'object',
                        properties: { x: { type: 'number' }, y: { type: 'number' } }
                    }
                }
            }
        },
        relationships: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id','type','sourceId','targetId'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    sourceId: { type: 'string' },
                    targetId: { type: 'string' },
                    cardinality: { type: 'string' }
                }
            }
        }
        ,
        clarifyingQuestions: {
            type: 'array',
            items: { type: 'string' }
        }
    }
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateDiagram = ajv.compile(DIAGRAM_SCHEMA);

class AIController {
    // Modify existing diagram based on a prompt (dry-run by default)
    static async modifyDiagram(req, res) {
        try {
            const { prompt, mode = 'merge', dryRun = true, nodes: curNodes = [], edges: curEdges = [] } = req.body || {};

            if (!prompt || typeof prompt !== 'string') {
                return res.status(400).json({ success: false, error: 'Se requiere el campo prompt' });
            }

            // Build a user input that includes the current state and the user's prompt
            const stateSummary = {
                elements: Array.isArray(curNodes) ? curNodes.map(n => ({ id: n.id, name: n.data?.className || (n.name || n.data?.name), attributes: n.data?.attributes || [], methods: n.data?.methods || [] })) : [],
                relationships: Array.isArray(curEdges) ? curEdges.map(e => ({ id: e.id, sourceId: e.source, targetId: e.target, type: e.data?.type || (e.type || 'association') })) : []
            };

            const userInput = `Estado actual del diagrama (JSON): ${JSON.stringify(stateSummary)}\n\nInstrucción del usuario: ${prompt}\n\nModo: ${mode}. Responde SOLO un JSON con la llave 'elements' y 'relationships' con la modificación propuesta. Si faltan datos, incluye 'clarifyingQuestions'.`;

            // Use existing generation helper to ask the model
            const aiDiagram = await AIController.generateUMLFromText(userInput);

            // Normalize aiDiagram to arrays
            if (aiDiagram.elements && !Array.isArray(aiDiagram.elements)) aiDiagram.elements = Object.values(aiDiagram.elements || {});
            if (!aiDiagram.relationships && aiDiagram.connections) aiDiagram.relationships = Array.isArray(aiDiagram.connections) ? aiDiagram.connections : Object.values(aiDiagram.connections || {});
            if (aiDiagram.relationships && !Array.isArray(aiDiagram.relationships)) aiDiagram.relationships = Object.values(aiDiagram.relationships || {});

            // Merge strategy: default 'merge' will add new nodes/edges and update existing, but will NOT remove existing nodes/edges
            const existingNodesMap = new Map((curNodes || []).map(n => [String(n.id), n]));
            const existingEdgesMap = new Map((curEdges || []).map(e => [String(e.id), e]));

            const addedNodes = [];
            const updatedNodes = [];

            const resultNodesMap = new Map(existingNodesMap);

            (aiDiagram.elements || []).forEach((el, idx) => {
                const id = el.id ? String(el.id) : `ai_${Date.now()}_${idx}`;
                const name = el.name || el.nombre || el.title || `Clase_${idx + 1}`;
                const attributes = Array.isArray(el.attributes) ? el.attributes : (el.attributes ? [el.attributes] : []);
                const methods = Array.isArray(el.methods) ? el.methods : (el.methods ? [el.methods] : []);

                if (resultNodesMap.has(id)) {
                    // update existing
                    const existing = resultNodesMap.get(id);
                    const updated = { ...existing, data: { ...(existing.data || {}), className: name, attributes, methods } };
                    resultNodesMap.set(id, updated);
                    updatedNodes.push(updated);
                } else {
                    // add new node
                    const nodeObj = { id, type: 'classNode', position: el.position || { x: 100 + idx * 200, y: 100 }, data: { className: name, attributes, methods, _aiSource: true } };
                    resultNodesMap.set(id, nodeObj);
                    addedNodes.push(nodeObj);
                }
            });

            const addedEdges = [];
            const updatedEdges = [];
            const resultEdges = Array.from(curEdges || []);

            (aiDiagram.relationships || []).forEach((r, idx) => {
                const id = r.id ? String(r.id) : `ai_rel_${Date.now()}_${idx}`;
                let source = r.sourceId || r.source || null;
                let target = r.targetId || r.target || null;

                // Try to resolve by name if needed
                if (source && !resultNodesMap.has(String(source))) {
                    const found = Array.from(resultNodesMap.values()).find(n => String((n.data && n.data.className || n.name || '')).toLowerCase() === String(source).toLowerCase());
                    if (found) source = found.id;
                }
                if (target && !resultNodesMap.has(String(target))) {
                    const found = Array.from(resultNodesMap.values()).find(n => String((n.data && n.data.className || n.name || '')).toLowerCase() === String(target).toLowerCase());
                    if (found) target = found.id;
                }

                if (!source || !target) return; // skip invalid edge

                // Check if similar edge exists
                const exists = resultEdges.some(e => e.source === source && e.target === target && ((e.data && e.data.type) || e.type) === (r.type || r.relation || 'association'));
                if (!exists) {
                    const edgeObj = { id, source, target, type: 'umlEdge', data: { type: r.type || r.relation || 'association', _aiSource: true } };
                    resultEdges.push(edgeObj);
                    addedEdges.push(edgeObj);
                } else {
                    // optionally update matching edge metadata - for now skip
                }
            });

            const mergedNodes = Array.from(resultNodesMap.values());

            const diff = {
                addedNodes,
                updatedNodes,
                addedEdges
            };

            const response = {
                success: true,
                message: 'Propuesta de modificación generada (modo ' + mode + ')',
                newState: { nodes: mergedNodes, edges: resultEdges },
                diff,
                clarifyingQuestions: aiDiagram.clarifyingQuestions || [],
                warnings: []
            };

            return res.json(response);
        } catch (err) {
            console.error('modifyDiagram error', err);
            return res.status(500).json({ success: false, error: err.message || String(err) });
        }
    }
    // Generate UML diagram from text, voice, or image
    static async generateDiagram(req, res) {
        try {
            const { type, content, salaId } = req.body;
            let userInput = '';
            let responseMessage = '';

            console.log('AI Request:', { type, salaId, hasContent: !!content });

            // Check if Gemini is configured
            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
                // Return a demo diagram
                const demoDiagram = {
                    elements: [
                        {
                            id: "class1",
                            type: "class",
                            name: "Usuario",
                            attributes: [
                                { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                                { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                                { name: "email", type: "string", visibility: "private", isPrimaryKey: false }
                            ],
                            methods: [
                                { name: "getNombre", returnType: "string", parameters: [], visibility: "public" },
                                { name: "setNombre", returnType: "void", parameters: [{ name: "nombre", type: "string" }], visibility: "public" }
                            ],
                            position: { x: 100, y: 100 }
                        },
                        {
                            id: "class2", 
                            type: "class",
                            name: "Proyecto",
                            attributes: [
                                { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                                { name: "titulo", type: "string", visibility: "private", isPrimaryKey: false },
                                { name: "fechaCreacion", type: "Date", visibility: "private", isPrimaryKey: false }
                            ],
                            methods: [
                                { name: "getTitulo", returnType: "string", parameters: [], visibility: "public" },
                                { name: "setTitulo", returnType: "void", parameters: [{ name: "titulo", type: "string" }], visibility: "public" }
                            ],
                            position: { x: 400, y: 100 }
                        }
                    ],
                    relationships: [
                        {
                            id: "rel1",
                            type: "association",
                            sourceId: "class1",
                            targetId: "class2",
                            cardinality: "1:*"
                        }
                    ]
                };

                return res.json({
                    success: true,
                    message: 'Demo: Configura tu clave de Gemini para usar IA real. Diagrama de ejemplo generado.',
                    diagram: demoDiagram,
                    originalInput: content || 'Demo input'
                });
            }

            switch (type) {
                case 'text':
                    userInput = content;
                    responseMessage = 'Diagrama generado desde texto';
                    break;

                case 'voice':
                    // Handle audio file from FormData
                    if (req.files && req.files.audio) {
                        userInput = await AIController.transcribeAudio(req.files.audio[0]);
                        responseMessage = `Diagrama generado desde audio: "${userInput}"`;
                    } else {
                        throw new Error('No se encontró archivo de audio');
                    }
                    break;

                case 'image':
                    // Handle image file from FormData
                    if (req.files && req.files.image) {
                        userInput = await AIController.analyzeImage(req.files.image[0]);
                        responseMessage = `Diagrama generado desde imagen`;
                    } else {
                        throw new Error('No se encontró archivo de imagen');
                    }
                    break;

                default:
                    throw new Error('Tipo de entrada no válido');
            }

            if (!userInput) {
                throw new Error('No se pudo procesar la entrada');
            }

            // Generate UML diagram using OpenAI
            const diagram = await AIController.generateUMLFromText(userInput);

            // Log diagram summary for debugging (no sensitive data)
            try {
                const elementsCount = Array.isArray(diagram.elements) ? diagram.elements.length : (diagram.elements ? Object.keys(diagram.elements).length : 0);
                console.log(`AI generated diagram summary: elements=${elementsCount}, relationships=${Array.isArray(diagram.relationships)?diagram.relationships.length:0}`);
            } catch (logErr) {
                console.warn('No se pudo obtener resumen del diagrama generado:', logErr.message);
            }

            res.json({
                success: true,
                message: responseMessage,
                diagram: diagram,
                originalInput: userInput
            });

        } catch (error) {
            console.error('Error en AI Controller:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno del servidor'
            });
        }
    }

    // Generate UML diagram using Gemini
    static async generateUMLFromText(userInput) {
        try {
            // OpenAI implementation (commented out)
            /*
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: `Genera un diagrama UML de clases basado en: ${userInput}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });
            const response = completion.choices[0].message.content.trim();
            */

            // Gemini implementation (model configurable via GEMINI_MODEL env var)
            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const prompt = `${SYSTEM_PROMPT}\n\nGenera un diagrama UML de clases basado en: ${userInput}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = await response.text();

            // Try to parse the JSON response
            let diagram;
            try {
                diagram = JSON.parse(text);
            } catch (parseError) {
                // If direct parsing fails, try to extract JSON from the response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    diagram = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('La respuesta de AI no contiene JSON válido');
                }
            }

            // If the model only returned clarifyingQuestions (or no elements), attempt a best-effort generation:
            // some users prefer to get an initial diagram even if some details are ambiguous.
            const noElements = !diagram.elements || (Array.isArray(diagram.elements) && diagram.elements.length === 0);
            if (noElements && Array.isArray(diagram.clarifyingQuestions) && diagram.clarifyingQuestions.length > 0) {
                try {
                    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
                    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                    // Ask the model for a best-effort diagram: infer reasonable defaults and mark inferred:true
                    const bestEffortPrompt = `${SYSTEM_PROMPT}\n\nEl usuario ha dado información insuficiente. Genera un DIAGRAMA por defecto de "mejor esfuerzo" a partir de la entrada original: ${userInput}.\nSi debes inferir tipos o atributos, inclúyelos y marca cada atributo inferido con \"inferred\": true.\nDevuelve solamente JSON válido que contenga al menos elementos[] con clases.\nNo incluyas explicaciones.`;
                    const best = await model.generateContent(bestEffortPrompt);
                    const bestResp = await best.response;
                    const bestText = await bestResp.text();
                    let bestDiagram;
                    try { bestDiagram = JSON.parse(bestText); } catch (e) {
                        const jsonMatch2 = bestText.match(/\{[\s\S]*\}/);
                        if (jsonMatch2) bestDiagram = JSON.parse(jsonMatch2[0]);
                        else throw new Error('Best-effort: respuesta no contiene JSON válido');
                    }

                    // Normalize bestDiagram similar to earlier normalization
                    if (bestDiagram.elements && !Array.isArray(bestDiagram.elements)) bestDiagram.elements = Object.values(bestDiagram.elements || {});
                    if (!bestDiagram.relationships && bestDiagram.connections) bestDiagram.relationships = Array.isArray(bestDiagram.connections) ? bestDiagram.connections : Object.values(bestDiagram.connections || {});
                    if (bestDiagram.relationships && !Array.isArray(bestDiagram.relationships)) bestDiagram.relationships = Object.values(bestDiagram.relationships || {});

                    // If best-effort produced elements, prefer it, but also keep clarifyingQuestions if present
                    if (bestDiagram.elements && Array.isArray(bestDiagram.elements) && bestDiagram.elements.length > 0) {
                        // copy clarifyingQuestions from original if present
                        if (diagram.clarifyingQuestions) bestDiagram.clarifyingQuestions = diagram.clarifyingQuestions;
                        diagram = bestDiagram;
                    }
                } catch (beErr) {
                    console.warn('Best-effort generation failed:', beErr.message || beErr);
                    // keep original diagram (with clarifyingQuestions) if best-effort fails
                }
            }

            // Normalizar estructuras comunes y tolerar pequeñas variaciones
            try {
                // Si `elements` viene como objeto (mapa) convertir a array
                if (diagram.elements && !Array.isArray(diagram.elements)) {
                    diagram.elements = Object.values(diagram.elements || {});
                }

                // Compatibilidad: algunos flujos pueden devolver `connections` en vez de `relationships`
                if (!diagram.relationships && diagram.connections) {
                    diagram.relationships = Array.isArray(diagram.connections) ? diagram.connections : Object.values(diagram.connections || {});
                }

                // Asegurar que relationships sea array
                if (diagram.relationships && !Array.isArray(diagram.relationships)) {
                    diagram.relationships = Object.values(diagram.relationships || {});
                }

                // Si AI devolvió un diagrama sin elementos, crear un fallback mínimo para evitar pizarra vacía
                if (!diagram.elements || (Array.isArray(diagram.elements) && diagram.elements.length === 0)) {
                    console.warn('AI devolvió un diagrama sin elementos. Se aplica fallback mínimo para evitar pizarra vacía.');
                    diagram.elements = [
                        {
                            id: 'demo_auto_1',
                            type: 'class',
                            name: 'DemoClass',
                            attributes: [],
                            methods: [],
                            position: { x: 120, y: 120 }
                        }
                    ];
                }
            } catch (normErr) {
                console.warn('Error durante normalización del diagrama AI:', normErr.message);
            }

                // Validate against JSON schema (Ajv). If invalid, attempt one corrective retry.
                try {
                    const ok = validateDiagram(diagram);
                    if (!ok) {
                        console.warn('AI diagram failed schema validation:', validateDiagram.errors);
                        // Attempt one retry asking the model to return a JSON that matches the schema exactly
                        try {
                            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
                            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                            const correctionPrompt = `${SYSTEM_PROMPT}\n\nLa respuesta anterior no cumplió el esquema esperado. Devuelve ÚNICAMENTE un JSON válido que cumpla este esquema: ${JSON.stringify(DIAGRAM_SCHEMA)}\nBasado en la entrada original: ${userInput}\nPor favor devuelve solo JSON sin explicaciones.`;
                            const retryResult = await model.generateContent(correctionPrompt);
                            const retryResp = await retryResult.response;
                            const retryText = await retryResp.text();
                            let retryDiagram;
                            try { retryDiagram = JSON.parse(retryText); } catch (e) {
                                const jsonMatch2 = retryText.match(/\{[\s\S]*\}/);
                                if (jsonMatch2) retryDiagram = JSON.parse(jsonMatch2[0]);
                                else throw new Error('Retry: respuesta no contiene JSON válido');
                            }

                            // Normalize retry output
                            if (retryDiagram.elements && !Array.isArray(retryDiagram.elements)) retryDiagram.elements = Object.values(retryDiagram.elements || {});
                            if (!retryDiagram.relationships && retryDiagram.connections) retryDiagram.relationships = Array.isArray(retryDiagram.connections) ? retryDiagram.connections : Object.values(retryDiagram.connections || {});
                            if (retryDiagram.relationships && !Array.isArray(retryDiagram.relationships)) retryDiagram.relationships = Object.values(retryDiagram.relationships || {});

                            // Validate corrected diagram
                            const ok2 = validateDiagram(retryDiagram);
                            if (!ok2) {
                                console.warn('Retry still failed validation:', validateDiagram.errors);
                                throw new Error('La respuesta de AI no cumple el esquema esperado tras reintento');
                            }
                            // Use corrected diagram
                            diagram = retryDiagram;
                        } catch (retryErr) {
                            console.error('AI correction retry failed:', retryErr.message || retryErr);
                            throw retryErr;
                        }
                    }
                } catch (schemaErr) {
                    console.warn('Schema validation error:', schemaErr.message || schemaErr);
                    throw new Error('Error validando la estructura del diagrama generado por la IA');
                }

                // Validate the diagram structure (legacy checks)
                AIController.validateDiagramStructure(diagram);

            return diagram;

        } catch (error) {
            console.error('Error generando diagrama UML:', error);
            const message = (error && error.message) ? error.message : String(error);
            // Detect common model-not-found / 404 error from Generative API and provide guidance
            if (/not found|404|models\//i.test(message)) {
                throw new Error(`Error generando diagrama: modelo no encontrado o no soportado por la API. Verifica la variable de entorno GEMINI_MODEL y lista los modelos disponibles con 'gcloud ai models list --region=YOUR_REGION' o usando la API de ModelService.`);
            }
            throw new Error(`Error generando diagrama: ${message}`);
        }
    }

    // Transcribe audio using Gemini
    static async transcribeAudio(audioFile) {
        let tempPath; // Define tempPath here to be accessible in the finally block
        try {
            // Save the audio file temporarily
            tempPath = path.join(__dirname, '../../temp/', `audio_${Date.now()}.wav`);
            
            // Create temp directory if it doesn't exist
            const tempDir = path.dirname(tempPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(tempPath, audioFile.buffer);

            // OpenAI implementation (commented out)
            /*
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-1",
            });
            return transcription.text;
            */

            // Gemini implementation (model configurable via GEMINI_MODEL env var)
            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const audioFile = await genAI.uploadFile(tempPath);
            const prompt = "Transcribe this audio.";

            const result = await model.generateContent([prompt, audioFile]);
            const response = await result.response;
            const text = await response.text();
            return text;

        } catch (error) {
            console.error('Error transcribiendo audio:', error);
            throw new Error(`Error transcribiendo audio: ${error.message}`);
        } finally {
            // Clean up temp file
            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    // Analyze image using Gemini Vision
    static async analyzeImage(imageFile) {
        try {
            // OpenAI implementation (commented out)
            /*
            // Convert image to base64
            const base64Image = imageFile.buffer.toString('base64');
            const imageUrl = `data:${imageFile.mimetype};base64,${base64Image}`;

            const response = await openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analiza esta imagen y describe el sistema, clases, objetos o conceptos que ves. Describe todo lo que puedas observar para crear un diagrama UML de clases."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            });
            return response.choices[0].message.content;
            */

            // Gemini implementation (model configurable via GEMINI_MODEL env var)
            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const prompt = "Analiza esta imagen y describe el sistema, clases, objetos o conceptos que ves. Describe todo lo que puedas observar para crear un diagrama UML de clases.";
            const imagePart = {
                inlineData: {
                    data: imageFile.buffer.toString('base64'),
                    mimeType: imageFile.mimetype
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = await response.text();
            return text;

        } catch (error) {
            console.error('Error analizando imagen:', error);
            throw new Error(`Error analizando imagen: ${error.message}`);
        }
    }

    // Validate diagram structure
    static validateDiagramStructure(diagram) {
        if (!diagram || typeof diagram !== 'object') {
            throw new Error('Diagrama no es un objeto válido');
        }

        if (!Array.isArray(diagram.elements)) {
            throw new Error('El diagrama debe tener un array de elementos');
        }

        if (!Array.isArray(diagram.relationships)) {
            throw new Error('El diagrama debe tener un array de relaciones');
        }

        // Validate each element
        diagram.elements.forEach((element, index) => {
            if (!element.id || !element.type || !element.name) {
                throw new Error(`Elemento ${index} no tiene id, type o name requeridos`);
            }

            if (!Array.isArray(element.attributes)) {
                element.attributes = [];
            }

            if (!Array.isArray(element.methods)) {
                element.methods = [];
            }

            if (!element.position) {
                element.position = { x: 100 + (index * 200), y: 100 };
            }
        });

        return true;
    }

    // Get available AI features
    static async getAIFeatures(req, res) {
        try {
            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            res.json({
                success: true,
                features: {
                    textToUML: true,
                    voiceToUML: true,
                    imageToUML: true,
                    models: [GEMINI_MODEL]
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default AIController;