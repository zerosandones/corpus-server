import { afterAll, describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import server from "./server";

const documentsDir = join(import.meta.dir, "..", "documents");

describe("server basic functionality", () => {
  test("starts and exposes a valid URL", () => {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url.toString().startsWith("http")).toBe(true);
  });

  test("creates the documents directory on startup", async () => {
    await access(documentsDir, constants.F_OK);
  });

  test("returns 404 for root route", async () => {
    const response = await fetch(new URL("/", server.url));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  test("returns 404 for unknown routes", async () => {
    const response = await fetch(new URL("/does-not-exist", server.url));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});

afterAll(() => {
  server.stop(true);
});