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
  const boardRef = useRef(boardId);

  const wsUrl = options.wsUrl || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL : window.location.origin);

  useEffect(() => {
    boardRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

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

    // On connect -> join sala
    socket.on('connect', () => {
      try {
        socket.emit('unirseSala', { salaId: boardId, usuario: { id: currentUser?.uid || currentUser?.id || null, name: currentUser?.displayName || currentUser?.name || currentUser?.email || 'guest', email: currentUser?.email || null } });
      } catch (err) {
        console.warn('useSocketFlow: error emitting unirseSala', err);
      }
    });

    socket.on('estadoInicial', (payload) => {
      try {
        const state = payload?.state || null;
        if (!state) return;
        // Assume state contains nodes and edges OR full serialized diagram
        if (state.nodes && state.edges) {
          setNodes(state.nodes);
          setEdges(state.edges);
        } else if (Array.isArray(state)) {
          // If saved only nodes array
          setNodes(state);
        } else if (typeof state === 'object') {
          // If state is the last saved diagram (may include nodes/edges fields)
          setNodes(state.nodes || []);
          setEdges(state.edges || []);
        }
      } catch (err) {
        console.error('useSocketFlow: error handling estadoInicial', err);
      }
    });

    socket.on('xmlActualizado', (data) => {
      try {
        const nuevo = data?.nuevoEstado;
        if (!nuevo) return;
        if (nuevo.nodes && nuevo.edges) {
          setNodes(nuevo.nodes);
          setEdges(nuevo.edges);
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
        const { tipo, elemento } = payload || {};
        if (!elemento) return;
        // If elemento looks like a node or edge, integrate
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
          setEdges(prev => prev.map(e => e.id === elemento.id ? { ...e, ...elemento } : e));
        }
      } catch (err) {
        console.error('useSocketFlow: elementoOperado error', err);
      }
    });

    socket.on('diagramaActualizado', (data) => {
      try {
        const payloadState = data?.data?.state;
        if (payloadState) {
          setNodes(payloadState.nodes || nodes);
          setEdges(payloadState.edges || edges);
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

  // Local update helpers that also emit events to server
  const updateBoardData = useCallback(async (updated, key = 'full') => {
    // If updated is an array of nodes or edges, try to infer
    const socket = socketRef.current;
    try {
      if (!socket) return;
      // If key explicitly 'nodes' or 'edges'
      if (key === 'nodes') {
        socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'nodes', elemento: updated });
      } else if (key === 'edges') {
        socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'edges', elemento: updated });
      } else {
        // full state
        const state = { nodes, edges };
        socket.emit('actualizarDiagrama', { salaId: boardRef.current, usuario: { email: currentUser?.email }, action: 'fullState', data: { state } });
      }
    } catch (err) {
      console.error('useSocketFlow: updateBoardData emit error', err);
    }
  }, [nodes, edges, currentUser]);

  const guardarEstado = useCallback(async (estado) => {
    const socket = socketRef.current;
    try {
      if (!socket) return;
      socket.emit('guardarEstado', { salaId: boardRef.current, estado });
    } catch (err) {
      console.error('useSocketFlow: guardarEstado error', err);
    }
  }, []);

  const onNodesChange = useCallback(async (changes) => {
    try {
      const updated = applyNodeChanges(changes, nodes);
      setNodes(updated);
      // Emit lightweight instant change
      const socket = socketRef.current;
      if (socket) {
        socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'nodeChanges', elemento: changes });
      }
    } catch (err) {
      console.error('useSocketFlow: onNodesChange error', err);
    }
  }, [nodes, currentUser]);

  const onEdgesChange = useCallback(async (changes) => {
    try {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
      const socket = socketRef.current;
      if (socket) {
        socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'edgeChanges', elemento: changes });
      }
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
      const socket = socketRef.current;
      if (socket) socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'addNode', elemento: newNode });
      return newNode;
    } catch (err) {
      console.error('useSocketFlow: addNode error', err);
    }
  }, [nodes, currentUser]);

  const updateActiveUsers = useCallback(async () => {
    try {
      const socket = socketRef.current;
      if (!socket) return;
      socket.emit('solicitarEstado', { salaId: boardRef.current });
    } catch (err) {
      console.error('useSocketFlow: updateActiveUsers error', err);
    }
  }, []);

  const cleanupActiveUser = useCallback(async () => {
    try {
      const socket = socketRef.current;
      if (!socket) return;
      // Disconnect will trigger server-side cleanup. Optionally emit a leave event if implemented.
      socket.emit('disconnecting', {});
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
    const updatedEdges = edges.map(e => ({ ...e, data: { ...e.data, selected: e.id === edge.id } }));
    setEdges(updatedEdges);
  }, [edges]);

  const updateNodeData = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const sanitizedClassName = editingData.className ? editingData.className.replace(/\s+/g, '_') : editingData.className;
      const updatedNodes = nodes.map(node => node.id === selectedNode.id ? { ...node, data: { ...editingData, className: sanitizedClassName } } : node);
      setNodes(updatedNodes);
      const socket = socketRef.current;
      if (socket) socket.emit('cambioInstantaneo', { salaId: boardRef.current, usuario: { email: currentUser?.email }, tipo: 'updateNode', elemento: { id: selectedNode.id, data: editingData } });
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
      const socket = socketRef.current;
      if (socket) socket.emit('operacionElemento', { salaId: boardRef.current, usuario: { email: currentUser?.email }, operacion: 'updateEdge', elemento: { id: selectedEdge.id, data: cleanEdgeData } });
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
    setNodes,
    setEdges,
    updateActiveUsers,
    cleanupActiveUser,
    activeUsers
  };
};

export default useSocketFlow;
