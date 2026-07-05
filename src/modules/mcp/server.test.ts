import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "../index/db";
import { indexDocument } from "../index/service";
import { createMcpServer } from "./server";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOC_A = `---
title: "Architecture Guide"
description: "Overview of the system architecture."
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
tags: [architecture, engineering]
ai:
  priority: high
  ignore: false
  summary: High-level architectural overview.
---

# Architecture Guide

Body content.
`;

const DOC_B = `---
title: "Onboarding"
description: "Getting started as a new team member."
created: 2026-01-02T00:00:00Z
updated: 2026-01-02T00:00:00Z
tags: [hr, onboarding]
---

# Onboarding

Welcome!
`;

const DOC_IGNORED = `---
title: "Secret Config"
description: "Internal secrets."
created: 2026-01-03T00:00:00Z
updated: 2026-01-03T00:00:00Z
ai:
  ignore: true
---

# Secret Config
`;

function makeDb(): Database {
  const db = new Database(":memory:");
  initDb(db);
  return db;
}

// ---------------------------------------------------------------------------
// Tests: createMcpServer
// ---------------------------------------------------------------------------

describe("createMcpServer", () => {
  it("returns a connected McpServer instance", () => {
    const db = makeDb();
    const server = createMcpServer(db);
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Helpers: call tools via the underlying Server handler
// ---------------------------------------------------------------------------

type ToolCallResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

async function callTool(
  db: Database,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  // Access the low-level Server to dispatch tool calls in tests.
  const mcpServer = createMcpServer(db);
  // @ts-expect-error accessing private field for testing
  const server = mcpServer.server as import("@modelcontextprotocol/sdk/server/index.js").Server;

  return new Promise((resolve, reject) => {
    const msg = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    };

    const fakeTransport = {
      start: async () => {},
      close: async () => {},
      send: async (response: unknown) => {
        const r = response as { result?: ToolCallResult; error?: unknown };
        if (r.error) reject(new Error(JSON.stringify(r.error)));
        else resolve(r.result as ToolCallResult);
      },
      onmessage: undefined as unknown,
      onclose: undefined as unknown,
      onerror: undefined as unknown,
    };

    server.connect(fakeTransport as never).then(() => {
      fakeTransport.onmessage?.(msg as never);
    }).catch(reject);
  });
}

// ---------------------------------------------------------------------------
// Tests: list_documents tool
// ---------------------------------------------------------------------------

describe("tool: list_documents", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    indexDocument("engineering/architecture", DOC_A, db);
    indexDocument("hr/onboarding", DOC_B, db);
    indexDocument("config/secret", DOC_IGNORED, db); // should not appear
  });

  it("returns all non-ignored indexed documents when no scope given", async () => {
    const result = await callTool(db, "list_documents", {});
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(2);
    const slugs = docs.map((d: { slug: string }) => d.slug);
    expect(slugs).toContain("engineering/architecture");
    expect(slugs).toContain("hr/onboarding");
    expect(slugs).not.toContain("config/secret");
  });

  it("filters results to the given scope prefix", async () => {
    const result = await callTool(db, "list_documents", { scope: "engineering" });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe("engineering/architecture");
  });

  it("returns empty array when scope matches no documents", async () => {
    const result = await callTool(db, "list_documents", { scope: "nonexistent" });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: search_documents tool
// ---------------------------------------------------------------------------

describe("tool: search_documents", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    indexDocument("engineering/architecture", DOC_A, db);
    indexDocument("hr/onboarding", DOC_B, db);
  });

  it("returns results matching title query", async () => {
    const result = await callTool(db, "search_documents", { query: "Architecture" });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe("engineering/architecture");
  });

  it("returns results matching description query", async () => {
    const result = await callTool(db, "search_documents", { query: "new team member" });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe("hr/onboarding");
  });

  it("returns results matching a tag", async () => {
    const result = await callTool(db, "search_documents", { tags: ["architecture"] });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe("engineering/architecture");
  });

  it("merges and deduplicates results from query and tags", async () => {
    const result = await callTool(db, "search_documents", {
      query: "Architecture",
      tags: ["architecture"],
    });
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(1);
  });

  it("returns all documents when neither query nor tags provided", async () => {
    const result = await callTool(db, "search_documents", {});
    expect(result.isError).toBeFalsy();
    const docs = JSON.parse(result.content[0]!.text!);
    expect(docs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: get_document tool
// ---------------------------------------------------------------------------

describe("tool: get_document", () => {
  it("returns an error for an invalid slug", async () => {
    const db = makeDb();
    const result = await callTool(db, "get_document", { slug: "../etc/passwd" });
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0]!.text!);
    expect(payload.code).toBe("BAD_REQUEST");
  });

  it("returns an error when the document does not exist on disk", async () => {
    const db = makeDb();
    const result = await callTool(db, "get_document", { slug: "does-not-exist" });
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0]!.text!);
    expect(payload.code).toBe("NOT_FOUND");
  });
});
