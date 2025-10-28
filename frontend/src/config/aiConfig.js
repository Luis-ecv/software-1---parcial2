/**
 * Configuración para APIs de IA (Gemini, OpenAI, etc.)
 * Maneja credenciales y endpoints de manera segura
 */

// Configuración de APIs disponibles
const AI_PROVIDERS = {
  GEMINI: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
    apiKeyEnv: 'VITE_GEMINI_API_KEY',
    maxTokens: 8192,
    temperature: 0.1
  }
  // OPENAI: {
  //   name: 'OpenAI GPT',
  //   endpoint: 'https://api.openai.com/v1/chat/completions',
  //   apiKeyEnv: 'VITE_OPENAI_API_KEY',
  //   model: 'gpt-4-turbo-preview',
  //   maxTokens: 4096,
  //   temperature: 0.1
  // }
};

// Provider por defecto - SOLO GEMINI
export const DEFAULT_PROVIDER = 'GEMINI';

/**
 * Obtiene la configuración del proveedor de IA
 */
export const getAIConfig = (provider = DEFAULT_PROVIDER) => {
  const config = AI_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Proveedor de IA no soportado: ${provider}`);
  }
  
  const apiKey = import.meta.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Clave API no configurada para ${config.name}. Configura ${config.apiKeyEnv} en .env`);
  }
  
  return { ...config, apiKey };
};

/**
 * Valida que las credenciales estén configuradas
 */
export const validateAICredentials = (provider = DEFAULT_PROVIDER) => {
  try {
    getAIConfig(provider);
    return { valid: true, message: 'Credenciales válidas' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
};

/**
 * Headers para las peticiones - SOLO GEMINI
 */
export const getHeaders = (provider = DEFAULT_PROVIDER) => {
  if (provider !== 'GEMINI') {
    throw new Error(`Solo se soporta Gemini. Proveedor solicitado: ${provider}`);
  }
  
  return {
    'Content-Type': 'application/json'
  };
};

/**
 * Construye la URL del endpoint - SOLO GEMINI
 */
export const buildEndpointURL = (provider = DEFAULT_PROVIDER) => {
  if (provider !== 'GEMINI') {
    throw new Error(`Solo se soporta Gemini. Proveedor solicitado: ${provider}`);
  }
  
  const config = getAIConfig(provider);
  return `${config.endpoint}?key=${config.apiKey}`;
};