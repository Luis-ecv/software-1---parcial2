// ClassNode.jsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import '../../../src/index.css';

function ClassNode({ data, isConnectable }) {
  // Opcional: parsear cada atributo si viene con un separador. 
  // Por ejemplo, si guardas "private edad: int", no hace falta transformarlo.
  // Pero si guardas "edad,int,private" tendrías que formatearlo aquí.

  // Si es un punto de conexión, renderizar un punto visible para debug
  if (data?.isConnectionPoint) {
    return (
      <div style={{ 
        width: 12, 
        height: 12, 
        background: '#3b82f6', // Azul más visible
        borderRadius: '50%',
        border: '2px solid #ffffff',
        position: 'relative',
        zIndex: 1001,
        boxShadow: '0 0 6px rgba(59, 130, 246, 0.8)'
      }}>
        <Handle
          type="target"
          position={Position.Top}
          id="connection-point"
          isConnectable={isConnectable}
          style={{ 
            opacity: 1, // Hacerlo visible
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            background: '#3b82f6',
            border: '2px solid #fff'
          }}
        />
      </div>
    );
  }

  return (
    <div className="class-node" style={{ minWidth: 160 }}>
      {/* Handles para clases normales - Múltiples puntos de conexión */}
      {!data?.isAssociationClass && (
        <>
          {/* HANDLES BIDIRECCIONALES - Lado Derecho (VERDE) */}
          <Handle
            type="source"
            position={Position.Right}
            id="right-top"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '25%',
              width: '18px',
              height: '18px',
              border: '3px solid #10b981',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right-center"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '50%',
              width: '18px',
              height: '18px',
              border: '3px solid #10b981',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right-bottom"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '75%',
              width: '18px',
              height: '18px',
              border: '3px solid #10b981',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          
          {/* HANDLES BIDIRECCIONALES - Lado Izquierdo (AZUL) */}
          <Handle
            type="source"
            position={Position.Left}
            id="left-top"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '25%',
              width: '18px',
              height: '18px',
              border: '3px solid #3b82f6',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left-center"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '50%',
              width: '18px',
              height: '18px',
              border: '3px solid #3b82f6',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left-bottom"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              top: '75%',
              width: '18px',
              height: '18px',
              border: '3px solid #3b82f6',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />

          {/* HANDLES BIDIRECCIONALES - Superior e Inferior */}
          <Handle
            type="source"
            position={Position.Top}
            id="top-center"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              left: '50%',
              width: '18px',
              height: '18px',
              border: '3px solid #f59e0b',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom-center"
            isConnectable={isConnectable}
            className="handle"
            style={{ 
              left: '50%',
              width: '18px',
              height: '18px',
              border: '3px solid #ef4444',
              background: '#ffffff',
              borderRadius: '50%',
              cursor: 'crosshair'
            }}
          />


        </>
      )}

      {/* Handle especial para clases de asociación (parte inferior) */}
      {data?.isAssociationClass && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={isConnectable}
          className="handle"
          style={{ 
            bottom: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '18px',
            height: '18px',
            border: '3px solid #dc2626', // Rojo para debugging
            background: '#ffffff',
            borderRadius: '50%',
            cursor: 'crosshair',
            zIndex: 1000
          }}
        />
      )}

      {/* Nombre de la clase */}
      <div className="class-name">
        <strong>{data.className || "ClaseSinNombre"}</strong>
      </div>

      {/* Atributos */}
      {data.attributes && data.attributes.length > 0 && (
        <div className="class-attributes">
          <h4>Atributos:</h4>
          <ul>
            {data.attributes.map((attr, idx) => (
              <li key={idx}>{attr}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Métodos */}
      {data.methods && data.methods.length > 0 && (
        <div className="class-methods">
          <h4>Métodos:</h4>
          <ul>
            {data.methods.map((method, idx) => (
              <li key={idx}>{method}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ClassNode;
