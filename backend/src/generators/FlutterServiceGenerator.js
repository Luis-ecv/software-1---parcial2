class FlutterServiceGenerator {
  generate(entity, allEntities) {
    const className = this.capitalizeFirst(entity.name);
    const serviceName = `${className}Service`;
    const modelImport = `import '../models/${entity.name.toLowerCase()}.dart';`;
    const endpoint = this.toKebabCase(entity.name);
    const foreignKeys = entity.attributes.filter(attr => attr.isForeignKey);
    const fkImports = foreignKeys
      .map(fk => {
        const refEntity = allEntities.find(e => e.name === fk.referencedEntity);
        if (!refEntity) return '';
        return `import '../models/${refEntity.name.toLowerCase()}.dart';`;
      })
      .filter(imp => imp !== '')
      .join('\n');
    const allImports = fkImports ? `${modelImport}\n${fkImports}` : modelImport;
    return `${allImports}
import 'base_service.dart';

class ${serviceName} extends BaseService {
  final String endpoint = '/${endpoint}';

  // Obtener todos los registros
  Future<List<${className}>> getAll() async {
    try {
      final response = await get(endpoint);
      final List<dynamic> data = response['data'] ?? response;
      return data.map((json) => ${className}.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Error al obtener ${entity.name}: \$e');
    }
  }

  // Obtener un registro por ID
  Future<${className}> getById(${this.generateIdParams(entity)}) async {
    try {
      final response = await get('$endpoint/${this.generateIdPath(entity)}');
      return ${className}.fromJson(response['data'] ?? response);
    } catch (e) {
      throw Exception('Error al obtener ${entity.name}: \$e');
    }
  }

  // Crear un nuevo registro
  Future<${className}> create(${className} ${this.camelCase(entity.name)}) async {
    try {
      final response = await post(endpoint, ${this.camelCase(entity.name)}.toJson());
      return ${className}.fromJson(response['data'] ?? response);
    } catch (e) {
      throw Exception('Error al crear ${entity.name}: \$e');
    }
  }

  // Actualizar un registro existente
  Future<${className}> update(${this.generateIdParams(entity)}, ${className} ${this.camelCase(entity.name)}) async {
    try {
      final response = await put('$endpoint/${this.generateIdPath(entity)}', ${this.camelCase(entity.name)}.toJson());
      return ${className}.fromJson(response['data'] ?? response);
    } catch (e) {
      throw Exception('Error al actualizar ${entity.name}: \$e');
    }
  }

  // Eliminar un registro
  Future<void> delete(${this.generateIdParams(entity)}) async {
    try {
      await deleteRequest('$endpoint/${this.generateIdPath(entity)}');
    } catch (e) {
      throw Exception('Error al eliminar ${entity.name}: \$e');
    }
  }
${this.generateForeignKeyMethods(entity, allEntities, foreignKeys)}
}
`;
  }

  generateBaseService() {
    return `import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class BaseService {
  final String baseUrl = ApiConfig.baseUrl;

  Future<Map<String, dynamic>> get(String endpoint) async {
    try {
      print('🌐 GET Request: \$baseUrl\$endpoint');
      
      final response = await http.get(
        Uri.parse('\$baseUrl\$endpoint'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );

      print('📡 Response Status: \${response.statusCode}');
      print('📦 Response Body: \${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data is Map<String, dynamic> ? data : {'data': data};
      } else if (response.statusCode == 404) {
        throw Exception('Recurso no encontrado (404)');
      } else if (response.statusCode == 500) {
        // Intentar parsear el error del servidor
        try {
          final errorData = json.decode(response.body);
          final errorMessage = errorData['message'] ?? errorData['error'] ?? 'Error interno del servidor';
          throw Exception('Error del servidor (500): \$errorMessage');
        } catch (e) {
          throw Exception('Error del servidor (500): \${response.body}');
        }
      } else {
        throw Exception('Error HTTP \${response.statusCode}: \${response.body}');
      }
    } catch (e) {
      print('❌ Error en GET: \$e');
      if (e.toString().contains('SocketException') || e.toString().contains('HandshakeException')) {
        throw Exception('No se pudo conectar al servidor. Verifica: '
            '1. Que Spring Boot esté corriendo en puerto 8080, '
            '2. La URL en api_config.dart, '
            '3. Para Android: usa 10.0.2.2 en lugar de localhost');
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> data) async {
    try {
      print('🌐 POST Request: \$baseUrl\$endpoint');
      print('📤 Request Data: \$data');
      
      final response = await http.post(
        Uri.parse('\$baseUrl\$endpoint'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: json.encode(data),
      );

      print('📡 Response Status: \${response.statusCode}');
      print('📦 Response Body: \${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = json.decode(response.body);
        return responseData is Map<String, dynamic> ? responseData : {'data': responseData};
      } else if (response.statusCode == 400) {
        try {
          final errorData = json.decode(response.body);
          final errorMessage = errorData['message'] ?? 'Datos inválidos';
          throw Exception('Error de validación (400): \$errorMessage');
        } catch (e) {
          throw Exception('Error de validación (400): \${response.body}');
        }
      } else {
        throw Exception('Error HTTP \${response.statusCode}: \${response.body}');
      }
    } catch (e) {
      print('❌ Error en POST: \$e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> data) async {
    try {
      print('🌐 PUT Request: \$baseUrl\$endpoint');
      print('📤 Request Data: \$data');
      
      final response = await http.put(
        Uri.parse('\$baseUrl\$endpoint'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: json.encode(data),
      );

      print('📡 Response Status: \${response.statusCode}');
      print('📦 Response Body: \${response.body}');

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        return responseData is Map<String, dynamic> ? responseData : {'data': responseData};
      } else if (response.statusCode == 404) {
        throw Exception('Recurso no encontrado (404)');
      } else {
        throw Exception('Error HTTP \${response.statusCode}: \${response.body}');
      }
    } catch (e) {
      print('❌ Error en PUT: \$e');
      rethrow;
    }
  }

  Future<void> deleteRequest(String endpoint) async {
    try {
      print('🌐 DELETE Request: \$baseUrl\$endpoint');
      
      final response = await http.delete(
        Uri.parse('\$baseUrl\$endpoint'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );

      print('📡 Response Status: \${response.statusCode}');

      if (response.statusCode != 200 && response.statusCode != 204) {
        try {
          final errorData = json.decode(response.body);
          final errorMessage = errorData['message'] ?? 'Error al eliminar';
          throw Exception('Error al eliminar (\${response.statusCode}): \$errorMessage');
        } catch (e) {
          throw Exception('Error al eliminar (\${response.statusCode}): \${response.body}');
        }
      }
    } catch (e) {
      print('❌ Error en DELETE: \$e');
      rethrow;
    }
  }
}
`;
  }

  generateIdParams(entity) {
    const pkAttributes = entity.attributes.filter(attr => attr.isPrimaryKey);
    return pkAttributes.map(attr => {
      const dartType = this.getDartType(attr.type);
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      return `${dartType} ${fieldName}`;
    }).join(', ');
  }

  generateIdPath(entity) {
    const pkAttributes = entity.attributes.filter(attr => attr.isPrimaryKey);
    return pkAttributes.map(attr => {
      const fieldName = attr.isForeignKey ? this.formatForeignKeyName(attr.name) : this.camelCase(attr.name);
      return `\${${fieldName}}`;
    }).join('/');
  }

  generateForeignKeyMethods(entity, allEntities, foreignKeys) {
    if (foreignKeys.length === 0) return '';
    const methods = foreignKeys.map(fk => {
      const refEntity = allEntities.find(e => e.name === fk.referencedEntity);
      if (!refEntity) return '';
      const refClassName = this.capitalizeFirst(refEntity.name);
      return `
  // Obtener opciones para el campo FK: ${fk.name}
  Future<List<${refClassName}>> get${refClassName}Options() async {
    try {
      final response = await get('/${this.toKebabCase(refEntity.name)}');
      final List<dynamic> data = response['data'] ?? response;
      return data.map((json) => ${refClassName}.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Error al obtener opciones de ${refEntity.name}: \$e');
    }
  }`;
    }).join('\n');
    return methods;
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

  toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }
}

export default FlutterServiceGenerator;
