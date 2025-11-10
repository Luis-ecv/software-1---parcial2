# 🚀 Guía Completa de Despliegue en Railway

Esta guía te llevará paso a paso para desplegar tu aplicación UML/Diagram en Railway con backend, frontend y PostgreSQL.

## 📋 Requisitos Previos

- ✅ Código pusheado a GitHub (repositorio: `Luis-ecv/software-1---parcial2`)
- ✅ Cuenta en Railway (railway.app)
- ✅ Fix del import aplicado (`usersalaSchema.js`)

## 🛠️ Estructura del Proyecto en Railway

Crearás 3 servicios:
1. **Backend** (Node.js) - API + WebSockets
2. **Frontend** (Static Site) - React/Vite
3. **PostgreSQL** - Base de datos

---

## 🚀 Parte 1: Configuración Inicial

### 1.1 Crear Proyecto en Railway
1. Ve a [railway.app](https://railway.app) → **Login**
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona: `Luis-ecv/software-1---parcial2`
4. **Deploy Now**

### 1.2 Añadir PostgreSQL
1. En el proyecto → **Add Service** → **Database** → **PostgreSQL**
2. Railway creará automáticamente el servicio PostgreSQL

---

## 🗄️ Parte 2: Configurar Base de Datos

### 2.1 Ejecutar SQL de Inicialización
1. Ve a **PostgreSQL service** → **Data** tab
2. Click **Query**
3. Copia y pega este SQL:

```sql
CREATE TABLE "Users" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  eliminar BOOLEAN DEFAULT false NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Salas" (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  xml TEXT,
  description TEXT,
  eliminar BOOLEAN DEFAULT false NOT NULL,
  userId INT NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "Users" (id) ON DELETE CASCADE
);

CREATE TABLE "Usersala" (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL,
  salas_id INT NOT NULL,
  FOREIGN KEY (userId) REFERENCES "Users" (id) ON DELETE CASCADE,
  FOREIGN KEY (salas_id) REFERENCES "Salas" (id) ON DELETE CASCADE,
  UNIQUE (userId, salas_id)
);

-- Funciones
CREATE OR REPLACE FUNCTION create_user_if_not_exists(
    p_name VARCHAR,
    p_email VARCHAR,
    p_password VARCHAR
)
RETURNS TABLE (
    user_id INT,
    user_name VARCHAR,
    user_email VARCHAR,
    user_password VARCHAR
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Users" WHERE email = p_email AND eliminar = false) THEN
        RETURN;
    ELSIF EXISTS (SELECT 1 FROM "Users" WHERE email = p_email AND eliminar = true) THEN
        RETURN QUERY
        UPDATE "Users"
        SET name = p_name, password = p_password, updatedAt = CURRENT_TIMESTAMP, eliminar = false
        WHERE email = p_email
        RETURNING id, name, email, password;
    ELSE
        RETURN QUERY
        INSERT INTO "Users" (name, email, password)
        VALUES (p_name, p_email, p_password)
        RETURNING id, name, email, password;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_User(p_id INT)
RETURNS VOID AS $$
BEGIN
    UPDATE "Users"
    SET eliminar = true, updatedAt = CURRENT_TIMESTAMP
    WHERE id = p_id AND eliminar = false;

    IF NOT FOUND THEN
        RAISE NOTICE 'No se encontró ningún usuario con el id % o el atributo "eliminar" ya estaba en true.', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

4. **Execute** el SQL

---

## ⚙️ Parte 3: Configurar Backend

### 3.1 Configurar Root Directory
1. Ve a **Backend service** → **Settings** → **Source**
2. **Root Directory:** `backend`
3. **Save Changes**

### 3.2 Variables de Entorno del Backend
1. Ve a **Backend service** → **Variables** tab
2. Añade estas variables una por una:

```bash
# Database (conexión automática a PostgreSQL)
DB_HOST=${{Postgres.PGHOST}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}
DB_PORT=${{Postgres.PGPORT}}

# Seguridad (CAMBIAR EL TOKEN_SECRET)
TOKEN_SECRET=K8mN2pQ7vX3zA9fH5rL1wE6tY4uI8oP2sD7gJ3nM9cV5bF8kR6qW1eT4yH9x

# APIs externas
GEMINI_API_KEY=AIzaSyBx-O-NLJ9P3CCMgOtGOyGeRWEAmzmAiL8

# Configuración
NODE_ENV=production
SAVE_DEBOUNCE_MS=3000

# CORS (se configurará después del frontend)
FRONTEND_URL=${{software-1-P2-Frontend.RAILWAY_STATIC_URL}}
```

### 3.3 Generar Dominio Público Backend
1. **Settings** → **Networking** → **Public Networking**
2. **Generate Domain**
3. Anota la URL generada (ej: `https://backend-production-abc123.up.railway.app`)

---

## 🎨 Parte 4: Configurar Frontend

### 4.1 Crear Servicio Frontend
1. En el proyecto → **Add Service** → **Deploy from GitHub repo**
2. Mismo repo: `Luis-ecv/software-1---parcial2`
3. **Deploy**

### 4.2 Configurar Root Directory
1. **Settings** → **Source** → **Root Directory:** `frontend`
2. **Save Changes**

### 4.3 Generar Dominio Público Frontend
1. **Settings** → **Networking** → **Public Networking**
2. **Port:** `0` (para sitios estáticos)
3. **Generate Domain**
4. Anota la URL (ej: `https://frontend-production-def456.up.railway.app`)

### 4.4 Variables de Entorno del Frontend
1. Ve a **Frontend service** → **Variables** tab
2. Añade:

```bash
# Backend API (usar la URL del backend generada antes)
VITE_API_BASE=${{software-1-P2-Backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_WS_URL=${{software-1-P2-Backend.RAILWAY_PUBLIC_DOMAIN}}
```

---

## 🔄 Parte 5: Finalizar Configuración

### 5.1 Actualizar FRONTEND_URL en Backend
1. Ve a **Backend service** → **Variables**
2. La variable `FRONTEND_URL` debería actualizarse automáticamente
3. Si no, edítala manualmente con la URL del frontend generada

### 5.2 Redeploy si es necesario
1. **Backend service** → **Deployments** → **Redeploy Latest**
2. **Frontend service** → **Deployments** → **Redeploy Latest**

---

## ✅ Parte 6: Verificación

### 6.1 Check Backend
1. Ve a la URL del backend: `https://tu-backend.up.railway.app/apis/health`
2. Debería responder: `{"status": "OK", "database": "connected"}`

### 6.2 Check Frontend
1. Ve a la URL del frontend: `https://tu-frontend.up.railway.app`
2. Debería cargar la aplicación React

### 6.3 Test Funcionalidad
1. **Registro de usuario** - crear cuenta nueva
2. **Login** - iniciar sesión
3. **Crear sala** - nueva sala de diagramas
4. **Colaboración** - abrir en 2 ventanas, verificar sincronización en tiempo real

---

## 🛠️ Troubleshooting

### Backend no arranca
- ✅ Verificar que Root Directory = `backend`
- ✅ Verificar variables DB_* están configuradas
- ✅ Check logs en Deployments tab

### Frontend no carga
- ✅ Verificar que Root Directory = `frontend`
- ✅ Verificar VITE_API_BASE apunta al backend correcto
- ✅ Check que el build completó exitosamente

### No conecta API
- ✅ CORS: Verificar FRONTEND_URL en backend incluye dominio frontend
- ✅ Variables: VITE_API_BASE debe usar HTTPS (no HTTP)

### WebSockets no funcionan
- ✅ Verificar VITE_WS_URL configurado
- ✅ Verificar FRONTEND_URL en backend configurado
- ✅ Abrir 2 ventanas y probar sincronización

---

## 📚 Referencias

- **Railway Docs:** https://docs.railway.app/
- **Variables de Railway:** https://docs.railway.app/develop/variables
- **Monorepo Setup:** https://docs.railway.app/deploy/monorepo

---

## ⚠️ Seguridad Post-Deploy

1. **Cambiar TOKEN_SECRET** - usar el generado en esta guía
2. **Rotar GEMINI_API_KEY** - si es compartida
3. **Revisar variables** - no exponer secretos en frontend
4. **HTTPS Only** - siempre usar dominios HTTPS de Railway

---

## 🎯 URLs Finales

Al completar el setup tendrás:
- **Frontend:** `https://software-1-p2-frontend-production-[id].up.railway.app`
- **Backend API:** `https://software-1-p2-backend-production-[id].up.railway.app`
- **Health Check:** `https://software-1-p2-backend-production-[id].up.railway.app/apis/health`

¡Listo para colaborar en diagramas UML en tiempo real! 🎉