-- ===== Simpleza Customer Journey — Schema Turso =====
-- Ejecutar una sola vez al crear la base, ya sea desde la CLI de Turso
-- (`turso db shell <db-name> < schema.sql`) o desde el dashboard.

-- Estado actual del journey (singleton: id=1).
-- Guarda etapas e indicadores como JSON en una columna TEXT.
CREATE TABLE IF NOT EXISTS journey_state (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Matriz de cross-sell (singleton: id=1).
CREATE TABLE IF NOT EXISTS journey_matrix (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Log de cambios (cada edición queda registrada con fecha).
CREATE TABLE IF NOT EXISTS journey_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  etapa_id TEXT NOT NULL,
  etapa_name TEXT,
  field TEXT,
  field_label TEXT,
  old_val TEXT,
  new_val TEXT
);

-- Snapshots con nombre y fecha (versiones del diagnóstico para comparar evolución).
CREATE TABLE IF NOT EXISTS journey_snapshots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ts INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_ts ON journey_history(ts DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON journey_snapshots(ts DESC);
