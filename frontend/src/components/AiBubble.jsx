import { useState, useRef, useEffect } from 'react';
import { generateDiagram } from '../utils/aiService';

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
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const toggle = () => setOpen(v => !v);

  const pushMessage = (m) => setMessages(prev => [...prev, m]);

  const mergeDiagramIntoBoard = async (diagram) => {
    if (!diagram || (!diagram.elements && !diagram.relationships)) return;

    // Map elements -> nodes
    const newNodes = (diagram.elements || []).map(el => {
      const id = el.id || `ai_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      return {
        id,
        type: 'classNode',
        position: el.position || { x: Math.random() * 600 + 50, y: Math.random() * 400 + 50 },
        data: {
          className: el.name || 'Class',
          attributes: el.attributes || [],
          methods: el.methods || [],
          // keep other metadata just in case
          _aiSource: true
        }
      };
    });

    // Map relationships -> edges
    const newEdges = (diagram.relationships || []).map(rel => {
      const id = rel.id || `ai_rel_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      return {
        id,
        source: rel.sourceId,
        target: rel.targetId,
        type: 'umlEdge',
        data: {
          type: rel.type || 'association',
          cardinality: rel.cardinality || null,
          _aiSource: true
        }
      };
    });

    // Avoid ID conflicts: if an AI-provided id already exists in board, rename the AI id
    const existingNodeIds = new Set(nodes.map(n => n.id));
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

    // Merge into current state
    setNodes(prev => {
      const merged = [...prev, ...newNodes];
      return merged;
    });

    setEdges(prev => {
      const merged = [...prev, ...newEdges];
      return merged;
    });

    // Persist via updateBoardData if available (legacy-compatible: updateBoardData(nodesArray, edgesArray))
    try {
      if (typeof updateBoardData === 'function') {
        const fullNodes = [...nodes, ...newNodes];
        const fullEdges = [...edges, ...newEdges];
        await updateBoardData(fullNodes, fullEdges);
      }
    } catch (err) {
      console.warn('AiBubble: updateBoardData failed', err);
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
