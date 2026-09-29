/**
 * Resume a Coinbase bank deposit after the Add money sheet closes.
 * ACH can land on Base minutes or days later; the watch has to outlive the dialog.
 */

export const PENDING_BANK_DEPOSIT_KEY = "simplfi.bank_deposit.pending";
/** Same credit floor the open sheet uses before it treats Base USDC as arrived. */
export const BANK_DEPOSIT_MIN_GAIN_USDC = 0.5;
/** Poll while the sheet is closed. Matches the in-sheet awaiting interval. */
export const BANK_DEPOSIT_POLL_MS = 4_000;
/** Bank ACH can sit pending across a weekend. */
export const BANK_DEPOSIT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type PendingBankDeposit = {
  address: string;
  amount: string;
  usdcBefore: number;
  partnerUserRef: string;
  method: "coinbase";
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

function addressesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isPendingBankDeposit(value: unknown, now: number): value is PendingBankDeposit {
  if (!value || typeof value !== "object") return false;
  const job = value as PendingBankDeposit;
  if (typeof job.address !== "string" || !job.address.trim()) return false;
  if (typeof job.amount !== "string" || !job.amount.trim()) return false;
  if (!Number.isFinite(job.usdcBefore) || job.usdcBefore < 0) return false;
  if (typeof job.partnerUserRef !== "string" || !job.partnerUserRef.trim()) {
    return false;
  }
  if (job.method !== "coinbase") return false;
  if (typeof job.at !== "number" || !Number.isFinite(job.at)) return false;
  if (now - job.at > BANK_DEPOSIT_MAX_AGE_MS) return false;
  return true;
}

export function savePendingBankDeposit(
  job: Omit<PendingBankDeposit, "at" | "method"> & {
    at?: number;
    method?: "coinbase";
  }
): PendingBankDeposit {
  const next: PendingBankDeposit = {
    address: job.address.trim(),
    amount: job.amount.trim(),
    usdcBefore: job.usdcBefore,
    partnerUserRef: job.partnerUserRef.trim() || "pending",
    method: "coinbase",
    at: job.at ?? Date.now(),
  };
  try {
    getLocalStorage()?.setItem(PENDING_BANK_DEPOSIT_KEY, JSON.stringify(next));
  } catch {
    // Private mode can reject writes. The open sheet can still watch this session.
  }
  return next;
}

export function readPendingBankDeposit(
  address?: string | null
): PendingBankDeposit | null {
  const raw = getLocalStorage()?.getItem(PENDING_BANK_DEPOSIT_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingBankDeposit(parsed, Date.now())) {
      clearPendingBankDeposit();
      return null;
    }
    if (address && !addressesMatch(parsed.address, address)) return null;
    return parsed;
  } catch {
    clearPendingBankDeposit();
    return null;
  }
}

export function clearPendingBankDeposit(): void {
  getLocalStorage()?.removeItem(PENDING_BANK_DEPOSIT_KEY);
}

/**
 * Keep the baseline from the checkout that opened, so a later "Reopen bank
 * deposit" does not move the line after funds have already landed.
 */
export function bankDepositBaseline(args: {
  existing: PendingBankDeposit | null;
  currentUsdc: number;
}): number {
  if (args.existing) return args.existing.usdcBefore;
  return Number.isFinite(args.currentUsdc) && args.currentUsdc > 0
    ? args.currentUsdc
    : 0;
}

export function bankDepositHasArrived(
  job: PendingBankDeposit,
  currentUsdc: number
): boolean {
  if (!Number.isFinite(currentUsdc)) return false;
  return currentUsdc - job.usdcBefore >= BANK_DEPOSIT_MIN_GAIN_USDC;
}

/** Open Add money again only after a closed sheet's watch sees the credit. */
export function shouldPromptBankDepositArrival(args: {
  job: PendingBankDeposit | null;
  sheetOpen: boolean;
  currentUsdc: number;
  alreadyPromptedAt: number | null;
}): boolean {
  if (args.sheetOpen || !args.job) return false;
  if (args.alreadyPromptedAt === args.job.at) return false;
  return bankDepositHasArrived(args.job, args.currentUsdc);
}
