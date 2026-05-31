import chokidar from "chokidar";
import type { SearchIndex } from "./search.ts";
import { parseFrontmatter } from "./parser.ts";
import path from "path";

export function startWatcher(storageRoot: string, index: SearchIndex): void {
  const absRoot = path.resolve(storageRoot);

  const watcher = chokidar.watch(absRoot, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
  });

  const upsertFile = async (filePath: string) => {
    if (!filePath.endsWith(".md")) return;
    try {
      const file = Bun.file(filePath);
      const text = await file.text();
      const { frontmatter, body } = parseFrontmatter(text);
      const relPath = "/" + path.relative(absRoot, filePath);
      index.upsert(
        relPath,
        String(frontmatter.title ?? path.basename(filePath)),
        String(frontmatter.description ?? ""),
        Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
        body
      );
    } catch {
      // ignore unreadable files
    }
  };

  watcher
    .on("add", upsertFile)
    .on("change", upsertFile)
    .on("unlink", (filePath: string) => {
      if (!filePath.endsWith(".md")) return;
      const relPath = "/" + path.relative(absRoot, filePath);
      index.remove(relPath);
    });
}
