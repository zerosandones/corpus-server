import {
  describe,
  expect,
  test,
  beforeEach,
  afterAll,
} from "bun:test";
import { mkdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import {
  deleteDocument,
  ensureDocsDir,
  getDocument,
  listFolder,
  saveDocument,
  updateDocument,
} from "./storage";
import { decryptBody, splitMarkdown } from "./crypto";

// Must be set before any test that calls saveDocument / getDocument / updateDocument
process.env["ENCRYPTION_KEY"] = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

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
      await saveDocument(testSlug, testContent, "temp");

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
      await saveDocument(testSlug, testContent, "temp");

      const result = await getDocument(testSlug, "temp");
      expect(result).toBe(testContent);
    });

    test("accepts slug with numbers", async () => {
      const testSlug = "doc-123";
      const testContent = "# Document 123";
      await saveDocument(testSlug, testContent, "temp");

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
      // Verify encryption/decryption round-trip works correctly
      expect(await getDocument(testSlug, "temp")).toBe(testContent);
      // Confirm the body is actually encrypted on disk (security compliance)
      const filePath = join(testDocsDir, `${testSlug}.md`);
      expect(await Bun.file(filePath).text()).not.toBe(testContent);
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
      // Verify round-trip via direct decrypt; getDocument only accepts simple slugs without path separators
      const filePath = join(testDocsDir, "category", "sub-doc.md");
      const raw = await Bun.file(filePath).text();
      const { frontmatter, body } = splitMarkdown(raw);
      expect(frontmatter + (await decryptBody(body))).toBe(testContent);
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

  describe("listFolder", () => {

    beforeEach(async () => {
      await ensureDocsDir("temp");
    });

    test("returns empty array for an empty folder", async () => {
      const emptyDir = join(testDocsDir, "empty-subfolder");
      await mkdir(emptyDir, { recursive: true });
      const result = await listFolder("empty-subfolder", "temp");
      expect(result).toEqual([]);
      await rm(emptyDir, { recursive: true, force: true });
    });

    test("returns null for a non-existent folder", async () => {
      const result = await listFolder("no-such-folder", "temp");
      expect(result).toBeNull();
    });

    test("returns entries with slug and title for markdown files", async () => {
      const filePath = join(testDocsDir, "list-doc.md");
      await writeFile(filePath, "# Listed Doc\n\nContent.");
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "list-doc");
      expect(entry).toBeDefined();
      expect(entry!.title).toBe("Listed Doc");
      expect(entry!.frontmatter).toBeNull();
    });

    test("returns null title when document has no H1 heading", async () => {
      const filePath = join(testDocsDir, "no-heading.md");
      await writeFile(filePath, "No heading here.");
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "no-heading");
      expect(entry).toBeDefined();
      expect(entry!.title).toBeNull();
      expect(entry!.frontmatter).toBeNull();
    });

    test("returns entries with correct slug for a subfolder", async () => {
      const subDir = join(testDocsDir, "sub");
      await mkdir(subDir, { recursive: true });
      const filePath = join(subDir, "sub-doc.md");
      await writeFile(filePath, "# Sub Doc");
      const result = await listFolder("sub", "temp");
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0]?.slug).toBe("sub/sub-doc");
      expect(result![0]?.title).toBe("Sub Doc");
      expect(result![0]?.frontmatter).toBeNull();
    });

    test("does not include non-markdown files", async () => {
      const filePath = join(testDocsDir, "not-markdown.txt");
      await writeFile(filePath, "text file");
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "not-markdown");
      expect(entry).toBeUndefined();
    });

    test("parses frontmatter and uses its title field", async () => {
      const filePath = join(testDocsDir, "fm-doc.md");
      await writeFile(filePath, '---\ntitle: "Frontmatter Title"\nslug: "fm-doc"\nsecurity: "public"\n---\n\n# H1 Title');
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "fm-doc");
      expect(entry).toBeDefined();
      expect(entry!.title).toBe("Frontmatter Title");
      expect(entry!.frontmatter).toMatchObject({ title: "Frontmatter Title", slug: "fm-doc", security: "public" });
    });

    test("falls back to H1 heading when frontmatter has no title field", async () => {
      const filePath = join(testDocsDir, "fm-no-title.md");
      await writeFile(filePath, "---\nsecurity: \"public\"\n---\n\n# H1 Title");
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "fm-no-title");
      expect(entry).toBeDefined();
      expect(entry!.title).toBe("H1 Title");
      expect(entry!.frontmatter).toMatchObject({ security: "public" });
    });

    test("parses frontmatter array values", async () => {
      const filePath = join(testDocsDir, "fm-array.md");
      await writeFile(filePath, "---\ntitle: Array Doc\ntags: [alpha, beta]\n---\n");
      const result = await listFolder("", "temp");
      expect(result).not.toBeNull();
      const entry = result!.find((e) => e.slug === "fm-array");
      expect(entry).toBeDefined();
      expect(entry!.frontmatter).toMatchObject({ tags: ["alpha", "beta"] });
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

    test("returns 'not_found' for a non-existent document", async () => {
      const result = await deleteDocument("does-not-exist", "temp");
      expect(result).toBe("not_found");
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
      expect(await getDocument(testSlug, "temp")).toBe("# Updated");
    });

    test("returns 'not_found' when document does not exist", async () => {
      const result = await updateDocument(
        "does-not-exist",
        "# Content",
        "temp",
      );
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
      // Verify round-trip via direct decrypt; getDocument only accepts simple slugs without path separators
      const filePath = join(testDocsDir, "nested", "update-doc.md");
      const raw = await Bun.file(filePath).text();
      const { frontmatter, body } = splitMarkdown(raw);
      expect(frontmatter + (await decryptBody(body))).toBe("# Updated");
    });
  });

});

afterAll(async () => {
  await rm(testDocsDir, { recursive: true, force: true });
});
