/**
 * Resume Deposit to Earn after Exodus has paid Algorand but the supply
 * step never ran (tab close, delayed order status, poll abort).
 */
import { isAlgoCreditArrived } from "@/lib/easyStart/xoSwap/settle";

export const PENDING_EARN_DEPOSIT_KEY = "simplfi.earn.pending_deposit";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingEarnDeposit = {
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

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isPendingEarnDeposit(value: unknown): value is PendingEarnDeposit {
  if (!value || typeof value !== "object") return false;
  const job = value as PendingEarnDeposit;
  if (typeof job.algorandAddress !== "string" || !job.algorandAddress.trim()) {
    return false;
  }
  if (!Number.isFinite(job.wantedAmount) || job.wantedAmount <= 0) return false;
  if (!Number.isFinite(job.fromBaseAmount) || job.fromBaseAmount < 0) {
    return false;
  }
  if (!Number.isFinite(job.expectedToAmount) || job.expectedToAmount < 0) {
    return false;
  }
  if (!Number.isFinite(job.algoUsdcBefore) || job.algoUsdcBefore < 0) {
    return false;
  }
  if (typeof job.at !== "number" || !Number.isFinite(job.at)) return false;
  if (Date.now() - job.at > MAX_AGE_MS) return false;
  return true;
}

export function savePendingEarnDeposit(
  job: Omit<PendingEarnDeposit, "at"> & { at?: number }
): PendingEarnDeposit {
  const next: PendingEarnDeposit = {
    algorandAddress: job.algorandAddress.trim(),
    evmAddress: job.evmAddress?.trim() || undefined,
    wantedAmount: job.wantedAmount,
    fromBaseAmount: job.fromBaseAmount,
    expectedToAmount: job.expectedToAmount,
    algoUsdcBefore: job.algoUsdcBefore,
    orderId: job.orderId?.trim() || undefined,
    fromTxId: job.fromTxId?.trim() || undefined,
    poolId: job.poolId?.trim() || undefined,
    assetConfigKey: job.assetConfigKey?.trim() || undefined,
    at: job.at ?? Date.now(),
  };
  getLocalStorage()?.setItem(PENDING_EARN_DEPOSIT_KEY, JSON.stringify(next));
  return next;
}

export function readPendingEarnDeposit(
  algorandAddress?: string | null
): PendingEarnDeposit | null {
  const raw = getLocalStorage()?.getItem(PENDING_EARN_DEPOSIT_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingEarnDeposit(parsed)) {
      clearPendingEarnDeposit();
      return null;
    }
    if (
      algorandAddress &&
      parsed.algorandAddress.toUpperCase() !== algorandAddress.trim().toUpperCase()
    ) {
      return null;
    }
    return parsed;
  } catch {
    clearPendingEarnDeposit();
    return null;
  }
}

export function patchPendingEarnDeposit(
  patch: Partial<Omit<PendingEarnDeposit, "at" | "algorandAddress">>
): PendingEarnDeposit | null {
  const current = readPendingEarnDeposit();
  if (!current) return null;
  return savePendingEarnDeposit({
    ...current,
    ...patch,
  });
}

export function clearPendingEarnDeposit(): void {
  getLocalStorage()?.removeItem(PENDING_EARN_DEPOSIT_KEY);
}

export function isPendingEarnFunded(
  job: PendingEarnDeposit,
  currentAlgoUsdc: number
): boolean {
  return isAlgoCreditArrived({
    current: currentAlgoUsdc,
    baseline: job.algoUsdcBefore,
    expectedToAmount: job.expectedToAmount,
  });
}

/** Supply the original request, capped by what is actually in the wallet. */
export function pendingEarnSupplyAmount(
  job: PendingEarnDeposit,
  currentAlgoUsdc: number
): number {
  if (!Number.isFinite(currentAlgoUsdc) || currentAlgoUsdc <= 0) return 0;
  return Math.min(job.wantedAmount, currentAlgoUsdc);
}

/** Same Earn request is already in flight — do not open a second Exodus order. */
export function pendingEarnBlocksNewSwap(
  job: PendingEarnDeposit | null,
  wantedAmount: number
): boolean {
  if (!job) return false;
  if (!job.fromTxId && !job.orderId) return false;
  if (!Number.isFinite(wantedAmount) || wantedAmount <= 0) return true;
  return wantedAmount <= job.wantedAmount + 0.05;
}
