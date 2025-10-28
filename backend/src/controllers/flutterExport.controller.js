import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { response } from '../middlewares/catchedAsync.js';
import { getSalaById } from '../models/sala.model.js';
import { rm } from 'fs/promises';

const rutaBase = 'C:/Users/Public/Documents/proyectos';

class FlutterExportController {
  exportarDesdeSala = async (req, res) => {
    const { id } = req.params;
    try {
      const [sala] = await getSalaById(id);
      if (!sala) return response(res, 404, { error: 'Sala no encontrada' });
      if (!sala.xml || sala.xml.trim() === '') return response(res, 400, { error: 'La sala no tiene contenido para exportar' });
      let salaData;
      try { salaData = JSON.parse(sala.xml); } catch (err) {
        return response(res, 400, { error: 'XML de sala inválido' });
      }

      let elements = [];
      let connections = [];
      if (salaData.elements) {
        elements = Array.isArray(salaData.elements) ? salaData.elements : Object.values(salaData.elements || {});
      }
      if (salaData.connections) {
        connections = Array.isArray(salaData.connections) ? salaData.connections : Object.values(salaData.connections || {});
      }

      if (elements.length === 0) return response(res, 400, { error: 'No hay elementos UML en la sala para exportar' });

      const classElements = elements.filter(el => el.type === 'class');
      if (classElements.length === 0) return response(res, 400, { error: 'No hay clases UML en la sala para exportar' });

      const projectName = `flutter-${sala.title.toLowerCase().replace(/\s+/g, '-')}`;
      await this.crearProyectoFlutterCompleto(projectName, classElements, connections);
      await this.comprimirProyecto(projectName);
      await this.enviarZip(res, projectName);
    } catch (error) {
      console.error('Error exportando Flutter desde sala:', error);
      return response(res, 500, { error: 'Error exportando Flutter', detalles: error.message });
    }
  };

  exportarConPayload = async (req, res) => {
    const { elements, connections, projectName } = req.body;
    if (!elements || elements.length === 0) return response(res, 400, { error: 'No hay elementos para generar proyecto Flutter' });
    const classElements = elements.filter(el => el.type === 'class');
    if (classElements.length === 0) return response(res, 400, { error: 'No hay clases UML en el payload' });
    const name = projectName && typeof projectName === 'string' ? `flutter-${projectName}` : `flutter-project`;
    try {
      await this.crearProyectoFlutterCompleto(name, classElements, connections || []);
      await this.comprimirProyecto(name);
      await this.enviarZip(res, name);
    } catch (error) {
      console.error('Error exportando Flutter desde payload:', error);
      return response(res, 500, { error: 'Error exportando Flutter', detalles: error.message });
    }
  };

  crearProyectoFlutterCompleto = async (projectName, elements, connections) => {
    const projectPath = path.join(rutaBase, projectName);
    // Clean existing
    if (fs.existsSync(projectPath)) {
      await rm(projectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(projectPath, { recursive: true });

    // pubspec.yaml
    const pubspec = `name: ${projectName.replace(/[^a-z0-9_\-]/gi, '')}\nversion: 1.0.0+1\nenvironment:\n  sdk: ">=2.17.0 <3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^0.13.6\n\nflutter:\n  uses-material-design: true\n`;
    fs.writeFileSync(path.join(projectPath, 'pubspec.yaml'), pubspec, 'utf8');

    // .gitignore
    const gitignore = `/.dart_tool\n/.idea\n/.vscode\n/build\n/.packages\n/.flutter-plugins\n/.flutter-plugins-dependencies\n.flutter-plugins\n`;
    fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore, 'utf8');

    // README
  const readme = `# ${projectName}\n\nGenerated Flutter project from UML diagram.\n\n## Run\n\n1. Install Flutter SDK\n2. Run:\n\n  flutter pub get\n  flutter run\n\nUpdate API base URL in lib/services/api_service.dart if necessary.\n`;
    fs.writeFileSync(path.join(projectPath, 'README.md'), readme, 'utf8');

    // Create lib structure
    const libPath = path.join(projectPath, 'lib');
    fs.mkdirSync(libPath);
    fs.mkdirSync(path.join(libPath, 'models'));
    fs.mkdirSync(path.join(libPath, 'services'));
    fs.mkdirSync(path.join(libPath, 'pages'));

    // Generate models
    const classNames = [];
    elements.forEach(el => {
      const className = this.sanitizeClassName(el.name || `Class${Date.now()}`);
      classNames.push(className);
      const attrs = Array.isArray(el.attributes) ? el.attributes : [];
      const dartCode = this.generateDartModel(className, attrs);
      fs.writeFileSync(path.join(libPath, 'models', `${this.toSnake(className)}.dart`), dartCode, 'utf8');
    });

    // Generate API service
    const apiService = this.generateApiService(classNames);
    fs.writeFileSync(path.join(libPath, 'services', 'api_service.dart'), apiService, 'utf8');

    // Generate pages per class (list + detail)
    classNames.forEach(name => {
      const listPage = this.generateListPage(name);
      const detailPage = this.generateDetailPage(name);
      fs.writeFileSync(path.join(libPath, 'pages', `${this.toSnake(name)}_list_page.dart`), listPage, 'utf8');
      fs.writeFileSync(path.join(libPath, 'pages', `${this.toSnake(name)}_detail_page.dart`), detailPage, 'utf8');
    });

    // Generate main.dart
    const mainDart = this.generateMainDart(classNames);
    fs.writeFileSync(path.join(libPath, 'main.dart'), mainDart, 'utf8');
  };

  sanitizeClassName = (s) => {
    if (!s) return 'Generated';
    return s.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]+/, '') || 'Generated';
  };

  toSnake = (name) => {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  };

  mapDartType = (type) => {
    if (!type) return 'dynamic';
    const t = String(type).toLowerCase();
    if (t.includes('string') || t === 'string' || t === 'char' || t === 'varchar') return 'String?';
    if (t.includes('int') || t === 'long' || t === 'integer' || t === 'number') return 'int?';
    if (t.includes('bool') || t === 'boolean') return 'bool?';
    if (t.includes('double') || t.includes('float')) return 'double?';
    if (t.includes('date')) return 'DateTime?';
    return 'dynamic';
  };

  generateDartModel = (className, attributes) => {
    const fields = (attributes || []).map(attr => {
      if (typeof attr === 'string' && attr.includes(':')) {
        const [rawName, rawType] = attr.split(':').map(s => s.trim());
        const name = rawName.replace(/^[+\-#]/, '').trim();
        const type = this.mapDartType(rawType);
        return `  ${type} ${name};`;
      } else if (typeof attr === 'object' && attr.name) {
        const name = attr.name;
        const type = this.mapDartType(attr.type || 'string');
        return `  ${type} ${name};`;
      }
      return null;
    }).filter(Boolean).join('\n');

    const fromJsonFields = (attributes || []).map(attr => {
      if (typeof attr === 'string' && attr.includes(':')) {
        const [rawName, rawType] = attr.split(':').map(s => s.trim());
        const name = rawName.replace(/^[+\-#]/, '').trim();
        return `      ${name}: json['${name}'],`;
      } else if (typeof attr === 'object' && attr.name) {
        const name = attr.name;
        return `      ${name}: json['${name}'],`;
      }
      return '';
    }).join('\n');

    const toJsonFields = (attributes || []).map(attr => {
      if (typeof attr === 'string' && attr.includes(':')) {
        const [rawName] = attr.split(':').map(s => s.trim());
        const name = rawName.replace(/^[+\-#]/, '').trim();
        return `      '${name}': ${name},`;
      } else if (typeof attr === 'object' && attr.name) {
        const name = attr.name;
        return `      '${name}': ${name},`;
      }
      return '';
    }).join('\n');

    return `class ${className} {\n${fields ? fields + '\n' : ''}\n  ${className}({${(attributes||[]).map(a => { if (typeof a === 'string' && a.includes(':')) { const [n]=a.split(':'); return `${n.replace(/^[+\-#]/,'').trim()}`; } if (typeof a === 'object' && a.name) return a.name; return ''; }).filter(Boolean).join(', ')} });\n\n  factory ${className}.fromJson(Map<String, dynamic> json) {\n    return ${className}(\n${fromJsonFields}\n    );\n  }\n\n  Map<String, dynamic> toJson() {\n    return {\n${toJsonFields}\n    };\n  }\n}\n`;
  };

  generateApiService = (classNames) => {
    const modelsMap = classNames.map(n => `  '/${n.toLowerCase()}': '${n.toLowerCase()}',`).join('\n');
    return `import 'dart:convert';\nimport 'package:http/http.dart' as http;\n\nclass ApiService {\n  // Configurable base URL (adjust in README or replace here)\n  static const String baseUrl = 'http://localhost:3000/api';\n\n  static Future<List<dynamic>> getAll(String path) async {\n    final resp = await http.get(Uri.parse('\$baseUrl/\$path'));\n    if (resp.statusCode == 200) {\n      return json.decode(resp.body) as List<dynamic>;\n    }\n    throw Exception('Error fetching list');\n  }\n\n  static Future<Map<String, dynamic>> getById(String path, int id) async {\n    final resp = await http.get(Uri.parse('\$baseUrl/\$path/\$id'));\n    if (resp.statusCode == 200) return json.decode(resp.body) as Map<String,dynamic>;\n    throw Exception('Error fetching item');\n  }\n\n  static Future<Map<String, dynamic>> create(String path, Map<String,dynamic> body) async {\n    final resp = await http.post(Uri.parse('\$baseUrl/\$path'), headers: {'Content-Type':'application/json'}, body: json.encode(body));\n    if (resp.statusCode == 200 || resp.statusCode == 201) return json.decode(resp.body) as Map<String,dynamic>;
    throw Exception('Error creating item');\n  }\n\n  static Future<Map<String, dynamic>> update(String path, int id, Map<String,dynamic> body) async {\n    final resp = await http.put(Uri.parse('\$baseUrl/\$path/\$id'), headers: {'Content-Type':'application/json'}, body: json.encode(body));\n    if (resp.statusCode == 200) return json.decode(resp.body) as Map<String,dynamic>;
    throw Exception('Error updating item');\n  }\n\n  static Future<bool> deleteItem(String path, int id) async {\n    final resp = await http.delete(Uri.parse('\$baseUrl/\$path/\$id'));\n    return resp.statusCode == 200;\n  }\n}\n`;
  };

  generateListPage = (className) => {
    const snake = this.toSnake(className);
    return `import 'package:flutter/material.dart';\nimport '../services/api_service.dart';\nimport '../models/${snake}.dart';\n\nclass ${className}ListPage extends StatefulWidget {\n  const ${className}ListPage({Key? key}) : super(key: key);\n\n  @override\n  State<${className}ListPage> createState() => _${className}ListPageState();\n}\n\nclass _${className}ListPageState extends State<${className}ListPage> {\n  late Future<List<dynamic>> _future;\n\n  @override\n  void initState() {\n    super.initState();\n    _future = ApiService.getAll('${className.toLowerCase()}');\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      appBar: AppBar(title: Text('${className}')),\n      body: FutureBuilder<List<dynamic>>(\n        future: _future,\n        builder: (context, snapshot) {\n          if (snapshot.connectionState == ConnectionState.waiting) return Center(child: CircularProgressIndicator());\n          if (snapshot.hasError) return Center(child: Text('Error: \\${snapshot.error}'));\n          final items = snapshot.data ?? [];\n          if (items.isEmpty) return Center(child: Text('No items'));\n          return ListView.builder(\n            itemCount: items.length,\n            itemBuilder: (context, index) {\n              final item = items[index];\n              return ListTile(\n                title: Text(item['id'] != null ? item['id'].toString() : 'Item'),\n                subtitle: Text(item.keys.where((k) => k != 'id').map((k) => '\\$k: \\${item[k]}').take(2).join(', ')),\n                onTap: () => Navigator.pushNamed(context, '/${snake}/detail', arguments: item),\n              );\n            },\n          );\n        },\n      ),\n      floatingActionButton: FloatingActionButton(\n        onPressed: () => Navigator.pushNamed(context, '/${snake}/detail'),\n        child: Icon(Icons.add),\n      ),\n    );\n  }\n}\n`;
  };

  generateDetailPage = (className) => {
    const snake = this.toSnake(className);
    return `import 'package:flutter/material.dart';\nimport '../services/api_service.dart';\n\nclass ${className}DetailPage extends StatefulWidget {\n  final Map<String,dynamic>? item;\n  const ${className}DetailPage({Key? key, this.item}) : super(key: key);\n\n  @override\n  State<${className}DetailPage> createState() => _${className}DetailPageState();\n}\n\nclass _${className}DetailPageState extends State<${className}DetailPage> {\n  final _formKey = GlobalKey<FormState>();\n  Map<String,dynamic> formData = {};\n\n  @override\n  void initState() {\n    super.initState();\n    if (widget.item != null) formData = Map<String,dynamic>.from(widget.item!);\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      appBar: AppBar(title: Text('${className} Detail')),\n      body: Padding(\n        padding: const EdgeInsets.all(12.0),\n        child: Form(\n          key: _formKey,\n          child: Column(\n            children: [\n              // TODO: Replace with actual fields\n              TextFormField(\n                initialValue: formData['id'] != null ? formData['id'].toString() : '',\n                decoration: InputDecoration(labelText: 'ID'),\n                onSaved: (v) => formData['id'] = v,\n              ),\n              SizedBox(height: 12),\n              ElevatedButton(\n                onPressed: () async {\n                  _formKey.currentState?.save();\n                  try {\n                    if (formData['id'] != null && formData['id'].toString().isNotEmpty) {\n                      await ApiService.update('${className.toLowerCase()}', int.parse(formData['id'].toString()), formData);\n                    } else {\n                      await ApiService.create('${className.toLowerCase()}', formData);\n                    }\n                    Navigator.pop(context);\n                  } catch (e) {\n                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: \\$e')));\n                  }\n                },\n                child: Text('Guardar'),\n              )\n            ],\n          ),\n        ),\n      ),\n    );\n  }\n}\n`;
  };

  generateMainDart = (classNames) => {
    const imports = classNames.map(n => `import 'pages/${this.toSnake(n)}_list_page.dart';`).join('\n');
    const routes = classNames.map(n => `        '/${this.toSnake(n)}': (ctx) => ${n}ListPage(),`).join('\n');
    return `import 'package:flutter/material.dart';\n${imports}\n\nvoid main() { runApp(MyApp()); }\n\nclass MyApp extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      title: 'Generated Flutter App',\n      theme: ThemeData(primarySwatch: Colors.indigo),\n      home: Scaffold(\n        appBar: AppBar(title: Text('Generated App')),\n        body: Center(child: Text('Select a page from the menu')),\n      ),\n      routes: {\n${routes}\n      },\n    );\n  }\n}\n`;
  };

  comprimirProyecto = async (titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.directory(rutaFinal, false);
      archive.finalize();
    });
  };

  enviarZip = async (res, titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    try {
      const zipBuffer = fs.readFileSync(zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${titulo}.zip`);
      res.send(zipBuffer);
      await rm(rutaFinal, { recursive: true, force: true });
      await rm(zipPath, { force: true });
    } catch (error) {
      console.error('Error al enviar o limpiar:', error);
      throw error;
    }
  };
}

export default new FlutterExportController();
