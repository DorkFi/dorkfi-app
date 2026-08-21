import { useState, useEffect, useRef } from "react";
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
  growthPercentFromSeries,
  overlayLiveTvlOnSeries,
  pickFirstFiniteNumber,
  tvlFromGrowthDataPoint,
} from "@/utils/analyticsProtocolTvl";

export interface KPIData {
  tvl: number;
  totalBorrowed: number;
  wadCirculation: number;
  protocolRevenue: number;
  activeWallets: number;
  tvlGrowth7d?: number;
  borrowedGrowth7d?: number;
  wadGrowth7d?: number;
  walletsGrowth7d?: number;
}

interface TvlSeriesPoint {
  date: string;
  total: number;
}

/**
 * Paint TVL/borrowed ASAP from session oracle cache or analytics API, then
 * refine to Markets-accurate oracle totals without blocking first paint.
 */
export const useAnalyticsData = () => {
  const cachedOracle = peekCachedOracleProtocolTotals();
  const cachedLive = peekLiveProtocolSnapshot();
  const initial =
    cachedOracle ??
    (cachedLive
      ? {
          tvl: cachedLive.tvl,
          borrowed: cachedLive.borrowed,
          marketCount: 0,
          fetchedAt: cachedLive.fetchedAt,
        }
      : null);

  const [kpiData, setKpiData] = useState<KPIData | null>(() => {
    if (!initial) return null;
    return {
      tvl: initial.tvl,
      totalBorrowed: initial.borrowed,
      wadCirculation: 0,
      protocolRevenue: 0,
      activeWallets: 0,
    };
  });
  const [kpiLoading, setKpiLoading] = useState(() => !initial);
  const [oracleRefining, setOracleRefining] = useState(false);
  const tvlSeriesRef = useRef<TvlSeriesPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const applyOracleTotals = (totals: {
      tvl: number;
      borrowed: number;
    }) => {
      const series = tvlSeriesRef.current;
      const overlaid = overlayLiveTvlOnSeries(series, totals.tvl);
      tvlSeriesRef.current = overlaid;

      setKpiData((prev) => {
        if (!prev) {
          return {
            tvl: totals.tvl,
            totalBorrowed: totals.borrowed,
            wadCirculation: 0,
            protocolRevenue: 0,
            activeWallets: 0,
            tvlGrowth7d: growthPercentFromSeries(overlaid, totals.tvl, 7),
          };
        }
        return {
          ...prev,
          tvl: totals.tvl,
          totalBorrowed: totals.borrowed,
          tvlGrowth7d: pickFirstFiniteNumber(
            growthPercentFromSeries(overlaid, totals.tvl, 7),
            prev.tvlGrowth7d
          ),
        };
      });
    };

    const loadFastKpis = async () => {
      const hadCache = Boolean(peekCachedOracleProtocolTotals() || peekLiveProtocolSnapshot());
      if (!hadCache) setKpiLoading(true);

      try {
        // Prefer warm oracle session cache; otherwise paint analytics API quickly.
        const warmOracle = peekCachedOracleProtocolTotals();
        if (warmOracle) {
          applyOracleTotals(warmOracle);
          setKpiLoading(false);
        } else {
          const live = await fetchLiveProtocolSnapshot();
          if (cancelled) return;
          setKpiData((prev) => ({
            tvl: live?.tvl ?? prev?.tvl ?? 0,
            totalBorrowed: live?.borrowed ?? prev?.totalBorrowed ?? 0,
            wadCirculation: prev?.wadCirculation ?? 0,
            protocolRevenue: 0,
            activeWallets: prev?.activeWallets ?? 0,
            tvlGrowth7d: prev?.tvlGrowth7d,
            borrowedGrowth7d: prev?.borrowedGrowth7d,
            wadGrowth7d: prev?.wadGrowth7d,
            walletsGrowth7d: prev?.walletsGrowth7d,
          }));
          setKpiLoading(false);
        }

        const now = Date.now();
        const startTime30d = now - 30 * 24 * 60 * 60 * 1000;

        const [
          tvlGrowthResponse,
          borrowedGrowthResponse,
          wadResponse,
          wadGrowthResponse,
          walletsResponse,
          walletsGrowthResponse,
        ] = await Promise.allSettled([
          dorkfiAPIService.getTVLGrowth(startTime30d, now, "day"),
          dorkfiAPIService.getBorrowedGrowth(),
          dorkfiAPIService.getWADCirculation(),
          dorkfiAPIService.getWADSupplyGrowth(startTime30d, now, "day"),
          dorkfiAPIService.getActiveWallets(),
          dorkfiAPIService.getActiveWalletsGrowth(),
        ]);
        if (cancelled) return;

        let transformedTvlSeries: TvlSeriesPoint[] = [];
        if (
          tvlGrowthResponse.status === "fulfilled" &&
          tvlGrowthResponse.value.success
        ) {
          const dataPoints = tvlGrowthResponse.value.data?.dataPoints || [];
          transformedTvlSeries = dataPoints.map((point) => {
            const tvlValue = tvlFromGrowthDataPoint(
              point as { tvl?: number; value?: number }
            );
            return {
              date: new Date(point.timestamp).toISOString().split("T")[0],
              total: tvlValue,
            };
          });
        }

        const seedTvl =
          peekCachedOracleProtocolTotals()?.tvl ??
          peekLiveProtocolSnapshot()?.tvl;
        if (seedTvl) {
          transformedTvlSeries = overlayLiveTvlOnSeries(
            transformedTvlSeries,
            seedTvl
          );
        }
        tvlSeriesRef.current = transformedTvlSeries;

        const apiTvlGrowth7d =
          tvlGrowthResponse.status === "fulfilled" &&
          tvlGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                tvlGrowthResponse.value.data?.growth7d,
                tvlGrowthResponse.value.data?.growth24h
              )
            : undefined;

        const tvlGrowth7d = seedTvl
          ? pickFirstFiniteNumber(
              growthPercentFromSeries(transformedTvlSeries, seedTvl, 7),
              apiTvlGrowth7d
            )
          : apiTvlGrowth7d;

        const wadCirculation =
          wadResponse.status === "fulfilled" && wadResponse.value.success
            ? parseFloat(wadResponse.value.data?.totalWadCirculation || "0") /
              1e6
            : 0;
        const activeWallets =
          walletsResponse.status === "fulfilled" &&
          walletsResponse.value.success
            ? walletsResponse.value.data?.totalActiveWallets || 0
            : 0;

        const borrowedGrowth7d =
          borrowedGrowthResponse.status === "fulfilled" &&
          borrowedGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                borrowedGrowthResponse.value.data?.growth7d,
                borrowedGrowthResponse.value.data?.growth24h
              )
            : undefined;
        const wadGrowth7d =
          wadGrowthResponse.status === "fulfilled" &&
          wadGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                wadGrowthResponse.value.data?.growth7d,
                wadGrowthResponse.value.data?.growth24h
              )
            : undefined;
        const walletsGrowth7d =
          walletsGrowthResponse.status === "fulfilled" &&
          walletsGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                walletsGrowthResponse.value.data?.growth7d,
                walletsGrowthResponse.value.data?.growth24h
              )
            : undefined;

        setKpiData((prev) =>
          prev
            ? {
                ...prev,
                wadCirculation,
                activeWallets,
                tvlGrowth7d,
                borrowedGrowth7d,
                wadGrowth7d,
                walletsGrowth7d,
              }
            : prev
        );

        // Markets-accurate oracle refine (amounts × live oracle USD).
        const freshOracle = peekCachedOracleProtocolTotals();
        if (freshOracle && Date.now() - freshOracle.fetchedAt < 5_000) {
          applyOracleTotals(freshOracle);
          return;
        }

        setOracleRefining(true);
        fetchOracleBasedProtocolTotals()
          .then((oracleTotals) => {
            if (cancelled || !oracleTotals) return;
            applyOracleTotals(oracleTotals);
          })
          .catch((error) => {
            console.warn("[useAnalyticsData] oracle TVL refine failed", error);
          })
          .finally(() => {
            if (!cancelled) setOracleRefining(false);
          });
      } catch (error) {
        console.error("Error loading analytics KPIs:", error);
        if (!cancelled) {
          setKpiData({
            tvl: 0,
            totalBorrowed: 0,
            wadCirculation: 0,
            protocolRevenue: 0,
            activeWallets: 0,
          });
          setKpiLoading(false);
          setOracleRefining(false);
        }
      }
    };

    loadFastKpis();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    kpiData,
    loading: kpiLoading,
    kpiLoading,
    oracleRefining,
  };
};
