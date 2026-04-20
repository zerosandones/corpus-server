import type { BunRequest } from "bun";
import { ensureDocsDir, getDocument, listFolder, saveDocument } from "./storage";
import type { FolderEntry } from "./storage";

function buildFolderIndex(heading: string, entries: FolderEntry[]): string {
  const lines = [`# ${heading}`, ""];
  for (const entry of entries) {
    const baseName = entry.slug.split("/").pop() ?? entry.slug;
    const label = entry.title ?? baseName;
    lines.push(`- [${label}](/${entry.slug})`);
  }
  return lines.join("\n");
}

console.log("Starting server...");

console.log("Checking data directory...")
await ensureDocsDir();
console.log("Data directory is ready.");

const server = Bun.serve({

  port: Number(process.env.PORT) || 8080,

  async fetch(req) {
    console.log(`Received request: ${req.method} ${req.url}`);
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Match any non-root path for routing
    const pathMatch = pathname.match(/^\/(.+)$/);

    if (req.method === "POST" && pathMatch) {
      const slug = pathMatch[1];
      const content = await req.text();
      const result = await saveDocument(slug, content);
      if (result === "created") {
        console.log(`Document saved for slug: ${slug}`);
        return new Response("Created", { status: 200 });
      }
      if (result === "conflict") {
        console.log(`Document conflict for slug: ${slug}`);
        return new Response("Conflict", { status: 409 });
      }
      // invalid slug
      console.log(`Invalid slug for POST: ${slug}`);
      return new Response("Bad Request", { status: 400 });
    }

    if (req.method === "GET" && pathname === "/") {
      console.log("Listing root folder index");
      const entries = await listFolder();
      if (entries === null || entries.length === 0) {
        return new Response(null, { status: 204 });
      }
      return new Response(buildFolderIndex("Index", entries), {
        status: 200,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }

    // Match /:slug — single path segment, no extension
    const match = pathname.match(/^\/([^/]+)$/);
    if (match) {
      const slug = match[1] as string;
      const content = await getDocument(slug);
      if (content !== null) {
        console.log(`Serving document for slug: ${slug}`);
        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
          },
        });
      }

      const folderEntries = await listFolder(slug);
      if (folderEntries !== null) {
        if (folderEntries.length === 0) {
          console.log(`Empty folder for slug: ${slug}`);
          return new Response(null, { status: 204 });
        }
        console.log(`Serving folder index for slug: ${slug}`);
        return new Response(buildFolderIndex(slug, folderEntries), {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
    }

    //default handler for all unmatched routes
    console.log(`No matching route for: ${req.method} ${req.url}`);
    return new Response("Not found", { status: 404 });
  }

})
console.log(`corpus-server listening on http://localhost:${server.port}`);

export default server;