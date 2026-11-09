import { readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

/** Orphans younger than this may be an upload that has not been indexed yet. */
export const SHARE_ORPHAN_MIN_AGE_MS = 15 * 60 * 1000;

const PNG_NAME = /^[A-Za-z0-9_-]+\.png$/;

export class ShareStoreFullError extends Error {
  constructor() {
    super("Share store is full");
    this.name = "ShareStoreFullError";
  }
}

export type ShareStoreBudget = {
  maxFiles: number;
  maxBytes: number;
};

export type ShareStoreUsage = {
  files: number;
  bytes: number;
};

let shareIndexLoadGate: Promise<void> | null = null;

/** Test hook. Index reads wait on this promise before parsing index.json. */
export function setShareIndexLoadGateForTests(gate: Promise<void> | null): void {
  shareIndexLoadGate = gate;
}

export async function readShareIndex<T>(filePath: string): Promise<T | null> {
  if (shareIndexLoadGate) await shareIndexLoadGate;
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * One in-flight read. `loaded` flips only after `apply`, so a sweep that
 * starts during the read waits instead of treating an empty index as complete.
 */
export function createShareIndexLoader<T>(opts: {
  read: () => Promise<T | null>;
  apply: (value: T | null) => void;
}): { ensureLoaded: () => Promise<void>; reset: () => void } {
  let loaded = false;
  let pending: Promise<void> | null = null;
  let generation = 0;

  return {
    ensureLoaded() {
      if (loaded) return Promise.resolve();
      if (!pending) {
        const gen = generation;
        pending = opts
          .read()
          .then((value) => {
            if (gen !== generation) return;
            opts.apply(value);
            loaded = true;
          })
          .finally(() => {
            if (gen === generation) pending = null;
          });
      }
      return pending;
    },
    reset() {
      generation += 1;
      loaded = false;
      pending = null;
    },
  };
}

let writeTail: Promise<void> = Promise.resolve();

/** One writer at a time so the budget check and the index cannot race. */
export function withShareWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = writeTail;
  let release: () => void = () => {};
  writeTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  return previous.then(fn, fn).finally(() => {
    release();
  });
}

export async function measureShareDirs(dirs: string[]): Promise<ShareStoreUsage> {
  let files = 0;
  let bytes = 0;
  for (const dir of dirs) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!PNG_NAME.test(name)) continue;
      try {
        const info = await stat(path.join(dir, name));
        if (!info.isFile()) continue;
        files += 1;
        bytes += info.size;
      } catch {
        // removed between readdir and stat
      }
    }
  }
  return { files, bytes };
}

export function shareStoreDirs(): string[] {
  return [
    config.repayShareStorePath,
    config.borrowShareStorePath,
    config.profileShareStorePath,
  ];
}

export async function assertShareStoreHasRoom(
  incomingBytes: number,
  budget: ShareStoreBudget = {
    maxFiles: config.shareStoreMaxFiles,
    maxBytes: config.shareStoreMaxBytes,
  }
): Promise<void> {
  const usage = await measureShareDirs(shareStoreDirs());
  if (usage.files >= budget.maxFiles) throw new ShareStoreFullError();
  if (usage.bytes >= budget.maxBytes) throw new ShareStoreFullError();
  if (usage.bytes + incomingBytes > budget.maxBytes) {
    throw new ShareStoreFullError();
  }
}

export async function unlinkOrphanPngs(
  dir: string,
  liveIds: ReadonlySet<string>,
  now: number,
  minAgeMs = SHARE_ORPHAN_MIN_AGE_MS
): Promise<number> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (!PNG_NAME.test(name)) continue;
    const id = name.slice(0, -".png".length);
    if (liveIds.has(id)) continue;
    const filePath = path.join(dir, name);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) continue;
      if (now - info.mtimeMs < minAgeMs) continue;
      await unlink(filePath);
      removed += 1;
    } catch {
      // already gone
    }
  }
  return removed;
}

export async function sweepIndexedShareDir<T extends { expiresAt: number }>(opts: {
  dir: string;
  index: Record<string, T>;
  now: number;
  imagePath: (id: string) => string;
  persistIndex: () => Promise<void>;
}): Promise<number> {
  const expiredIds = Object.entries(opts.index)
    .filter(([, record]) => record.expiresAt <= opts.now)
    .map(([id]) => id);

  for (const id of expiredIds) {
    try {
      await unlink(opts.imagePath(id));
    } catch {
      // already gone
    }
    delete opts.index[id];
  }
  if (expiredIds.length > 0) {
    await opts.persistIndex();
  }

  const orphans = await unlinkOrphanPngs(
    opts.dir,
    new Set(Object.keys(opts.index)),
    opts.now
  );
  return expiredIds.length + orphans;
}
