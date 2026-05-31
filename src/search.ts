import { Database } from "bun:sqlite";
import { parseFrontmatter } from "./parser.ts";
import path from "path";

export interface SearchResult {
  path: string;
  title: string;
  description: string;
  score: number;
  highlights: string[];
}

export class SearchIndex {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath === ":memory:" ? ":memory:" : dbPath);
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS docs
      USING fts5(path UNINDEXED, title, description, tags, body);
    `);
  }

  async buildIndex(storageRoot: string): Promise<void> {
    const absRoot = path.resolve(storageRoot);
    const glob = new Bun.Glob("**/*.md");
    for await (const rel of glob.scan(absRoot)) {
      const absPath = path.join(absRoot, rel);
      try {
        const file = Bun.file(absPath);
        const text = await file.text();
        const { frontmatter, body } = parseFrontmatter(text);
        this.upsert(
          "/" + rel,
          String(frontmatter.title ?? rel),
          String(frontmatter.description ?? ""),
          Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
          body
        );
      } catch {
        // skip unreadable files
      }
    }
  }

  upsert(
    filePath: string,
    title: string,
    description: string,
    tags: string[],
    body: string
  ): void {
    this.db.run(`DELETE FROM docs WHERE path = ?`, [filePath]);
    this.db.run(
      `INSERT INTO docs (path, title, description, tags, body) VALUES (?, ?, ?, ?, ?)`,
      [filePath, title, description, tags.join(" "), body]
    );
  }

  remove(filePath: string): void {
    this.db.run(`DELETE FROM docs WHERE path = ?`, [filePath]);
  }

  search(query: string, scope?: string, limit = 20): SearchResult[] {
    const stmt = this.db.prepare<
      { path: string; title: string; description: string; rank: number },
      [string, number]
    >(
      `SELECT path, title, description, rank
       FROM docs
       WHERE docs MATCH ?
       ORDER BY rank
       LIMIT ?`
    );
    const rows = stmt.all(query, limit);
    return rows
      .filter((r) => !scope || r.path.startsWith(scope))
      .map((r) => ({
        path: r.path,
        title: r.title,
        description: r.description,
        score: Math.abs(r.rank),
        highlights: [r.description?.slice(0, 120) ?? ""].filter(Boolean),
      }));
  }
}
