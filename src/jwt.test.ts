import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signToken, verifyToken } from "./jwt";

const TEST_SECRET = "super-secret-key-that-is-at-least-32-chars!!";

beforeEach(() => {
  process.env["JWT_SECRET"] = TEST_SECRET;
});

afterEach(() => {
  delete process.env["JWT_SECRET"];
  delete process.env["JWT_SECRET_FILE"];
  delete process.env["JWT_EXPIRES_IN"];
});

describe("jwt", () => {
  describe("signToken", () => {
    test("produces a three-part JWT string", async () => {
      const token = await signToken("alice");
      const parts = token.split(".");
      expect(parts.length).toBe(3);
    });

    test("signed token can be verified and returns the correct username", async () => {
      const token = await signToken("bob");
      const payload = await verifyToken(token);
      expect(payload.username).toBe("bob");
    });

    test("each call produces a different token", async () => {
      const a = await signToken("charlie");
      const b = await signToken("charlie");
      expect(a).not.toBe(b);
    });
  });

  describe("verifyToken", () => {
    test("throws on a tampered token", async () => {
      const token = await signToken("dave");
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}TAMPERED.${parts[2]}`;
      await expect(verifyToken(tampered)).rejects.toThrow();
    });

    test("throws when token is signed with a different secret", async () => {
      const token = await signToken("eve");
      process.env["JWT_SECRET"] = "a-completely-different-secret-that-is-long-enough";
      await expect(verifyToken(token)).rejects.toThrow();
    });

    test("throws on an expired token", async () => {
      process.env["JWT_EXPIRES_IN"] = "-1";
      const token = await signToken("frank");
      await expect(verifyToken(token)).rejects.toThrow();
    });

    test("throws when JWT_SECRET is not configured", async () => {
      delete process.env["JWT_SECRET"];
      await expect(verifyToken("any.token.here")).rejects.toThrow(
        "No JWT secret configured",
      );
    });

    test("throws when JWT_SECRET is shorter than 32 characters", async () => {
      process.env["JWT_SECRET"] = "tooshort";
      await expect(signToken("grace")).rejects.toThrow(
        "JWT secret must be at least 32 characters long",
      );
    });

    test("loads secret from JWT_SECRET_FILE", async () => {
      const { writeFile, unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const filePath = join(tmpdir(), "corpus-jwt-secret-test.txt");
      await writeFile(filePath, TEST_SECRET);
      delete process.env["JWT_SECRET"];
      process.env["JWT_SECRET_FILE"] = filePath;
      try {
        const token = await signToken("henry");
        const payload = await verifyToken(token);
        expect(payload.username).toBe("henry");
      } finally {
        delete process.env["JWT_SECRET_FILE"];
        await unlink(filePath);
      }
    });
  });
});
