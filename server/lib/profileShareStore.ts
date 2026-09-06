import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { randomUrlSafeString } from "./randomId.js";

export type ProfileShareRecord = {
  id: string;
  nftName: string;
  contractId?: number;
  collectionId?: string;
  createdAt: number;
  expiresAt: number;
};

type ShareIndex = Record<string, ProfileShareRecord>;

let index: ShareIndex = {};
let loaded = false;

function shareDir(): string {
  return config.profileShareStorePath;
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

function isExpired(record: ProfileShareRecord): boolean {
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

export async function createProfileShare(params: {
  nftName: string;
  contractId?: number;
  collectionId?: string;
  imageBuffer: Buffer;
}): Promise<ProfileShareRecord> {
  await ensureLoaded();

  const id = randomUrlSafeString(9);
  const now = Date.now();
  const record: ProfileShareRecord = {
    id,
    nftName: params.nftName.trim() || "NFT",
    contractId: params.contractId,
    collectionId: params.collectionId?.trim() || undefined,
    createdAt: now,
    expiresAt: now + config.profileShareTtlMs,
  };

  await mkdir(shareDir(), { recursive: true });
  await writeFile(imagePath(id), params.imageBuffer);
  index[id] = record;
  await persistIndex();

  return record;
}

export async function getProfileShare(
  id: string
): Promise<ProfileShareRecord | null> {
  await ensureLoaded();
  const record = index[id];
  if (!record) return null;
  if (isExpired(record)) {
    await removeShare(id);
    return null;
  }
  return record;
}

export async function getProfileShareImage(
  id: string
): Promise<{ record: ProfileShareRecord; buffer: Buffer } | null> {
  const record = await getProfileShare(id);
  if (!record) return null;

  try {
    const buffer = await readFile(imagePath(id));
    return { record, buffer };
  } catch {
    await removeShare(id);
    return null;
  }
}
