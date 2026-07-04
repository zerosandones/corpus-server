import type { Database } from "bun:sqlite";

/**
 * Initialises the document index schema on the given SQLite database.
 * Safe to call multiple times (uses `CREATE TABLE IF NOT EXISTS`).
 */
export function initDb(db: Database): void {
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      slug            TEXT    PRIMARY KEY,
      title           TEXT,
      description     TEXT,
      created         TEXT,
      updated         TEXT,
      author          TEXT,
      security_level  TEXT,
      security_roles  TEXT,
      security_users  TEXT,
      ai_priority     TEXT,
      ai_ignore       INTEGER NOT NULL DEFAULT 0,
      ai_summary      TEXT,
      custom          TEXT,
      indexed_at      TEXT    NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS document_tags (
      slug  TEXT NOT NULL REFERENCES documents(slug) ON DELETE CASCADE,
      tag   TEXT NOT NULL,
      PRIMARY KEY (slug, tag)
    );
  `);
}
