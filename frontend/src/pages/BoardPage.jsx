// BoardPage.jsx
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  getSmoothStepPath,
  Position
} from "@xyflow/react";
import { useParams } from "react-router-dom";
// db removed - switching to Socket.IO based flow for realtime sync
import {
  nodeTypes,
  edgeTypes,
  defaultEdgeOptions,
} from '../config/flowConfig';
import useSocketFlow from '../config/useSocketFlow';
import LeftSidebar from "../components/control/Sidebar"; 
import Swal from 'sweetalert2';
import { buildExportXML } from '../utils/myCustomXmlFunctions';
import { generateCode } from '../utils/codeGenerator';
import { generateCompleteProject } from '../utils/completeProjectGenerator';
import { verifyUMLDiagramWithAI, validateAICredentials } from '../utils/aiUMLValidator';
import BurbujaHerramientasDiagrama from '../components/BurbujaHerramientasDiagrama';
import AiBubble from '../components/AiBubble';
import JSZip from 'jszip'
import { saveAs } from 'file-saver';


const BoardPage = () => {
  const { id: boardId } = useParams();
  const [currentUser, setCurrentUser] = useState(null);

  // Try to fetch profile from backend; fallback to token in localStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const apiBase = import.meta.env.VITE_WS_URL || window.location.origin;
        let res = await fetch(`${apiBase}/apis`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const payload = await res.json();
          // backend responses are wrapped as { error: false, data: ... }
          const user = payload && payload.data ? payload.data : payload;
          if (user && (user.id || user.email)) {
            setCurrentUser({ id: user.id, name: user.name, email: user.email });
            return;
          }
          // unexpected shape
        }

        // If cookie-based auth failed (no cookie sent), try fallback using token stored in localStorage
        const fallbackToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
        if (fallbackToken) {
          try {
            res = await fetch(`${apiBase}/apis`, { headers: { Authorization: `Bearer ${fallbackToken}` }, credentials: 'include' });
            if (!mounted) return;
            if (res.ok) {
              const payload = await res.json();
              const user = payload && payload.data ? payload.data : payload;
              if (user && (user.id || user.email)) {
                setCurrentUser({ id: user.id, name: user.name, email: user.email });
                return;
              }
              // unexpected shape on fallback
            }
          } catch (inner) {
            // ignore fallback error and continue to navigate to login
          }
        }
      } catch (err) {
        // ignore
      }
      // Fallback: try token in localStorage (may not contain user info)
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (token && mounted) {
        setCurrentUser({ email: 'guest' });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const {
    nodes,
    edges,
    activeUsers,
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
      setEdges
  } = useSocketFlow(boardId, currentUser);

  const navigate = useNavigate();
  
  // Estado para controlar modificaciones de IA
  const [aiModificationActive, setAiModificationActive] = useState(false);

  const ActiveUsers = ({ users }) => (
    <div className="flex flex-wrap gap-2">
      {users.map((user, index) => (
        <div
          key={index}
          className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs flex items-center"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          {user}
        </div>
      ))}
    </div>
  );

  

  // Owner metadata for this sala (to determine host/owner)
  const [ownerId, setOwnerId] = useState(null);
  const [ownerEmail, setOwnerEmail] = useState(null);

  // Fetch sala metadata (owner) so we can determine host reliably
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!boardId) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_WS_URL || window.location.origin}/apis/sala/${boardId}`, { credentials: 'include' });
        if (!mounted) return;
        if (!res.ok) return; // ignore
        const payload = await res.json().catch(() => null);
        const dataRows = payload && payload.data ? payload.data : payload;
        const row = Array.isArray(dataRows) && dataRows.length > 0 ? dataRows[0] : (dataRows || {});
        if (row) {
          // The DB uses userId as owner; try multiple casings
          if (row.userid !== undefined) setOwnerId(row.userid);
          else if (row.userId !== undefined) setOwnerId(row.userId);
          if (row.host !== undefined) setOwnerEmail(row.host);
        }
      } catch (err) {
        console.warn('Failed to fetch sala metadata', err);
      }
    })();
    return () => { mounted = false; };
  }, [boardId]);

  // Consider user the host if they match ownerId (preferred) or are present in participantes
  const isHost = (() => {
    try {
      if (!currentUser) return false;
      if (ownerId && String(ownerId) === String(currentUser.id)) return true;
      if (ownerEmail && currentUser.email && String(ownerEmail) === String(currentUser.email)) return true;
      if (participantes && Array.isArray(participantes) && currentUser.email && participantes.includes(currentUser.email)) return true;
      return false;
    } catch (e) {
      return false;
    }
  })();

  // Track unsaved changes locally (to warn on exit)
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialLoadRef = useRef(false);
  const unsavedTimerRef = useRef(null);

  // Debounced marking of unsaved changes. Skip the initial load from server.
  useEffect(() => {
    // If we haven't received the initial state yet and nodes/edges now contain data, treat as initial load
    if (!initialLoadRef.current && ((nodes && nodes.length > 0) || (edges && edges.length > 0))) {
      initialLoadRef.current = true;
      setUnsaved(false);
      return;
    }

    // After initial load, mark unsaved (debounced)
    if (unsavedTimerRef.current) clearTimeout(unsavedTimerRef.current);
    unsavedTimerRef.current = setTimeout(() => {
      setUnsaved(true);
    }, 200);
    return () => {
      if (unsavedTimerRef.current) clearTimeout(unsavedTimerRef.current);
    };
  }, [nodes, edges]);

  // Warn user when trying to close tab/window if there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (unsaved) {
        e.preventDefault();
        e.returnValue = 'Hay cambios sin guardar en la pizarra. ¿Seguro que quieres salir?';
        return 'Hay cambios sin guardar en la pizarra. ¿Seguro que quieres salir?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsaved]);

  // Función para verificar diagrama UML con IA
  const handleVerifyDiagramAI = async () => {
    try {
      // Validar que hay un diagrama para verificar
      if (!nodes.length) {
        Swal.fire({
          icon: 'info',
          title: 'Diagrama vacío',
          text: 'No hay clases en el diagrama para verificar.'
        });
        return;
      }

      // Validar credenciales de IA
      const credentialsCheck = validateAICredentials();
      if (!credentialsCheck.valid) {
        Swal.fire({
          icon: 'error',
          title: 'Configuración faltante',
          html: `<div class="text-left">
            <p>No se pudo conectar con la IA:</p>
            <p class="text-sm text-gray-600 mt-2">${credentialsCheck.message}</p>
            <br>
            <p class="text-sm"><strong>Para configurar:</strong></p>
            <ol class="text-sm text-left list-decimal pl-4">
              <li>Crea un archivo <code>.env</code> en la raíz del proyecto</li>
              <li>Agrega: <code>VITE_GEMINI_API_KEY=tu_clave_aqui</code></li>
              <li>Reinicia la aplicación</li>
            </ol>
          </div>`,
          confirmButtonText: 'Entendido'
        });
        return;
      }

      // Mostrar indicador de carga
      Swal.fire({
        title: 'Verificando con IA...',
        html: `
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Enviando diagrama a la IA para análisis experto</p>
            <p class="text-sm text-gray-500 mt-2">Esto puede tomar unos segundos...</p>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => {
          // Opcional: agregar más animaciones personalizadas
        }
      });

      // Llamar a la IA para verificación
      const resultado = await verifyUMLDiagramWithAI(nodes, edges, boardId, 'GEMINI', true);

      // Formatear y mostrar resultados
      const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
      };

      const getScoreIcon = (score) => {
        if (score >= 80) return '🎉';
        if (score >= 60) return '⚠️';
        return '❌';
      };

      let htmlContent = `
        <div class="text-left max-h-96 overflow-y-auto">
          <div class="text-center mb-4">
            <div class="text-4xl mb-2">${getScoreIcon(resultado.scoreDiseno)}</div>
            <div class="text-2xl font-bold mb-2">
              <span class="${getScoreColor(resultado.scoreDiseno)}">Score: ${resultado.scoreDiseno}/100</span>
            </div>
            <div class="text-sm ${resultado.okEstructural ? 'text-green-600' : 'text-red-600'}">
              ${resultado.okEstructural ? '✅ Estructura correcta' : '❌ Problemas estructurales'}
            </div>
          </div>`;

      // Problemas estructurales
      if (!resultado.okEstructural) {
        htmlContent += `<div class="mb-4 p-3 bg-red-50 rounded">
          <h4 class="font-semibold text-red-700 mb-2">Problemas Estructurales:</h4>`;
        
        if (resultado.islas?.length > 0) {
          htmlContent += `<p class="text-sm mb-1"><strong>Nodos aislados:</strong> ${resultado.islas.join(', ')}</p>`;
        }
        
        if (resultado.referenciasRotas?.length > 0) {
          htmlContent += `<p class="text-sm mb-1"><strong>Referencias rotas:</strong> ${resultado.referenciasRotas.length}</p>`;
        }
        
        if (resultado.ciclosHerencia?.length > 0) {
          htmlContent += `<p class="text-sm mb-1"><strong>Ciclos de herencia:</strong> ${resultado.ciclosHerencia.length}</p>`;
        }
        
        htmlContent += `</div>`;
      }

      // Acciones prioritarias
      if (resultado.accionesPrioritarias?.length > 0) {
        htmlContent += `
          <div class="mb-4">
            <h4 class="font-semibold text-orange-700 mb-2">🔥 Acciones Prioritarias:</h4>
            <ul class="text-sm space-y-1">
              ${resultado.accionesPrioritarias.map((accion, idx) => 
                `<li class="flex items-start gap-2">
                  <span class="text-orange-600 font-bold">${idx + 1}.</span>
                  <span>${accion}</span>
                </li>`
              ).join('')}
            </ul>
          </div>`;
      }

      // Sugerencias
      if (resultado.sugerencias?.length > 0) {
        htmlContent += `
          <div class="mb-4">
            <h4 class="font-semibold text-blue-700 mb-2">💡 Sugerencias:</h4>
            <ul class="text-sm space-y-1">
              ${resultado.sugerencias.map(sugerencia => 
                `<li class="flex items-start gap-2">
                  <span class="text-blue-600">•</span>
                  <span>${sugerencia}</span>
                </li>`
              ).join('')}
            </ul>
          </div>`;
      }

      // Tags
      if (resultado.tags?.length > 0) {
        htmlContent += `
          <div class="mb-4">
            <h4 class="font-semibold mb-2">🏷️ Aspectos Analizados:</h4>
            <div class="flex flex-wrap gap-1">
              ${resultado.tags.map(tag => 
                `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${tag}</span>`
              ).join('')}
            </div>
          </div>`;
      }

      // Limitaciones
      if (resultado.limitaciones?.length > 0) {
        htmlContent += `
          <div class="mb-2">
            <h4 class="font-semibold text-gray-600 mb-2">ℹ️ Limitaciones:</h4>
            <ul class="text-xs text-gray-600 space-y-1">
              ${resultado.limitaciones.map(limitacion => 
                `<li>• ${limitacion}</li>`
              ).join('')}
            </ul>
          </div>`;
      }

      htmlContent += `
        <div class="mt-4 pt-3 border-t text-center">
          <p class="text-xs text-gray-500">Análisis realizado por IA • ${new Date().toLocaleString()}</p>
        </div>
      </div>`;

      // Mostrar resultado final
      Swal.fire({
        icon: resultado.okEstructural && resultado.scoreDiseno >= 80 ? 'success' : 
               resultado.scoreDiseno >= 60 ? 'warning' : 'error',
        title: 'Verificación IA Completada',
        html: htmlContent,
        width: '700px',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3085d6',
        customClass: {
          htmlContainer: 'text-left'
        }
      });

      // Log para debugging
  // console.log('🤖 Resultado verificación IA:', resultado);

    } catch (error) {
      console.error('Error en verificación con IA:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        html: `
          <div class="text-left">
            <p>No se pudo completar la verificación con IA:</p>
            <p class="text-sm text-red-600 mt-2">${error.message}</p>
            <br>
            <p class="text-sm text-gray-600">
              Verifica tu conexión a internet y que la clave API esté configurada correctamente.
            </p>
          </div>
        `,
        confirmButtonText: 'Reintentar'
      });
    }
  };

  // Generar proyecto Flutter server-side with payload fallback and client fallback
  const handleGenerateFlutterProject = async () => {
    try {
      if (!nodes.length) {
        Swal.fire({ icon: 'warning', title: 'Diagrama vacío', text: 'No hay clases en el diagrama para generar el proyecto.' });
        return;
      }

      Swal.fire({ title: 'Generando proyecto Flutter (server)...', text: 'Solicitando exportación al backend', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, willOpen: () => Swal.showLoading() });

      const exportUrl = `${import.meta.env.VITE_API_BASE || ''}/apis/crearPagina/exportarFlutter/${boardId}`;
      const resp = await fetch(exportUrl, { method: 'POST', credentials: 'include' });

      if (!resp.ok) {
        console.warn('Backend Flutter export by id failed, status:', resp.status);
        try {
          const altUrl = `${import.meta.env.VITE_API_BASE || ''}/apis/crearPagina/exportarFlutter`;
          const altResp = await fetch(altUrl, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements: nodes, connections: edges }) });
          if (altResp.ok) {
            const altBlob = await altResp.blob();
            const altFileName = `uml-${boardId}-flutter-from-server.zip`;
            const { saveAs } = await import('file-saver');
            saveAs(altBlob, altFileName);
            Swal.close();
            Swal.fire({ icon: 'success', title: '✅ Exportado Flutter desde servidor', html: `<p>Archivo: <strong>${altFileName}</strong></p>` });
            return;
          }
          console.warn('Server export with payload also failed, status:', altResp.status);
        } catch (altErr) {
          console.warn('Alt server export failed:', altErr);
        }

        // Backend failed — fall back to client-side generator (not implemented for Flutter)
        Swal.close();
        Swal.fire({ icon: 'warning', title: 'Exportación en servidor fallida', text: 'No se pudo generar Flutter en el servidor. Por ahora intenta generar el proyecto Spring Boot o usar export por payload.' });
        return;
      }

      const blob = await resp.blob();
      const contentDisposition = resp.headers.get('content-disposition') || '';
      let fileName = '';
      const fileNameMatch = /filename=?"?([^";]+)"?/.exec(contentDisposition);
      if (fileNameMatch) fileName = fileNameMatch[1];
      if (!fileName) fileName = `uml-${boardId}-flutter.zip`;

      const { saveAs } = await import('file-saver');
      saveAs(blob, fileName);
      Swal.close();
      Swal.fire({ icon: 'success', title: '✅ ¡Proyecto Flutter descargado!', html: `<div class="text-left"><p>Archivo descargado: <strong>${fileName}</strong></p></div>`, confirmButtonText: 'Perfecto' });
    } catch (error) {
      console.error('handleGenerateFlutterProject error:', error);
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Error generando proyecto Flutter', text: error.message || String(error) });
    }
  };

  // Función para exportar a XMI (usando buildExportXML)
  const handleExportXMI = async () => {
    try {
      if (!nodes.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Diagrama vacío',
          text: 'No hay clases en el diagrama para exportar.'
        });
        return;
      }

      Swal.fire({
        title: 'Generando XML...',
        text: 'Por favor, espera',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => Swal.showLoading()
      });

      const xmlContent = buildExportXML(nodes, edges);

      const opts = {
        suggestedName: `diagram_${boardId}.xml`,
        types: [
          {
            description: 'XMI Files',
            accept: { 'text/xml': ['.xml'] },
          },
        ],
      };

      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(xmlContent);
      await writable.close();

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: '¡Exportación exitosa!',
        text: 'Archivo XMI guardado correctamente.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error exportando el XMI:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al exportar',
        text: error.message || 'No se pudo exportar el diagrama'
      });
    }
  };
  const handleGenerateCode = async (fullStack = false) => {
    try {
      const code = generateCode(nodes, edges, fullStack);
  
      if (!fullStack) {
        // Descarga solo los modelos en un único archivo .java
        const allModelsCode = code.models.map(m => m.code).join('\n\n');
        const blob = new Blob([allModelsCode], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'models.java';
        a.click();
        return;
      }
  
      // ================ FULL STACK: Generar carpeta con 4 capas en un ZIP ================
      const zip = new JSZip();
  
      // 1) Crear carpeta 'models' y agregar archivos
      const modelsFolder = zip.folder('models');
      code.models.forEach(({ className, code: fileCode }) => {
        const fileName = `${className}.java`;
        modelsFolder.file(fileName, fileCode);
      });
  
      // 2) Crear carpeta 'repositories' y agregar archivos
      const reposFolder = zip.folder('repositories');
      code.repositories.forEach(({ className, code: fileCode }) => {
        const fileName = `${className}Repository.java`;
        reposFolder.file(fileName, fileCode);
      });
  
      // 3) Crear carpeta 'services' y agregar archivos
      const servicesFolder = zip.folder('services');
      code.services.forEach(({ className, code: fileCode }) => {
        const fileName = `${className}Service.java`;
        servicesFolder.file(fileName, fileCode);
      });
  
      // 4) Crear carpeta 'controllers' y agregar archivos
      const controllersFolder = zip.folder('controllers');
      code.controllers.forEach(({ className, code: fileCode }) => {
        const fileName = `${className}Controller.java`;
        controllersFolder.file(fileName, fileCode);
      });
  
      // Finalmente, generamos el zip y lo descargamos
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'spring-boot-project.zip');
  
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error generando código',
        text: error.message
      });
    }
  };

  // Generar colección Postman (v2.1) con endpoints CRUD para cada entidad detectada
  const handleGeneratePostmanCollection = async () => {
    try {
      const validNodes = nodes.filter(node => node.data?.className && node.data.className.trim() !== '');
      if (!validNodes.length) {
        Swal.fire({ icon: 'warning', title: 'Diagrama vacío', text: 'No hay clases para generar la colección Postman.' });
        return;
      }

      const baseUrlVar = '{{baseUrl}}';
      const authVar = '{{authToken}}';

      const collection = {
        info: {
          name: `UML - ${boardId || 'collection'}`,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: [],
        variable: [
          { key: 'baseUrl', value: import.meta.env.VITE_API_BASE || 'http://localhost:3000' },
          { key: 'authToken', value: '' }
        ]
      };

      const sampleValueForType = (type) => {
        if (!type) return '';
        const t = String(type).toLowerCase();
        if (t.includes('string')) return 'example';
        if (t.includes('int') || t.includes('long') || t === 'number') return 1;
        if (t.includes('bool')) return true;
        if (t.includes('date')) return new Date().toISOString();
        return 'example';
      };

      const buildSampleBody = (attributes) => {
        const obj = {};
        if (!attributes || !Array.isArray(attributes)) return obj;
        attributes.forEach(attr => {
          // attr puede ser 'name: type' o un objeto
          if (typeof attr === 'string' && attr.includes(':')) {
            const [rawName, rawType] = attr.split(':').map(s => s.trim());
            const name = rawName.replace(/^[+\-#]/, '').trim();
            obj[name] = sampleValueForType(rawType);
          } else if (typeof attr === 'object' && attr.name) {
            obj[attr.name] = sampleValueForType(attr.type || 'string');
          }
        });
        return obj;
      };

      for (const node of validNodes) {
        const className = node.data.className;
        const path = `api/${className.toLowerCase()}`;
        const attributes = node.data.attributes || [];
        const sampleBody = buildSampleBody(attributes);

        const folder = {
          name: className,
          item: []
        };

        // GET all
        folder.item.push({
          name: `GET ${path}`,
          request: {
            method: 'GET',
            header: [ { key: 'Authorization', value: authVar, disabled: false } ],
            url: { raw: `${baseUrlVar}/${path}`, host: [ baseUrlVar ], path: [ path ] }
          }
        });

        // GET by id
        folder.item.push({
          name: `GET ${path}/{id}`,
          request: {
            method: 'GET',
            header: [ { key: 'Authorization', value: authVar } ],
            url: { raw: `${baseUrlVar}/${path}/{{id}}`, host: [ baseUrlVar ], path: [ path, '{{id}}' ] }
          }
        });

        // POST
        folder.item.push({
          name: `POST ${path}`,
          request: {
            method: 'POST',
            header: [ { key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: authVar } ],
            body: { mode: 'raw', raw: JSON.stringify(sampleBody, null, 2) },
            url: { raw: `${baseUrlVar}/${path}`, host: [ baseUrlVar ], path: [ path ] }
          }
        });

        // PUT
        folder.item.push({
          name: `PUT ${path}/{id}`,
          request: {
            method: 'PUT',
            header: [ { key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: authVar } ],
            body: { mode: 'raw', raw: JSON.stringify(sampleBody, null, 2) },
            url: { raw: `${baseUrlVar}/${path}/{{id}}`, host: [ baseUrlVar ], path: [ path, '{{id}}' ] }
          }
        });

        // DELETE
        folder.item.push({
          name: `DELETE ${path}/{id}`,
          request: {
            method: 'DELETE',
            header: [ { key: 'Authorization', value: authVar } ],
            url: { raw: `${baseUrlVar}/${path}/{{id}}`, host: [ baseUrlVar ], path: [ path, '{{id}}' ] }
          }
        });

        collection.item.push(folder);
      }

      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
      const fileName = `postman-collection-uml-${boardId || 'collection'}.json`;
      saveAs(blob, fileName);
      Swal.fire({ icon: 'success', title: 'Colección Postman descargada', text: `Archivo: ${fileName}` });

    } catch (err) {
      console.error('Error generando colección Postman:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || String(err) });
    }
  };

  // Función para generar proyecto completo Spring Boot
  const handleGenerateCompleteProject = async () => {
    // Try server-side export first (uses saved sala on backend). If that fails, fall back to client-side generator.
    try {
      if (!nodes.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Diagrama vacío',
          text: 'No hay clases en el diagrama para generar el proyecto.'
        });
        return;
      }

      Swal.fire({
        title: 'Generando proyecto completo (server)...',
        text: 'Solicitando exportación al backend',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => Swal.showLoading()
      });

      // Ensure current board is saved on server before requesting export by id
      try {
        const saveAck = await guardarEstado({ nodes, edges });
        // guardarEstado resolves with ack from server when joined; if it returns an object
        // without success or with error, we treat as failure to persist and abort server export.
        if (!saveAck || (saveAck.success === false) || saveAck.error) {
          console.warn('No se confirmó guardado en servidor antes de export:', saveAck);
          Swal.close();
          Swal.fire({
            icon: 'warning',
            title: 'No se pudo guardar en servidor',
            text: 'El diagrama no pudo ser guardado en el servidor. Se intentará generar el proyecto en el cliente.'
          });
          const projectName = `UMLProject_${boardId}`;
          await generateCompleteProject(nodes, edges, projectName);
          return;
        }
      } catch (saveErr) {
        console.warn('guardarEstado error:', saveErr);
        Swal.close();
        Swal.fire({
          icon: 'warning',
          title: 'Error guardando diagrama',
          text: 'No se pudo guardar el diagrama en el servidor. Se intentará generar localmente.'
        });
        const projectName = `UMLProject_${boardId}`;
        await generateCompleteProject(nodes, edges, projectName);
        return;
      }

      // POST to backend endpoint that exports Spring Boot project from sala id
      const exportUrl = `${import.meta.env.VITE_API_BASE || ''}/apis/crearPagina/exportarSpringBoot/${boardId}`;
      const resp = await fetch(exportUrl, {
        method: 'POST',
        credentials: 'include'
      });

      if (!resp.ok) {
        // Server-side export by id failed. Payload-based server export is disabled.
        Swal.close();
        Swal.fire({
          icon: 'warning',
          title: 'Exportación en servidor fallida',
          text: 'La exportación por payload en servidor no está disponible. Se intentará generar el proyecto en el cliente.'
        });
        const projectName = `UMLProject_${boardId}`;
        await generateCompleteProject(nodes, edges, projectName);
        return;
      }

      // Backend responded — expect a zip blob
      const blob = await resp.blob();
      const contentDisposition = resp.headers.get('content-disposition') || '';
      let fileName = '';
      const fileNameMatch = /filename="?([^";]+)"?/.exec(contentDisposition);
      if (fileNameMatch) fileName = fileNameMatch[1];
      if (!fileName) fileName = `uml-${boardId}-springboot.zip`;

      const { saveAs } = await import('file-saver');
      saveAs(blob, fileName);

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: '✅ ¡Proyecto exportado desde servidor!',
        html: `<div class="text-left"><p>Archivo descargado: <strong>${fileName}</strong></p></div>`,
        confirmButtonText: 'Perfecto'
      });

    } catch (error) {
      console.error('handleGenerateCompleteProject error:', error);
      Swal.close();
      // Final fallback to client-side generation
      try {
        Swal.fire({
          icon: 'info',
          title: 'Intentando generación en cliente',
          text: 'La exportación en servidor falló. Se intentará generar el ZIP en el navegador.'
        });
        const projectName = `UMLProject_${boardId}`;
        await generateCompleteProject(nodes, edges, projectName);
      } catch (clientErr) {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error generando proyecto',
          text: clientErr.message || String(clientErr)
        });
      }
    }
  };

  // onConnect para crear aristas por defecto - Versión mejorada
  const onConnect = useCallback(
    (params) => {
      
      // 🔍 DEBUG TEMPORAL: Log completo de onConnect para debug de asociación
      console.debug(`🔗 onConnect llamado con params:`, params);
      
      if (!params.source || !params.target) {
        console.warn('⚠️ Error: source o target faltante', params);
        return;
      }

      // Detectar si es una conexión de nota
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      // 🔍 DEBUG TEMPORAL: Información de nodos involucrados
      console.debug(`   Source node:`, sourceNode?.data);
      console.debug(`   Target node:`, targetNode?.data);
      console.debug(`   Source isConnectionPoint: ${sourceNode?.data?.isConnectionPoint}`);
      console.debug(`   Target isConnectionPoint: ${targetNode?.data?.isConnectionPoint}`);
      
      const isNoteConnection = sourceNode?.data?.isNote || targetNode?.data?.isNote;
      const isAssociationCenterConnection = sourceNode?.data?.isConnectionPoint || targetNode?.data?.isConnectionPoint;



      // Crear edge con datos específicos según si es una nota o relación normal
      const newEdge = {
        id: `edge-${Date.now()}-${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || 'right',
        targetHandle: params.targetHandle || 'left',
        type: 'umlEdge',
        animated: false,
        data: isNoteConnection ? {
          type: 'NoteConnection',
          isNoteConnection: true,
          selected: false
        } : isAssociationCenterConnection ? {
          type: 'AssociationFromCenter',
          startLabel: '',
          endLabel: '',
          label: '',
          sourceRole: '',
          targetRole: '',
          selected: false,
          isFromAssociationCenter: true, // Marcador especial
          _localCreated: true
        } : {
          type: 'Association',
          startLabel: '',
          endLabel: '',
          label: '',
          sourceRole: '',
          targetRole: '',
          selected: false,
          // mark as locally created until server confirms/persists state
          _localCreated: true
        }
      };
      
      // 🔍 DEBUG TEMPORAL: Log del edge recién creado
      console.debug(`📝 Creando nuevo edge:`, newEdge);
      console.debug(`   Tipo detectado: ${isNoteConnection ? 'Nota' : isAssociationCenterConnection ? 'Desde Centro Asociación' : 'Normal'}`);
      if (isAssociationCenterConnection) {
        console.debug(`   ⭐ EDGE CREADO DESDE/HACIA PUNTO DE ASOCIACIÓN - debería originarse visualmente del punto AC`);
      }

      // Debug log: edge being created locally
  // console.debug('BoardPage:onConnect - creating edge', { newEdge, timestamp: Date.now() });

      // Use functional setter to avoid stale-closure races when multiple updates
      setEdges((prevEdges) => {
        const updatedEdges = addEdge(newEdge, prevEdges);
  // console.debug('BoardPage:onConnect - setEdges applied', { prevCount: prevEdges.length, newCount: updatedEdges.length });
        // Emit the updated edges to the server so other clients receive it
        try {
          updateBoardData(updatedEdges, "edges");
        } catch (err) {
          console.warn('onConnect: updateBoardData failed', err);
        }
        return updatedEdges;
      });

      // Auto-seleccionar el edge recién creado para edición
      setTimeout(() => {
        handleEdgeSelection(newEdge);
      }, 100);
    },
    [edges, nodes, setEdges, updateBoardData, handleEdgeSelection]
  );

  // Manejadores de edición...
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInputChangeEdge = useCallback((event) => {
    const { name, value } = event.target;
    setEditingEdge((prev) => ({
      ...prev,
      [name]: value
    }));
  }, [setEditingEdge]);



  const handleArrayChange = (name, value) => {
    setEditingData((prev) => ({
      ...prev,
      [name]: value.split("\n"),
    }));
  };

  // Efecto para actualizar posiciones de puntos de conexión cuando los nodos se mueven
  useEffect(() => {
    const updateConnectionPoints = async () => {
      let hasUpdates = false;
      const updatedNodes = [...nodes];

      // Buscar todos los edges que tienen clases de asociación
      const associationEdges = edges.filter(edge => edge.data?.hasAssociationClass);

      for (const edge of associationEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        const connectionPoint = nodes.find(n => 
          n.data?.isConnectionPoint && 
          edges.some(e => e.target === n.id && e.data?.parentRelationId === edge.id)
        );

        if (sourceNode && targetNode && connectionPoint) {
          // Calcular dimensiones basadas en CSS real
          const calculateRealNodeDimensions = (node) => {
            const nodeWidth = 340;
            const padding = 20;
            const lineHeight = 22.4;
            const titleHeight = 32;
            const sectionTitleHeight = 18;
            const basePadding = 8;
            
            let totalHeight = padding * 2;
            totalHeight += titleHeight;
            
            const attributeCount = node.data?.attributes?.length || 0;
            const methodCount = node.data?.methods?.length || 0;
            
            if (attributeCount > 0) {
              totalHeight += sectionTitleHeight + basePadding;
              totalHeight += attributeCount * lineHeight;
              totalHeight += basePadding;
            }
            
            if (methodCount > 0) {
              totalHeight += sectionTitleHeight + basePadding;
              totalHeight += methodCount * lineHeight;
              totalHeight += basePadding;
            }
            
            totalHeight = Math.max(totalHeight, 100);
            
            return { width: nodeWidth, height: totalHeight };
          };
          
          const sourceDimensions = calculateRealNodeDimensions(sourceNode);
          const targetDimensions = calculateRealNodeDimensions(targetNode);
          
          const sourceX = sourceNode.position.x + sourceDimensions.width;
          const sourceY = sourceNode.position.y + (sourceDimensions.height / 2);
          const targetX = targetNode.position.x;
          const targetY = targetNode.position.y + (targetDimensions.height / 2);
          
          // Usar getSmoothStepPath para obtener labelX y labelY exactos
          const [, labelX, labelY] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition: Position.Right,
            targetX,
            targetY,
            targetPosition: Position.Left,
            borderRadius: 5
          });

          const newMidX = labelX;
          const newMidY = labelY;

          // Verificar si la posición ha cambiado significativamente (más de 1 píxel)
          const currentX = connectionPoint.position.x + 5; // +5 porque restamos 5 al crear
          const currentY = connectionPoint.position.y + 5; // +5 porque restamos 5 al crear

          if (Math.abs(currentX - newMidX) > 1 || Math.abs(currentY - newMidY) > 1) {
            // Actualizar posición del punto de conexión
            const nodeIndex = updatedNodes.findIndex(n => n.id === connectionPoint.id);
            if (nodeIndex !== -1) {
              updatedNodes[nodeIndex] = {
                ...connectionPoint,
                position: { x: newMidX - 5, y: newMidY - 5 }
              };
              hasUpdates = true;
            }
          }
        }
      }

      // Aplicar actualizaciones si hay cambios
      if (hasUpdates) {
        setNodes(updatedNodes);
        await updateBoardData(updatedNodes, edges);
      }
    };

    // Ejecutar actualización con un pequeño delay para evitar demasiadas actualizaciones
    const timeoutId = setTimeout(updateConnectionPoints, 100);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, setNodes, updateBoardData]);

  

  // Función para crear clase de asociación
  const handleCreateAssociationClass = useCallback(async () => {
    if (!selectedEdge) return;

    // Encontrar los nodos source y target
    const sourceNode = nodes.find(node => node.id === selectedEdge.source);
    const targetNode = nodes.find(node => node.id === selectedEdge.target);

    if (!sourceNode || !targetNode) {
      console.error('No se encontraron los nodos de la relación');
      return;
    }

    // 🎯 ESPERAR A OBTENER LAS COORDENADAS REALES DEL EDGE RENDERIZADO
    let realLabelX, realLabelY;
    
    const waitForRealCoordinates = () => {
      return new Promise((resolve) => {
        window.__onAssocEdgeRender = (coords) => {
          if (coords.edgeId === selectedEdge.id) {
            realLabelX = coords.realLabelX;
            realLabelY = coords.realLabelY;

            window.__onAssocEdgeRender = null; // Limpiar
            resolve();
          }
        };
        
        // Forzar re-render del edge
        setEdges(edges => edges.map(e => 
          e.id === selectedEdge.id 
            ? { ...e, data: { ...e.data, hasAssociationClass: true } }
            : e
        ));
        
        // Timeout de seguridad
        setTimeout(() => {
          if (!realLabelX) {
            console.warn('⚠️ Timeout esperando coordenadas reales, usando fallback');
            resolve();
          }
        }, 100);
      });
    };
    
    await waitForRealCoordinates();

    // Calcular dimensiones basadas en CSS real de ClassNode
    const calculateRealNodeDimensions = (node) => {
      // Basado en el CSS actual: width: 340px, padding: 20px
      const nodeWidth = 340;
      const padding = 20;
      const lineHeight = 22.4; // 1.4 * 16px (font-size: 1rem)
      const titleHeight = 32; // font-size: 1.25rem + padding
      const sectionTitleHeight = 18; // font-size: 1.125rem
      const basePadding = 8;
      
      let totalHeight = padding * 2; // Top + bottom padding
      totalHeight += titleHeight; // Title height
      
      const attributeCount = node.data?.attributes?.length || 0;
      const methodCount = node.data?.methods?.length || 0;
      
      // Agregar altura de sección de atributos
      if (attributeCount > 0) {
        totalHeight += sectionTitleHeight + basePadding; // Section title
        totalHeight += attributeCount * lineHeight; // Lines
        totalHeight += basePadding; // Bottom spacing
      }
      
      // Agregar altura de sección de métodos
      if (methodCount > 0) {
        totalHeight += sectionTitleHeight + basePadding; // Section title
        totalHeight += methodCount * lineHeight; // Lines
        totalHeight += basePadding; // Bottom spacing
      }
      
      // Altura mínima
      totalHeight = Math.max(totalHeight, 100);
      
      return { width: nodeWidth, height: totalHeight };
    };
    
    const sourceDimensions = calculateRealNodeDimensions(sourceNode);
    const targetDimensions = calculateRealNodeDimensions(targetNode);
    
    // SIMPLE: Calcular punto medio real entre los centros de los nodos conectados
    const sourceCenterX = sourceNode.position.x + sourceDimensions.width / 2;
    const sourceCenterY = sourceNode.position.y + sourceDimensions.height / 2;
    const targetCenterX = targetNode.position.x + targetDimensions.width / 2;
    const targetCenterY = targetNode.position.y + targetDimensions.height / 2;
    
    // Punto medio exacto donde debe aparecer la clase de asociación
    const labelX = (sourceCenterX + targetCenterX) / 2;
    const labelY = (sourceCenterY + targetCenterY) / 2;
    
    // USAR SIEMPRE el cálculo geométrico preciso en lugar del callback del edge
    // Esto asegura que la línea punteada esté perfectamente centrada
    const midX = labelX;  // Centro geométrico real
    const midY = labelY;  // Centro geométrico real
    

    

    
    // Generar nombre único para la clase de asociación
    const existingAssocClasses = nodes.filter(node => 
      node.data?.className?.startsWith('ClaseAsociacion')
    );
    const newClassName = `ClaseAsociacion${existingAssocClasses.length + 1}`;

    // Crear la nueva clase de asociación CENTRADA sobre el punto medio
    const newAssociationNode = {
      id: `assoc-node-${Date.now()}`,
      position: { x: midX - 170, y: midY - 90 }, // Centrada sobre el punto medio
      type: "classNode",
      data: {
        className: newClassName,
        attributes: ["atributoAsociacion: string"],
        methods: ["operacionAsociacion(): void"],
        isAssociationClass: true,
        associatedEdgeId: selectedEdge.id
      },
    };



    // Crear edge punteado de asociación (hacia el punto AC calculado, no un nodo)
    const associationEdge = {
      id: `assoc-edge-${Date.now()}`,
      source: newAssociationNode.id,
      sourceHandle: 'bottom',
      target: selectedEdge.target, // Conectar al nodo target, pero visualmente será hacia el AC
      targetHandle: 'top-center', // Usar handle válido
      type: 'umlEdge',
      style: {
        strokeDasharray: '5,5',
        stroke: '#dc2626', // Rojo para la conexión de AC
        strokeWidth: 2,
        pointerEvents: 'none'
      },
      data: {
        type: 'AssociationClassConnection',
        isAssociationConnection: true,
        parentRelationId: selectedEdge.id,
        label: '',
        acTargetX: midX, // Coordenadas donde debería terminar visualmente
        acTargetY: midY
      }
    };
    


    // Actualizar el edge original para marcar que tiene clase de asociación
    const updatedSelectedEdge = {
      ...selectedEdge,
      data: {
        ...selectedEdge.data,
        associationClassId: newAssociationNode.id,
        hasAssociationClass: true,
        associationClassNodeId: newAssociationNode.id
      }
    };

    // Actualizar arrays (solo agregar clase de asociación, no relation-center)
    const updatedNodes = [...nodes, newAssociationNode];
    const updatedEdges = [
      ...edges.map(edge => edge.id === selectedEdge.id ? updatedSelectedEdge : edge),
      associationEdge
    ];

    // Aplicar cambios
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    await updateBoardData(updatedNodes, updatedEdges);

  }, [selectedEdge, nodes, edges, setNodes, setEdges, updateBoardData]);

  // Editar/Eliminar tablero (usa endpoints backend: PUT /apis/sala/:id y DELETE /apis/sala/:id)
  

  const handleEditBoard = async () => {
    try {
      // Obtener datos actuales del tablero
      const res = await fetch(`${import.meta.env.VITE_WS_URL || window.location.origin}/apis/sala/${boardId}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const current = Array.isArray(data) && data.length > 0 ? data[0] : (data || {});

      const currentTitle = current.title || current.description || '';
      const currentDescription = current.description || '';

      const { value: formValues } = await Swal.fire({
        title: 'Editar tablero',
        html:
          `<input id="swal-input1" class="swal2-input" placeholder="Nombre del tablero" value="${String(currentTitle).replace(/"/g, '&quot;')}">` +
          `<textarea id="swal-input2" class="swal2-textarea" placeholder="Descripción">${String(currentDescription)}</textarea>`,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
          const title = document.getElementById('swal-input1')?.value || '';
          const description = document.getElementById('swal-input2')?.value || '';
          if (!title.trim()) {
            Swal.showValidationMessage('El nombre del tablero es obligatorio');
            return null;
          }
          return { title, description };
        }
      });

      if (!formValues) return;

      Swal.fire({ title: 'Guardando cambios...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const putRes = await fetch(`${import.meta.env.VITE_WS_URL || window.location.origin}/apis/sala/${boardId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formValues.title, description: formValues.description, updatedAt: new Date() })
      });

      const putResult = await putRes.json().catch(() => ({}));
      Swal.close();
      if (!putRes.ok) {
        Swal.fire({ icon: 'error', title: 'Error', text: putResult.message || 'No se pudo editar el tablero' });
        return;
      }

      Swal.fire({ icon: 'success', title: '¡Tablero actualizado!', timer: 1200, showConfirmButton: false });
      // Opcional: actualizar lista de participantes/metadatos mostrando nuevo titulo
    } catch (err) {
      console.error('handleEditBoard error', err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || String(err) });
    }
  };

  

  return (
  <div className="flex h-[calc(100vh-4rem)]">
    {/* Sidebar a la izquierda */}
    <LeftSidebar
      addNode={addNode}
      selectedNode={selectedNode}
      selectedEdge={selectedEdge}
      editingData={editingData}
      editingEdge={editingEdge}
      handleInputChange={handleInputChange}
      handleArrayChange={handleArrayChange}
      handleInputChangeEdge={handleInputChangeEdge}
      updateNodeData={updateNodeData}
      updateEdgeData={updateEdgeData}
      handleCreateAssociationClass={handleCreateAssociationClass}
      setSelectedEdge={setSelectedEdge}
      setEditingEdge={setEditingEdge}
    />

    {/* Contenido principal a la derecha */}
    <div className="flex-1 flex flex-col">
      {/* Barra superior con botones y usuarios activos */}
      <div className="flex items-center justify-between p-2 bg-white border-b">
        <div className="flex items-center space-x-4">
          {/* Botón de verificación UML con IA */}
          <button
            onClick={handleVerifyDiagramAI}
            className="btn-primary bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-md transition-all duration-200"
          >
            Verificar Diagrama
          </button>

          {/* (Edit/Delete buttons removed) */}
          <button
            onClick={async () => {
              try {
                setSaving(true);
                Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const resp = await guardarEstado({ nodes, edges });
                Swal.close();
                if (resp && resp.success) {
                  setUnsaved(false);
                  Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
                } else {
                  Swal.fire({ icon: 'error', title: 'Error al guardar', text: (resp && resp.error) ? resp.error : 'Sin respuesta del servidor' });
                }
              } catch (err) {
                console.error('Guardar button error', err);
                Swal.fire({ icon: 'error', title: 'Error', text: err.message || String(err) });
              } finally {
                setSaving(false);
              }
            }}
            disabled={!unsaved || saving}
            className={`px-3 py-2 rounded-md flex items-center gap-2 ${!unsaved || saving ? 'bg-gray-300 text-gray-700 cursor-not-allowed' : 'bg-green-600 text-white'}`}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>

          {/* Botón Postman (genera colección Postman para probar la API) */}
          <button
            onClick={() => handleGeneratePostmanCollection()}
            className="btn-secondary bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Postman
          </button>

          {/* Botón de generación Spring Boot */}
          <button
            onClick={() => handleGenerateCompleteProject()}
            className="btn-secondary bg-gradient-to-r from-blue-500 to-sky-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a4 4 0 01-4 4H9a4 4 0 01-4-4m14 0a4 4 0 00-4-4h6a4 4 0 014 4z"
              />
            </svg>
            Spring Boot
          </button>

          {/* Botón de generación Flutter (server-side) */}
          <button
            onClick={() => handleGenerateFlutterProject()}
            className="btn-secondary bg-gradient-to-r from-blue-500 to-sky-600 text-white px-3 py-2 rounded-md flex items-center gap-2"
            title="Exportar proyecto Flutter desde servidor"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="1.5" d="M12 2l3 5-3 5-3-5 3-5zM12 22l3-5-3-5-3 5 3 5z" />
            </svg>
            Flutter
          </button>

          {/* Usuarios activos */}
          <ActiveUsers users={activeUsers} />
          {/* Debug: button to dump recent socket events and current edges */}
          <button
            onClick={() => {
              try {
                const events = typeof getDebugEvents === 'function' ? getDebugEvents() : [];
                // console.debug('BoardPage: Debug events (last):', events);
                // console.debug('BoardPage: Current edges snapshot:', edges);
                // Also show a quick alert count for convenience
                // eslint-disable-next-line no-alert
                alert(`Debug events: ${events.length} • edges: ${edges.length}`);
              } catch (err) {
                console.error('BoardPage: failed to get debug events', err);
              }
            }}
            className="px-2 py-1 text-xs bg-gray-100 rounded border ml-2"
            title="Imprimir eventos de socket recientes en la consola"
          >
            Debug Events
          </button>
        </div>

        {/* Lista de participantes */}
        <div className="flex gap-2">
          {participantes.map((p, idx) => (
            <span
              key={`participante-${idx}`}
              className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* React Flow (Diagrama) */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => handleNodeSelection(node)}
          onEdgeClick={(_, edge) => handleEdgeSelection(edge)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode="loose"
          isValidConnection={(connection) => {
            // Permitir TODAS las conexiones, incluyendo conexiones recursivas (mismo nodo)
            // Solo validar que no sea una conexión inválida (sin source o target)
            return connection.source && connection.target;
          }}
          fitView
          className="bg-gray-50"
        >
          <Background color="#e0e7ff" gap={20} />
          <Controls className="bg-white shadow-md" />

        </ReactFlow>
      </div>
      
      {/* Burbuja de herramientas */}
      <AiBubble
        boardId={boardId}
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        updateBoardData={updateBoardData}
        onAiModificationChange={setAiModificationActive}
      />

      <BurbujaHerramientasDiagrama
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        selectedNodeIds={selectedNode ? [selectedNode.id] : []}
        selectedEdgeIds={selectedEdge ? [selectedEdge.id] : []}
        boardId={boardId}
        updateBoardData={updateBoardData}
        userEmail={currentUser?.email}
      />

  {/* Debug panel removed */}
    </div>
  </div>
);

};

// Wrapper con provider
export default function BoardPageWrapper() {
  return (
    <ReactFlowProvider>
      <BoardPage />
    </ReactFlowProvider>
  );
}
