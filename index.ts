import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  ensureDocsDir,
} from "./src/storage";

const PORT = Number(process.env.PORT) || 3000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(message = "Not found"): Response {
  return json({ error: message }, 404);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method.toUpperCase();

  // GET /documents
  if (method === "GET" && pathname === "/documents") {
    const docs = await listDocuments();
    return json(docs);
  }

  // POST /documents
  if (method === "POST" && pathname === "/documents") {
    let body: { title?: unknown; content?: unknown; id?: unknown };
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return badRequest("'title' is required and must be a non-empty string");
    }
    if (typeof body.content !== "string") {
      return badRequest("'content' is required and must be a string");
    }
    const idOverride =
      typeof body.id === "string" && body.id.trim() !== ""
        ? body.id.trim()
        : undefined;
    const doc = await createDocument(body.title.trim(), body.content, idOverride);
    return json(doc, 201);
  }

  // Routes under /documents/:id
  const idMatch = pathname.match(/^\/documents\/([^/]+)$/);
  if (!idMatch) {
    return notFound("Route not found");
  }
  const id = decodeURIComponent(idMatch[1]);

  // GET /documents/:id
  if (method === "GET") {
    const doc = await getDocument(id);
    if (!doc) return notFound("Document not found");
    return json(doc);
  }

  // PUT /documents/:id
  if (method === "PUT") {
    let body: { title?: unknown; content?: unknown };
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }
    const updates: { title?: string; content?: string } = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim() === "") {
        return badRequest("'title' must be a non-empty string");
      }
      updates.title = body.title.trim();
    }
    if (body.content !== undefined) {
      if (typeof body.content !== "string") {
        return badRequest("'content' must be a string");
      }
      updates.content = body.content;
    }
    if (Object.keys(updates).length === 0) {
      return badRequest("At least one of 'title' or 'content' must be provided");
    }
    const doc = await updateDocument(id, updates);
    if (!doc) return notFound("Document not found");
    return json(doc);
  }

  // DELETE /documents/:id
  if (method === "DELETE") {
    const deleted = await deleteDocument(id);
    if (!deleted) return notFound("Document not found");
    return json({ message: "Document deleted" });
  }

  return json({ error: "Method not allowed" }, 405);
}

await ensureDocsDir();

const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`corpus-server listening on http://localhost:${server.port}`);

export default server;