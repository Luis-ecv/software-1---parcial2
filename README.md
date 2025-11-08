# Proyecto Diagrama colaborativo (Frontend + Backend)

Resumen rápido
- Stack: Frontend en React (Vite + Tailwind) y Backend en Node.js (Express) con Socket.IO y PostgreSQL (pg).
- Objetivo: editor de diagramas UML colaborativo en tiempo real. Autenticación con JWT (cookie), persistencia en Postgres y sincronización en tiempo real con Socket.IO.

Contenido del README
- Requisitos
- Instalación y ejecución local (Windows / PowerShell)
- Variables de entorno (.env)
- Base de datos: esquema / archivo SQL
- Endpoints HTTP del backend
- Eventos WebSocket (Socket.IO)
- Funcionalidades principales del frontend
- Depuración y notas importantes

---

## Requisitos
- Node.js >= 18 y npm (o pnpm/yarn) instalado
- PostgreSQL (local o remoto)
- Git (opcional)

Recomendado para Windows: PowerShell como terminal (las instrucciones abajo usan PowerShell).

## Estructura relevante
- `backend/` — servidor Express + Socket.IO, modelos y rutas.
- `frontend/` — aplicación React + Vite.
- `backend/src/config/database.sql` — script con esquema (si aplica).

## Instalación y ejecución local
1. Clona el repositorio (si no lo has hecho):

```powershell
git clone <https://github.com/Luis-ecv/software-1---parcial2.git> project-folder
cd project-folder
```

2. Configura la base de datos PostgreSQL:
- Crea una base de datos y un usuario (por ejemplo: `diagrama_dev`).
- Ejecuta el SQL disponible en `backend/src/config/database.sql` para crear tablas.

Ejemplo (PowerShell + psql):

```powershell
# Crear DB (ajusta según tu instalación)
psql -U postgres -c "CREATE DATABASE diagrama_dev;"
# Ejecutar esquema
psql -U postgres -d diagrama_dev -f "./backend/src/config/database.sql"
```

3. Configura variables de entorno (archivo `.env`) en `backend/`:

Crea `backend/.env` con (ejemplo):

```
PORT=8083
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mi_password
DB_NAME=diagrama_dev
TOKEN_SECRET=frase_secreta_para_jwt
FRONTEND_URL=http://localhost:5173
# Opcional: override para websocket desde frontend
VITE_WS_URL=http://localhost:8083
```

Asegúrate de que `FRONTEND_URL` coincida con la URL donde levantas el frontend (por defecto Vite usa `http://localhost:5173`).

4. Instala dependencias y ejecuta backend:

```powershell
cd backend
npm install
npm run dev
```

El backend por defecto escucha en `http://localhost:8083` (puedes cambiar `PORT` en `.env`).

5. Instala dependencias y ejecuta frontend:

```powershell
cd frontend
npm install
npm run dev
```

Vite normalmente sirve en `http://localhost:5173`.

---

## Endpoints principales del backend (HTTP)
Todos los endpoints están montados bajo la ruta base `/apis`.

Autenticación / usuarios:
- `POST /apis/register` — registrar usuario. Body: { name, email, password }
- `POST /apis/login` — iniciar sesión. Body: { email, password }. Establece cookie `token` con JWT.
- `POST /apis/logout` — cerrar sesión (limpia cookie).
- `GET /apis` — perfil (requiere cookie/token). Devuelve { id, email, name } si autenticado.

Salas / Tableros (`sala`):
- `GET /apis/sala` — devuelve tableros del usuario autenticado. (Respuesta: `{ error: false, data: [...] }` o `[]`).
- `POST /apis/sala` — crear tablero. Body: { title, description, xml? }
- `GET /apis/sala/:id` — obtener tablero por id
- `PUT /apis/sala/:id` — actualizar tablero (title, description, participantes, xml)
- `DELETE /apis/sala/:id` — eliminar tablero

Rutas de diagnóstico (dev):
- `GET /apis/health/db` — health check de BD (dev).
- `GET /apis/sala/debug/all` — (desarrollo) devuelve todas las salas (útil para debug). Puede removerse en producción.

Exportadores (generación de proyectos):
- `POST /apis/crearPagina/exportarSpringBoot/:id` — Genera un proyecto Spring Boot a partir de la sala almacenada con el id indicado. Responde con un ZIP (Content-Type: application/zip) que contiene el proyecto Java/Spring Boot listo para descomprimir y ejecutar.
- Nota: La exportación por payload (POST `/apis/crearPagina/exportarSpringBoot` con body `{ elements, connections }`) ha sido deshabilitada en el servidor; la generación de proyectos desde el cliente debe realizarse localmente usando la opción de generar en el navegador si la exportación por id falla.
- `POST /apis/crearPagina/exportarFlutter/:id` — Genera un proyecto Flutter mínimamente funcional (models, services, pages) a partir de la sala guardada con el id indicado. Responde con un ZIP (Content-Type: application/zip) que contiene la app Flutter generada.
- `POST /apis/crearPagina/exportarFlutter` — Genera un proyecto Flutter a partir del payload JSON enviado en el body: `{ elements: [...], connections: [...] }`. Responde con un ZIP con la estructura del proyecto.

Notas sobre los endpoints de exportación:
- Las rutas de exportación intentan primero generar el proyecto desde la sala guardada (cuando se usa `/:id`). La exportación por payload en el servidor está deshabilitada; si la exportación por id falla, el frontend puede generar el ZIP localmente en el navegador como alternativa.
- Los ZIP contienen un README con instrucciones básicas (ej.: `flutter pub get` / `flutter run` para Flutter, `mvnw` o `mvn` para Spring Boot según el proyecto generado).
- Asegúrate de que el proceso del servidor tenga permisos de escritura en la ruta temporal configurada (por defecto `C:/Users/Public/Documents/proyectos`) o actualiza la variable `rutaBase` en los controladores si es necesario.

Respuesta estándar de API:
- Muchos endpoints devuelven JSON con la forma `{ error: boolean, data: ... , message?: string }`.

---

## Eventos Socket.IO (WebSocket) — servidor ↔ cliente
Conexión: el cliente debe abrir Socket.IO hacia el backend (por ejemplo `http://localhost:8083`) e incluir autenticación por cookie o `auth.token` (fallback desde localStorage si usas CORS cross-origin en dev).

Eventos emitidos por el cliente (clientes -> servidor):
- `unirseSala` — { salaId, usuario }
- `cambioInstantaneo` — { salaId, usuario, tipo, elemento, timestamp? }
- `operacionElemento` — { salaId, usuario, operacion, elemento }
- `actualizarDiagrama` — { salaId, usuario, action: 'fullState', data: { state } }
- `guardarEstado` — { salaId, estado }
- `solicitarEstado` — { salaId }

Eventos emitidos por el servidor (servidor -> clientes):
- `estadoInicial` — { state }
- `xmlActualizado` — { nuevoEstado, message }
- `usuariosConectados` — { usuarios: [...] }
- `usuarioUnido` — { usuario }
- `usuarioSalio` — { usuarioId }
- `cambioRecibido` — reemisión de `cambioInstantaneo` para otros clientes
- `elementoOperado` — reemisión de `operacionElemento`
- `diagramaActualizado` — notificación cuando se guarda/actualiza full state
- `estadoGuardado` — ack de guardado en DB
- `errorSincronizacion` — { message }

Notas importantes:
- El servidor ahora intenta resolver la identidad del emisor usando (1) `data.usuario` del payload, (2) `socket.usuario` (lo enviado al `unirseSala`) o (3) `socket.user` (información del JWT en handshake). Acepta como válido `usuario` que tenga `name`, `email` o `id`.
- Recomendado: que el cliente incluya siempre `{ id, name, email }` en `usuario` para mayor robustez.

---

## Funcionalidades principales del frontend
- Registro / login mediante formularios (POST a `/apis/register` y `/apis/login`). El token se almacena en cookie por el backend y opcionalmente en localStorage como fallback para WebSocket handshake.
- Lista de tableros (Board list) que se obtiene desde `GET /apis/sala`.
- Editor de diagramas (Board page): crear/modificar nodos y aristas, importar XML para generar nodos, edición en tiempo real con Socket.IO.
- Invitación y manejo de participantes (campo `participantes` por tablero).
- Operaciones CRUD sobre tableros (crear, editar, eliminar) vía REST (backend) y guardado del estado en Postgres.

---

## Depuración y notas frecuentes
- Cookies / SameSite: en desarrollo el backend está configurado para usar `SameSite=Lax` y credentials en CORS para permitir que el navegador envíe la cookie `token` a `localhost:8083` desde `localhost:5173`. Si no ves la cookie en las herramientas del navegador bajo la ruta `http://localhost:8083`, la sesión no se enviará y las rutas protegidas devolverán 401.
- Si los cambios no se reflejan en otros clientes:
  - Asegúrate que ambos clientes están en la misma `salaId` (mismo número) y que `unirseSala` se ejecutó con éxito antes de emitir cambios.
  - Revisa la consola del servidor para logs: se imprimen mensajes de entrada/salida de salas y advertencias si payloads están inválidos.
- Para evitar condiciones de carrera, el cliente puede esperar un ack o escuchar `estadoInicial`/`usuariosConectados` antes de permitir ediciones.

## Buenas prácticas y siguientes pasos sugeridos
- Producción: usar HTTPS, cookie `Secure`, revisar `SameSite` y dominios, mover `TOKEN_SECRET` a secrets manager.
- Escala: la arquitectura actual usa estado en memoria (`salasActivas`). Para múltiples instancias o restarts usar una capa centralizada (Redis) para pub/sub y reconstrucción de estado.
- Migración: si tenías datos en Firestore, exportar/transformar y `COPY` o `INSERT` en Postgres.

---

## Contribuir / desarrollo
- Para cambios rápidos en WebSocket, los puntos clave son `backend/src/index.js` (handlers Socket.IO) y `frontend/src/config/useSocketFlow.js`.
- Si necesitas reproducir problemas de sincronización, abre dos ventanas en `http://localhost:5173`, únete a la misma sala y observa logs de servidor/cliente.

---

Si quieres, puedo:
- Añadir un comando `npm run start:all` que inicie backend y frontend en paralelo (por ejemplo con `concurrently`).
- Generar un script de migración para mover datos desde Firestore a Postgres.
- Añadir un pequeño endpoint UI de debug (por ejemplo `/debug/salas`) protegido para mostrar las salas en memoria.


-----
Pequeña lista de archivos útiles:
- Backend: `backend/src/index.js`, `backend/src/controllers/*`, `backend/src/models/sala.model.js`, `backend/src/config/db.js`, `backend/src/config/app.js`.
- Frontend: `frontend/src/config/useSocketFlow.js`, `frontend/src/pages/Board.jsx`, `frontend/src/components/board/BoardList.jsx`.


Gracias — dime si quieres que deje el README en inglés o que añada pasos detallados para Docker / deploy.
