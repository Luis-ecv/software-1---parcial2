import path from 'path';
import fs from 'fs';
import { rm } from 'fs/promises';
import DiagramParser from './DiagramParser.js';
import MetadataBuilder from './MetadataBuilder.js';
import EntityGenerator from './EntityGenerator.js';
import ManyToManyEntityGenerator from './ManyToManyEntityGenerator.js';
import RepositoryGenerator from './RepositoryGenerator.js';
import ServiceGenerator from './ServiceGenerator.js';
import ControllerGenerator from './ControllerGenerator.js';
import ReadmeGenerator from './ReadmeGenerator.js';
import DTOGenerator from './DTOGenerator.js';
import MapperGenerator from './MapperGenerator.js';

class SpringBootProjectBuilder {

    constructor(titulo, xmlString, rutaBase) {
        this.titulo = titulo;
        this.xmlString = xmlString;
        this.rutaBase = rutaBase;
        this.projectPath = path.join(rutaBase, titulo);
        this.diagramParser = new DiagramParser();
        this.parsedDiagram = null;
        this.metadata = null;
    }

    async build() {
        this.parsedDiagram = this.diagramParser.parse(this.xmlString);
        const metadataBuilder = new MetadataBuilder(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships
        );
        this.metadata = metadataBuilder.build();
        await this.cleanDirectory();
        this.createDirectoryStructure();
        this.generateConfigFiles();
        this.generateEntities();
    this.generateManyToManyEntities();
        this.generateDTOs();
        this.generateMappers();
        this.generateRepositories();
        this.generateServices();
        this.generateControllers();
        this.generateConfigClasses();
        this.generateMainApplication();
        this.generateReadme();
    }

    async cleanDirectory() {
        if (fs.existsSync(this.projectPath)) {
            await rm(this.projectPath, { recursive: true, force: true });
        }
    }

    createDirectoryStructure() {
        const dirs = [
            'src/main/java/com/example/demo/entities',
            'src/main/java/com/example/demo/repositories',
            'src/main/java/com/example/demo/services',
            'src/main/java/com/example/demo/controllers',
            'src/main/java/com/example/demo/config',
            'src/main/java/com/example/demo/exceptions',
            'src/main/java/com/example/demo/dto',
            'src/main/java/com/example/demo/mappers',
            'src/main/resources',
            'src/test/java/com/example/demo'
        ];
        dirs.forEach(dir => {
            const fullPath = path.join(this.projectPath, dir);
            fs.mkdirSync(fullPath, { recursive: true });
        });
    }

    generateConfigFiles() {
        this.generatePomXml();
        this.generateApplicationProperties();
        this.generateApplicationYml();
    }

    generatePomXml() {
        const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>
    
    <groupId>com.example</groupId>
    <artifactId>${this.titulo}</artifactId>
    <version>1.0.0</version>
    <name>${this.titulo}</name>
    <description>Proyecto Spring Boot generado desde diagrama UML</description>
    
    <properties>
        <java.version>17</java.version>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-hibernate5-jakarta</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                    <encoding>UTF-8</encoding>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
        fs.writeFileSync(path.join(this.projectPath, 'pom.xml'), pom);
    }

    generateApplicationProperties() {
        const dbName = this.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const props = `# ===================================================================
# CONFIGURACIÓN DE SPRING BOOT - ${this.titulo}
# ===================================================================

# Puerto del servidor
server.port=8080

# CONFIGURACIÓN DE BASE DE DATOS POSTGRESQL
# ===================================================================
spring.datasource.url=jdbc:postgresql://localhost:5432/${dbName}
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# Pool de conexiones Hikari
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000

# ===================================================================
# CONFIGURACIÓN DE JPA/HIBERNATE
# ===================================================================
# Estrategia DDL: update, create, create-drop, validate, none
spring.jpa.hibernate.ddl-auto=update

# Mostrar SQL en consola
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# Dialecto PostgreSQL
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# Naming strategy (convierte camelCase a snake_case)
spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy
spring.jpa.hibernate.naming.implicit-strategy=org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy

# Configuración de fetching
spring.jpa.properties.hibernate.enable_lazy_load_no_trans=true
spring.jpa.open-in-view=false

# Estadísticas de Hibernate
spring.jpa.properties.hibernate.generate_statistics=false

# ===================================================================
# CONFIGURACIÓN DE LOGGING
# ===================================================================
logging.level.root=INFO
logging.level.com.example.demo=DEBUG
logging.level.org.springframework.web=DEBUG
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE
logging.level.org.hibernate.stat=DEBUG

# ===================================================================
# CONFIGURACIÓN DE JACKSON (JSON)
# ===================================================================
spring.jackson.serialization.fail-on-empty-beans=false
spring.jackson.serialization.write-dates-as-timestamps=false
spring.jackson.default-property-inclusion=non_null
spring.jackson.deserialization.fail-on-unknown-properties=false

# ===================================================================
# CONFIGURACIÓN DE SPRING MVC
# ===================================================================
spring.mvc.throw-exception-if-no-handler-found=true
spring.web.resources.add-mappings=false

spring.validation.enabled=true

spring.transaction.default-timeout=30
`;
        fs.writeFileSync(
            path.join(this.projectPath, 'src/main/resources/application.properties'),
            props
        );
    }

    generateApplicationYml() {
        const dbName = this.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const yml = `# Configuración alternativa en formato YAML
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/${dbName}
    username: postgres
    password: postgres
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 30000
  
  jpa:
    hibernate:
      ddl-auto: update
      naming:
        physical-strategy: org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
  
  jackson:
    serialization:
      fail-on-empty-beans: false
      write-dates-as-timestamps: false
    default-property-inclusion: non_null

server:
  port: 8080

logging:
  level:
    root: INFO
    com.example.demo: DEBUG
    org.springframework.web: DEBUG
    org.hibernate.SQL: DEBUG
`;
        fs.writeFileSync(
            path.join(this.projectPath, 'src/main/resources/application.yml.example'),
            yml
        );
    }

    generateEntities() {
        const entityGenerator = new EntityGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships,
            this.parsedDiagram.manyToManyTables || []
        );
        const entities = entityGenerator.generateAll();
        const entitiesPath = path.join(this.projectPath, 'src/main/java/com/example/demo/entities');
        entities.forEach(entity => {
            fs.writeFileSync(path.join(entitiesPath, entity.name), entity.content);
        });
    }

    generateManyToManyEntities() {
        const tables = this.parsedDiagram.manyToManyTables || [];
        if (!tables || tables.length === 0) return;
        const mmGenerator = new ManyToManyEntityGenerator(tables, this.parsedDiagram.entities);
        const generated = mmGenerator.generateAll();
        const entitiesPath = path.join(this.projectPath, 'src/main/java/com/example/demo/entities');
        generated.forEach(tbl => {
            fs.writeFileSync(path.join(entitiesPath, tbl.name), tbl.content);
        });
    }

    generateDTOs() {
        const dtoGenerator = new DTOGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships
        );
        const dtos = dtoGenerator.generateAll();
        const dtoPath = path.join(this.projectPath, 'src/main/java/com/example/demo/dto');
        dtos.forEach(dto => {
            fs.writeFileSync(path.join(dtoPath, dto.name), dto.content);
        });
    }

    generateRepositories() {
        const repoGenerator = new RepositoryGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships,
            this.metadata
        );
        const repositories = repoGenerator.generateAll();
        const repoPath = path.join(this.projectPath, 'src/main/java/com/example/demo/repositories');
        repositories.forEach(repo => {
            fs.writeFileSync(path.join(repoPath, repo.name), repo.content);
        });
    }

    generateServices() {
        const serviceGenerator = new ServiceGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships,
            this.metadata
        );
        const services = serviceGenerator.generateAll();
        const servicePath = path.join(this.projectPath, 'src/main/java/com/example/demo/services');
        services.forEach(service => {
            fs.writeFileSync(path.join(servicePath, service.name), service.content);
        });
    }

    generateControllers() {
        const controllerGenerator = new ControllerGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships,
            this.metadata
        );
        const controllers = controllerGenerator.generateAll();
        const controllerPath = path.join(this.projectPath, 'src/main/java/com/example/demo/controllers');
        controllers.forEach(controller => {
            fs.writeFileSync(path.join(controllerPath, controller.name), controller.content);
        });
    }

    generateMappers() {
        const mapperGenerator = new MapperGenerator(
            this.parsedDiagram.entities,
            this.parsedDiagram.relationships,
            this.metadata
        );
        const mappers = mapperGenerator.generateAll();
        const mapperPath = path.join(this.projectPath, 'src/main/java/com/example/demo/mappers');
        mappers.forEach(mapper => {
            fs.writeFileSync(path.join(mapperPath, mapper.name), mapper.content);
        });
    }

    generateConfigClasses() {
        this.generateCorsConfig();
        this.generateGlobalExceptionHandler();
        this.generateWebConfig();
        this.generateJacksonConfig();
        this.generateEntityIdDeserializer();
    }

    generateCorsConfig() {
        const corsConfig = `package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * Configuración CORS para permitir peticiones desde Flutter y otras aplicaciones cliente
 * Esta configuración es necesaria para que el frontend móvil (Flutter) pueda
 * comunicarse con el backend Spring Boot
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Permitir credenciales (cookies, authorization headers, etc.)
        config.setAllowCredentials(true);
        
        // Permitir todos los orígenes (en producción, especifica los dominios permitidos)
        // Para Flutter local: http://localhost:*, http://10.0.2.2:*, etc.
        config.addAllowedOriginPattern("*");
        
        // Permitir todos los headers
        config.addAllowedHeader("*");
        
        // Métodos HTTP permitidos
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        
        // Tiempo de caché para preflight requests (OPTIONS)
        config.setMaxAge(3600L);
        
        // Headers expuestos al cliente
        config.setExposedHeaders(Arrays.asList(
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Requested-With",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials"
        ));
        
        // Aplicar configuración a todas las rutas /api/**
        source.registerCorsConfiguration("/api/**", config);
        
        // También aplicar a la raíz por si acaso
        source.registerCorsConfiguration("/**", config);
        
        return new CorsFilter(source);
    }
}
`;

        const configPath = path.join(this.projectPath, 'src/main/java/com/example/demo/config');
        fs.writeFileSync(path.join(configPath, 'CorsConfig.java'), corsConfig);
    }

    generateWebConfig() {
        const webConfig = `package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
    }
}
`;

        const configPath = path.join(this.projectPath, 'src/main/java/com/example/demo/config');
        fs.writeFileSync(path.join(configPath, 'WebConfig.java'), webConfig);
    }

    generateGlobalExceptionHandler() {
        const exceptionHandler = `package com.example.demo.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(
            RuntimeException ex, WebRequest request) {
        
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());
        body.put("path", request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(body, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(
            MethodArgumentNotValidException ex, WebRequest request) {
        
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "Errores de validación");
        body.put("errors", errors);
        
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGlobalException(
            Exception ex, WebRequest request) {
        
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "Error interno del servidor");
        body.put("details", ex.getMessage());
        body.put("path", request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
`;
        const exceptionsPath = path.join(this.projectPath, 'src/main/java/com/example/demo/exceptions');
        fs.writeFileSync(path.join(exceptionsPath, 'GlobalExceptionHandler.java'), exceptionHandler);
    }

    generateMainApplication() {
        const mainApp = `package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
        System.out.println("\\n==============================================");
        System.out.println("🚀 Aplicación ${this.titulo} iniciada");
        System.out.println("📡 API REST disponible en: http://localhost:8080/api");
        System.out.println("==============================================\\n");
    }
}
`;
        fs.writeFileSync(
            path.join(this.projectPath, 'src/main/java/com/example/demo/DemoApplication.java'),
            mainApp
        );
    }

    generateReadme() {
        const readmeGenerator = new ReadmeGenerator();
        const readmeContent = readmeGenerator.generate(this.titulo, this.parsedDiagram.entities);
        fs.writeFileSync(path.join(this.projectPath, 'README.md'), readmeContent);
        this.generateQuickStartGuide();
        this.generateGitignore();
    }

    generateQuickStartGuide() {
        const quickStart = `╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║    🚀 GUÍA RÁPIDA - Spring Boot Backend (Puerto 8080)             ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

Este es el backend Spring Boot que tu aplicación Flutter va a consumir.

═══════════════════════════════════════════════════════════════════════
PASO 1: CONFIGURAR BASE DE DATOS
═══════════════════════════════════════════════════════════════════════

Opción A: PostgreSQL (Recomendado)
-----------------------------------
1. Instala PostgreSQL
2. Crea la base de datos:
   
   CREATE DATABASE ${this.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_')};

3. Edita src/main/resources/application.properties:
   
   spring.datasource.username=tu_usuario
   spring.datasource.password=tu_password

Opción B: H2 (Base de datos en memoria - para testing)
-------------------------------------------------------
Cambia en application.properties:
spring.jpa.hibernate.ddl-auto=create-drop

═══════════════════════════════════════════════════════════════════════
PASO 2: EJECUTAR EL BACKEND
═══════════════════════════════════════════════════════════════════════

En Windows:
-----------
mvnw.cmd clean install
mvnw.cmd spring-boot:run

En Mac/Linux:
-------------
./mvnw clean install
./mvnw spring-boot:run

⏱️  Espera a ver: "Started DemoApplication in X seconds"

═══════════════════════════════════════════════════════════════════════
PASO 3: VERIFICAR QUE FUNCIONA
═══════════════════════════════════════════════════════════════════════

Abre tu navegador o usa curl:

http://localhost:8080/api

Deberías ver una respuesta JSON (aunque sea un error de "no encontrado")

═══════════════════════════════════════════════════════════════════════
PASO 4: CONFIGURAR FLUTTER PARA CONECTARSE
═══════════════════════════════════════════════════════════════════════

En tu proyecto Flutter, edita: lib/config/api_config.dart

Para iOS/Mac:
  static const String baseUrl = 'http://localhost:8080/api';

Para Android Emulator:
  static const String baseUrl = 'http://10.0.2.2:8080/api';

Para Dispositivo Físico:
  1. Obtén tu IP: ipconfig (Windows) o ifconfig (Mac/Linux)
  2. Usa: static const String baseUrl = 'http://TU_IP:8080/api';

═══════════════════════════════════════════════════════════════════════
CONFIGURACIÓN CORS (YA INCLUIDA)
═══════════════════════════════════════════════════════════════════════

✅ CORS está HABILITADO en src/main/java/com/example/demo/config/CorsConfig.java
✅ Permite peticiones desde cualquier origen (*)
✅ Soporta todos los métodos HTTP
✅ Permite todos los headers

No necesitas configurar nada adicional!

═══════════════════════════════════════════════════════════════════════
ENDPOINTS DISPONIBLES
═══════════════════════════════════════════════════════════════════════

Todos los endpoints están bajo /api

Ejemplos:
  GET    http://localhost:8080/api/nombreentidad
  POST   http://localhost:8080/api/nombreentidad
  GET    http://localhost:8080/api/nombreentidad/{id}
  PUT    http://localhost:8080/api/nombreentidad/{id}
  DELETE http://localhost:8080/api/nombreentidad/{id}

═══════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
═══════════════════════════════════════════════════════════════════════

❌ Error: "Failed to configure a DataSource"
   → Verifica que PostgreSQL esté corriendo
   → Verifica las credenciales en application.properties

❌ Error: "Connection refused" desde Flutter
   → Verifica que Spring Boot esté corriendo (puerto 8080)
   → Para Android: usa 10.0.2.2 en lugar de localhost
   → Verifica firewall/antivirus

❌ Error: "Port 8080 already in use"
   → Otro proceso usa el puerto 8080
   → Cambia el puerto en application.properties: server.port=8081

═══════════════════════════════════════════════════════════════════════
COMANDOS ÚTILES
═══════════════════════════════════════════════════════════════════════

Compilar:
  ./mvnw clean install

Ejecutar:
  ./mvnw spring-boot:run

Ejecutar con perfil específico:
  ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

Ver logs en tiempo real:
  tail -f logs/application.log

═══════════════════════════════════════════════════════════════════════

📖 Para más detalles, consulta README.md

🔗 Documentación Spring Boot: https://spring.io/projects/spring-boot
`;
        fs.writeFileSync(path.join(this.projectPath, '⚠️ INICIO_RAPIDO.txt'), quickStart);
    }

    generateGitignore() {
        const gitignore = `# Compiled class files
*.class

# Log files
*.log

# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml

# Gradle
.gradle/
build/

# IntelliJ IDEA
.idea/
*.iml
*.iws
*.ipr
out/

# Eclipse
.classpath
.project
.settings/
bin/

# NetBeans
/nbproject/private/
/nbbuild/
/dist/
/nbdist/
/.nb-gradle/

# VS Code
.vscode/

# macOS
.DS_Store

# Windows
Thumbs.db

# Application specific
application-local.properties
application-dev.properties

# Spring Boot DevTools
spring-boot-devtools.properties
`;
        fs.writeFileSync(path.join(this.projectPath, '.gitignore'), gitignore);
    }

    generateJacksonConfig() {
        const jacksonConfig = `package com.example.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.hibernate5.jakarta.Hibernate5JakartaModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper objectMapper = builder.createXmlMapper(false).build();
        
        // Módulo para manejar proxies de Hibernate
        Hibernate5JakartaModule hibernateModule = new Hibernate5JakartaModule();
        hibernateModule.enable(Hibernate5JakartaModule.Feature.FORCE_LAZY_LOADING);
        objectMapper.registerModule(hibernateModule);
        
        // Configurar para manejar fechas correctamente
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        
        // Evitar problemas con referencias circulares
        objectMapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
        
        // IMPORTANTE: Aceptar nombres de propiedades en snake_case y convertirlos a camelCase
        objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        
        // Aceptar propiedades desconocidas sin fallar
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        
        // Aceptar nombres de propiedades de forma case-insensitive
        objectMapper.configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES, true);
        
        return objectMapper;
    }
}
`;
        const configPath = path.join(this.projectPath, 'src/main/java/com/example/demo/config');
        fs.writeFileSync(path.join(configPath, 'JacksonConfig.java'), jacksonConfig);
    }

    generateEntityIdDeserializer() {
        const deserializerCode = `package com.example.demo.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

/**
 * Deserializador personalizado para entidades JPA
 * Permite enviar solo el ID de una entidad relacionada
 * Ejemplo: { "codigoNuevaclase": 123 } crea un objeto Nuevaclase temporal con codigo=123
 * El Service luego resolverá la entidad completa desde la base de datos
 */
@Component
public class EntityIdDeserializer extends JsonDeserializer<Object> {

    @Override
    public Object deserialize(JsonParser jsonParser, DeserializationContext context) throws IOException {
        JsonNode node = jsonParser.getCodec().readTree(jsonParser);
        
        // Si el valor es null, retornar null
        if (node.isNull()) {
            return null;
        }
        
        // Si es un número o texto (ID), crear un objeto temporal con solo el ID
        if (node.isNumber() || node.isTextual()) {
            try {
                // Obtener el tipo de clase de la entidad
                Class<?> entityClass = context.getContextualType().getRawClass();
                
                // Crear una nueva instancia de la entidad
                Constructor<?> constructor = entityClass.getDeclaredConstructor();
                constructor.setAccessible(true);
                Object entity = constructor.newInstance();
                
                // Convertir el ID al tipo correcto
                Object id;
                if (node.isNumber()) {
                    id = node.asLong();
                } else {
                    id = node.asText();
                }
                
                // Buscar el setter del ID (buscar métodos que empiecen con "set")
                // Intentar con diferentes nombres comunes de PK
                String[] possibleIdSetters = {"setId", "setCodigo", "setKey", "setPk"};
                boolean setterFound = false;
                
                for (String setterName : possibleIdSetters) {
                    try {
                        Method setter = findSetterMethod(entityClass, setterName);
                        if (setter != null) {
                            // Convertir el ID al tipo del parámetro del setter
                            Class<?> paramType = setter.getParameterTypes()[0];
                            Object convertedId = convertId(id, paramType);
                            setter.invoke(entity, convertedId);
                            setterFound = true;
                            break;
                        }
                    } catch (Exception e) {
                        // Intentar con el siguiente setter
                        continue;
                    }
                }
                
                // Si no se encontró un setter estándar, buscar cualquier setter que acepte el tipo de ID
                if (!setterFound) {
                    for (Method method : entityClass.getDeclaredMethods()) {
                        if (method.getName().startsWith("set") && method.getParameterCount() == 1) {
                            try {
                                Class<?> paramType = method.getParameterTypes()[0];
                                if (isNumericType(paramType) || paramType.equals(String.class)) {
                                    Object convertedId = convertId(id, paramType);
                                    method.invoke(entity, convertedId);
                                    setterFound = true;
                                    break;
                                }
                            } catch (Exception e) {
                                // Intentar con el siguiente setter
                                continue;
                            }
                        }
                    }
                }
                
                return entity;
            } catch (Exception e) {
                System.err.println("Error en EntityIdDeserializer: " + e.getMessage());
                e.printStackTrace();
                return null;
            }
        }
        
        // Si es un objeto completo, deserializar normalmente
        return context.readValue(jsonParser, context.getContextualType());
    }
    
    private Method findSetterMethod(Class<?> clazz, String setterName) {
        try {
            // Intentar con diferentes tipos de parámetros
            Class<?>[] possibleTypes = {Long.class, long.class, Integer.class, int.class, String.class};
            for (Class<?> type : possibleTypes) {
                try {
                    return clazz.getMethod(setterName, type);
                } catch (NoSuchMethodException e) {
                    // Intentar con el siguiente tipo
                    continue;
                }
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }
    
    private Object convertId(Object id, Class<?> targetType) {
        if (targetType.equals(Long.class) || targetType.equals(long.class)) {
            if (id instanceof Number) {
                return ((Number) id).longValue();
            }
            return Long.parseLong(id.toString());
        } else if (targetType.equals(Integer.class) || targetType.equals(int.class)) {
            if (id instanceof Number) {
                return ((Number) id).intValue();
            }
            return Integer.parseInt(id.toString());
        } else if (targetType.equals(String.class)) {
            return id.toString();
        }
        return id;
    }
    
    private boolean isNumericType(Class<?> type) {
        return type.equals(Long.class) || type.equals(long.class) ||
               type.equals(Integer.class) || type.equals(int.class) ||
               type.equals(Double.class) || type.equals(double.class) ||
               type.equals(Float.class) || type.equals(float.class);
    }
}
`;
        const configPath = path.join(this.projectPath, 'src/main/java/com/example/demo/config');
        fs.writeFileSync(path.join(configPath, 'EntityIdDeserializer.java'), deserializerCode);
    }

    getProjectPath() {
        return this.projectPath;
    }
}

export default SpringBootProjectBuilder;