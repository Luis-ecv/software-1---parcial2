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

  // mode: 'text' | 'voice' | 'image'
  const [mode, setMode] = useState('text');
  const [editedDiagram, setEditedDiagram] = useState(null);
  const [editWarnings, setEditWarnings] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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
  <div className="fixed bottom-20 right-28 z-50 w-96 rounded-lg shadow-lg overflow-hidden" role="dialog" aria-label="AI Diagram Generator">
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

          {/* Body */}
          <div className="bg-white p-3">
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
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-sm mb-1">Grabadora de voz</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (!isRecording) startRecording(); else stopRecording(); }}
                        className={`px-3 py-2 rounded ${isRecording ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}
                      >
                        {isRecording ? 'Grabando…' : 'Grabar'}
                      </button>
                      <div className="text-xs text-gray-500">{isRecording ? 'Pulsa para detener' : 'Pulsa para grabar una nota de voz'}</div>
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
                // Make the edit panel scrollable so controls don't overlap on small screens
                <div className="text-sm max-h-72 overflow-y-auto pr-2" style={{ maxHeight: '42vh' }}>
                  {/* Find the last AI message that contains a diagram */}
                  {(() => {
                    const last = [...messages].reverse().find(m => m.role === 'ai' && m.diagram && (m.diagram.elements||[]).length > 0);
                    if (!last) {
                      return (
                        <div className="p-3 bg-yellow-50 border rounded text-xs text-yellow-800">No hay un diagrama generado por la IA para editar. Genera primero un diagrama desde la pestaña 'Texto' / 'Imagen' / 'Voz'.</div>
                      );
                    }

                    if (!editedDiagram) {
                      return (<div className="p-3 text-xs text-gray-500">Preparando editor…</div>);
                    }

                    return (
                      <div>
                        {/* Prompt-driven proposal UI (dry-run) */}
                        <div className="mb-2 p-2 bg-white border rounded text-xs">
                          <div className="text-xs font-semibold mb-1">Proponer cambios vía IA (previsualización)</div>
                          <textarea className="w-full border rounded p-2 text-sm h-20 mb-2" placeholder="Escribe un prompt que describa los cambios que quieres (por ejemplo: añadir total a Pedido, relacionar Usuario con Direccion)" onChange={(e) => { /* ephemeral local */ }} id="ia-proposal-prompt" />
                          <div className="flex gap-2 justify-end">
                            <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm" disabled={proposalLoading} onClick={async () => {
                              const ta = document.getElementById('ia-proposal-prompt');
                              const prompt = ta ? ta.value.trim() : '';
                              if (!prompt) {
                                pushMessage({ role: 'ai', text: 'Introduce un prompt para que la IA proponga cambios.' });
                                return;
                              }
                              setProposalLoading(true);
                              try {
                                // send current board state + prompt to backend dry-run
                                const curNodes = (nodes || []).map(n => ({ id: n.id, data: n.data }));
                                const curEdges = (edges || []).map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data }));
                                const resp = await modifyDiagram({ prompt, nodes: curNodes, edges: curEdges, mode: 'merge', dryRun: true });
                                if (!resp || !resp.success) {
                                  pushMessage({ role: 'ai', text: 'La IA no pudo generar una propuesta: ' + (resp && resp.error ? resp.error : JSON.stringify(resp)) });
                                  setProposalLoading(false);
                                  return;
                                }

                                // Load the proposed newState into the editor as a preview (do not apply to board)
                                const ns = resp.newState || {};
                                const proposal = {
                                  _sourceTs: Date.now(),
                                  nodes: (ns.nodes || []).map((n, i) => ({ id: n.id || `p_${i}_${Date.now()}`, name: n.data?.className || n.name || `Clase_${i+1}`, attributes: Array.isArray(n.data?.attributes) ? n.data.attributes : (n.data?.attributes ? [String(n.data.attributes)] : []), methods: Array.isArray(n.data?.methods) ? n.data.methods : (n.data?.methods ? [String(n.data.methods)] : []) })),
                                  edges: (ns.edges || []).map((e, i) => ({ id: e.id || `pe_${i}_${Date.now()}`, sourceId: e.source, targetId: e.target, type: e.data?.type || e.type || 'Association' }))
                                };
                                setEditedDiagram(proposal);
                                setEditWarnings((resp.clarifyingQuestions || []).slice(0,5));
                                pushMessage({ role: 'ai', text: resp.message || 'Propuesta generada por IA', diagram: { elements: ns.nodes || [], relationships: ns.edges || [], clarifyingQuestions: resp.clarifyingQuestions || [] } });
                              } catch (err) {
                                console.error('proposal error', err);
                                pushMessage({ role: 'ai', text: 'Error al solicitar la propuesta: ' + (err.message || err) });
                              } finally {
                                setProposalLoading(false);
                              }
                            }}>{proposalLoading ? 'Generando…' : 'Generar propuesta IA'}</button>
                          </div>
                        </div>
                        <div className="mb-2 text-xs text-gray-600">Edita los nombres, atributos y métodos. Cuando termines pulsa <strong>Aplicar cambios</strong>.</div>
                        {editWarnings.length > 0 && (
                          <div className="mb-2 text-xs text-red-600">{editWarnings.join(' — ')}</div>
                        )}

                        {/* Nodes editor */}
                        <div className="max-h-48 overflow-y-auto mb-2 border rounded p-2 bg-gray-50">
                          <div className="text-xs font-semibold mb-1">Clases ({(editedDiagram && editedDiagram.nodes.length) || 0})</div>
                          {(editedDiagram && editedDiagram.nodes.length > 0) ? editedDiagram.nodes.map((n, idx) => (
                            <div key={n.id} className="mb-2 p-2 bg-white border rounded text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <input className="flex-1 border rounded px-2 py-1 text-sm" value={n.name} onChange={(e) => {
                                  const v = e.target.value;
                                  setEditedDiagram(prev => ({ ...prev, nodes: prev.nodes.map(x => x.id === n.id ? { ...x, name: v } : x) }));
                                }} />
                                <button className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded" onClick={() => {
                                  // remove class
                                  setEditedDiagram(prev => ({ ...prev, nodes: prev.nodes.filter(x => x.id !== n.id), edges: prev.edges.filter(e => e.sourceId !== n.id && e.targetId !== n.id) }));
                                }}>Eliminar</button>
                              </div>
                              <div className="mb-1">
                                <div className="text-[11px] text-gray-500 mb-1">Atributos (separados por coma)</div>
                                <input className="w-full border rounded px-2 py-1 text-sm" value={(n.attributes || []).join(', ')} onChange={(e) => {
                                  const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setEditedDiagram(prev => ({ ...prev, nodes: prev.nodes.map(x => x.id === n.id ? { ...x, attributes: arr } : x) }));
                                }} />
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Métodos (separados por coma)</div>
                                <input className="w-full border rounded px-2 py-1 text-sm" value={(n.methods || []).join(', ')} onChange={(e) => {
                                  const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setEditedDiagram(prev => ({ ...prev, nodes: prev.nodes.map(x => x.id === n.id ? { ...x, methods: arr } : x) }));
                                }} />
                              </div>
                            </div>
                          )) : <div className="text-xs text-gray-500">No hay clases para editar.</div>}
                          <div className="mt-2">
                            <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm" onClick={() => {
                              // Add new class
                              const nid = `ai_new_${Date.now()}`;
                              setEditedDiagram(prev => ({ ...prev, nodes: [...prev.nodes, { id: nid, name: `NuevaClase${prev.nodes.length+1}`, attributes: [], methods: [] }] }));
                            }}>Añadir clase</button>
                          </div>
                        </div>

                        {/* Edges preview */}
                        <div className="mb-2 text-xs">
                          <div className="font-semibold mb-1">Relaciones ({(editedDiagram && editedDiagram.edges.length) || 0})</div>
                          {(editedDiagram && editedDiagram.edges.length > 0) ? editedDiagram.edges.map((r) => (
                            <div key={r.id} className="mb-1 text-xs flex items-center gap-2">
                              <div className="flex-1">{r.sourceId} → {r.targetId} ({r.type})</div>
                              <button className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded" onClick={() => {
                                setEditedDiagram(prev => ({ ...prev, edges: prev.edges.filter(x => x.id !== r.id) }));
                              }}>Eliminar</button>
                            </div>
                          )) : <div className="text-xs text-gray-500">No hay relaciones para editar.</div>}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm" onClick={() => {
                            // discard edits
                            setEditedDiagram(null);
                            pushMessage({ role: 'ai', text: 'Edición descartada.' });
                            setMode('text');
                          }}>Cancelar</button>
                          <button className="px-3 py-1 bg-green-600 text-white rounded text-sm" onClick={async () => {
                            // Apply edits to board
                            try {
                              if (!editedDiagram) return;
                              // Build updated nodes and edges arrays based on existing board state
                              const updatedNodesMap = new Map((nodes || []).map(n => [n.id, n]));
                              for (const en of editedDiagram.nodes) {
                                const existing = updatedNodesMap.get(en.id);
                                const nodeObj = existing ? { ...existing, data: { ...(existing.data || {}), className: en.name, attributes: en.attributes || [], methods: en.methods || [] } } : {
                                  id: en.id,
                                  type: 'classNode',
                                  position: { x: Math.random() * 600 + 50, y: Math.random() * 400 + 50 },
                                  data: { className: en.name, attributes: en.attributes || [], methods: en.methods || [], _aiSource: true }
                                };
                                updatedNodesMap.set(en.id, nodeObj);
                              }
                              // Remove nodes that were deleted in editedDiagram
                              const editedIds = new Set(editedDiagram.nodes.map(n => n.id));
                              for (const id of Array.from(updatedNodesMap.keys())) {
                                // If the id existed in the board but was removed in the edited diagram and it was part of the AI diagram, remove it
                                const wasAi = (nodes || []).some(n => n.id === id && n.data && n.data._aiSource);
                                if (wasAi && !editedIds.has(id)) {
                                  updatedNodesMap.delete(id);
                                }
                              }

                              // Edges: start from current edges, remove those referencing removed nodes, and add new/keep existing
                              let updatedEdges = (edges || []).filter(e => updatedNodesMap.has(e.source) && updatedNodesMap.has(e.target));
                              // Add any edges from editedDiagram that are new
                              for (const re of editedDiagram.edges) {
                                if (!re.sourceId || !re.targetId) continue;
                                // resolve source/target ids if names provided
                                const src = updatedNodesMap.has(re.sourceId) ? re.sourceId : (Array.from(updatedNodesMap.values()).find(n => n.data.className.toLowerCase() === String(re.sourceId).toLowerCase()) || {}).id;
                                const tgt = updatedNodesMap.has(re.targetId) ? re.targetId : (Array.from(updatedNodesMap.values()).find(n => n.data.className.toLowerCase() === String(re.targetId).toLowerCase()) || {}).id;
                                if (!src || !tgt) continue;
                                const exists = updatedEdges.some(e => e.source === src && e.target === tgt && (e.data && e.data.type || 'Association') === re.type);
                                if (!exists) {
                                  updatedEdges.push({ id: re.id || `edge_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, source: src, target: tgt, type: 'umlEdge', data: { type: re.type || 'Association', _aiSource: true } });
                                }
                              }

                              let finalNodes = Array.from(updatedNodesMap.values());
                              // Normalize attributes/methods to strings to avoid React rendering objects
                              finalNodes = finalNodes.map(n => ({
                                ...n,
                                data: {
                                  ...(n.data || {}),
                                  attributes: normalizeStringArray((n.data || {}).attributes),
                                  methods: normalizeStringArray((n.data || {}).methods)
                                }
                              }));

                              // Update local state
                              setNodes(finalNodes);
                              setEdges(updatedEdges);

                              // Persist via updateBoardData if available
                              if (typeof updateBoardData === 'function') {
                                await updateBoardData(finalNodes, updatedEdges);
                              }

                              pushMessage({ role: 'ai', text: 'Cambios aplicados al diagrama.' });
                              setEditedDiagram(null);
                              setMode('text');
                            } catch (err) {
                              console.error('Error al aplicar edición', err);
                              pushMessage({ role: 'ai', text: 'Error al aplicar cambios: ' + (err.message || err) });
                            }
                          }}>Aplicar cambios</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Messages preview area */}
            <div className="max-h-36 overflow-y-auto border bg-white rounded-lg p-2 shadow-sm">
              {messages.length === 0 && (
                <div className="text-xs text-gray-500">Historial vacío. Envía texto, imagen o nota de voz.</div>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'} border` }>
                    <div className="text-xs">{m.text}</div>
                    {m.diagram && (
                      <div className="mt-1 text-xs text-green-700">Diagrama recibido — #{(m.diagram.elements||[]).length} clases</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-gradient-to-r from-indigo-400 to-purple-600 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-white text-sm">{mode === 'text' ? 'Texto' : mode === 'voice' ? 'Nota de voz' : 'Imagen'}</div>
            </div>
            <div>
              <button onClick={handleSend} disabled={loading} className="bg-white text-indigo-700 px-3 py-1 rounded-full">
                {loading ? 'Generando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
