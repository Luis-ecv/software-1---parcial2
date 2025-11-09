# 🚀 Guía de Despliegue - Railway

Esta guía te ayudará a desplegar tu aplicación UML/Diagram en Railway solucionando el error que obtuviste.

## ✅ Cambios Realizados

1. **Añadido script `start` en backend/package.json**
   - Permite a Railway ejecutar el servidor en producción
   
2. **Creado railway.json**
   - Configura cómo Railway debe buildear y desplegar desde un monorepo
   - Define rutas de build y start commands

## 🔧 Pasos para Desplegar

### 1. Commit y Push de los cambios
```powershell
git add .
git commit -m "Add Railway configuration and production start script"
git push origin main
```

### 2. Configurar en Railway

**Backend:**
1. Ve a tu proyecto en Railway
2. **Si ya tienes un servicio creado:** Ve a Settings → Source → Restart deployment
3. **Si no:** New Project → Deploy from GitHub → Selecciona tu repo

**Variables de Entorno en Railway:**
```
DB_HOST=<se autocompleta con PostgreSQL plugin>
DB_USER=<se autocompleta con PostgreSQL plugin>  
DB_PASSWORD=<se autocompleta con PostgreSQL plugin>
DB_DATABASE=<se autocompleta con PostgreSQL plugin>
DB_PORT=<se autocompleta con PostgreSQL plugin>
TOKEN_SECRET=tu_secreto_jwt_aqui
GEMINI_API_KEY=AIzaSyBx-O-NLJ9P3CCMgOtGOyGeRWEAmzmAiL8
FRONTEND_URL=http://localhost:5173
NODE_ENV=production
```

### 3. Añadir PostgreSQL Plugin
1. En tu proyecto Railway → Add Plugin → PostgreSQL
2. Railway automáticamente configurará las variables de DB

### 4. Ejecutar SQL Inicial
En el PostgreSQL plugin de Railway:
1. Ve a Data → Query
2. Copia y pega el contenido de `backend/src/config/database.sql`
3. Ejecuta para crear las tablas

### 5. Actualizar FRONTEND_URL
Una vez que el backend esté desplegado:
1. Copia la URL del backend (ej: https://tu-backend.up.railway.app)
2. En Variables de Entorno → FRONTEND_URL → pon la URL de tu frontend final

## 🌐 Frontend (Vercel - Recomendado)

**Configuración Vercel:**
1. New Project → Import Git Repository
2. Root Directory: `frontend`
3. Framework Preset: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`

**Variables de Entorno Vercel:**
```
VITE_API_BASE=https://tu-backend.up.railway.app
VITE_WS_URL=https://tu-backend.up.railway.app
```

## ⚠️ Importante - Seguridad

Tu archivo `.env` contiene credenciales reales. Antes de producción:

1. **Rotar secretos:**
   - Cambia TOKEN_SECRET
   - Si es necesario, rota GEMINI_API_KEY
   - Actualiza password de DB local

2. **No commitear .env:**
```powershell
echo "backend/.env" >> .gitignore
git rm --cached backend/.env
git commit -m "Remove .env from tracking"
```

## 🔍 Verificación Post-Deploy

1. **Health Check:** https://tu-backend.up.railway.app/apis/health
2. **Logs Railway:** Revisa que no haya errores de DB
3. **CORS:** Prueba desde frontend que las llamadas API funcionen
4. **WebSockets:** Verifica sincronización en tiempo real

## 🐛 Troubleshooting

**Si persiste el error de build:**
- Verifica que `railway.json` esté en la raíz
- Check que el servicio Railway esté viendo el branch correcto
- Restart deployment desde Settings

**Si falla conexión DB:**
- Verifica que el plugin PostgreSQL esté añadido
- Check variables de entorno en el dashboard
- Revisa logs para errores de conexión

**Si frontend no conecta:**
- Verifica VITE_API_BASE en Vercel
- Check que FRONTEND_URL en Railway incluya el dominio Vercel
- Revisa CORS en browser console

¿Necesitas ayuda con algún paso específico?