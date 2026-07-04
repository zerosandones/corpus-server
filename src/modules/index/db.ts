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
      slug        TEXT PRIMARY KEY,
      title       TEXT,
      description TEXT
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
