/** Represents a verified caller — a machine agent authenticated via API key. */
export type Principal = {
  id: string;
  type: "machine";
  scopes: string[];
};

type ApiKeyRecord = {
  id: string;
  keyHash: string;
  scopes: string[];
};

function isApiKeyRecord(v: unknown): v is ApiKeyRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["keyHash"] === "string" &&
    Array.isArray(r["scopes"]) &&
    (r["scopes"] as unknown[]).every((s) => typeof s === "string")
  );
}

/** Parses the API_KEYS environment variable into validated key records.
 * Expected format: a JSON array of `{ id, keyHash, scopes }` objects,
 * where `keyHash` is the SHA-256 hex digest of the raw bearer token.
 */
function parseApiKeys(raw: string | undefined): ApiKeyRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isApiKeyRecord);
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Authenticates a request by inspecting its `Authorization: Bearer <token>` header.
 * The token is hashed with SHA-256 and compared against the records in the
 * `API_KEYS` environment variable. Returns a `Principal` on success, or `null`
 * when the header is absent, malformed, or the token does not match any record.
 */
export async function authenticate(req: Request): Promise<Principal | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const keys = parseApiKeys(process.env["API_KEYS"]);
  const keyHash = await hashKey(token);

  const record = keys.find((k) => k.keyHash === keyHash);
  if (record) {
    return { id: record.id, type: "machine", scopes: record.scopes };
  }

  return null;
}
