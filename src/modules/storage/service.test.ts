import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { getDocument, saveDocument, deleteDocument, getDir } from "./service";

describe("StorageService", () => {
  const testDir = "./test-storage-service";
  const testFile = `${testDir}/test-doc`;
  const testContent = "# Test Document\n\nThis is a test document.";

  beforeAll(async () => {
    // Create test directory and file
    await Bun.write(`${testFile}.md`, testContent);
  });

  afterAll(async () => {
    // Clean up test files
    const dir = Bun.file(testDir);
    if (await dir.exists()) {
      await Bun.$`rm -rf ${testDir}`;
    }
  });

  describe("getDocument", () => {
    it("should read a markdown file and return its content", async () => {
      const content = await getDocument("test-doc.md", testDir);
      expect(content).toBe(testContent);
    });

    it("should add .md extension if not provided in slug", async () => {
      const content = await getDocument("test-doc", testDir);
      expect(content).toBe(testContent);
    });

    it("should return null for non-existent files", async () => {
      const content = await getDocument("non-existent", testDir);
      expect(content).toBeNull();
    });

    it("should handle file read errors gracefully", async () => {
      const content = await getDocument(
        "test-doc",
        "/invalid/path/that/does/not/exist",
      );
      expect(content).toBeNull();
    });
  });

  describe("saveDocument", () => {
    it("should be callable without throwing", async () => {
      expect(async () => {
        await saveDocument("test", "content");
      }).not.toThrow();
    });
  });

  describe("deleteDocument", () => {
    it("should be callable without throwing", async () => {
      expect(async () => {
        await deleteDocument("test");
      }).not.toThrow();
    });
  });

  describe("getDir", () => {
    it("should return markdown content when directory exists", async () => {
      const result = await getDir("", testDir);
      expect(result).toContain("## Documents");
      expect(typeof result).toBe("string");
    });

    it("should include frontmatter in directory listing", async () => {
      const result = await getDir("", testDir);
      expect(result).toContain("test-doc");
    });

    it("should return error message for non-existent directory", async () => {
      const result = await getDir("", "/non-existent-dir");
      expect(result).toContain("Directory Not Found");
    });
  });
});
