import { describe, it, expect } from "bun:test";
import { parseFrontmatter, parseDocumentFrontmatter } from "./frontmatter";

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

describe("parseDocumentFrontmatter", () => {
  it("should parse core scalar fields", () => {
    const content = `---
title: "My Doc"
description: "A summary"
created: 2026-06-01T09:00:00Z
updated: 2026-06-02T10:00:00Z
author: "Dave <dave@example.com>"
---
# Body`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.title).toBe("My Doc");
    expect(result?.description).toBe("A summary");
    expect(result?.created).toBe("2026-06-01T09:00:00Z");
    expect(result?.updated).toBe("2026-06-02T10:00:00Z");
    expect(result?.author).toBe("Dave <dave@example.com>");
  });

  it("should parse inline tag arrays", () => {
    const content = `---\ntitle: Doc\ntags: [typescript, bun, markdown]\n---\n`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.tags).toEqual(["typescript", "bun", "markdown"]);
  });

  it("should parse a security nested object", () => {
    const content = `---
title: Secret
security:
  level: confidential
  roles: [hr, executive]
  users: [dave@example.com]
---`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.security?.level).toBe("confidential");
    expect(result?.security?.roles).toEqual(["hr", "executive"]);
    expect(result?.security?.users).toEqual(["dave@example.com"]);
  });

  it("should parse an ai nested object", () => {
    const content = `---
title: AI Doc
ai:
  priority: high
  ignore: false
  summary: A one-liner for LLMs
---`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.ai?.priority).toBe("high");
    expect(result?.ai?.ignore).toBe(false);
    expect(result?.ai?.summary).toBe("A one-liner for LLMs");
  });

  it("should parse ai.ignore: true", () => {
    const content = `---\ntitle: Hidden\nai:\n  ignore: true\n---`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.ai?.ignore).toBe(true);
  });

  it("should parse a custom nested object", () => {
    const content = `---
title: Versioned
custom:
  version: v1.0
  status: draft
---`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.custom?.version).toBe("v1.0");
    expect(result?.custom?.status).toBe("draft");
  });

  it("should parse a fully-populated document", () => {
    const content = `---
title: "Full Doc"
description: "Everything"
created: 2026-06-01T09:00:00Z
updated: 2026-06-02T10:00:00Z
author: "Dave"
tags: [a, b]
security:
  level: private
  roles: [engineering]
ai:
  priority: medium
  ignore: false
  summary: Summary text
custom:
  version: v2
---`;
    const result = parseDocumentFrontmatter(content);
    expect(result?.title).toBe("Full Doc");
    expect(result?.tags).toEqual(["a", "b"]);
    expect(result?.security?.level).toBe("private");
    expect(result?.ai?.priority).toBe("medium");
    expect(result?.custom?.version).toBe("v2");
  });

  it("should return undefined for empty content", () => {
    expect(parseDocumentFrontmatter("")).toBeUndefined();
  });

  it("should return undefined when no frontmatter block present", () => {
    expect(parseDocumentFrontmatter("# Just a heading")).toBeUndefined();
  });

  it("should return undefined when frontmatter block is empty", () => {
    expect(parseDocumentFrontmatter("---\n---\n# Body")).toBeUndefined();
  });
});
