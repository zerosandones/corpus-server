import { describe, expect, test, beforeEach, afterEach, afterAll } from "bun:test";
import { rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import { ensureDocsDir, getDocument } from "./storage";

const testDocsDir = join(import.meta.dir, "..", "temp");

describe("storage", () => {
  describe("ensureDocsDir", () => {
    test("creates temp documents directory if it does not exist", async () => {
      await ensureDocsDir("temp");
      const dir = await stat(testDocsDir);
      expect(dir.isDirectory()).toBe(true);
    });

    test("does not throw if temp documents directory already exists", async () => {
      await ensureDocsDir("temp");
      await expect(ensureDocsDir("temp")).resolves.toBeUndefined();
    });
  });

  describe("getDocument", () => {
    beforeEach(async () => {
      await ensureDocsDir("temp");
    });

    test("returns document content for valid slug", async () => {
      const testSlug = "valid-doc";
      const testContent = "# Test Document\n\nThis is a test.";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, testContent);

      const result = await getDocument(testSlug, "temp");
      expect(result).toBe(testContent);
    });

    test("returns null for non-existent document", async () => {
      const result = await getDocument("does-not-exist", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with uppercase letters", async () => {
      const result = await getDocument("Invalid-Doc", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with underscores", async () => {
      const result = await getDocument("invalid_doc", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with leading hyphen", async () => {
      const result = await getDocument("-invalid", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with trailing hyphen", async () => {
      const result = await getDocument("invalid-", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with consecutive hyphens", async () => {
      const result = await getDocument("invalid--doc", "temp");
      expect(result).toBeNull();
    });

    test("accepts valid multi-word slug with hyphens", async () => {
      const testSlug = "my-awesome-document";
      const testContent = "# My Awesome Document";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, testContent);

      const result = await getDocument(testSlug, "temp");
      expect(result).toBe(testContent);
    });

    test("accepts slug with numbers", async () => {
      const testSlug = "doc-123";
      const testContent = "# Document 123";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, testContent);

      const result = await getDocument(testSlug, "temp");
      expect(result).toBe(testContent);
    });

    test("rejects slug with special characters", async () => {
      const result = await getDocument("invalid@doc", "temp");
      expect(result).toBeNull();
    });

    test("rejects empty slug", async () => {
      const result = await getDocument("", "temp");
      expect(result).toBeNull();
    });

    test("rejects slug with spaces", async () => {
      const result = await getDocument("invalid doc");
      expect(result).toBeNull();
    });
  });
});

afterAll(async () => {
  await rm(testDocsDir, { recursive: true, force: true });
});