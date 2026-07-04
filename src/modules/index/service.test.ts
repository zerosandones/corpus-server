import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db";
import {
  indexDocument,
  removeFromIndex,
  getAll,
  findByTag,
  findByTitle,
  indexDirectory,
} from "./service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database {
  const db = new Database(":memory:");
  initDb(db);
  return db;
}

const FULL_FRONTMATTER = `---
title: "Full Document"
description: "A comprehensive test document."
created: 2026-06-01T09:00:00Z
updated: 2026-06-02T10:00:00Z
author: "Dave <dave@example.com>"
tags: [typescript, bun, testing]
security:
  level: confidential
  roles: [engineering, product]
  users: [dave@example.com]
ai:
  priority: high
  ignore: false
  summary: A one-liner for LLMs
custom:
  version: v1.0
  status: draft
---

# Full Document

Body content here.
`;

const MINIMAL_FRONTMATTER = `---
title: "Minimal Doc"
description: "Just the required fields."
created: 2026-06-10T10:00:00Z
updated: 2026-06-10T10:00:00Z
---

# Minimal Doc
`;

const IGNORED_FRONTMATTER = `---
title: "Hidden Doc"
ai:
  ignore: true
---

# Hidden Doc
`;

const NO_FRONTMATTER = `# No Frontmatter

Just raw content.
`;

// ---------------------------------------------------------------------------
// Tests: indexDocument
// ---------------------------------------------------------------------------

describe("indexDocument", () => {
  it("stores all core fields from full frontmatter", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc).toBeDefined();
    expect(doc!.slug).toBe("docs/full");
    expect(doc!.title).toBe("Full Document");
    expect(doc!.description).toBe("A comprehensive test document.");
    expect(doc!.created).toBe("2026-06-01T09:00:00Z");
    expect(doc!.updated).toBe("2026-06-02T10:00:00Z");
    expect(doc!.author).toBe("Dave <dave@example.com>");
  });

  it("stores tags in the document_tags table", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.tags).toEqual(["typescript", "bun", "testing"]);
  });

  it("stores security nested fields", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.securityLevel).toBe("confidential");
    expect(doc!.securityRoles).toEqual(["engineering", "product"]);
    expect(doc!.securityUsers).toEqual(["dave@example.com"]);
  });

  it("stores ai nested fields", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.aiPriority).toBe("high");
    expect(doc!.aiIgnore).toBe(false);
    expect(doc!.aiSummary).toBe("A one-liner for LLMs");
  });

  it("stores custom nested fields as an object", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.custom).toEqual({ version: "v1.0", status: "draft" });
  });

  it("stores null fields gracefully for minimal frontmatter", () => {
    const db = makeDb();
    indexDocument("docs/minimal", MINIMAL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.author).toBeNull();
    expect(doc!.tags).toEqual([]);
    expect(doc!.securityLevel).toBeNull();
    expect(doc!.aiPriority).toBeNull();
    expect(doc!.custom).toEqual({});
  });

  it("indexes a document with no frontmatter (all nulls)", () => {
    const db = makeDb();
    indexDocument("docs/raw", NO_FRONTMATTER, db);

    const docs = getAll(db);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBeNull();
  });

  it("upserts (re-indexes) an existing document", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);
    expect(getAll(db)).toHaveLength(1);

    const updated = FULL_FRONTMATTER.replace("Full Document", "Updated Title");
    indexDocument("docs/full", updated, db);

    const docs = getAll(db);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("Updated Title");
  });

  it("upsert replaces tags correctly", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const withNewTags = FULL_FRONTMATTER.replace(
      "tags: [typescript, bun, testing]",
      "tags: [newTag]",
    );
    indexDocument("docs/full", withNewTags, db);

    const [doc] = getAll(db);
    expect(doc!.tags).toEqual(["newTag"]);
  });

  it("skips indexing and removes existing row when ai.ignore is true", () => {
    const db = makeDb();
    indexDocument("docs/ignored", IGNORED_FRONTMATTER, db);

    expect(getAll(db)).toHaveLength(0);
  });

  it("removes existing entry when document is re-indexed with ai.ignore: true", () => {
    const db = makeDb();
    indexDocument("docs/doc", MINIMAL_FRONTMATTER, db);
    expect(getAll(db)).toHaveLength(1);

    indexDocument("docs/doc", IGNORED_FRONTMATTER, db);
    expect(getAll(db)).toHaveLength(0);
  });

  it("records a non-empty indexed_at timestamp", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const [doc] = getAll(db);
    expect(doc!.indexedAt).toBeTruthy();
    expect(() => new Date(doc!.indexedAt)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: removeFromIndex
// ---------------------------------------------------------------------------

describe("removeFromIndex", () => {
  it("removes a previously indexed document", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);
    removeFromIndex("docs/full", db);

    expect(getAll(db)).toHaveLength(0);
  });

  it("is a no-op for a slug that does not exist", () => {
    const db = makeDb();
    expect(() => removeFromIndex("docs/nonexistent", db)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: findByTag
// ---------------------------------------------------------------------------

describe("findByTag", () => {
  it("returns documents with the given tag", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);
    indexDocument("docs/minimal", MINIMAL_FRONTMATTER, db);

    const results = findByTag("typescript", db);
    expect(results).toHaveLength(1);
    expect(results[0]!.slug).toBe("docs/full");
  });

  it("returns an empty array when no documents match the tag", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    expect(findByTag("nonexistent-tag", db)).toHaveLength(0);
  });

  it("returns all documents sharing the same tag", () => {
    const db = makeDb();
    const docA = FULL_FRONTMATTER.replace(
      "tags: [typescript, bun, testing]",
      "tags: [shared]",
    );
    const docB = MINIMAL_FRONTMATTER + "\ntags: [shared]";
    // Rebuild docB with frontmatter tag field
    const docBWithTag = `---
title: "B"
description: "B desc"
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
tags: [shared]
---
# B`;
    indexDocument("docs/a", docA, db);
    indexDocument("docs/b", docBWithTag, db);

    expect(findByTag("shared", db)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: findByTitle
// ---------------------------------------------------------------------------

describe("findByTitle", () => {
  it("matches on title substring", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);
    indexDocument("docs/minimal", MINIMAL_FRONTMATTER, db);

    const results = findByTitle("Full", db);
    expect(results).toHaveLength(1);
    expect(results[0]!.slug).toBe("docs/full");
  });

  it("matches on description substring", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    const results = findByTitle("comprehensive", db);
    expect(results).toHaveLength(1);
    expect(results[0]!.slug).toBe("docs/full");
  });

  it("is case-insensitive", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    expect(findByTitle("full document", db)).toHaveLength(1);
    expect(findByTitle("FULL DOCUMENT", db)).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    const db = makeDb();
    indexDocument("docs/full", FULL_FRONTMATTER, db);

    expect(findByTitle("zzz-no-match-zzz", db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: indexDirectory
// ---------------------------------------------------------------------------

describe("indexDirectory", () => {
  const testDir = "./test-index-service";

  beforeEach(async () => {
    await Bun.$`rm -rf ${testDir}`.quiet();
    await Bun.$`mkdir -p ${testDir}`.quiet();
  });

  afterAll(async () => {
    await Bun.$`rm -rf ${testDir}`.quiet();
  });

  it("indexes all .md files in a directory", async () => {
    await Bun.write(`${testDir}/doc-a.md`, FULL_FRONTMATTER);
    await Bun.write(`${testDir}/doc-b.md`, MINIMAL_FRONTMATTER);

    const db = makeDb();
    await indexDirectory(db, testDir);

    expect(getAll(db)).toHaveLength(2);
  });

  it("skips non-.md files", async () => {
    await Bun.write(`${testDir}/doc-a.md`, MINIMAL_FRONTMATTER);
    await Bun.write(`${testDir}/readme.txt`, "not a markdown file");

    const db = makeDb();
    await indexDirectory(db, testDir);

    expect(getAll(db)).toHaveLength(1);
  });

  it("excludes documents with ai.ignore: true", async () => {
    await Bun.write(`${testDir}/doc-a.md`, MINIMAL_FRONTMATTER);
    await Bun.write(`${testDir}/hidden.md`, IGNORED_FRONTMATTER);

    const db = makeDb();
    await indexDirectory(db, testDir);

    expect(getAll(db)).toHaveLength(1);
    expect(getAll(db)[0]!.slug).toBe("doc-a");
  });

  it("uses slug prefix when sub-directory slug provided", async () => {
    await Bun.write(`${testDir}/my-doc.md`, MINIMAL_FRONTMATTER);

    const db = makeDb();
    await indexDirectory(db, ".", testDir.replace("./", ""));

    const docs = getAll(db);
    expect(docs[0]!.slug).toContain("my-doc");
  });

  it("is a no-op for a non-existent directory", async () => {
    const db = makeDb();
    await expect(
      indexDirectory(db, "/non-existent-dir-xyz"),
    ).resolves.toBeUndefined();
    expect(getAll(db)).toHaveLength(0);
  });
});
