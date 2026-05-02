import { describe, expect, test } from "bun:test";
import { splitMarkdown, encryptBody, decryptBody } from "./crypto";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TEST_KEY_HEX = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

// Set the encryption key before any test touches the env
process.env["ENCRYPTION_KEY"] = TEST_KEY_HEX;

describe("crypto", () => {
  describe("splitMarkdown", () => {
    test("splits frontmatter and body", () => {
      const content = "---\ntitle: Test\n---\n# Hello\n\nWorld";
      const { frontmatter, body } = splitMarkdown(content);
      expect(frontmatter).toBe("---\ntitle: Test\n---\n");
      expect(body).toBe("# Hello\n\nWorld");
    });

    test("splits frontmatter with CRLF line endings", () => {
      const content = "---\r\ntitle: Test\r\n---\r\n# Body";
      const { frontmatter, body } = splitMarkdown(content);
      expect(frontmatter).toBe("---\r\ntitle: Test\r\n---\r\n");
      expect(body).toBe("# Body");
    });

    test("returns empty frontmatter when no frontmatter block present", () => {
      const content = "# Just a heading\n\nNo frontmatter.";
      const { frontmatter, body } = splitMarkdown(content);
      expect(frontmatter).toBe("");
      expect(body).toBe(content);
    });

    test("returns empty body when document has only frontmatter", () => {
      const content = "---\ntitle: Only FM\n---\n";
      const { frontmatter, body } = splitMarkdown(content);
      expect(frontmatter).toBe("---\ntitle: Only FM\n---\n");
      expect(body).toBe("");
    });

    test("round-trips: frontmatter + body equals original content", () => {
      const content = "---\ntitle: Round-trip\nslug: rt\n---\n\n# Heading\n\nBody text.";
      const { frontmatter, body } = splitMarkdown(content);
      expect(frontmatter + body).toBe(content);
    });
  });

  describe("key loading", () => {
    test("encrypts successfully with a valid 64-char hex ENCRYPTION_KEY", async () => {
      const encrypted = await encryptBody("hello");
      expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
    });

    test("throws when neither ENCRYPTION_KEY nor ENCRYPTION_KEY_FILE is set", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      await expect(encryptBody("test")).rejects.toThrow(
        "No encryption key configured. Set ENCRYPTION_KEY_FILE (recommended) or ENCRYPTION_KEY.",
      );
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("throws when ENCRYPTION_KEY has wrong length", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY"] = "tooshort";
      await expect(encryptBody("test")).rejects.toThrow("Encryption key must be a 64-character hex string");
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("throws when ENCRYPTION_KEY contains non-hex characters", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY"] = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
      await expect(encryptBody("test")).rejects.toThrow("Encryption key must be a 64-character hex string");
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("loads key from ENCRYPTION_KEY_FILE when set", async () => {
      const keyFilePath = join(tmpdir(), "corpus-test-key-1.txt");
      await writeFile(keyFilePath, TEST_KEY_HEX);
      const originalEnv = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const encrypted = await encryptBody("hello");
        expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
        await unlink(keyFilePath);
      }
    });

    test("ENCRYPTION_KEY_FILE takes precedence over ENCRYPTION_KEY", async () => {
      const keyFilePath = join(tmpdir(), "corpus-test-key-2.txt");
      await writeFile(keyFilePath, TEST_KEY_HEX);
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const encrypted = await encryptBody("hello");
        expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        await unlink(keyFilePath);
      }
    });

    test("throws when ENCRYPTION_KEY_FILE points to a non-existent file", async () => {
      const originalEnv = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY_FILE"] = "/no/such/file.txt";
      try {
        await expect(encryptBody("test")).rejects.toThrow("ENCRYPTION_KEY_FILE path does not exist");
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
      }
    });

    test("trims surrounding whitespace from the key file content", async () => {
      const keyFilePath = join(tmpdir(), "corpus-test-key-3.txt");
      await writeFile(keyFilePath, `\n  ${TEST_KEY_HEX}  \n`);
      const originalEnv = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const encrypted = await encryptBody("hello");
        expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
        await unlink(keyFilePath);
      }
    });
  });

  describe("encryptBody / decryptBody", () => {
    test("encrypted output starts with CORPUSENC1: magic prefix", async () => {
      const encrypted = await encryptBody("hello");
      expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
    });

    test("decrypting the output of encryptBody returns the original plaintext", async () => {
      const plaintext = "# Hello\n\nWorld content here.";
      const encrypted = await encryptBody(plaintext);
      const decrypted = await decryptBody(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test("encrypts empty body and round-trips back to empty string", async () => {
      const encrypted = await encryptBody("");
      const decrypted = await decryptBody(encrypted);
      expect(decrypted).toBe("");
    });

    test("each call to encryptBody produces a different ciphertext (random IV)", async () => {
      const a = await encryptBody("same content");
      const b = await encryptBody("same content");
      expect(a).not.toBe(b);
    });

    test("decryptBody throws for non-encrypted input", async () => {
      await expect(decryptBody("# Plaintext body")).rejects.toThrow(
        "Content is not in the corpus-server encrypted format",
      );
    });

    test("decryptBody throws when ciphertext is tampered", async () => {
      const encrypted = await encryptBody("secret");
      const tampered = encrypted.slice(0, -4) + "AAAA";
      await expect(decryptBody(tampered)).rejects.toThrow();
    });

    test("preserves unicode content through encrypt/decrypt round-trip", async () => {
      const unicode = "# Héllo Wörld 🌍\n\nEmoji and accents: café, naïve, résumé.";
      const encrypted = await encryptBody(unicode);
      const decrypted = await decryptBody(encrypted);
      expect(decrypted).toBe(unicode);
    });
  });
});
