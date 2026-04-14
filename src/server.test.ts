import { afterAll, describe, expect, test } from "bun:test";
import { access, writeFile, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
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
    await writeFile(testFilePath, testContent, "utf-8");
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

afterAll(() => {
  server.stop(true);
});