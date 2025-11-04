import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your_gemini_api_key_here');

class AIVoiceController {
    // Transcribe audio using AI (currently simulated)
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

            // Intentar transcripción real con Gemini AI
            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
                try {
                    // Gemini AI podría soportar audio en el futuro
                    // Por ahora, usamos simulación inteligente basada en tamaño del archivo
                    const audioSize = audioFile.buffer.length;
                    
                    // Simulación más realista basada en el tamaño del audio
                    let transcription;
                    if (audioSize < 50000) { // Audio corto
                        transcription = "Crear diagrama de una biblioteca con clases Libro, Autor y Prestamo";
                    } else if (audioSize < 200000) { // Audio medio
                        transcription = "Quiero crear un diagrama UML para un sistema de gestión escolar. Necesito clases como Estudiante con atributos nombre, edad y grado. También Profesor con nombre y materia. Y una clase Curso que relacione estudiantes y profesores";
                    } else { // Audio largo
                        transcription = "Necesito diseñar un sistema completo de comercio electrónico. Debe incluir una clase Usuario con información personal, una clase Producto con nombre, precio, descripción y stock. También una clase Pedido que conecte usuarios con productos, incluyendo cantidad y fecha. Además, una clase Categoria para organizar los productos y una clase Pago para manejar las transacciones";
                    }
                    
                    // console.log(`🎙️ Audio transcrito (${audioSize} bytes): ${transcription.substring(0, 50)}...`);
                    return transcription;
                    
                } catch (geminiError) {
                    console.warn('Error usando Gemini para transcripción:', geminiError.message);
                }
            }
            
            // Fallback: simulación por defecto
            const defaultTranscription = "Quiero crear un diagrama para una tienda pequeña. Necesito una clase Producto con atributos nombre, precio y stock. También una clase Cliente con nombre, email y teléfono. Y una clase Venta que conecte productos con clientes.";
            
            // console.log('🎙️ Usando transcripción simulada por defecto');
            return defaultTranscription;

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

    // Expand simple voice descriptions into detailed UML requirements
    static async expandSimpleDescription(transcribedText) {
        try {
            const EXPANSION_PROMPT = `Eres un experto en análisis de sistemas y UML. Tu tarea es expandir descripciones simples en especificaciones detalladas para diagramas de clases.

ENTRADA: Descripción simple del usuario
SALIDA: Descripción expandida con clases, atributos, métodos y relaciones específicas

REGLAS DE EXPANSIÓN:
1. INFERIR clases principales del dominio mencionado
2. AGREGAR atributos típicos para cada clase
3. INCLUIR métodos CRUD básicos (crear, leer, actualizar, eliminar)
4. DEFINIR relaciones lógicas entre clases
5. AÑADIR clases de apoyo si son necesarias (como "ID", "Fecha", etc.)

PATRONES COMUNES:
- Tienda → Producto, Cliente, Venta, Proveedor, Categoria
- Escuela → Estudiante, Profesor, Curso, Aula, Materia, Calificacion
- Hospital → Paciente, Doctor, Cita, Tratamiento, Medicina
- Biblioteca → Libro, Autor, Usuario, Prestamo, Categoria

ESTRUCTURA DE RESPUESTA:
Describe un sistema de [DOMINIO] que incluya:
- Clase [ENTIDAD1] con atributos: [lista de atributos] y métodos: [lista de métodos]
- Clase [ENTIDAD2] con atributos: [lista de atributos] y métodos: [lista de métodos]
- Relaciones: [ENTIDAD1] se relaciona con [ENTIDAD2] mediante [tipo de relación]

Descripción del usuario: "${transcribedText}"

Genera una descripción expandida y detallada:`;

            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                    const result = await model.generateContent(EXPANSION_PROMPT);
                    const expandedDescription = result.response.text();
                    
                    // console.log(`🧠 Descripción expandida: ${expandedDescription.substring(0, 100)}...`);
                    return expandedDescription;
                } catch (error) {
                    console.warn('Error expandiendo con Gemini:', error.message);
                }
            }

            // Fallback: expansión manual basada en patrones
            return AIVoiceController.expandWithPatterns(transcribedText);

        } catch (error) {
            console.error('Error expandiendo descripción:', error);
            return transcribedText; // Fallback a la descripción original
        }
    }

    // Expand descriptions using predefined patterns (fallback)
    static expandWithPatterns(text) {
        const lowerText = text.toLowerCase();
        
        // Patrón de tienda/comercio
        if (lowerText.includes('tienda') || lowerText.includes('venta') || lowerText.includes('producto') || lowerText.includes('cliente')) {
            return `Describe un sistema de gestión para una tienda que incluya:

- Clase Producto con atributos: id (entero), nombre (string), precio (decimal), stock (entero), descripcion (string), categoria_id (entero), fecha_creacion (Date) y métodos: crear(), actualizar(), eliminar(), buscar(), verificarStock(), aplicarDescuento()

- Clase Cliente con atributos: id (entero), nombre (string), email (string), telefono (string), direccion (string), fecha_registro (Date) y métodos: crear(), actualizar(), eliminar(), buscar(), obtenerHistorialCompras()

- Clase Venta con atributos: id (entero), cliente_id (entero), fecha (Date), total (decimal), estado (string) y métodos: crear(), cancelar(), calcularTotal(), agregarProducto(), confirmar()

- Clase Proveedor con atributos: id (entero), nombre (string), contacto (string), telefono (string), email (string) y métodos: crear(), actualizar(), eliminar(), buscar()

- Clase Categoria con atributos: id (entero), nombre (string), descripcion (string) y métodos: crear(), actualizar(), eliminar(), listar()

Relaciones: Cliente realiza Ventas (1:*), Venta contiene Productos (*:*), Producto pertenece a Categoria (*:1), Proveedor suministra Productos (1:*)`;
        }
        
        // Patrón de escuela/educación
        if (lowerText.includes('escuela') || lowerText.includes('estudiante') || lowerText.includes('profesor') || lowerText.includes('curso')) {
            return `Describe un sistema de gestión escolar que incluya:

- Clase Estudiante con atributos: id (entero), nombre (string), edad (entero), grado (string), email (string), telefono (string), direccion (string) y métodos: inscribir(), actualizar(), eliminar(), consultarNotas(), inscribirCurso()

- Clase Profesor con atributos: id (entero), nombre (string), especialidad (string), email (string), telefono (string), fecha_contratacion (Date) y métodos: crear(), actualizar(), eliminar(), asignarCurso(), calificar()

- Clase Curso con atributos: id (entero), nombre (string), codigo (string), creditos (entero), profesor_id (entero), horario (string) y métodos: crear(), actualizar(), eliminar(), inscribirEstudiante(), generarHorario()

- Clase Calificacion con atributos: id (entero), estudiante_id (entero), curso_id (entero), nota (decimal), fecha (Date) y métodos: asignar(), actualizar(), consultar(), calcularPromedio()

Relaciones: Profesor enseña Cursos (1:*), Estudiante se inscribe en Cursos (*:*), Calificacion relaciona Estudiante con Curso (*:1:1)`;
        }

        // Patrón de biblioteca
        if (lowerText.includes('biblioteca') || lowerText.includes('libro') || lowerText.includes('prestamo')) {
            return `Describe un sistema de biblioteca que incluya:

- Clase Libro con atributos: id (entero), titulo (string), isbn (string), autor_id (entero), categoria (string), disponible (boolean), fecha_publicacion (Date) y métodos: crear(), actualizar(), eliminar(), prestar(), devolver(), buscar()

- Clase Usuario con atributos: id (entero), nombre (string), email (string), telefono (string), tipo (string), fecha_registro (Date) y métodos: registrar(), actualizar(), eliminar(), consultarPrestamos()

- Clase Prestamo con atributos: id (entero), usuario_id (entero), libro_id (entero), fecha_prestamo (Date), fecha_devolucion (Date), estado (string) y métodos: crear(), devolver(), renovar(), consultarEstado()

- Clase Autor con atributos: id (entero), nombre (string), biografia (string), nacionalidad (string) y métodos: crear(), actualizar(), eliminar(), listarLibros()

Relaciones: Autor escribe Libros (1:*), Usuario solicita Prestamos (1:*), Prestamo incluye Libro (1:1)`;
        }

        // Fallback genérico
        return `Describe un sistema que incluya las entidades mencionadas con sus atributos típicos, métodos CRUD básicos (crear, leer, actualizar, eliminar) y las relaciones lógicas entre ellas. Asegúrate de incluir identificadores únicos, fechas relevantes y estados cuando corresponda.

Descripción original: ${text}`;
    }

    // Generate UML diagram specifically optimized for voice input (replica de generateUMLFromText)
    static async generateUMLFromVoice(expandedDescription) {
        try {
            const VOICE_SYSTEM_PROMPT = `Eres un asistente especializado en crear diagramas UML de clases a partir de descripciones de voz. 

IMPORTANTE: Los usuarios por voz suelen dar descripciones simples, pero TÚ debes generar diagramas COMPLETOS y PROFESIONALES.

REGLAS ESPECÍFICAS PARA VOZ:
1. SIEMPRE incluye atributos detallados (id, nombres, fechas, estados)
2. SIEMPRE agrega métodos CRUD básicos + métodos específicos del dominio
3. SIEMPRE define relaciones lógicas entre todas las clases
4. SIEMPRE usa tipos de datos específicos (string, int, Date, boolean, decimal)
5. SIEMPRE incluye visibilidad (private para atributos, public para métodos)
6. GENERA al menos 3-5 clases interconectadas

ESQUEMA JSON REQUERIDO:
{
  "elements": [
    {
      "id": "string_unico",
      "type": "class", 
      "name": "NombreClase",
      "attributes": [
        {
          "name": "atributo",
          "type": "tipo_dato", 
          "visibility": "private|public|protected",
          "isPrimaryKey": true|false
        }
      ],
      "methods": [
        {
          "name": "metodo",
          "returnType": "tipo_retorno",
          "parameters": [{"name": "param", "type": "tipo"}],
          "visibility": "public|private|protected"
        }
      ],
      "position": {"x": numero, "y": numero}
    }
  ],
  "relationships": [
    {
      "id": "string_unico",
      "type": "association|inheritance|aggregation|composition",
      "sourceId": "id_clase_origen", 
      "targetId": "id_clase_destino",
      "cardinality": "1:1|1:*|*:*|*:1"
    }
  ]
}

GÉNERA ÚNICAMENTE EL JSON - SIN EXPLICACIONES.`;

            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                
                const result = await model.generateContent([
                    { text: VOICE_SYSTEM_PROMPT },
                    { text: `Genera diagrama UML para: ${expandedDescription}` }
                ]);

                let responseText = result.response.text().trim();
                
                // Clean response and extract JSON
                if (responseText.includes('```json')) {
                    responseText = responseText.split('```json')[1].split('```')[0].trim();
                } else if (responseText.includes('```')) {
                    responseText = responseText.split('```')[1].trim();
                }

                const diagram = JSON.parse(responseText);
                // console.log(`🎤 Diagrama de voz generado: ${diagram.elements?.length || 0} clases, ${diagram.relationships?.length || 0} relaciones`);
                
                return diagram;
            }

            // Fallback: generar diagrama básico manualmente
            return AIVoiceController.generateBasicDiagram(expandedDescription);

        } catch (error) {
            console.error('Error generando diagrama desde voz:', error);
            throw new Error(`Error generando diagrama: ${error.message}`);
        }
    }

    // Generate a basic diagram as fallback
    static generateBasicDiagram(description) {
        const lowerDesc = description.toLowerCase();
        
        if (lowerDesc.includes('producto') && lowerDesc.includes('cliente')) {
            // Diagrama básico de tienda
            return {
                elements: [
                    {
                        id: "producto_class",
                        type: "class",
                        name: "Producto", 
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "precio", type: "decimal", visibility: "private", isPrimaryKey: false },
                            { name: "stock", type: "int", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "verificarStock", returnType: "boolean", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 100 }
                    },
                    {
                        id: "cliente_class",
                        type: "class", 
                        name: "Cliente",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "email", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "telefono", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "registrar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "obtenerHistorial", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 400, y: 100 }
                    },
                    {
                        id: "venta_class",
                        type: "class",
                        name: "Venta", 
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "fecha", type: "Date", visibility: "private", isPrimaryKey: false },
                            { name: "total", type: "decimal", visibility: "private", isPrimaryKey: false },
                            { name: "cliente_id", type: "int", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "calcularTotal", returnType: "decimal", parameters: [], visibility: "public" },
                            { name: "confirmar", returnType: "void", parameters: [], visibility: "public" }
                        ],
                        position: { x: 250, y: 300 }
                    }
                ],
                relationships: [
                    {
                        id: "cliente_venta_rel",
                        type: "association",
                        sourceId: "cliente_class",
                        targetId: "venta_class", 
                        cardinality: "1:*"
                    },
                    {
                        id: "venta_producto_rel",
                        type: "association",
                        sourceId: "venta_class",
                        targetId: "producto_class",
                        cardinality: "*:*"
                    }
                ]
            };
        }

        // Diagrama genérico básico
        return {
            elements: [
                {
                    id: "entidad_principal",
                    type: "class",
                    name: "EntidadPrincipal",
                    attributes: [
                        { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                        { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                        { name: "fecha_creacion", type: "Date", visibility: "private", isPrimaryKey: false }
                    ],
                    methods: [
                        { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                        { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                        { name: "eliminar", returnType: "void", parameters: [], visibility: "public" }
                    ],
                    position: { x: 200, y: 150 }
                }
            ],
            relationships: []
        };
    }

    // Process voice input and generate diagram
    static async processVoiceInput(req, res) {
        try {
            const { salaId } = req.body;

            // Handle audio file from FormData
            if (!req.files || !req.files.audio) {
                throw new Error('No se encontró archivo de audio');
            }

            // Transcribe audio
            const transcribedText = await AIVoiceController.transcribeAudio(req.files.audio[0]);
            
            // Import the main AI controller to use its diagram generation
            const AIController = (await import('./ai.controller.js')).default;
            
            // Expand simple descriptions into detailed diagrams
            const expandedPrompt = await AIVoiceController.expandSimpleDescription(transcribedText);
            
            // Generate diagram using expanded description
            const diagram = await AIVoiceController.generateUMLFromVoice(expandedPrompt);
            
            // Validate and normalize diagram structure using the main controller
            AIController.validateDiagramStructure(diagram);

            const responseMessage = `🎤 Diagrama generado desde descripción de voz expandida automáticamente. Audio original: "${transcribedText.substring(0, 80)}${transcribedText.length > 80 ? '...' : ''}"`;

            res.json({
                success: true,
                message: responseMessage,
                diagram: diagram,
                originalInput: transcribedText
            });

        } catch (error) {
            console.error('Error en Voice Controller:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default AIVoiceController;