import { verifyToken, type TokenPayload } from "./jwt";
import type { DocumentSecurity } from "./storage";

/** Discriminated error type for authentication failures. */
export type AuthError = "missing" | "invalid";

/**
 * Extracts and verifies the Bearer JWT from an HTTP request's Authorization header.
 * Returns the decoded token payload on success and throws an AuthError string on failure.
 *
 * @param req The incoming HTTP request.
 * @returns The verified token payload.
 * @throws {"missing"} When no Authorization header or Bearer token is present.
 * @throws {"invalid"} When the token cannot be verified (expired, tampered, etc.).
 */
export async function requireAuth(req: Request): Promise<TokenPayload> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw "missing" as AuthError;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw "missing" as AuthError;
  }
  try {
    return await verifyToken(token);
  } catch {
    throw "invalid" as AuthError;
  }
}

/**
 * Returns true when the given security level requires authentication for GET requests.
 * Both "internal" and "confidential" documents are protected.
 * "public" documents and documents with no security level are not protected.
 *
 * @param security The document security classification, or null if not set.
 */
export function isProtectedDocument(
  security: DocumentSecurity | null,
): boolean {
  return security === "internal" || security === "confidential";
}
