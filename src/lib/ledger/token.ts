import { randomBytes } from "node:crypto";

// 256-bit unguessable review token, 43 URL-safe chars.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
