#!/usr/bin/env bash
# deploy.sh — One-shot deploy de Simpleza Customer Journey a Turso + Vercel.
# Uso:
#   bash deploy.sh
# O con tokens en env (sin prompt):
#   TURSO_API_TOKEN=... VERCEL_TOKEN=... bash deploy.sh
#
# Requisitos: bash, curl, node>=18, npm. Instala turso/vercel CLIs si faltan.

set -euo pipefail

# ----------- Config -----------
PROJECT_NAME="${PROJECT_NAME:-simpleza-journey}"
DB_NAME="${DB_NAME:-simpleza-journey}"
TURSO_REGION="${TURSO_REGION:-gru}"      # gru = São Paulo (más cerca de AR)
VERCEL_SCOPE="${VERCEL_SCOPE:-ignaciosimplezas-projects}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/simpleza-journey"
SCHEMA_FILE="$PROJECT_DIR/schema.sql"

# ----------- Helpers -----------
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
info() { printf "${YELLOW}→${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }
hr()   { printf "${BOLD}%s${NC}\n" "────────────────────────────────────────────"; }

# Pequeño parser JSON usando node (más confiable que jq, que no siempre está)
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=o$1;console.log(typeof v==='string'?v:JSON.stringify(v))}catch(e){console.error('JSON parse error:',e.message);process.exit(1)}})"; }

cleanup_tmp() { [ -n "${TMP_OUT:-}" ] && rm -f "$TMP_OUT"; }
trap cleanup_tmp EXIT

# ----------- Preflight -----------
hr
printf "${BOLD}Simpleza Customer Journey — Deploy Turso + Vercel${NC}\n"
hr

[ -d "$PROJECT_DIR" ] || { err "No encontré $PROJECT_DIR. Ejecutá desde la raíz del repo clonado."; exit 1; }
[ -f "$SCHEMA_FILE" ] || { err "No encontré $SCHEMA_FILE."; exit 1; }
command -v curl >/dev/null || { err "Falta curl"; exit 1; }
command -v node >/dev/null || { err "Falta node (>=18)"; exit 1; }
command -v npm  >/dev/null || { err "Falta npm";  exit 1; }

# ----------- Tokens -----------
if [ -z "${TURSO_API_TOKEN:-}" ]; then
  echo "Token de Turso (Platform API): https://app.turso.tech/account/api-tokens"
  read -rsp "TURSO_API_TOKEN: " TURSO_API_TOKEN; echo
fi
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "Token de Vercel: https://vercel.com/account/tokens"
  read -rsp "VERCEL_TOKEN: " VERCEL_TOKEN; echo
fi
[ -n "$TURSO_API_TOKEN" ] || { err "Falta TURSO_API_TOKEN"; exit 1; }
[ -n "$VERCEL_TOKEN" ]    || { err "Falta VERCEL_TOKEN";    exit 1; }
export TURSO_API_TOKEN VERCEL_TOKEN

# ----------- Vercel CLI -----------
if ! command -v vercel >/dev/null 2>&1; then
  info "Instalando Vercel CLI (npm i -g vercel)..."
  npm install -g vercel >/dev/null 2>&1 || { err "Fallo instalando vercel"; exit 1; }
fi
ok "Vercel CLI: $(vercel --version 2>&1 | head -1)"

# ----------- Turso Platform API -----------
TURSO_API="https://api.turso.tech/v1"
turso_api() {
  local method="$1" path="$2" body="${3:-}"
  TMP_OUT="$(mktemp)"
  local code
  if [ -n "$body" ]; then
    code=$(curl --ssl-no-revoke -sS -o "$TMP_OUT" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TURSO_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body" "$TURSO_API$path")
  else
    code=$(curl --ssl-no-revoke -sS -o "$TMP_OUT" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TURSO_API_TOKEN" "$TURSO_API$path")
  fi
  cat "$TMP_OUT"
  if [ "$code" -ge 400 ]; then
    err "Turso API ${method} ${path} → HTTP ${code}"
    return 1
  fi
}

info "Verificando token de Turso y obteniendo organización..."
ORG_SLUG=$(turso_api GET "/organizations" | jget "[0].slug")
[ -n "$ORG_SLUG" ] || { err "No pude obtener org slug"; exit 1; }
ok "Org de Turso: $ORG_SLUG"

# ----------- Crear o reusar DB -----------
info "Verificando DB '$DB_NAME'..."
DB_INFO=""
if DB_INFO=$(turso_api GET "/organizations/$ORG_SLUG/databases/$DB_NAME" 2>/dev/null); then
  ok "DB '$DB_NAME' ya existe — se reutiliza"
else
  info "Creando DB '$DB_NAME' en región $TURSO_REGION..."
  DB_INFO=$(turso_api POST "/organizations/$ORG_SLUG/databases" \
    "{\"name\":\"$DB_NAME\",\"group\":\"default\",\"location\":\"$TURSO_REGION\"}")
  ok "DB creada"
fi

DB_HOST=$(printf '%s' "$DB_INFO" | jget ".database.Hostname")
[ -n "$DB_HOST" ] || { err "No pude obtener Hostname de la DB"; printf '%s\n' "$DB_INFO" >&2; exit 1; }
TURSO_DATABASE_URL="libsql://$DB_HOST"
ok "TURSO_DATABASE_URL=$TURSO_DATABASE_URL"

# ----------- Token de DB (auth token para libsql client) -----------
info "Generando auth token de la DB..."
TOKEN_RESP=$(turso_api POST "/organizations/$ORG_SLUG/databases/$DB_NAME/auth/tokens?authorization=full-access" "")
TURSO_AUTH_TOKEN=$(printf '%s' "$TOKEN_RESP" | jget ".jwt")
[ -n "$TURSO_AUTH_TOKEN" ] || { err "No pude generar auth token"; printf '%s\n' "$TOKEN_RESP" >&2; exit 1; }
ok "TURSO_AUTH_TOKEN generado (len=${#TURSO_AUTH_TOKEN})"

# ----------- Cargar schema usando @libsql/client -----------
info "Instalando dependencias del proyecto (npm install)..."
( cd "$PROJECT_DIR" && npm install --silent --no-audit --no-fund ) || { err "npm install falló"; exit 1; }

info "Cargando schema.sql en la DB..."
TURSO_DATABASE_URL="$TURSO_DATABASE_URL" TURSO_AUTH_TOKEN="$TURSO_AUTH_TOKEN" SCHEMA_FILE="$SCHEMA_FILE" \
node --input-type=module -e "
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const sql = readFileSync(process.env.SCHEMA_FILE, 'utf8');
const stmts = sql
  .split(/;\s*(?:\n|$)/)
  .map(s => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean);
for (const stmt of stmts) {
  await c.execute(stmt);
}
console.log('  → ' + stmts.length + ' statements ejecutados');
" --experimental-vm-modules 2>&1 | sed 's/^/  /' || { err "Error cargando schema"; exit 1; }
ok "Schema cargado"

# ----------- Vercel: link, env vars, deploy -----------
cd "$PROJECT_DIR"

# Limpiar link previo si existe (idempotencia)
[ -d ".vercel" ] && rm -rf .vercel

info "Linkeando proyecto en Vercel ($VERCEL_SCOPE / $PROJECT_NAME)..."
vercel link --yes --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" --project="$PROJECT_NAME" 2>&1 | sed 's/^/  /' \
  || { err "vercel link falló"; exit 1; }
ok "Proyecto linkeado"

info "Seteando env vars en Vercel (production)..."
# Borrar previas si existen, luego crear (idempotencia)
for var in TURSO_DATABASE_URL TURSO_AUTH_TOKEN; do
  vercel env rm "$var" production --yes --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" >/dev/null 2>&1 || true
done
printf '%s' "$TURSO_DATABASE_URL" | vercel env add TURSO_DATABASE_URL production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" 2>&1 | sed 's/^/  /'
printf '%s' "$TURSO_AUTH_TOKEN"   | vercel env add TURSO_AUTH_TOKEN   production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" 2>&1 | sed 's/^/  /'
ok "Env vars configuradas"

info "Deployando a producción..."
DEPLOY_OUT=$(vercel deploy --prod --yes --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" 2>&1)
echo "$DEPLOY_OUT" | sed 's/^/  /'
PROD_URL=$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

hr
ok "Deploy completado"
[ -n "$PROD_URL" ] && printf "  URL producción: ${BOLD}%s${NC}\n" "$PROD_URL"
hr
printf "${BOLD}Smoke test:${NC}\n"
if [ -n "$PROD_URL" ]; then
  CODE=$(curl --ssl-no-revoke -sS -o /dev/null -w "%{http_code}" "$PROD_URL/api/load")
  if [ "$CODE" = "200" ]; then
    ok "GET /api/load → 200 ✅"
  else
    err "GET /api/load → $CODE (revisá Vercel logs)"
  fi
fi
hr
printf "${BOLD}Próximos pasos:${NC}\n"
echo "  1. Abrí $PROD_URL — verificá que el dot del sidebar quede 🟢 'Conectado'."
echo "  2. Activá modo edición, cambiá un estado, refrescá: debe persistir."
echo "  3. ${YELLOW}Rotá los tokens de Turso y Vercel${NC} (los que pegaste antes en chat)."
echo "     - https://app.turso.tech/account/api-tokens"
echo "     - https://vercel.com/account/tokens"
hr
