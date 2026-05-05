// api/snapshots.js — POST: crea snapshot · DELETE ?id=X: elimina snapshot
import { getDb, setCors, handleOptions, readJsonBody, requirePasscode } from "../lib/db.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method === "POST" || req.method === "DELETE") {
    if (requirePasscode(req, res)) return;
  }

  try {
    const db = getDb();

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const id = body.id || ("snap_" + Date.now());
      const name = body.name || "Snapshot";
      const ts = body.ts ? new Date(body.ts).getTime() : Date.now();
      const data = JSON.stringify({ etapas: body.etapas || [], matrix: body.matrix || {} });

      await db.execute({
        sql: `INSERT INTO journey_snapshots (id, name, ts, data) VALUES (?, ?, ?, ?)`,
        args: [id, name, ts, data]
      });
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === "DELETE") {
      const id = (req.query && req.query.id) || new URL(req.url, "http://x").searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Falta id" });
      await db.execute({ sql: `DELETE FROM journey_snapshots WHERE id = ?`, args: [id] });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("snapshots error:", err);
    res.status(500).json({ error: err.message });
  }
}
