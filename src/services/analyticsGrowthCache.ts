/**
 * Shared 90d growth series cache for TVL / WAD Analytics charts.
 */

import { dorkfiAPIService } from "@/services/dorkfiAPIService";
import {
  fetchLiveProtocolSnapshot,
  peekLiveProtocolSnapshot,
} from "@/services/analyticsLiveSnapshot";
import {
  fetchOracleBasedProtocolTotals,
  peekCachedOracleProtocolTotals,
} from "@/services/analyticsProtocolTvl";
import {
  overlayLiveTvlOnSeries,
  tvlFromGrowthDataPoint,
} from "@/utils/analyticsProtocolTvl";
import {
  ANALYTICS_DAY_MS,
  ANALYTICS_MAX_LOOKBACK_DAYS,
  sliceDailySeriesByPeriod,
  type AnalyticsTimePeriod,
} from "@/utils/analyticsTimePeriod";

export interface TvlGrowthPoint {
  date: string;
  total: number;
  weth: number;
  usdc: number;
  usdt: number;
  wbtc: number;
}

export interface WadGrowthPoint {
  date: string;
  supply: number;
}

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  points: T[];
  fetchedAt: number;
};

let tvlCache: CacheEntry<TvlGrowthPoint> | null = null;
let wadCache: CacheEntry<WadGrowthPoint> | null = null;
let tvlInFlight: Promise<TvlGrowthPoint[]> | null = null;
let wadInFlight: Promise<WadGrowthPoint[]> | null = null;

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function lookbackWindow(now = Date.now()): { startTime: number; endTime: number } {
  return {
    startTime: now - ANALYTICS_MAX_LOOKBACK_DAYS * ANALYTICS_DAY_MS,
    endTime: now,
  };
}

async function loadTvlGrowth(): Promise<TvlGrowthPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const livePeek = peekLiveProtocolSnapshot();
  const oraclePeek = peekCachedOracleProtocolTotals();
  const [response, live] = await Promise.all([
    dorkfiAPIService.getTVLGrowth(startTime, endTime, "day"),
    livePeek
      ? Promise.resolve(livePeek)
      : fetchLiveProtocolSnapshot().catch(() => null),
  ]);

  if (!response.success || !response.data?.dataPoints?.length) {
    return [];
  }

  let transformed: TvlGrowthPoint[] = response.data.dataPoints
    .map((point: { tvl?: number; value?: number; timestamp: number }) => {
      const tvlValue = tvlFromGrowthDataPoint(point);
      return {
        date: new Date(point.timestamp).toISOString().split("T")[0],
        total: tvlValue,
        weth: tvlValue * 0.35,
        usdc: tvlValue * 0.28,
        usdt: tvlValue * 0.22,
        wbtc: tvlValue * 0.15,
      };
    })
    .filter((point) => point.total >= 0);

  const overlayTvl = oraclePeek?.tvl ?? live?.tvl;
  if (overlayTvl) {
    transformed = overlayLiveTvlOnSeries(transformed, overlayTvl);
  }

  if (!oraclePeek?.tvl) {
    void fetchOracleBasedProtocolTotals()
      .then((oracleTotals) => {
        if (!oracleTotals?.tvl || !tvlCache) return;
        tvlCache = {
          points: overlayLiveTvlOnSeries(tvlCache.points, oracleTotals.tvl),
          fetchedAt: tvlCache.fetchedAt,
        };
      })
      .catch((error) => {
        console.warn("[analyticsGrowthCache] oracle overlay failed", error);
      });
  }

  return transformed;
}

async function loadWadGrowth(): Promise<WadGrowthPoint[]> {
  const { startTime, endTime } = lookbackWindow();
  const response = await dorkfiAPIService.getWADSupplyGrowth(
    startTime,
    endTime,
    "day"
  );

  if (!response.success || !response.data?.dataPoints?.length) {
    return [];
  }

  return response.data.dataPoints
    .map((point: { supply?: string | number; value?: string | number; timestamp: number }) => {
      const rawValue = parseFloat(String(point.supply ?? point.value ?? "0"));
      return {
        date: new Date(point.timestamp).toISOString().split("T")[0],
        supply: rawValue / 1e6,
      };
    })
    .filter((point) => point.supply >= 0);
}

export async function fetchTvlGrowthDailySeries(): Promise<TvlGrowthPoint[]> {
  if (tvlCache && isFresh(tvlCache.fetchedAt)) return tvlCache.points;
  if (tvlInFlight) return tvlInFlight;

  tvlInFlight = loadTvlGrowth()
    .then((points) => {
      tvlCache = { points, fetchedAt: Date.now() };
      return points;
    })
    .finally(() => {
      tvlInFlight = null;
    });

  return tvlInFlight;
}

export async function fetchTvlGrowthForPeriod(
  period: AnalyticsTimePeriod,
  now = Date.now()
): Promise<TvlGrowthPoint[]> {
  const series = await fetchTvlGrowthDailySeries();
  return sliceDailySeriesByPeriod(series, period, now);
}

export async function fetchWadGrowthDailySeries(): Promise<WadGrowthPoint[]> {
  if (wadCache && isFresh(wadCache.fetchedAt)) return wadCache.points;
  if (wadInFlight) return wadInFlight;

  wadInFlight = loadWadGrowth()
    .then((points) => {
      wadCache = { points, fetchedAt: Date.now() };
      return points;
    })
    .finally(() => {
      wadInFlight = null;
    });

  return wadInFlight;
}

export async function fetchWadGrowthForPeriod(
  period: AnalyticsTimePeriod,
  now = Date.now()
): Promise<WadGrowthPoint[]> {
  const series = await fetchWadGrowthDailySeries();
  return sliceDailySeriesByPeriod(series, period, now);
}

/** Apply oracle TVL overlay to the cached series (if present). */
export function overlayCachedTvlGrowth(liveTvl: number): TvlGrowthPoint[] | null {
  if (!tvlCache || !(liveTvl > 0)) return null;
  const points = overlayLiveTvlOnSeries(tvlCache.points, liveTvl);
  tvlCache = { points, fetchedAt: tvlCache.fetchedAt };
  return points;
}

export function __resetAnalyticsGrowthCacheForTests(): void {
  tvlCache = null;
  wadCache = null;
  tvlInFlight = null;
  wadInFlight = null;
}
