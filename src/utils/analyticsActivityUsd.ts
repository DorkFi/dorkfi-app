import {
  analyticsMarketUsdKey,
  usdValueForHumanAmount,
  type AnalyticsMarketUsdQuote,
} from "@/utils/analyticsProtocolTvl";

/** Protocol activity USD integers (deposits / borrows / repays). */
export const ANALYTICS_USD_12_DECIMALS = 1e12;
/** Marker: *ValueUSD is token base units, not 12-decimal USD. */
export const ANALYTICS_USD_UNSCALED = 1;
/**
 * If valueUsd / amount is at least this, the indexer stored amount × 1e6
 * (12-decimal USD). Live withdrawals are ~1.
 */
export const ANALYTICS_SCALED_USD_RATIO_THRESHOLD = 1e5;

export type AnalyticsUsdScale =
  | typeof ANALYTICS_USD_UNSCALED
  | typeof ANALYTICS_USD_12_DECIMALS;

export function toFiniteNumber(
  value: string | number | undefined | null
): number {
  if (value === undefined || value === null || value === "") return NaN;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Detect whether an analytics *ValueUSD integer is 12-decimal protocol USD
 * or unscaled token base units (live withdrawals).
 */
export function detectAnalyticsUsdScale(
  valueUsd: string | number | undefined | null,
  amount?: string | number | null
): AnalyticsUsdScale {
  const value = toFiniteNumber(valueUsd);
  const amt = toFiniteNumber(amount ?? undefined);
  if (Number.isFinite(value) && Number.isFinite(amt) && amt > 0) {
    return Math.abs(value / amt) >= ANALYTICS_SCALED_USD_RATIO_THRESHOLD
      ? ANALYTICS_USD_12_DECIMALS
      : ANALYTICS_USD_UNSCALED;
  }
  return ANALYTICS_USD_12_DECIMALS;
}

/**
 * Convert a 12-decimal analytics *ValueUSD integer to human USD.
 * Unscaled rows (legacy withdrawals) return 0 — use {@link activityRowToUsd}.
 */
export function analyticsValueToUsd(
  valueUsd: string | number | undefined | null,
  amount?: string | number | null
): number {
  const value = toFiniteNumber(valueUsd);
  if (!Number.isFinite(value) || value === 0) return 0;
  if (detectAnalyticsUsdScale(valueUsd, amount) !== ANALYTICS_USD_12_DECIMALS) {
    return 0;
  }
  return value / ANALYTICS_USD_12_DECIMALS;
}

/** Token base units × oracle USD/token. */
export function unscaledBaseAmountToUsd(
  amount: string | number | undefined | null,
  decimals: number,
  usdPerToken: number
): number {
  const raw = toFiniteNumber(amount);
  if (!(raw > 0) || !Number.isFinite(decimals) || decimals < 0) return 0;
  const human = raw / 10 ** decimals;
  return usdValueForHumanAmount(human, usdPerToken);
}

export function activityRowToUsd(
  row: {
    amount?: string | number;
    valueUsd?: string | number;
    network?: string;
    marketId?: string | number;
  },
  lookup: Map<string, AnalyticsMarketUsdQuote>
): number {
  const scale = detectAnalyticsUsdScale(row.valueUsd, row.amount);
  if (scale === ANALYTICS_USD_12_DECIMALS) {
    return analyticsValueToUsd(row.valueUsd, row.amount);
  }
  const quote = lookup.get(
    analyticsMarketUsdKey(row.network, row.marketId)
  );
  if (!quote || !(quote.usdPerToken > 0)) return 0;
  return unscaledBaseAmountToUsd(
    row.amount ?? row.valueUsd,
    quote.decimals,
    quote.usdPerToken
  );
}

export function pickWithdrawValueUsd(row: {
  withdrawValueUSD?: string | number;
  withdrawalValueUSD?: string | number;
}): string | number | undefined {
  return row.withdrawValueUSD ?? row.withdrawalValueUSD;
}

/** Apply the scale inferred from sample rows to a summary total. */
export function analyticsSummaryToUsd(
  summaryValue: string | number | undefined | null,
  sampleRows: Array<{
    valueUsd?: string | number | null;
    amount?: string | number | null;
  }>
): number {
  const value = toFiniteNumber(summaryValue);
  if (!Number.isFinite(value) || value === 0) return 0;

  let scale: AnalyticsUsdScale = ANALYTICS_USD_12_DECIMALS;
  for (const row of sampleRows) {
    if (row.valueUsd == null || row.amount == null) continue;
    const amt = toFiniteNumber(row.amount);
    if (!(amt > 0)) continue;
    scale = detectAnalyticsUsdScale(row.valueUsd, row.amount);
    break;
  }
  if (scale !== ANALYTICS_USD_12_DECIMALS) return 0;
  return value / ANALYTICS_USD_12_DECIMALS;
}
