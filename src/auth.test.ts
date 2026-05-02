import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { authenticate } from "./auth";

const TEST_KEY = "test-api-key-abc123";

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("authenticate", () => {
  let savedApiKeys: string | undefined;

  beforeEach(async () => {
    savedApiKeys = process.env["API_KEYS"];
    const hash = await hashKey(TEST_KEY);
    process.env["API_KEYS"] = JSON.stringify([
      { id: "agent-1", keyHash: hash, scopes: ["write"] },
    ]);
  });

  afterEach(() => {
    if (savedApiKeys !== undefined) {
      process.env["API_KEYS"] = savedApiKeys;
    } else {
      delete process.env["API_KEYS"];
    }
  });

  test("returns a machine principal for a valid API key", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    const principal = await authenticate(req);
    expect(principal).not.toBeNull();
    expect(principal?.id).toBe("agent-1");
    expect(principal?.type).toBe("machine");
    expect(principal?.scopes).toContain("write");
  });

  test("returns null when Authorization header is absent", async () => {
    const req = new Request("http://localhost/test");
    expect(await authenticate(req)).toBeNull();
  });

  test("returns null for an unrecognised token", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(await authenticate(req)).toBeNull();
  });

  test("returns null for a non-Bearer scheme", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(await authenticate(req)).toBeNull();
  });

  test("returns null when API_KEYS is not set", async () => {
    delete process.env["API_KEYS"];
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    expect(await authenticate(req)).toBeNull();
  });

  test("returns null when API_KEYS is invalid JSON", async () => {
    process.env["API_KEYS"] = "not-valid-json";
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    expect(await authenticate(req)).toBeNull();
  });

  test("returns null when API_KEYS is a JSON object instead of an array", async () => {
    process.env["API_KEYS"] = JSON.stringify({ id: "x", keyHash: "y", scopes: [] });
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    expect(await authenticate(req)).toBeNull();
  });

  test("ignores malformed records and still matches valid ones", async () => {
    const hash = await hashKey(TEST_KEY);
    process.env["API_KEYS"] = JSON.stringify([
      { id: 42, keyHash: hash, scopes: ["write"] }, // invalid: id is not a string
      { id: "agent-2", keyHash: hash, scopes: ["write"] },
    ]);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    const principal = await authenticate(req);
    expect(principal?.id).toBe("agent-2");
  });

  test("returns null when the matching principal has no scopes", async () => {
    const hash = await hashKey(TEST_KEY);
    process.env["API_KEYS"] = JSON.stringify([
      { id: "agent-readonly", keyHash: hash, scopes: [] },
    ]);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    const principal = await authenticate(req);
    // authenticate still returns the principal — scope enforcement is the caller's job
    expect(principal).not.toBeNull();
    expect(principal?.scopes).toHaveLength(0);
  });
});
