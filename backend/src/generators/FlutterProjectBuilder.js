import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import DiagramParser from './DiagramParser.js';
import FlutterModelGenerator from './FlutterModelGenerator.js';
import FlutterServiceGenerator from './FlutterServiceGenerator.js';
import FlutterScreenGenerator from './FlutterScreenGenerator.js';
import FlutterMainGenerator from './FlutterMainGenerator.js';

class FlutterProjectBuilder {
  constructor(projectName, xmlString, basePath) {
    this.projectName = this.sanitizeProjectName(projectName);
    this.xmlString = xmlString;
    this.basePath = basePath;
    this.projectPath = path.join(basePath, `${this.projectName}_flutter`);
    this.entities = [];
  }

  sanitizeProjectName(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, 'app_$&');
  }

  async build() {
    try {      
      const parser = new DiagramParser();
      const parsedDiagram = parser.parse(this.xmlString);
      this.entities = parsedDiagram.entities;
      await this.createProjectStructure();
      await this.generateModels();
      await this.generateServices();
      await this.generateScreens();
      await this.generateMainFiles();
    } catch (error) {
      console.error('❌ Error construyendo proyecto Flutter:', error);
      throw error;
    }
  }

  async createProjectStructure() {
    const directories = [
      this.projectPath,
      path.join(this.projectPath, 'lib'),
      path.join(this.projectPath, 'lib', 'models'),
      path.join(this.projectPath, 'lib', 'services'),
      path.join(this.projectPath, 'lib', 'screens'),
      path.join(this.projectPath, 'lib', 'widgets'),
      path.join(this.projectPath, 'lib', 'config'),
      path.join(this.projectPath, 'test'),
      path.join(this.projectPath, 'android'),
      path.join(this.projectPath, 'ios'),
    ];
    for (const dir of directories) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  async generateModels() {
    const generator = new FlutterModelGenerator();
    for (const entity of this.entities) {
      const content = generator.generate(entity, this.entities);
      const filePath = path.join(this.projectPath, 'lib', 'models', `${entity.name.toLowerCase()}.dart`);
      await fs.writeFile(filePath, content, 'utf8');
    }
  }

  async generateServices() {
    const generator = new FlutterServiceGenerator();
    const baseServiceContent = generator.generateBaseService();
    const baseServicePath = path.join(this.projectPath, 'lib', 'services', 'base_service.dart');
    await fs.writeFile(baseServicePath, baseServiceContent, 'utf8');
    for (const entity of this.entities) {
      const content = generator.generate(entity, this.entities);
      const filePath = path.join(this.projectPath, 'lib', 'services', `${entity.name.toLowerCase()}_service.dart`);
      await fs.writeFile(filePath, content, 'utf8');
    }
  }

  async generateScreens() {
    const generator = new FlutterScreenGenerator();
    const homeContent = generator.generateHomeScreen(this.entities);
    const homePath = path.join(this.projectPath, 'lib', 'screens', 'home_screen.dart');
    await fs.writeFile(homePath, homeContent, 'utf8');
    for (const entity of this.entities) {
      const listContent = generator.generateListScreen(entity, this.entities);
      const listPath = path.join(this.projectPath, 'lib', 'screens', `${entity.name.toLowerCase()}_list_screen.dart`);
      await fs.writeFile(listPath, listContent, 'utf8');
      const formContent = generator.generateFormScreen(entity, this.entities);
      const formPath = path.join(this.projectPath, 'lib', 'screens', `${entity.name.toLowerCase()}_form_screen.dart`);
      await fs.writeFile(formPath, formContent, 'utf8');
    }
  }

  async generateMainFiles() {
    const generator = new FlutterMainGenerator(this.projectName);
    const mainContent = generator.generateMain(this.entities);
    const mainPath = path.join(this.projectPath, 'lib', 'main.dart');
    await fs.writeFile(mainPath, mainContent, 'utf8');
    const pubspecContent = generator.generatePubspec();
    const pubspecPath = path.join(this.projectPath, 'pubspec.yaml');
    await fs.writeFile(pubspecPath, pubspecContent, 'utf8');
    const configContent = generator.generateApiConfig();
    const configPath = path.join(this.projectPath, 'lib', 'config', 'api_config.dart');
    await fs.writeFile(configPath, configContent, 'utf8');

    const readmeContent = generator.generateReadme();
    const readmePath = path.join(this.projectPath, 'README.md');
    await fs.writeFile(readmePath, readmeContent, 'utf8');
    
    const quickStartContent = this.generateQuickStart();
    const quickStartPath = path.join(this.projectPath, '⚠️ LEER_PRIMERO.txt');
    await fs.writeFile(quickStartPath, quickStartContent, 'utf8');
  }

  generateQuickStart() {
    return `╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║         ⚠️  IMPORTANTE: LEE ESTO ANTES DE EJECUTAR  ⚠️           ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

Este proyecto Flutter necesita ser INICIALIZADO antes de ejecutarse.

PASO 1: INICIALIZAR FLUTTER (SOLO UNA VEZ)
═══════════════════════════════════════════════════════════════════════

Abre una terminal en esta carpeta y ejecuta:

    flutter create .

Cuando Flutter pregunte si sobrescribir archivos:
  • ¿Sobrescribir lib/main.dart? → NO (n)
  • ¿Sobrescribir pubspec.yaml? → NO (n)
  • ¿Sobrescribir README.md? → NO (n)
  • Otros archivos (android/, ios/, web/) → SÍ (Y)

Luego instala las dependencias:

    flutter pub get

═══════════════════════════════════════════════════════════════════════
PASO 2: EJECUTAR SPRING BOOT BACKEND (OBLIGATORIO)
═══════════════════════════════════════════════════════════════════════

Este Flutter consume un backend Spring Boot en puerto 8080.

1. Exporta el Spring Boot desde el dashboard web
2. Descomprime y ejecuta:
   
   cd spring-boot-proyecto
   ./mvnw spring-boot:run   (Linux/Mac)
   mvnw.cmd spring-boot:run (Windows)

3. Verifica que esté corriendo:
   
   curl http://localhost:8080/api

═══════════════════════════════════════════════════════════════════════
PASO 3: CONFIGURAR CONEXIÓN AL BACKEND
═══════════════════════════════════════════════════════════════════════

Edita el archivo:  lib/config/api_config.dart

Para iOS/Mac:
  static const String baseUrl = 'http://localhost:8080/api';

Para Android Emulator:
  static const String baseUrl = 'http://10.0.2.2:8080/api';

Para dispositivo físico (misma red WiFi):
  static const String baseUrl = 'http://192.168.1.X:8080/api';

⚠️ IMPORTANTE: Debe ser puerto 8080 (Spring Boot), NO 3000 (Node.js)

═══════════════════════════════════════════════════════════════════════
PASO 4: EJECUTAR FLUTTER
═══════════════════════════════════════════════════════════════════════

    flutter run

Selecciona tu dispositivo/emulador cuando se solicite.

═══════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
═══════════════════════════════════════════════════════════════════════

❌ "No supported devices connected"
   → Ejecuta primero: flutter create .
   → Esto genera las carpetas android/, ios/, web/, etc.

❌ "Connection refused"
   → Verifica que Spring Boot esté corriendo en puerto 8080
   → Para Android usa 10.0.2.2 en lugar de localhost

❌ "404 Not Found"
   → Verifica los endpoints del Spring Boot
   → Asegúrate de que la URL termine en /api

RESUMEN DE COMANDOS
═══════════════════════════════════════════════════════════════════════

# Paso 1: Inicializar (solo una vez)
flutter create .
flutter pub get

# Paso 2: Spring Boot (en otra terminal)
cd ../spring-boot-proyecto
./mvnw spring-boot:run

# Paso 3: Configurar lib/config/api_config.dart

# Paso 4: Ejecutar Flutter
flutter run

📖 Para más detalles, consulta el archivo README.md

`;
  }
}

export default FlutterProjectBuilder;
