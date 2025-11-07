class FlutterMainGenerator {
  constructor(projectName) {
    this.projectName = projectName;
  }

  generateMain(entities) {
    const listImports = entities.map(entity =>
      `import 'screens/${entity.name.toLowerCase()}_list_screen.dart';`
    ).join('\n');
    const formImports = entities.map(entity =>
      `import 'screens/${entity.name.toLowerCase()}_form_screen.dart';`
    ).join('\n');
    const imports = `${listImports}\n${formImports}`;
    const routes = entities.flatMap(entity => [
      `        '/${entity.name.toLowerCase()}_list': (context) => ${this.capitalizeFirst(entity.name)}ListScreen(),`,
      `        '/${entity.name.toLowerCase()}_form': (context) => ${this.capitalizeFirst(entity.name)}FormScreen(),`
    ]).join('\n');
    return `import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
${imports}

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${this.projectName}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.symmetric(vertical: 12, horizontal: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        cardTheme: CardThemeData(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      home: HomeScreen(),
      routes: {
${routes}
      },
    );
  }
}
`;
  }

  generatePubspec() {
    return `name: ${this.projectName}
description: Sistema CRUD generado automáticamente desde diagrama UML
version: 1.0.0+1

environment:
  sdk: ">=2.17.0 <3.0.0"

dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true
`;
  }

  generateApiConfig() {
    return `import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConfig {
  // ⚠️⚠️⚠️ CONFIGURACIÓN CRÍTICA: URL del Backend Spring Boot
  // 
  // El proyecto Flutter consume el backend Spring Boot generado
  // desde el MISMO diagrama UML. El Spring Boot corre en puerto 8080.
  //
  // Este archivo detecta AUTOMÁTICAMENTE el dispositivo y usa la URL correcta.
  
  /// Obtiene la URL base correcta según la plataforma
  static String get baseUrl {
    if (kIsWeb) {
      // 🌐 Web (Chrome, Edge, etc.)
      return 'http://localhost:8080/api';
    } else if (Platform.isAndroid) {
      // 🤖 Android Emulator
      // 10.0.2.2 es la IP del host (tu PC) desde el emulador de Android
      return 'http://10.0.2.2:8080/api';
    } else if (Platform.isIOS) {
      // 📱 iOS Simulator
      return 'http://localhost:8080/api';
    } else if (Platform.isMacOS || Platform.isLinux || Platform.isWindows) {
      // 🖥️ Desktop (Windows, macOS, Linux)
      return 'http://localhost:8080/api';
    }
    
    // Por defecto
    return 'http://localhost:8080/api';
  }
  
  // � PARA DISPOSITIVO FÍSICO (teléfono/tablet real)
  // 
  // Si estás ejecutando en un dispositivo FÍSICO conectado a la misma
  // red WiFi, necesitas usar la IP LOCAL de tu computadora.
  // 
  // 1. Obtener tu IP local:
  //    Windows: ipconfig (busca "IPv4 Address")
  //    Mac/Linux: ifconfig o ip addr (busca "inet")
  //    Ejemplo: 192.168.1.100
  // 
  // 2. Modificar temporalmente este archivo:
  //    Cambiar la línea de Platform.isAndroid o Platform.isIOS a:
  //    return 'http://TU_IP_LOCAL:8080/api';
  //    Ejemplo: return 'http://192.168.1.100:8080/api';
  // 
  // 3. Asegurarse que el firewall permita conexiones en puerto 8080
  // 
  // VERIFICACIÓN DE CONEXIÓN
  // 
  // Antes de ejecutar Flutter, verifica que Spring Boot esté corriendo:
  // 
  // Desde tu navegador: http://localhost:8080/api
  // Desde Android emulator: http://10.0.2.2:8080/api
  // 
  // Si obtienes respuesta JSON, la conexión funciona!
  // 
  // RECORDATORIO DE PUERTOS
  // ════════════════════════════════════════════════════════════════
  // 
  // ❌ Puerto 3000: Node.js/Express (solo generador de proyectos)
  // ✅ Puerto 8080: Spring Boot (backend REST API que consume Flutter)
  // 
  // CORS está HABILITADO en Spring Boot para permitir peticiones
  // desde cualquier origen durante desarrollo.
}
`;
  }

  generateReadme() {
    return `# ${this.projectName}

Sistema CRUD generado automáticamente desde diagrama UML.

## ⚠️ CONFIGURACIÓN INICIAL OBLIGATORIA

**ANTES DE EJECUTAR:** Este proyecto necesita ser inicializado con Flutter.

### Paso 1: Inicializar proyecto Flutter
\`\`\`bash
# Navega a la carpeta del proyecto
cd ${this.projectName}_flutter

# Inicializa las plataformas (Android, iOS, Web, etc.)
flutter create .

# Cuando pregunte si sobrescribir archivos, responde:
# - NO para lib/ (mantener nuestro código)
# - SÍ para android/, ios/, web/ (generar configuración)
\`\`\`

### Paso 2: Instalar dependencias
\`\`\`bash
flutter pub get
\`\`\`

### Paso 3: Configurar conexión al backend
Editar \`lib/config/api_config.dart\` con la URL correcta del Spring Boot (puerto 8080).

### Paso 4: Ejecutar
\`\`\`bash
flutter run
\`\`\`

---

## ⚠️ IMPORTANTE: Arquitectura del Sistema

Este proyecto Flutter es el **FRONTEND MÓVIL** que consume el **BACKEND SPRING BOOT** generado desde el mismo diagrama UML.

### Arquitectura Completa:

\`\`\`
┌─────────────────────────────────────┐
│     Flutter App (este proyecto)     │
│     Frontend Mobile                 │
└────────────┬────────────────────────┘
             │ HTTP Requests
             │ (puerto 8080)
             ▼
┌─────────────────────────────────────┐
│     Spring Boot Backend             │
│     (generar por separado)          │
│     Puerto: 8080                    │
└────────────┬────────────────────────┘
             │ JDBC/JPA
             ▼
┌─────────────────────────────────────┐
│     Base de Datos                   │
│     (MySQL/PostgreSQL/H2)           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Node.js/Express                 │
│     Puerto: 3000                    │
│     Solo para GENERAR proyectos     │
│     (NO se usa en runtime)          │
└─────────────────────────────────────┘
\`\`\`

## 🚀 Pasos para Ejecutar (ORDEN IMPORTANTE)

### 0. PRIMERO: Inicializar el proyecto Flutter (OBLIGATORIO)

⚠️ **IMPORTANTE:** Este paso solo se hace UNA vez después de descomprimir.

\`\`\`bash
cd ${this.projectName}_flutter

# Inicializar las plataformas de Flutter
flutter create .

# Cuando Flutter pregunte:
# - ¿Sobrescribir lib/main.dart? → NO (n)
# - ¿Sobrescribir pubspec.yaml? → NO (n)  
# - ¿Sobrescribir README.md? → NO (n)
# - Otros archivos → SÍ (Y)

# Instalar dependencias
flutter pub get
\`\`\`

**Nota:** \`flutter create .\` genera las carpetas android/, ios/, web/, etc. que Flutter necesita para ejecutarse en diferentes plataformas.

### 1. SEGUNDO: Generar y Ejecutar Spring Boot

\`\`\`bash
# Desde el dashboard web, exportar el Spring Boot
# Descomprimir proyecto_springboot.zip

cd proyecto_springboot
./mvnw spring-boot:run

# Verificar que esté corriendo:
curl http://localhost:8080/api/nuevaclase3
\`\`\`

### 2. TERCERO: Configurar y Ejecutar Flutter

\`\`\`bash
# Volver al proyecto Flutter
cd ${this.projectName}_flutter

# ⚠️ EDITAR lib/config/api_config.dart
# Cambiar la URL para que apunte a Spring Boot (puerto 8080)

flutter run
\`\`\`

## 📋 Características

- ✅ Aplicación Flutter completa
- ✅ CRUD completo para cada entidad
- ✅ Gestión de relaciones con dropdowns
- ✅ Validación de formularios
- ✅ Manejo de errores
- ✅ Interfaz Material Design

## Requisitos

- Flutter SDK 2.17 o superior
- Dart 2.17 o superior
- **Spring Boot backend ejecutándose** (puerto 8080)
- Emulador/Simulador o dispositivo físico

## ⚙️ Configuración Crítica

### Configurar la URL del Backend Spring Boot

**PASO OBLIGATORIO:** Editar \`lib/config/api_config.dart\`

\`\`\`dart
class ApiConfig {
  // ⚠️ Debe apuntar a SPRING BOOT (puerto 8080)
  
  // Para iOS Simulator / macOS:
  static const String baseUrl = 'http://localhost:8080/api';
  
  // Para Android Emulator:
  // static const String baseUrl = 'http://10.0.2.2:8080/api';
  
  // Para dispositivo físico (misma red WiFi):
  // static const String baseUrl = 'http://192.168.1.X:8080/api';
}
\`\`\`

**IMPORTANTE:**
- ❌ NO usar puerto 3000 (ese es el generador Node.js)
- ✅ SÍ usar puerto 8080 (ese es el Spring Boot)

## 📦 Instalación

1. Instalar dependencias:
\`\`\`bash
flutter pub get
\`\`\`

2. **Verificar que Spring Boot esté corriendo:**
\`\`\`bash
curl http://localhost:8080/api/nuevaclase3
# Debe responder con JSON
\`\`\`

3. Configurar la URL del backend en \`lib/config/api_config.dart\` (ver arriba)

4. Ejecutar la aplicación:
\`\`\`bash
flutter run
\`\`\`

## 🔗 Conexión con Spring Boot

### Verificar Conectividad

Antes de ejecutar el Flutter, asegúrate de que el Spring Boot esté accesible:

\`\`\`bash
# Desde la máquina host
curl http://localhost:8080/api/nuevaclase3

# Si usas Android emulator
curl http://10.0.2.2:8080/api/nuevaclase3
\`\`\`

### Troubleshooting de Conexión

**Error: "Connection refused"**
- ✅ Verificar que Spring Boot esté corriendo
- ✅ Verificar que esté en puerto 8080
- ✅ Para Android: usar 10.0.2.2 en lugar de localhost
- ✅ Para iOS: usar localhost
- ✅ Verificar firewall/antivirus

**Error: "404 Not Found"**
- ✅ Verificar que los endpoints existan en Spring Boot
- ✅ Verificar que la URL tenga /api al final
- ✅ Probar los endpoints con Postman/curl primero

## 🌐 Configuración del Backend Spring Boot

Asegúrate de que el backend esté ejecutándose y sea accesible desde tu dispositivo:

- **Emulador Android**: Spring Boot debe estar en \`http://10.0.2.2:8080/api\`
- **Emulador iOS**: Spring Boot debe estar en \`http://localhost:8080/api\`
- **Dispositivo físico**: Spring Boot debe estar en \`http://192.168.1.X:8080/api\`

### CORS en Spring Boot

Si tienes problemas de CORS, asegúrate de que el Spring Boot tenga configurado:

\`\`\`java
@Configuration
public class WebConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                    .allowedOrigins("*")
                    .allowedMethods("GET", "POST", "PUT", "DELETE");
            }
        };
    }
}
\`\`\`

## 📁 Estructura del Proyecto

\`\`\`
lib/
├── config/
│   └── api_config.dart        # Configuración de API
├── models/                    # Modelos de datos
├── services/                  # Servicios HTTP
├── screens/                   # Pantallas de la app
│   ├── home_screen.dart      # Pantalla principal
│   ├── *_list_screen.dart    # Pantallas de listado
│   └── *_form_screen.dart    # Pantallas de formulario
└── main.dart                  # Punto de entrada
\`\`\`

## Entidades

El proyecto incluye CRUD completo para las siguientes entidades:

${this.generateEntityList()}

## Funcionalidades por Entidad

Cada entidad cuenta con:

- 📋 **Lista**: Visualización de todos los registros
- ➕ **Crear**: Formulario para agregar nuevos registros
- ✏️ **Editar**: Formulario para modificar registros existentes
- 🗑️ **Eliminar**: Confirmación y eliminación de registros
- 🔍 **Validación**: Validación de campos obligatorios
- 🔗 **Relaciones**: Dropdowns para claves foráneas

## Notas

- Los campos que son PK y FK al mismo tiempo se muestran como dropdowns obligatorios
- Las claves foráneas normales se cargan como dropdowns
- La aplicación valida automáticamente los campos requeridos
- Se incluye manejo de errores y mensajes informativos

## Desarrollo

Para agregar nuevas funcionalidades:

1. Modifica los modelos en \`lib/models/\`
2. Actualiza los servicios en \`lib/services/\`
3. Ajusta las pantallas en \`lib/screens/\`

## Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.
`;
  }

  generateEntityList() {
    return '- Consulta las carpetas models/, services/ y screens/ para ver todas las entidades';
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default FlutterMainGenerator;
