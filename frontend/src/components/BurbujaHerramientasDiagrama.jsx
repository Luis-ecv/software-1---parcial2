import { useState, useRef, useEffect } from 'react';

/**
 * Componente de burbuja FAB con herramientas del diagrama
 * - Mantiene todas las funciones originales.
 * - Añade un handler React para "Exportar IMG" que llama al endpoint backend
 *   /apis/export/board/:id y descarga la imagen generada.
 *
 * Requisitos en backend (si aún no lo tienes):
 * - Endpoint POST /apis/export/board/:id que genere la imagen (p. ej. con Puppeteer)
 * - Si el endpoint requiere autenticación, ajusta `credentials` o headers en la llamada.
 */
const BurbujaHerramientasDiagrama = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  selectedNodeIds = [],
  selectedEdgeIds = [],
  boardId,
  updateBoardData: updateBoardDataProp,
  userEmail = null,
  defaultOpen = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelRef = useRef(null);
  const fabRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        fabRef.current &&
        !fabRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const noopUpdate = async (newNodes, newEdges) => {
    console.warn('updateBoardData not provided. Changes will be local only.');
  };
  const updateBoardData = (typeof updateBoardDataProp === 'function') ? updateBoardDataProp : noopUpdate;

  // ---- Herramientas existentes (se mantienen) ----
  const seleccionarTodo = () => { setIsOpen(false); };
  const deseleccionarTodo = () => { setIsOpen(false); };

  const eliminarSeleccionados = async () => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    const newNodes = nodes.filter(node => !selectedNodeIds.includes(node.id));
    const newEdges = edges.filter(edge =>
      !selectedEdgeIds.includes(edge.id) &&
      !selectedNodeIds.includes(edge.source) &&
      !selectedNodeIds.includes(edge.target)
    );
    setNodes(newNodes);
    setEdges(newEdges);
    await updateBoardData(newNodes, newEdges);
    setIsOpen(false);
  };

  const duplicarSeleccionados = async () => {
    if (selectedNodeIds.length === 0) return;
    const nodesToDuplicate = nodes.filter(node => selectedNodeIds.includes(node.id));
    const edgesToDuplicate = edges.filter(edge => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target));
    const duplicatedNodes = nodesToDuplicate.map((node) => ({
      ...node,
      id: `${node.id}_copy_${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data, name: `${node.data?.name || 'Nodo'}_Copia` }
    }));
    const idMap = {};
    nodesToDuplicate.forEach((n, i) => idMap[n.id] = duplicatedNodes[i].id);
    const duplicatedEdges = edgesToDuplicate.map(edge => ({
      ...edge,
      id: `${edge.id}_copy_${Date.now()}`,
      source: idMap[edge.source] || edge.source,
      target: idMap[edge.target] || edge.target
    }));
    const newNodes = [...nodes, ...duplicatedNodes];
    const newEdges = [...edges, ...duplicatedEdges];
    setNodes(newNodes); setEdges(newEdges);
    await updateBoardData(newNodes, newEdges);
    setIsOpen(false);
  };

  const limpiarDiagrama = async () => {
    if (nodes.length === 0 && edges.length === 0) return;
    const localCreatedCount = edges.filter(e => e?.data?._localCreated).length;
    let msg = '¿Estás seguro de que quieres limpiar todo el diagrama?';
    if (localCreatedCount > 0) msg += `\n\nNota: hay ${localCreatedCount} aristas no confirmadas localmente.`;
    if (window.confirm(msg)) {
      setNodes([]); setEdges([]);
      await updateBoardData([], []);
      setIsOpen(false);
    }
  };

  const autoOrganizar = () => {
    const organizedNodes = nodes.map((node, index) => ({
      ...node,
      position: { x: (index % 3) * 200 + 100, y: Math.floor(index / 3) * 150 + 100 }
    }));
    setNodes(organizedNodes);
    updateBoardData(organizedNodes, edges);
    setIsOpen(false);
  };

  const exportarJSON = () => {
    const diagramData = { nodes, edges, exportedAt: new Date().toISOString(), boardId };
    const blob = new Blob([JSON.stringify(diagramData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `diagrama_${boardId || 'board'}_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // ------------------ NUEVO: handler que llama al backend para exportar img ------------------
  // Asume que tu backend expone POST /apis/export/board/:id que retorna JPEG
  const handleExportImgClick = async () => {
    if (!boardId) {
      alert('No hay boardId disponible para exportar.');
      return;
    }

    setExporting(true);
    try {
      // Prefer backend API base configured via Vite env (must include protocol in prod)
      const apiBase = import.meta.env.VITE_API_BASE;
      const requestUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/apis/export/board/${encodeURIComponent(boardId)}` : `/apis/export/board/${encodeURIComponent(boardId)}`;
      const resp = await fetch(requestUrl, {
        method: 'POST',
        credentials: 'include', // mantiene cookies si tu backend usa sesiones
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });

      if (!resp.ok) {
        let text;
        try { text = await resp.text(); } catch (e) { text = resp.statusText; }
        console.error('Export failed:', resp.status, text);
        alert('Error al exportar la imagen: ' + (text || resp.status));
        return;
      }

      const blob = await resp.blob();
      // Ensure it's an image
      if (!blob || !blob.type.startsWith('image/')) {
        console.error('Invalid response type for image export', blob);
        alert('Respuesta inválida del servidor al exportar la imagen.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagrama_${boardId || 'board'}_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exportando la imagen: ' + (err.message || err));
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  // ------------------ herramientas (incluye botón Exportar IMG wired to handler) ------------------
  const herramientas = [
    { id: 'select-all', label: 'Seleccionar Todo', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>), action: seleccionarTodo, disabled: nodes.length === 0 },
    { id: 'deselect-all', label: 'Deseleccionar Todo', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>), action: deseleccionarTodo, disabled: selectedNodeIds.length === 0 && selectedEdgeIds.length === 0 },
    { id: 'delete-selected', label: 'Eliminar Seleccionados', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>), action: eliminarSeleccionados, disabled: selectedNodeIds.length === 0 && selectedEdgeIds.length === 0, danger: true },
    { id: 'duplicate-selected', label: 'Duplicar Seleccionados', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>), action: duplicarSeleccionados, disabled: selectedNodeIds.length === 0 },
    { id: 'auto-organize', label: 'Auto Organizar', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>), action: autoOrganizar, disabled: nodes.length === 0 },
    { id: 'export-json', label: 'Exportar JSON', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>), action: exportarJSON, disabled: nodes.length === 0 && edges.length === 0 },
    { id: 'export-img', label: exporting ? 'Exportando...' : 'Exportar IMG', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z" /><circle cx="12" cy="13" r="3" strokeWidth="2" /></svg>), action: handleExportImgClick, disabled: nodes.length === 0 && edges.length === 0 || exporting },
    { id: 'clear-diagram', label: 'Limpiar Diagrama', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>), action: limpiarDiagrama, disabled: nodes.length === 0 && edges.length === 0, danger: true }
  ];

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* Panel de herramientas */}
      {isOpen && (
        <div 
          ref={panelRef}
          className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 min-w-56 max-w-xs animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header del panel */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Herramientas del Diagrama
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Lista de herramientas */}
          <div className="py-2 max-h-80 overflow-y-auto">
            {herramientas.map((herramienta) => (
              <button
                key={herramienta.id}
                onClick={herramienta.action}
                disabled={herramienta.disabled}
                className={`
                  w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors
                  ${herramienta.disabled 
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                    : herramienta.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <span className={`
                  ${herramienta.disabled 
                    ? 'opacity-50' 
                    : herramienta.danger 
                      ? 'text-red-500' 
                      : 'text-gray-500 dark:text-gray-400'
                  }
                `}>
                  {herramienta.icon}
                </span>
                {herramienta.label}
              </button>
            ))}
          </div>

          {/* Footer con estadísticas */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{nodes.length} nodos</span>
              <span>{edges.length} conexiones</span>
              <span>{selectedNodeIds.length + selectedEdgeIds.length} seleccionados</span>
            </div>
          </div>
        </div>
      )}

      {/* Botón FAB */}
      <button
        ref={fabRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-14 h-14 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg 
          hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-4 
          focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-200
          flex items-center justify-center group
          ${isOpen ? 'rotate-45' : 'hover:scale-110'}
        `}
        title="Herramientas del Diagrama"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default BurbujaHerramientasDiagrama;