export const processXml = (xmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
    // Procesar nodos (clases UML)
    const nodes = Array.from(xmlDoc.querySelectorAll('packagedElement[xmi\\:type="uml:Class"]')).map((cls, index) => {
      const id = `node-${Date.now()}-${index}`; // Generar un ID único
      const className = cls.getAttribute("name");
  
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
      const [sourceId, targetId] = Array.from(assoc.getElementsByTagName("memberEnd")).map((end) =>
        nodes.find((node) => node.id.includes(end.getAttribute("xmi:id")))?.id
      );
  
      if (!sourceId || !targetId) return null;
  
      return {
        id: `edge-${index}`,
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
  