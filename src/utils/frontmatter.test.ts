import { describe, it, expect } from "bun:test";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  describe("valid frontmatter", () => {
    it("should parse simple string values", () => {
      const content = `---\ntitle: My Document\n---\n# Body`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ title: "My Document" });
    });

    it("should parse multiple fields", () => {
      const content = `---\ntitle: My Doc\ndescription: A description\nauthor: Dave\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({
        title: "My Doc",
        description: "A description",
        author: "Dave",
      });
    });

    it("should parse inline arrays", () => {
      const content = `---\ntags: [typescript, bun, markdown]\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ tags: ["typescript", "bun", "markdown"] });
    });

    it("should parse inline arrays with quoted values", () => {
      const content = `---\ntags: ["typescript", 'bun', markdown]\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ tags: ["typescript", "bun", "markdown"] });
    });

    it("should strip quotes from string values", () => {
      const content = `---\ntitle: "My Document"\nauthor: 'Dave'\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ title: "My Document", author: "Dave" });
    });

    it("should handle values containing colons", () => {
      const content = `---\nurl: http://example.com\n---\n`;
      const result = parseFrontmatter(content);
      expect(result?.url).toBe("http://example.com");
    });

    it("should handle Windows-style line endings (CRLF)", () => {
      const content = `---\r\ntitle: My Document\r\nauthor: Dave\r\n---\r\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ title: "My Document", author: "Dave" });
    });

    it("should handle empty arrays", () => {
      const content = `---\ntags: []\n---\n`;
      const result = parseFrontmatter(content);
      expect(result?.tags).toEqual([]);
    });

    it("should handle arrays with spaces around values", () => {
      const content = `---\ntags: [ a , b , c ]\n---\n`;
      const result = parseFrontmatter(content);
      expect(result?.tags).toEqual(["a", "b", "c"]);
    });
  });

  describe("invalid or missing frontmatter", () => {
    it("should return undefined when no frontmatter block present", () => {
      const content = `# Just a heading\n\nSome content.`;
      expect(parseFrontmatter(content)).toBeUndefined();
    });

    it("should return undefined when frontmatter block is empty", () => {
      const content = `---\n---\n# Body`;
      expect(parseFrontmatter(content)).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(parseFrontmatter("")).toBeUndefined();
    });

    it("should return undefined when opening --- is not at the start", () => {
      const content = `Some text\n---\ntitle: My Doc\n---\n`;
      expect(parseFrontmatter(content)).toBeUndefined();
    });

    it("should skip lines without a colon", () => {
      const content = `---\ntitle: My Doc\ninvalidline\nauthor: Dave\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ title: "My Doc", author: "Dave" });
    });

    it("should skip lines with empty keys", () => {
      const content = `---\n: no key here\ntitle: My Doc\n---\n`;
      const result = parseFrontmatter(content);
      expect(result).toEqual({ title: "My Doc" });
    });
  });
});
