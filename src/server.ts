import type { BunRequest } from "bun";
import { ensureDocsDir, getDocument } from "./storage";

console.log("Starting server...");

console.log("Checking data directory...")
await ensureDocsDir();
console.log("Data directory is ready.");

const server = Bun.serve({

  port: Number(process.env.PORT) || 8080,

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Match /:slug — single path segment, no extension
    const match = pathname.match(/^\/([^/]+)$/);
    if (match) {
      const slug = match[1] as string;
      const content = await getDocument(slug);
      if (content !== null) {
        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
          },
        });
      }
    }

    //default handler for all unmatched routes
    return new Response("Not found", { status: 404 });
  }

})
console.log(`corpus-server listening on http://localhost:${server.port}`);

export default server;