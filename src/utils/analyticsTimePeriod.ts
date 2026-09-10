export type AnalyticsTimePeriod = "7d" | "30d" | "90d";

/** Always fetch this window once; charts slice client-side for 7d/30d. */
export const ANALYTICS_MAX_LOOKBACK_DAYS = 90;

export const ANALYTICS_DAY_MS = 24 * 60 * 60 * 1000;

export function periodToDays(period: AnalyticsTimePeriod): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

export function periodStartMs(
  period: AnalyticsTimePeriod,
  now = Date.now()
): number {
  return now - periodToDays(period) * ANALYTICS_DAY_MS;
}

/**
 * Keep daily points whose UTC date is on/after the period start day.
 * Expects `date` as `YYYY-MM-DD`.
 */
export function sliceDailySeriesByPeriod<T extends { date: string }>(
  series: T[],
  period: AnalyticsTimePeriod,
  now = Date.now()
): T[] {
  if (period === "90d") return series;
  const startDate = new Date(periodStartMs(period, now))
    .toISOString()
    .split("T")[0];
  return series.filter((point) => point.date >= startDate);
}

export function sumDailyAmounts(
  series: Array<{ amount: number }>
): number {
  return series.reduce((sum, point) => sum + point.amount, 0);
}
