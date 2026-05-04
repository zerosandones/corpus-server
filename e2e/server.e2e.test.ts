import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

const E2E_PORT = 9091;
const BASE_URL = `http://localhost:${E2E_PORT}`;
const documentsDir = join(import.meta.dir, "..", "documents");

let serverProcess: ReturnType<typeof Bun.spawn> | undefined;

async function waitForServer(url: string, maxRetries = 30, delayMs = 150): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(`${url}/`);
      return;
    } catch {
      await Bun.sleep(delayMs);
    }
  }
  throw new Error(`Server did not start within ${maxRetries * delayMs}ms`);
}

beforeAll(async () => {
  serverProcess = Bun.spawn(["bun", "run", "src/server.ts"], {
    env: { ...process.env, PORT: String(E2E_PORT) },
    cwd: join(import.meta.dir, ".."),
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitForServer(BASE_URL);
});

afterAll(() => {
  serverProcess?.kill();
});

describe("get document", () => {
  const slug = "e2e-get-test";
  const filePath = join(documentsDir, `${slug}.md`);
  const content = "# E2E Get Test\n\nThis document is used for e2e testing.";

  beforeAll(async () => {
    await Bun.write(filePath, content);
  });

  afterAll(async () => {
    await unlink(filePath);
  });

  test("retrieves an existing document", async () => {
    const response = await fetch(`${BASE_URL}/${slug}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(await response.text()).toBe(content);
  });

  test("returns 404 for a non-existent document", async () => {
    const response = await fetch(`${BASE_URL}/this-does-not-exist`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});

describe("upload document", () => {
  const slug = "e2e-upload-test";
  const filePath = join(documentsDir, `${slug}.md`);
  const content = "# E2E Upload Test\n\nUploaded via POST request.";

  afterAll(async () => {
    await unlink(filePath).catch(() => {});
  });

  test("uploads a new document via POST", async () => {
    const response = await fetch(`${BASE_URL}/${slug}`, {
      method: "POST",
      body: content,
    });
    expect(response.status).toBe(200);
  });

  test("returns 409 when uploading a duplicate document", async () => {
    const response = await fetch(`${BASE_URL}/${slug}`, {
      method: "POST",
      body: "# Different Content",
    });
    expect(response.status).toBe(409);
  });

  test("returns 400 for an invalid slug", async () => {
    const response = await fetch(`${BASE_URL}/Invalid-Slug`, {
      method: "POST",
      body: "# Content",
    });
    expect(response.status).toBe(400);
  });
});
