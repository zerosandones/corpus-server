import type { BunRequest } from "bun";
import { authenticate } from "./auth";
import { ensureDocsDir, getDocument, saveDocument, updateDocument } from "./storage";

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

    if (req.method === "PUT" && pathMatch) {
      const principal = await authenticate(req);
      if (!principal) {
        console.log(`Unauthenticated PUT: ${req.url}`);
        return new Response("Unauthorized", { status: 401 });
      }
      if (!principal.scopes.includes("write")) {
        console.log(`Forbidden PUT (missing write scope) for principal: ${principal.id}`);
        return new Response("Forbidden", { status: 403 });
      }
      const slug = pathMatch[1] as string;
      const content = await req.text();
      const result = await updateDocument(slug, content);
      if (result === "updated") {
        console.log(`Document updated for slug: ${slug}`);
        return new Response("OK", { status: 200 });
      }
      if (result === "not_found") {
        console.log(`Document not found for PUT: ${slug}`);
        return new Response("Not found", { status: 404 });
      }
      // invalid slug
      console.log(`Invalid slug for PUT: ${slug}`);
      return new Response("Bad Request", { status: 400 });
    }

    if (req.method === "POST" && pathMatch) {
      const principal = await authenticate(req);
      if (!principal) {
        console.log(`Unauthenticated POST: ${req.url}`);
        return new Response("Unauthorized", { status: 401 });
      }
      if (!principal.scopes.includes("write")) {
        console.log(`Forbidden POST (missing write scope) for principal: ${principal.id}`);
        return new Response("Forbidden", { status: 403 });
      }
      const slug = pathMatch[1] as string;
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
    }

    //default handler for all unmatched routes
    console.log(`No matching route for: ${req.method} ${req.url}`);
    return new Response("Not found", { status: 404 });
  }

})
console.log(`corpus-server listening on port ${server.port}`);

export default server;