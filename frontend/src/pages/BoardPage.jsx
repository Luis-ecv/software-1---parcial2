// BoardPage.jsx
import { useCallback, useEffect } from "react";
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
import { useState } from 'react';
import useSocketFlow from '../config/useSocketFlow';
import LeftSidebar from "../components/control/Sidebar"; 
import Swal from 'sweetalert2';
import { buildExportXML } from '../utils/myCustomXmlFunctions';
import { generateCode } from '../utils/codeGenerator';
import { generateCompleteProject } from '../utils/completeProjectGenerator';
import { verifyUMLDiagramWithAI, validateAICredentials } from '../utils/aiUMLValidator';
import BurbujaHerramientasDiagrama from '../components/BurbujaHerramientasDiagrama';
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
        const res = await fetch(`${import.meta.env.VITE_WS_URL || window.location.origin}/apis`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setCurrentUser({ id: data.id, name: data.name, email: data.email });
          return;
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
    setNodes,
    setEdges
  } = useSocketFlow(boardId, currentUser);

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
      console.log('🤖 Resultado verificación IA:', resultado);

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

  // Función para generar proyecto completo Spring Boot
  const handleGenerateCompleteProject = async () => {
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
        title: 'Generando proyecto completo...',
        text: 'Creando proyecto Spring Boot con Maven',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => Swal.showLoading()
      });

      const projectName = `UMLProject_${boardId}`;
      const result = await generateCompleteProject(nodes, edges, projectName);

      Swal.close();

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: '✅ ¡Proyecto generado exitosamente!',
          html: `
            <div class="text-left">
              <p><strong>📦 Archivo:</strong> ${result.fileName}</p>
              <p><strong>📊 Entidades:</strong> ${result.entities}</p>
              <p><strong>📁 Archivos totales:</strong> ${result.files}</p>
              <p><strong>☕ Java:</strong> ${result.details.javaVersion}</p>
              <p><strong>🚀 Spring Boot:</strong> ${result.details.springBootVersion}</p>
              <p><strong>🗄️ Base de datos:</strong> ${result.details.database}</p>
            </div>
          `,
          confirmButtonText: 'Excelente'
        });
      }

    } catch (error) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error generando proyecto',
        text: error.message
      });
    }
  };

  // onConnect para crear aristas por defecto - Versión mejorada
  const onConnect = useCallback(
    (params) => {

      
      if (!params.source || !params.target) {
        console.warn('⚠️ Error: source o target faltante', params);
        return;
      }

      // Detectar si es una conexión de nota
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      const isNoteConnection = sourceNode?.data?.isNote || targetNode?.data?.isNote;



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
        } : {
          type: 'Association',
          startLabel: '',
          endLabel: '',
          label: '',
          sourceRole: '',
          targetRole: '',
          selected: false
        }
      };

      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      updateBoardData(updatedEdges, "edges");

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
    
    // Usar las coordenadas exactas del label (donde aparece "AC")
    const midX = labelX;
    const midY = labelY;
    
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

    // Crear un nodo punto visible en el centro de la relación
    const relationCenterNode = {
      id: `relation-center-${Date.now()}`,
      position: { x: midX - 5, y: midY - 5 },
      type: "classNode",
      data: {
        className: '',
        attributes: [],
        methods: [],
        isConnectionPoint: true
      },
    };

    // Crear edge punteado de asociación
    const associationEdge = {
      id: `assoc-edge-${Date.now()}`,
      source: newAssociationNode.id,
      sourceHandle: 'bottom',
      target: relationCenterNode.id,
      targetHandle: 'connection-point',
      type: 'umlEdge',
      style: {
        strokeDasharray: '5,5',
        stroke: '#ff0000', // Rojo para debugging
        strokeWidth: 3,    // Más grueso para debugging
        pointerEvents: 'none'
      },
      data: {
        type: 'AssociationClassConnection',
        isAssociationConnection: true,
        parentRelationId: selectedEdge.id,
        label: ''
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

    // Actualizar arrays
    const updatedNodes = [...nodes, newAssociationNode, relationCenterNode];
    const updatedEdges = [
      ...edges.map(edge => edge.id === selectedEdge.id ? updatedSelectedEdge : edge),
      associationEdge
    ];

    // Aplicar cambios
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    await updateBoardData(updatedNodes, updatedEdges);

  }, [selectedEdge, nodes, edges, setNodes, setEdges, updateBoardData]);

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
            className="btn-primary bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-md hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            Verificar Diagrama
          </button>

          {/* Botón de generación Full Stack */}
          <button
            onClick={() => handleGenerateCode(true)}
            className="btn-secondary bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:from-purple-700 hover:to-indigo-700"
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
            Full Stack
          </button>

          {/* Botón de generación Full Stack Completo */}
          <button
            onClick={() => handleGenerateCompleteProject()}
            className="btn-secondary bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:from-green-700 hover:to-teal-700"
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
            Full Stack C
          </button>

          {/* Usuarios activos */}
          <ActiveUsers users={activeUsers} />
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
