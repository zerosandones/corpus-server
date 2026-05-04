import { verifyToken, type TokenPayload } from "./jwt";

/** Discriminated error type for authentication failures. */
export type AuthError = "missing" | "invalid";

/**
 * Extracts and verifies the Bearer JWT from an HTTP request's Authorization header.
 * Returns the decoded token payload on success, or an AuthError string on failure.
 *
 * @param req The incoming HTTP request.
 * @returns The verified token payload, "missing" if no token was provided, or "invalid" if verification failed.
 */
export async function requireAuth(req: Request): Promise<TokenPayload | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "missing";
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return "missing";
  }
  try {
    return await verifyToken(token);
  } catch {
    return "invalid";
  }
}
