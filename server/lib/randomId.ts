import { randomBytes } from "node:crypto";

export function randomUrlSafeString(byteLength: number): string {
  return randomBytes(byteLength)
    .toString("base64url")
    .replace(/=+$/, "");
}
