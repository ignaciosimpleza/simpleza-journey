// api/history.js — POST: registra una entrada de cambio
// Body: { ts?, etapaId, etapaName, field, fieldLabel, oldVal, newVal }
import { getDb, setCors, handleOptions, readJsonBody, requirePasscode } from "../lib/db.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (requirePasscode(req, res)) return;

  try {
    const body = await readJsonBody(req);
    const db = getDb();
    const ts = body.ts ? new Date(body.ts).getTime() : Date.now();

    await db.execute({
      sql: `INSERT INTO journey_history (ts, etapa_id, etapa_name, field, field_label, old_val, new_val)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ts,
        body.etapaId || "",
        body.etapaName || "",
        body.field || "",
        body.fieldLabel || "",
        String(body.oldVal ?? ""),
        String(body.newVal ?? "")
      ]
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("history error:", err);
    res.status(500).json({ error: err.message });
  }
}
