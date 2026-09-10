/**
 * Shared 90d activity series cache for Analytics charts.
 * Deposits / withdrawals / borrows / repays each fetch once; charts slice by period.
 */

import { dorkfiAPIService } from "@/services/dorkfiAPIService";
import {
  fetchOracleMarketUsdLookupForRefs,
} from "@/services/analyticsProtocolTvl";
import {
  activityRowToUsd,
  analyticsValueToUsd,
  pickWithdrawValueUsd,
} from "@/utils/analyticsActivityUsd";
import {
  aggregateEventsByDay,
  mergeDailyFlows,
  type FlowDataPoint,
} from "@/utils/analyticsActivityFlows";
import {
  ANALYTICS_DAY_MS,
  ANALYTICS_MAX_LOOKBACK_DAYS,
  sliceDailySeriesByPeriod,
  type AnalyticsTimePeriod,
} from "@/utils/analyticsTimePeriod";

export type AnalyticsActivityKind =
  | "deposits"
  | "withdrawals"
  | "borrows"
  | "repays";

export interface DailyUsdPoint {
  date: string;
  amount: number;
}

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  points: DailyUsdPoint[];
  fetchedAt: number;
};

const cache = new Map<AnalyticsActivityKind, CacheEntry>();
const inFlight = new Map<AnalyticsActivityKind, Promise<DailyUsdPoint[]>>();

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function lookbackWindow(now = Date.now()): { startTime: number; endTime: number } {
  return {
    startTime: now - ANALYTICS_MAX_LOOKBACK_DAYS * ANALYTICS_DAY_MS,
    endTime: now,
  };
}

function dailyRecordToPoints(daily: Record<string, number>): DailyUsdPoint[] {
  return Object.entries(daily)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadDeposits(): Promise<DailyUsdPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const response = await dorkfiAPIService.getDeposits(
    startTime,
    endTime,
    10000
  );
  if (!response.success || !response.data?.deposits?.length) return [];
  const daily = aggregateEventsByDay(response.data.deposits, (deposit) =>
    analyticsValueToUsd(deposit.depositValueUSD, deposit.amount)
  );
  return dailyRecordToPoints(daily);
}

async function loadWithdrawals(): Promise<DailyUsdPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const response = await dorkfiAPIService.getWithdrawals(
    startTime,
    endTime,
    10000
  );
  if (!response.success || !response.data?.withdrawals?.length) return [];

  const withdrawals = response.data.withdrawals;
  const marketUsdLookup = await fetchOracleMarketUsdLookupForRefs(
    withdrawals.map((withdrawal) => ({
      network: withdrawal.network,
      marketId: withdrawal.marketId,
      appId: withdrawal.appId,
    }))
  ).catch((error) => {
    console.warn(
      "[analyticsActivityCache] oracle market USD lookup failed",
      error
    );
    return new Map();
  });

  const daily = aggregateEventsByDay(withdrawals, (withdrawal) =>
    activityRowToUsd(
      {
        amount: withdrawal.amount,
        valueUsd: pickWithdrawValueUsd(withdrawal),
        network: withdrawal.network,
        marketId: withdrawal.marketId,
      },
      marketUsdLookup
    )
  );
  return dailyRecordToPoints(daily);
}

async function loadBorrows(): Promise<DailyUsdPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const response = await dorkfiAPIService.getBorrows(
    startTime,
    endTime,
    10000
  );
  if (!response.success || !response.data?.borrows?.length) return [];
  const daily = aggregateEventsByDay(response.data.borrows, (borrow) =>
    analyticsValueToUsd(borrow.borrowValueUSD, borrow.amount)
  );
  return dailyRecordToPoints(daily);
}

async function loadRepays(): Promise<DailyUsdPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const response = await dorkfiAPIService.getRepays(
    startTime,
    endTime,
    10000
  );
  if (!response.success || !response.data?.repays?.length) return [];
  const daily = aggregateEventsByDay(response.data.repays, (repay) =>
    analyticsValueToUsd(repay.repayValueUSD, repay.amount)
  );
  return dailyRecordToPoints(daily);
}

const LOADERS: Record<
  AnalyticsActivityKind,
  () => Promise<DailyUsdPoint[]>
> = {
  deposits: loadDeposits,
  withdrawals: loadWithdrawals,
  borrows: loadBorrows,
  repays: loadRepays,
};

/** Fetch (or reuse) the full 90d daily USD series for an activity kind. */
export async function fetchActivityDailySeries(
  kind: AnalyticsActivityKind
): Promise<DailyUsdPoint[]> {
  const existing = cache.get(kind);
  if (existing && isFresh(existing)) return existing.points;

  const pending = inFlight.get(kind);
  if (pending) return pending;

  const promise = LOADERS[kind]()
    .then((points) => {
      cache.set(kind, { points, fetchedAt: Date.now() });
      return points;
    })
    .finally(() => {
      inFlight.delete(kind);
    });

  inFlight.set(kind, promise);
  return promise;
}

export async function fetchActivitySeriesForPeriod(
  kind: AnalyticsActivityKind,
  period: AnalyticsTimePeriod,
  now = Date.now()
): Promise<DailyUsdPoint[]> {
  const series = await fetchActivityDailySeries(kind);
  return sliceDailySeriesByPeriod(series, period, now);
}

export async function fetchLiquidityFlowSeries(
  period: AnalyticsTimePeriod,
  now = Date.now()
): Promise<FlowDataPoint[]> {
  const [deposits, withdrawals] = await Promise.all([
    fetchActivityDailySeries("deposits"),
    fetchActivityDailySeries("withdrawals"),
  ]);
  const inflowByDay: Record<string, number> = {};
  const outflowByDay: Record<string, number> = {};
  for (const point of deposits) inflowByDay[point.date] = point.amount;
  for (const point of withdrawals) outflowByDay[point.date] = point.amount;
  return sliceDailySeriesByPeriod(
    mergeDailyFlows(inflowByDay, outflowByDay),
    period,
    now
  );
}

export async function fetchLoansFlowSeries(
  period: AnalyticsTimePeriod,
  now = Date.now()
): Promise<FlowDataPoint[]> {
  const [borrows, repays] = await Promise.all([
    fetchActivityDailySeries("borrows"),
    fetchActivityDailySeries("repays"),
  ]);
  const inflowByDay: Record<string, number> = {};
  const outflowByDay: Record<string, number> = {};
  for (const point of borrows) inflowByDay[point.date] = point.amount;
  for (const point of repays) outflowByDay[point.date] = point.amount;
  return sliceDailySeriesByPeriod(
    mergeDailyFlows(inflowByDay, outflowByDay),
    period,
    now
  );
}

/** Test helper — clears memory cache / in-flight map. */
export function __resetAnalyticsActivityCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
