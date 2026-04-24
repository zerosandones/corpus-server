import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { splitMarkdown, getEncryptionKey, encryptBody, decryptBody } from "./crypto";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

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

  describe("getEncryptionKey", () => {
    test("returns a CryptoKey for a valid 64-char hex ENCRYPTION_KEY", async () => {
      const key = await getEncryptionKey();
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.algorithm.name).toBe("AES-GCM");
    });

    test("throws when neither ENCRYPTION_KEY nor ENCRYPTION_KEY_FILE is set", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      await expect(getEncryptionKey()).rejects.toThrow(
        "No encryption key configured. Set ENCRYPTION_KEY_FILE (recommended) or ENCRYPTION_KEY.",
      );
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("throws when ENCRYPTION_KEY has wrong length", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY"] = "tooshort";
      await expect(getEncryptionKey()).rejects.toThrow("Encryption key must be a 64-character hex string");
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("throws when ENCRYPTION_KEY contains non-hex characters", async () => {
      const original = process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY"] = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
      await expect(getEncryptionKey()).rejects.toThrow("Encryption key must be a 64-character hex string");
      process.env["ENCRYPTION_KEY"] = original;
    });

    test("loads key from ENCRYPTION_KEY_FILE when set", async () => {
      const keyFilePath = join(import.meta.dir, "..", "temp-key-file.txt");
      await writeFile(keyFilePath, TEST_KEY_HEX);
      const originalEnv = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const key = await getEncryptionKey();
        expect(key).toBeInstanceOf(CryptoKey);
        expect(key.algorithm.name).toBe("AES-GCM");
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
        await unlink(keyFilePath);
      }
    });

    test("ENCRYPTION_KEY_FILE takes precedence over ENCRYPTION_KEY", async () => {
      const keyFilePath = join(import.meta.dir, "..", "temp-key-file-2.txt");
      await writeFile(keyFilePath, TEST_KEY_HEX);
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const key = await getEncryptionKey();
        expect(key).toBeInstanceOf(CryptoKey);
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
        await expect(getEncryptionKey()).rejects.toThrow("ENCRYPTION_KEY_FILE path does not exist");
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
      }
    });

    test("trims surrounding whitespace from the key file content", async () => {
      const keyFilePath = join(import.meta.dir, "..", "temp-key-file-3.txt");
      await writeFile(keyFilePath, `\n  ${TEST_KEY_HEX}  \n`);
      const originalEnv = process.env["ENCRYPTION_KEY"];
      delete process.env["ENCRYPTION_KEY"];
      process.env["ENCRYPTION_KEY_FILE"] = keyFilePath;
      try {
        const key = await getEncryptionKey();
        expect(key).toBeInstanceOf(CryptoKey);
      } finally {
        delete process.env["ENCRYPTION_KEY_FILE"];
        process.env["ENCRYPTION_KEY"] = originalEnv;
        await unlink(keyFilePath);
      }
    });
  });

  describe("encryptBody / decryptBody", () => {
    let key: CryptoKey;

    beforeAll(async () => {
      key = await getEncryptionKey();
    });

    test("encrypted output starts with CORPUSENC1: magic prefix", async () => {
      const encrypted = await encryptBody("hello", key);
      expect(encrypted.startsWith("CORPUSENC1:")).toBe(true);
    });

    test("decrypting the output of encryptBody returns the original plaintext", async () => {
      const plaintext = "# Hello\n\nWorld content here.";
      const encrypted = await encryptBody(plaintext, key);
      const decrypted = await decryptBody(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test("encrypts empty body and round-trips back to empty string", async () => {
      const encrypted = await encryptBody("", key);
      const decrypted = await decryptBody(encrypted, key);
      expect(decrypted).toBe("");
    });

    test("each call to encryptBody produces a different ciphertext (random IV)", async () => {
      const a = await encryptBody("same content", key);
      const b = await encryptBody("same content", key);
      expect(a).not.toBe(b);
    });

    test("decryptBody throws for non-encrypted input", async () => {
      await expect(decryptBody("# Plaintext body", key)).rejects.toThrow(
        "Content is not in the corpus-server encrypted format",
      );
    });

    test("decryptBody throws when ciphertext is tampered", async () => {
      const encrypted = await encryptBody("secret", key);
      const tampered = encrypted.slice(0, -4) + "AAAA";
      await expect(decryptBody(tampered, key)).rejects.toThrow();
    });

    test("preserves unicode content through encrypt/decrypt round-trip", async () => {
      const unicode = "# Héllo Wörld 🌍\n\nEmoji and accents: café, naïve, résumé.";
      const encrypted = await encryptBody(unicode, key);
      const decrypted = await decryptBody(encrypted, key);
      expect(decrypted).toBe(unicode);
    });
  });
});
