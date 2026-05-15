// scripts/probe-albor.mjs — Probe rápido para verificar conexión con Albor.
//
// Uso:
//   1. Copiar .env.example a .env y completar ALBOR_API_KEY, ALBOR_COMPANY, ALBOR_GESTION.
//   2. Desde simpleza-journey/, correr: node scripts/probe-albor.mjs
//      Opcional: --desde YYYY-MM-DD --hasta YYYY-MM-DD
//
// Hace 4 llamadas a /Reportes/CuentasCobrarPagar: pesos/dólares × cobrar/pagar.

import fs from "node:fs";
import path from "node:path";

// Mini-loader de .env (sin dependencias externas).
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, "utf8");
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const { getCuentasCobrarPagar, toAlborDate } = await import("../lib/albor.js");

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    args[argv[i].slice(2)] = argv[i + 1];
    i++;
  }
}

const hoy = new Date();
const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
const fechaDesde = args.desde || toAlborDate(haceUnAnio);
const fechaHasta = args.hasta || toAlborDate(hoy);

console.log(`Albor probe · ventana ${fechaDesde} → ${fechaHasta}\n`);

async function probar(label, opts) {
  process.stdout.write(`  ${label.padEnd(30)} `);
  const t0 = Date.now();
  try {
    const rows = await getCuentasCobrarPagar(opts);
    const ms = Date.now() - t0;
    console.log(`OK · ${String(rows.length).padStart(6)} filas · ${ms}ms`);
    if (rows.length) {
      const sample = rows[0];
      const totalPendiente = rows.reduce((acc, r) => acc + Number(r.pendiente || 0), 0);
      console.log(`     primera fila: tercero="${sample.tercero}" doc="${sample.documento}" pendiente=${sample.pendiente}`);
      console.log(`     total pendiente del set: ${totalPendiente.toFixed(2)}`);
    }
  } catch (e) {
    console.log(`FAIL`);
    console.log(`     ${e.message}`);
  }
}

await probar("Cuentas a Cobrar  $",   { condicion: "V", idMoneda: 1, fechaDesde, fechaHasta });
await probar("Cuentas a Cobrar  U$S", { condicion: "V", idMoneda: 2, fechaDesde, fechaHasta });
await probar("Cuentas a Pagar   $",   { condicion: "C", idMoneda: 1, fechaDesde, fechaHasta });
await probar("Cuentas a Pagar   U$S", { condicion: "C", idMoneda: 2, fechaDesde, fechaHasta });
