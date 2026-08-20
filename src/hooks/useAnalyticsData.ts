import { useState, useEffect, useRef } from 'react';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import {
  fetchAnalyticsMarketUsdLookup,
  fetchOracleBasedProtocolTotals,
  peekCachedOracleProtocolTotals,
} from '@/services/analyticsProtocolTvl';
import { buildHealthFactorDistribution } from '@/utils/analyticsHealthFactorDistribution';
import {
  growthPercentFromSeries,
  overlayLiveTvlOnSeries,
  pickFirstFiniteNumber,
  tvlFromGrowthDataPoint,
} from '@/utils/analyticsProtocolTvl';
import {
  activityRowToUsd,
  analyticsValueToUsd,
  pickWithdrawValueUsd,
} from '@/utils/analyticsActivityUsd';

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

export interface TVLData {
  date: string;
  total: number;
  weth: number;
  usdc: number;
  usdt: number;
  wbtc: number;
}

export interface UtilizationData {
  asset: string;
  supplied: number;
  borrowed: number;
  utilization: number;
}

export interface RevenueData {
  month: string;
  interest: number;
  liquidations: number;
  flashLoans: number;
}

export interface TreasuryData {
  holdings: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  growthData: Array<{
    date: string;
    value: number;
  }>;
}

export interface WADData {
  supplyData: Array<{
    date: string;
    supply: number;
  }>;
  collateralizationRatio: number;
  pegStability: Array<{
    date: string;
    price: number;
  }>;
}

export interface MAUData {
  month: string;
  lenders: number;
  borrowers: number;
  stakers: number;
}

export interface LoanData {
  volume: Array<{
    date: string;
    loans: number;
    repayments: number;
  }>;
  avgLoanSize: number;
}

export interface AssetDistribution {
  deposits: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  borrows: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export interface InterestRateData {
  date: string;
  wethSupply: number;
  wethBorrow: number;
  usdcSupply: number;
  usdcBorrow: number;
}

export interface HealthFactorData {
  range: string;
  count: number;
  color: string;
}

export interface LiquidationData {
  events: Array<{
    date: string;
    volume: number;
    count: number;
  }>;
  recovery: Array<{
    month: string;
    collateralRecovered: number;
    liquidatorBonuses: number;
  }>;
}

export interface DepositsData {
  date: string;
  amount: number;
}

export interface WithdrawalsData {
  date: string;
  amount: number;
}

const generateMockUtilizationData = (): UtilizationData[] => [
  { asset: 'WETH', supplied: 125_000_000, borrowed: 87_500_000, utilization: 70 },
  { asset: 'USDC', supplied: 68_000_000, borrowed: 40_800_000, utilization: 60 },
  { asset: 'USDT', supplied: 54_000_000, borrowed: 32_400_000, utilization: 60 },
  { asset: 'WBTC', supplied: 32_000_000, borrowed: 19_200_000, utilization: 60 },
];

const generateMockRevenueData = (): RevenueData[] => [
  { month: 'Oct', interest: 850_000, liquidations: 120_000, flashLoans: 45_000 },
  { month: 'Nov', interest: 920_000, liquidations: 156_000, flashLoans: 52_000 },
  { month: 'Dec', interest: 1_100_000, liquidations: 89_000, flashLoans: 61_000 },
  { month: 'Jan', interest: 1_350_000, liquidations: 234_000, flashLoans: 78_000 },
  { month: 'Feb', interest: 1_180_000, liquidations: 167_000, flashLoans: 69_000 },
  { month: 'Mar', interest: 1_450_000, liquidations: 198_000, flashLoans: 85_000 },
];

const generateMockTreasuryData = (): TreasuryData => ({
  holdings: [
    { name: 'WETH', value: 12_500_000, color: 'hsl(var(--ocean-teal))' },
    { name: 'USDC', value: 8_900_000, color: 'hsl(var(--whale-gold))' },
    { name: 'Protocol Tokens', value: 6_200_000, color: 'hsl(var(--highlight-aqua))' },
    { name: 'Other', value: 2_800_000, color: 'hsl(var(--muted))' },
  ],
  growthData: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    value: 25_000_000 + i * 150_000 + Math.random() * 1_000_000,
  })),
});

const generateMockWADData = (): WADData => ({
  supplyData: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    supply: 80_000_000 + i * 300_000 + Math.random() * 500_000,
  })),
  collateralizationRatio: 135.4,
  pegStability: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    price: 1.0 + (Math.random() - 0.5) * 0.02,
  })),
});

const generateMockMAUData = (): MAUData[] => [
  { month: 'Oct', lenders: 15_200, borrowers: 8_900, stakers: 12_300 },
  { month: 'Nov', lenders: 16_800, borrowers: 9_650, stakers: 13_100 },
  { month: 'Dec', lenders: 18_200, borrowers: 10_400, stakers: 14_200 },
  { month: 'Jan', lenders: 19_500, borrowers: 11_200, stakers: 15_800 },
  { month: 'Feb', lenders: 18_900, borrowers: 10_800, stakers: 15_200 },
  { month: 'Mar', lenders: 21_300, borrowers: 12_100, stakers: 16_900 },
];

const generateMockLoanData = (days: number = 30): LoanData => ({
  volume: Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    loans: 2_500_000 + Math.random() * 1_000_000,
    repayments: 2_200_000 + Math.random() * 800_000,
  })),
  avgLoanSize: 45_680,
});

const generateMockAssetDistribution = (): AssetDistribution => ({
  deposits: [
    { name: 'WETH', value: 125_000_000, color: 'hsl(var(--ocean-teal))' },
    { name: 'USDC', value: 68_000_000, color: 'hsl(var(--whale-gold))' },
    { name: 'USDT', value: 54_000_000, color: 'hsl(var(--highlight-aqua))' },
    { name: 'WBTC', value: 32_000_000, color: 'hsl(var(--accent))' },
  ],
  borrows: [
    { name: 'WETH', value: 87_500_000, color: 'hsl(var(--ocean-teal))' },
    { name: 'USDC', value: 40_800_000, color: 'hsl(var(--whale-gold))' },
    { name: 'USDT', value: 32_400_000, color: 'hsl(var(--highlight-aqua))' },
    { name: 'WBTC', value: 19_200_000, color: 'hsl(var(--accent))' },
  ],
});

const generateMockInterestRateData = (days: number = 30): InterestRateData[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    wethSupply: 3.2 + Math.random() * 0.8,
    wethBorrow: 5.5 + Math.random() * 1.2,
    usdcSupply: 2.1 + Math.random() * 0.6,
    usdcBorrow: 4.2 + Math.random() * 0.9,
  }));
};

const generateMockLiquidationData = (days: number = 30): LiquidationData => ({
  events: Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    volume: Math.random() * 2_000_000,
    count: Math.floor(Math.random() * 50) + 5,
  })),
  recovery: [
    { month: 'Oct', collateralRecovered: 8_900_000, liquidatorBonuses: 890_000 },
    { month: 'Nov', collateralRecovered: 12_300_000, liquidatorBonuses: 1_230_000 },
    { month: 'Dec', collateralRecovered: 6_700_000, liquidatorBonuses: 670_000 },
    { month: 'Jan', collateralRecovered: 15_600_000, liquidatorBonuses: 1_560_000 },
    { month: 'Feb', collateralRecovered: 11_200_000, liquidatorBonuses: 1_120_000 },
    { month: 'Mar', collateralRecovered: 13_800_000, liquidatorBonuses: 1_380_000 },
  ],
});

const generateMockDepositsData = (days: number = 30): DepositsData[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: 7_000_000 + Math.random() * 5_000_000 + Math.sin(i * 0.5) * 2_000_000,
  }));
};

const generateMockWithdrawalsData = (days: number = 30): WithdrawalsData[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: 5_000_000 + Math.random() * 5_000_000 + Math.cos(i * 0.5) * 2_000_000,
  }));
};

export const useAnalyticsData = () => {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [tvlData, setTvlData] = useState<TVLData[]>([]);
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null);
  const [wadData, setWadData] = useState<WADData | null>(null);
  const [mauData, setMauData] = useState<MAUData[]>([]);
  const [loanData, setLoanData] = useState<LoanData | null>(null);
  const [assetDistribution, setAssetDistribution] = useState<AssetDistribution | null>(null);
  const [interestRateData, setInterestRateData] = useState<InterestRateData[]>([]);
  const [healthFactorData, setHealthFactorData] = useState<HealthFactorData[]>([]);
  const [liquidationData, setLiquidationData] = useState<LiquidationData | null>(null);
  const [depositsData, setDepositsData] = useState<DepositsData[]>([]);
  const [withdrawalsData, setWithdrawalsData] = useState<WithdrawalsData[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [oracleRefining, setOracleRefining] = useState(false);
  const tvlSeriesRef = useRef<TVLData[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadFastKpis = async () => {
      setKpiLoading(true);
      
      try {
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        const startTime30d = now - days30;
        const cachedOracle = peekCachedOracleProtocolTotals();

        const [
          tvlResponse,
          tvlGrowthResponse,
          borrowedResponse,
          borrowedGrowthResponse,
          wadResponse,
          wadGrowthResponse,
          walletsResponse,
          walletsGrowthResponse,
        ] = await Promise.allSettled([
          dorkfiAPIService.getTVL(),
          dorkfiAPIService.getTVLGrowth(startTime30d, now, 'day'),
          dorkfiAPIService.getTotalBorrowed(),
          dorkfiAPIService.getBorrowedGrowth(),
          dorkfiAPIService.getWADCirculation(),
          dorkfiAPIService.getWADSupplyGrowth(startTime30d, now, 'day'),
          dorkfiAPIService.getActiveWallets(),
          dorkfiAPIService.getActiveWalletsGrowth(),
        ]);

        if (cancelled) return;

        const apiTvl =
          tvlResponse.status === 'fulfilled' && tvlResponse.value.success
            ? tvlResponse.value.data?.totalTVL || 0
            : 0;
        const apiBorrowed =
          borrowedResponse.status === 'fulfilled' && borrowedResponse.value.success
            ? borrowedResponse.value.data?.totalBorrowed || 0
            : 0;

        const wadCirculation =
          wadResponse.status === 'fulfilled' && wadResponse.value.success
            ? parseFloat(wadResponse.value.data?.totalWadCirculation || '0') / 1e6
            : 0;

        const activeWallets =
          walletsResponse.status === 'fulfilled' && walletsResponse.value.success
            ? walletsResponse.value.data?.totalActiveWallets || 0
            : 0;

        const apiTvlGrowth7d =
          tvlGrowthResponse.status === 'fulfilled' && tvlGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                tvlGrowthResponse.value.data?.growth7d,
                tvlGrowthResponse.value.data?.growth24h
              )
            : undefined;

        const borrowedGrowth7d =
          borrowedGrowthResponse.status === 'fulfilled' &&
          borrowedGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                borrowedGrowthResponse.value.data?.growth7d,
                borrowedGrowthResponse.value.data?.growth24h
              )
            : undefined;

        const wadGrowth7d =
          wadGrowthResponse.status === 'fulfilled' && wadGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                wadGrowthResponse.value.data?.growth7d,
                wadGrowthResponse.value.data?.growth24h
              )
            : undefined;

        const walletsGrowth7d =
          walletsGrowthResponse.status === 'fulfilled' &&
          walletsGrowthResponse.value.success
            ? pickFirstFiniteNumber(
                walletsGrowthResponse.value.data?.growth7d,
                walletsGrowthResponse.value.data?.growth24h
              )
            : undefined;

        let transformedTvlSeries: TVLData[] = [];
        if (
          tvlGrowthResponse.status === 'fulfilled' &&
          tvlGrowthResponse.value.success
        ) {
          const dataPoints = tvlGrowthResponse.value.data?.dataPoints || [];
          transformedTvlSeries = dataPoints.map((point) => {
            const tvlValue = tvlFromGrowthDataPoint(
              point as { tvl?: number; value?: number }
            );
            return {
              date: new Date(point.timestamp).toISOString().split('T')[0],
              total: tvlValue,
              weth: tvlValue * 0.35,
              usdc: tvlValue * 0.28,
              usdt: tvlValue * 0.22,
              wbtc: tvlValue * 0.15,
            };
          });
        }

        const initialTvl = cachedOracle?.tvl ?? apiTvl;
        const initialBorrowed = cachedOracle?.borrowed ?? apiBorrowed;

        if (cachedOracle?.tvl) {
          transformedTvlSeries = overlayLiveTvlOnSeries(
            transformedTvlSeries,
            cachedOracle.tvl
          );
        }

        tvlSeriesRef.current = transformedTvlSeries;
        setTvlData(transformedTvlSeries);

        const tvlGrowth7d = cachedOracle?.tvl
          ? pickFirstFiniteNumber(
              growthPercentFromSeries(transformedTvlSeries, cachedOracle.tvl, 7),
              apiTvlGrowth7d
            )
          : apiTvlGrowth7d;

        setKpiData({
          tvl: initialTvl,
          totalBorrowed: initialBorrowed,
          wadCirculation,
          protocolRevenue: 0,
          activeWallets,
          tvlGrowth7d,
          borrowedGrowth7d,
          wadGrowth7d,
          walletsGrowth7d,
        });
        setKpiLoading(false);

        if (cachedOracle) return;

        setOracleRefining(true);
        fetchOracleBasedProtocolTotals()
          .then((oracleTotals) => {
            if (cancelled || !oracleTotals) return;

            const series = tvlSeriesRef.current;
            const overlaid = overlayLiveTvlOnSeries(series, oracleTotals.tvl);
            tvlSeriesRef.current = overlaid;
            setTvlData(overlaid);

            setKpiData((prev) =>
              prev
                ? {
                    ...prev,
                    tvl: oracleTotals.tvl,
                    totalBorrowed: oracleTotals.borrowed,
                    tvlGrowth7d: pickFirstFiniteNumber(
                      growthPercentFromSeries(overlaid, oracleTotals.tvl, 7),
                      prev.tvlGrowth7d
                    ),
                  }
                : prev
            );
          })
          .catch((error) => {
            console.warn('[useAnalyticsData] oracle TVL refine failed', error);
          })
          .finally(() => {
            if (!cancelled) setOracleRefining(false);
          });
      } catch (error) {
        console.error('Error loading analytics KPIs:', error);
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

    const loadSecondaryData = async () => {
      try {
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        const startTime30d = now - days30;

        const [
          wadGrowthResponse,
          depositsResponse,
          withdrawalsResponse,
          healthFactorResponse,
          marketUsdLookupResult,
        ] = await Promise.allSettled([
          dorkfiAPIService.getWADSupplyGrowth(startTime30d, now, 'day'),
          dorkfiAPIService.getDeposits(startTime30d, now, 10000),
          dorkfiAPIService.getWithdrawals(startTime30d, now, 10000),
          dorkfiAPIService.getAllUserHealth(),
          fetchAnalyticsMarketUsdLookup(),
        ]);

        if (cancelled) return;

        if (
          wadGrowthResponse.status === 'fulfilled' &&
          wadGrowthResponse.value.success
        ) {
          const dataPoints = wadGrowthResponse.value.data?.dataPoints || [];
          if (dataPoints.length > 0) {
            const supplyData = dataPoints.map((point) => ({
              date: new Date(point.timestamp).toISOString().split('T')[0],
              supply: point.value / 1e6,
            }));

            setWadData({
              supplyData,
              collateralizationRatio: 135.4,
              pegStability: supplyData.map((d) => ({
                date: d.date,
                price: 1.0,
              })),
            });
          } else {
            setWadData(generateMockWADData());
          }
        } else {
          setWadData(generateMockWADData());
        }

        if (
          depositsResponse.status === 'fulfilled' &&
          depositsResponse.value.success
        ) {
          const deposits = depositsResponse.value.data?.deposits || [];
          if (deposits.length > 0) {
            const dailyDeposits: { [key: string]: number } = {};
            deposits.forEach((deposit) => {
              const date = new Date(deposit.timestamp).toISOString().split('T')[0];
              const value = analyticsValueToUsd(
                deposit.depositValueUSD,
                deposit.amount
              );
              dailyDeposits[date] = (dailyDeposits[date] || 0) + value;
            });
            setDepositsData(
              Object.entries(dailyDeposits)
                .map(([date, amount]) => ({ date, amount }))
                .sort((a, b) => a.date.localeCompare(b.date))
            );
          } else {
            setDepositsData(generateMockDepositsData());
          }
        } else {
          setDepositsData(generateMockDepositsData());
        }

        if (
          withdrawalsResponse.status === 'fulfilled' &&
          withdrawalsResponse.value.success
        ) {
          const withdrawals = withdrawalsResponse.value.data?.withdrawals || [];
          if (withdrawals.length > 0) {
            const marketUsdLookup =
              marketUsdLookupResult.status === 'fulfilled'
                ? marketUsdLookupResult.value
                : new Map();
            const dailyWithdrawals: { [key: string]: number } = {};
            withdrawals.forEach((withdrawal) => {
              const date = new Date(withdrawal.timestamp).toISOString().split('T')[0];
              const value = activityRowToUsd(
                {
                  amount: withdrawal.amount,
                  valueUsd: pickWithdrawValueUsd(withdrawal),
                  network: withdrawal.network,
                  marketId: withdrawal.marketId,
                },
                marketUsdLookup
              );
              dailyWithdrawals[date] = (dailyWithdrawals[date] || 0) + value;
            });
            setWithdrawalsData(
              Object.entries(dailyWithdrawals)
                .map(([date, amount]) => ({ date, amount }))
                .sort((a, b) => a.date.localeCompare(b.date))
            );
          } else {
            setWithdrawalsData(generateMockWithdrawalsData());
          }
        } else {
          setWithdrawalsData(generateMockWithdrawalsData());
        }

        if (
          healthFactorResponse.status === 'fulfilled' &&
          healthFactorResponse.value.success
        ) {
          const colors = [
            'hsl(var(--destructive))',
            'hsl(var(--warning-orange))',
            'hsl(var(--whale-gold))',
            'hsl(var(--highlight-aqua))',
            'hsl(var(--ocean-teal))',
          ];
          const distribution = buildHealthFactorDistribution(
            healthFactorResponse.value.data || []
          );
          setHealthFactorData(
            distribution.map((item, index) => ({
              range: item.range,
              count: item.count,
              color: colors[index % colors.length],
            }))
          );
        } else {
          setHealthFactorData([]);
        }

        setUtilizationData(generateMockUtilizationData());
        setRevenueData(generateMockRevenueData());
        setTreasuryData(generateMockTreasuryData());
        setMauData(generateMockMAUData());
        setLoanData(generateMockLoanData());
        setAssetDistribution(generateMockAssetDistribution());
        setInterestRateData(generateMockInterestRateData());
        setLiquidationData(generateMockLiquidationData());
      } catch (error) {
        console.error('Error loading secondary analytics data:', error);
      }
    };

    loadFastKpis();
    loadSecondaryData();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    kpiData,
    tvlData,
    utilizationData,
    revenueData,
    treasuryData,
    wadData,
    mauData,
    loanData,
    assetDistribution,
    interestRateData,
    healthFactorData,
    liquidationData,
    depositsData,
    withdrawalsData,
    loading: kpiLoading,
    kpiLoading,
    oracleRefining,
  };
};

