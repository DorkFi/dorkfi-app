/**
 * Resume Earn → account after redeem has paid Algorand USDC but the
 * Base swap never finished (tab close, swap error, delayed Exodus status).
 */
import { pendingEarnBlocksNewSwap } from "@/lib/easyStart/pendingEarnDeposit";
import { isBaseCreditArrived } from "@/lib/easyStart/xoSwap/settle";

export const PENDING_EARN_WITHDRAW_KEY = "simplfi.earn.pending_withdraw";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingEarnWithdraw = {
  algorandAddress: string;
  evmAddress?: string;
  /** Redeemed USDC that still needs to move Algorand → Base. */
  amount: number;
  /** Algorand USDC after redeem, before the XO send. */
  algoUsdcBefore: number;
  /** Base USDC before the XO send. Arrival is measured against this. */
  baseUsdcBefore?: number;
  expectedToAmount: number;
  orderId?: string;
  fromTxId?: string;
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

function isPendingEarnWithdraw(value: unknown): value is PendingEarnWithdraw {
  if (!value || typeof value !== "object") return false;
  const job = value as PendingEarnWithdraw;
  if (typeof job.algorandAddress !== "string" || !job.algorandAddress.trim()) {
    return false;
  }
  if (!Number.isFinite(job.amount) || job.amount <= 0) return false;
  if (!Number.isFinite(job.algoUsdcBefore) || job.algoUsdcBefore < 0) {
    return false;
  }
  if (
    job.baseUsdcBefore != null &&
    (!Number.isFinite(job.baseUsdcBefore) || job.baseUsdcBefore < 0)
  ) {
    return false;
  }
  if (!Number.isFinite(job.expectedToAmount) || job.expectedToAmount < 0) {
    return false;
  }
  if (typeof job.at !== "number" || !Number.isFinite(job.at)) return false;
  if (Date.now() - job.at > MAX_AGE_MS) return false;
  return true;
}

export function savePendingEarnWithdraw(
  job: Omit<PendingEarnWithdraw, "at"> & { at?: number }
): PendingEarnWithdraw {
  const next: PendingEarnWithdraw = {
    algorandAddress: job.algorandAddress.trim(),
    evmAddress: job.evmAddress?.trim() || undefined,
    amount: job.amount,
    algoUsdcBefore: job.algoUsdcBefore,
    baseUsdcBefore:
      typeof job.baseUsdcBefore === "number" &&
      Number.isFinite(job.baseUsdcBefore)
        ? job.baseUsdcBefore
        : undefined,
    expectedToAmount: job.expectedToAmount,
    orderId: job.orderId?.trim() || undefined,
    fromTxId: job.fromTxId?.trim() || undefined,
    at: job.at ?? Date.now(),
  };
  getLocalStorage()?.setItem(PENDING_EARN_WITHDRAW_KEY, JSON.stringify(next));
  return next;
}

export function readPendingEarnWithdraw(
  algorandAddress?: string | null
): PendingEarnWithdraw | null {
  const raw = getLocalStorage()?.getItem(PENDING_EARN_WITHDRAW_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingEarnWithdraw(parsed)) {
      clearPendingEarnWithdraw();
      return null;
    }
    if (
      algorandAddress &&
      parsed.algorandAddress.toUpperCase() !==
        algorandAddress.trim().toUpperCase()
    ) {
      return null;
    }
    return parsed;
  } catch {
    clearPendingEarnWithdraw();
    return null;
  }
}

export function patchPendingEarnWithdraw(
  patch: Partial<Omit<PendingEarnWithdraw, "at" | "algorandAddress">>
): PendingEarnWithdraw | null {
  const current = readPendingEarnWithdraw();
  if (!current) return null;
  return savePendingEarnWithdraw({
    ...current,
    ...patch,
  });
}

export function clearPendingEarnWithdraw(): void {
  getLocalStorage()?.removeItem(PENDING_EARN_WITHDRAW_KEY);
}

/**
 * Base USDC rose by the expected Exodus output.
 * Without a baseline, only an explicit swap success may clear the job.
 */
export function isPendingEarnWithdrawComplete(
  job: PendingEarnWithdraw,
  currentBaseUsdc: number
): boolean {
  if (typeof job.baseUsdcBefore !== "number") return false;
  return isBaseCreditArrived({
    current: currentBaseUsdc,
    baseline: job.baseUsdcBefore,
    expectedToAmount: job.expectedToAmount,
  });
}

/** Exodus order already opened for this redeem — do not send again. */
export function pendingWithdrawBlocksNewSwap(
  job: PendingEarnWithdraw | null,
  amount?: number
): boolean {
  if (!job) return false;
  return pendingEarnBlocksNewSwap(
    {
      wantedAmount: job.amount,
      fromTxId: job.fromTxId,
      orderId: job.orderId,
    },
    amount ?? job.amount
  );
}
