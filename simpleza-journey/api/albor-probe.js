// api/albor-probe.js — Endpoint de diagnóstico. Confirma que podemos hablar
// con la API de Albor desde Vercel y devuelve un resumen liviano por moneda.
//
// Uso:  GET /api/albor-probe?passcode=...&desde=2024-01-01&hasta=2024-12-31
// (passcode usa el mismo EDIT_PASSCODE del resto de la app)

import { setCors, handleOptions, requirePasscode } from "../lib/db.js";
import { getCuentasCobrarPagar, toAlborDate } from "../lib/albor.js";

function pickPasscodeFromQuery(req) {
  const url = new URL(req.url, "http://x");
  const p = url.searchParams.get("passcode");
  if (p && !req.headers["x-passcode"]) {
    req.headers["x-passcode"] = p;
  }
  return url.searchParams;
}

function resumir(rows) {
  if (!Array.isArray(rows)) return { filas: 0 };
  const totalPendiente = rows.reduce((acc, r) => acc + Number(r.pendiente || 0), 0);
  const totalGeneral   = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
  return {
    filas: rows.length,
    totalPendiente: Number(totalPendiente.toFixed(2)),
    totalGeneral: Number(totalGeneral.toFixed(2)),
    muestra: rows.slice(0, 3).map(r => ({
      tercero: r.tercero, documento: r.documento, fecha: r.fecha,
      fechaVencimiento: r.fechaVencimiento, pendiente: r.pendiente,
      retraso: r.retraso,
    })),
  };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const params = pickPasscodeFromQuery(req);
  if (requirePasscode(req, res)) return;

  const hoy = new Date();
  const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
  const fechaDesde = params.get("desde") || toAlborDate(haceUnAnio);
  const fechaHasta = params.get("hasta") || toAlborDate(hoy);

  const escenarios = [
    { label: "cobrarPesos",   condicion: "V", idMoneda: 1 },
    { label: "cobrarDolares", condicion: "V", idMoneda: 2 },
    { label: "pagarPesos",    condicion: "C", idMoneda: 1 },
    { label: "pagarDolares",  condicion: "C", idMoneda: 2 },
  ];

  const t0 = Date.now();
  const resultados = await Promise.all(
    escenarios.map(async (esc) => {
      const tStart = Date.now();
      try {
        const rows = await getCuentasCobrarPagar({
          condicion: esc.condicion,
          idMoneda: esc.idMoneda,
          fechaDesde,
          fechaHasta,
        });
        return { ...esc, ok: true, ms: Date.now() - tStart, ...resumir(rows) };
      } catch (e) {
        return { ...esc, ok: false, ms: Date.now() - tStart, error: e.message };
      }
    })
  );

  res.status(200).json({
    ok: resultados.every(r => r.ok),
    ventana: { fechaDesde, fechaHasta },
    duracionMs: Date.now() - t0,
    resultados,
  });
}
