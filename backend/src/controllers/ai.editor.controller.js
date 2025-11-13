import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Gemini client
let genAI;
try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        console.log('AIEditorController: Initializing GoogleGenerativeAI using GEMINI_API_KEY');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } else {
        console.log('AIEditorController: No GEMINI_API_KEY provided — using Application Default Credentials (ADC)');
        genAI = new GoogleGenerativeAI();
    }
} catch (err) {
    console.warn('AIEditorController: Failed to initialize GoogleGenerativeAI with provided credentials:', err?.message || err);
    try { genAI = new GoogleGenerativeAI(); } catch (e) { console.error('AIEditorController: final fallback failed', e?.message || e); }
}

// System prompt específico para edición de diagramas UML
const EDITOR_SYSTEM_PROMPT = `Eres un asistente especializado en EDICIÓN Y MODIFICACIÓN de diagramas UML de clases existentes.

🚨 REGLAS CRÍTICAS - SIGUE ESTRICTAMENTE:
1. **NO CREAR NUEVAS CLASES** a menos que se solicite explícitamente con "crear", "añadir", "agregar"
2. **PRESERVAR TODAS LAS CLASES EXISTENTES** que no se mencionen para eliminación
3. **MANTENER TODOS LOS IDs ORIGINALES** de elementos existentes
4. **SOLO MODIFICAR** los elementos específicamente mencionados en la instrucción
5. **PARA ELIMINACIONES**: Omitir completamente del resultado final el elemento a eliminar

OBJETIVO: Modificar un diagrama UML existente basándote en las instrucciones del usuario. Producir SÓLO un objeto JSON válido que refleje los cambios solicitados SOBRE EL ESTADO ACTUAL.

🎯 OPERACIONES DE EDICIÓN SOPORTADAS:

1. **AÑADIR elementos**:
   - "añade clase X con atributos Y"
   - "agrega atributo Z a la clase W"
   - "crea relación entre A y B"
   - "añade método M a clase C"

2. **MODIFICAR elementos existentes**:
   - "cambia el nombre de clase X a Y"
   - "actualiza el tipo del atributo A de clase B"
   - "modifica la cardinalidad de relación entre C y D"
   - "cambia el tipo de relación de E a F"

3. **ELIMINAR elementos**:
   - "elimina la clase X"
   - "borra el atributo Y de clase Z"
   - "quita la relación entre A y B"
   - "elimina el método M de clase C"

🔗 **OPERACIONES ESPECÍFICAS PARA RELACIONES:**

📝 **MODIFICAR TIPO DE RELACIÓN** (soporta sinónimos):
   - "cambia la relación entre ClaseA y ClaseB a Generalization"
   - "modifica la relación de ClaseX a ClaseY para que sea herencia"
   - "convierte la asociación entre A y B en agregación"
   - "actualiza la relación A-B a composición"
   - "cambia la relación de A a B por implementación"
   - "modifica la relación entre X e Y a dependencia"

📏 **MODIFICAR CARDINALIDAD**:
   - "cambia la cardinalidad de ClaseA a ClaseB a 1:*"
   - "modifica la cardinalidad entre X e Y a 0..1:1..*"
   - "actualiza la multiplicidad de A-B a muchos a muchos (*:*)"
   - "establece la cardinalidad A-B como uno a uno (1:1)"

➕ **CREAR NUEVA RELACIÓN**:
   - "añade relación de herencia de ClaseHija a ClasePadre"
   - "crea composición entre ClaseContenedor y ClaseContenida con cardinalidad 1:*"
   - "agrega asociación de Cliente a Pedido"
   - "establece dependencia entre ClaseA y ClaseB"

🗑️ **ELIMINAR RELACIÓN**:
   - "elimina la relación entre ClaseA y ClaseB"
   - "quita la herencia de ClaseHija a ClasePadre"
   - "borra todas las relaciones de ClaseX"

🏗️ **CREAR CLASE DE ASOCIACIÓN**:
   - "crea una clase de asociación entre ClaseA y ClaseB"
   - "añade clase intermedia entre Cliente y Producto"
   - "cambia la cardinalidad de Clase1 a Clase2 a muchos a muchos" (genera clase de asociación)
   - "establece relación *:* entre Usuario y Proyecto" (genera clase de asociación)
   
   📋 **Comportamiento para Clases de Asociación**:
   - **Nombre**: Combina nombres de clases (ej: "ClienteProducto", "UsuarioProyecto")
   - **Posición**: En el punto medio entre las dos clases originales
   - **Atributos**: Incluye "id: string" y "fechaCreacion: Date"
   - **Relaciones**: Crea dos asociaciones simples hacia la nueva clase
   - **Elimina**: La relación directa original (si existe)

⚠️ **TIPOS DE RELACIÓN VÁLIDOS:**
   - Association|Asociación (por defecto)
   - Aggregation|Agregación
   - Composition|Composición  
   - Generalization|Generalización|Herencia
   - Implementation|Implementación
   - Dependency|Dependencia

📐 **FORMATOS DE CARDINALIDAD VÁLIDOS:**
   - "1:*" (uno a muchos)
   - "1:1" (uno a uno) 
   - "*:*" (muchos a muchos)
   - "0..1:1..*" (cero o uno a uno o muchos)
   - "1..*:0..1" (uno o muchos a cero o uno)

4. **OPERACIONES COMPLEJAS**:
   - "renombra clase A a B y añade atributo C"
   - "elimina clase X y redirige sus relaciones a Y"

🔄 COMPORTAMIENTO DE MODIFICACIÓN:

- **CONSERVAR**: Mantén TODOS los elementos no mencionados exactamente como están
- **AÑADIR**: Incluye nuevos elementos con IDs únicos y posiciones lógicas
- **ACTUALIZAR**: Modifica solo los elementos específicamente mencionados
- **ELIMINAR**: EXCLUYE completamente del resultado final los elementos a eliminar
- **IDs**: Mantén los IDs existentes siempre que sea posible para preservar referencias

📋 ESQUEMA JSON DE RESPUESTA:
{
  "elements": [
    {
      "id": "string_unico_mantenido_o_nuevo",
      "type": "classNode",
      "name": "NombreClase",
      "attributes": ["atributo: tipo", "id: UUID"],
      "methods": ["metodo(): tipo"],
      "position": { "x": 100, "y": 150 }
    }
  ],
  "relationships": [
    {
      "id": "string_unico_mantenido_o_nuevo",
      "type": "Association|Inheritance|Composition|Aggregation",
      "sourceId": "id_clase_origen",
      "targetId": "id_clase_destino", 
      "cardinality": "1:*|1:1|0..1:1..*|*:*"
    }
  ],
  "modifications": {
    "added": ["lista_ids_elementos_añadidos"],
    "modified": ["lista_ids_elementos_modificados"], 
    "removed": ["lista_ids_elementos_eliminados"]
  },
  "clarifyingQuestions": ["pregunta1", "pregunta2"] // OPCIONAL
}

🎯 FORMATO DE CARDINALIDAD:
- Usa formato "inicio:fin" (ej: "1:*", "0..1:1..*", "1:1")
- Ejemplos: "1:*" (uno a muchos), "1:1" (uno a uno), "*:*" (muchos a muchos)
- Para composición: típicamente "1:*" (padre a hijos)
- Siempre incluye cardinalidades en TODAS las relaciones

⚠️ REGLAS CRÍTICAS:
1) Respuesta = SOLO JSON válido (sin explicaciones adicionales)
2) Mantén la estructura y IDs existentes cuando no se modifiquen
3) Para eliminaciones: NO incluir el elemento en el resultado
4) Posiciones nuevas: distribución lógica evitando superposiciones
5) Conserva todas las propiedades no mencionadas en las modificaciones
6) Si necesitas aclaración, usa "clarifyingQuestions"
7) Incluye el campo "modifications" para tracking de cambios`;

class AIEditorController {
    // Helper: sleep for ms
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Try generating content with a single model with retries and exponential backoff
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
                if (/503|Service Unavailable|overload|overloaded/i.test(msg)) {
                    const backoff = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 500);
                    console.warn(`Model ${modelName} attempt ${attempt} failed with 503-ish error, backing off ${backoff}ms`);
                    await AIEditorController.sleep(backoff);
                } else {
                    throw err;
                }
            }
        }
        const err = new Error(`Model ${modelName} exhausted retries (likely overloaded)`);
        err.code = 'MODEL_OVERLOADED';
        throw err;
    }

    // Try a list of models in order
    static async _generateUsingModels(modelsList, prompt) {
        const arr = Array.isArray(modelsList) ? modelsList : String(modelsList || '').split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length === 0) arr.push('gemini-2.5-flash');
        let lastError = null;
        for (const m of arr) {
            try {
                const text = await AIEditorController._tryGenerateWithModel(m, prompt, 3);
                return { model: m, text };
            } catch (err) {
                lastError = err;
                if (err && err.code === 'MODEL_OVERLOADED') {
                    console.warn(`Model ${m} overloaded, trying next model if available`);
                    continue;
                } else {
                    throw err;
                }
            }
        }
        const e = new Error(`All models exhausted or overloaded. Last error: ${lastError?.message || String(lastError)}`);
        e.cause = lastError;
        throw e;
    }

    // Normalize relationship type to standard format (handles synonyms)
    static normalizeRelationshipType(type) {
        if (!type || typeof type !== 'string') {
            return 'Association';
        }

        const normalized = type.toLowerCase().trim();
        
        // Map of synonyms to standard types
        const typeMap = {
            // Standard types (case insensitive)
            'association': 'Association',
            'aggregation': 'Aggregation', 
            'composition': 'Composition',
            'generalization': 'Generalization',
            'implementation': 'Implementation',
            'dependency': 'Dependency',
            
            // Spanish synonyms
            'asociación': 'Association',
            'asociacion': 'Association',
            'agregación': 'Aggregation',
            'agregacion': 'Aggregation',
            'composición': 'Composition',
            'composicion': 'Composition',
            'generalización': 'Generalization',
            'generalizacion': 'Generalization',
            'implementación': 'Implementation',
            'implementacion': 'Implementation',
            'dependencia': 'Dependency',
            
            // Common synonyms
            'herencia': 'Generalization',
            'inheritance': 'Generalization',
            'extends': 'Generalization',
            'implements': 'Implementation',
            'uses': 'Dependency',
            'usa': 'Dependency',
            'depende': 'Dependency',
            'compone': 'Composition',
            'contiene': 'Aggregation',
            'tiene': 'Association'
        };

        return typeMap[normalized] || 'Association';
    }

    // Validate relationship type
    static validateRelationshipType(type) {
        const validTypes = ['Association', 'Aggregation', 'Composition', 
                           'Generalization', 'Implementation', 'Dependency'];
        return validTypes.includes(type);
    }

    // Extract relationship information from prompt
    static extractRelationshipInfo(prompt, currentRelationships) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Patterns to identify relationship modifications
        const patterns = {
            typeChange: [
                /(?:modifica|cambia|actualiza|convierte)\s+(?:la\s+)?relaci[oó]n\s+(?:a|para\s+que\s+sea|en)\s+([a-zA-Z\sóéíúñ]+)\s+(?:de|entre)\s+([a-zA-Z0-9_]+)\s+(?:a|y|hacia)\s+([a-zA-Z0-9_]+)/gi,
                /(?:cambia|modifica)\s+(?:la\s+)?relaci[oó]n\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)\s+(?:a|para|por)\s+([a-zA-Z\sóéíúñ]+)/gi,
                /(?:convierte|cambia)\s+(?:la\s+)?(?:asociaci[oó]n|relaci[oó]n)\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)\s+en\s+([a-zA-Z\sóéíúñ]+)/gi,
                /(?:cambia|modifica)\s+(?:el\s+tipo\s+de\s+)?(?:la\s+)?relaci[oó]n\s+(?:de\s+)?([a-zA-Z0-9_]+)[\s-]+([a-zA-Z0-9_]+)\s+(?:a|por)\s+([a-zA-Z\sóéíúñ]+)/gi
            ],
            cardinalityChange: [
                /(?:actualiza|cambia|modifica|establece)\s+(?:la\s+)?cardinalidad\s+(?:de|entre)\s+([a-zA-Z0-9_]+)\s+(?:a|y|hacia)\s+([a-zA-Z0-9_]+)\s+(?:a|como)\s+([0-9.*:\.]+)/gi,
                /(?:cardinalidad|multiplicidad)\s+(?:de\s+)?([a-zA-Z0-9_]+)[\s-]+([a-zA-Z0-9_]+)\s+(?:a|como|sea)\s+([0-9.*:\.]+)/gi
            ],
            newRelation: [
                /(?:añade|crea|agrega|establece)\s+(?:una\s+)?relaci[oó]n\s+(?:de\s+)?([a-zA-Z\sóéíúñ]+)\s+(?:de|entre)\s+([a-zA-Z0-9_]+)\s+(?:a|y|hacia)\s+([a-zA-Z0-9_]+)/gi,
                /(?:añade|crea|agrega)\s+([a-zA-Z\sóéíúñ]+)\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)/gi
            ],
            deleteRelation: [
                /(?:elimina|quita|borra)\s+(?:la\s+)?relaci[oó]n\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)/gi,
                /(?:elimina|quita)\s+(?:la\s+)?([a-zA-Z\sóéíúñ]+)\s+(?:de|entre)\s+([a-zA-Z0-9_]+)\s+(?:a|y)\s+([a-zA-Z0-9_]+)/gi
            ],
            associationClass: [
                /(?:crea|añade|agrega)\s+(?:una\s+)?clase\s+de\s+asociaci[oó]n\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)/gi,
                /(?:clase|nodo)\s+(?:de\s+)?(?:asociaci[oó]n|intermedi[ao])\s+entre\s+([a-zA-Z0-9_]+)\s+y\s+([a-zA-Z0-9_]+)/gi,
                /(?:cambia|modifica|establece)\s+(?:la\s+)?cardinalidad\s+(?:de|entre)\s+([a-zA-Z0-9_]+)\s+(?:a|y)\s+([a-zA-Z0-9_]+)\s+(?:a|como)\s+(?:muchos\s+a\s+muchos|\*:\*|m:n|n:m|many\s+to\s+many)/gi
            ]
        };

        const result = {
            operation: null,
            sourceClass: null,
            targetClass: null,
            newType: null,
            newCardinality: null,
            relationId: null,
            associationClassName: null
        };

        // Check for association class creation first (highest priority)
        for (const pattern of patterns.associationClass) {
            const match = pattern.exec(lowerPrompt);
            if (match) {
                result.operation = 'createAssociationClass';
                result.sourceClass = match[1];
                result.targetClass = match[2];
                result.associationClassName = AIEditorController.generateAssociationClassName(match[1], match[2]);
                break;
            }
        }

        // Check for type changes
        if (!result.operation) {
            for (const pattern of patterns.typeChange) {
                const match = pattern.exec(lowerPrompt);
                if (match) {
                    result.operation = 'changeType';
                    result.sourceClass = match[1];
                    result.targetClass = match[2] || match[1]; // If only one class mentioned, it's both
                    result.newType = AIEditorController.normalizeRelationshipType(match[3] || match[2]);
                    break;
                }
            }
        }

        // Check for cardinality changes
        if (!result.operation) {
            for (const pattern of patterns.cardinalityChange) {
                const match = pattern.exec(lowerPrompt);
                if (match) {
                    result.operation = 'changeCardinality';
                    result.sourceClass = match[1];
                    result.targetClass = match[2];
                    result.newCardinality = match[3];
                    break;
                }
            }
        }

        // Check for new relations
        if (!result.operation) {
            for (const pattern of patterns.newRelation) {
                const match = pattern.exec(lowerPrompt);
                if (match) {
                    result.operation = 'create';
                    result.newType = AIEditorController.normalizeRelationshipType(match[1]);
                    result.sourceClass = match[2];
                    result.targetClass = match[3];
                    break;
                }
            }
        }

        // Check for deletion
        if (!result.operation) {
            for (const pattern of patterns.deleteRelation) {
                const match = pattern.exec(lowerPrompt);
                if (match) {
                    result.operation = 'delete';
                    result.sourceClass = match[2] || match[1];
                    result.targetClass = match[3] || match[2];
                    if (match[1] && !match[3]) {
                        // If it's a type mention like "herencia", normalize it
                        result.deleteType = AIEditorController.normalizeRelationshipType(match[1]);
                    }
                    break;
                }
            }
        }

        // Try to find the actual relationship ID in current relationships
        if (result.sourceClass && result.targetClass && currentRelationships) {
            const found = currentRelationships.find(rel => {
                const matchesSource = rel.sourceId.toLowerCase().includes(result.sourceClass.toLowerCase()) ||
                                    rel.sourceId === result.sourceClass;
                const matchesTarget = rel.targetId.toLowerCase().includes(result.targetClass.toLowerCase()) ||
                                    rel.targetId === result.targetClass;
                return matchesSource && matchesTarget;
            });
            if (found) {
                result.relationId = found.id;
            }
        }

        return result;
    }

    // Create association class directly without AI
    static createAssociationClassDirectly(relationshipInfo, currentState, salaId) {
        try {
            const { sourceClass, targetClass, associationClassName } = relationshipInfo;
            
            // Find source and target classes in current state
            const sourceElement = currentState.elements.find(el => 
                el.id.toLowerCase().includes(sourceClass.toLowerCase()) || 
                el.name.toLowerCase().includes(sourceClass.toLowerCase())
            );
            const targetElement = currentState.elements.find(el => 
                el.id.toLowerCase().includes(targetClass.toLowerCase()) || 
                el.name.toLowerCase().includes(targetClass.toLowerCase())
            );
            
            if (!sourceElement || !targetElement) {
                return { success: false, error: 'Source or target class not found' };
            }
            
            // Calculate midpoint position
            const midX = (sourceElement.position.x + targetElement.position.x) / 2;
            const midY = (sourceElement.position.y + targetElement.position.y) / 2;
            
            // Generate unique ID for association class
            const assocId = `assoc_${sourceElement.id}_${targetElement.id}_${Date.now()}`;
            
            // Create association class
            const associationClass = {
                id: assocId,
                type: 'classNode',
                position: { x: midX, y: midY },
                data: {
                    className: associationClassName,
                    attributes: ['id: string', 'fechaCreacion: Date'],
                    methods: [],
                    _aiModified: true
                }
            };
            
            // Create new relationships
            const rel1Id = `rel_${sourceElement.id}_${assocId}_${Date.now()}`;
            const rel2Id = `rel_${assocId}_${targetElement.id}_${Date.now() + 1}`;
            
            const relationship1 = {
                id: rel1Id,
                sourceId: sourceElement.id,
                targetId: assocId,
                type: 'Association',
                cardinality: null
            };
            
            const relationship2 = {
                id: rel2Id,
                sourceId: assocId,
                targetId: targetElement.id,
                type: 'Association',
                cardinality: null
            };
            
            // Find and remove existing direct relationship if any
            const existingRelIndex = currentState.relationships.findIndex(rel => 
                (rel.sourceId === sourceElement.id && rel.targetId === targetElement.id) ||
                (rel.sourceId === targetElement.id && rel.targetId === sourceElement.id)
            );
            
            // Build new state
            const newElements = [...currentState.elements, associationClass];
            const newRelationships = [...currentState.relationships];
            
            let removedRelations = [];
            if (existingRelIndex !== -1) {
                removedRelations = [newRelationships[existingRelIndex].id];
                newRelationships.splice(existingRelIndex, 1);
            }
            
            newRelationships.push(relationship1, relationship2);
            
            // Convert to frontend format
            const resultNodes = newElements.map(el => ({
                id: el.id,
                type: 'classNode',
                position: el.position,
                data: {
                    className: el.name,
                    attributes: Array.isArray(el.attributes) ? el.attributes : [],
                    methods: Array.isArray(el.methods) ? el.methods : [],
                    _aiModified: true
                }
            }));
            
            const resultEdges = newRelationships.map(rel => {
                const cardinalityData = AIEditorController.parseCardinality(rel.cardinality);
                return {
                    id: `edge_${rel.id}_${Date.now()}`,
                    source: rel.sourceId,
                    target: rel.targetId,
                    type: 'umlEdge',
                    data: {
                        type: rel.type || 'Association',
                        cardinality: rel.cardinality,
                        startLabel: cardinalityData.startLabel,
                        endLabel: cardinalityData.endLabel,
                        _aiModified: true
                    }
                };
            });
            
            return {
                success: true,
                newState: {
                    nodes: resultNodes,
                    edges: resultEdges
                },
                modifications: {
                    added: [assocId, rel1Id, rel2Id],
                    modified: [],
                    removed: removedRelations
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Generate association class name from two class names
    static generateAssociationClassName(class1, class2) {
        // Clean class names and capitalize first letters
        const cleanName1 = class1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanName2 = class2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // Capitalize first letters
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
        
        return capitalize(cleanName1) + capitalize(cleanName2);
    }

    // Parse cardinality string and extract startLabel and endLabel
    static parseCardinality(cardinality) {
        if (!cardinality || typeof cardinality !== 'string') {
            return { startLabel: null, endLabel: null };
        }

        let startLabel = null;
        let endLabel = null;

        // Clean the cardinality string
        const cleaned = cardinality.trim()
            .replace(/\s*—\s*|\s*-\s*|\s*to\s*/gi, ':')  // Replace dashes and "to" with colon
            .replace(/\s+/g, '');  // Remove spaces

        // Check for colon separator
        if (cleaned.includes(':')) {
            const parts = cleaned.split(':');
            startLabel = parts[0] || null;
            endLabel = parts[1] || null;
        } else {
            // Single cardinality value - apply to both sides
            startLabel = cleaned;
            endLabel = cleaned;
        }

        // Normalize common patterns
        const normalize = (label) => {
            if (!label) return null;
            
            label = label
                .replace(/\bn\b/gi, '*')  // n -> *
                .replace(/\.\.many/gi, '..*')  // ..many -> ..*
                .replace(/\.\.(\*|n)/gi, '..*')  // ..* or ..n -> ..*
                .replace(/^(\d+)\.\.(\*|\d+)$/gi, '$1..$2')  // Ensure proper format
                .replace(/^(\*|\d+)$/gi, '$1');  // Single values

            return label === '' ? null : label;
        };

        return {
            startLabel: normalize(startLabel),
            endLabel: normalize(endLabel)
        };
    }

    // Basic diagram structure validation and normalization
    static validateAndNormalizeEditorResponse(response) {
        if (!response || typeof response !== 'object') {
            throw new Error('Respuesta del editor no es un objeto válido');
        }

        // Normalize elements
        if (!response.elements) {
            response.elements = [];
        }
        if (!Array.isArray(response.elements)) {
            response.elements = Object.values(response.elements || {});
        }

        // Normalize relationships
        if (!response.relationships) {
            response.relationships = [];
        }
        if (!Array.isArray(response.relationships)) {
            response.relationships = Object.values(response.relationships || {});
        }

        // Ensure modifications tracking exists
        if (!response.modifications) {
            response.modifications = {
                added: [],
                modified: [],
                removed: []
            };
        }

        // Validate and normalize each element
        response.elements.forEach((element, index) => {
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
            if (!element.position) {
                element.position = { x: 100 + (index * 250), y: 100 };
            }
        });

        // Validate relationships
        response.relationships.forEach((rel, index) => {
            if (!rel.id) {
                rel.id = `rel_${Date.now()}_${index}`;
            }
            if (!rel.type) {
                rel.type = 'Association';
            }
        });

        return response;
    }

    // Main modify diagram function
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
                    type: e.data?.type || 'Association',
                    cardinality: e.data?.cardinality
                })) : []
            };

            // Analizar el prompt para detectar operaciones específicas de relaciones
            const relationshipInfo = AIEditorController.extractRelationshipInfo(prompt, currentState.relationships);
            
            // Manejar creación de clases de asociación automáticamente
            if (relationshipInfo.operation === 'createAssociationClass') {
                const result = AIEditorController.createAssociationClassDirectly(
                    relationshipInfo, 
                    currentState, 
                    salaId
                );
                
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        message: `Clase de asociación "${relationshipInfo.associationClassName}" creada entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`,
                        newState: result.newState,
                        modifications: result.modifications,
                        relationshipOperation: {
                            operation: relationshipInfo.operation,
                            sourceClass: relationshipInfo.sourceClass,
                            targetClass: relationshipInfo.targetClass,
                            associationClassName: relationshipInfo.associationClassName
                        }
                    });
                }
                // Si falla el procesamiento directo, continúa con IA
            }

            // Construir el prompt contextual para la IA
            let aiPrompt = `ESTADO ACTUAL DEL DIAGRAMA:\n${JSON.stringify(currentState, null, 2)}\n\n`;
            
            if (clarification && originalPrompt) {
                aiPrompt += `INSTRUCCIÓN ORIGINAL: ${originalPrompt}\n`;
                aiPrompt += `ACLARACIÓN DEL USUARIO: ${clarification}\n\n`;
                aiPrompt += `Ahora que tienes la aclaración, procede con la modificación solicitada.`;
            } else {
                aiPrompt += `INSTRUCCIÓN DE MODIFICACIÓN: ${prompt}\n\n`;
                
                // Agregar contexto específico si se detectó una operación de relación
                if (relationshipInfo.operation) {
                    aiPrompt += `🔍 OPERACIÓN DETECTADA: ${relationshipInfo.operation}\n`;
                    if (relationshipInfo.sourceClass && relationshipInfo.targetClass) {
                        aiPrompt += `📋 CLASES INVOLUCRADAS: ${relationshipInfo.sourceClass} → ${relationshipInfo.targetClass}\n`;
                    }
                    if (relationshipInfo.newType) {
                        aiPrompt += `🔄 NUEVO TIPO: ${relationshipInfo.newType}\n`;
                    }
                    if (relationshipInfo.newCardinality) {
                        aiPrompt += `📏 NUEVA CARDINALIDAD: ${relationshipInfo.newCardinality}\n`;
                    }
                    if (relationshipInfo.relationId) {
                        aiPrompt += `🆔 RELACIÓN IDENTIFICADA: ${relationshipInfo.relationId}\n`;
                    }
                    
                    // Instrucciones especiales para clases de asociación
                    if (relationshipInfo.operation === 'createAssociationClass') {
                        aiPrompt += `🏗️ CREAR CLASE DE ASOCIACIÓN:\n`;
                        aiPrompt += `   - Nombre: "${relationshipInfo.associationClassName}"\n`;
                        aiPrompt += `   - Atributos: ["id: string", "fechaCreacion: Date"]\n`;
                        aiPrompt += `   - Posición: En el punto medio entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}\n`;
                        aiPrompt += `   - Crear asociaciones: ${relationshipInfo.sourceClass} → ${relationshipInfo.associationClassName} y ${relationshipInfo.associationClassName} → ${relationshipInfo.targetClass}\n`;
                        aiPrompt += `   - Eliminar relación directa si existe\n`;
                    }
                    
                    aiPrompt += `\n`;
                }
                
                aiPrompt += `
🎯 INSTRUCCIONES ESPECÍFICAS:
- **PRESERVAR** todas las clases del estado actual que no se mencionen
- **MANTENER** todos los IDs existentes (${currentState.elements.map(e => e.id).join(', ')})
- **APLICAR** solo los cambios específicos solicitados
- **NO DUPLICAR** elementos existentes
- Si eliminas relaciones, mantén las clases intactas
- Si necesitas aclaración, usa 'clarifyingQuestions'

RESULTADO ESPERADO: Estado modificado basado en el estado actual, NO un diagrama completamente nuevo.`;
            }



            // Llamar a la IA para procesar la modificación
            const fullPrompt = `${EDITOR_SYSTEM_PROMPT}\n\n${aiPrompt}`;
            const modelsEnv = process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const modelsList = Array.isArray(modelsEnv) ? modelsEnv : String(modelsEnv).split(',').map(s => s.trim()).filter(Boolean);
            
            let genResult;
            try {
                genResult = await AIEditorController._generateUsingModels(modelsList, fullPrompt);
            } catch (err) {
                console.error('All models failed in modifyDiagram:', err);
                throw new Error(`All models failed or overloaded: ${err.message}`);
            }

            const text = genResult.text;

            // Parse JSON response
            let aiResponse;
            try {
                aiResponse = JSON.parse(text);
            } catch (parseError) {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    aiResponse = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('La respuesta de AI no contiene JSON válido');
                }
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

            // Validar y normalizar la respuesta
            const validatedResponse = AIEditorController.validateAndNormalizeEditorResponse(aiResponse);

            // Convertir respuesta de IA a formato React Flow
            const resultNodes = validatedResponse.elements.map((element, index) => ({
                id: element.id || `node_${Date.now()}_${index}`,
                type: 'classNode',
                position: element.position || { 
                    x: Math.random() * 600 + 100, 
                    y: Math.random() * 400 + 100 
                },
                data: {
                    className: element.name,
                    attributes: Array.isArray(element.attributes) ? element.attributes : [],
                    methods: Array.isArray(element.methods) ? element.methods : [],
                    _aiModified: true
                }
            }));

            // Procesar relaciones con cardinalidades
            const resultEdges = [];
            const existingNodeIds = new Set(resultNodes.map(n => n.id));

            for (const relationship of validatedResponse.relationships) {
                let sourceId = relationship.sourceId;
                let targetId = relationship.targetId;

                // Resolver por nombre si el ID no existe
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
                    // Procesar cardinalidad
                    const cardinalityData = AIEditorController.parseCardinality(relationship.cardinality);
                    
                    resultEdges.push({
                        id: relationship.id || `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        source: sourceId,
                        target: targetId,
                        type: 'umlEdge',
                        data: {
                            type: relationship.type || 'Association',
                            cardinality: relationship.cardinality,
                            startLabel: cardinalityData.startLabel,
                            endLabel: cardinalityData.endLabel,
                            _aiModified: true
                        }
                    });
                }
            }



            // Construir mensaje específico basado en la operación detectada
            let responseMessage = `Modificación aplicada correctamente.`;
            
            if (relationshipInfo.operation) {
                switch (relationshipInfo.operation) {
                    case 'changeType':
                        responseMessage = `Tipo de relación cambiado a ${relationshipInfo.newType} entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`;
                        break;
                    case 'changeCardinality':
                        responseMessage = `Cardinalidad actualizada a ${relationshipInfo.newCardinality} entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`;
                        break;
                    case 'create':
                        responseMessage = `Nueva relación de tipo ${relationshipInfo.newType} creada entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`;
                        break;
                    case 'delete':
                        responseMessage = `Relación eliminada entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`;
                        break;
                    case 'createAssociationClass':
                        responseMessage = `Clase de asociación "${relationshipInfo.associationClassName}" creada entre ${relationshipInfo.sourceClass} y ${relationshipInfo.targetClass}.`;
                        break;
                    default:
                        responseMessage = `Modificación de relación aplicada entre ${relationshipInfo.sourceClass || ''} y ${relationshipInfo.targetClass || ''}.`;
                }
            } else {
                responseMessage += ` ${validatedResponse.modifications?.added?.length || 0} añadido(s), ${validatedResponse.modifications?.modified?.length || 0} modificado(s), ${validatedResponse.modifications?.removed?.length || 0} eliminado(s).`;
            }

            const response = {
                success: true,
                message: responseMessage,
                newState: { 
                    nodes: resultNodes, 
                    edges: resultEdges 
                },
                modifications: validatedResponse.modifications || {
                    added: [],
                    modified: [],
                    removed: []
                },
                relationshipOperation: relationshipInfo.operation ? {
                    operation: relationshipInfo.operation,
                    sourceClass: relationshipInfo.sourceClass,
                    targetClass: relationshipInfo.targetClass,
                    newType: relationshipInfo.newType,
                    newCardinality: relationshipInfo.newCardinality,
                    relationId: relationshipInfo.relationId
                } : null,
                clarifyingQuestions: aiResponse.clarifyingQuestions || []
            };

            return res.json(response);

        } catch (err) {
            console.error('❌ AIEditorController modifyDiagram error:', err);
            return res.status(500).json({ 
                success: false, 
                error: `Error al procesar modificación: ${err.message || String(err)}` 
            });
        }
    }

    // Get editor features
    static async getEditorFeatures(req, res) {
        try {
            const modelsEnv = process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const models = Array.isArray(modelsEnv) ? modelsEnv : String(modelsEnv).split(',').map(s => s.trim()).filter(Boolean);
            
            res.json({
                success: true,
                features: {
                    diagramEditing: true,
                    addElements: true,
                    modifyElements: true,
                    removeElements: true,
                    cardinalitySupport: true,
                    relationshipEditing: true,
                    synonymSupport: true,
                    clarificationQuestions: true,
                    models
                },
                operations: [
                    'add', 'modify', 'remove', 'rename', 
                    'update-attributes', 'update-methods', 
                    'change-relationships', 'update-cardinality',
                    'create-relationship', 'delete-relationship',
                    'change-relationship-type'
                ],
                supportedRelationshipTypes: [
                    'Association', 'Aggregation', 'Composition',
                    'Generalization', 'Implementation', 'Dependency'
                ],
                synonyms: {
                    'herencia': 'Generalization',
                    'inheritance': 'Generalization', 
                    'agregación': 'Aggregation',
                    'composición': 'Composition',
                    'implementación': 'Implementation',
                    'dependencia': 'Dependency',
                    'asociación': 'Association'
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

export default AIEditorController;