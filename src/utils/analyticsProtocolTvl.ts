/**
 * Pure helpers for Analytics TVL: oracle-priced market USD, growth picking,
 * and chart overlays. Kept free of RPC so unit tests stay deterministic.
 */

export function pickFirstFiniteNumber(
  ...values: Array<number | undefined | null>
): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

/** API growth endpoints return `tvl`; some clients still read `value`. */
export function tvlFromGrowthDataPoint(point: {
  tvl?: number;
  value?: number;
}): number {
  return pickFirstFiniteNumber(point.tvl, point.value) ?? 0;
}

export interface AnalyticsMarketUsdQuote {
  decimals: number;
  usdPerToken: number;
}

export function analyticsMarketUsdKey(
  network?: string | null,
  marketId?: string | number | null
): string {
  return `${network ?? ""}|${marketId ?? ""}`;
}

export function usdValueForHumanAmount(
  humanAmount: string | number,
  usdPerToken: number
): number {
  const amount =
    typeof humanAmount === "string" ? parseFloat(humanAmount) : humanAmount;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(usdPerToken) ||
    usdPerToken <= 0
  ) {
    return 0;
  }
  return amount * usdPerToken;
}

export interface ProtocolUsdTotals {
  tvl: number;
  borrowed: number;
  marketCount: number;
}

export function sumProtocolUsdTotals(
  markets: Array<{
    totalDeposits: string;
    totalBorrows: string;
    usdPerToken: number;
  }>
): ProtocolUsdTotals {
  let tvl = 0;
  let borrowed = 0;
  let marketCount = 0;
  for (const market of markets) {
    const depositUsd = usdValueForHumanAmount(
      market.totalDeposits,
      market.usdPerToken
    );
    const borrowUsd = usdValueForHumanAmount(
      market.totalBorrows,
      market.usdPerToken
    );
    if (depositUsd > 0 || borrowUsd > 0) {
      marketCount += 1;
    }
    tvl += depositUsd;
    borrowed += borrowUsd;
  }
  return { tvl, borrowed, marketCount };
}

export function overlayLiveTvlOnSeries<T extends { total: number }>(
  points: T[],
  liveTvl: number
): T[] {
  if (points.length === 0 || !Number.isFinite(liveTvl) || liveTvl <= 0) {
    return points;
  }
  const last = points[points.length - 1];
  return [...points.slice(0, -1), { ...last, total: liveTvl }];
}

/**
 * Percent change from the series point ~lookbackDays ago to liveTvl.
 * Uses the latest series date as "now" so timezone/ISO date strings stay consistent.
 */
export function growthPercentFromSeries(
  points: Array<{ date: string; total: number }>,
  liveTvl: number,
  lookbackDays = 7
): number | undefined {
  if (points.length === 0 || !Number.isFinite(liveTvl) || liveTvl <= 0) {
    return undefined;
  }
  const lastMs = Date.parse(points[points.length - 1].date);
  if (!Number.isFinite(lastMs)) return undefined;
  const targetMs = lastMs - lookbackDays * 24 * 60 * 60 * 1000;

  let prior: { date: string; total: number } | undefined;
  for (const point of points) {
    const ms = Date.parse(point.date);
    if (!Number.isFinite(ms) || ms > targetMs) continue;
    if (!prior || Date.parse(prior.date) <= ms) {
      prior = point;
    }
  }
  if (!prior || !(prior.total > 0)) return undefined;
  return ((liveTvl - prior.total) / prior.total) * 100;
}
