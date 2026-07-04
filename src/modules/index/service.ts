import type { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path/posix";
import { parseDocumentFrontmatter } from "../../utils/frontmatter";

/** A fully hydrated index row returned by query functions. */
export interface IndexedDocument {
  slug: string;
  title: string | null;
  description: string | null;
  created: string | null;
  updated: string | null;
  author: string | null;
  tags: string[];
  securityLevel: string | null;
  securityRoles: string[];
  securityUsers: string[];
  aiPriority: string | null;
  aiIgnore: boolean;
  aiSummary: string | null;
  custom: Record<string, string>;
  indexedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toJson(value: string[] | undefined): string {
  return JSON.stringify(value ?? []);
}

function fromJson(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fromJsonObj(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

type RawRow = {
  slug: string;
  title: string | null;
  description: string | null;
  created: string | null;
  updated: string | null;
  author: string | null;
  security_level: string | null;
  security_roles: string | null;
  security_users: string | null;
  ai_priority: string | null;
  ai_ignore: number;
  ai_summary: string | null;
  custom: string | null;
  indexed_at: string;
};

function hydrateRow(row: RawRow, tags: string[]): IndexedDocument {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    created: row.created,
    updated: row.updated,
    author: row.author ?? null,
    tags,
    securityLevel: row.security_level,
    securityRoles: fromJson(row.security_roles),
    securityUsers: fromJson(row.security_users),
    aiPriority: row.ai_priority,
    aiIgnore: row.ai_ignore === 1,
    aiSummary: row.ai_summary,
    custom: fromJsonObj(row.custom),
    indexedAt: row.indexed_at,
  };
}

function getTagsForSlug(slug: string, db: Database): string[] {
  const rows = db
    .query<{ tag: string }, [string]>(
      "SELECT tag FROM document_tags WHERE slug = ? ORDER BY rowid",
    )
    .all(slug);
  return rows.map((r) => r.tag);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses the frontmatter from `content` and upserts a row for `slug` into the
 * index. Documents with `ai.ignore: true` are silently skipped (and any
 * existing row removed).
 */
export function indexDocument(
  slug: string,
  content: string,
  db: Database,
): void {
  const fm = parseDocumentFrontmatter(content);

  if (fm?.ai?.ignore === true) {
    removeFromIndex(slug, db);
    return;
  }

  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO documents
      (slug, title, description, created, updated, author,
       security_level, security_roles, security_users,
       ai_priority, ai_ignore, ai_summary, custom, indexed_at)
    VALUES
      ($slug, $title, $description, $created, $updated, $author,
       $security_level, $security_roles, $security_users,
       $ai_priority, $ai_ignore, $ai_summary, $custom, $indexed_at)
    ON CONFLICT(slug) DO UPDATE SET
      title           = excluded.title,
      description     = excluded.description,
      created         = excluded.created,
      updated         = excluded.updated,
      author          = excluded.author,
      security_level  = excluded.security_level,
      security_roles  = excluded.security_roles,
      security_users  = excluded.security_users,
      ai_priority     = excluded.ai_priority,
      ai_ignore       = excluded.ai_ignore,
      ai_summary      = excluded.ai_summary,
      custom          = excluded.custom,
      indexed_at      = excluded.indexed_at
  `);

  const deleteTags = db.prepare(
    "DELETE FROM document_tags WHERE slug = $slug",
  );
  const insertTag = db.prepare(
    "INSERT OR IGNORE INTO document_tags (slug, tag) VALUES ($slug, $tag)",
  );

  db.transaction(() => {
    upsert.run({
      $slug: slug,
      $title: fm?.title ?? null,
      $description: fm?.description ?? null,
      $created: fm?.created ?? null,
      $updated: fm?.updated ?? null,
      $author: fm?.author ?? null,
      $security_level: fm?.security?.level ?? null,
      $security_roles: toJson(fm?.security?.roles),
      $security_users: toJson(fm?.security?.users),
      $ai_priority: fm?.ai?.priority ?? null,
      $ai_ignore: fm?.ai?.ignore === true ? 1 : 0,
      $ai_summary: fm?.ai?.summary ?? null,
      $custom: fm?.custom ? JSON.stringify(fm.custom) : null,
      $indexed_at: now,
    });

    deleteTags.run({ $slug: slug });
    for (const tag of fm?.tags ?? []) {
      insertTag.run({ $slug: slug, $tag: tag });
    }
  })();
}

/** Removes a document from the index (no-op if not present). */
export function removeFromIndex(slug: string, db: Database): void {
  db.run("DELETE FROM documents WHERE slug = ?", [slug]);
}

/** Returns all indexed documents. */
export function getAll(db: Database): IndexedDocument[] {
  const rows = db
    .query<RawRow, []>("SELECT * FROM documents")
    .all();
  return rows.map((row) => hydrateRow(row, getTagsForSlug(row.slug, db)));
}

/** Returns documents that have the given tag. */
export function findByTag(tag: string, db: Database): IndexedDocument[] {
  const rows = db
    .query<RawRow, [string]>(`
      SELECT d.* FROM documents d
      JOIN document_tags t ON t.slug = d.slug
      WHERE t.tag = ?
    `)
    .all(tag);
  return rows.map((row) => hydrateRow(row, getTagsForSlug(row.slug, db)));
}

/** Case-insensitive LIKE search across title and description. */
export function findByTitle(query: string, db: Database): IndexedDocument[] {
  const pattern = `%${query}%`;
  const rows = db
    .query<RawRow, [string, string]>(`
      SELECT * FROM documents
      WHERE title LIKE ? OR description LIKE ?
    `)
    .all(pattern, pattern);
  return rows.map((row) => hydrateRow(row, getTagsForSlug(row.slug, db)));
}

/**
 * Recursively scans `baseDir` (and all child folders) for `.md` files and
 * indexes each one. Any previously indexed document whose file no longer
 * exists under the scanned tree is removed from the index.
 * Pass `slug` to scope the scan to a sub-folder.
 */
export async function indexDirectory(
  db: Database,
  baseDir: string = "documents",
  slug: string = "",
): Promise<void> {
  const found = new Set<string>();
  await scanDir(db, baseDir, slug, found);

  // Remove stale index entries (files that were deleted from disk).
  const prefix = slug ? `${slug}/` : "";
  const rows = db
    .query<{ slug: string }, []>("SELECT slug FROM documents")
    .all();
  for (const { slug: s } of rows) {
    if (prefix && !s.startsWith(prefix)) continue;
    if (!found.has(s)) {
      removeFromIndex(s, db);
    }
  }
}

async function scanDir(
  db: Database,
  baseDir: string,
  relSlug: string,
  found: Set<string>,
): Promise<void> {
  const dir = relSlug ? join(baseDir, relSlug) : baseDir;

  let entries: import("fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subSlug = relSlug ? `${relSlug}/${entry.name}` : entry.name;
      await scanDir(db, baseDir, subSlug, found);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const baseName = entry.name.slice(0, -3);
      const docSlug = relSlug ? `${relSlug}/${baseName}` : baseName;
      found.add(docSlug);
      const filePath = join(dir, entry.name);
      const content = await Bun.file(filePath).text();
      indexDocument(docSlug, content, db);
    }
  }
}
