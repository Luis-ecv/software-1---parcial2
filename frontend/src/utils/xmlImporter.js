export const processXml = (xmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
    // Procesar nodos (clases UML)
    const nodes = Array.from(xmlDoc.querySelectorAll('packagedElement[xmi\\:type="uml:Class"]')).map((cls, index) => {
      // Preferir el identificador XMI original si está presente (xmi:id).
      // Esto permite mapear correctamente las relaciones (memberEnd) a los nodos.
      const xmlId = cls.getAttribute('xmi:id') || cls.getAttribute('id') || `${Date.now()}-${index}`;
      const id = `node-${xmlId}`; // Usar xmlId para generar un id consistente y reproducible
      const className = cls.getAttribute("name") || `Clase${index + 1}`;
  
      // Procesar atributos
      const attributes = Array.from(cls.getElementsByTagName("ownedAttribute")).map((attr) => {
        const name = attr.getAttribute("name") || "atributo";
        const type = attr.getAttribute("type") || "string";
        return `+ ${name}: ${type}`;
      });
  
      // Procesar métodos
      const methods = Array.from(cls.getElementsByTagName("ownedOperation")).map((op) => {
        const name = op.getAttribute("name") || "metodo";
        const returnType = op.getAttribute("type") || "void";
        return `+ ${name}(): ${returnType}`;
      });
  
      return {
        id,
        type: "classNode",
        position: {
          x: 100 + index * 200, // Posición básica, ajustable
          y: 100 + index * 150,
        },
        data: {
          className,
          attributes,
          methods,
        },
      };
    });
  
    // Procesar relaciones (aristas UML)
    const edges = Array.from(xmlDoc.querySelectorAll('packagedElement[xmi\\:type="uml:Association"]')).map((assoc, index) => {
      // memberEnd references xmi:id de los elementos participantes
      const memberEnds = Array.from(assoc.getElementsByTagName('memberEnd')).map(end => end.getAttribute('xmi:id') || end.getAttribute('id'));

      // Mapear los memberEnd al id generado en nodes: `node-${xmlId}`
      const mapped = memberEnds.map(meId => meId ? `node-${meId}` : null).filter(Boolean);

      if (mapped.length < 2) return null;

      const [sourceId, targetId] = mapped;

      return {
        id: `edge-${Date.now()}-${index}`,
        source: sourceId,
        target: targetId,
        type: "umlEdge",
        data: {
          type: "Association",
          startLabel: "1",
          endLabel: "1",
        },
      };
    }).filter(Boolean); // Eliminar nulos
  
    return { nodes, edges };
  };
  