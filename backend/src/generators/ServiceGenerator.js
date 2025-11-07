class ServiceGenerator {
    constructor(entities, relationships, metadata) {
        this.entities = entities;
        this.relationships = relationships || [];
        this.metadata = metadata;
    }

    isChildInInheritance(entityId) {
        return this.relationships.some(rel => {
            if (rel.type !== 'inheritance') return false;
            if (rel.source === entityId && rel.sourceMultiplicity && rel.sourceMultiplicity.includes('*')) {
                return true;
            }
            if (rel.target === entityId && rel.targetMultiplicity && rel.targetMultiplicity.includes('*')) {
                return true;
            }
            return false;
        });
    }

    getParentEntity(entityId) {
        const inheritanceRel = this.relationships.find(rel => {
            if (rel.type !== 'inheritance') return false;
            if (rel.source === entityId && rel.sourceMultiplicity && rel.sourceMultiplicity.includes('*')) {
                return true;
            }
            if (rel.target === entityId && rel.targetMultiplicity && rel.targetMultiplicity.includes('*')) {
                return true;
            }
            return false;
        });
        if (!inheritanceRel) return null;
        const parentId = inheritanceRel.sourceMultiplicity === '1' ?
            inheritanceRel.source :
            inheritanceRel.target;
        return this.entities.find(e => e.id === parentId);
    }

    generateAll() {
        const services = [];
        this.entities.forEach(entity => {
            services.push({
                name: `${entity.name}Service.java`,
                content: this.generateServiceInterface(entity)
            });
            services.push({
                name: `${entity.name}ServiceImpl.java`,
                content: this.generateServiceImplementation(entity)
            });
        });
        return services;
    }

    generateServiceInterface(entity) {
        const pkType = this.getPrimaryKeyType(entity);
        const isCompositeKey = this.isCompositeKey(entity);
        const customSearchMethods = this.generateCustomSearchMethods(entity);
        const relatedEntities = new Set();
        entity.attributes
            .filter(attr => attr.isForeignKey && attr.referencedEntity)
            .forEach(attr => relatedEntities.add(attr.referencedEntity));
        const relatedImports = Array.from(relatedEntities)
            .map(entityName => `import com.example.demo.entities.${entityName};`)
            .join('\n');
        return `package com.example.demo.services;

import com.example.demo.entities.${entity.name};
${relatedImports}
import java.util.List;
import java.util.Optional;

/**
 * Interfaz de servicio para ${entity.name}
 * Define las operaciones de negocio disponibles
 */
public interface ${entity.name}Service {

    // ========================================
    // CRUD BÁSICO
    // ========================================

    /**
     * Obtener todos los registros
     */
    List<${entity.name}> findAll();

    /**
     * Buscar por ID
     */
    Optional<${entity.name}> findById(${pkType} id);

    /**
     * Crear nuevo registro
     */
    ${entity.name} create(${entity.name} entity);

    /**
     * Actualizar registro existente
     */
    ${entity.name} update(${pkType} id, ${entity.name} entity);

    /**
     * Actualizar parcialmente un registro
     */
    ${entity.name} partialUpdate(${pkType} id, ${entity.name} entity);

    /**
     * Eliminar registro
     */
    void delete(${pkType} id);

    /**
     * Verificar si existe
     */
    boolean existsById(${pkType} id);

    /**
     * Contar total de registros
     */
    long count();

${customSearchMethods}
}
`;
    }

    generateCustomSearchMethods(entity) {
        let methods = `    // ========================================
    // MÉTODOS DE BÚSQUEDA PERSONALIZADOS
    // ========================================\n`;
        
        const parentEntity = this.getParentEntity(entity.id);
        const parentAttrNames = parentEntity ? parentEntity.attributes.map(a => a.name) : [];
        
        entity.attributes
            .filter(attr => !attr.isPrimaryKey && !attr.isRelationshipAttribute && !attr.isForeignKey)
            .filter(attr => !parentAttrNames.includes(attr.name)) // Excluir atributos del padre
            .slice(0, 3)
            .forEach(attr => {
                const javaType = this.mapTypeToJava(attr.type);
                const normalizedName = this.toCamelCase(attr.name);
                const capName = this.capitalize(normalizedName);
                methods += `    /**
     * Buscar por ${normalizedName}
     */
    Optional<${entity.name}> findBy${capName}(${javaType} ${normalizedName});
    
    /**
     * Verificar si existe por ${normalizedName}
     */
    boolean existsBy${capName}(${javaType} ${normalizedName});
    
`;
            });
        
        // Usar la variable parentEntity ya declarada arriba
        entity.attributes
            .filter(attr => attr.isForeignKey && attr.referencedEntity)
            .filter(attr => !(parentEntity && attr.referencedEntity === parentEntity.name)) // Excluir FK hacia el padre
            .forEach(attr => {
                const normalizedFieldName = this.toCamelCase(attr.name);
                const capFieldName = this.capitalize(normalizedFieldName);
                const referencedEntity = this.entities.find(e => e.name === attr.referencedEntity);
                const pkType = referencedEntity ? this.getPrimaryKeyType(referencedEntity) : 'Long';
                const pkName = referencedEntity ? this.getPrimaryKeyName(referencedEntity) : 'id';
                const normalizedPkName = this.toCamelCase(pkName);
                const capPkName = this.capitalize(normalizedPkName);
                methods += `    /**
     * Buscar todos por ${attr.referencedEntity}
     */
    List<${entity.name}> findBy${capFieldName}(${attr.referencedEntity} ${normalizedFieldName});
    
    /**
     * Buscar todos por ${capPkName} de ${attr.referencedEntity}
     */
    List<${entity.name}> findBy${capFieldName}${capPkName}(${pkType} ${normalizedFieldName}${capPkName});
    
    /**
     * Contar por ${attr.referencedEntity}
     */
    long countBy${capFieldName}(${attr.referencedEntity} ${normalizedFieldName});
    
`;
            });
        return methods;
    }

    generateServiceImplementation(entity) {
        const pkType = this.getPrimaryKeyType(entity);
        const pkName = this.getPrimaryKeyName(entity);
        const relatedEntities = new Set();
        entity.attributes
            .filter(attr => attr.isForeignKey && attr.referencedEntity)
            .forEach(attr => relatedEntities.add(attr.referencedEntity));
        const relatedImports = Array.from(relatedEntities)
            .map(entityName => `import com.example.demo.entities.${entityName};`)
            .join('\n');
        const relatedRepositoryImports = Array.from(relatedEntities)
            .map(entityName => `import com.example.demo.repositories.${entityName}Repository;`)
            .join('\n');
        const relatedRepositoryFields = Array.from(relatedEntities)
            .map(entityName => `    private final ${entityName}Repository ${this.toCamelCase(entityName)}Repository;`)
            .join('\n');
        const constructorParams = ['        ' + entity.name + 'Repository repository']
            .concat(Array.from(relatedEntities).map(entityName =>
                `        ${entityName}Repository ${this.toCamelCase(entityName)}Repository`
            ))
            .join(',\n');
        const constructorAssignments = ['        this.repository = repository;']
            .concat(Array.from(relatedEntities).map(entityName => {
                const repoName = this.toCamelCase(entityName) + 'Repository';
                return `        this.${repoName} = ${repoName};`;
            }))
            .join('\n');
        return `package com.example.demo.services;

import com.example.demo.entities.${entity.name};
${relatedImports}
import com.example.demo.repositories.${entity.name}Repository;
${relatedRepositoryImports}
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

/**
 * Implementación del servicio para ${entity.name}
 * Contiene la lógica de negocio
 */
@Service
@Transactional
public class ${entity.name}ServiceImpl implements ${entity.name}Service {

    private final ${entity.name}Repository repository;
${relatedRepositoryFields}

    @Autowired
    public ${entity.name}ServiceImpl(
${constructorParams}) {
${constructorAssignments}
    }

    @Override
    @Transactional(readOnly = true)
    public List<${entity.name}> findAll() {
        return repository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<${entity.name}> findById(${pkType} id) {
        return repository.findById(id);
    }

    @Override
    public ${entity.name} create(${entity.name} entity) {
        // Validaciones de negocio antes de crear
        validateEntity(entity);
        
        // CRÍTICO: Resolver relaciones FK antes de guardar
        resolveForeignKeys(entity);
        
        return repository.save(entity);
    }

    @Override
    public ${entity.name} update(${pkType} id, ${entity.name} entity) {
        return repository.findById(id)
            .map(existing -> {
                // Actualizar campos
                updateEntityFields(existing, entity);
                
                // CRÍTICO: Resolver relaciones FK antes de guardar
                resolveForeignKeys(existing);
                
                return repository.save(existing);
            })
            .orElseThrow(() -> new RuntimeException("${entity.name} con ID " + id + " no encontrado"));
    }

    @Override
    public ${entity.name} partialUpdate(${pkType} id, ${entity.name} entity) {
        return repository.findById(id)
            .map(existing -> {
                // Actualizar solo los campos no nulos
                updateEntityFields(existing, entity);
                
                // CRÍTICO: Resolver relaciones FK antes de guardar
                resolveForeignKeys(existing);
                
                return repository.save(existing);
            })
            .orElseThrow(() -> new RuntimeException("${entity.name} con ID " + id + " no encontrado"));
    }

    @Override
    public void delete(${pkType} id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("${entity.name} con ID " + id + " no encontrado");
        }
        repository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsById(${pkType} id) {
        return repository.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public long count() {
        return repository.count();
    }

${this.generateCustomSearchImplementations(entity)}

    /**
     * Validar entidad antes de persistir
     */
    private void validateEntity(${entity.name} entity) {
        if (entity == null) {
            throw new IllegalArgumentException("La entidad no puede ser nula");
        }
        // Las validaciones de campos se manejan con @Valid en el Controller
    }

    /**
     * Resolver relaciones de Foreign Keys
     * CRÍTICO: Este método busca las entidades relacionadas por ID en la BD
     */
    private void resolveForeignKeys(${entity.name} entity) {
${this.generateFKResolutionLogic(entity)}
    }

    /**
     * Actualizar campos de la entidad existente
     */
    private void updateEntityFields(${entity.name} existing, ${entity.name} updated) {
${this.generateUpdateFieldsLogic(entity)}
    }
}
`;
    }

    generateUpdateFieldsLogic(entity) {
        let updates = '';
        const entityMeta = this.metadata ? this.metadata.get(entity.name) : null;
        if (!entityMeta) {
            console.warn(`⚠️  No se encontró metadata para ${entity.name}, usando modo fallback`);
        }
        entity.attributes
            .filter(attr => !attr.isPrimaryKey && !attr.isRelationshipAttribute && !attr.isForeignKey)
            .forEach(attr => {
                const normalizedName = this.toCamelCase(attr.name);
                const capitalizedName = this.capitalize(normalizedName);
                if (entityMeta && entityMeta.entity) {
                    const hasGetter = entityMeta.entity.getters.includes(`get${capitalizedName}`);
                    const hasSetter = entityMeta.entity.setters.includes(`set${capitalizedName}`);
                    if (hasGetter && hasSetter) {
                        updates += `        if (updated.get${capitalizedName}() != null) {
            existing.set${capitalizedName}(updated.get${capitalizedName}());
        }
`;
                    } else {
                        console.warn(`⚠️  ${entity.name}.Entity: Métodos get${capitalizedName}/set${capitalizedName} no encontrados`);
                        console.warn(`   SALTANDO actualización del atributo '${normalizedName}'`);
                    }
                } else {
                    updates += `        if (updated.get${capitalizedName}() != null) {
            existing.set${capitalizedName}(updated.get${capitalizedName}());
        }
`;
                }
            });
        const parentEntity = this.getParentEntity(entity.id);
        const fkAttributes = entity.attributes.filter(attr => {
            if (!attr.isForeignKey || !attr.referencedEntity) return false;
            if (parentEntity && attr.referencedEntity === parentEntity.name) return false;
            return true;
        });
        if (fkAttributes.length > 0) {
            updates += `\n        // Actualizar Foreign Keys\n`;
            fkAttributes.forEach(attr => {
                const normalizedName = this.toCamelCase(attr.name);
                const capitalizedName = this.capitalize(normalizedName);
                if (entityMeta && entityMeta.entity) {
                    const hasGetter = entityMeta.entity.getters.includes(`get${capitalizedName}`);
                    const hasSetter = entityMeta.entity.setters.includes(`set${capitalizedName}`);
                    if (hasGetter && hasSetter) {
                        updates += `        // FK: ${normalizedName}
        if (updated.get${capitalizedName}() != null) {
            existing.set${capitalizedName}(updated.get${capitalizedName}());
        }
`;
                    } else {
                        console.warn(`⚠️  ${entity.name}.Entity FK: Métodos get${capitalizedName}/set${capitalizedName} no encontrados`);
                        console.warn(`   Available getters: ${entityMeta.entity.getters.join(', ')}`);
                        console.warn(`   Available setters: ${entityMeta.entity.setters.join(', ')}`);
                        console.warn(`   SALTANDO actualización del FK '${normalizedName}'`);
                    }
                } else {
                    updates += `        // FK: ${normalizedName}
        if (updated.get${capitalizedName}() != null) {
            existing.set${capitalizedName}(updated.get${capitalizedName}());
        }
`;
                }
            });
        }
        return updates;
    }

    generateFKResolutionLogic(entity) {
        let logic = '';
        const parentEntity = this.getParentEntity(entity.id);
        const fkAttributes = entity.attributes.filter(attr => {
            if (!attr.isForeignKey || !attr.referencedEntity) return false;
            if (parentEntity && attr.referencedEntity === parentEntity.name) return false;
            return true;
        });
        if (fkAttributes.length === 0) {
            logic = '        // No hay FKs que resolver\n';
            return logic;
        }
        const entityMeta = this.metadata ? this.metadata.get(entity.name) : null;
        fkAttributes.forEach(attr => {
            const normalizedName = this.toCamelCase(attr.name);
            const capitalizedName = this.capitalize(normalizedName);
            const referencedEntity = attr.referencedEntity;
            const repoName = this.toCamelCase(referencedEntity) + 'Repository';
            const refEntity = this.entities.find(e => e.name === referencedEntity);
            const pkType = refEntity ? this.getPrimaryKeyType(refEntity) : 'Long';
            const pkName = refEntity ? this.getPrimaryKeyName(refEntity) : 'id';
            const normalizedPkName = this.toCamelCase(pkName);
            const capitalizedPkName = this.capitalize(normalizedPkName);
            if (entityMeta && entityMeta.entity) {
                const hasGetter = entityMeta.entity.getters.includes(`get${capitalizedName}`);
                const hasSetter = entityMeta.entity.setters.includes(`set${capitalizedName}`);
                if (!hasGetter || !hasSetter) {
                    console.warn(`⚠️  ${entity.name}.Entity: Métodos get${capitalizedName}/set${capitalizedName} no encontrados para FK`);
                    console.warn(`   SALTANDO resolución de FK '${normalizedName}'`);
                    return;
                }
            }
            logic += `        // Resolver FK: ${normalizedName} -> ${referencedEntity}
        if (entity.get${capitalizedName}() != null) {
            ${referencedEntity} ${normalizedName}Ref = entity.get${capitalizedName}();
            
            // Si el objeto FK tiene un ID válido, buscar la entidad completa
            if (${normalizedName}Ref.get${capitalizedPkName}() != null) {
                ${pkType} ${normalizedName}Id = ${normalizedName}Ref.get${capitalizedPkName}();
                
                // Buscar en base de datos
                ${referencedEntity} ${normalizedName}Entity = ${repoName}.findById(${normalizedName}Id)
                    .orElseThrow(() -> new RuntimeException("${referencedEntity} con ID " + ${normalizedName}Id + " no encontrado"));
                
                // Asignar la entidad completa cargada desde BD
                entity.set${capitalizedName}(${normalizedName}Entity);
            } else {
                // Si no tiene ID, establecer como null
                entity.set${capitalizedName}(null);
            }
        }
`;
        });
        return logic;
    }

    generateCustomSearchImplementations(entity) {
        let implementations = `    // ========================================
    // IMPLEMENTACIÓN DE BÚSQUEDAS PERSONALIZADAS
    // ========================================\n\n`;
        
        const parentEntity = this.getParentEntity(entity.id);
        const parentAttrNames = parentEntity ? parentEntity.attributes.map(a => a.name) : [];
        
        entity.attributes
            .filter(attr => !attr.isPrimaryKey && !attr.isRelationshipAttribute && !attr.isForeignKey)
            .filter(attr => !parentAttrNames.includes(attr.name)) // Excluir atributos del padre
            .slice(0, 3)
            .forEach(attr => {
                const javaType = this.mapTypeToJava(attr.type);
                const normalizedName = this.toCamelCase(attr.name);
                const capName = this.capitalize(normalizedName);
                implementations += `    @Override
    @Transactional(readOnly = true)
    public Optional<${entity.name}> findBy${capName}(${javaType} ${normalizedName}) {
        return repository.findBy${capName}(${normalizedName});
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsBy${capName}(${javaType} ${normalizedName}) {
        return repository.existsBy${capName}(${normalizedName});
    }

`;
            });
        
        // Usar la variable parentEntity ya declarada arriba
        entity.attributes
            .filter(attr => attr.isForeignKey && attr.referencedEntity)
            .filter(attr => !(parentEntity && attr.referencedEntity === parentEntity.name)) // Excluir FK hacia el padre
            .forEach(attr => {
                const normalizedFieldName = this.toCamelCase(attr.name);
                const capFieldName = this.capitalize(normalizedFieldName);
                const referencedEntity = this.entities.find(e => e.name === attr.referencedEntity);
                const pkType = referencedEntity ? this.getPrimaryKeyType(referencedEntity) : 'Long';
                const pkName = referencedEntity ? this.getPrimaryKeyName(referencedEntity) : 'id';
                const normalizedPkName = this.toCamelCase(pkName);
                const capPkName = this.capitalize(normalizedPkName);
                implementations += `    @Override
    @Transactional(readOnly = true)
    public List<${entity.name}> findBy${capFieldName}(${attr.referencedEntity} ${normalizedFieldName}) {
        return repository.findBy${capFieldName}(${normalizedFieldName});
    }

    @Override
    @Transactional(readOnly = true)
    public List<${entity.name}> findBy${capFieldName}${capPkName}(${pkType} ${normalizedFieldName}${capPkName}) {
        return repository.findBy${capFieldName}${capPkName}(${normalizedFieldName}${capPkName});
    }

    @Override
    @Transactional(readOnly = true)
    public long countBy${capFieldName}(${attr.referencedEntity} ${normalizedFieldName}) {
        return repository.countBy${capFieldName}(${normalizedFieldName});
    }

`;
            });
        return implementations;
    }

    getPrimaryKeyType(entity) {
        let pkAttr = entity.attributes.find(attr => attr.isPrimaryKey);
        if (!pkAttr) {
            const parentEntity = this.getParentEntity(entity.id);
            if (parentEntity) {
                pkAttr = parentEntity.attributes.find(attr => attr.isPrimaryKey);
            }
        }
        if (!pkAttr) return 'Long';
        return this.mapTypeToJava(pkAttr.type);
    }

    getPrimaryKeyName(entity) {
        let pkAttr = entity.attributes.find(attr => attr.isPrimaryKey);
        if (!pkAttr) {
            const parentEntity = this.getParentEntity(entity.id);
            if (parentEntity) {
                pkAttr = parentEntity.attributes.find(attr => attr.isPrimaryKey);
            }
        }
        if (!pkAttr) return 'id';
        
        // Si el PK es también FK (herencia JOINED), usar el campo referenciado
        if (pkAttr.isForeignKey && pkAttr.referencedField) {
            return pkAttr.referencedField;
        }
        return pkAttr.name;
    }

    isCompositeKey(entity) {
        let pkAttrs = entity.attributes.filter(attr => attr.isPrimaryKey);
        if (pkAttrs.length === 0) {
            const parentEntity = this.getParentEntity(entity.id);
            if (parentEntity) {
                pkAttrs = parentEntity.attributes.filter(attr => attr.isPrimaryKey);
            }
        }
        return pkAttrs.length > 1;
    }

    mapTypeToJava(type) {
        const typeMap = {
            'String': 'String',
            'Integer': 'Integer',
            'Long': 'Long',
            'Double': 'Double',
            'Float': 'Float',
            'Boolean': 'Boolean',
            'Date': 'LocalDate',
            'LocalDate': 'LocalDate',
            'LocalDateTime': 'LocalDateTime',
            'BigDecimal': 'BigDecimal'
        };
        return typeMap[type] || 'String';
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    toCamelCase(str) {
        if (str.includes('_')) {
            return str.split('_')
                .map((word, index) => {
                    if (index === 0) {
                        return word.toLowerCase();
                    }
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                })
                .join('');
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    }
}

export default ServiceGenerator;