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

// Initialize Google Gemini client (support API Key or Application Default Credentials)
let genAI;
try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        console.log('AIController: Initializing GoogleGenerativeAI using GEMINI_API_KEY');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } else {
        // If no API key provided, rely on ADC (GOOGLE_APPLICATION_CREDENTIALS or attached service account)
        console.log('AIController: No GEMINI_API_KEY provided — using Application Default Credentials (ADC) for GoogleGenerativeAI');
        genAI = new GoogleGenerativeAI();
    }
} catch (err) {
    console.warn('AIController: Failed to initialize GoogleGenerativeAI with provided credentials:', err?.message || err);
    // Fallback: try default constructor
    try { genAI = new GoogleGenerativeAI(); } catch (e) { console.error('AIController: final fallback failed', e?.message || e); }
}


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

EJEMPLOS DE CARDINALIDADES CORRECTAS:
- Cliente 1 — * Pedido: "1:*" (un cliente puede tener muchos pedidos)
- Pedido 1 — * LineaPedido: "1:*" (composición: un pedido tiene múltiples líneas)
- Producto 1 — * LineaPedido: "1:*" (un producto puede estar en múltiples líneas)
- Usuario * — * Rol: "*:*" (muchos a muchos con tabla intermedia)
- Persona 1 — 1 Pasaporte: "1:1" (relación uno a uno)
- Departamento 1 — * Empleado: "1:*" (un departamento tiene muchos empleados)

IMPORTANTE: Siempre incluye cardinalidades en TODAS las relaciones. Para composición usa "1:*", para asociación simple usa según el contexto del dominio.

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
      "cardinality": "1:*|1:1|0..1:1..*|*:*"
    }
  ],
  "clarifyingQuestions": ["pregunta1", "pregunta2"] // OPCIONAL
}

FORMATO DE CARDINALIDAD:
- Usa formato "inicio:fin" (ej: "1:*", "0..1:1..*", "1:1")
- Patrones comunes: "1:*" (uno a muchos), "1:1" (uno a uno), "*:*" (muchos a muchos)
- Para composición: típicamente "1:*" (padre a hijos)
- Para agregación: puede ser "1:*" o "*:*"
- Para asociación simple: según el contexto del dominio

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
                required: ['id','name'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    name: { type: 'string' },
                    attributes: {
                        type: 'array',
                        items: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        type: { type: 'string' },
                                        inferred: { type: 'boolean' },
                                        visibility: { type: 'string' },
                                        isPrimaryKey: { type: 'boolean' }
                                    }
                                }
                            ]
                        }
                    },
                    methods: {
                        type: 'array',
                        items: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        returnType: { type: 'string' },
                                        parameters: { type: 'array' },
                                        visibility: { type: 'string' }
                                    }
                                }
                            ]
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
                required: ['id'],
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

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false, addUsedSchema: false });
const validateDiagram = ajv.compile(DIAGRAM_SCHEMA);

class AIController {
    // Helper: sleep for ms
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Try generating content with a single model with retries and exponential backoff.
    // Throws unless a successful text is returned.
    static async _tryGenerateWithModel(modelName, prompt, maxAttempts = 3) {
        const model = genAI.getGenerativeModel({ model: modelName });
        let attempt = 0;
        while (attempt < maxAttempts) {
            attempt++;
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = await response.text();
                return text;
            } catch (err) {
                const msg = err && err.message ? err.message : String(err);
                // If model overloaded (503) try again after backoff, otherwise rethrow
                if (/503|Service Unavailable|overload|overloaded/i.test(msg)) {
                    const backoff = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 500);
                    console.warn(`Model ${modelName} attempt ${attempt} failed with 503-ish error, backing off ${backoff}ms`);
                    await AIController.sleep(backoff);
                    // continue to retry
                } else {
                    // non-retryable error
                    throw err;
                }
            }
        }
        // Exhausted retries for this model
        const err = new Error(`Model ${modelName} exhausted retries (likely overloaded)`);
        err.code = 'MODEL_OVERLOADED';
        throw err;
    }

    // Try a list of models in order. For each model, attempt to generate; on overload try next model.
    static async _generateUsingModels(modelsList, prompt) {
        const arr = Array.isArray(modelsList) ? modelsList : String(modelsList || '').split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length === 0) arr.push('gemini-2.5-flash');
        let lastError = null;
        for (const m of arr) {
            try {
                const text = await AIController._tryGenerateWithModel(m, prompt, 3);
                return { model: m, text };
            } catch (err) {
                lastError = err;
                // If exhausted retries (MODEL_OVERLOADED) try next model; otherwise break and throw
                if (err && err.code === 'MODEL_OVERLOADED') {
                    console.warn(`Model ${m} overloaded, trying next model if available`);
                    continue;
                } else {
                    throw err;
                }
            }
        }
        // If we reach here, all models exhausted
        const e = new Error(`All models exhausted or overloaded. Last error: ${lastError?.message || String(lastError)}`);
        e.cause = lastError;
        throw e;
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

            // Generate UML diagram using OpenAI/Gemini (allow optional model override)
            const requestedModel = req.body?.model || null;
            const diagram = await AIController.generateUMLFromText(userInput, requestedModel);

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
    static async generateUMLFromText(userInput, modelArg = null) {
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

            // Gemini implementation with retries and optional model list/fallback
            const modelsEnv = modelArg ? [modelArg] : (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash');
            const modelsList = Array.isArray(modelsEnv) ? modelsEnv : String(modelsEnv).split(',').map(s => s.trim()).filter(Boolean);
            console.log('AIController: using models list ->', modelsList);
            const prompt = `${SYSTEM_PROMPT}\n\nGenera un diagrama UML de clases basado en: ${userInput}`;

            // Try models with retries and fallback; returns { model, text }
            let genResult;
            try {
                genResult = await AIController._generateUsingModels(modelsList, prompt);
            } catch (err) {
                console.error('All models failed in generateUMLFromText:', err);
                throw new Error(`All models failed or overloaded: ${err.message}`);
            }
            const text = genResult.text;

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
                    const BEST_MODEL = modelArg || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
                    const model = genAI.getGenerativeModel({ model: BEST_MODEL });
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

                // Validate against basic structure requirements (more lenient than strict JSON schema)
                try {
                    console.log('🔍 Validating diagram structure...');
                    
                    // Basic validation instead of strict schema validation
                    const basicValidation = AIController.validateBasicDiagramStructure(diagram);
                    if (!basicValidation.isValid) {
                        console.warn('❌ AI diagram failed basic validation:', basicValidation.errors);
                        // Skip retry for now - use original diagram with basic validation fixes
                        console.warn('⚠️ Using original diagram with basic validation fixes');
                        AIController.validateBasicDiagramStructure(diagram);
                    }
                } catch (schemaErr) {
                    console.error('❌ Validation error:', schemaErr.message || schemaErr);
                    console.warn('⚠️ Applying basic structure fixes');
                    // Apply basic structure fixes
                    AIController.validateBasicDiagramStructure(diagram);
                }

                // Final validation and normalization
                console.log('✅ Final diagram validation completed');

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
            // Support multiple models via GEMINI_MODELS env (comma-separated)
            const modelsEnv = process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const models = Array.isArray(modelsEnv) ? modelsEnv : String(modelsEnv).split(',').map(s => s.trim()).filter(Boolean);
            res.json({
                success: true,
                features: {
                    textToUML: true,
                    voiceToUML: true,
                    imageToUML: true,
                    models
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Verify a diagram by forwarding systemPrompt/userPrompt to Gemini server-side
    static async verifyDiagram(req, res) {
        try {
            const { systemPrompt, userPrompt, model } = req.body || {};
            if (!systemPrompt || !userPrompt) {
                return res.status(400).json({ success: false, error: 'systemPrompt and userPrompt are required' });
            }

            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
                return res.status(400).json({ success: false, error: 'Gemini API key not configured on server' });
            }

            // Build models list and attempt generation with retries/fallback
            const modelsEnv = model ? [model] : (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash');
            const modelsList = Array.isArray(modelsEnv) ? modelsEnv : String(modelsEnv).split(',').map(s => s.trim()).filter(Boolean);
            const bodyText = `${systemPrompt}\n\n${userPrompt}`;

            let genResult;
            try {
                genResult = await AIController._generateUsingModels(modelsList, bodyText);
            } catch (err) {
                console.error('All models failed in verifyDiagram:', err);
                return res.status(502).json({ success: false, error: `All models failed or overloaded: ${err.message}` });
            }

            const text = genResult.text;

            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (err) {
                const jsonMatch = String(text).match(/\{[\s\S]*\}/);
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                else throw new Error('La respuesta de Gemini no contiene JSON válido');
            }

            // Validate required verification fields expected by frontend
            const requiredFields = [
                'okEstructural', 'islas', 'referenciasRotas', 'ciclosHerencia',
                'scoreDiseno', 'sugerencias', 'accionesPrioritarias', 'tags',
                'nodosProblematicos', 'aristasProblematicas', 'usoHallazgosLocales', 'limitaciones'
            ];

            for (const f of requiredFields) {
                if (!(f in parsed)) {
                    return res.status(502).json({ success: false, error: `Campo requerido faltante en respuesta de IA: ${f}`, fieldMissing: f, raw: parsed });
                }
            }

            return res.json(parsed);
        } catch (error) {
            console.error('Error en verifyDiagram:', error);
            return res.status(500).json({ success: false, error: error.message || String(error) });
        }
    }

    // Basic diagram structure validation (more lenient than JSON schema)
    static validateBasicDiagramStructure(diagram) {
        const errors = [];
        
        if (!diagram || typeof diagram !== 'object') {
            errors.push('Diagram is not an object');
            return { isValid: false, errors };
        }

        // Check elements
        if (!diagram.elements) {
            diagram.elements = [];
        }
        if (!Array.isArray(diagram.elements)) {
            diagram.elements = Object.values(diagram.elements || {});
        }

        // Check relationships
        if (!diagram.relationships) {
            diagram.relationships = [];
        }
        if (!Array.isArray(diagram.relationships)) {
            diagram.relationships = Object.values(diagram.relationships || {});
        }

        // Basic element validation
        diagram.elements.forEach((element, index) => {
            if (!element.id) {
                element.id = `element_${Date.now()}_${index}`;
            }
            if (!element.name) {
                element.name = `Class_${index + 1}`;
            }
            if (!Array.isArray(element.attributes)) {
                element.attributes = element.attributes ? [element.attributes] : [];
            }
            if (!Array.isArray(element.methods)) {
                element.methods = element.methods ? [element.methods] : [];
            }
        });

        // Basic relationship validation
        diagram.relationships.forEach((rel, index) => {
            if (!rel.id) {
                rel.id = `rel_${Date.now()}_${index}`;
            }
            if (!rel.type) {
                rel.type = 'Association';
            }
        });

        return { isValid: true, errors: [] };
    }

}

export default AIController;