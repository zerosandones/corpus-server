import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import path from "path";
import { readdir, stat as fsStat, unlink } from "node:fs/promises";
import { loadConfig } from "./config.ts";
import { parseFrontmatter, serializeDocument, extractHeadings } from "./parser.ts";
import { loadAclForPath, checkAccess, resolveStaticToken } from "./acl.ts";
import { SearchIndex } from "./search.ts";
import { startWatcher } from "./watcher.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BINARY_EXTENSIONS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  pdf: "application/pdf",
  zip: "application/zip",
  mp3: "audio/mpeg",
};

function errorBody(
  code: string,
  message: string,
  reqPath: string
): Record<string, string> {
  return { code, message, path: reqPath, timestamp: new Date().toISOString() };
}

function sanitizePath(reqPath: string, storageRoot: string): string | null {
  const absRoot = path.resolve(storageRoot);
  const joined = path.join(absRoot, reqPath);
  const resolved = path.resolve(joined);
  if (!resolved.startsWith(absRoot + path.sep) && resolved !== absRoot) {
    return null;
  }
  return resolved;
}

async function buildDirectoryIndex(
  absDir: string,
  storageRoot: string,
  urlBase: string,
  limit: number,
  offset: number
): Promise<{
  directory: string;
  parent: string;
  totalFiles: number;
  limit: number;
  offset: number;
  folders: Array<{ name: string; path: string; childCount: number }>;
  files: Array<{
    name: string;
    path: string;
    size: number;
    updated: string;
    metadata: { title: string; description: string; tags: string[]; author: string };
  }>;
}> {
  const absRoot = path.resolve(storageRoot);
  let entries: string[] = [];
  try {
    entries = await readdir(absDir);
  } catch {
    entries = [];
  }

  const folders: Array<{ name: string; path: string; childCount: number }> = [];
  const files: Array<{
    name: string;
    path: string;
    size: number;
    updated: string;
    metadata: { title: string; description: string; tags: string[]; author: string };
  }> = [];

  for (const name of entries) {
    if (name.startsWith(".")) continue;

    const absEntry = path.join(absDir, name);
    let entryStat: Awaited<ReturnType<typeof fsStat>> | null = null;
    try {
      entryStat = await fsStat(absEntry);
    } catch {
      continue;
    }

    const relToStorage = path.relative(absRoot, absEntry);
    const urlPath = "/" + relToStorage;

    if (entryStat.isDirectory()) {
      let childCount = 0;
      try {
        const children = await readdir(absEntry);
        childCount = children.filter((c) => !c.startsWith(".")).length;
      } catch {}
      folders.push({ name, path: urlPath, childCount });
    } else if (name.endsWith(".md")) {
      try {
        const text = await Bun.file(absEntry).text();
        const { frontmatter } = parseFrontmatter(text);
        const nameStem = name.replace(/\.md$/, "");
        files.push({
          name,
          path: urlPath.replace(/\.md$/, ""),
          size: entryStat.size,
          updated: String(
            frontmatter.updated ?? entryStat.mtime?.toISOString() ?? new Date().toISOString()
          ),
          metadata: {
            title: String(frontmatter.title ?? nameStem),
            description: String(frontmatter.description ?? ""),
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
            author: String(frontmatter.author ?? ""),
          },
        });
      } catch {}
    }
  }

  const totalFiles = files.length;
  const pagedFiles = files.slice(offset, offset + limit);

  return {
    directory: urlBase,
    parent: urlBase === "/" ? "/" : path.dirname(urlBase),
    totalFiles,
    limit,
    offset,
    folders,
    files: pagedFiles,
  };
}

function buildDirectoryMarkdown(
  index: Awaited<ReturnType<typeof buildDirectoryIndex>>
): string {
  const lines: string[] = [`# Index of \`${index.directory}\`\n`];

  if (index.folders.length > 0) {
    lines.push("## Subfolders\n");
    for (const f of index.folders) {
      lines.push(`* [${f.name}](${f.path}) (${f.childCount} items)`);
    }
    lines.push("");
  }

  if (index.files.length > 0) {
    lines.push("## Documents\n");
    for (const f of index.files) {
      lines.push(`* **[${f.metadata.title}](${f.path})**`);
      if (f.metadata.description)
        lines.push(`  * *Description*: ${f.metadata.description}`);
      if (f.metadata.tags.length > 0)
        lines.push(
          `  * *Tags*: ${f.metadata.tags.map((t) => `\`${t}\``).join(", ")}`
        );
      if (f.metadata.author) lines.push(`  * *Author*: ${f.metadata.author}`);
      lines.push(`  * *Last Modified*: ${f.updated.slice(0, 10)}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const config = await loadConfig();
const storageRoot = path.resolve(config.storage.root);

const searchIndex = new SearchIndex(config.database.path);
await searchIndex.buildIndex(storageRoot);
startWatcher(storageRoot, searchIndex);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const app = new Elysia()
  .use(
    swagger({
      path: "/_docs",
      documentation: {
        info: { title: "Corpus Server API", version: "0.1.0" },
      },
    })
  )
  .decorate("config", config)
  .decorate("db", searchIndex)

  // Auth derive
  .derive(({ headers, config }) => {
    const authHeader = headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const caller =
      config.auth.type === "static" && token
        ? resolveStaticToken(token, config.auth.tokens)
        : null;
    return { caller };
  })

  // Global error handler
  .onError(({ code, error, request }) => {
    const url = new URL(request.url);
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      VALIDATION: 400,
      INTERNAL_SERVER_ERROR: 500,
      PARSE: 400,
    };
    const status = statusMap[code] ?? 500;
    return new Response(
      JSON.stringify(
        errorBody(
          code,
          error instanceof Error ? error.message : String(error),
          url.pathname
        )
      ),
      { status, headers: { "Content-Type": "application/json" } }
    );
  })

  // ---------------------------------------------------------------------------
  // GET /_search
  // ---------------------------------------------------------------------------
  .get(
    "/_search",
    async ({ query, db }) => {
      const { q, scope } = query;
      try {
        const results = db.search(q, scope);
        return { query: q, results };
      } catch {
        return { query: q, results: [] };
      }
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        type: t.Optional(t.Union([t.Literal("fulltext"), t.Literal("semantic"), t.Literal("tags")])),
        scope: t.Optional(t.String()),
      }),
      detail: { summary: "Full-text search across all documents" },
    }
  )

  // ---------------------------------------------------------------------------
  // PUT /* – create or update a document
  // ---------------------------------------------------------------------------
  .put(
    "/*",
    async ({ params, body, headers, caller, config, db, set }) => {
      const reqPath = "/" + params["*"];

      if (!caller) {
        set.status = 401;
        return errorBody("UNAUTHORIZED", "Authentication required", reqPath);
      }

      const absPath = sanitizePath(reqPath, storageRoot);
      if (!absPath) {
        set.status = 400;
        return errorBody("BAD_REQUEST", "Invalid path", reqPath);
      }

      // Determine the final .md path
      let targetPath = absPath;
      if (!targetPath.endsWith(".md")) targetPath += ".md";

      const exists = await Bun.file(targetPath).exists();

      // Build content to write
      let content: string;
      const contentType = headers["content-type"] ?? "";

      if (contentType.includes("application/json")) {
        const json = body as { frontmatter: Record<string, unknown>; body: string };
        const fm = {
          ...json.frontmatter,
          updated: new Date().toISOString(),
          ...(exists ? {} : { created: new Date().toISOString() }),
        };
        content = serializeDocument(fm, json.body);
      } else {
        // text/markdown — raw body string
        const rawContent = body as string;
        const { frontmatter, body: mdBody } = parseFrontmatter(rawContent);
        frontmatter.updated = new Date().toISOString();
        if (!exists) frontmatter.created = frontmatter.created ?? new Date().toISOString();
        content = serializeDocument(frontmatter, mdBody);
      }

      // Ensure parent dirs exist
      await Bun.write(targetPath, content);

      // Update search index
      const { frontmatter: fm2, body: mdBody2 } = parseFrontmatter(content);
      const relPath = "/" + path.relative(storageRoot, targetPath);
      db.upsert(
        relPath.replace(/\.md$/, ""),
        String(fm2.title ?? path.basename(targetPath, ".md")),
        String(fm2.description ?? ""),
        Array.isArray(fm2.tags) ? fm2.tags.map(String) : [],
        mdBody2
      );

      set.status = exists ? 200 : 201;
      return { success: true, path: relPath.replace(/\.md$/, ""), created: !exists };
    },
    {
      params: t.Object({ "*": t.String() }),
      body: t.Union([
        t.Object({
          frontmatter: t.Record(t.String(), t.Unknown()),
          body: t.String(),
        }),
        t.String(),
      ]),
      detail: { summary: "Create or update a document" },
    }
  )

  // ---------------------------------------------------------------------------
  // DELETE /* – delete a document
  // ---------------------------------------------------------------------------
  .delete(
    "/*",
    async ({ params, caller, set }) => {
      const reqPath = "/" + params["*"];

      if (!caller) {
        set.status = 401;
        return errorBody("UNAUTHORIZED", "Authentication required", reqPath);
      }

      const absPath = sanitizePath(reqPath, storageRoot);
      if (!absPath) {
        set.status = 400;
        return errorBody("BAD_REQUEST", "Invalid path", reqPath);
      }

      let targetPath = absPath;
      if (!targetPath.endsWith(".md")) targetPath += ".md";

      if (!(await Bun.file(targetPath).exists())) {
        set.status = 404;
        return errorBody("NOT_FOUND", `Document '${reqPath}' not found`, reqPath);
      }

      // unlink the file
      await unlink(targetPath);

      searchIndex.remove("/" + path.relative(storageRoot, targetPath).replace(/\.md$/, ""));

      set.status = 204;
      return null;
    },
    {
      params: t.Object({ "*": t.String() }),
      detail: { summary: "Delete a document" },
    }
  )

  // ---------------------------------------------------------------------------
  // POST /*/_assets – upload binary asset
  // ---------------------------------------------------------------------------
  .post(
    "/*/_assets",
    async ({ params, body, caller, config: cfg, set }) => {
      const reqPath = "/" + params["*"];

      if (!caller) {
        set.status = 401;
        return errorBody("UNAUTHORIZED", "Authentication required", reqPath);
      }

      const absDir = sanitizePath(reqPath, storageRoot);
      if (!absDir) {
        set.status = 400;
        return errorBody("BAD_REQUEST", "Invalid path", reqPath);
      }

      const assetDir = path.join(absDir, cfg.storage.assetsDir);
      const file = (body as { file: File }).file;
      if (!file) {
        set.status = 400;
        return errorBody("BAD_REQUEST", "No file uploaded", reqPath);
      }

      const destPath = path.join(assetDir, file.name);
      await Bun.write(destPath, file);

      const relUrl = "/" + path.relative(storageRoot, destPath);
      set.status = 201;
      return {
        url: relUrl,
        markdown: `![${file.name}](${relUrl})`,
      };
    },
    {
      params: t.Object({ "*": t.String() }),
      body: t.Object({ file: t.File() }),
      detail: { summary: "Upload a binary asset" },
    }
  )

  // ---------------------------------------------------------------------------
  // GET /* – read document or list directory
  // ---------------------------------------------------------------------------
  .get(
    "/*",
    async ({ params, headers, query, caller, set, request }) => {
      const reqPath = "/" + (params["*"] || "");
      const url = new URL(request.url);

      const absPath = sanitizePath(reqPath, storageRoot);
      if (!absPath) {
        set.status = 400;
        return new Response(
          JSON.stringify(errorBody("BAD_REQUEST", "Invalid path", reqPath)),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Binary extension check
      const ext = path.extname(absPath).slice(1).toLowerCase();
      if (ext && BINARY_EXTENSIONS[ext]) {
        const binFile = Bun.file(absPath);
        if (!(await binFile.exists())) {
          return new Response(
            JSON.stringify(errorBody("NOT_FOUND", `Asset '${reqPath}' not found`, reqPath)),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(binFile.stream(), {
          headers: { "Content-Type": BINARY_EXTENSIONS[ext] },
        });
      }

      const accept = headers["accept"] ?? "text/markdown";
      const wantsJson = accept.includes("application/json");

      const limit = Math.min(Number(query.limit ?? 100), 500);
      const offset = Number(query.offset ?? 0);

      // Check for directory
      const dirStat = await Bun.file(absPath)
        .stat()
        .catch(() => null);
      const isDir = dirStat?.isDirectory() ?? false;

      // If it's a directory
      if (isDir) {
        const folderAcl = await loadAclForPath(absPath, storageRoot);
        const access = checkAccess(undefined, folderAcl, caller);
        if (access === "unauthorized") {
          return new Response(
            JSON.stringify(errorBody("UNAUTHORIZED", "Authentication required", reqPath)),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        if (access === "forbidden") {
          return new Response(
            JSON.stringify(errorBody("FORBIDDEN", "Access denied", reqPath)),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        const idx = await buildDirectoryIndex(absPath, storageRoot, reqPath, limit, offset);
        if (wantsJson) {
          return Response.json(idx);
        }
        return new Response(buildDirectoryMarkdown(idx), {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }

      // Try to resolve as .md file
      let mdPath = absPath;
      if (!mdPath.endsWith(".md")) mdPath += ".md";

      const mdFile = Bun.file(mdPath);
      if (!(await mdFile.exists())) {
        // Check if there's an index.md inside a directory with same name
        const indexPath = path.join(absPath, "index.md");
        const indexFile = Bun.file(indexPath);
        if (await indexFile.exists()) {
          mdPath = indexPath;
        } else {
          return new Response(
            JSON.stringify(
              errorBody("NOT_FOUND", `Document '${reqPath}' not found`, reqPath)
            ),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // ACL check
      const text = await Bun.file(mdPath).text();
      const { frontmatter, body } = parseFrontmatter(text);
      const folderAcl = await loadAclForPath(mdPath, storageRoot);
      const access = checkAccess(
        frontmatter.security as any,
        folderAcl,
        caller
      );
      if (access === "unauthorized") {
        return new Response(
          JSON.stringify(errorBody("UNAUTHORIZED", "Authentication required", reqPath)),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      if (access === "forbidden") {
        return new Response(
          JSON.stringify(errorBody("FORBIDDEN", "Access denied", reqPath)),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (wantsJson) {
        const relPath = "/" + path.relative(storageRoot, mdPath);
        return Response.json({
          path: relPath,
          frontmatter,
          body,
          headings: extractHeadings(body),
        });
      }

      return new Response(text, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    },
    {
      params: t.Object({ "*": t.String() }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      detail: { summary: "Get a document or directory listing" },
    }
  );

// ---------------------------------------------------------------------------
// Start server (skip in test environment)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== "test") {
  app.listen({ hostname: config.server.host, port: config.server.port });
  console.log(
    `🚀 Corpus Server running at http://${config.server.host}:${config.server.port}`
  );
  console.log(`   Swagger UI: http://${config.server.host}:${config.server.port}/_docs`);
  console.log(`   Storage:    ${storageRoot}`);
}
