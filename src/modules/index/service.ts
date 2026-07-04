import type { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path/posix";
import { parseDocumentFrontmatter } from "../../utils/frontmatter";

/** A fully hydrated index row returned by query functions. */
export interface IndexedDocument {
  slug: string;
  title: string | null;
  description: string | null;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RawRow = {
  slug: string;
  title: string | null;
  description: string | null;
};

function hydrateRow(row: RawRow, tags: string[]): IndexedDocument {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags,
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

  const upsert = db.prepare(`
    INSERT INTO documents (slug, title, description)
    VALUES ($slug, $title, $description)
    ON CONFLICT(slug) DO UPDATE SET
      title       = excluded.title,
      description = excluded.description
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
