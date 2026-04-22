import { ensureDocsDir, getDocument, saveDocument, updateDocument, deleteDocument } from "./storage";

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

    if (req.method === "DELETE" && pathMatch) {
      const slug = pathMatch[1];
      try {
        const result = await deleteDocument(slug);
        if (result === "deleted") {
          console.log(`Document deleted for slug: ${slug}`);
          return new Response("OK", { status: 200 });
        }
        if (result === "not-found") {
          console.log(`Document not found for DELETE: ${slug}`);
          return new Response("Not found", { status: 404 });
        }
        if (result === "invalid") {
          console.log(`Invalid slug for DELETE: ${slug}`);
          return new Response("Not found", { status: 404 });
        }
      } catch (err) {
        console.error(`Error deleting document for slug: ${slug}`, err);
        return new Response("Internal Server Error", { status: 500 });
      }
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