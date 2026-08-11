import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { randomUrlSafeString } from "./randomId.js";

export type RepayShareRecord = {
  id: string;
  amount: string;
  assetSymbol: string;
  paidWithSymbol?: string;
  network?: string;
  createdAt: number;
  expiresAt: number;
};

type ShareIndex = Record<string, RepayShareRecord>;

let index: ShareIndex = {};
let loaded = false;

function shareDir(): string {
  return config.repayShareStorePath;
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

function isExpired(record: RepayShareRecord): boolean {
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

export async function createRepayShare(params: {
  amount: string;
  assetSymbol: string;
  paidWithSymbol?: string;
  network?: string;
  imageBuffer: Buffer;
}): Promise<RepayShareRecord> {
  await ensureLoaded();

  const id = randomUrlSafeString(9);
  const now = Date.now();
  const record: RepayShareRecord = {
    id,
    amount: params.amount.trim() || "0",
    assetSymbol: (params.assetSymbol.trim() || "ASSET").toUpperCase(),
    paidWithSymbol: params.paidWithSymbol?.trim()
      ? params.paidWithSymbol.trim().toUpperCase()
      : undefined,
    network: params.network?.trim() || undefined,
    createdAt: now,
    expiresAt: now + config.repayShareTtlMs,
  };

  await mkdir(shareDir(), { recursive: true });
  await writeFile(imagePath(id), params.imageBuffer);
  index[id] = record;
  await persistIndex();

  return record;
}

export async function getRepayShare(
  id: string
): Promise<RepayShareRecord | null> {
  await ensureLoaded();
  const record = index[id];
  if (!record) return null;
  if (isExpired(record)) {
    await removeShare(id);
    return null;
  }
  return record;
}

export async function getRepayShareImage(
  id: string
): Promise<{ record: RepayShareRecord; buffer: Buffer } | null> {
  const record = await getRepayShare(id);
  if (!record) return null;

  try {
    const buffer = await readFile(imagePath(id));
    return { record, buffer };
  } catch {
    await removeShare(id);
    return null;
  }
}
