/**
 * In-memory pending Deposit to Earn jobs, keyed by Privy user id.
 * Single Railway instance; 7-day TTL matches localStorage.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingEarnDepositJob = {
  algorandAddress: string;
  evmAddress?: string;
  wantedAmount: number;
  fromBaseAmount: number;
  expectedToAmount: number;
  algoUsdcBefore: number;
  orderId?: string;
  fromTxId?: string;
  poolId?: string;
  assetConfigKey?: string;
  at: number;
};

const jobs = new Map<string, PendingEarnDepositJob>();

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parsePendingEarnDepositJob(
  value: unknown,
  now = Date.now()
): PendingEarnDepositJob | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const algorandAddress = optionalString(raw.algorandAddress);
  if (!algorandAddress) return null;
  const wantedAmount = finiteNumber(raw.wantedAmount);
  const fromBaseAmount = finiteNumber(raw.fromBaseAmount);
  const expectedToAmount = finiteNumber(raw.expectedToAmount);
  const algoUsdcBefore = finiteNumber(raw.algoUsdcBefore);
  const at = finiteNumber(raw.at) ?? now;
  if (wantedAmount == null || wantedAmount <= 0) return null;
  if (fromBaseAmount == null || fromBaseAmount < 0) return null;
  if (expectedToAmount == null || expectedToAmount < 0) return null;
  if (algoUsdcBefore == null || algoUsdcBefore < 0) return null;
  if (now - at > MAX_AGE_MS) return null;
  return {
    algorandAddress,
    evmAddress: optionalString(raw.evmAddress),
    wantedAmount,
    fromBaseAmount,
    expectedToAmount,
    algoUsdcBefore,
    orderId: optionalString(raw.orderId),
    fromTxId: optionalString(raw.fromTxId),
    poolId: optionalString(raw.poolId),
    assetConfigKey: optionalString(raw.assetConfigKey),
    at,
  };
}

export function getPendingEarnDepositJob(
  userId: string,
  now = Date.now()
): PendingEarnDepositJob | null {
  const job = jobs.get(userId);
  if (!job) return null;
  const parsed = parsePendingEarnDepositJob(job, now);
  if (!parsed) {
    jobs.delete(userId);
    return null;
  }
  return parsed;
}

export function setPendingEarnDepositJob(
  userId: string,
  value: unknown,
  now = Date.now()
): PendingEarnDepositJob | null {
  const job = parsePendingEarnDepositJob(value, now);
  if (!job) return null;
  jobs.set(userId, job);
  return job;
}

export function deletePendingEarnDepositJob(userId: string): void {
  jobs.delete(userId);
}

export function resetPendingEarnDepositStoreForTests(): void {
  jobs.clear();
}
