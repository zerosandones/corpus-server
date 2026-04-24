/** Magic prefix written before every encrypted body, enabling format detection. */
const MAGIC_PREFIX = "CORPUSENC1:";

/**
 * Splits a Markdown document into its YAML frontmatter block and the remaining body.
 * The frontmatter string includes the trailing newline after the closing `---` delimiter
 * so that concatenating frontmatter and body reconstructs the original document exactly.
 *
 * @param content The full document content.
 * @returns An object with `frontmatter` (the `---…---\n` block or `""`) and `body` (the rest).
 */
export function splitMarkdown(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
  if (match) {
    const frontmatter = match[1] as string;
    return { frontmatter, body: content.slice(frontmatter.length) };
  }
  return { frontmatter: "", body: content };
}

/**
 * Loads the AES-256-GCM encryption key for document bodies.
 *
 * The key is resolved from one of two sources, checked in this order:
 *
 * 1. **`ENCRYPTION_KEY_FILE`** — path to a file whose content is the 64-character
 *    hex key.  Use this with Docker secrets (`/run/secrets/<name>`) or Kubernetes
 *    secret volume mounts so the key is never stored in an environment variable and
 *    is not visible via `docker inspect` or `/proc/self/environ`.
 *
 * 2. **`ENCRYPTION_KEY`** — the 64-character hex key supplied directly as an
 *    environment variable.  Convenient for local development and CI, but less
 *    secure in production because environment variables can be read by any process
 *    running as the same user and are surfaced by container inspection tools.
 *
 * The resolved value must be a 64-character hex string (32 bytes, AES-256).
 *
 * @throws If neither variable is set, or if the resolved value is malformed.
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  let hex: string | undefined;

  const keyFile = process.env["ENCRYPTION_KEY_FILE"];
  if (keyFile) {
    const file = Bun.file(keyFile);
    if (!(await file.exists())) {
      throw new Error(`ENCRYPTION_KEY_FILE path does not exist: ${keyFile}`);
    }
    hex = (await file.text()).trim();
  } else {
    hex = process.env["ENCRYPTION_KEY"];
  }

  if (!hex) {
    throw new Error(
      "No encryption key configured. Set ENCRYPTION_KEY_FILE (recommended) or ENCRYPTION_KEY.",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Encryption key must be a 64-character hex string (32 bytes for AES-256)");
  }
  const raw = Buffer.from(hex, "hex");
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts a plaintext body string with AES-256-GCM and returns a
 * `CORPUSENC1:<base64>` token that encodes a random 12-byte IV prepended to
 * the ciphertext (which includes the GCM authentication tag).
 *
 * @param body The plaintext document body to encrypt.
 * @param key  An AES-256-GCM CryptoKey with the `encrypt` usage.
 * @returns The encrypted token string.
 */
export async function encryptBody(body: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(body),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return MAGIC_PREFIX + Buffer.from(combined).toString("base64");
}

/**
 * Decrypts a `CORPUSENC1:<base64>` token produced by `encryptBody` and
 * returns the original plaintext body string.
 *
 * @param encrypted The encrypted token string.
 * @param key       An AES-256-GCM CryptoKey with the `decrypt` usage.
 * @throws If the token does not carry the expected magic prefix, or if AES-GCM
 *         authentication fails (wrong key or tampered ciphertext).
 */
export async function decryptBody(encrypted: string, key: CryptoKey): Promise<string> {
  if (!encrypted.startsWith(MAGIC_PREFIX)) {
    throw new Error("Content is not in the corpus-server encrypted format");
  }
  const combined = Buffer.from(encrypted.slice(MAGIC_PREFIX.length), "base64");
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
