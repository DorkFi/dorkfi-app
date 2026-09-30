import { CASH_OUT_MIN_USD } from "@/lib/easyStart/cashOutBuckets";

export type CashOutSource = "base" | "earn" | "algorand";
export type CashOutDestination = "coinbase" | "account";

export type CashOutSourceOption = {
  source: CashOutSource;
  usd: number;
};

export type CashOutLaunch = {
  source?: CashOutSource;
  amount?: string;
};

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function cashOutSourceOptions(input: {
  baseUsd: number;
  earnUsd: number;
  algorandUsd: number;
}): CashOutSourceOption[] {
  const rows: CashOutSourceOption[] = [
    { source: "base", usd: nonNegative(input.baseUsd) },
    { source: "earn", usd: nonNegative(input.earnUsd) },
    { source: "algorand", usd: nonNegative(input.algorandUsd) },
  ];
  return rows.filter((row) => row.usd > CASH_OUT_MIN_USD);
}

/** Base when it can be sent now. Otherwise Earn, then leftover Algorand USDC. */
export function defaultCashOutSource(
  options: CashOutSourceOption[],
  preferred?: CashOutSource | null
): CashOutSource | null {
  if (preferred && options.some((row) => row.source === preferred)) {
    return preferred;
  }
  if (options.some((row) => row.source === "base")) return "base";
  if (options.some((row) => row.source === "earn")) return "earn";
  if (options.some((row) => row.source === "algorand")) return "algorand";
  return null;
}

/**
 * Borrow success can open cash-out before the Algorand balance query refreshes.
 * Keep the requested source visible using the amount they just received.
 */
export function cashOutSourcesWithLaunch(
  options: CashOutSourceOption[],
  launch?: CashOutLaunch | null
): CashOutSourceOption[] {
  if (!launch?.source) return options;
  if (options.some((row) => row.source === launch.source)) return options;
  const usd = Number(launch.amount);
  if (!Number.isFinite(usd) || usd <= CASH_OUT_MIN_USD) return options;
  return [...options, { source: launch.source, usd }];
}

export function cashOutSourceLabel(
  source: CashOutSource,
  consumerCopy: boolean
): string {
  if (source === "base") return consumerCopy ? "Ready to cash out" : "Base";
  if (source === "earn") return consumerCopy ? "Earn" : "Savings";
  return consumerCopy ? "Available to move" : "Algorand wallet";
}

export function cashOutNeedsMove(source: CashOutSource): boolean {
  return source !== "base";
}
