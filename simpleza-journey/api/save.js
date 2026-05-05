// api/save.js — POST: upsert del estado y matrix
// Body: { etapas?: [...], matrix?: {...} }
import { getDb, setCors, handleOptions, readJsonBody } from "../lib/db.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const db = getDb();
    const now = Date.now();

    if (body.etapas !== undefined) {
      const data = JSON.stringify({ etapas: body.etapas });
      await db.execute({
        sql: `INSERT INTO journey_state (id, data, updated_at) VALUES (1, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        args: [data, now]
      });
    }

    if (body.matrix !== undefined) {
      const data = JSON.stringify(body.matrix);
      await db.execute({
        sql: `INSERT INTO journey_matrix (id, data, updated_at) VALUES (1, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        args: [data, now]
      });
    }

    res.status(200).json({ ok: true, updated_at: now });
  } catch (err) {
    console.error("save error:", err);
    res.status(500).json({ error: err.message });
  }
}
