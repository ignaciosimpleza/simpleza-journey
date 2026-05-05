# Simpleza · Customer Journey

Diagnóstico interactivo del customer journey de Simpleza, con persistencia en Turso (SQLite distribuido) y deploy en Vercel.

## Arquitectura

- **Frontend**: HTML/CSS/JS autocontenido en `public/index.html`. Sora, paleta institucional, logos embebidos en base64.
- **Backend**: Vercel Serverless Functions en `api/` — usan `@libsql/client` para hablar con Turso.
- **DB**: Turso (libSQL/SQLite). Tres tablas: `journey_state`, `journey_matrix`, `journey_history`, `journey_snapshots`.
- **Fallback**: si la API no responde, la app sigue funcionando con `localStorage` y muestra un indicador de offline.

## Setup paso a paso

### 1. Crear la base en Turso

```bash
# Instalar la CLI de Turso (una sola vez)
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Crear la base (elegí la región más cercana, ej: gru = São Paulo)
turso db create simpleza-journey --location gru

# Cargar el schema
turso db shell simpleza-journey < schema.sql

# Obtener URL y token
turso db show simpleza-journey --url
turso db tokens create simpleza-journey
```

Anotá los dos valores: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.

### 2. Subir el proyecto a GitHub

```bash
cd simpleza-journey
git init
git add .
git commit -m "Initial commit · customer journey v3"
git branch -M main
# crea el repo vacío primero en github.com/tu-usuario/simpleza-journey
git remote add origin https://github.com/TU-USUARIO/simpleza-journey.git
git push -u origin main
```

### 3. Deploy a Vercel

**Opción A — desde la web:**

1. Entrá a [vercel.com/new](https://vercel.com/new) e importá el repo.
2. En "Environment Variables" agregá las dos vars:
   - `TURSO_DATABASE_URL` → la URL `libsql://...`
   - `TURSO_AUTH_TOKEN` → el token largo
3. Click en "Deploy".

**Opción B — desde CLI:**

```bash
npm install -g vercel
vercel
# seguir prompts; al final agregar las env vars con:
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel --prod
```

### 4. Probar

Abrí la URL de Vercel. La app debería cargar con el diagnóstico base. Activá el modo edición (candado en el topbar), cambiá un estado y revisá la pestaña **Evolución** — el cambio queda registrado con fecha. Refrescá la página: tiene que mantenerse.

El indicador en el sidebar abajo muestra el estado de conexión:
- **🟢 Conectado** — sincronizando con Turso.
- **🟡 Offline** — guardando solo en localStorage del navegador.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con TURSO_DATABASE_URL y TURSO_AUTH_TOKEN
npx vercel dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Tareas comunes

**Backup de la base:**
```bash
turso db shell simpleza-journey ".dump" > backup-$(date +%Y%m%d).sql
```

**Limpiar todos los datos (cuidado):**
```bash
turso db shell simpleza-journey "DELETE FROM journey_history; DELETE FROM journey_snapshots; DELETE FROM journey_state; DELETE FROM journey_matrix;"
```

**Ver últimas ediciones:**
```bash
turso db shell simpleza-journey "SELECT datetime(ts/1000, 'unixepoch', 'localtime'), etapa_name, field_label, old_val, new_val FROM journey_history ORDER BY ts DESC LIMIT 20;"
```

## Iteración futura

- Auth básica (passcode compartido del equipo) para que solo Simpleza pueda editar.
- Comparador de snapshots lado a lado.
- Segmentación por unidad de negocio de entrada.
- KPIs cuantitativos reemplazando los semáforos cualitativos.
