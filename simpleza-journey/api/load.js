// api/load.js — GET: devuelve {state, matrix, history, snapshots}
import { getDb, setCors, handleOptions } from "../lib/db.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getDb();
    const [stateRow, matrixRow, historyRows, snapshotRows] = await Promise.all([
      db.execute("SELECT data, updated_at FROM journey_state WHERE id = 1"),
      db.execute("SELECT data, updated_at FROM journey_matrix WHERE id = 1"),
      db.execute("SELECT ts, etapa_id, etapa_name, field, field_label, old_val, new_val FROM journey_history ORDER BY ts DESC LIMIT 500"),
      db.execute("SELECT id, name, ts, data FROM journey_snapshots ORDER BY ts ASC")
    ]);

    const state = stateRow.rows[0] ? JSON.parse(stateRow.rows[0].data) : null;
    const matrix = matrixRow.rows[0] ? JSON.parse(matrixRow.rows[0].data) : {};
    const history = historyRows.rows.map(r => ({
      ts: new Date(Number(r.ts)).toISOString(),
      etapaId: r.etapa_id,
      etapaName: r.etapa_name,
      field: r.field,
      fieldLabel: r.field_label,
      oldVal: r.old_val,
      newVal: r.new_val
    }));
    const snapshots = snapshotRows.rows.map(r => ({
      id: r.id,
      name: r.name,
      ts: new Date(Number(r.ts)).toISOString(),
      ...JSON.parse(r.data)
    }));

    res.status(200).json({ state, matrix, history, snapshots });
  } catch (err) {
    console.error("load error:", err);
    res.status(500).json({ error: err.message });
  }
}
