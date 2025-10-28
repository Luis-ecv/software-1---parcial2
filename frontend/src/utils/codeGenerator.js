// Función para generar código basado en el diagrama
// generateCode.js

  export const generateCode = (nodes, edges, generateFullStack = false) => {
    try {
      // Filtrar nodos válidos para generación de código (excluir nodos de sistema)
      const validNodes = nodes.filter(node => {
        // Excluir puntos de conexión de clases de asociación
        if (node.data?.isConnectionPoint) return false;
        
        // Excluir notas (comentarios)
        if (node.data?.isNote) return false;
        
        // Incluir solo nodos con className válido
        return node.data?.className && node.data.className.trim() !== '';
      });
      
      // Validar que tengamos nodos válidos
      if (validNodes.length === 0) {
        throw new Error('No hay clases válidas para generar código. Asegúrate de que tus clases tengan nombres válidos.');
      }

      // 1) Generamos los modelos y guardamos { className, code }
      const models = validNodes.map((node) => {
        const code = generateEntityClass(node, edges, validNodes);
        return { className: node.data.className, code };
      });

      if (!generateFullStack) {
        // Solo modelado de entidades (JPA)
        return {
          models, // [{ className: 'X', code: '...' }, ...]
          type: 'models-only',
        };
      }

      // 2) Generamos Repos, Services y Controllers
      const repositories = validNodes.map((node) => {
        const code = generateRepository(node);
        return { className: node.data.className, code };
      });

      const services = validNodes.map((node) => {
        const code = generateService(node);
        return { className: node.data.className, code };
      });

      const controllers = validNodes.map((node) => {
        const code = generateController(node);
        return { className: node.data.className, code };
      });

      return {
        models,
        repositories,
        services,
        controllers,
        type: 'full-stack'
      };
    } catch (error) {
      console.error("Error generando código:", error);
      throw error;
    }
  };

  // Generar clase de entidad con JPA
  const generateEntityClass = (node, edges) => {
    const className = node.data.className;
    const relations = getRelations(node.id, edges);
    
    return `
  import jakarta.persistence.*;
  import lombok.Data;
  import java.time.LocalDateTime;
  import java.util.List;
  
  @Entity
  @Table(name = "${className.toLowerCase()}")
  @Data
  public class ${className} {
      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;
  
      ${generateFields(node.data.attributes)}
      ${generateRelations(relations)}
  }`;
  };
  
  // Generar repositorio
  const generateRepository = (node) => {
    const className = node.data.className;
    return `
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.stereotype.Repository;
  
  @Repository
  public interface ${className}Repository extends JpaRepository<${className}, Long> {
  }`;
  };
  
  // Generar servicio
  const generateService = (node) => {
    const className = node.data.className;
    return `
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.stereotype.Service;
  import java.util.List;
  import java.util.Optional;
  
  @Service
  public class ${className}Service {
      @Autowired
      private ${className}Repository repository;
  
      public List<${className}> findAll() {
          return repository.findAll();
      }
  
      public Optional<${className}> findById(Long id) {
          return repository.findById(id);
      }
  
      public ${className} save(${className} ${className.toLowerCase()}) {
          return repository.save(${className.toLowerCase()});
      }
  
      public void deleteById(Long id) {
          repository.deleteById(id);
      }
  }`;
  };
  
  // Generar controlador
  const generateController = (node) => {
    const className = node.data.className;
    const path = className.toLowerCase();
    
    return `
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.*;
  import java.util.List;
  
  @RestController
  @RequestMapping("/api/${path}")
  public class ${className}Controller {
      @Autowired
      private ${className}Service service;
  
      @GetMapping
      public List<${className}> getAll() {
          return service.findAll();
      }
  
      @GetMapping("/{id}")
      public ResponseEntity<${className}> getById(@PathVariable Long id) {
          return service.findById(id)
                  .map(ResponseEntity::ok)
                  .orElse(ResponseEntity.notFound().build());
      }
  
      @PostMapping
      public ${className} create(@RequestBody ${className} ${className.toLowerCase()}) {
          return service.save(${className.toLowerCase()});
      }
  
      @PutMapping("/{id}")
      public ResponseEntity<${className}> update(@PathVariable Long id, @RequestBody ${className} ${className.toLowerCase()}) {
          return service.findById(id)
                  .map(existing -> {
                      ${className.toLowerCase()}.setId(id);
                      return ResponseEntity.ok(service.save(${className.toLowerCase()}));
                  })
                  .orElse(ResponseEntity.notFound().build());
      }
  
      @DeleteMapping("/{id}")
      public ResponseEntity<?> delete(@PathVariable Long id) {
          return service.findById(id)
                  .map(existing -> {
                      service.deleteById(id);
                      return ResponseEntity.ok().build();
                  })
                  .orElse(ResponseEntity.notFound().build());
      }
  }`;
  };
  
  // Funciones auxiliares
  const generateFields = (attributes) => {
    if (!attributes || !Array.isArray(attributes)) {
      return '// No attributes defined';
    }
    
    return attributes
      .filter(attr => attr && typeof attr === 'string' && attr.includes(':'))
      .map(attr => {
        const [name, type] = attr.split(':').map(s => s.trim());
        if (!name || !type) return '';
        const cleanName = name.replace(/[+-]/, '');
        return `@Column\nprivate ${mapJavaType(type)} ${cleanName};`;
      })
      .filter(field => field.length > 0)
      .join('\n\n    ');
  };
  
  const generateRelations = (relations) => {
    return relations
      .filter(relation => relation && relation.type) // Filtra relaciones inválidas
      .map(relation => {
        switch (relation.type) {
          case 'OneToMany': {
            const mappedBy = relation.mappedBy || 'parent';
            return `
        @OneToMany(mappedBy = "${mappedBy.toLowerCase()}") 
        private List<${relation.targetClass}> ${relation.field};`;
          }
          case 'ManyToOne': {
            const fieldName = relation.field || 'parent';
            return `
        @ManyToOne
        @JoinColumn(name = "${fieldName}_id")
        private ${relation.targetClass} ${fieldName};`;
          }
          default:
            return '';
        }
      })
      .join('\n');
  };
  
  const mapJavaType = (type) => {
    if (!type || typeof type !== 'string') {
      return 'Object'; // Tipo por defecto si type es undefined o inválido
    }
    
    const typeMap = {
      'string': 'String',
      'int': 'Integer',
      'long': 'Long',
      'boolean': 'Boolean',
      'date': 'LocalDateTime',
      // Añadir más mappings según sea necesario
    };
    return typeMap[type.toLowerCase()] || type;
  };
  
  const getRelations = (nodeId, edges) => {
    return edges
      .filter(edge => edge.source === nodeId || edge.target === nodeId)
      .map(edge => {
        const isSource = edge.source === nodeId;
        const targetNodeId = isSource ? edge.target : edge.source;
  
        return {
          type: edge.data?.type || 'Association', // Usa el tipo definido en la arista
          mappedBy: isSource ? edge.data?.targetRole : edge.data?.sourceRole,
          targetClass: targetNodeId, // Esto debe mapearse al nombre de la clase target
          field: isSource
            ? edge.data?.targetRole || `related${targetNodeId}`
            : edge.data?.sourceRole || `related${targetNodeId}`,
        };
      });
      // 1) Helper que decide la relación JPA a partir de 'startLabel', 'endLabel', y 'type'
function determineRelationshipType(edgeData) {
  const { type, startLabel, endLabel } = edgeData;
  if (type === "Generalization" || type === "Implementation") {
    return type; // luego lo tratas en generateEntityClass
  }

  const parseCard = (label) => {
    if (!label || label === '1') return [1,1];
    if (label.includes('*')) return [0,'*'];
    if (label === '0..1') return [0,1];
    const numeric = parseInt(label, 10);
    if (!isNaN(numeric)) return [numeric, numeric];
    return [1,1];
  };

  const [startMin, startMax] = parseCard(startLabel);
  const [endMin, endMax] = parseCard(endLabel);

  if (startMax === '*' && endMax === '*') return 'ManyToMany';
  if (startMax === '*' && endMax === 1) return 'ManyToOne';
  if (startMax === 1 && endMax === '*') return 'OneToMany';
  if (startMax === 1 && endMax === 1) return 'OneToOne';

  return 'Association';
}

// 2) getRelations con la lógica anterior
function getRelations(nodeId, allNodes, allEdges) {
  return allEdges
    .filter(e => e.source === nodeId || e.target === nodeId)
    .map(e => {
      const isSource = e.source === nodeId;
      const relationType = determineRelationshipType(e.data || {});
      const otherNodeId = isSource ? e.target : e.source;

      // Encontrar el className real del otro nodo
      const otherNode = allNodes.find(n => n.id === otherNodeId);
      const otherClassName = otherNode?.data?.className || `Node${otherNodeId}`;

      return {
        type: relationType,
        field: isSource 
          ? (e.data?.targetRole || `relatedTo${otherClassName}`) 
          : (e.data?.sourceRole || `relatedTo${otherClassName}`),
        mappedBy: isSource ? e.data?.targetRole : e.data?.sourceRole,
        targetClass: otherClassName,
        joinTableName: `${String(nodeId).toLowerCase()}_${String(otherNodeId).toLowerCase()}`,
        sourceField: e.source,
        targetField: e.target
      };
    });
}

// 3) generateRelations con más casos
function generateRelations(relations) {
  return relations.map((rel) => {
    switch (rel.type) {
      case 'OneToOne':
        return `
    @OneToOne
    @JoinColumn(name="${rel.field}_id")
    private ${rel.targetClass} ${rel.field};
        `;
      case 'OneToMany':
        return `
    // Dueña en ManyToOne, así que aquí mappedBy = ${rel.mappedBy || rel.field}
    @OneToMany(mappedBy="${rel.mappedBy || rel.field}")
    private List<${rel.targetClass}> ${rel.field};
        `;
      case 'ManyToOne':
        return `
    @ManyToOne
    @JoinColumn(name="${rel.field}_id")
    private ${rel.targetClass} ${rel.field};
        `;
      case 'ManyToMany':
        return `
    @ManyToMany
    @JoinTable(
      name="${rel.joinTableName}",
      joinColumns = @JoinColumn(name="${rel.sourceField}_id"),
      inverseJoinColumns = @JoinColumn(name="${rel.targetField}_id")
    )
    private List<${rel.targetClass}> ${rel.field};
        `;
      case 'Generalization':
      case 'Implementation':
        // Manejar en generateEntityClass con extends/implements
        return '';
      default:
        // "Association" normal, sin anotaciones JPA
        return '';
    }
  }).join('\n');
}

// 4) En generateEntityClass, si detectas herencia, ajustas:
function generateEntityClass(node, edges, allNodes) {
  const className = node.data.className;
  const attributes = node.data.attributes || [];
  const relations = getRelations(node.id, allNodes, edges);

  // Detecta si este nodo extiende a otro (Generalization)
  const genRel = relations.find(r => r.type === 'Generalization' && r.targetClass);
  const extendsClause = genRel ? `extends ${genRel.targetClass}` : '';

  return `
import javax.persistence.*;
import lombok.Data;
import java.util.List;

@Entity
@Table(name="${className.toLowerCase()}")
@Data
public class ${className} ${extendsClause} {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  ${generateFields(attributes)}
  ${generateRelations(relations)}
}
`;
}

  };
  