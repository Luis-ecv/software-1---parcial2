class ReadmeGenerator {
    generate(projectName, entities) {
        const endpoints = this.generateEndpointDocumentation(entities);
        const entityDocs = this.generateEntityDocumentation(entities);
        return `# 🚀 ${projectName} - API REST con Spring Boot
## 📋 Descripción

Proyecto generado automáticamente desde diagrama UML utilizando Spring Boot 3.2.0 y Java 17.
Este proyecto implementa una arquitectura en capas completa con:

- **Entities (JPA)**: Modelos de datos con relaciones
- **Repositories**: Acceso a datos con Spring Data JPA
- **Services**: Lógica de negocio
- **Controllers**: API REST con endpoints CRUD completos

## 🛠️ Tecnologías Utilizadas

- **Java 17**
- **Spring Boot 3.2.0**
  - Spring Web
  - Spring Data JPA
  - Spring Validation
  - Spring DevTools
- **PostgreSQL** (Base de datos)
- **Maven** (Gestión de dependencias)

## 📦 Estructura del Proyecto

\`\`\`
${projectName}/
├── src/
│   ├── main/
│   │   ├── java/com/example/demo/
│   │   │   ├── entities/          # Entidades JPA
│   │   │   ├── repositories/      # Repositorios Spring Data
│   │   │   ├── services/          # Lógica de negocio
│   │   │   ├── controllers/       # REST Controllers
│   │   │   ├── config/            # Configuraciones (CORS, etc)
│   │   │   ├── exceptions/        # Manejo de excepciones
│   │   │   └── DemoApplication.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── application.yml.example
│   └── test/
├── pom.xml
├── .gitignore
└── README.md
\`\`\`

## ⚙️ Configuración

### 1. Base de Datos PostgreSQL

Crea la base de datos en PostgreSQL:

\`\`\`sql
CREATE DATABASE ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')};
\`\`\`

### 2. Configurar Credenciales

Edita \`src/main/resources/application.properties\`:

\`\`\`properties
spring.datasource.url=jdbc:postgresql://localhost:5432/${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}
spring.datasource.username=tu_usuario
spring.datasource.password=tu_contraseña
\`\`\`

### 3. Estrategia de Base de Datos

Por defecto usa \`spring.jpa.hibernate.ddl-auto=update\`:
- **update**: Actualiza el schema sin eliminar datos
- **create**: Recrea las tablas (⚠️ elimina datos)
- **validate**: Solo valida el schema
- **none**: No hace cambios

## 🚀 Ejecución

### Usando Maven:

\`\`\`bash
./mvnw clean install
./mvnw spring-boot:run
\`\`\`

### Usando Java directamente:

\`\`\`bash
./mvnw clean package
java -jar target/${projectName}-1.0.0.jar
\`\`\`

La aplicación estará disponible en: **http://localhost:8080**

## � Integración con Flutter

Este backend está configurado para trabajar con aplicaciones Flutter móviles.

### ✅ CORS Habilitado

El proyecto incluye configuración CORS completa en \`config/CorsConfig.java\`:
- ✅ Permite peticiones desde cualquier origen (\`*\`)
- ✅ Soporta todos los métodos HTTP (GET, POST, PUT, DELETE, etc.)
- ✅ Permite todos los headers
- ✅ Habilita credenciales (cookies, authorization)

### 🧪 Verificar Conectividad

**Desde tu máquina (localhost):**
\`\`\`bash
curl http://localhost:8080/api
\`\`\`

**Desde Android Emulator:**
\`\`\`bash
# El emulador de Android usa 10.0.2.2 para acceder al localhost del host
curl http://10.0.2.2:8080/api
\`\`\`

**Desde dispositivo físico:**
1. Obtén tu IP local:
   - Windows: \`ipconfig\`
   - Mac/Linux: \`ifconfig\` o \`ip addr\`
2. Prueba desde el dispositivo: \`http://TU_IP:8080/api\`

### 📱 Configurar Flutter

En tu proyecto Flutter, edita \`lib/config/api_config.dart\`:

\`\`\`dart
class ApiConfig {
  // Para iOS Simulator / macOS
  static const String baseUrl = 'http://localhost:8080/api';
  
  // Para Android Emulator
  // static const String baseUrl = 'http://10.0.2.2:8080/api';
  
  // Para dispositivo físico
  // static const String baseUrl = 'http://TU_IP:8080/api';
}
\`\`\`

### 🔍 Troubleshooting de Conexión

**Error: "Connection refused"**
- ✅ Verifica que Spring Boot esté corriendo: \`./mvnw spring-boot:run\`
- ✅ Verifica que esté en puerto 8080
- ✅ Verifica el firewall/antivirus

**Error: "CORS policy"**
- ✅ El proyecto ya incluye configuración CORS
- ✅ Verifica que el endpoint empiece con \`/api\`
- ✅ Reinicia Spring Boot después de cambios

**Error: "404 Not Found"**
- ✅ Verifica que la URL incluya \`/api\` al inicio
- ✅ Ejemplo correcto: \`http://localhost:8080/api/nombreentidad\`
- ✅ Ejemplo incorrecto: \`http://localhost:8080/nombreentidad\`

## �📚 Entidades del Sistema

${entityDocs}

## 🌐 API Endpoints

Todos los endpoints están bajo el prefijo \`/api\`

${endpoints}

### 📋 Formato de Respuesta Estándar

#### Respuesta Exitosa:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa"
}
\`\`\`

#### Respuesta con Error:
\`\`\`json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalle técnico"
}
\`\`\`

## 🧪 Ejemplos de Uso

### Crear un Registro

\`\`\`bash
curl -X POST http://localhost:8080/api/entidad \\
  -H "Content-Type: application/json" \\
  -d '{
    "campo1": "valor1",
    "campo2": "valor2"
  }'
\`\`\`

### Obtener Todos los Registros

\`\`\`bash
curl http://localhost:8080/api/entidad
\`\`\`

### Obtener por ID

\`\`\`bash
curl http://localhost:8080/api/entidad/1
\`\`\`

### Actualizar

\`\`\`bash
curl -X PUT http://localhost:8080/api/entidad/1 \\
  -H "Content-Type: application/json" \\
  -d '{
    "campo1": "nuevo_valor"
  }'
\`\`\`

### Eliminar

\`\`\`bash
curl -X DELETE http://localhost:8080/api/entidad/1
\`\`\`

## 🔒 Seguridad y CORS

El proyecto incluye configuración CORS que permite todos los orígenes:
- **⚠️ Para producción**: Modificar \`CorsConfig.java\` y especificar orígenes permitidos

## 🧪 Probando el Backend

### Verificación Rápida (PowerShell)

Se incluye un script de prueba automática:

\`\`\`bash
# En Windows PowerShell
cd ruta/al/proyecto
.\\test-backend.ps1
\`\`\`

Este script:
- ✅ Verifica si Spring Boot está corriendo
- ✅ Prueba los endpoints principales
- ✅ Muestra respuestas detalladas
- ✅ Diagnostica errores comunes

### Verificación Manual

\`\`\`bash
# Probar en el navegador
http://localhost:8080/api/tuentidad

# O con curl
curl http://localhost:8080/api/tuentidad
\`\`\`

**Respuesta esperada (exitosa):**
\`\`\`json
{
  "success": true,
  "data": [],
  "message": "Mostrando 0 de 0 registros"
}
\`\`\`

**Si recibes Error 500:**
Ver el archivo \`DIAGNOSTICO_ERROR_500.md\` incluido en el proyecto.

## 📊 Base de Datos

### Configuración Inicial

**1. Crear base de datos en PostgreSQL:**
\`\`\`sql
CREATE DATABASE tu_base_de_datos;
\`\`\`

**2. Configurar credenciales en \`application.properties\`:**
\`\`\`properties
spring.datasource.url=jdbc:postgresql://localhost:5432/tu_base_de_datos
spring.datasource.username=postgres
spring.datasource.password=tu_password
\`\`\`

**3. Spring Boot creará las tablas automáticamente** al iniciar (gracias a \`ddl-auto=update\`)

### Estrategia de Relaciones JPA

El proyecto maneja automáticamente:
- **@OneToMany / @ManyToOne**: Relaciones 1 a muchos
- **@ManyToMany**: Relaciones muchos a muchos con tablas intermedias
- **@OneToOne**: Relaciones uno a uno
- **Cascade Types**: Configurados según tipo de relación
- **Lazy/Eager Loading**: Optimizado para cada caso

### Migraciones

Para mantener compatibilidad, usar \`ddl-auto=update\`. Para control total:
- Considera usar **Flyway** o **Liquibase** para migraciones versionadas

## 🐛 Debugging

### Logs

El proyecto está configurado con logs detallados:
- Queries SQL en consola
- Estadísticas de Hibernate
- Logs de Spring en nivel DEBUG

### DevTools

Spring Boot DevTools está habilitado para:
- Hot reload automático
- LiveReload en el navegador

## 📝 Validaciones

Todas las entidades incluyen validaciones Bean Validation:
- \`@NotNull\`: Campos obligatorios
- \`@NotBlank\`: Strings no vacíos
- Mensajes de error personalizados

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama de feature (\`git checkout -b feature/nueva-funcionalidad\`)
3. Commit tus cambios (\`git commit -m 'Agregar nueva funcionalidad'\`)
4. Push a la rama (\`git push origin feature/nueva-funcionalidad\`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto fue generado automáticamente y está disponible bajo licencia MIT.

## 🆘 Soporte

Para problemas o preguntas:
- Revisa los logs en consola
- Verifica la configuración de base de datos
- Asegúrate de tener Java 17 y PostgreSQL instalados

---

**Generado automáticamente desde diagrama UML** 🎨
`;
    }

    generateEntityDocumentation(entities) {
        let docs = '';
        entities.forEach((entity, index) => {
            const pkAttr = entity.attributes.find(attr => attr.isPrimaryKey);
            const regularAttrs = entity.attributes.filter(attr => !attr.isPrimaryKey && !attr.isRelationshipAttribute);
            docs += `
### ${index + 1}. ${entity.name}

**Primary Key**: \`${pkAttr ? pkAttr.name : 'id'}\` (${pkAttr ? pkAttr.type : 'Long'})

**Atributos**:
${regularAttrs.map(attr => `- \`${attr.name}\` (${attr.type})`).join('\n')}

**Tabla**: \`${this.toSnakeCase(entity.name)}\`

`;
        });
        return docs;
    }

    generateEndpointDocumentation(entities) {
        let docs = '';
        entities.forEach(entity => {
            const entityPath = this.toKebabCase(entity.name);
            const pkType = this.getPrimaryKeyType(entity);
            docs += `
### ${entity.name} (\`/api/${entityPath}\`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | \`/api/${entityPath}\` | Obtener todos los ${entity.name} |
| GET | \`/api/${entityPath}/{id}\` | Obtener ${entity.name} por ID |
| POST | \`/api/${entityPath}\` | Crear nuevo ${entity.name} |
| PUT | \`/api/${entityPath}/{id}\` | Actualizar ${entity.name} |
| DELETE | \`/api/${entityPath}/{id}\` | Eliminar ${entity.name} |
| GET | \`/api/${entityPath}/count\` | Contar total de registros |
| GET | \`/api/${entityPath}/exists/{id}\` | Verificar si existe |
| GET | \`/api/${entityPath}/ordered\` | Obtener ordenados por ID |

`;
            const searchableAttrs = entity.attributes.filter(attr => 
                !attr.isPrimaryKey && 
                !attr.isForeignKey && 
                !attr.isRelationshipAttribute &&
                attr.type === 'String'
            );
            if (searchableAttrs.length > 0) {
                docs += `**Búsquedas Personalizadas**:
`;
                searchableAttrs.forEach(attr => {
                    docs += `- GET \`/api/${entityPath}/search/${this.toKebabCase(attr.name)}?${this.toCamelCase(attr.name)}=valor\` - Buscar por ${attr.name}\n`;
                });
                docs += '\n';
            }
        });
        return docs;
    }

    getPrimaryKeyType(entity) {
        const pkAttr = entity.attributes.find(attr => attr.isPrimaryKey);
        if (!pkAttr) {
            // Buscar en padre si es herencia
            const inheritanceRel = this.relationships.find(rel =>
                rel.type === 'inheritance' &&
                rel.target === entity.id &&
                rel.sourceMultiplicity === '1'
            );
            if (inheritanceRel) {
                const parentEntity = this.entities.find(e => e.id === inheritanceRel.source);
                if (parentEntity) {
                    return this.getPrimaryKeyType(parentEntity);
                }
            }
            return 'Long';
        }
        const typeMap = {
            'String': 'String',
            'Integer': 'Integer',
            'Long': 'Long'
        };
        return typeMap[pkAttr.type] || 'Long';
    }

    toSnakeCase(str) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    toKebabCase(str) {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase();
    }

    toCamelCase(str) {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }
}

export default ReadmeGenerator;