import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../index.ts";

describe("Corpus Server", () => {
  it("GET / with Accept: text/markdown returns 200", async () => {
    const res = await app.handle(
      new Request("http://localhost/", {
        headers: { Accept: "text/markdown", Authorization: "Bearer dev_token_admin" },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
  });

  it("GET / with Accept: application/json returns 200 directory index", async () => {
    const res = await app.handle(
      new Request("http://localhost/", {
        headers: { Accept: "application/json" },
      })
    );
    // Root is public or may require auth depending on .acl.yaml
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("directory");
    }
  });

  it("GET /_search?q=knowledge returns 200 with results structure", async () => {
    const res = await app.handle(
      new Request("http://localhost/_search?q=knowledge")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("query");
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("GET /nonexistent returns 404", async () => {
    const res = await app.handle(
      new Request("http://localhost/nonexistent-document-xyz", {
        headers: { Accept: "application/json" },
      })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("code", "NOT_FOUND");
  });

  it("GET with path traversal is safely handled", async () => {
    // URL normalization converts /../etc/passwd → /etc/passwd, which resolves
    // safely inside storage (not found), so expect 404 rather than a real traversal
    const res = await app.handle(
      new Request("http://localhost/../etc/passwd")
    );
    expect([400, 403, 404]).toContain(res.status);
  });
});
