import { describe, expect, test } from "bun:test";
import { formatFolderIndex } from "./response-formatter";
import type { FolderEntry } from "./storage";

describe("formatFolderIndex", () => {
  test("renders heading with no entries", () => {
    const result = formatFolderIndex("Index", []);
    expect(result).toBe("# Index\n");
  });

  test("uses entry title when present", () => {
    const entries: FolderEntry[] = [
      {
        slug: "docs/intro",
        title: "Introduction",
        frontmatter: null,
      },
    ];

    const result = formatFolderIndex("docs", entries);
    expect(result).toBe("# docs\n\n- [Introduction](/docs/intro)");
  });

  test("falls back to slug basename when title is null", () => {
    const entries: FolderEntry[] = [
      {
        slug: "guides/getting-started",
        title: null,
        frontmatter: null,
      },
    ];

    const result = formatFolderIndex("guides", entries);
    expect(result).toBe("# guides\n\n- [getting-started](/guides/getting-started)");
  });

  test("renders frontmatter scalar and array values", () => {
    const entries: FolderEntry[] = [
      {
        slug: "policies/security",
        title: "Security",
        frontmatter: {
          security: "internal",
          tags: ["auth", "access"],
        },
      },
    ];

    const result = formatFolderIndex("policies", entries);
    expect(result).toBe(
      "# policies\n\n- [Security](/policies/security)\n  - security: internal\n  - tags: auth, access"
    );
  });

  test("renders multiple entries in order with full markdown output", () => {
    const entries: FolderEntry[] = [
      {
        slug: "guides/setup",
        title: "Setup Guide",
        frontmatter: {
          security: "public",
        },
      },
      {
        slug: "guides/troubleshooting",
        title: null,
        frontmatter: null,
      },
    ];

    const result = formatFolderIndex("guides", entries);
    expect(result).toBe(
      "# guides\n\n- [Setup Guide](/guides/setup)\n  - security: public\n- [troubleshooting](/guides/troubleshooting)"
    );
  });
});
