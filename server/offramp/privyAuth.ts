/**
 * Verify a Privy access token before calling Coinbase/MoonPay.
 * Uses Privy's public JWKS (app id is already client-safe) and Node crypto.
 */
import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { IncomingMessage } from "node:http";

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

type Jwk = {
  kid?: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: string;
};

type Jwks = { keys?: Jwk[] };

const JWKS_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map<string, { expiresAt: number; keys: Jwk[] }>();

const PRIVY_ISSUERS = new Set(["privy.io", "https://auth.privy.io"]);

export function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? null;
}

function b64urlJson(part: string): Record<string, unknown> {
  const json = Buffer.from(part, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

async function jwksForApp(appId: string): Promise<Jwk[]> {
  const cached = jwksCache.get(appId);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const url = `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new AuthError(503, "Could not verify session");
  }
  const body = (await res.json()) as Jwks;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache.set(appId, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return keys;
}

function verifyEs256(signingInput: string, signature: Buffer, jwk: Jwk): boolean {
  const key = createPublicKey({ key: jwk, format: "jwk" });
  return verifySignature(
    "sha256",
    Buffer.from(signingInput),
    { key, dsaEncoding: "ieee-p1363" },
    signature
  );
}

export async function requirePrivyAuth(
  req: IncomingMessage,
  privyAppId: string | undefined
): Promise<{ userId: string }> {
  const token = bearerToken(req);
  if (!token) {
    throw new AuthError(401, "Authentication required");
  }
  const appId = privyAppId?.trim();
  if (!appId) {
    throw new AuthError(503, "Privy app id is not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new AuthError(401, "Invalid or expired session");
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch {
    throw new AuthError(401, "Invalid or expired session");
  }

  if (header.alg !== "ES256") {
    throw new AuthError(401, "Invalid or expired session");
  }

  const iss = typeof payload.iss === "string" ? payload.iss : "";
  const aud = payload.aud;
  const audienceOk =
    aud === appId || (Array.isArray(aud) && aud.includes(appId));
  if (!PRIVY_ISSUERS.has(iss) || !audienceOk) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp * 1000 <= Date.now()) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const kid = typeof header.kid === "string" ? header.kid : "";
  const keys = await jwksForApp(appId);
  const jwk = kid ? keys.find((key) => key.kid === kid) : keys[0];
  if (!jwk) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const signature = Buffer.from(parts[2], "base64url");
  const ok = verifyEs256(`${parts[0]}.${parts[1]}`, signature, jwk);
  if (!ok) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) {
    throw new AuthError(401, "Invalid session");
  }
  return { userId };
}
