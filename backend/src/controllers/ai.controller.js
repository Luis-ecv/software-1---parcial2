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


// System prompt for UML diagram generation and modification (friendly for novices and experts)
const SYSTEM_PROMPT = `Eres un asistente inteligente para diagramas UML que puede GENERAR diagramas completos y detallados desde descripciones simples.

OBJETIVO: Producir SÓLO un objeto JSON válido que siga el esquema descrito. No incluyas texto explicativo ni markdown.

🎯 MODO INTELIGENTE PARA USUARIOS NOVATOS:
Cuando el usuario proporcione descripciones simples como "diagrama para una tienda pequeña con productos, clientes y proveedores", debes:

1. INFERIR CLASES COMPLETAS basándote en el contexto del dominio
2. AÑADIR ATRIBUTOS LÓGICOS para cada entidad mencionada
3. CREAR MÉTODOS TÍPICOS que estas entidades necesitarían
4. ESTABLECER RELACIONES NATURALES entre las clases
5. USAR CONOCIMIENTO DEL DOMINIO para completar la información faltante

EJEMPLOS DE INFERENCIA INTELIGENTE:

Para "tienda pequeña con productos, clientes y proveedores":
- Producto: id, nombre, precio, stock, categoria, proveedor_id + métodos: calcularTotal(), actualizarStock()
- Cliente: id, nombre, email, telefono, direccion + métodos: agregarCompra(), obtenerHistorial()
- Proveedor: id, nombre, contacto, empresa + métodos: suministrar(), actualizarCatalogo()
- Venta: id, fecha, cliente_id, total + métodos: procesarPago(), generarFactura()
- Relaciones: Cliente -compra-> Producto, Proveedor -suministra-> Producto

Para "sistema escolar":
- Estudiante: id, nombre, edad, grado, matricula + métodos: inscribirse(), consultarNotas()
- Profesor: id, nombre, materia, experiencia + métodos: calificar(), asignarTarea()
- Curso: id, nombre, creditos, semestre + métodos: matricularEstudiante(), asignarProfesor()

Para "biblioteca":
- Libro: id, titulo, autor, isbn, disponible + métodos: prestar(), devolver()
- Usuario: id, nombre, email, tipo + métodos: solicitarPrestamo(), renovar()
- Prestamo: id, fecha_prestamo, fecha_devolucion + métodos: calcularMulta(), extender()

OPERACIONES SOPORTADAS:
1. GENERAR: Crear diagramas completos desde descripciones simples o técnicas
2. MODIFICAR: Añadir, actualizar o ELIMINAR elementos de un diagrama existente
3. CLARIFICAR: Solo cuando la descripción es extremadamente ambigua

COMPORTAMIENTO PARA MODIFICACIONES:
- AÑADIR: "añade clase X", "agrega atributo Y a Z" → incluir nuevos elements/relationships
- ACTUALIZAR: "cambia el tipo de X", "renombra clase Y a Z" → modificar elements existentes
- ELIMINAR: "elimina clase X", "borra atributo Y", "quita relación entre A y B" → EXCLUIR del resultado final
- AMBIGUO: Solo usar "clarifyingQuestions" si es imposible inferir del contexto

MANEJO DE ELIMINACIONES:
- Si el usuario dice "elimina la clase Cliente", el resultado NO debe contener esa clase
- Si dice "elimina atributo precio de Producto", Producto debe aparecer sin ese atributo
- Para eliminar relaciones: "elimina relación entre X e Y" → no incluir esa edge

CLARIFICACIONES (úsalas RARAMENTE):
- Solo cuando sea imposible inferir del contexto o dominio
- Máximo 2 preguntas por respuesta
- Prefiere generar un diagrama completo usando conocimiento del dominio

ESQUEMA JSON OBLIGATORIO:
{
  "elements": [
    {
      "id": "string_unico",
      "type": "classNode", 
      "name": "NombreClase",
      "attributes": ["nombre: string", "edad: int"],
      "methods": ["calcular(): float"],
      "position": { "x": 100, "y": 150 }
    }
  ],
  "relationships": [
    {
      "id": "string_unico",
      "type": "Association|Inheritance|Composition|Aggregation",
      "sourceId": "id_clase_origen", 
      "targetId": "id_clase_destino",
      "cardinality": "1..n|1..1|0..n"
    }
  ],
  "clarifyingQuestions": ["pregunta1", "pregunta2"] // OPCIONAL
}

REGLAS CRÍTICAS:
1) Respuesta = SOLO JSON válido (sin explicaciones)
2) Para eliminar: NO incluir el elemento en el resultado
3) Conservar IDs existentes cuando sea posible
4) Posiciones: distribución lógica con separación ≥200px
5) Tipos de datos: string, int, float, bool, Date
6) Si hay dudas, usar "clarifyingQuestions" en lugar de adivinar
7) Mantener consistencia con el estado previo del diagrama`;

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
    // Modify existing diagram based on a prompt (supports add/update/remove operations)
    static async modifyDiagram(req, res) {
        try {
            const { 
                prompt, 
                mode = 'modify', 
                dryRun = false, 
                nodes: curNodes = [], 
                edges: curEdges = [],
                clarification = null,
                originalPrompt = null,
                salaId = null 
            } = req.body || {};

            if (!prompt || typeof prompt !== 'string') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Se requiere el campo prompt con la descripción de la modificación' 
                });
            }

            // console.log(`🔧 ModifyDiagram: "${prompt}" (mode: ${mode}, dryRun: ${dryRun})`);

            // Preparar el estado actual del diagrama para el contexto de la IA
            const currentState = {
                elements: Array.isArray(curNodes) ? curNodes.map(n => ({
                    id: n.id,
                    name: n.data?.className || n.name || 'Clase',
                    attributes: Array.isArray(n.data?.attributes) ? n.data.attributes : [],
                    methods: Array.isArray(n.data?.methods) ? n.data.methods : [],
                    position: n.position || { x: 100, y: 100 }
                })) : [],
                relationships: Array.isArray(curEdges) ? curEdges.map(e => ({
                    id: e.id,
                    sourceId: e.source,
                    targetId: e.target,
                    type: e.data?.type || 'Association'
                })) : []
            };

            // Construir el prompt contextual para la IA
            let aiPrompt = `ESTADO ACTUAL DEL DIAGRAMA:\n${JSON.stringify(currentState, null, 2)}\n\n`;
            
            if (clarification && originalPrompt) {
                aiPrompt += `INSTRUCCIÓN ORIGINAL: ${originalPrompt}\n`;
                aiPrompt += `ACLARACIÓN DEL USUARIO: ${clarification}\n\n`;
                aiPrompt += `Ahora que tienes la aclaración, procede con la modificación solicitada.`;
            } else {
                aiPrompt += `INSTRUCCIÓN DE MODIFICACIÓN: ${prompt}\n\n`;
                aiPrompt += `Aplica los cambios solicitados. Si necesitas aclaración, usa 'clarifyingQuestions'.`;
            }

            // console.log('🤖 Enviando prompt a IA:', aiPrompt.substring(0, 500) + '...');

            // Llamar a la IA para procesar la modificación
            const aiResponse = await AIController.generateUMLFromText(aiPrompt);
            
            // console.log('🎯 Respuesta de IA:', JSON.stringify(aiResponse, null, 2).substring(0, 1000) + '...');

            // Normalizar la respuesta de la IA
            if (!aiResponse || typeof aiResponse !== 'object') {
                throw new Error('La IA no devolvió una respuesta válida');
            }

            // Verificar si la IA necesita aclaración
            if (aiResponse.clarifyingQuestions && Array.isArray(aiResponse.clarifyingQuestions) && aiResponse.clarifyingQuestions.length > 0) {
                return res.json({
                    success: true,
                    needsClarification: true,
                    clarifyingQuestions: aiResponse.clarifyingQuestions,
                    message: 'Se necesita aclaración para continuar con la modificación'
                });
            }

            // Normalizar arrays de elementos y relaciones
            const elements = Array.isArray(aiResponse.elements) ? aiResponse.elements : [];
            const relationships = Array.isArray(aiResponse.relationships) ? aiResponse.relationships : [];

            // console.log(`📊 Resultado IA - Elements: ${elements.length}, Relationships: ${relationships.length}`);

            // Procesar las modificaciones comparando con el estado actual
            const resultNodes = [];
            const resultEdges = [];
            
            // Detectar eliminaciones: elementos que estaban en currentState pero no en aiResponse
            const currentNodeIds = new Set(currentState.elements.map(e => e.id));
            const aiNodeIds = new Set(elements.map(e => e.id));
            const currentEdgeIds = new Set(currentState.relationships.map(r => r.id));
            const aiEdgeIds = new Set(relationships.map(r => r.id));

            let eliminatedNodes = [];
            let eliminatedEdges = [];

            // Detectar nodos eliminados
            for (const currentElement of currentState.elements) {
                const existsInAI = elements.some(el => 
                    el.id === currentElement.id || 
                    el.name.toLowerCase() === currentElement.name.toLowerCase()
                );
                
                if (!existsInAI) {
                    // console.log(`🗑️ Nodo eliminado detectado: ${currentElement.name} (${currentElement.id})`);
                    eliminatedNodes.push(currentElement);
                } else {
                    // Mantener el nodo (puede estar actualizado)
                    const aiElement = elements.find(el => 
                        el.id === currentElement.id || 
                        el.name.toLowerCase() === currentElement.name.toLowerCase()
                    );
                    
                    if (aiElement) {
                        resultNodes.push({
                            id: currentElement.id, // Mantener ID original
                            type: 'classNode',
                            position: aiElement.position || currentElement.position || { x: 100, y: 100 },
                            data: {
                                className: aiElement.name || currentElement.name,
                                attributes: Array.isArray(aiElement.attributes) ? aiElement.attributes : [],
                                methods: Array.isArray(aiElement.methods) ? aiElement.methods : [],
                                _aiModified: true
                            }
                        });
                    }
                }
            }

            // Agregar nodos nuevos que aparecen en la IA pero no existían antes
            for (const aiElement of elements) {
                const existsInCurrent = currentState.elements.some(el => 
                    el.id === aiElement.id || 
                    el.name.toLowerCase() === aiElement.name.toLowerCase()
                );

                if (!existsInCurrent) {
                    // console.log(`➕ Nuevo nodo detectado: ${aiElement.name}`);
                    resultNodes.push({
                        id: aiElement.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'classNode',
                        position: aiElement.position || { 
                            x: Math.random() * 600 + 100, 
                            y: Math.random() * 400 + 100 
                        },
                        data: {
                            className: aiElement.name,
                            attributes: Array.isArray(aiElement.attributes) ? aiElement.attributes : [],
                            methods: Array.isArray(aiElement.methods) ? aiElement.methods : [],
                            _aiModified: true
                        }
                    });
                }
            }

            // Procesar relaciones de manera similar
            const existingNodeIds = new Set(resultNodes.map(n => n.id));

            for (const aiRelationship of relationships) {
                // Verificar que tanto source como target existan en los nodos resultantes
                let sourceId = aiRelationship.sourceId;
                let targetId = aiRelationship.targetId;

                // Intentar resolver por nombre si el ID no existe
                if (!existingNodeIds.has(sourceId)) {
                    const sourceNode = resultNodes.find(n => 
                        n.data.className.toLowerCase() === sourceId.toLowerCase()
                    );
                    if (sourceNode) sourceId = sourceNode.id;
                }

                if (!existingNodeIds.has(targetId)) {
                    const targetNode = resultNodes.find(n => 
                        n.data.className.toLowerCase() === targetId.toLowerCase()
                    );
                    if (targetNode) targetId = targetNode.id;
                }

                if (existingNodeIds.has(sourceId) && existingNodeIds.has(targetId)) {
                    resultEdges.push({
                        id: aiRelationship.id || `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        source: sourceId,
                        target: targetId,
                        type: 'umlEdge',
                        data: {
                            type: aiRelationship.type || 'Association',
                            _aiModified: true
                        }
                    });
                }
            }

            // console.log(`✅ Resultado final - Nodos: ${resultNodes.length}, Edges: ${resultEdges.length}, Eliminados: ${eliminatedNodes.length}`);

            const response = {
                success: true,
                message: eliminatedNodes.length > 0 
                    ? `Modificación aplicada. ${eliminatedNodes.length} elemento(s) eliminado(s).`
                    : 'Modificación aplicada correctamente.',
                newState: { 
                    nodes: resultNodes, 
                    edges: resultEdges 
                },
                eliminated: {
                    nodes: eliminatedNodes,
                    edges: eliminatedEdges
                },
                clarifyingQuestions: aiResponse.clarifyingQuestions || []
            };

            return res.json(response);

        } catch (err) {
            console.error('❌ ModifyDiagram error:', err);
            return res.status(500).json({ 
                success: false, 
                error: `Error al procesar modificación: ${err.message || String(err)}` 
            });
        }
    }
    // Generate UML diagram from text, voice, or image
    static async generateDiagram(req, res) {
        try {
            const { type, content, salaId } = req.body;
            let userInput = '';
            let responseMessage = '';

            // console.log('AI Request:', { type, salaId, hasContent: !!content });

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
                    // Delegate to specialized voice controller
                    const AIVoiceController = (await import('./ai.voice.controller.js')).default;
                    return await AIVoiceController.processVoiceInput(req, res);

                case 'image':
                    // Delegate to specialized image controller
                    const AIImageController = (await import('./ai.image.controller.js')).default;
                    return await AIImageController.processImageInput(req, res);

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
                // console.log(`AI generated diagram summary: elements=${elementsCount}, relationships=${Array.isArray(diagram.relationships)?diagram.relationships.length:0}`);
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
                    console.error('❌ Schema validation error:', schemaErr.message || schemaErr);
                    console.error('📄 Diagram that failed validation:', JSON.stringify(diagram, null, 2));
                    console.error('🔍 Validation errors:', validateDiagram.errors);
                    throw new Error(`Error validando la estructura del diagrama generado por la IA: ${schemaErr.message || schemaErr}`);
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





    // Validate and normalize diagram structure
    static validateDiagramStructure(diagram) {
        if (!diagram || typeof diagram !== 'object') {
            console.error('❌ Validation failed: diagram is not a valid object:', diagram);
            throw new Error('Diagrama no es un objeto válido');
        }

        // Normalizar elements
        if (!diagram.elements) {
            console.warn('⚠️ No elements found, initializing empty array');
            diagram.elements = [];
        } else if (!Array.isArray(diagram.elements)) {
            console.warn('⚠️ Elements is not array, converting:', typeof diagram.elements);
            diagram.elements = Object.values(diagram.elements || {});
        }

        // Normalizar relationships
        if (!diagram.relationships) {
            console.warn('⚠️ No relationships found, initializing empty array');
            diagram.relationships = [];
        } else if (!Array.isArray(diagram.relationships)) {
            console.warn('⚠️ Relationships is not array, converting:', typeof diagram.relationships);
            diagram.relationships = Object.values(diagram.relationships || {});
        }

    // console.log(`✅ Diagram structure - Elements: ${diagram.elements.length}, Relationships: ${diagram.relationships.length}`);

        // Validate and normalize each element
        diagram.elements.forEach((element, index) => {
            if (!element) {
                console.error(`❌ Element ${index} is null/undefined`);
                throw new Error(`Elemento ${index} es null o undefined`);
            }

            // Ensure required fields
            if (!element.id) {
                element.id = `element_${Date.now()}_${index}`;
                console.warn(`⚠️ Element ${index} missing ID, assigned: ${element.id}`);
            }

            if (!element.type) {
                element.type = 'classNode';
                console.warn(`⚠️ Element ${index} missing type, assigned: classNode`);
            }

            if (!element.name) {
                element.name = `Clase_${index + 1}`;
                console.warn(`⚠️ Element ${index} missing name, assigned: ${element.name}`);
            }

            // Normalize attributes
            if (!Array.isArray(element.attributes)) {
                if (element.attributes) {
                    element.attributes = [String(element.attributes)];
                } else {
                    element.attributes = [];
                }
            }

            // Normalize methods
            if (!Array.isArray(element.methods)) {
                if (element.methods) {
                    element.methods = [String(element.methods)];
                } else {
                    element.methods = [];
                }
            }

            // Ensure position
            if (!element.position || typeof element.position !== 'object') {
                element.position = { x: 100 + (index * 200), y: 100 };
            }
        });

        // Validate relationships
        diagram.relationships.forEach((rel, index) => {
            if (!rel) {
                console.error(`❌ Relationship ${index} is null/undefined`);
                return; // Skip null relationships
            }

            if (!rel.id) {
                rel.id = `rel_${Date.now()}_${index}`;
            }

            if (!rel.type) {
                rel.type = 'Association';
            }
        });

    // console.log('✅ Diagram validation completed successfully');
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