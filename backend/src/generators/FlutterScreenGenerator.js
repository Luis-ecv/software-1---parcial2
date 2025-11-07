class FlutterScreenGenerator {
  generateHomeScreen(entities) {
    const listTiles = entities.map(entity => {
      const className = this.capitalizeFirst(entity.name);
      return `            ListTile(
              leading: Icon(Icons.${this.getIconForEntity(entity)}),
              title: Text('${className}'),
              trailing: Icon(Icons.arrow_forward_ios),
              onTap: () {
                Navigator.pushNamed(context, '/${entity.name.toLowerCase()}_list');
              },
            ),
            Divider(),`;
    }).join('\n');
    return `import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Sistema CRUD'),
        centerTitle: true,
      ),
      body: ListView(
        padding: EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  Icon(Icons.business, size: 64, color: Theme.of(context).primaryColor),
                  SizedBox(height: 16),
                  Text(
                    'Gestión de Entidades',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Selecciona una entidad para administrar',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 24),
${listTiles}
        ],
      ),
    );
  }
}
`;
  }

  generateListScreen(entity, allEntities) {
    const className = this.capitalizeFirst(entity.name);
    const serviceName = `${className}Service`;
    const pkAttributes = entity.attributes.filter(attr => attr.isPrimaryKey);
    const displayAttr = entity.attributes.find(attr => !attr.isPrimaryKey) || entity.attributes[0];
    const idParams = pkAttributes.map(pk => {
      const fieldName = pk.isForeignKey ? this.formatForeignKeyName(pk.name) : this.camelCase(pk.name);
      return `item.${fieldName}`;
    }).join(', ');
    
    return `import 'package:flutter/material.dart';
import '../models/${entity.name.toLowerCase()}.dart';
import '../services/${entity.name.toLowerCase()}_service.dart';
import '${entity.name.toLowerCase()}_form_screen.dart';

class ${className}ListScreen extends StatefulWidget {
  const ${className}ListScreen({Key? key}) : super(key: key);

  @override
  _${className}ListScreenState createState() => _${className}ListScreenState();
}

class _${className}ListScreenState extends State<${className}ListScreen> {
  final ${serviceName} _service = ${serviceName}();
  List<${className}> _items = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final items = await _service.getAll();
      setState(() {
        _items = items;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteItem(${className} item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Confirmar eliminación'),
        content: Text('¿Está seguro de eliminar este registro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Eliminar', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _service.delete(${idParams});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Registro eliminado exitosamente')),
        );
        _loadData();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al eliminar: \$e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${className}'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => ${className}FormScreen()),
          );
          if (result == true) {
            _loadData();
          }
        },
        child: Icon(Icons.add),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red),
            SizedBox(height: 16),
            Text('Error: \$_error'),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadData,
              child: Text('Reintentar'),
            ),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('No hay registros', style: TextStyle(fontSize: 18)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.all(8),
      itemCount: _items.length,
      itemBuilder: (context, index) {
        final item = _items[index];
        return Card(
          margin: EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: ListTile(
            title: Text('${this.generateDisplayTitle(entity, 'item')}'),
            subtitle: Text('${this.generateDisplaySubtitle(entity, 'item')}'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.edit, color: Colors.blue),
                  onPressed: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ${className}FormScreen(${this.camelCase(entity.name)}: item),
                      ),
                    );
                    if (result == true) {
                      _loadData();
                    }
                  },
                ),
                IconButton(
                  icon: Icon(Icons.delete, color: Colors.red),
                  onPressed: () => _deleteItem(item),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
`;
  }

  generateFormScreen(entity, allEntities) {
    const className = this.capitalizeFirst(entity.name);
    const serviceName = `${className}Service`;
    const foreignKeys = entity.attributes.filter(attr => 
      attr.isForeignKey && !attr.isPrimaryKey
    );
    const pkForeignKeys = entity.attributes.filter(attr => 
      attr.isForeignKey && attr.isPrimaryKey
    );
    const controllers = this.generateControllers(entity);
    const stateVariables = this.generateStateVariables(entity, foreignKeys, pkForeignKeys);
    const initStateContent = this.generateInitState(entity, foreignKeys, pkForeignKeys);
    const loadFKMethods = this.generateLoadFKMethods(entity, allEntities, foreignKeys, pkForeignKeys);
    const formFields = this.generateFormFields(entity, allEntities, foreignKeys, pkForeignKeys);
    const saveMethod = this.generateSaveMethod(entity, pkForeignKeys);
    return `import 'package:flutter/material.dart';
import '../models/${entity.name.toLowerCase()}.dart';
import '../services/${entity.name.toLowerCase()}_service.dart';
${this.generateFormImports(entity, allEntities, foreignKeys, pkForeignKeys)}

class ${className}FormScreen extends StatefulWidget {
  final ${className}? ${this.camelCase(entity.name)};

  const ${className}FormScreen({Key? key, this.${this.camelCase(entity.name)}}) : super(key: key);

  @override
  _${className}FormScreenState createState() => _${className}FormScreenState();
}

class _${className}FormScreenState extends State<${className}FormScreen> {
  final _formKey = GlobalKey<FormState>();
  final ${serviceName} _service = ${serviceName}();
  bool _isLoading = false;
  
${controllers}
${stateVariables}

  @override
  void initState() {
    super.initState();
${initStateContent}
  }

${loadFKMethods}

  @override
  void dispose() {
${this.generateDispose(entity)}
    super.dispose();
  }

${saveMethod}

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.${this.camelCase(entity.name)} != null;
    
    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Editar ${className}' : 'Nuevo ${className}'),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
${formFields}
                    SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _save,
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: Text(isEdit ? 'Actualizar' : 'Guardar', style: TextStyle(fontSize: 18)),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
`;
  }

  generateFormImports(entity, allEntities, foreignKeys, pkForeignKeys) {
    const imports = new Set();
    [...foreignKeys, ...pkForeignKeys].forEach(fk => {
      if (fk.referencedEntity) {
        const refEntity = allEntities.find(e => e.name === fk.referencedEntity);
        if (refEntity) {
          imports.add(`import '../models/${refEntity.name.toLowerCase()}.dart';`);
        }
      }
    });
    return imports.size > 0 ? Array.from(imports).join('\n') : '';
  }

  generateControllers(entity) {
    return entity.attributes
      .filter(attr => !attr.isForeignKey || !attr.isPrimaryKey)
      .map(attr => {
        if (attr.isForeignKey) return '';
        const fieldName = this.camelCase(attr.name);
        return `  final _${fieldName}Controller = TextEditingController();`;
      })
      .filter(c => c)
      .join('\n');
  }

  generateStateVariables(entity, foreignKeys, pkForeignKeys) {
    const vars = [];
    foreignKeys.forEach(fk => {
      if (fk.referencedEntity) {
        const refClass = this.capitalizeFirst(fk.referencedEntity);
        vars.push(`  List<${refClass}> _${this.camelCase(fk.referencedEntity)}Options = [];`);
        vars.push(`  ${refClass}? _selected${refClass};`);
      }
    });
    pkForeignKeys.forEach(fk => {
      if (fk.referencedEntity) {
        const refClass = this.capitalizeFirst(fk.referencedEntity);
        vars.push(`  List<${refClass}> _${this.camelCase(fk.referencedEntity)}Options = [];`);
        vars.push(`  ${refClass}? _selected${refClass};`);
      }
    });
    return vars.join('\n');
  }

  generateInitState(entity, foreignKeys, pkForeignKeys) {
    const lines = [];
    
    // Cargar opciones de FKs
    [...foreignKeys, ...pkForeignKeys].forEach(fk => {
      if (fk.referencedEntity) {
        lines.push(`    _load${this.capitalizeFirst(fk.referencedEntity)}Options();`);
      }
    });
    
    // Si estamos editando, cargar los datos
    lines.push(`    if (widget.${this.camelCase(entity.name)} != null) {`);
    
    // Cargar campos normales (no FK)
    entity.attributes.forEach(attr => {
      if (!attr.isForeignKey) {
        const fieldName = this.camelCase(attr.name);
        const value = `widget.${this.camelCase(entity.name)}!.${fieldName}`;
        lines.push(`      _${fieldName}Controller.text = ${value}?.toString() ?? '';`);
      }
    });
    
    // Ya no necesitamos el postFrameCallback porque la pre-selección
    // se hace automáticamente en cada _load[Entity]Options()
    
    lines.push(`    }`);
    return lines.join('\n');
  }

  generateLoadFKMethods(entity, allEntities, foreignKeys, pkForeignKeys) {
    const methods = [];
    const processed = new Set();
    [...foreignKeys, ...pkForeignKeys].forEach(fk => {
      if (fk.referencedEntity && !processed.has(fk.referencedEntity)) {
        processed.add(fk.referencedEntity);
        const refClass = this.capitalizeFirst(fk.referencedEntity);
        
        methods.push(`  Future<void> _load${refClass}Options() async {
    try {
      final options = await _service.get${refClass}Options();
      setState(() {
        _${this.camelCase(fk.referencedEntity)}Options = options;
      });
      // Después de cargar las opciones, intentar pre-seleccionar
      if (widget.${this.camelCase(entity.name)} != null) {
        _loadSelectedForeignKeys();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error cargando opciones de ${refClass}: \$e')),
      );
    }
  }`);
      }
    });
    const allFKs = [...foreignKeys, ...pkForeignKeys];
    if (allFKs.length > 0) {
      methods.push(this.generateLoadSelectedForeignKeysMethod(entity, allEntities, foreignKeys, pkForeignKeys));
    }
    return methods.join('\n\n');
  }

  generateLoadSelectedForeignKeysMethod(entity, allEntities, foreignKeys, pkForeignKeys) {
    const lines = [];
    lines.push(`  void _loadSelectedForeignKeys() {`);
    lines.push(`    if (widget.${this.camelCase(entity.name)} == null) return;`);
    lines.push(``);
    lines.push(`    setState(() {`);
    const allFKs = [...foreignKeys, ...pkForeignKeys];
    const processed = new Set();
    allFKs.forEach(fk => {
      if (fk.referencedEntity && !processed.has(fk.referencedEntity)) {
        processed.add(fk.referencedEntity);
        const refClass = this.capitalizeFirst(fk.referencedEntity);
        const refField = fk.referencedField || 'id';
        const fkFieldName = this.formatForeignKeyName(fk.name);
        lines.push(`      // Buscar y seleccionar ${refClass} para ${fk.name}`);
        lines.push(`      final ${this.camelCase(fk.referencedEntity)}Value = widget.${this.camelCase(entity.name)}!.${fkFieldName};`);
        lines.push(`      if (${this.camelCase(fk.referencedEntity)}Value != null && _${this.camelCase(fk.referencedEntity)}Options.isNotEmpty) {`);
        lines.push(`        try {`);
        lines.push(`          _selected${refClass} = _${this.camelCase(fk.referencedEntity)}Options.firstWhere(`);
        lines.push(`            (option) => option.${this.camelCase(refField)} == ${this.camelCase(fk.referencedEntity)}Value,`);
        lines.push(`          );`);
        lines.push(`          print('✅ Pre-seleccionado ${refClass}: \${_selected${refClass}?.${this.camelCase(refField)}}');`);
        lines.push(`        } catch (e) {`);
        lines.push(`          print('⚠️ No se encontró ${refClass} con ${refField}: \${${this.camelCase(fk.referencedEntity)}Value}');`);
        lines.push(`          _selected${refClass} = null;`);
        lines.push(`        }`);
        lines.push(`      } else {`);
        lines.push(`        print('ℹ️ ${refClass}: valor=\${${this.camelCase(fk.referencedEntity)}Value}, opciones=\${_${this.camelCase(fk.referencedEntity)}Options.length}');`);
        lines.push(`        _selected${refClass} = null;`);
        lines.push(`      }`);
        lines.push(``);
      }
    });
    lines.push(`    });`);
    lines.push(`  }`);
    return lines.join('\n');
  }

  generateFormFields(entity, allEntities, foreignKeys, pkForeignKeys) {
    const fields = [];
    entity.attributes.forEach(attr => {
      const isPkFk = attr.isPrimaryKey && attr.isForeignKey;
      const isNormalFk = attr.isForeignKey && !attr.isPrimaryKey;
      if (isPkFk) {
        const refClass = this.capitalizeFirst(attr.referencedEntity);
        const refField = attr.referencedField || 'id';
        const displayText = this.generateComboBoxDisplayTextForEntity(attr.referencedEntity, 'option', allEntities);
        fields.push(`                    // ${attr.name} (PK + FK)
                    DropdownButtonFormField<${refClass}>(
                      value: _selected${refClass},
                      decoration: InputDecoration(
                        labelText: '${this.formatLabel(attr.name)}',
                        border: OutlineInputBorder(),
                        filled: true,
                        fillColor: Colors.grey[50],
                      ),
                      items: _${this.camelCase(attr.referencedEntity)}Options.map((option) {
                        return DropdownMenuItem<${refClass}>(
                          value: option,
                          child: Text(${displayText}),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() {
                          _selected${refClass} = value;
                        });
                      },
                      validator: (value) {
                        if (value == null) {
                          return 'Por favor seleccione ${this.formatLabel(attr.name)}';
                        }
                        return null;
                      },
                    ),
                    SizedBox(height: 16),`);
      } else if (isNormalFk) {
        const refClass = this.capitalizeFirst(attr.referencedEntity);
        const refField = attr.referencedField || 'id';
        const displayText = this.generateComboBoxDisplayTextForEntity(attr.referencedEntity, 'option', allEntities);
        fields.push(`                    // ${attr.name} (FK)
                    DropdownButtonFormField<${refClass}>(
                      value: _selected${refClass},
                      decoration: InputDecoration(
                        labelText: '${this.formatLabel(attr.name)}',
                        border: OutlineInputBorder(),
                        filled: true,
                        fillColor: Colors.grey[50],
                        prefixIcon: Icon(Icons.link),
                      ),
                      isExpanded: true,
                      hint: Text('Seleccione ${this.formatLabel(attr.name)}'),
                      items: _${this.camelCase(attr.referencedEntity)}Options.map((option) {
                        return DropdownMenuItem<${refClass}>(
                          value: option,
                          child: Text(
                            ${displayText},
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() {
                          _selected${refClass} = value;
                        });
                      },
                    ),
                    SizedBox(height: 16),`);
      } else {
        const readOnlyCondition = attr.isPrimaryKey ? 'isEdit' : 'false';
        fields.push(`                    TextFormField(
                      controller: _${this.camelCase(attr.name)}Controller,
                      decoration: InputDecoration(
                        labelText: '${this.formatLabel(attr.name)}',
                        border: OutlineInputBorder(),
                      ),
                      readOnly: ${readOnlyCondition},
                      keyboardType: ${this.getKeyboardType(attr.type)},
                      validator: (value) {
                        if (${attr.isPrimaryKey} && (value == null || value.isEmpty)) {
                          return 'Por favor ingrese ${this.formatLabel(attr.name)}';
                        }
                        return null;
                      },
                    ),
                    SizedBox(height: 16),`);
      }
    });
    return fields.join('\n');
  }

  generateComboBoxDisplayText(entityName, varName) {
    return `'\${${varName}.${this.camelCase(entityName)}Id ?? ${varName}.id ?? ""}'`;
  }

  generateComboBoxDisplayTextForEntity(referencedEntity, varName, allEntities) {
    const refEntity = allEntities.find(e => e.name === referencedEntity);
    if (!refEntity) {
      return `'\${${varName}.toString()}'`;
    }
    const descriptiveFields = ['nombre', 'name', 'descripcion', 'description', 'titulo', 'title'];
    const pkFields = refEntity.attributes.filter(attr => attr.isPrimaryKey);
    const nonPkFields = refEntity.attributes.filter(attr => !attr.isPrimaryKey && !attr.isForeignKey);
    let displayField = null;
    for (const fieldName of descriptiveFields) {
      displayField = nonPkFields.find(attr => 
        attr.name.toLowerCase().includes(fieldName)
      );
      if (displayField) break;
    }
    if (!displayField && nonPkFields.length > 0) {
      displayField = nonPkFields[0];
    }
    if (pkFields.length > 0 && displayField) {
      const pkFieldName = pkFields[0].isForeignKey ? this.formatForeignKeyName(pkFields[0].name) : this.camelCase(pkFields[0].name);
      const descFieldName = displayField.isForeignKey ? this.formatForeignKeyName(displayField.name) : this.camelCase(displayField.name);
      return `'\${${varName}.${pkFieldName}} - \${${varName}.${descFieldName}}'`;
    } else if (pkFields.length > 0) {
      const pkFieldName = pkFields[0].isForeignKey ? this.formatForeignKeyName(pkFields[0].name) : this.camelCase(pkFields[0].name);
      return `'\${${varName}.${pkFieldName}}'`;
    } else if (displayField) {
      const descFieldName = displayField.isForeignKey ? this.formatForeignKeyName(displayField.name) : this.camelCase(displayField.name);
      return `'\${${varName}.${descFieldName}}'`;
    }
    return `'\${${varName}.toString()}'`;
  }

  generateSaveMethod(entity, pkForeignKeys) {
    const className = this.capitalizeFirst(entity.name);
    const assignments = entity.attributes.map(attr => {
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      const isPkFk = attr.isPrimaryKey && attr.isForeignKey;
      const isRequired = attr.isPrimaryKey;
      if (isPkFk) {
        const refClass = this.capitalizeFirst(attr.referencedEntity);
        const refField = attr.referencedField || 'id';
        return `      ${fieldName}: _selected${refClass}!.${this.camelCase(refField)}!,`;
      } else if (attr.isForeignKey) {
        const refClass = this.capitalizeFirst(attr.referencedEntity);
        const refField = attr.referencedField || 'id';
        return `      ${fieldName}: _selected${refClass}?.${this.camelCase(refField)},`;
      } else {
        const controllerFieldName = this.camelCase(attr.name);
        const dartType = this.getDartType(attr.type);
        if (dartType === 'int') {
          if (isRequired) {
            return `      ${fieldName}: int.parse(_${controllerFieldName}Controller.text),`;
          } else {
            return `      ${fieldName}: int.tryParse(_${controllerFieldName}Controller.text),`;
          }
        } else if (dartType === 'double') {
          if (isRequired) {
            return `      ${fieldName}: double.parse(_${controllerFieldName}Controller.text),`;
          } else {
            return `      ${fieldName}: double.tryParse(_${controllerFieldName}Controller.text),`;
          }
        } else if (dartType === 'bool') {
          return `      ${fieldName}: _${controllerFieldName}Controller.text.toLowerCase() == 'true',`;
        } else {
          if (isRequired && !attr.isForeignKey) {
            return `      ${fieldName}: _${controllerFieldName}Controller.text,`;
          } else {
            return `      ${fieldName}: _${controllerFieldName}Controller.text.isEmpty ? null : _${controllerFieldName}Controller.text,`;
          }
        }
      }
    }).join('\n');
    const pkParams = entity.attributes
      .filter(attr => attr.isPrimaryKey)
      .map(attr => {
        const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
        if (attr.isForeignKey) {
          const refClass = this.capitalizeFirst(attr.referencedEntity);
          const refField = attr.referencedField || 'id';
          return `_selected${refClass}!.${this.camelCase(refField)}!`;
        }
        const controllerFieldName = this.camelCase(attr.name);
        const dartType = this.getDartType(attr.type);
        if (dartType === 'int') {
          return `int.parse(_${controllerFieldName}Controller.text)`;
        } else {
          return `_${controllerFieldName}Controller.text`;
        }
      }).join(', ');
    return `  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final ${this.camelCase(entity.name)} = ${className}(
${assignments}
      );

      final isEdit = widget.${this.camelCase(entity.name)} != null;

      if (isEdit) {
        await _service.update(${pkParams}, ${this.camelCase(entity.name)});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Registro actualizado exitosamente')),
        );
      } else {
        await _service.create(${this.camelCase(entity.name)});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Registro creado exitosamente')),
        );
      }

      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: \$e')),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }`;
  }

  generateDispose(entity) {
    return entity.attributes
      .filter(attr => !attr.isForeignKey)
      .map(attr => {
        const fieldName = this.camelCase(attr.name);
        return `    _${fieldName}Controller.dispose();`;
      })
      .join('\n');
  }

  generateDisplayTitle(entity, varName) {
    const firstNonPk = entity.attributes.find(attr => !attr.isPrimaryKey);
    if (firstNonPk) {
      const fieldName = firstNonPk.isForeignKey ? this.formatForeignKeyName(firstNonPk.name) : this.camelCase(firstNonPk.name);
      return `\${${varName}.${fieldName}}`;
    }
    const firstPk = entity.attributes.find(attr => attr.isPrimaryKey);
    const fieldName = firstPk.isForeignKey ? this.formatForeignKeyName(firstPk.name) : this.camelCase(firstPk.name);
    return firstPk ? `\${${varName}.${fieldName}}` : 'Item';
  }

  generateDisplaySubtitle(entity, varName) {
    const pkAttrs = entity.attributes.filter(attr => attr.isPrimaryKey);
    if (pkAttrs.length === 0) return '';
    return pkAttrs.map(pk => {
      const fieldName = pk.isForeignKey ? this.formatForeignKeyName(pk.name) : this.camelCase(pk.name);
      return `${this.formatLabel(pk.name)}: \${${varName}.${fieldName}}`;
    }).join(' | ');
  }

  getKeyboardType(type) {
    const typeMap = {
      'Integer': 'TextInputType.number',
      'int': 'TextInputType.number',
      'Long': 'TextInputType.number',
      'Double': 'TextInputType.numberWithOptions(decimal: true)',
      'double': 'TextInputType.numberWithOptions(decimal: true)',
      'Float': 'TextInputType.numberWithOptions(decimal: true)',
    };
    return typeMap[type] || 'TextInputType.text';
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
    };
    return typeMap[javaType] || 'String';
  }

  formatLabel(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getIconForEntity(entity) {
    return 'view_list';
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

export default FlutterScreenGenerator;
