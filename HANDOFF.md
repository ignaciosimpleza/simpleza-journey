# Handoff · Simpleza Customer Journey

## Repositorio

**https://github.com/ignaciosimpleza/simpleza-journey**

Tenés acceso al repo. Trabajá con commits a `main` para cambios chicos, o branches + PR si es algo más grande que quieras revisar antes de mergear.

## Qué es este proyecto

App web interactiva del **diagnóstico de customer journey de Simpleza** (consultora argentina de agribusiness, Rosario). 6 etapas con estados semáforo, 7 cuellos priorizados, matriz de cross-sell entre 7 unidades de negocio, snapshots fechados y log de cambios.

Construido con Claude (chat) hasta dejar el proyecto listo para deploy. Falta: ejecutar el deploy, probar end-to-end, e iterar a partir del feedback de uso real.

## Stack

- **Frontend**: HTML/CSS/JS vanilla autocontenido (`public/index.html`, ~83KB, ~2300 líneas, single-file). Sora desde Google Fonts. SVG nativo para todos los gráficos (sin Chart.js). Logos embebidos en base64.
- **Backend**: Vercel Serverless Functions (Node 18+, ESM) en `api/`.
- **DB**: Turso (libSQL/SQLite remoto), accedida vía `@libsql/client`.
- **Persistencia híbrida**: API si responde, `localStorage` como fallback. Indicador de conexión visible en sidebar.
- **Deploy target**: Vercel conectado a este repo de GitHub.

## Estructura del repo

```
simpleza-journey/
├── public/index.html        # App completa (frontend single-file)
├── api/
│   ├── load.js              # GET → {state, matrix, history, snapshots}
│   ├── save.js              # POST {etapas?, matrix?} → upsert
│   ├── history.js           # POST entry → log de cambios
│   └── snapshots.js         # POST crear / DELETE ?id=X eliminar
├── lib/db.js                # Helper: getDb(), setCors(), readJsonBody()
├── schema.sql               # 4 tablas + 2 índices
├── package.json             # type: module, @libsql/client ^0.14.0
├── vercel.json              # headers para iframe embedding
├── .env.example             # plantilla TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
├── .gitignore               # node_modules, .env*, .vercel
└── README.md                # pasos de deploy
```

## Cosas a saber del frontend

**Layout**
- Sidebar fijo 260px a la izquierda (oscuro `#1B2227`) con imagotipo blanco arriba y navegación de 5 secciones. En mobile se vuelve drawer con hamburger.
- Topbar crema sticky arriba con isotipo verde + "Customer Journey · {sección activa}" + botones (edit toggle, export, import, reset).
- Banner verde menta abajo del topbar **solo visible en modo edición**.
- Sin recargas: el cambio de sección es CSS toggle con animación fadeIn.

**Paleta (todas como CSS vars en `:root`)**
```
--gris-medio: #7F7F7F
--crema-fondo: #F9F4ED
--azul-pizarra: #6C868C
--verde-menta: #32E8A9    ← color de marca, acento principal
--beige-suave: #D9CCC1
--terracota: #CD6155      ← estado crítico (rojo)
--amarillo-pastel: #F7DC6F ← estado moderado
--gris-oscuro: #616A6B
```

**Estados semáforo**: `rojo` (crítico/terracota) · `amarillo` (moderado/pastel) · `verde` (sin cuello/menta). Tres dimensiones: estado consolidado de la etapa + 4 indicadores por etapa (tiempo, conversión, fricción, satisfacción).

**Modo edición protegido**
- Por defecto SIEMPRE arranca en lectura (candado). El toggle en topbar lo activa (cambia a verde menta + emoji ✏️).
- En lectura, los controles tienen `cursor: not-allowed` y al tocarlos disparan toast "Activá modo edición desde el topbar".
- Cada cambio en edición:
  1. Actualiza el `state` en memoria
  2. `saveToLocalStorage()` (fallback)
  3. `API.save({ etapas })` o `API.save({ matrix })` (best-effort)
  4. `logEdit()` que también llama `API.logHistory()`
  5. Re-renderiza la UI

**Visualizaciones (todas SVG nativo)**
- **Pipeline** en sección Vista: 6 nodos en grid responsive con mini-radar de 4 ejes por etapa. Click → va a Detalle y abre esa etapa.
- **Red de cross-sell**: 7 unidades en círculo, líneas verde menta entre conectadas, contador en el centro.
- **Matriz** 7×7 de cross-sell editable (en la misma sección).
- **Heatmap** en Evolución: filas = etapas, columnas = snapshots fechados + columna "Actual".

## Cosas a saber del backend

**Variables de entorno requeridas** (Vercel + `.env.local` para dev):
```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
```

**Schema**: 4 tablas. `journey_state` y `journey_matrix` son singletons (id=1) con `data` TEXT que almacena JSON. `journey_history` autoincrement (cap 500 en lectura). `journey_snapshots` con id de string `snap_<timestamp>`.

**Convención**: timestamps en DB como `INTEGER` (epoch ms con `Date.now()`); en wire/API como ISO strings. La conversión está en `api/load.js` y `api/history.js`.

**CORS**: helper `setCors()` aplicado en cada handler para permitir embed desde otros dominios (también `vercel.json` setea `frame-ancestors *` y `X-Frame-Options: ALLOWALL`).

## Datos del diagnóstico (hardcoded en `ETAPAS_BASE` y `CUELLOS_BASE`)

**Insight macro**: el funnel de Simpleza está armado para adquisición concentrada en personas (80% red personal, 18% referidos, 2% otros), pero la visión es retención/expansión. La máquina de cierre/entrega funciona; el cuello está arriba del funnel y en sistematización.

**6 etapas**: Conciencia (🔴), Consideración (🟡), Decisión (🟢), Onboarding (🟢), Entrega (🟡), Retención (🟡).

**7 cuellos priorizados** ordenados por criticidad — los dos rojos son: adquisición concentrada en red personal · calidad de vida del equipo como variable de ajuste en picos.

**7 unidades de negocio** (para la matriz): Estrategia, Gobierno y procesos, Directorios Colaborativos, Contabilidad de gestión, BI, Herramientas y modelos, Coyuntura.

## Pendientes inmediatos

**1. Deploy end-to-end y prueba real** (el repo ya está, falta DB + Vercel):

```bash
# Crear DB Turso
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create simpleza-journey --location gru
turso db shell simpleza-journey < schema.sql
turso db show simpleza-journey --url       # → guardar como TURSO_DATABASE_URL
turso db tokens create simpleza-journey    # → guardar como TURSO_AUTH_TOKEN
```

Después en Vercel: importar el repo `ignaciosimpleza/simpleza-journey`, agregar las 2 env vars (`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`), Deploy.

Probar: abrir la URL, activar edición, cambiar un estado, refrescar. Debe persistir. El indicador en sidebar tiene que estar 🟢 conectado.

**2. Bug-hunt post deploy.** Cosas a chequear que no se probaron en chat:
- El `init()` en el frontend tiene 3 ramas (server tiene data / API online sin data / API offline) — verificar que las 3 funcionen.
- El logo blanco en el sidebar tiene fondo transparente (RGBA). Si en algún navegador se ve con fondo, confirmar que el PNG procesado quedó bien.
- El heatmap muestra columna "Actual" además de los snapshots — verificar que ordene cronológicamente.
- En mobile: drawer del sidebar abre/cierra correctamente, los controles de edit-mode son tappeables sin disparar accidentes.

**3. Mejoras propuestas** (en orden de utilidad):
- **Auth básica con passcode** compartido del equipo Simpleza. Sin esto, cualquiera con la URL puede editar. Idea simple: middleware en `api/save.js`, `api/history.js`, `api/snapshots.js` que valide un header `x-passcode` contra una env var `EDIT_PASSCODE`. Frontend pide el passcode al activar edit mode y lo guarda en localStorage. No es high-security pero filtra el 99% de los casos.
- **Comparador de snapshots lado a lado**: hoy el heatmap muestra todos los snapshots en una tabla, pero falta una vista de "snapshot A vs snapshot B" con diff visible (qué etapas mejoraron, qué empeoraron).
- **Segmentación por unidad de entrada**: el cross-sell hoy es agregado. Sería útil ver "de los clientes que entraron por Estrategia, qué % sigue en Estrategia vs activó otras unidades".
- **KPIs cuantitativos** reemplazando los semáforos cualitativos donde haya datos (ej. tiempo medio en cada etapa, conversion rate concreto). Hoy todo es semáforo por juicio del equipo.

## Cosas que NO hay que hacer

- **No agregar Chart.js u otras dependencias** al frontend. El single-file pattern es deliberado — el dashboard se embebe en otros sitios vía iframe y la simplicidad importa. Si hace falta una visualización nueva, se hace SVG nativo siguiendo el patrón de `buildRadarSVG()` o `renderNetwork()`.
- **No reemplazar el localStorage fallback por algo más complejo** (IndexedDB, etc.). Es a propósito — si la API se cae, la app sigue funcionando offline. La API tiene la verdad cuando vuelve online.
- **No partir el HTML en archivos separados** sin razón fuerte. La consigna del cliente fue "single-file autocontenido" y hay un patrón de proyectos similares de Simpleza siguiendo eso.
- **No deletear el indicador de conexión del sidebar**. Es feedback importante para el usuario sobre si sus cambios se están guardando en el server o solo localmente.
- **No usar pie/donut charts** — el cliente los detesta porque no permiten percibir escala bien. Usar barras, líneas, radares, o redes según corresponda.

## Sobre el cliente (Nacho)

- Habla castellano rioplatense (vos, no tú).
- Estilo directo y breve, peer-to-peer. No le gusta el preámbulo ni el "great question!".
- Empuja contra soluciones sobre-elaboradas. Si algo se puede hacer simple, hacelo simple.
- Trabaja en Simpleza, conoce el proyecto a fondo.

## Workflow git

- **Cambios chicos / fixes**: commit directo a `main`. Vercel deploya automáticamente al detectar el push.
- **Cambios grandes** (feature nueva, refactor, cambio de schema): branch + PR para revisión. Vercel genera preview deploy de cada PR — perfecto para que Nacho lo revise antes de mergear.
- Commits en castellano, mensaje breve estilo "Agrega passcode a endpoints de edición" o "Fix orden cronológico del heatmap".

## Comandos útiles

```bash
# Clonar y arrancar local
git clone https://github.com/ignaciosimpleza/simpleza-journey.git
cd simpleza-journey
npm install
cp .env.example .env.local   # llenar con creds de Turso
npx vercel dev               # http://localhost:3000

# Backup de la DB
turso db shell simpleza-journey ".dump" > backup-$(date +%Y%m%d).sql

# Ver últimas ediciones (debug)
turso db shell simpleza-journey "SELECT datetime(ts/1000, 'unixepoch', 'localtime'), etapa_name, field_label, old_val, new_val FROM journey_history ORDER BY ts DESC LIMIT 20;"

# Reset total de la DB (cuidado)
turso db shell simpleza-journey "DELETE FROM journey_history; DELETE FROM journey_snapshots; DELETE FROM journey_state; DELETE FROM journey_matrix;"
```

## Primer paso recomendado

Antes de tocar código: clonar el repo y leer `public/index.html` completo (es largo pero es todo). El backend es trivial; la lógica viva está en el frontend, sobre todo en `init()`, `API`, `setEstado`, `setIndicador`, `takeSnapshot`, y los `render*()`.
