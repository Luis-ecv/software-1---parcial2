import React, { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getBezierPath, Position, useReactFlow } from '@xyflow/react';

// Función para calcular la posición de las etiquetas de cardinalidad según el handle
const getCardinalityPosition = (x, y, position, type) => {
  const offset = 30; // Distancia de separación de la etiqueta
  
  switch (position) {
    case Position.Top:
      return {
        x: x + (type === 'start' ? -15 : 15), // Offset horizontal para evitar superposición
        y: y - offset
      };
    case Position.Bottom:
      return {
        x: x + (type === 'start' ? -15 : 15), // Offset horizontal para evitar superposición
        y: y + offset
      };
    case Position.Left:
      return {
        x: x - offset,
        y: y + (type === 'start' ? -10 : 10) // Offset vertical para evitar superposición
      };
    case Position.Right:
    default:
      return {
        x: x + offset,
        y: y + (type === 'start' ? -10 : 10) // Offset vertical para evitar superposición
      };
  }
};

const UML_RELATIONSHIP_TYPES = {
  Association: {
    markerStart: 'none',
    markerEnd: 'none',
    strokeStyle: 'solid',
    stroke: '#000000'
  },
  Aggregation: {
    markerStart: 'none',
    markerEnd: 'diamond',
    strokeStyle: 'solid',
    stroke: '#1976d2'
  },
  Composition: {
    markerStart: 'none',
    markerEnd: 'diamond-filled',
    strokeStyle: 'solid',
    stroke: '#d32f2f'
  },
  Generalization: {
    markerStart: 'none',
    markerEnd: 'generalization',
    strokeStyle: 'solid',
    stroke: '#000000'
  },
  Implementation: {
    markerStart: 'none',
    markerEnd: 'generalization',
    strokeStyle: 'dashed',
    stroke: '#000000'
  },
  Dependency: {
    markerStart: 'none',
    markerEnd: 'arrow',
    strokeStyle: 'dashed',
    stroke: '#666666'
  },
  NoteConnection: {
    markerStart: 'none',
    markerEnd: 'none',
    strokeStyle: 'dashed',
    stroke: '#fbbf24' // Color amarillo para conexiones de notas
  }
};

const UmlEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {}
}) => {
  // Acceso a React Flow para obtener nodos y edges actuales
  const { getNodes, getEdges } = useReactFlow();
  
  // Estado para forzar re-render de líneas punteadas
  const [forceRender, setForceRender] = useState(0);
  
  // Sistema de callback para forzar re-render cuando el edge padre cambia
  React.useEffect(() => {
    if (data?.isAssociationConnection && data?.parentRelationId) {
      const forceUpdate = (parentEdgeId) => {
        if (parentEdgeId === data.parentRelationId) {
          setForceRender(prev => prev + 1);

        }
      };
      
      window.__forceAssocLineUpdate = forceUpdate;
      
      return () => {
        if (window.__forceAssocLineUpdate === forceUpdate) {
          window.__forceAssocLineUpdate = null;
        }
      };
    }
  }, [data?.isAssociationConnection, data?.parentRelationId, id]);
  
  // Detectar si es una conexión recursiva (mismo nodo).
  // Preferir comparar los ids de nodo (source === target). Como fallback,
  // comparar coordenadas (por compatibilidad con versiones antiguas).
  const isRecursive = (typeof source !== 'undefined' && typeof target !== 'undefined')
    ? source === target
    : (sourceX === targetX && sourceY === targetY);
  
  // Usar puntos de control personalizados si están definidos en data
  const customControlPoints = data?.controlPoints || [];
  const hasCustomPath = customControlPoints.length > 0;
  
  // Ensure data is defined and get edge type flags early
  data = data || {};
  const isAssociationConnection = data?.isAssociationConnection || false;
  const isNoteConnection = data?.isNoteConnection || false;
  
  let edgePath, labelX, labelY;
  
  // 🎯 MODIFICACIÓN PARA ASSOCIATION CLASS: Forzar path a través del punto AC
  if (data?.hasAssociationClass && !isAssociationConnection && !isNoteConnection) {
    // Para edges con clase de asociación, usar Bézier que pase por el punto AC
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    
    // Crear Bézier path que pase por el punto medio (donde está el AC)
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.1 // Curvatura menor para que pase más cerca del AC
    });
    
    // Forzar que el label esté en el punto medio calculado
    labelX = midX;
    labelY = midY - 10; // Slightly above for better visibility
    

  } else if (hasCustomPath && !isRecursive) {
    // Usar Bézier path con puntos de control personalizados
    const controlX = customControlPoints[0]?.x || (sourceX + targetX) / 2;
    const controlY = customControlPoints[0]?.y || (sourceY + targetY) / 2;
    
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.25
    });
  } else {
    // Usar smooth step path normal
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: isRecursive ? 25 : 5,
      offset: isRecursive ? 50 : 20
    });
  }

  if (!edgePath) return null;
  
  // 🔍 DEBUG TEMPORAL: Log de coordenadas del edge para debug de asociación
  if (data?.hasAssociationClass || data?.isAssociationConnection) {
  
    
    // 🎯 COMUNICAR COORDENADAS REALES AL BOARDPAGE Y A LÍNEAS PUNTEADAS
    if (data?.hasAssociationClass && window.__onAssocEdgeRender) {
      window.__onAssocEdgeRender({
        edgeId: id,
        realLabelX: labelX,
        realLabelY: labelY,
        sourceX,
        sourceY,
        targetX,
        targetY
      });
    }
    
    // 🔄 SISTEMA DE COORDENADAS COMPARTIDAS para líneas punteadas
    if (data?.hasAssociationClass) {
      if (!window.__acCoordinates) window.__acCoordinates = {};
      
      // Detectar si las coordenadas han cambiado
      const prevCoords = window.__acCoordinates[id];
      const coordsChanged = !prevCoords || 
        Math.abs(prevCoords.acX - labelX) > 0.1 || 
        Math.abs(prevCoords.acY - labelY) > 0.1;
      
      window.__acCoordinates[id] = {
        acX: labelX,
        acY: labelY,
        timestamp: Date.now(),
        version: (prevCoords?.version || 0) + (coordsChanged ? 1 : 0)
      };
      
      // Forzar invalidación de líneas punteadas cuando las coordenadas cambian
      if (coordsChanged && window.__forceAssocLineUpdate) {
        window.__forceAssocLineUpdate(id);
      }
      

    }
  }
  
  // Resolve relationship type case-insensitively and default to Association
  const requestedRel = data.type || data.relation || 'Association';
  let edgeType = UML_RELATIONSHIP_TYPES['Association'];
  try {
    const matchKey = Object.keys(UML_RELATIONSHIP_TYPES).find(k => k.toLowerCase() === String(requestedRel).toLowerCase());
    if (matchKey) edgeType = UML_RELATIONSHIP_TYPES[matchKey];
  } catch (e) {
    edgeType = UML_RELATIONSHIP_TYPES['Association'];
  }
  const isSelected = data?.selected || false;
  
  // Estilos especiales para conexiones de clase de asociación
  if (isAssociationConnection) {
  
    
    // Si tiene coordenadas AC target específicas, renderizar hacia esas coordenadas
    let finalPath = edgePath;
    let finalLabelX = labelX;
    let finalLabelY = labelY;
    
    // 🎯 COORDENADAS DINÁMICAS PRECISAS desde el edge original
    if (data?.parentRelationId) {
      // Obtener coordenadas exactas del edge original desde el sistema compartido
      // El forceRender garantiza que siempre leemos las coordenadas más actuales
      const originalCoords = window.__acCoordinates?.[data.parentRelationId];
      
      if (originalCoords && originalCoords.acX !== undefined && originalCoords.acY !== undefined) {
        // Usar las coordenadas EXACTAS del edge original (máxima precisión)
        [finalPath, finalLabelX, finalLabelY] = getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX: originalCoords.acX,
          targetY: originalCoords.acY,
          targetPosition: Position.Top,
          borderRadius: 5,
          offset: 10
        });
        

      } else {
        // Fallback: coordenadas estáticas
        if (data?.acTargetX && data?.acTargetY) {
          [finalPath, finalLabelX, finalLabelY] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX: data.acTargetX,
            targetY: data.acTargetY,
            targetPosition: Position.Top,
            borderRadius: 5,
            offset: 10
          });
          

        }
      }
    }
    
    const associationStyle = {
      ...style,
      stroke: '#dc2626',
      strokeWidth: 2,
      strokeDasharray: '8,4',
      pointerEvents: 'none',
      opacity: 1,
      zIndex: 1000
    };

    return (
      <>
        <BaseEdge
          id={id}
          path={finalPath}
          style={associationStyle}
          markerEnd="none"
          markerStart="none"
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              background: '#dc2626',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              transform: `translate(-50%, -50%) translate(${finalLabelX}px,${finalLabelY}px)`,
              pointerEvents: 'none',
              zIndex: 1001
            }}
          >
            AC-LINK
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
  
  // Estilos especiales para conexiones de notas
  if (isNoteConnection) {
    const noteStyle = {
      ...style,
      stroke: '#fbbf24', // Amarillo para conexiones de notas
      strokeWidth: 1.5,
      strokeDasharray: '4,4', // Línea punteada ligera
      pointerEvents: 'none',
      opacity: 0.8
    };
    
    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={noteStyle}
          markerEnd="none"
          markerStart="none"
        />
      </>
    );
  }
  
  // Estilos mejorados con feedback visual para relaciones normales
  const edgeStyle = {
    ...style,
    stroke: isSelected ? '#dc2626' : edgeType.stroke, // Rojo cuando está seleccionado
    strokeWidth: isSelected ? 3 : 2, // Más grueso cuando está seleccionado
    strokeDasharray: edgeType.strokeStyle === 'dashed' ? '5,5' : 'none',
    cursor: 'pointer',
    filter: isSelected 
      ? 'drop-shadow(0 2px 6px rgb(220 38 38 / 0.4))' 
      : 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))'
  };

  // Estilos para el área de click invisible
  const clickAreaStyle = {
    stroke: 'transparent',
    strokeWidth: 12, // Área grande para facilitar el click
    fill: 'none',
    cursor: 'pointer'
  };

  return (
    <>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          refX="10"
          refY="6"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill="currentColor" />
        </marker>

        <marker
          id="generalization"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          refX="11"
          refY="6"
        >
          <path d="M 0 0 L 12 6 L 0 12 L 0 0" fill="white" stroke="currentColor" />
        </marker>

        <marker
          id="diamond"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          refX="11"
          refY="6"
        >
          <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="white" stroke="currentColor" />
        </marker>

        <marker
          id="diamond-filled"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          refX="11"
          refY="6"
        >
          <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="currentColor" />
        </marker>
      </defs>

      {/* Área invisible para facilitar el click */}
      <path
        d={edgePath}
        style={clickAreaStyle}
        className="react-flow__edge-interaction"
      />
      
      {/* Edge visual principal */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={edgeType.markerEnd ? `url(#${edgeType.markerEnd})` : undefined}
        markerStart={edgeType.markerStart ? `url(#${edgeType.markerStart})` : undefined}
      />

      {/* Indicador de clase de asociación */}
      {data?.hasAssociationClass && (
        <>
          <circle
            cx={labelX}
            cy={labelY}
            r="4"
            fill="#3b82f6"
            stroke="white"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.3))' }}
          />
          <text
            x={labelX}
            y={labelY - 12}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill="#3b82f6"
            style={{ filter: 'drop-shadow(0 1px 1px rgb(255 255 255 / 0.8))' }}
          >
            AC
          </text>
        </>
      )}

      <EdgeLabelRenderer>
        {/* Etiqueta general (data.label), si la quisieras en medio */}
        {data?.label && (
          <div
            style={{
              position: 'absolute',
              background: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid rgba(0,0,0,0.1)',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 20}px)`
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        )}

        {/* Indicador visual para clase de asociación */}
        {data?.hasAssociationClass && (
          <div
            style={{
              position: 'absolute',
              background: '#3b82f6',
              color: 'white',
              padding: '1px 4px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 'bold',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 15}px)`
            }}
            className="nodrag nopan"
            title="Esta relación tiene una clase de asociación"
          >
            AC
          </div>
        )}

        {/* Cardinalidad inicio */}
        {data?.startLabel && (
          <div
            style={{
              position: 'absolute',
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '3px 6px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              border: '2px solid #3b82f6',
              color: '#1e40af',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transform: `translate(-50%, -50%) translate(${getCardinalityPosition(sourceX, sourceY, sourcePosition, 'start').x}px,${getCardinalityPosition(sourceX, sourceY, sourcePosition, 'start').y}px)`,
              zIndex: 1000
            }}
            className="nodrag nopan"
            title={`Cardinalidad inicio: ${data.startLabel}`}
          >
            {data.startLabel}
          </div>
        )}

        {/* Cardinalidad final */}
        {data?.endLabel && (
          <div
            style={{
              position: 'absolute',
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '3px 6px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              border: '2px solid #10b981',
              color: '#059669',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transform: `translate(-50%, -50%) translate(${getCardinalityPosition(targetX, targetY, targetPosition, 'end').x}px,${getCardinalityPosition(targetX, targetY, targetPosition, 'end').y}px)`,
              zIndex: 1000
            }}
            className="nodrag nopan"
            title={`Cardinalidad final: ${data.endLabel}`}
          >
            {data.endLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(UmlEdge);
