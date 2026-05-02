import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { access, rm, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import server from "./server";

// ---------------------------------------------------------------------------
// Test API key — computed once per run so the suite stays self-contained.
// API_KEYS is read by authenticate() on every request, so setting it here
// in beforeAll (after the server module has already loaded) is sufficient.
// ---------------------------------------------------------------------------
const TEST_RAW_KEY = "server-test-api-key-abc123";
let authHeader: string;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

beforeAll(async () => {
  const hash = await sha256Hex(TEST_RAW_KEY);
  process.env["API_KEYS"] = JSON.stringify([
    { id: "test-agent", keyHash: hash, scopes: ["write"] },
  ]);
  authHeader = `Bearer ${TEST_RAW_KEY}`;
});

const documentsDir = join(import.meta.dir, "..", "documents");

describe("server basic functionality", () => {
  test("starts and exposes a valid URL", () => {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url.toString().startsWith("http")).toBe(true);
  });

  test("creates the documents directory on startup", async () => {
    await access(documentsDir, constants.F_OK);
  });

  test("returns 404 for root route", async () => {
    const response = await fetch(new URL("/", server.url));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  test("returns 404 for unknown routes", async () => {
    const response = await fetch(new URL("/does-not-exist", server.url));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});

describe("document serving", () => {
  const testSlug = "test-document";
  const testFilePath = join(documentsDir, `${testSlug}.md`);
  const testContent = "# Test Document\n\nThis is a test.";

  test("returns a document with text/markdown content-type", async () => {
    await Bun.write(testFilePath, testContent);
    const response = await fetch(new URL(`/${testSlug}`, server.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(await response.text()).toBe(testContent);
    await unlink(testFilePath);
  });

  test("returns 404 for a document that does not exist", async () => {
    const response = await fetch(new URL("/no-such-document", server.url));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});

describe("document uploading", () => {
  const uploadSlug = "upload-test-doc";
  const uploadFilePath = join(documentsDir, `${uploadSlug}.md`);
  const uploadContent = "# Upload Test\n\nUploaded via POST.";

  test("returns 401 when Authorization header is absent", async () => {
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
      body: uploadContent,
    });
    expect(response.status).toBe(401);
  });

  test("returns 403 when principal has no write scope", async () => {
    const hash = await sha256Hex("read-only-key");
    const savedKeys = process.env["API_KEYS"];
    process.env["API_KEYS"] = JSON.stringify([
      { id: "read-only-agent", keyHash: hash, scopes: [] },
    ]);
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
      headers: { Authorization: "Bearer read-only-key" },
      body: uploadContent,
    });
    expect(response.status).toBe(403);
    process.env["API_KEYS"] = savedKeys;
  });

  test("returns 200 when a new document is saved via POST", async () => {
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
      headers: { Authorization: authHeader },
      body: uploadContent,
    });
    expect(response.status).toBe(200);
    await unlink(uploadFilePath);
  });

  test("returns 409 when document already exists", async () => {
    await Bun.write(uploadFilePath, uploadContent);
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
      headers: { Authorization: authHeader },
      body: "# Different Content",
    });
    expect(response.status).toBe(409);
    await unlink(uploadFilePath);
  });

  test("creates nested directories and saves document via POST", async () => {
    const nestedSlug = "category/nested-upload";
    const nestedFilePath = join(documentsDir, "category", "nested-upload.md");
    const response = await fetch(new URL(`/${nestedSlug}`, server.url), {
      method: "POST",
      headers: { Authorization: authHeader },
      body: "# Nested Upload",
    });
    expect(response.status).toBe(200);
    await unlink(nestedFilePath);
    await rm(join(documentsDir, "category"), { recursive: true, force: true });
  });

  test("returns 400 when POST slug is invalid", async () => {
    const response = await fetch(new URL("/Invalid-Slug", server.url), {
      method: "POST",
      headers: { Authorization: authHeader },
      body: "# Content",
    });
    expect(response.status).toBe(400);
  });
});

describe("document updating", () => {
  const updateSlug = "update-test-doc";
  const updateFilePath = join(documentsDir, `${updateSlug}.md`);
  const originalContent = "# Original Content";
  const updatedContent = "# Updated Content";

  test("returns 401 when Authorization header is absent", async () => {
    const response = await fetch(new URL(`/${updateSlug}`, server.url), {
      method: "PUT",
      body: updatedContent,
    });
    expect(response.status).toBe(401);
  });

  test("returns 403 when principal has no write scope", async () => {
    const hash = await sha256Hex("read-only-key-2");
    const savedKeys = process.env["API_KEYS"];
    process.env["API_KEYS"] = JSON.stringify([
      { id: "read-only-agent-2", keyHash: hash, scopes: [] },
    ]);
    const response = await fetch(new URL(`/${updateSlug}`, server.url), {
      method: "PUT",
      headers: { Authorization: "Bearer read-only-key-2" },
      body: updatedContent,
    });
    expect(response.status).toBe(403);
    process.env["API_KEYS"] = savedKeys;
  });

  test("returns 200 when an existing document is updated via PUT", async () => {
    await Bun.write(updateFilePath, originalContent);
    const response = await fetch(new URL(`/${updateSlug}`, server.url), {
      method: "PUT",
      headers: { Authorization: authHeader },
      body: updatedContent,
    });
    expect(response.status).toBe(200);
    expect(await Bun.file(updateFilePath).text()).toBe(updatedContent);
    await unlink(updateFilePath);
  });

  test("returns 404 when document does not exist via PUT", async () => {
    const response = await fetch(new URL("/no-such-document", server.url), {
      method: "PUT",
      headers: { Authorization: authHeader },
      body: updatedContent,
    });
    expect(response.status).toBe(404);
  });

  test("returns 400 when PUT slug is invalid", async () => {
    const response = await fetch(new URL("/Invalid-Slug", server.url), {
      method: "PUT",
      headers: { Authorization: authHeader },
      body: "# Content",
    });
    expect(response.status).toBe(400);
  });
});

afterAll(() => {
  server.stop(true);
});