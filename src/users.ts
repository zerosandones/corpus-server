import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "path";

/** Represents the outcome of a create-user operation. */
export type CreateUserResult = "created" | "conflict";

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    throw new Error("Users database not initialised. Call ensureUsersDb() first.");
  }
  return db;
}

/**
 * Initialises the users database, creating the users table if it does not
 * already exist. Call once at server startup before any user operations.
 */
export async function ensureUsersDb(): Promise<void> {
  const dbPath =
    process.env["USER_DB_PATH"] ?? join(import.meta.dir, "..", "data", "users.db");
  if (dbPath !== ":memory:") {
    await mkdir(dirname(dbPath), { recursive: true });
  }
  if (!db) {
    db = new Database(dbPath, { create: true });
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      created_at   TEXT    NOT NULL
    )
  `);
}

/**
 * Creates a new user with an Argon2id-hashed password.
 * Returns "created" on success and "conflict" when the username is already taken.
 *
 * @param username The desired username.
 * @param password The plaintext password to hash and store.
 */
export async function createUser(
  username: string,
  password: string,
): Promise<CreateUserResult> {
  const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
  try {
    getDb().run(
      "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
      [username, hash, new Date().toISOString()],
    );
    return "created";
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return "conflict";
    }
    throw err;
  }
}

/**
 * Verifies a username/password pair.
 * Returns true when the credentials are valid, false otherwise.
 *
 * @param username The username to look up.
 * @param password The plaintext password to verify against the stored hash.
 */
export async function verifyUser(
  username: string,
  password: string,
): Promise<boolean> {
  const row = getDb()
    .query<{ password_hash: string }, [string]>(
      "SELECT password_hash FROM users WHERE username = ?",
    )
    .get(username);

  if (!row) return false;
  return Bun.password.verify(password, row.password_hash);
}

/** Resets the in-process database instance. Useful for test isolation. */
export function resetUsersDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
