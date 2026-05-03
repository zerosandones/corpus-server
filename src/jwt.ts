import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** The decoded payload returned by verifyToken. */
export type TokenPayload = { username: string };

/**
 * Loads the JWT secret from environment variables.
 * Prefers JWT_SECRET_FILE (a file containing the secret) over JWT_SECRET.
 * The resolved secret must be at least 32 characters long.
 *
 * @throws If neither variable is set, the file cannot be read, or the secret is too short.
 */
async function getJwtSecret(): Promise<Uint8Array> {
  let secret: string | undefined;

  const secretFile = process.env["JWT_SECRET_FILE"];
  if (secretFile) {
    const file = Bun.file(secretFile);
    if (!(await file.exists())) {
      throw new Error(`JWT_SECRET_FILE path does not exist: ${secretFile}`);
    }
    secret = (await file.text()).trim();
  } else {
    secret = process.env["JWT_SECRET"];
    if (secret) {
      console.warn(
        "[corpus-server] WARNING: JWT secret is loaded from the JWT_SECRET environment variable. " +
          "This is not recommended for production — set JWT_SECRET_FILE to a Docker or Kubernetes secret path instead.",
      );
    }
  }

  if (!secret) {
    throw new Error(
      "No JWT secret configured. Set JWT_SECRET_FILE (recommended) or JWT_SECRET.",
    );
  }
  if (secret.length < 32) {
    throw new Error("JWT secret must be at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a JWT for the given username using HS256.
 * Expiry defaults to 86400 seconds (24 h) and is configurable via JWT_EXPIRES_IN.
 * A random `jti` claim is included so that every call produces a unique token.
 *
 * @param username The subject claim to embed in the token.
 * @returns A compact JWT string.
 */
export async function signToken(username: string): Promise<string> {
  const secret = await getJwtSecret();
  const expiresIn = Number(process.env["JWT_EXPIRES_IN"] ?? 86400);
  return new SignJWT({ sub: username, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);
}

/**
 * Verifies a compact JWT string.
 * Returns the decoded payload on success and throws on invalid/expired tokens.
 *
 * @param token The compact JWT string to verify.
 * @returns The token payload containing the username.
 * @throws If the token is invalid, expired, or the secret is not configured.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = await getJwtSecret();
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  const username = (payload as JWTPayload & { sub?: string }).sub;
  if (typeof username !== "string" || !username) {
    throw new Error("JWT payload is missing the sub claim.");
  }
  return { username };
}
