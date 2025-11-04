import { useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

/**
 * useSocketFlow
 * Drop-in minimal replacement for `useFirebaseFlow` backed by Socket.IO.
 * - boardId: id of the board/sala
 * - currentUser: firebase auth user object or { email }
 * - options: { wsUrl } optional override
 *
 * Behavior:
 * - Connects to backend Socket.IO and joins room `sala_<boardId>` using event `unirseSala`.
 * - Listens for server events: estadoInicial, xmlActualizado, usuariosConectados, usuarioUnido, usuarioSalio,
 *   cambioRecibido, elementoOperado, diagramaActualizado, estadoGuardado
 * - Emits client events on changes: cambioInstantaneo, operacionElemento, actualizarDiagrama, guardarEstado
 */
export const useSocketFlow = (boardId, currentUser = null, options = {}) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const socketRef = useRef(null);
  const joinedRef = useRef(false);
  const pendingEmitsRef = useRef([]);
  const boardRef = useRef(boardId);
  const lastEventsRef = useRef([]);

  // Debug helper to push events into lastEventsRef from any scope in this hook
  const pushDebugEvent = useCallback((name, payload) => {
    try {
      const max = 30;
      lastEventsRef.current.push({ name, payload, ts: Date.now() });
      if (lastEventsRef.current.length > max) lastEventsRef.current.shift();
    } catch (e) {
      // noop
    }
  }, []);

  const getUsuarioPayload = useCallback(() => ({
    id: currentUser?.id || currentUser?.uid || null,
    name: currentUser?.displayName || currentUser?.name || currentUser?.email || 'guest',
    email: currentUser?.email || null
  }), [currentUser]);

  const wsUrl = options.wsUrl || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL : window.location.origin);

  // Helper to dedupe edges by source/target, preferring edges whose id is present in incomingIdsSet
  const dedupeEdgesByEndpoints = (edgesArray, incomingIdsSet = new Set()) => {
    const byKey = new Map();
    for (const e of edgesArray) {
      const key = `${e.source}::${e.target}`;
      if (!byKey.has(key)) {
        byKey.set(key, e);
        continue;
      }
      const existing = byKey.get(key);
      // prefer incoming if the new one is in incomingIdsSet and existing is not
      if (incomingIdsSet.has(e.id) && !incomingIdsSet.has(existing.id)) {
        byKey.set(key, e);
      }
      // otherwise keep existing
    }
    return Array.from(byKey.values());
  };

  useEffect(() => {
    boardRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    // Debug event history is handled by pushDebugEvent defined at hook scope

    // Build auth payload: prefer cookie-based JWT (server reads cookie).
    // If cookie is not present (dev or cross-origin), fall back to token stored in localStorage.
    let token = null;
    if (typeof document !== 'undefined') {
      const cookieMatch = document.cookie.match(/(^|;)\s*token=([^;]*)/);
      token = cookieMatch ? decodeURIComponent(cookieMatch.pop()) : null;
      if (!token && typeof localStorage !== 'undefined') {
        token = localStorage.getItem('token') || null;
      }
    }

    const socket = io(wsUrl, {
      withCredentials: true,
      auth: token ? { token } : {}
    });

    socketRef.current = socket;

    // On connect -> join sala with ack; server will call the callback when join is confirmed
    socket.on('connect', () => {
      try {
        const payloadUsuario = getUsuarioPayload();
        socket.emit('unirseSala', { salaId: boardId, usuario: payloadUsuario }, (ack) => {
          try {
            if (ack && ack.ok) {
              joinedRef.current = true;
              // flush pending emits
              const socketLocal = socketRef.current;
              const pending = pendingEmitsRef.current.splice(0);
              pending.forEach(p => {
                try { socketLocal.emit(p.event, p.payload); } catch (e) { console.error('useSocketFlow: error flushing pending emit', e); }
              });
            } else {
              console.warn('useSocketFlow: unirseSala ack failed', ack);
            }
          } catch (e) {
            console.error('useSocketFlow: unirseSala ack handler error', e);
          }
        });
      } catch (err) {
        console.warn('useSocketFlow: error emitting unirseSala', err);
      }
    });

      socket.on('estadoInicial', (payload) => {
      try {
        const state = payload?.state || null;
        if (!state) {
            // state missing - nothing to apply
          return;
        }
        if (state.nodes && state.edges) {
          setNodes(state.nodes);
          setEdges(prev => {
            try {
              const incoming = state.edges || [];
              const byId = new Map(incoming.map(e => [e.id, e]));
              // Preserve any locally-created edges that server state doesn't include yet
              prev.forEach(e => {
                if (e?.data?._localCreated && !byId.has(e.id)) {
                  byId.set(e.id, e);
                }
              });
              // Dedupe by endpoints to avoid duplicates when server returns equivalent edge with different id
              const merged = Array.from(byId.values());
              const incomingIds = new Set(incoming.map(e => e.id));
              return dedupeEdgesByEndpoints(merged, incomingIds);
            } catch (err) {
              console.warn('useSocketFlow: merge on estadoInicial failed, falling back to incoming edges', err);
              return state.edges || [];
            }
          });
        } else if (Array.isArray(state)) {
          // If saved only nodes array
          // estadoInicial contains nodes array only
          setNodes(state);
        } else if (typeof state === 'object') {
          // fallback: object with nodes/edges
            setNodes(state.nodes || []);
            setEdges(prev => {
              try {
                const incoming = state.edges || [];
                const byId = new Map(incoming.map(e => [e.id, e]));
                prev.forEach(e => {
                  if (e?.data?._localCreated && !byId.has(e.id)) {
                    byId.set(e.id, e);
                  }
                });
                const merged = Array.from(byId.values());
                const incomingIds = new Set(incoming.map(e => e.id));
                return dedupeEdgesByEndpoints(merged, incomingIds);
              } catch (err) {
                console.warn('useSocketFlow: merge on estadoInicial fallback failed', err);
                return state.edges || [];
              }
            });
        }
      } catch (err) {
        console.error('useSocketFlow: error handling estadoInicial', err);
      }
    });

    socket.on('xmlActualizado', (data) => {
      try {
        const nuevo = data?.nuevoEstado;
        if (!nuevo) {
          return;
        }
        if (nuevo.nodes && nuevo.edges) {
          setNodes(nuevo.nodes);
          setEdges(prev => {
            try {
              const incoming = nuevo.edges || [];
              const byId = new Map(incoming.map(e => [e.id, e]));
              prev.forEach(e => {
                if (e?.data?._localCreated && !byId.has(e.id)) {
                  byId.set(e.id, e);
                }
              });
              const merged = Array.from(byId.values());
              const incomingIds = new Set(incoming.map(e => e.id));
              const deduped = dedupeEdgesByEndpoints(merged, incomingIds);
              return deduped;
            } catch (err) {
              console.warn('useSocketFlow: merge on xmlActualizado failed', err);
              return nuevo.edges || [];
            }
          });
        } else if (Array.isArray(nuevo)) {
          setNodes(nuevo);
        }
      } catch (err) {
        console.error('useSocketFlow: error handling xmlActualizado', err);
      }
    });

      socket.on('usuariosConectados', (payload) => {
        try {
          const users = payload?.usuarios || [];
          setActiveUsers(users.map(u => u.email || u.name || u.id));
        } catch (err) {
          console.error('useSocketFlow: error usuariosConectados', err);
        }
      });

    socket.on('usuarioUnido', ({ usuario }) => {
      try {
        if (!usuario) return;
        setActiveUsers(prev => {
          const val = prev.includes(usuario.email || usuario.name || usuario.id) ? prev : [...prev, usuario.email || usuario.name || usuario.id];
          return val;
        });
      } catch (err) {
        console.error('useSocketFlow: usuarioUnido error', err);
      }
    });

    socket.on('usuarioSalio', ({ usuarioId }) => {
      try {
        setActiveUsers(prev => prev.filter(u => u !== usuarioId));
      } catch (err) {
        console.error('useSocketFlow: usuarioSalio error', err);
      }
    });

  socket.on('cambioRecibido', (payload) => {
      // Payload expected: { salaId, usuario, tipo, elemento, timestamp }
      // For simplicity apply minimal local change handling: if elemento present and tipo indicates node/edge change, merge
      try {
        // If this change came from the same user that is connected here, skip applying
        // because the origin already applied the local change. Compare by id/email when available.
        try {
          const sender = payload?.usuario || {};
          const me = getUsuarioPayload();
          if (sender && me && ((sender.id && me.id && sender.id === me.id) || (sender.email && me.email && sender.email === me.email))) {
            // ignore self-originated changes
            return;
          }
        } catch (inner) {
          // ignore errors in self-detection
        }
        const { tipo, elemento } = payload || {};
        if (!elemento) return;
        // If elemento is an array, treat as bulk nodes or edges update
        if (Array.isArray(elemento)) {
          // detect if array items look like nodes (have position) or edges (have source/target)
          const first = elemento[0];
          if (!first) return;
          if (first.position) {
            // replace/merge nodes: merge by id
            setNodes(prev => {
              const byId = new Map(prev.map(n => [n.id, n]));
              elemento.forEach(n => byId.set(n.id, { ...(byId.get(n.id) || {}), ...n }));
              const result = Array.from(byId.values());
              return result;
            });
          } else if (first.source && first.target) {
            // merge incoming edges with local set
            setEdges(prev => {
              const byId = new Map(prev.map(e => [e.id, e]));
              elemento.forEach(e => byId.set(e.id, { ...(byId.get(e.id) || {}), ...e }));
              const merged = Array.from(byId.values());
              const incomingIds = new Set(elemento.map(e => e.id));
              const deduped = dedupeEdgesByEndpoints(merged, incomingIds);
              return deduped;
            });
          }
          return;
        }
        // If elemento looks like a node or edge, integrate single item
        if (elemento.id && elemento.position) {
          setNodes(prev => {
            const exists = prev.some(n => n.id === elemento.id);
            if (exists) return prev.map(n => n.id === elemento.id ? { ...n, ...elemento } : n);
            return [...prev, elemento];
          });
        } else if (elemento.id && elemento.source && elemento.target) {
          setEdges(prev => {
            const exists = prev.some(e => e.id === elemento.id);
            if (exists) return prev.map(e => e.id === elemento.id ? { ...e, ...elemento } : e);
            return [...prev, elemento];
          });
        } else if (elemento.id && elemento.data) {
          // Update node or edge data (e.g., rename class) without changing position
          setNodes(prev => prev.map(n => n.id === elemento.id ? { ...n, data: { ...(n.data || {}), ...(elemento.data || {}) } } : n));
          setEdges(prev => prev.map(e => e.id === elemento.id ? { ...e, data: { ...(e.data || {}), ...(elemento.data || {}) } } : e));
        }
      } catch (err) {
        console.error('useSocketFlow: cambioRecibido error', err);
      }
    });

    socket.on('elementoOperado', (payload) => {
      // Similar to cambioRecibido
      try {
        const { elemento } = payload || {};
        if (!elemento) return;
        if (elemento.id && elemento.position) {
          setNodes(prev => prev.map(n => n.id === elemento.id ? { ...n, ...elemento } : n));
        } else if (elemento.id && elemento.source && elemento.target) {
          setEdges(prev => {
            const res = prev.map(e => e.id === elemento.id ? { ...e, ...elemento } : e);
            return res;
          });
        } else if (elemento.id && elemento.data) {
          setNodes(prev => prev.map(n => n.id === elemento.id ? { ...n, data: { ...(n.data || {}), ...(elemento.data || {}) } } : n));
          setEdges(prev => prev.map(e => e.id === elemento.id ? { ...e, data: { ...(e.data || {}), ...(elemento.data || {}) } } : e));
        }
      } catch (err) {
        console.error('useSocketFlow: elementoOperado error', err);
      }
    });

    socket.on('diagramaActualizado', (data) => {
      try {
        const payloadState = data?.data?.state;
        if (payloadState) {
          // merge incoming full state with locally-created edges
          setNodes(payloadState.nodes || nodes);
          setEdges(prev => {
            try {
              const incoming = payloadState.edges || [];
              const byId = new Map(incoming.map(e => [e.id, e]));
              prev.forEach(e => {
                if (e?.data?._localCreated && !byId.has(e.id)) {
                  byId.set(e.id, e);
                }
              });
              const merged = Array.from(byId.values());
              const incomingIds = new Set(incoming.map(e => e.id));
              const deduped = dedupeEdgesByEndpoints(merged, incomingIds);
              return deduped;
            } catch (err) {
              console.warn('useSocketFlow: merge on diagramaActualizado failed', err);
              return payloadState.edges || edges;
            }
          });
        }
      } catch (err) {
        console.error('useSocketFlow: diagramaActualizado error', err);
      }
    });

    socket.on('estadoGuardado', (payload) => {
      // server ack when saved
      // can be used to show UI feedback
      // payload may contain success flag
    });

    return () => {
      try {
        if (socket && socket.connected) {
          socket.disconnect();
        }
      } catch (err) {
        console.warn('useSocketFlow: error during disconnect', err);
      }
    };
  }, [boardId, wsUrl, currentUser]);

  // helper to emit safely after join ack (queues emits until joined)
  const emitSafe = useCallback((event, payload) => {
    const socket = socketRef.current;
    try {
      if (!socket) return;
      if (joinedRef.current) {
        socket.emit(event, payload);
      } else {
        pendingEmitsRef.current.push({ event, payload });
      }
    } catch (err) {
      console.error('useSocketFlow: emitSafe error', err);
    }
  }, []);

  // Local update helpers that also emit events to server
  const updateBoardData = useCallback(async (updated, key = 'full') => {
    // Backwards-compatible updateBoardData.
    // Supported call signatures:
    // 1) updateBoardData(updatedArray, 'nodes'|'edges') -> emits cambioInstantaneo
    // 2) updateBoardData(stateObject) -> emits actualizarDiagrama with state
    // 3) updateBoardData(nodesArray, edgesArray) -> legacy callers (BurbujaHerramientasDiagrama, etc.)
    const socket = socketRef.current;
    try {
      if (!socket) return;
      const usuarioPayload = getUsuarioPayload();

      // Legacy: caller passed (nodesArray, edgesArray)
      if (Array.isArray(updated) && Array.isArray(key)) {
        const nodesArr = updated;
        const edgesArr = key;
    // console.debug('useSocketFlow: updateBoardData legacy nodes/edges signature', { nodes: nodesArr.length, edges: edgesArr.length });
        pushDebugEvent('updateBoardData.legacy', { nodes: nodesArr.length, edges: edgesArr.length });
        emitSafe('actualizarDiagrama', { salaId: boardRef.current, usuario: usuarioPayload, action: 'fullState', data: { state: { nodes: nodesArr, edges: edgesArr } } });
        return;
      }

      // If key explicitly 'nodes' or 'edges'
      if (key === 'nodes') {
        emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: usuarioPayload, tipo: 'nodes', elemento: updated });
        pushDebugEvent('updateBoardData.nodes', { count: Array.isArray(updated) ? updated.length : 0 });
        return;
      }
      if (key === 'edges') {
        emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: usuarioPayload, tipo: 'edges', elemento: updated });
        pushDebugEvent('updateBoardData.edges', { count: Array.isArray(updated) ? updated.length : 0 });
        return;
      }

      // If caller passed a full state object
      if (updated && typeof updated === 'object' && (updated.nodes || updated.edges)) {
        const state = { nodes: updated.nodes || nodes, edges: updated.edges || edges };
  // console.debug('useSocketFlow: updateBoardData full state object', { nodes: state.nodes.length, edges: state.edges.length });
        pushDebugEvent('updateBoardData.fullObject', { nodes: state.nodes.length, edges: state.edges.length });
        emitSafe('actualizarDiagrama', { salaId: boardRef.current, usuario: usuarioPayload, action: 'fullState', data: { state } });
        return;
      }

      // Default: send full in-hook state
      const state = { nodes, edges };
      emitSafe('actualizarDiagrama', { salaId: boardRef.current, usuario: usuarioPayload, action: 'fullState', data: { state } });
      pushDebugEvent('updateBoardData.fullStateDefault', { nodes: state.nodes.length, edges: state.edges.length });
    } catch (err) {
      console.error('useSocketFlow: updateBoardData emit error', err);
    }
  }, [nodes, edges, currentUser]);

  const guardarEstado = useCallback(async (estado, opts = { timeoutMs: 8000 }) => {
    const socket = socketRef.current;
    try {
      if (!socket) return { success: false, error: 'socket-not-ready' };
      const payload = { salaId: boardRef.current, estado };

      // If joined, emit and wait for server ack 'estadoGuardado' targeted to this sala
      if (joinedRef.current && typeof socket.emit === 'function') {
        return await new Promise((resolve) => {
          let resolved = false;
          const onAck = (ack) => {
            if (resolved) return;
            // ack may be a simple { success: true }
            resolved = true;
            resolve(ack || { success: true });
          };

          // Listen once for server ack
          try {
            socket.once('estadoGuardado', onAck);
            socket.emit('guardarEstado', payload);
          } catch (emitErr) {
            socket.off('estadoGuardado', onAck);
            resolved = true;
            resolve({ success: false, error: emitErr.message });
            return;
          }

          // Timeout fallback
          const to = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            socket.off('estadoGuardado', onAck);
            resolve({ success: false, error: 'timeout' });
          }, opts.timeoutMs || 8000);
        });
      }

      // Fallback: queue emit for when joined
      emitSafe('guardarEstado', payload);
      return { success: true };
    } catch (err) {
      console.error('useSocketFlow: guardarEstado error', err);
      return { success: false, error: err.message };
    }
  }, []);

  const onNodesChange = useCallback(async (changes) => {
    try {
      const updated = applyNodeChanges(changes, nodes);
      setNodes(updated);
      // Emit full updated nodes array so other clients can apply positions immediately
      emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: getUsuarioPayload(), tipo: 'nodes', elemento: updated });
    } catch (err) {
      console.error('useSocketFlow: onNodesChange error', err);
    }
  }, [nodes, currentUser]);

  const onEdgesChange = useCallback(async (changes) => {
    try {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
      // Emit full updated edges array so other clients can update immediately
      emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: getUsuarioPayload(), tipo: 'edges', elemento: updated });
    } catch (err) {
      console.error('useSocketFlow: onEdgesChange error', err);
    }
  }, [edges, currentUser]);

  const addNode = useCallback(async (nodeType = 'classNode', customData = {}) => {
    try {
      let newNode;
      if (nodeType === 'noteNode') {
        newNode = {
          id: `note-${Date.now()}`,
          position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
          type: 'noteNode',
          data: { text: customData.text || 'Nueva nota...', isNote: true, ...customData }
        };
      } else {
        const sanitizedClassName = `Clase${nodes.filter(n => n.type === 'classNode').length + 1}`;
        newNode = {
          id: `node-${Date.now()}`,
          position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
          type: 'classNode',
          data: { className: sanitizedClassName, attributes: ['nuevoAtributo: string'], methods: ['nuevoMetodo(): void'], ...customData }
        };
      }
  const updatedNodes = [...nodes, newNode];
  setNodes(updatedNodes);
  // Notify server about new node
  emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: getUsuarioPayload(), tipo: 'addNode', elemento: newNode });
      return newNode;
    } catch (err) {
      console.error('useSocketFlow: addNode error', err);
    }
  }, [nodes, currentUser]);

  const updateActiveUsers = useCallback(async () => {
    try {
      const socket = socketRef.current;
      if (!socket) return;
      emitSafe('solicitarEstado', { salaId: boardRef.current });
    } catch (err) {
      console.error('useSocketFlow: updateActiveUsers error', err);
    }
  }, []);

  const cleanupActiveUser = useCallback(async () => {
    try {
      const socket = socketRef.current;
      if (!socket) return;
      // Disconnect will trigger server-side cleanup. Optionally emit a leave event if implemented.
      // Use direct socket.emit for disconnecting as server handles disconnect event
      try { socketRef.current.emit('disconnecting', {}); } catch (e) { console.warn('useSocketFlow: disconnecting emit failed', e); }
    } catch (err) {
      console.error('useSocketFlow: cleanupActiveUser error', err);
    }
  }, []);

  // Edge/node selection helpers
  const handleNodeSelection = useCallback((node) => {
    setSelectedNode(node);
    setEditingData({ ...node.data });
  }, []);

  const handleEdgeSelection = useCallback((edge) => {
    setSelectedNode(null);
    setEditingData(null);
    setSelectedEdge(edge);
    const completeEdgeData = { type: 'Association', startLabel: '', endLabel: '', label: '', sourceRole: '', targetRole: '', selected: true, ...edge.data };
    setEditingEdge(completeEdgeData);
    // Use functional setState to avoid stomping on concurrent updates that may have added/removed edges
    setEdges((prev) => prev.map(e => ({ ...e, data: { ...e.data, selected: e.id === edge.id } })));
  }, []);

  const updateNodeData = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const sanitizedClassName = editingData.className ? editingData.className.replace(/\s+/g, '_') : editingData.className;
      const updatedNodes = nodes.map(node => node.id === selectedNode.id ? { ...node, data: { ...editingData, className: sanitizedClassName } } : node);
      setNodes(updatedNodes);
  emitSafe('cambioInstantaneo', { salaId: boardRef.current, usuario: getUsuarioPayload(), tipo: 'updateNode', elemento: { id: selectedNode.id, data: editingData } });
      setSelectedNode(null);
    } catch (err) {
      console.error('useSocketFlow: updateNodeData error', err);
    }
  }, [selectedNode, editingData, nodes, currentUser]);

  const updateEdgeData = useCallback(async () => {
    if (!selectedEdge || !editingEdge) return;
    try {
      const { selected, ...cleanEdgeData } = editingEdge;
      const updated = edges.map(edge => edge.id === selectedEdge.id ? { ...edge, data: { ...cleanEdgeData, selected: false } } : { ...edge, data: { ...edge.data, selected: false } });
      setEdges(updated);
  emitSafe('operacionElemento', { salaId: boardRef.current, usuario: getUsuarioPayload(), operacion: 'updateEdge', elemento: { id: selectedEdge.id, data: cleanEdgeData } });
      setSelectedEdge(null);
      setEditingEdge(null);
    } catch (err) {
      console.error('useSocketFlow: updateEdgeData error', err);
    }
  }, [selectedEdge, editingEdge, edges, currentUser]);

  return {
    nodes,
    edges,
    participantes,
    selectedNode,
    selectedEdge,
    editingData,
    editingEdge,
    onNodesChange,
    onEdgesChange,
    addNode,
    handleNodeSelection,
    handleEdgeSelection,
    updateNodeData,
    updateEdgeData,
    setEditingData,
    setEditingEdge,
    setSelectedEdge,
  updateBoardData,
  guardarEstado,
  setNodes,
    setEdges,
    updateActiveUsers,
    cleanupActiveUser,
    getDebugEvents: () => lastEventsRef.current,
    activeUsers
  };
};

export default useSocketFlow;
