import { useState, useRef, useEffect } from 'react';
import { generateDiagram, modifyDiagram } from '../utils/aiService';

// Minimal AI Bubble component: floating FAB -> panel with input + history
export default function AiBubble({ boardId, nodes, edges, setNodes, setEdges, updateBoardData }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]); // {role: 'user'|'ai', text, diagram?}
  const fileRef = useRef(null);
  const imageInputRef = useRef(null);

  // mode: 'text' | 'voice' | 'image' | 'edit'
  const [mode, setMode] = useState('text');
  const [editedDiagram, setEditedDiagram] = useState(null);
  const [editWarnings, setEditWarnings] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [, forceUpdate] = useState(0); // Para forzar re-render

  // Estados para manejo de clarificaciones en modificaciones
  const [pendingClarification, setPendingClarification] = useState(null);
  const [clarificationResponse, setClarificationResponse] = useState('');

  // Initialize editedDiagram when entering 'edit' mode based on the last AI diagram message
  useEffect(() => {
    if (mode !== 'edit') return;
    const last = [...messages].reverse().find(m => m.role === 'ai' && m.diagram && Array.isArray(m.diagram.elements) && m.diagram.elements.length > 0);
    if (!last) {
      setEditedDiagram(null);
      return;
    }
    // Build copy
    const copy = {
      _sourceTs: Date.now(),
      nodes: (last.diagram.elements || []).map((el, i) => ({
        id: el.id || `ai_${i}_${Date.now()}`,
        name: el.name || el.title || `Class_${i+1}`,
        attributes: Array.isArray(el.attributes) ? el.attributes.slice() : (el.attributes ? [String(el.attributes)] : []),
        methods: Array.isArray(el.methods) ? el.methods.slice() : (el.methods ? [String(el.methods)] : [])
      })),
      edges: (last.diagram.relationships || []).map((r, i) => ({
        id: r.id || `ai_rel_${i}_${Date.now()}`,
        sourceId: r.sourceId || r.source || null,
        targetId: r.targetId || r.target || null,
        type: r.type || r.relation || 'Association'
      }))
    };
    setEditedDiagram(copy);
  }, [mode, messages]);

  // Helper to normalize attributes/methods to string array to avoid React rendering objects
  const normalizeStringArray = (maybeArr) => {
    if (!maybeArr) return [];
    if (!Array.isArray(maybeArr)) return [String(maybeArr)];
    return maybeArr.map(a => {
      if (a === null || a === undefined) return '';
      if (typeof a === 'string') return a;
      if (typeof a === 'object') {
        // prefer sensible fields
        const name = a.name || a.nombre || a.key || a.field || '';
        const type = a.type || a.tipo || a.datatype || '';
        if (name && type) return `${name}: ${type}`;
        if (name) return name;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).filter(x => x !== '');
  };

  const toggle = () => setOpen(v => !v);

  const pushMessage = (m) => setMessages(prev => [...prev, m]);

  const mergeDiagramIntoBoard = async (diagram) => {
    if (!diagram || (!diagram.elements && !diagram.relationships)) return;

    try {
      // Helpers: ensure attributes/methods are arrays of strings
      const ensureStringArray = (maybeArr) => {
        if (!maybeArr) return [];
        if (!Array.isArray(maybeArr)) return [String(maybeArr)];
        return maybeArr.map(a => {
          if (a === null || a === undefined) return '';
          if (typeof a === 'string') return a;
          // If attribute is an object like { name, type } -> format it
          if (typeof a === 'object') {
            try {
              const name = a.name || a.nombre || a.key || a.field || '';
              const type = a.type || a.tipo || a.datatype || '';
              if (name && type) return `${name}: ${type}`;
              if (name) return `${name}`;
              return JSON.stringify(a);
            } catch (e) {
              return JSON.stringify(a);
            }
          }
          return String(a);
        }).filter(x => x !== '');
      };

      const els = Array.isArray(diagram.elements) ? diagram.elements : [];
      const rels = Array.isArray(diagram.relationships) ? diagram.relationships : [];

      // Build a map name->id for elements that might reference by name
      const tempIdFor = (i) => `ai_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${i}`;
      const created = [];
      const nameToId = new Map();

      const newNodes = els.map((el, i) => {
        const id = el && el.id ? String(el.id) : tempIdFor(i);
        const name = el && (el.name || el.nombre || el.title) ? String(el.name || el.nombre || el.title) : `Class_${i + 1}`;
        nameToId.set(name.toLowerCase(), id);
        created.push(id);
        return {
          id,
          type: 'classNode',
          position: (el && el.position) ? el.position : { x: Math.random() * 600 + 50, y: Math.random() * 400 + 50 },
          data: {
            className: name,
            attributes: ensureStringArray(el && el.attributes),
            methods: ensureStringArray(el && el.methods),
            _aiSource: true,
            // preserve raw metadata in case needed
            _raw: el
          }
        };
      });

      // Build edges, resolving source/target by id or by matching names to elements
      const newEdges = rels.map((rel, i) => {
        const id = rel && rel.id ? String(rel.id) : `ai_rel_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${i}`;

        let source = rel && (rel.sourceId || rel.source) ? String(rel.sourceId || rel.source) : null;
        let target = rel && (rel.targetId || rel.target) ? String(rel.targetId || rel.target) : null;

        // If source/target look like names, try to resolve via nameToId
        if (source && !created.includes(source)) {
          const maybe = nameToId.get(String(source).toLowerCase());
          if (maybe) source = maybe;
        }
        if (target && !created.includes(target)) {
          const maybe = nameToId.get(String(target).toLowerCase());
          if (maybe) target = maybe;
        }

        // If still missing source/target, skip the edge (avoid invalid edge causing render errors)
        if (!source || !target) {
          return null;
        }

        return {
          id,
          source,
          target,
          type: 'umlEdge',
          data: {
            type: (rel && (rel.type || rel.relation)) || 'association',
            cardinality: rel && (rel.cardinality || rel.card) ? rel.cardinality || rel.card : null,
            _aiSource: true,
            _raw: rel
          }
        };
      }).filter(e => e !== null);

      // Avoid ID conflicts: if an AI-provided id already exists in board, rename the AI id
      const existingNodeIds = new Set((nodes || []).map(n => n && n.id));
      const remap = {};
      for (const n of newNodes) {
        if (existingNodeIds.has(n.id)) {
          const newId = `${n.id}_ai_${Date.now()}`;
          remap[n.id] = newId;
          n.id = newId;
        }
      }

      for (const e of newEdges) {
        if (remap[e.source]) e.source = remap[e.source];
        if (remap[e.target]) e.target = remap[e.target];
      }

      // Apply to state using functional updates and persist the explicit arrays to the server
      setNodes(prev => {
        try {
          const merged = [...(prev || []), ...newNodes];
          return merged;
        } catch (err) {
          console.error('AiBubble: setNodes merge failed', err);
          return prev || [];
        }
      });

      setEdges(prev => {
        try {
          const merged = [...(prev || []), ...newEdges];
          return merged;
        } catch (err) {
          console.error('AiBubble: setEdges merge failed', err);
          return prev || [];
        }
      });

      // Persist via updateBoardData if available (legacy-compatible: updateBoardData(nodesArray, edgesArray))
      try {
        if (typeof updateBoardData === 'function') {
          // Use freshest values by merging the passed-in props (nodes/edges) defensively
          const fullNodes = [...(Array.isArray(nodes) ? nodes : []), ...newNodes];
          const fullEdges = [...(Array.isArray(edges) ? edges : []), ...newEdges];
          await updateBoardData(fullNodes, fullEdges);
        }
      } catch (err) {
        console.warn('AiBubble: updateBoardData failed', err);
      }
    } catch (err) {
      console.error('AiBubble.mergeDiagramIntoBoard unexpected error', err);
      pushMessage({ role: 'ai', text: 'Hubo un error al integrar el diagrama generado. Revisa la consola para más detalles.' });
    }
  };

  const handleSend = async () => {
    if (mode === 'text' && !input) return;
    if (mode === 'image' && (!fileRef.current || !fileRef.current.files || fileRef.current.files.length === 0)) return;
    setLoading(true);
    const text = input.trim();
    pushMessage({ role: 'user', text });
    setInput('');

    try {
      let file = null;
      let type = 'text';
      if (mode === 'image') {
        file = fileRef.current && fileRef.current.files && fileRef.current.files[0] ? fileRef.current.files[0] : null;
        type = 'image';
      } else if (mode === 'voice') {
        // If there's a recording available in recordedChunksRef, send it
        if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          // clear recorded chunks after attaching
          recordedChunksRef.current = [];
        }
        type = 'voice';
      }

      const res = await generateDiagram({ type, content: text, file, salaId: boardId });

      if (!res || !res.success) {
        const errMsg = res && res.error ? res.error : 'AI response failed';
        pushMessage({ role: 'ai', text: `Error: ${errMsg}` });
        setLoading(false);
        return;
      }

      // The backend returns a demo or real diagram under `diagram` property
      // If AI returned clarifying questions but also returned a diagram, show questions but still merge.
      // Only block merging when there are clarifyingQuestions and NO elements were produced.
      if (res.diagram && Array.isArray(res.diagram.clarifyingQuestions) && res.diagram.clarifyingQuestions.length > 0 && (!res.diagram.elements || res.diagram.elements.length === 0)) {
        const qText = res.diagram.clarifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        pushMessage({ role: 'ai', text: res.message || 'Se requieren aclaraciones:', questions: res.diagram.clarifyingQuestions });
        // Also push a human-readable block so user sees the questions in the history
        pushMessage({ role: 'ai', text: qText });
        setLoading(false);
        return;
      }

      pushMessage({ role: 'ai', text: res.message || 'Diagrama generado', diagram: res.diagram });

      // Merge diagram into board
      if (res.diagram) {
        await mergeDiagramIntoBoard(res.diagram);
      }

    } catch (err) {
      console.error('AiBubble send error', err);
      pushMessage({ role: 'ai', text: `Error: ${err.message}` });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Recording handlers
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      pushMessage({ role: 'ai', text: 'El navegador no soporta grabación de audio.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        setIsRecording(false);
        // stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('startRecording error', err);
      pushMessage({ role: 'ai', text: 'No se pudo iniciar la grabación: ' + err.message });
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.warn('stopRecording', err);
    }
  };

  return (
    <div>
      {/* FAB */}
  <div className="fixed bottom-6 right-28 z-40">
        <button
          onClick={toggle}
          title="AI: Generar diagrama"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
          aria-label="Abrir asistente IA"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" />
            <rect x="7" y="3" width="10" height="4" rx="1" stroke="currentColor" />
            <circle cx="9" cy="12" r="1.25" fill="white" />
            <circle cx="15" cy="12" r="1.25" fill="white" />
            <path d="M8 17h8" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[90vw] max-w-md rounded-xl shadow-2xl overflow-hidden bg-white border border-gray-200" role="dialog" aria-label="AI Diagram Generator">
          {/* Backdrop para cerrar al hacer clic fuera */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={toggle}
            aria-hidden="true"
          ></div>
          
          {/* Panel principal */}
          <div className="relative z-50 bg-white rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-4 py-2 bg-gradient-to-r from-indigo-400 to-purple-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" />
                  <rect x="7" y="3" width="10" height="4" rx="1" stroke="currentColor" />
                  <circle cx="9" cy="12" r="1" fill="white" />
                  <circle cx="15" cy="12" r="1" fill="white" />
                  <path d="M8 17h8" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold">AI Diagram Generator</div>
                <div className="text-xs opacity-80">Asistente de IA para crear diagramas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-7 h-7 rounded bg-white/20 text-white flex items-center justify-center" onClick={() => setOpen(false)} aria-label="Minimizar">—</button>
              <button className="w-7 h-7 rounded bg-white/20 text-white flex items-center justify-center" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
          </div>

          {/* Body - Scrollable content */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="p-4 space-y-4">
            <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border">
              <div className="mb-1">🎉 ¡Hola! Soy tu asistente de IA para crear diagramas de clases.</div>
              <div className="text-xs text-gray-500">Envía texto, una nota de voz o una imagen y generaré un diagrama UML automáticamente.</div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setMode('text')}
                className={`px-3 py-1 rounded-full text-sm ${mode === 'text' ? 'bg-indigo-200 text-indigo-900' : 'bg-gray-100 text-gray-600'}`}
                aria-pressed={mode === 'text'}
              >
                Texto
              </button>
              <button
                onClick={() => setMode('voice')}
                className={`px-3 py-1 rounded-full text-sm ${mode === 'voice' ? 'bg-purple-200 text-purple-900' : 'bg-gray-100 text-gray-600'}`}
                aria-pressed={mode === 'voice'}
              >
                Voz
              </button>
              <button
                onClick={() => setMode('image')}
                className={`px-3 py-1 rounded-full text-sm ${mode === 'image' ? 'bg-pink-200 text-pink-900' : 'bg-gray-100 text-gray-600'}`}
                aria-pressed={mode === 'image'}
              >
                Imagen
              </button>
              <button
                onClick={() => setMode('edit')}
                className={`px-3 py-1 rounded-full text-sm ${mode === 'edit' ? 'bg-green-200 text-green-900' : 'bg-gray-100 text-gray-600'}`}
                aria-pressed={mode === 'edit'}
                title="Editar diagrama"
              >
                Editar
              </button>
            </div>

            {/* Input area */}
            <div className="mb-3">
              {mode === 'text' && (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe el diagrama que quieres"
                  className="w-full border rounded p-2 text-sm h-24"
                />
              )}

              {mode === 'voice' && (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                  <div className="text-center">
                    <div className="text-sm font-medium text-purple-700 mb-3">🎙️ Grabadora de Voz</div>
                    
                    {/* Indicador visual de grabación */}
                    {isRecording && (
                      <div className="mb-3">
                        <div className="flex justify-center items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-red-600">Grabando...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-red-500 h-1.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Estado de grabación completada */}
                    {!isRecording && recordedChunksRef.current && recordedChunksRef.current.length > 0 && (
                      <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-center gap-2 text-green-700">
                          <span className="text-lg">✅</span>
                          <span className="text-sm font-medium">Audio grabado - Listo para enviar</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Botones de control */}
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => { if (!isRecording) startRecording(); else stopRecording(); }}
                        disabled={loading}
                        className={`px-6 py-3 rounded-full font-medium transition-all duration-200 transform hover:scale-105 ${
                          isRecording 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200' 
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isRecording ? (
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            Detener
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            🎤 Grabar
                          </span>
                        )}
                      </button>
                      
                      {/* Botón de limpiar grabación */}
                      {!isRecording && recordedChunksRef.current && recordedChunksRef.current.length > 0 && (
                        <button
                          onClick={() => {
                            recordedChunksRef.current = [];
                            forceUpdate(Date.now()); // Forzar re-render
                          }}
                          className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full font-medium transition-all duration-200"
                        >
                          🗑️ Limpiar
                        </button>
                      )}
                    </div>
                    
                    {/* Instrucciones */}
                    <div className="mt-3 text-xs text-purple-600">
                      {isRecording 
                        ? 'Habla claramente y pulsa "Detener" cuando termines' 
                        : recordedChunksRef.current && recordedChunksRef.current.length > 0
                          ? 'Audio listo. Pulsa "Enviar" para generar el diagrama'
                          : 'Pulsa "Grabar" y describe el diagrama que quieres crear'
                      }
                    </div>
                  </div>
                </div>
              )}

              {mode === 'image' && (
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" />
                  <button onClick={() => fileRef.current && fileRef.current.click()} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Seleccionar imagen</button>
                  <div className="text-xs text-gray-500">Sube una imagen para que la IA la analice</div>
                </div>
              )}

              {mode === 'edit' && (
                <div className="text-sm max-h-72 overflow-y-auto pr-2" style={{ maxHeight: '42vh' }}>
                  {/* Verificar si hay un diagrama existente para modificar */}
                  {(() => {
                    // Buscar el último diagrama generado por IA o usar el estado actual del board
                    const hasCurrentDiagram = nodes && nodes.length > 0;
                    const lastAiMessage = [...messages].reverse().find(m => m.role === 'ai' && m.diagram && (m.diagram.elements||[]).length > 0);
                    
                    if (!hasCurrentDiagram && !lastAiMessage) {
                      return (
                        <div className="p-3 bg-yellow-50 border rounded text-xs text-yellow-800">
                          No hay un diagrama disponible para modificar. Genera primero un diagrama o crea clases en el board.
                        </div>
                      );
                    }

                    return (
                      <div>
                        {/* Sistema de Modificación del Diagrama */}
                        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded">
                          <div className="text-sm font-semibold text-indigo-800 mb-2">🔧 Modificación Inteligente del Diagrama</div>
                          <div className="text-xs text-indigo-600 mb-3">
                            Describe los cambios que quieres hacer. Ejemplos: "elimina la clase Cliente", "añade atributo nombre a Usuario"
                          </div>
                          
                          <textarea 
                            className="w-full border border-indigo-200 rounded p-3 text-sm h-24 mb-3 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" 
                            placeholder="Describe la modificación que quieres realizar...&#10;• elimina la clase Cliente&#10;• añade atributo email tipo string a Usuario&#10;• crea relación entre Pedido y Cliente&#10;• actualiza el método calcular en Factura"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                          />
                          
                          {/* Botón principal de modificación */}
                          <div className="flex gap-2 justify-end">
                            <button 
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors" 
                              disabled={loading || !input.trim()} 
                              onClick={async () => {
                                const prompt = input.trim();
                                if (!prompt) {
                                  pushMessage({ role: 'ai', text: 'Por favor describe la modificación que quieres realizar.' });
                                  return;
                                }
                                
                                setLoading(true);
                                pushMessage({ role: 'user', text: prompt });
                                
                                try {
                                  // Preparar el estado actual del diagrama
                                  const currentNodes = (nodes || []).map(n => ({ 
                                    id: n.id, 
                                    data: {
                                      className: n.data?.className || 'Clase',
                                      attributes: n.data?.attributes || [],
                                      methods: n.data?.methods || []
                                    }
                                  }));
                                  
                                  const currentEdges = (edges || []).map(e => ({ 
                                    id: e.id, 
                                    source: e.source, 
                                    target: e.target, 
                                    data: { type: e.data?.type || 'Association' }
                                  }));
                                  
                                  // Llamar al servicio de modificación
                                  const response = await modifyDiagram({ 
                                    prompt, 
                                    nodes: currentNodes, 
                                    edges: currentEdges,
                                    mode: 'modify'
                                  });
                                  
                                  if (!response || !response.success) {
                                    const errorMsg = response?.error || 'Error desconocido en la modificación';
                                    pushMessage({ role: 'ai', text: `❌ Error: ${errorMsg}` });
                                    return;
                                  }
                                  
                                  // Verificar si la IA necesita aclaración
                                  if (response.needsClarification && response.clarifyingQuestions && response.clarifyingQuestions.length > 0) {
                                    // Mostrar las preguntas clarificadoras
                                    const questionsText = response.clarifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                                    pushMessage({ 
                                      role: 'ai', 
                                      text: `🤔 Necesito más información:\n\n${questionsText}\n\nPor favor responde para continuar con la modificación.`,
                                      needsClarification: true,
                                      originalPrompt: prompt,
                                      clarifyingQuestions: response.clarifyingQuestions
                                    });
                                    setInput(''); // Limpiar para la respuesta
                                    return;
                                  }
                                  
                                  // Aplicar los cambios directamente al diagrama
                                  if (response.newState) {
                                    const { nodes: newNodes, edges: newEdges } = response.newState;
                                    
                                    // Convertir los nodos al formato de React Flow
                                    const updatedNodes = (newNodes || []).map((node, index) => ({
                                      id: node.id || `node_${Date.now()}_${index}`,
                                      type: 'classNode',
                                      position: node.position || { 
                                        x: Math.random() * 600 + 100, 
                                        y: Math.random() * 400 + 100 
                                      },
                                      data: {
                                        className: node.data?.className || node.name || 'Clase',
                                        attributes: normalizeStringArray(node.data?.attributes),
                                        methods: normalizeStringArray(node.data?.methods),
                                        _aiModified: true
                                      }
                                    }));
                                    
                                    // Convertir las edges al formato de React Flow
                                    const updatedEdges = (newEdges || []).map((edge, index) => ({
                                      id: edge.id || `edge_${Date.now()}_${index}`,
                                      source: edge.source,
                                      target: edge.target,
                                      type: 'umlEdge',
                                      data: {
                                        type: edge.data?.type || 'Association',
                                        _aiModified: true
                                      }
                                    }));
                                    
                                    // Actualizar el estado del diagrama
                                    setNodes(updatedNodes);
                                    setEdges(updatedEdges);
                                    
                                    // Persistir los cambios
                                    if (typeof updateBoardData === 'function') {
                                      await updateBoardData(updatedNodes, updatedEdges);
                                    }
                                    
                                    pushMessage({ 
                                      role: 'ai', 
                                      text: `✅ ${response.message || 'Diagrama modificado correctamente'}`,
                                      diagram: { elements: updatedNodes, relationships: updatedEdges }
                                    });
                                  } else {
                                    pushMessage({ role: 'ai', text: response.message || 'Modificación completada' });
                                  }
                                  
                                  setInput(''); // Limpiar el campo de entrada
                                  
                                } catch (err) {
                                  console.error('Error en modificación:', err);
                                  pushMessage({ 
                                    role: 'ai', 
                                    text: `❌ Error al procesar la modificación: ${err.message || err}` 
                                  });
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {loading ? '🔄 Procesando...' : '🚀 Modificar Diagrama'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Panel de Clarificaciones Interactivas */}
                        {(() => {
                          const lastMessage = messages[messages.length - 1];
                          if (lastMessage && lastMessage.needsClarification) {
                            return (
                              <div className="mb-3 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded">
                                <div className="text-sm font-semibold text-amber-800 mb-2">🤔 Se necesita aclaración</div>
                                <div className="text-xs text-amber-700 mb-3 whitespace-pre-line">
                                  {lastMessage.clarifyingQuestions?.map((q, i) => (
                                    <div key={i} className="mb-1">• {q}</div>
                                  ))}
                                </div>
                                
                                <textarea 
                                  className="w-full border border-amber-200 rounded p-2 text-sm h-16 mb-2 focus:ring-2 focus:ring-amber-400 focus:border-amber-400" 
                                  placeholder="Responde a las preguntas para continuar con la modificación..."
                                  value={clarificationResponse}
                                  onChange={(e) => setClarificationResponse(e.target.value)}
                                />
                                
                                <div className="flex gap-2 justify-end">
                                  <button 
                                    className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded text-sm" 
                                    onClick={() => {
                                      setPendingClarification(null);
                                      setClarificationResponse('');
                                      pushMessage({ role: 'ai', text: '❌ Modificación cancelada por el usuario.' });
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                  <button 
                                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm" 
                                    disabled={loading || !clarificationResponse.trim()}
                                    onClick={async () => {
                                      if (!clarificationResponse.trim()) return;
                                      
                                      setLoading(true);
                                      pushMessage({ role: 'user', text: clarificationResponse });
                                      
                                      try {
                                        // Preparar el contexto completo para la clarificación
                                        const currentNodes = (nodes || []).map(n => ({ 
                                          id: n.id, 
                                          data: {
                                            className: n.data?.className || 'Clase',
                                            attributes: n.data?.attributes || [],
                                            methods: n.data?.methods || []
                                          }
                                        }));
                                        
                                        const currentEdges = (edges || []).map(e => ({ 
                                          id: e.id, 
                                          source: e.source, 
                                          target: e.target, 
                                          data: { type: e.data?.type || 'Association' }
                                        }));
                                        
                                        // Enviar prompt original + respuesta de clarificación
                                        const fullPrompt = `${lastMessage.originalPrompt}\n\nACLARACIÓN: ${clarificationResponse}`;
                                        
                                        const response = await modifyDiagram({ 
                                          prompt: fullPrompt,
                                          nodes: currentNodes, 
                                          edges: currentEdges,
                                          mode: 'modify',
                                          clarification: clarificationResponse,
                                          originalPrompt: lastMessage.originalPrompt
                                        });
                                        
                                        if (!response || !response.success) {
                                          const errorMsg = response?.error || 'Error desconocido en la modificación';
                                          pushMessage({ role: 'ai', text: `❌ Error: ${errorMsg}` });
                                          return;
                                        }
                                        
                                        // Aplicar los cambios
                                        if (response.newState) {
                                          const { nodes: newNodes, edges: newEdges } = response.newState;
                                          
                                          const updatedNodes = (newNodes || []).map((node, index) => ({
                                            id: node.id || `node_${Date.now()}_${index}`,
                                            type: 'classNode',
                                            position: node.position || { 
                                              x: Math.random() * 600 + 100, 
                                              y: Math.random() * 400 + 100 
                                            },
                                            data: {
                                              className: node.data?.className || node.name || 'Clase',
                                              attributes: normalizeStringArray(node.data?.attributes),
                                              methods: normalizeStringArray(node.data?.methods),
                                              _aiModified: true
                                            }
                                          }));
                                          
                                          const updatedEdges = (newEdges || []).map((edge, index) => ({
                                            id: edge.id || `edge_${Date.now()}_${index}`,
                                            source: edge.source,
                                            target: edge.target,
                                            type: 'umlEdge',
                                            data: {
                                              type: edge.data?.type || 'Association',
                                              _aiModified: true
                                            }
                                          }));
                                          
                                          setNodes(updatedNodes);
                                          setEdges(updatedEdges);
                                          
                                          if (typeof updateBoardData === 'function') {
                                            await updateBoardData(updatedNodes, updatedEdges);
                                          }
                                          
                                          pushMessage({ 
                                            role: 'ai', 
                                            text: `✅ ${response.message || 'Diagrama modificado correctamente con las aclaraciones proporcionadas'}`,
                                            diagram: { elements: updatedNodes, relationships: updatedEdges }
                                          });
                                        } else {
                                          pushMessage({ role: 'ai', text: response.message || 'Modificación completada con aclaraciones' });
                                        }
                                        
                                        // Limpiar estados de clarificación
                                        setPendingClarification(null);
                                        setClarificationResponse('');
                                        
                                      } catch (err) {
                                        console.error('Error en clarificación:', err);
                                        pushMessage({ 
                                          role: 'ai', 
                                          text: `❌ Error al procesar la aclaración: ${err.message || err}` 
                                        });
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                  >
                                    {loading ? '🔄 Aplicando...' : '✅ Continuar'}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Información de estado del diagrama */}
                        <div className="mt-3 p-2 bg-gray-50 border rounded text-xs">
                          <div className="font-semibold text-gray-700 mb-1">📊 Estado actual del diagrama:</div>
                          <div className="text-gray-600">
                            • <strong>{(nodes || []).length}</strong> clases en el board
                            • <strong>{(edges || []).length}</strong> relaciones
                            • <strong>{messages.filter(m => m.role === 'ai' && m.diagram).length}</strong> diagramas generados por IA
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Messages preview area - Mejorado con scroll y contenido responsivo */}
            <div className="relative">
              <div className="max-h-40 overflow-y-auto border bg-white rounded-lg shadow-sm scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="p-3 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-4">
                      <div className="text-gray-400 text-sm mb-2">📝 Historial de conversación</div>
                      <div className="text-xs text-gray-500">Envía texto, imagen o nota de voz para comenzar</div>
                    </div>
                  )}
                  
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] break-words ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg shadow-sm border ${
                          m.role === 'user' 
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-200' 
                            : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {/* Indicador de rol */}
                          <div className={`text-xs font-medium mb-1 ${
                            m.role === 'user' ? 'text-indigo-100' : 'text-gray-500'
                          }`}>
                            {m.role === 'user' ? '👤 Tú' : '🤖 IA Assistant'}
                          </div>
                          
                          {/* Contenido del mensaje con scroll horizontal si es necesario */}
                          <div className={`text-sm leading-relaxed ${
                            m.text && m.text.length > 100 ? 'max-h-20 overflow-y-auto scrollbar-thin' : ''
                          }`}>
                            {m.text}
                          </div>
                          
                          {/* Preguntas de clarificación */}
                          {m.questions && Array.isArray(m.questions) && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                              <div className="font-medium text-yellow-800 mb-1">❓ Necesito aclarar:</div>
                              <ul className="space-y-1">
                                {m.questions.map((q, qIdx) => (
                                  <li key={qIdx} className="text-yellow-700">• {q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Indicador de diagrama */}
                          {m.diagram && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full border border-green-200">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                Diagrama generado
                              </span>
                              <span className="text-green-600">
                                {(m.diagram.elements || []).length} clases
                              </span>
                            </div>
                          )}
                          
                          {/* Timestamp */}
                          <div className={`text-xs mt-2 ${
                            m.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                          }`}>
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Indicador de carga */}
                {loading && (
                  <div className="flex justify-start p-3 border-t">
                    <div className="max-w-[85%]">
                      <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span>IA está generando...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Gradiente de scroll para indicar más contenido */}
              {messages.length > 3 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-lg"></div>
              )}
            </div>
            </div> {/* Cierre del contenido del cuerpo */}
          </div> {/* Cierre del área de scroll del cuerpo */}

          {/* Footer */}
          <div className="px-3 py-2 bg-gradient-to-r from-indigo-400 to-purple-600 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-white text-sm">
                {mode === 'text' ? 'Texto' : 
                 mode === 'voice' ? 'Nota de voz' : 
                 mode === 'image' ? 'Imagen' : 
                 mode === 'edit' ? 'Modificar Diagrama' : 
                 'IA Assistant'}
              </div>
            </div>
            <div>
              <button onClick={handleSend} disabled={loading} className="bg-white text-indigo-700 px-3 py-1 rounded-full">
                {loading ? 'Generando…' : 'Enviar'}
              </button>
            </div>
          </div>
          {/* Cierre del panel principal */}
          </div>
        {/* Cierre del contenedor del panel */}
        </div>
      )}
    </div>
  );
}
