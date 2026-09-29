/**
 * Resume Deposit to Earn after Exodus has paid Algorand but the supply
 * step never ran (tab close, delayed order status, poll abort).
 *
 * localStorage is keyed by Algorand address and only lasts 7 days in this
 * browser. Cross-device resume is GET/PUT `/api/easy-start/pending-deposit`
 * (Privy JWT), merged into local on login.
 */
import { isAlgoCreditArrived } from "@/lib/easyStart/xoSwap/settle";

export const PENDING_EARN_DEPOSIT_KEY = "simplfi.earn.pending_deposit";
export const PENDING_EARN_DEPOSIT_EVENT = "simplfi.earn.pending_deposit";
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

function notifyPendingEarnDepositChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PENDING_EARN_DEPOSIT_EVENT));
}

export function parsePendingEarnDeposit(
  value: unknown,
  now = Date.now()
): PendingEarnDeposit | null {
  if (!isPendingEarnDeposit(value, now)) return null;
  return value;
}

function isPendingEarnDeposit(
  value: unknown,
  now = Date.now()
): value is PendingEarnDeposit {
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
  if (now - job.at > MAX_AGE_MS) return false;
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
  notifyPendingEarnDepositChanged();
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
      getLocalStorage()?.removeItem(PENDING_EARN_DEPOSIT_KEY);
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
    getLocalStorage()?.removeItem(PENDING_EARN_DEPOSIT_KEY);
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
  notifyPendingEarnDepositChanged();
}

export function subscribePendingEarnDeposit(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === PENDING_EARN_DEPOSIT_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener(PENDING_EARN_DEPOSIT_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PENDING_EARN_DEPOSIT_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function jobInFlight(job: PendingEarnDeposit): boolean {
  return Boolean(job.fromTxId || job.orderId);
}

/** Prefer an in-flight Exodus job, then the newer `at`. */
export function mergePendingEarnDeposits(
  local: PendingEarnDeposit | null,
  remote: PendingEarnDeposit | null
): PendingEarnDeposit | null {
  if (!local) return remote;
  if (!remote) return local;
  const localFlying = jobInFlight(local);
  const remoteFlying = jobInFlight(remote);
  if (localFlying !== remoteFlying) {
    return localFlying ? local : remote;
  }
  return local.at >= remote.at ? local : remote;
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

/** Enough to know an Exodus order was already opened. */
export type PendingSwapInFlight = {
  wantedAmount: number;
  fromTxId?: string;
  orderId?: string;
};

/** Same Earn request is already in flight — do not open a second Exodus order. */
export function pendingEarnBlocksNewSwap(
  job: PendingSwapInFlight | null,
  wantedAmount: number
): boolean {
  if (!job) return false;
  if (!job.fromTxId && !job.orderId) return false;
  if (!Number.isFinite(wantedAmount) || wantedAmount <= 0) return true;
  return wantedAmount <= job.wantedAmount + 0.05;
}
