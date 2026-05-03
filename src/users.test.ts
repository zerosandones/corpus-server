import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { createUser, ensureUsersDb, resetUsersDb, verifyUser } from "./users";

const testDbPath = join(import.meta.dir, "..", "temp", "users-test.db");

async function setupDb(): Promise<void> {
  process.env["USER_DB_PATH"] = testDbPath;
  resetUsersDb();
  await ensureUsersDb();
}

afterEach(async () => {
  resetUsersDb();
  delete process.env["USER_DB_PATH"];
  await rm(testDbPath, { force: true });
});

describe("users", () => {
  describe("createUser", () => {
    test("creates a new user and returns 'created'", async () => {
      await setupDb();
      const result = await createUser("alice", "s3cr3tP@ssw0rd!");
      expect(result).toBe("created");
    });

    test("returns 'conflict' when username is already taken", async () => {
      await setupDb();
      await createUser("bob", "pass1");
      const result = await createUser("bob", "pass2");
      expect(result).toBe("conflict");
    });

    test("stores a hashed password, not the plaintext", async () => {
      await setupDb();
      await createUser("charlie", "plaintext");
      const { Database } = await import("bun:sqlite");
      const db = new Database(testDbPath);
      const row = db
        .query<{ password_hash: string }, []>(
          "SELECT password_hash FROM users WHERE username = 'charlie'",
        )
        .get();
      db.close();
      expect(row).not.toBeNull();
      expect(row!.password_hash).not.toBe("plaintext");
      expect(row!.password_hash.length).toBeGreaterThan(20);
    });
  });

  describe("verifyUser", () => {
    test("returns true for correct credentials", async () => {
      await setupDb();
      await createUser("dave", "correctHorse");
      const result = await verifyUser("dave", "correctHorse");
      expect(result).toBe(true);
    });

    test("returns false for wrong password", async () => {
      await setupDb();
      await createUser("eve", "correctHorse");
      const result = await verifyUser("eve", "wrongPass");
      expect(result).toBe(false);
    });

    test("returns false for unknown username", async () => {
      await setupDb();
      const result = await verifyUser("nobody", "anypass");
      expect(result).toBe(false);
    });
  });
});
