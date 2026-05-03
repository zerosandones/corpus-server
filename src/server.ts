import {
  ensureDocsDir,
  getDocument,
  getDocumentSecurity,
  saveDocument,
  updateDocument,
  deleteDocument,
  listFolder,
} from "./storage";
import { formatFolderIndex } from "./response-formatter";
import { createUser, verifyUser, ensureUsersDb } from "./users";
import { signToken } from "./jwt";
import { requireAuth, isProtectedDocument, type AuthError } from "./auth";

console.log("Starting server...");

console.log("Checking data directory...");
await ensureDocsDir();
await ensureUsersDb();
console.log("Data directory is ready.");

const server = Bun.serve({
  port: Number(process.env.PORT) || 8080,

  async fetch(req) {
    console.log(`Received request: ${req.method} ${req.url}`);
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ── Auth helper: map an AuthError to a Response ──────────────────────────
    function authErrorResponse(err: AuthError): Response {
      if (err === "missing") {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // ── POST /auth/register ───────────────────────────────────────────────────
    if (req.method === "POST" && pathname === "/auth/register") {
      if (process.env["ALLOW_REGISTRATION"] !== "true") {
        return new Response("Not found", { status: 404 });
      }
      let body: { username?: unknown; password?: unknown };
      try {
        body = (await req.json()) as { username?: unknown; password?: unknown };
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      const { username, password } = body;
      if (typeof username !== "string" || !username || typeof password !== "string" || !password) {
        return new Response("Bad Request", { status: 400 });
      }
      const result = await createUser(username, password);
      if (result === "created") {
        console.log(`User registered: ${username}`);
        return new Response("Created", { status: 201 });
      }
      console.log(`User registration conflict: ${username}`);
      return new Response("Conflict", { status: 409 });
    }

    // ── POST /auth/login ──────────────────────────────────────────────────────
    if (req.method === "POST" && pathname === "/auth/login") {
      let body: { username?: unknown; password?: unknown };
      try {
        body = (await req.json()) as { username?: unknown; password?: unknown };
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      const { username, password } = body;
      if (typeof username !== "string" || !username || typeof password !== "string" || !password) {
        return new Response("Bad Request", { status: 400 });
      }
      const valid = await verifyUser(username, password);
      if (!valid) {
        console.log(`Login failed for user: ${username}`);
        return new Response("Unauthorized", { status: 401 });
      }
      const token = await signToken(username);
      console.log(`Login successful for user: ${username}`);
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Match any non-root path for routing
    const pathMatch = pathname.match(/^\/(.+)$/);

    if (req.method === "PUT" && pathMatch) {
      try {
        await requireAuth(req);
      } catch (err) {
        return authErrorResponse(err as AuthError);
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
      try {
        await requireAuth(req);
      } catch (err) {
        return authErrorResponse(err as AuthError);
      }
      const slug = pathMatch.at(1);
      if (!slug) {
        console.log("Invalid slug in POST request");
        return new Response("Bad Request", { status: 400 });
      }
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
      try {
        await requireAuth(req);
      } catch (err) {
        return authErrorResponse(err as AuthError);
      }
      const slug = pathMatch.at(1);
      if (slug === undefined) {
        return new Response("Not found", { status: 404 });
      }
      try {
        const result = await deleteDocument(slug);
        if (result === "deleted") {
          console.log(`Document deleted for slug: ${slug}`);
          return new Response("OK", { status: 200 });
        }
        if (result === "not_found") {
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

    if (req.method === "GET" && pathname === "/") {
      console.log("Listing root folder index");
      const entries = await listFolder();
      if (entries === null || entries.length === 0) {
        return new Response(null, { status: 204 });
      }
      return new Response(formatFolderIndex("Index", entries), {
        status: 200,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }

    // Match /:slug — single path segment, no extension
    const match = pathname.match(/^\/([^/]+)$/);
    if (match) {
      const slug = match[1] as string;

      // Check document security before serving
      const security = await getDocumentSecurity(slug);
      if (isProtectedDocument(security)) {
        try {
          await requireAuth(req);
        } catch (err) {
          return authErrorResponse(err as AuthError);
        }
      }

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
        return new Response(formatFolderIndex(slug, folderEntries), {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
    }

    //default handler for all unmatched routes
    console.log(`No matching route for: ${req.method} ${req.url}`);
    return new Response("Not found", { status: 404 });
  },
});
console.log(`corpus-server listening on port ${server.port}`);

export default server;
