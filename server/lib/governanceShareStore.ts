import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { randomUrlSafeString } from "./pkce.js";

export type GovernanceShareRecord = {
  id: string;
  proposalId: string;
  proposalTitle: string;
  support: boolean;
  votingPower: number;
  createdAt: number;
  expiresAt: number;
};

type ShareIndex = Record<string, GovernanceShareRecord>;

let index: ShareIndex = {};
let loaded = false;

function shareDir(): string {
  return config.governanceShareStorePath;
}

function indexPath(): string {
  return path.join(shareDir(), "index.json");
}

function imagePath(id: string): string {
  return path.join(shareDir(), `${id}.png`);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await readFile(indexPath(), "utf8");
    index = JSON.parse(raw) as ShareIndex;
  } catch {
    index = {};
  }
}

async function persistIndex(): Promise<void> {
  await mkdir(shareDir(), { recursive: true });
  await writeFile(indexPath(), JSON.stringify(index, null, 2), "utf8");
}

function isExpired(record: GovernanceShareRecord): boolean {
  return record.expiresAt <= Date.now();
}

async function removeShare(id: string): Promise<void> {
  delete index[id];
  await persistIndex();
  try {
    await unlink(imagePath(id));
  } catch {
    // image may already be gone
  }
}

export async function createGovernanceShare(params: {
  proposalId: string;
  proposalTitle: string;
  support: boolean;
  votingPower: number;
  imageBuffer: Buffer;
}): Promise<GovernanceShareRecord> {
  await ensureLoaded();

  const id = randomUrlSafeString(9);
  const now = Date.now();
  const record: GovernanceShareRecord = {
    id,
    proposalId: params.proposalId.trim(),
    proposalTitle: params.proposalTitle.trim(),
    support: params.support,
    votingPower: params.votingPower,
    createdAt: now,
    expiresAt: now + config.governanceShareTtlMs,
  };

  await mkdir(shareDir(), { recursive: true });
  await writeFile(imagePath(id), params.imageBuffer);
  index[id] = record;
  await persistIndex();

  return record;
}

export async function getGovernanceShare(
  id: string
): Promise<GovernanceShareRecord | null> {
  await ensureLoaded();
  const record = index[id];
  if (!record) return null;
  if (isExpired(record)) {
    await removeShare(id);
    return null;
  }
  return record;
}

export async function getGovernanceShareImage(
  id: string
): Promise<{ record: GovernanceShareRecord; buffer: Buffer } | null> {
  const record = await getGovernanceShare(id);
  if (!record) return null;

  try {
    const buffer = await readFile(imagePath(id));
    return { record, buffer };
  } catch {
    await removeShare(id);
    return null;
  }
}
