import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// We test the HTTP server directly to exercise all layers together
import server from "../index";

const BASE = `http://localhost:${server.port}`;

async function cleanTestDocs() {
  try {
    await rm(TEST_DOCS_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe("corpus-server", () => {
  // Clean up any leftover documents between tests by deleting all docs via the API
  async function deleteAll() {
    const res = await fetch(`${BASE}/documents`);
    const docs = (await res.json()) as { id: string }[];
    await Promise.all(
      docs.map((d) => fetch(`${BASE}/documents/${d.id}`, { method: "DELETE" }))
    );
  }

  beforeEach(deleteAll);
  afterEach(deleteAll);

  describe("POST /documents", () => {
    it("creates a new document and returns 201", async () => {
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hello World", content: "# Hello\n\nWorld" }),
      });
      expect(res.status).toBe(201);
      const doc = await res.json();
      expect(doc.id).toBe("hello-world");
      expect(doc.title).toBe("Hello World");
      expect(doc.content).toBe("# Hello\n\nWorld");
      expect(typeof doc.createdAt).toBe("string");
      expect(typeof doc.updatedAt).toBe("string");
    });

    it("accepts a custom id override", async () => {
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Doc", content: "content", id: "custom-id" }),
      });
      expect(res.status).toBe(201);
      const doc = await res.json();
      expect(doc.id).toBe("custom-id");
    });

    it("returns 400 when title is missing", async () => {
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "some content" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/title/);
    });

    it("returns 400 when content is missing", async () => {
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "No Content" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/content/);
    });

    it("returns 400 on invalid JSON", async () => {
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /documents", () => {
    it("returns an empty array when no documents exist", async () => {
      const res = await fetch(`${BASE}/documents`);
      expect(res.status).toBe(200);
      const docs = await res.json();
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBe(0);
    });

    it("lists created documents", async () => {
      await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Doc One", content: "content one" }),
      });
      await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Doc Two", content: "content two" }),
      });

      const res = await fetch(`${BASE}/documents`);
      expect(res.status).toBe(200);
      const docs = (await res.json()) as { id: string; title: string }[];
      expect(docs.length).toBe(2);
      const titles = docs.map((d) => d.title).sort();
      expect(titles).toEqual(["Doc One", "Doc Two"]);
    });
  });

  describe("GET /documents/:id", () => {
    it("returns the document by id", async () => {
      const created = await (
        await fetch(`${BASE}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Test Doc", content: "## Test" }),
        })
      ).json();

      const res = await fetch(`${BASE}/documents/${created.id}`);
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.id).toBe(created.id);
      expect(doc.content).toBe("## Test");
    });

    it("returns 404 for a non-existent document", async () => {
      const res = await fetch(`${BASE}/documents/does-not-exist`);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /documents/:id", () => {
    it("updates the title of a document", async () => {
      const created = await (
        await fetch(`${BASE}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Old Title", content: "old content" }),
        })
      ).json();

      const res = await fetch(`${BASE}/documents/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.title).toBe("New Title");
      expect(doc.content).toBe("old content");
    });

    it("updates the content of a document", async () => {
      const created = await (
        await fetch(`${BASE}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "My Doc", content: "old" }),
        })
      ).json();

      const res = await fetch(`${BASE}/documents/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# Updated\n\nnew content" }),
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.content).toBe("# Updated\n\nnew content");
      expect(doc.title).toBe("My Doc");
    });

    it("returns 404 when updating non-existent document", async () => {
      const res = await fetch(`${BASE}/documents/ghost`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "new" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 when no fields are provided", async () => {
      const created = await (
        await fetch(`${BASE}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "My Doc", content: "c" }),
        })
      ).json();

      const res = await fetch(`${BASE}/documents/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /documents/:id", () => {
    it("deletes an existing document", async () => {
      const created = await (
        await fetch(`${BASE}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "To Delete", content: "bye" }),
        })
      ).json();

      const del = await fetch(`${BASE}/documents/${created.id}`, {
        method: "DELETE",
      });
      expect(del.status).toBe(200);
      const body = await del.json();
      expect(body.message).toBe("Document deleted");

      // confirm it's gone
      const get = await fetch(`${BASE}/documents/${created.id}`);
      expect(get.status).toBe(404);
    });

    it("returns 404 when deleting a non-existent document", async () => {
      const res = await fetch(`${BASE}/documents/not-here`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
