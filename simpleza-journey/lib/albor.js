// lib/albor.js — Cliente HTTP para la API de Albor Agro.
// Auth: 3 headers (X-ApiKey, X-COMPANY, X-GESTION). Credenciales SIEMPRE
// vía variables de entorno; nunca hardcodear el token.

const DEFAULT_BASE_URL = "https://backend.alboragro.com";

function getCreds() {
  const apiKey = process.env.ALBOR_API_KEY;
  const company = process.env.ALBOR_COMPANY;
  const gestion = process.env.ALBOR_GESTION;
  const baseUrl = process.env.ALBOR_BASE_URL || DEFAULT_BASE_URL;
  if (!apiKey) throw new Error("Falta ALBOR_API_KEY en variables de entorno");
  if (!company) throw new Error("Falta ALBOR_COMPANY en variables de entorno");
  if (!gestion) throw new Error("Falta ALBOR_GESTION en variables de entorno");
  return { apiKey, company, gestion, baseUrl };
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    usp.append(k, v === null ? "null" : String(v));
  }
  return usp.toString();
}

export async function alborFetch(path, { query = {}, timeoutMs = 60000 } = {}) {
  const { apiKey, company, gestion, baseUrl } = getCreds();
  const qs = buildQuery(query);
  const url = baseUrl + path + (qs ? `?${qs}` : "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-ApiKey": apiKey,
        "X-COMPANY": company,
        "X-GESTION": gestion,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Albor ${res.status} ${res.statusText} en ${path}: ${text.slice(0, 500)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no-JSON de Albor en ${path}: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// yyyy-MM-dd. Acepta Date, string ISO, o string ya formateado.
export function toAlborDate(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GET /Reportes/CuentasCobrarPagar
 *
 * @param {Object}   opts
 * @param {1|2}      opts.idMoneda             1 = pesos, 2 = dólares
 * @param {"V"|"C"}  opts.condicion            V = Cuentas a Cobrar (ventas), C = Cuentas a Pagar (compras)
 * @param {string|Date} opts.fechaDesde
 * @param {string|Date} opts.fechaHasta
 * @param {string}   [opts.idsEmpresas]        default = ALBOR_COMPANY
 * @param {boolean|null} [opts.usarFechasVencimiento]  default null (como en el Power Query original)
 * @returns {Promise<Array<{
 *   documento: string, fecha: string, fechaVencimiento: string, retraso: number,
 *   total: number, monto: number, notaCredito: number, pendiente: number,
 *   tercero: string, totalGeneral: number
 * }>>}
 */
export async function getCuentasCobrarPagar(opts) {
  const { company } = getCreds();
  const fechaDesde = toAlborDate(opts.fechaDesde);
  const fechaHasta = toAlborDate(opts.fechaHasta);
  const idsEmpresas = opts.idsEmpresas ?? company;
  const idMoneda = String(opts.idMoneda);

  const json = await alborFetch("/Reportes/CuentasCobrarPagar", {
    query: {
      IdsEmpresas: idsEmpresas,
      FechaDesde: fechaDesde,
      FechaHasta: fechaHasta,
      UsarFechasVencimiento: opts.usarFechasVencimiento ?? null,
      FechaVencimientoDesde: fechaDesde,
      FechaVencimientoHasta: fechaHasta,
      IdMoneda: idMoneda,
      IdMonedaOrigen: idMoneda,
      Condicion: opts.condicion,
    },
  });
  return json?.data ?? [];
}
