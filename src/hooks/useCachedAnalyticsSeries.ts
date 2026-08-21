import { useEffect, useRef, useState } from "react";
import {
  fetchActivitySeriesForPeriod,
  fetchLiquidityFlowSeries,
  fetchLoansFlowSeries,
  type AnalyticsActivityKind,
  type DailyUsdPoint,
} from "@/services/analyticsActivityCache";
import {
  fetchTvlGrowthForPeriod,
  fetchWadGrowthForPeriod,
  overlayCachedTvlGrowth,
  type TvlGrowthPoint,
  type WadGrowthPoint,
} from "@/services/analyticsGrowthCache";
import {
  fetchOracleBasedProtocolTotals,
  peekCachedOracleProtocolTotals,
} from "@/services/analyticsProtocolTvl";
import {
  sliceDailySeriesByPeriod,
  sumDailyAmounts,
  type AnalyticsTimePeriod,
} from "@/utils/analyticsTimePeriod";
import type { FlowDataPoint } from "@/utils/analyticsActivityFlows";

/**
 * Shared activity daily series. Shows loading only on the first unresolved fetch;
 * period switches reuse the cached 90d window without blanking the chart.
 */
export function useActivityDailySeries(
  kind: AnalyticsActivityKind,
  period: AnalyticsTimePeriod
) {
  const [series, setSeries] = useState<DailyUsdPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (!hasDataRef.current) setLoading(true);

    fetchActivitySeriesForPeriod(kind, period)
      .then((points) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setSeries(points);
      })
      .catch((error) => {
        console.error(`[useActivityDailySeries] ${kind} failed`, error);
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, period]);

  return {
    series,
    loading,
    total: sumDailyAmounts(series),
  };
}

export function useFlowSeries(
  mode: "liquidity" | "loans",
  period: AnalyticsTimePeriod
) {
  const [series, setSeries] = useState<FlowDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasDataRef.current) setLoading(true);

    const fetchSeries =
      mode === "liquidity" ? fetchLiquidityFlowSeries : fetchLoansFlowSeries;

    fetchSeries(period)
      .then((points) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setSeries(points);
      })
      .catch((error) => {
        console.error(`[useFlowSeries] ${mode} failed`, error);
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, period]);

  return { series, loading };
}

export function useLiquidityFlowSeries(period: AnalyticsTimePeriod) {
  return useFlowSeries("liquidity", period);
}

export function useLoansFlowSeries(period: AnalyticsTimePeriod) {
  return useFlowSeries("loans", period);
}

export function useTvlGrowthSeries(period: AnalyticsTimePeriod) {
  const [series, setSeries] = useState<TvlGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasDataRef.current) setLoading(true);

    fetchTvlGrowthForPeriod(period)
      .then(async (points) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setSeries(points);

        try {
          const cached = peekCachedOracleProtocolTotals();
          if (cached?.tvl) {
            const overlaid = overlayCachedTvlGrowth(cached.tvl);
            if (overlaid && !cancelled) {
              setSeries(sliceDailySeriesByPeriod(overlaid, period));
            }
            return;
          }

          const oracleTotals = await fetchOracleBasedProtocolTotals();
          if (cancelled || !oracleTotals?.tvl) return;
          const overlaid = overlayCachedTvlGrowth(oracleTotals.tvl);
          if (overlaid) {
            setSeries(sliceDailySeriesByPeriod(overlaid, period));
          }
        } catch (error) {
          console.warn("[useTvlGrowthSeries] oracle overlay failed", error);
        }
      })
      .catch((error) => {
        console.error("[useTvlGrowthSeries] failed", error);
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  return { series, loading };
}

export function useWadGrowthSeries(period: AnalyticsTimePeriod) {
  const [series, setSeries] = useState<WadGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasDataRef.current) setLoading(true);

    fetchWadGrowthForPeriod(period)
      .then((points) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setSeries(points);
      })
      .catch((error) => {
        console.error("[useWadGrowthSeries] failed", error);
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  return { series, loading };
}
