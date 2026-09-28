import { randomBytes } from "node:crypto";

/** High-entropy, URL-safe random token for session cookies and verification/reset links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
