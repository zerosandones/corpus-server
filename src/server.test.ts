import { afterAll, describe, expect, test } from "bun:test";
import { access, mkdir, rm, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

// Must be set before any request handling that touches storage encryption
process.env["ENCRYPTION_KEY"] = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

import server from "./server";

const documentsDir = join(import.meta.dir, "..", "documents");

describe("server basic functionality", () => {
  test("starts and exposes a valid URL", () => {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url.toString().startsWith("http")).toBe(true);
  });

  test("creates the documents directory on startup", async () => {
    await access(documentsDir, constants.F_OK);
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
    // Create the document via POST instead of direct file write so the body is properly encrypted on disk
    await fetch(new URL(`/${testSlug}`, server.url), {
      method: "POST",
      body: testContent,
    });
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

  test("returns 200 when a new document is saved via POST", async () => {
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
      body: uploadContent,
    });
    expect(response.status).toBe(200);
    await unlink(uploadFilePath);
  });

  test("returns 409 when document already exists", async () => {
    await Bun.write(uploadFilePath, uploadContent);
    const response = await fetch(new URL(`/${uploadSlug}`, server.url), {
      method: "POST",
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
      body: "# Nested Upload",
    });
    expect(response.status).toBe(200);
    await unlink(nestedFilePath);
    await rm(join(documentsDir, "category"), { recursive: true, force: true });
  });

  test("returns 400 when POST slug is invalid", async () => {
    const response = await fetch(new URL("/Invalid-Slug", server.url), {
      method: "POST",
      body: "# Content",
    });
    expect(response.status).toBe(400);
  });
});

describe("folder index", () => {
  const indexDir = join(documentsDir, "index-test");

  test("returns 200 with markdown index for root when documents exist", async () => {
    const filePath = join(documentsDir, "index-root-doc.md");
    await Bun.write(filePath, "# Root Doc\n\nSome content.");
    const response = await fetch(new URL("/", server.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    const body = await response.text();
    expect(body).toContain("# Index");
    expect(body).toContain("[Root Doc](/index-root-doc)");
    await unlink(filePath);
  });

  test("returns 200 with markdown index for a folder with documents", async () => {
    await mkdir(indexDir, { recursive: true });
    const filePath = join(indexDir, "child-doc.md");
    await Bun.write(filePath, "# Child Doc\n\nContent.");
    const response = await fetch(new URL("/index-test", server.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    const body = await response.text();
    expect(body).toContain("# index-test");
    expect(body).toContain("[Child Doc](/index-test/child-doc)");
    await rm(indexDir, { recursive: true, force: true });
  });

  test("returns 204 for an empty folder", async () => {
    await mkdir(indexDir, { recursive: true });
    const response = await fetch(new URL("/index-test", server.url));
    expect(response.status).toBe(204);
    await rm(indexDir, { recursive: true, force: true });
  });

  test("falls back to slug base name when document has no H1 heading", async () => {
    const filePath = join(documentsDir, "no-heading-doc.md");
    await Bun.write(filePath, "Just some content without a heading.");
    const response = await fetch(new URL("/", server.url));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("[no-heading-doc](/no-heading-doc)");
    await unlink(filePath);
  });

  test("includes frontmatter properties as sub-list in index", async () => {
    const filePath = join(documentsDir, "fm-index-doc.md");
    await Bun.write(filePath, '---\ntitle: "FM Index Doc"\nslug: "fm-index-doc"\nsecurity: "public"\n---\n\n# H1 Title');
    const response = await fetch(new URL("/", server.url));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("[FM Index Doc](/fm-index-doc)");
    expect(body).toContain("  - title: FM Index Doc");
    expect(body).toContain("  - slug: fm-index-doc");
    expect(body).toContain("  - security: public");
    await unlink(filePath);
  });
});

describe("document deleting", () => {
  const deleteSlug = "delete-test-doc";
  const deleteFilePath = join(documentsDir, `${deleteSlug}.md`);
  const deleteContent = "# Delete Test\n\nTo be deleted.";

  test("returns 200 when an existing document is deleted via DELETE", async () => {
    await Bun.write(deleteFilePath, deleteContent);
    const response = await fetch(new URL(`/${deleteSlug}`, server.url), {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(await Bun.file(deleteFilePath).exists()).toBe(false);
  });

  test("returns 404 when document does not exist via DELETE", async () => {
    const response = await fetch(new URL("/no-such-document", server.url), {
      method: "DELETE",
    });
    expect(response.status).toBe(404);
  });

  test("returns 404 when DELETE slug is invalid", async () => {
    const response = await fetch(new URL("/Invalid-Slug", server.url), {
      method: "DELETE",
    });
    expect(response.status).toBe(404);
  });
});
    
describe("document updating", () => {
  const updateSlug = "update-test-doc";
  const updateFilePath = join(documentsDir, `${updateSlug}.md`);
  const originalContent = "# Original Content";
  const updatedContent = "# Updated Content";

  test("returns 200 when an existing document is updated via PUT", async () => {
    await Bun.write(updateFilePath, originalContent);
    const response = await fetch(new URL(`/${updateSlug}`, server.url), {
      method: "PUT",
      body: updatedContent,
    });
    expect(response.status).toBe(200);
    // Verify the updated content is returned correctly via GET (decryption round-trip)
    const getResponse = await fetch(new URL(`/${updateSlug}`, server.url));
    expect(await getResponse.text()).toBe(updatedContent);
    await unlink(updateFilePath);
  });

  test("returns 404 when document does not exist via PUT", async () => {
    const response = await fetch(new URL("/no-such-document", server.url), {
      method: "PUT",
      body: updatedContent,
    });
    expect(response.status).toBe(404);
  });

  test("returns 400 when PUT slug is invalid", async () => {
    const response = await fetch(new URL("/Invalid-Slug", server.url), {
      method: "PUT",
      body: "# Content",
    });
    expect(response.status).toBe(400);
  });
});


afterAll(() => {
  server.stop(true);
});
