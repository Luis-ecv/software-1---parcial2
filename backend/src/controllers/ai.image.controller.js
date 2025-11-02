import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your_gemini_api_key_here');

class AIImageController {
    // Analyze image using Gemini Vision
    static async analyzeImage(imageFile) {
        let tempPath; // Define tempPath here to be accessible in the finally block
        try {
            // Save the image file temporarily
            tempPath = path.join(__dirname, '../../temp/', `image_${Date.now()}.jpg`);
            
            // Create temp directory if it doesn't exist
            const tempDir = path.dirname(tempPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(tempPath, imageFile.buffer);

            // Gemini Vision implementation (model configurable via GEMINI_MODEL env var)
            const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

            // Read image as base64
            const imageBuffer = fs.readFileSync(tempPath);
            const base64Image = imageBuffer.toString('base64');

            const prompt = `Analiza esta imagen y describe cualquier diagrama de clases, esquemas, o estructuras de datos que veas. 
            Si ves un diagrama UML, describe las clases, atributos, métodos y relaciones.
            Si ves texto relacionado con programación o bases de datos, descríbelo detalladamente.
            Si no hay nada relacionado con diagramas o programación, di qué ves en la imagen de manera general.`;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: imageFile.mimetype || 'image/jpeg'
                    }
                }
            ]);

            const response = await result.response;
            const text = await response.text();
            return text;

        } catch (error) {
            console.error('Error analizando imagen:', error);
            throw new Error(`Error analizando imagen: ${error.message}`);
        } finally {
            // Clean up temp file
            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    // Process image input and generate diagram
    static async processImageInput(req, res) {
        try {
            const { salaId } = req.body;

            // Handle image file from FormData
            if (!req.files || !req.files.image) {
                throw new Error('No se encontró archivo de imagen');
            }

            // Analyze image
            const analyzedText = await AIImageController.analyzeImage(req.files.image[0]);
            
            // Import the main AI controller to use its diagram generation
            const AIController = (await import('./ai.controller.js')).default;
            
            // Generate diagram using analyzed text
            const diagram = await AIController.generateUMLFromText(analyzedText);
            
            // Validate and normalize diagram structure
            AIController.validateDiagramStructure(diagram);

            const responseMessage = `Diagrama generado desde imagen`;

            res.json({
                success: true,
                message: responseMessage,
                diagram: diagram,
                originalInput: analyzedText
            });

        } catch (error) {
            console.error('Error en Image Controller:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default AIImageController;