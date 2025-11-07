class FlutterModelGenerator {
  generate(entity, allEntities) {
    const className = this.capitalizeFirst(entity.name);
    const imports = this.generateImports(entity, allEntities);
    const fields = this.generateFields(entity, allEntities);
    const constructor = this.generateConstructor(entity);
    const fromJson = this.generateFromJson(entity, allEntities);
    const toJson = this.generateToJson(entity, allEntities);
    
    return `${imports}

class ${className} {
${fields}

${constructor}

${fromJson}

${toJson}

  ${className} copyWith({
${this.generateCopyWithParams(entity)}
  }) {
    return ${className}(
${this.generateCopyWithArgs(entity)}
    );
  }
}
`;
  }

  generateImports(entity, allEntities) {
    const imports = [];
    for (const attr of entity.attributes) {
      if (attr.isForeignKey && attr.referencedEntity) {
        const refEntity = allEntities.find(e => e.name === attr.referencedEntity);
        if (refEntity) {
          imports.push(`import '${refEntity.name.toLowerCase()}.dart';`);
        }
      }
    }
    return imports.length > 0 ? imports.join('\n') : '';
  }

  generateFields(entity, allEntities) {
    const fields = [];
    for (const attr of entity.attributes) {
      const dartType = this.getDartType(attr.type);
      const isNullable = !attr.isPrimaryKey;
      const nullMark = isNullable ? '?' : '';
      
      // Usar formatForeignKeyName para atributos FK, camelCase para otros
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      fields.push(`  ${dartType}${nullMark} ${fieldName};`);
    }
    return fields.join('\n');
  }

  generateConstructor(entity) {
    const className = this.capitalizeFirst(entity.name);
    const params = entity.attributes.map(attr => {
      const isRequired = attr.isPrimaryKey;
      const prefix = isRequired ? 'required ' : '';
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      return `    ${prefix}this.${fieldName},`;
    }).join('\n');
    
    return `  ${className}({\n${params}\n  });`;
  }

  generateFromJson(entity, allEntities) {
    const className = this.capitalizeFirst(entity.name);
    const assignments = entity.attributes.map(attr => {
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      const jsonKey = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : attr.name;
      const dartType = this.getDartType(attr.type);
      const isRequired = attr.isPrimaryKey;
      if (dartType === 'int') {
        if (isRequired) {
          return `      ${fieldName}: json['${jsonKey}'] as int,`;
        } else {
          return `      ${fieldName}: json['${jsonKey}'] as int?,`;
        }
      } else if (dartType === 'double') {
        if (isRequired) {
          return `      ${fieldName}: (json['${jsonKey}'] as num).toDouble(),`;
        } else {
          return `      ${fieldName}: (json['${jsonKey}'] as num?)?.toDouble(),`;
        }
      } else if (dartType === 'bool') {
        if (isRequired) {
          return `      ${fieldName}: json['${jsonKey}'] as bool,`;
        } else {
          return `      ${fieldName}: json['${jsonKey}'] as bool?,`;
        }
      } else {
        if (isRequired) {
          return `      ${fieldName}: json['${jsonKey}'] as String,`;
        } else {
          return `      ${fieldName}: json['${jsonKey}'] as String?,`;
        }
      }
    }).join('\n');
    return `  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${assignments}
    );
  }`;
  }

  generateToJson(entity, allEntities) {
    const assignments = entity.attributes.map(attr => {
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      const jsonKey = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : attr.name;
      return `      '${jsonKey}': ${fieldName},`;
    }).join('\n');
    return `  Map<String, dynamic> toJson() {
    return {
${assignments}
    };
  }`;
  }

  generateCopyWithParams(entity) {
    return entity.attributes.map(attr => {
      const dartType = this.getDartType(attr.type);
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      return `    ${dartType}? ${fieldName},`;
    }).join('\n');
  }

  generateCopyWithArgs(entity) {
    return entity.attributes.map(attr => {
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      return `      ${fieldName}: ${fieldName} ?? this.${fieldName},`;
    }).join('\n');
  }

  getDartType(javaType) {
    const typeMap = {
      'String': 'String',
      'Integer': 'int',
      'int': 'int',
      'Long': 'int',
      'Double': 'double',
      'double': 'double',
      'Float': 'double',
      'Boolean': 'bool',
      'boolean': 'bool',
      'Date': 'DateTime',
      'LocalDate': 'DateTime',
      'LocalDateTime': 'DateTime',
    };
    
    return typeMap[javaType] || 'String';
  }

  camelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  formatForeignKeyName(name) {
    if (name.endsWith('Id')) {
      return this.snakeToCamelCase(name);
    }
    return this.snakeToCamelCase(name) + 'Id';
  }

  snakeToCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default FlutterModelGenerator;