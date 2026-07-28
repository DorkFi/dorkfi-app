import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export type StoredXTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  username?: string;
  userId?: string;
};

type TokenDatabase = Record<string, StoredXTokens>;

type PendingOAuth = {
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
};

type PendingDatabase = Record<string, PendingOAuth>;

let tokenDb: TokenDatabase = {};
const pendingDb: PendingDatabase = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await readFile(config.tokenStorePath, "utf8");
    tokenDb = JSON.parse(raw) as TokenDatabase;
  } catch {
    tokenDb = {};
  }
}

async function persistTokens(): Promise<void> {
  const dir = path.dirname(config.tokenStorePath);
  await mkdir(dir, { recursive: true });
  await writeFile(config.tokenStorePath, JSON.stringify(tokenDb, null, 2), "utf8");
}

export async function getSessionTokens(
  sessionId: string
): Promise<StoredXTokens | null> {
  await ensureLoaded();
  return tokenDb[sessionId] ?? null;
}

export async function setSessionTokens(
  sessionId: string,
  tokens: StoredXTokens
): Promise<void> {
  await ensureLoaded();
  tokenDb[sessionId] = tokens;
  await persistTokens();
}

export async function clearSessionTokens(sessionId: string): Promise<void> {
  await ensureLoaded();
  delete tokenDb[sessionId];
  await persistTokens();
}

export function setPendingOAuth(
  state: string,
  pending: Omit<PendingOAuth, "expiresAt">,
  ttlMs = 10 * 60 * 1000
): void {
  pendingDb[state] = {
    ...pending,
    expiresAt: Date.now() + ttlMs,
  };
}

export function consumePendingOAuth(state: string): PendingOAuth | null {
  const pending = pendingDb[state];
  delete pendingDb[state];
  if (!pending) return null;
  if (pending.expiresAt < Date.now()) return null;
  return pending;
}
