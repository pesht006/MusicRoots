import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.MUSICROOTS_DB || join(__dirname, "..", "data.sqlite");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('artist','band')),
      bio         TEXT DEFAULT '',
      active_from INTEGER,
      active_to   INTEGER,
      country     TEXT DEFAULT '',
      tags        TEXT DEFAULT '',
      image_url   TEXT DEFAULT '',
      wiki        TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Edge: 'artist_id' was influenced by 'influenced_by_id'.
    -- Read A -> B as "A draws influence from (has roots in) B".
    CREATE TABLE IF NOT EXISTS influences (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id       INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      influenced_by_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      description     TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'approved'
                        CHECK (status IN ('approved','pending','rejected')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (artist_id, influenced_by_id)
    );

    CREATE TABLE IF NOT EXISTS sources (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      influence_id INTEGER NOT NULL REFERENCES influences(id) ON DELETE CASCADE,
      type         TEXT NOT NULL CHECK (type IN
                     ('interview','autobiography','encyclopedia',
                      'documentary','official','other')),
      citation     TEXT NOT NULL,
      url          TEXT DEFAULT '',
      author       TEXT DEFAULT '',
      year         INTEGER
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kind          TEXT NOT NULL CHECK (kind IN
                      ('new_influence','new_source','error_report','correction')),
      payload       TEXT NOT NULL,
      submitter     TEXT DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
      moderator_note TEXT DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inf_artist ON influences(artist_id);
    CREATE INDEX IF NOT EXISTS idx_inf_by     ON influences(influenced_by_id);
    CREATE INDEX IF NOT EXISTS idx_src_inf    ON sources(influence_id);
    CREATE INDEX IF NOT EXISTS idx_contrib_status ON contributions(status);
  `);
}

initSchema();
