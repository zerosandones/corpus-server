import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import { ensureDocsDir, getDocument, saveDocument, updateDocument, deleteDocument } from "./storage";

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

  describe("saveDocument", () => {
    beforeEach(async () => {
      await ensureDocsDir("temp");
    });

    test("saves a new document and returns 'created'", async () => {
      const testSlug = "new-doc";
      const testContent = "# New Document";
      const result = await saveDocument(testSlug, testContent, "temp");
      expect(result).toBe("created");
      const filePath = join(testDocsDir, `${testSlug}.md`);
      expect(await Bun.file(filePath).text()).toBe(testContent);
    });

    test("returns 'conflict' when document already exists", async () => {
      const testSlug = "existing-doc";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, "# Existing");
      const result = await saveDocument(testSlug, "# New Content", "temp");
      expect(result).toBe("conflict");
    });

    test("creates subdirectories that do not exist", async () => {
      const testSlug = "category/sub-doc";
      const testContent = "# Sub Document";
      const result = await saveDocument(testSlug, testContent, "temp");
      expect(result).toBe("created");
      const filePath = join(testDocsDir, "category", "sub-doc.md");
      expect(await Bun.file(filePath).text()).toBe(testContent);
    });

    test("returns 'created' for deeply nested path", async () => {
      const testSlug = "a/b/c/deep-doc";
      const result = await saveDocument(testSlug, "# Deep", "temp");
      expect(result).toBe("created");
    });

    test("returns 'conflict' for nested doc that already exists", async () => {
      const testSlug = "nested/conflict-doc";
      await saveDocument(testSlug, "# First", "temp");
      const result = await saveDocument(testSlug, "# Second", "temp");
      expect(result).toBe("conflict");
    });

    test("returns 'invalid' for slug with uppercase letters", async () => {
      const result = await saveDocument("Invalid-Doc", "content", "temp");
      expect(result).toBe("invalid");
    });

    test("returns 'invalid' for slug with invalid segment", async () => {
      const result = await saveDocument("valid/Invalid-Seg", "content", "temp");
      expect(result).toBe("invalid");
    });

    test("returns 'invalid' for empty slug", async () => {
      const result = await saveDocument("", "content", "temp");
      expect(result).toBe("invalid");
    });

    test("returns 'invalid' for slug with consecutive hyphens", async () => {
      const result = await saveDocument("invalid--slug", "content", "temp");
      expect(result).toBe("invalid");
    });
  });

  describe("deleteDocument", () => {
    beforeEach(async () => {
      await ensureDocsDir("temp");
    });

    test("deletes an existing document and returns 'deleted'", async () => {
      const testSlug = "delete-me";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, "# Delete Me");
      const result = await deleteDocument(testSlug, "temp");
      expect(result).toBe("deleted");
      expect(await Bun.file(filePath).exists()).toBe(false);
    });

    test("returns 'not-found' for a non-existent document", async () => {
      const result = await deleteDocument("does-not-exist", "temp");
      expect(result).toBe("not-found");
    });

    test("returns 'invalid' for slug with uppercase letters", async () => {
      const result = await deleteDocument("Invalid-Doc", "temp");
      expect(result).toBe("invalid");
    });

    test("returns 'invalid' for empty slug", async () => {
      const result = await deleteDocument("", "temp");
      expect(result).toBe("invalid");
    });

    test("deletes a nested document and returns 'deleted'", async () => {
      const testSlug = "cat/nested-del";
      await saveDocument(testSlug, "# Nested", "temp");
      const result = await deleteDocument(testSlug, "temp");
      expect(result).toBe("deleted");
      const filePath = join(testDocsDir, "cat", "nested-del.md");
      expect(await Bun.file(filePath).exists()).toBe(false);
    });
  });
       
 describe("updateDocument", () => {
    beforeEach(async () => {
      await ensureDocsDir("temp");
    });

    test("updates an existing document and returns 'updated'", async () => {
      const testSlug = "update-doc";
      const filePath = join(testDocsDir, `${testSlug}.md`);
      await writeFile(filePath, "# Original");
      const result = await updateDocument(testSlug, "# Updated", "temp");
      expect(result).toBe("updated");
      expect(await Bun.file(filePath).text()).toBe("# Updated");
    });

    test("returns 'not_found' when document does not exist", async () => {
      const result = await updateDocument("does-not-exist", "# Content", "temp");
      expect(result).toBe("not_found");
    });

    test("returns 'invalid' for slug with uppercase letters", async () => {
      const result = await updateDocument("Invalid-Doc", "content", "temp");
      expect(result).toBe("invalid");
    });

    test("returns 'invalid' for empty slug", async () => {
      const result = await updateDocument("", "content", "temp");
      expect(result).toBe("invalid");
    });

    test("updates a nested document and returns 'updated'", async () => {
      const testSlug = "nested/update-doc";
      await saveDocument(testSlug, "# Original", "temp");
      const result = await updateDocument(testSlug, "# Updated", "temp");
      expect(result).toBe("updated");
      const filePath = join(testDocsDir, "nested", "update-doc.md");
      expect(await Bun.file(filePath).text()).toBe("# Updated");
    });
  });
});

afterAll(async () => {
  await rm(testDocsDir, { recursive: true, force: true });
});