/**
 * Verify a Dynamic access token (RS256) before Coinbase/MoonPay/sponsor calls.
 * JWKS: https://app.dynamicauth.com/api/v0/sdk/{environmentId}/.well-known/jwks
 */
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { getAddress } from "viem";
import { AuthError } from "./privyAuth.ts";

type Jwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
  use?: string;
};

type Jwks = { keys?: Jwk[] };

const JWKS_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map<string, { expiresAt: number; keys: Jwk[] }>();

export type DynamicSession = {
  userId: string;
  walletAddresses: string[];
};

function b64urlJson(part: string): Record<string, unknown> {
  const json = Buffer.from(part, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

async function jwksForEnvironment(environmentId: string): Promise<Jwk[]> {
  const cached = jwksCache.get(environmentId);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const url = `https://app.dynamicauth.com/api/v0/sdk/${environmentId}/.well-known/jwks`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new AuthError(503, "Could not verify session");
  }
  const body = (await res.json()) as Jwks;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache.set(environmentId, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return keys;
}

function verifyRs256(signingInput: string, signature: Buffer, jwk: Jwk): boolean {
  const key = createPublicKey({ key: jwk, format: "jwk" });
  return verifySignature("sha256", Buffer.from(signingInput), key, signature);
}

function pushAddress(into: Set<string>, value: unknown): void {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) return;
  try {
    into.add(getAddress(value));
  } catch {
    /* ignore non-addresses */
  }
}

function walletAddressesFromPayload(payload: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const take = (row: unknown) => {
    if (!row || typeof row !== "object") return;
    pushAddress(found, (row as { address?: unknown }).address);
  };
  for (const key of ["verified_credentials", "verifiedCredentials"] as const) {
    const rows = payload[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) take(row);
  }
  take(payload.verified_account);
  take(payload.verifiedAccount);
  return [...found];
}

export function isDynamicIssuer(iss: string): boolean {
  return iss.startsWith("app.dynamicauth.com/");
}

export async function requireDynamicAuth(
  token: string,
  environmentId: string | undefined
): Promise<DynamicSession> {
  const envId = environmentId?.trim();
  if (!envId) {
    throw new AuthError(503, "Dynamic environment id is not configured");
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

  if (header.alg !== "RS256") {
    throw new AuthError(401, "Invalid or expired session");
  }

  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (iss !== `app.dynamicauth.com/${envId}`) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp * 1000 <= Date.now()) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!scope.split(/\s+/).includes("user:basic")) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const kid = typeof header.kid === "string" ? header.kid : "";
  const keys = await jwksForEnvironment(envId);
  const jwk = kid ? keys.find((key) => key.kid === kid) : keys[0];
  if (!jwk) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const signature = Buffer.from(parts[2], "base64url");
  const ok = verifyRs256(`${parts[0]}.${parts[1]}`, signature, jwk);
  if (!ok) {
    throw new AuthError(401, "Invalid or expired session");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) {
    throw new AuthError(401, "Invalid session");
  }

  return {
    userId,
    walletAddresses: walletAddressesFromPayload(payload),
  };
}
