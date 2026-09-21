CREATE TABLE IF NOT EXISTS farmer_profiles (
  phone      TEXT PRIMARY KEY,
  province   TEXT NOT NULL,
  main_crop  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  phone      TEXT NOT NULL,
  crop       TEXT NOT NULL,
  topic      TEXT NOT NULL,
  response   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interactions_phone ON interactions (phone);
