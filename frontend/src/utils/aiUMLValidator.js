/**
 * Revisor de diagramas UML mediante IA
 * Envía el JSON del diagrama a una IA (Gemini/OpenAI) para análisis experto
 */

import { getAIConfig, getHeaders, buildEndpointURL, DEFAULT_PROVIDER, validateAICredentials } from '../config/aiConfig.js';

// Re-exportar validateAICredentials para que esté disponible
export { validateAICredentials };

/**
 * Extrae el resumen del diagrama desde los nodos y edges de ReactFlow
 * Filtra nodos y edges de sistema para mostrar solo el diagrama UML real
 */
export const extractDiagramSummary = (nodes, edges) => {
  // Filtrar solo nodos UML reales (excluir nodos de sistema)
  const nodosUML = nodes.filter(node => {
    // Excluir nodos de sistema invisibles
    if (node.data?.isConnectionPoint) return false;
    
    // Excluir notas (son comentarios, no clases UML)
    if (node.data?.isNote) return false;
    
    // Incluir solo clases reales y clases de asociación
    return node.type === 'classNode' && node.data?.className;
  });

  const nodos = nodosUML.map(node => ({
    id: node.id,
    nombre: node.data?.className || node.id,
    estereotipo: node.data?.isAssociationClass ? 'association-class' : 
                (node.data?.stereotype || null),
    atributos: node.data?.attributes || [],
    metodos: node.data?.methods || [],
    esClaseAsociacion: node.data?.isAssociationClass || false,
    relacionAsociada: node.data?.associatedEdgeId || null
  }));

  // Filtrar solo edges UML reales (excluir conexiones de sistema)
  const edgesUML = edges.filter(edge => {
    // Excluir conexiones internas de clases de asociación
    if (edge.data?.isAssociationConnection) return false;
    
    // Excluir conexiones de notas
    if (edge.data?.isNoteConnection) return false;
    
    // Verificar que source y target sean nodos UML válidos
    const sourceExists = nodosUML.some(n => n.id === edge.source);
    const targetExists = nodosUML.some(n => n.id === edge.target);
    
    return sourceExists && targetExists;
  });

  const aristas = edgesUML.map(edge => ({
    id: edge.id,
    tipo: (edge.data?.type || 'Association').toLowerCase(),
    source: edge.source,
    target: edge.target,
    multiplicidadInicio: edge.data?.startLabel || null,
    multiplicidadFin: edge.data?.endLabel || null,
    rolInicio: edge.data?.sourceRole || null,
    rolFin: edge.data?.targetRole || null,
    etiqueta: edge.data?.label || null,
    tieneClaseAsociacion: edge.data?.hasAssociationClass || false,
    claseAsociacionId: edge.data?.associationClassId || null
  }));

  // Log para debugging
  console.log('📊 Extracción UML:', {
    nodosOriginales: nodes.length,
    nodosUML: nodos.length,
    edgesOriginales: edges.length,
    edgesUML: aristas.length,
    nodosExcluidos: nodes.length - nodos.length,
    edgesExcluidos: edges.length - aristas.length
  });

  return { nodos, aristas };
};

/**
 * Realiza verificaciones estructurales básicas localmente (opcional)
 */
export const performLocalChecks = (resumenJson) => {
  const { nodos, aristas } = resumenJson;
  
  // Detectar nodos aislados (excluyendo clases de asociación válidas)
  const nodosConectados = new Set();
  aristas.forEach(arista => {
    nodosConectados.add(arista.source);
    nodosConectados.add(arista.target);
  });
  
  const islas = nodos
    .filter(nodo => {
      // Las clases de asociación conectadas a una relación no son islas
      if (nodo.esClaseAsociacion && nodo.relacionAsociada) {
        return false;
      }
      return !nodosConectados.has(nodo.id);
    })
    .map(nodo => nodo.id);

  // Detectar referencias rotas con mejor contexto
  const idsNodos = new Set(nodos.map(n => n.id));
  const referenciasRotas = aristas
    .filter(arista => !idsNodos.has(arista.source) || !idsNodos.has(arista.target))
    .map(arista => ({
      source: arista.source,
      target: arista.target,
      motivo: `Nodo ${!idsNodos.has(arista.source) ? arista.source : arista.target} no existe en el diagrama`
    }));

  // Detectar duplicados básicos
  const nombresCont = {};
  nodos.forEach(nodo => {
    const nombre = nodo.nombre.toLowerCase();
    nombresCont[nombre] = (nombresCont[nombre] || 0) + 1;
  });
  
  const duplicados = {
    nodos: nodos.filter(nodo => nombresCont[nodo.nombre.toLowerCase()] > 1).map(n => n.id),
    aristas: []
  };

  const okEstructural = islas.length === 0 && 
                       referenciasRotas.length === 0 && 
                       duplicados.nodos.length === 0;

  return {
    okEstructural,
    islas,
    referenciasRotas,
    ciclosHerencia: [], // Se calculará por IA
    duplicados,
    tamanioAproximadoKB: Math.ceil(JSON.stringify(resumenJson).length / 1024)
  };
};

/**
 * Construye el prompt para la IA según las especificaciones
 */
const buildAIPrompt = (ui_context, resumen_json, resultados_locales_json = null) => {
  const systemPrompt = `Eres un revisor experto de diagramas UML.
Esta verificación debe ser realizada MEDIANTE IA con base EXCLUSIVA en el JSON proporcionado del diagrama.
DEVUELVE EXCLUSIVAMENTE JSON VÁLIDO UTF-8, SIN TEXTO EXTERNO, SIN COMENTARIOS.

OBJETIVO
- Evaluar el diagrama UML a partir del JSON de entrada y emitir un dictamen generado por IA:
  *si está estructuralmente correcto o no*, qué problemas presenta y qué acciones concretas debe tomar el usuario.
- Ofrecer recomendaciones de diseño (naming, acoplamiento, herencia vs. composición, clases sin uso, etc.) con enfoque práctico.

CONTEXTO DE INVOCACIÓN
- Origen: botón de UI "Verificar diagrama" presionado por el usuario (verificación bajo demande, no en segundo plano).
- La aplicación puede aportar verificaciones locales determinísticas; si se incluyen, puedes usarlas, pero la verificación IA debe basarse en el JSON del diagrama.

POLÍTICAS
- No inventes clases, IDs ni relaciones que no existan en el JSON.
- No modifiques el diagrama; solo diagnostica y recomienda.
- Si falta información para concluir, indícalo en "limitaciones" y sugiere qué completar.
- Sé específico y breve (≤120 caracteres por bullet).

RESTRICCIONES DE SALIDA — RESPONDE EXACTAMENTE CON ESTE OBJETO (mismas claves y orden):
{
  "okEstructural": boolean,
  "islas": string[],
  "referenciasRotas": [{"source":string,"target":string,"motivo":string}],
  "ciclosHerencia": string[][],
  "scoreDiseno": number,
  "sugerencias": string[],
  "accionesPrioritarias": string[],
  "tags": string[],
  "nodosProblematicos": string[],
  "aristasProblematicas": string[],
  "usoHallazgosLocales": boolean,
  "limitaciones": string[]
}

REGLAS ADICIONALES
- "motivo" en referenciasRotas ≤120 caracteres.
- No agregues claves extra ni cambies el orden.
- Usa SOLO IDs que existan en resumen_json.
- Si todo está correcto: okEstructural=true y da 1–3 sugerencias menores.
- Si hay errores: okEstructural=false y devuelve accionesPrioritarias concretas.

DEVUELVE EXCLUSIVAMENTE EL JSON CON ESE ESQUEMA, SIN TEXTO ADICIONAL.

IMPORTANTE: Tu respuesta debe comenzar con { y terminar con }. No incluyas explicaciones, comentarios o texto fuera del JSON.`;

  const userPrompt = `ENTRADAS:

ui_context:
${JSON.stringify(ui_context, null, 2)}

resumen_json:
${JSON.stringify(resumen_json, null, 2)}

${resultados_locales_json ? `resultados_locales_json:
${JSON.stringify(resultados_locales_json, null, 2)}` : ''}

Analiza este diagrama UML y devuelve EXCLUSIVAMENTE el JSON de respuesta según el esquema especificado.`;

  return { systemPrompt, userPrompt };
};

/**
 * Envía petición a Gemini
 */
const callGeminiAPI = async (systemPrompt, userPrompt) => {
  const config = getAIConfig('GEMINI');
  const url = buildEndpointURL('GEMINI');
  const headers = getHeaders('GEMINI');

  const body = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\n${userPrompt}`
      }]
    }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    throw new Error('Respuesta vacía de Gemini API');
  }

  // Limpiar la respuesta para extraer solo el JSON
  let cleanText = generatedText.trim();
  
  // Buscar el primer { y el último }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('Respuesta de IA no contiene JSON válido');
  }
  
  const jsonText = cleanText.substring(firstBrace, lastBrace + 1);
  
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    console.error('Error parsing JSON de IA:', jsonText);
    throw new Error(`Respuesta de IA no es JSON válido: ${parseError.message}`);
  }
};

/**
 * Envía petición a OpenAI - COMENTADO (Solo usar Gemini)
 */
// const callOpenAIAPI = async (systemPrompt, userPrompt) => {
//   const config = getAIConfig('OPENAI');
//   const url = buildEndpointURL('OPENAI');
//   const headers = getHeaders('OPENAI');

//   const body = {
//     model: config.model,
//     messages: [
//       { role: "system", content: systemPrompt },
//       { role: "user", content: userPrompt }
//     ],
//     temperature: config.temperature,
//     max_tokens: config.maxTokens,
//     response_format: { type: "json_object" }
//   };

//   const response = await fetch(url, {
//     method: 'POST',
//     headers,
//     body: JSON.stringify(body)
//   });

//   if (!response.ok) {
//     const errorData = await response.text();
//     throw new Error(`OpenAI API Error ${response.status}: ${errorData}`);
//   }

//   const data = await response.json();
//   const generatedText = data.choices?.[0]?.message?.content;
  
//   if (!generatedText) {
//     throw new Error('Respuesta vacía de OpenAI API');
//   }

//   return JSON.parse(generatedText);
// };

/**
 * Función principal: Verifica diagrama UML usando IA
 */
export const verifyUMLDiagramWithAI = async (nodes, edges, boardId, provider = DEFAULT_PROVIDER, includeLocalChecks = true) => {
  try {
    // 1. Preparar contexto de UI
    const ui_context = {
      accion: "verificar_diagrama_via_IA",
      boardId: boardId,
      timestamp: new Date().toISOString()
    };

    // 2. Extraer resumen del diagrama
    const resumen_json = extractDiagramSummary(nodes, edges);
    
    // 3. Realizar verificaciones locales (opcional)
    const resultados_locales_json = includeLocalChecks ? performLocalChecks(resumen_json) : null;

    // 4. Construir prompt para IA
    const { systemPrompt, userPrompt } = buildAIPrompt(ui_context, resumen_json, resultados_locales_json);

    // 5. Llamar a Gemini (único proveedor soportado)
    if (provider !== 'GEMINI') {
      throw new Error(`Solo se soporta Gemini. Proveedor solicitado: ${provider}`);
    }
    
    const resultado = await callGeminiAPI(systemPrompt, userPrompt);

    // 6. Validar que la respuesta tenga el formato correcto
    const requiredFields = [
      'okEstructural', 'islas', 'referenciasRotas', 'ciclosHerencia',
      'scoreDiseno', 'sugerencias', 'accionesPrioritarias', 'tags',
      'nodosProblematicos', 'aristasProblematicas', 'usoHallazgosLocales', 'limitaciones'
    ];

    for (const field of requiredFields) {
      if (!(field in resultado)) {
        throw new Error(`Campo requerido faltante en respuesta de IA: ${field}`);
      }
    }

    return resultado;

  } catch (error) {
    console.error('Error en verificación con IA:', error);
    
    // Devolver respuesta de error en el formato esperado
    return {
      okEstructural: false,
      islas: [],
      referenciasRotas: [],
      ciclosHerencia: [],
      scoreDiseno: 0,
      sugerencias: [],
      accionesPrioritarias: ["Error al conectar con IA: " + error.message],
      tags: ["Error"],
      nodosProblematicos: [],
      aristasProblematicas: [],
      usoHallazgosLocales: false,
      limitaciones: [`Error de conexión con IA: ${error.message}`]
    };
  }
};