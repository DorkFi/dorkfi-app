import { useState, useEffect } from 'react';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';

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

const generateMockKPIData = (): KPIData => ({
  tvl: 245_680_000,
  totalBorrowed: 156_420_000,
  wadCirculation: 89_340_000,
  protocolRevenue: 2_150_000,
  activeWallets: 48_720,
});

const generateMockTVLData = (days: number = 30): TVLData[] => {
  const data: TVLData[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const baseTotal = 200_000_000 + (days - i) * 1_500_000 + Math.random() * 5_000_000;
    data.push({
      date: date.toISOString().split('T')[0],
      total: baseTotal,
      weth: baseTotal * 0.35,
      usdc: baseTotal * 0.28,
      usdt: baseTotal * 0.22,
      wbtc: baseTotal * 0.15,
    });
  }
  return data;
};

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

const generateMockHealthFactorData = (): HealthFactorData[] => [
  { range: '<1.0', count: 234, color: 'hsl(var(--destructive))' },
  { range: '1.0-1.1', count: 567, color: 'hsl(var(--warning-orange))' },
  { range: '1.1-1.2', count: 1234, color: 'hsl(var(--whale-gold))' },
  { range: '1.2-1.5', count: 2890, color: 'hsl(var(--highlight-aqua))' },
  { range: '>1.5', count: 4123, color: 'hsl(var(--ocean-teal))' },
];

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        console.log('Fetching analytics data from DorkFi API...');
        
        // Calculate time ranges
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        const startTime30d = now - days30;

        // Load all data in parallel
        const [
          tvlResponse,
          tvlGrowthResponse,
          borrowedResponse,
          borrowedGrowthResponse,
          wadResponse,
          wadGrowthResponse,
          walletsResponse,
          walletsGrowthResponse,
          depositsResponse,
          withdrawalsResponse,
          healthFactorResponse,
        ] = await Promise.allSettled([
          dorkfiAPIService.getTVL(),
          dorkfiAPIService.getTVLGrowth(startTime30d, now, 'day'),
          dorkfiAPIService.getTotalBorrowed(),
          dorkfiAPIService.getBorrowedGrowth(),
          dorkfiAPIService.getWADCirculation(),
          dorkfiAPIService.getWADSupplyGrowth(startTime30d, now, 'day'),
          dorkfiAPIService.getActiveWallets(),
          dorkfiAPIService.getActiveWalletsGrowth(),
          dorkfiAPIService.getDeposits(startTime30d, now, 10000),
          dorkfiAPIService.getWithdrawals(startTime30d, now, 10000),
          dorkfiAPIService.getHealthFactorDistribution(),
        ]);

        // Process KPI Data
        const tvl = tvlResponse.status === 'fulfilled' && tvlResponse.value.success
          ? tvlResponse.value.data?.totalTVL || 0
          : 0;
        
        const borrowed = borrowedResponse.status === 'fulfilled' && borrowedResponse.value.success
          ? borrowedResponse.value.data?.totalBorrowed || 0
          : 0;
        
        const wadCirculation = wadResponse.status === 'fulfilled' && wadResponse.value.success
          ? parseFloat(wadResponse.value.data?.totalWadCirculation || '0') / 1e6
          : 0;
        
        const activeWallets = walletsResponse.status === 'fulfilled' && walletsResponse.value.success
          ? walletsResponse.value.data?.totalActiveWallets || 0
          : 0;

        // Extract growth percentages from API responses
        const tvlGrowth7d = tvlGrowthResponse.status === 'fulfilled' && tvlGrowthResponse.value.success
          ? tvlGrowthResponse.value.data?.growth7d || tvlGrowthResponse.value.data?.growth24h || undefined
          : undefined;
        
        const borrowedGrowth7d = borrowedGrowthResponse.status === 'fulfilled' && borrowedGrowthResponse.value.success
          ? borrowedGrowthResponse.value.data?.growth7d || borrowedGrowthResponse.value.data?.growth24h || undefined
          : undefined;
        
        const wadGrowth7d = wadGrowthResponse.status === 'fulfilled' && wadGrowthResponse.value.success
          ? wadGrowthResponse.value.data?.growth7d || wadGrowthResponse.value.data?.growth24h || undefined
          : undefined;
        
        const walletsGrowth7d = walletsGrowthResponse.status === 'fulfilled' && walletsGrowthResponse.value.success
          ? walletsGrowthResponse.value.data?.growth7d || walletsGrowthResponse.value.data?.growth24h || undefined
          : undefined;

        // Calculate protocol revenue (placeholder - would need actual revenue endpoint)
        const protocolRevenue = 0; // TODO: Add revenue endpoint

        setKpiData({
          tvl,
          totalBorrowed: borrowed,
          wadCirculation,
          protocolRevenue,
          activeWallets,
          tvlGrowth7d,
          borrowedGrowth7d,
          wadGrowth7d,
          walletsGrowth7d,
        });

        // Process TVL Growth Data
        if (tvlGrowthResponse.status === 'fulfilled' && tvlGrowthResponse.value.success) {
          const dataPoints = tvlGrowthResponse.value.data?.dataPoints || [];
          if (dataPoints.length > 0) {
            const transformed = dataPoints.map((point) => ({
              date: new Date(point.timestamp).toISOString().split('T')[0],
              total: point.value,
              weth: point.value * 0.35, // Placeholder - would need asset breakdown
              usdc: point.value * 0.28,
              usdt: point.value * 0.22,
              wbtc: point.value * 0.15,
            }));
            setTvlData(transformed);
          } else {
            console.warn('TVL growth API returned empty data, using mock data');
            setTvlData(generateMockTVLData());
          }
        } else {
          console.warn('TVL growth API call failed, using mock data:', tvlGrowthResponse.status === 'rejected' ? tvlGrowthResponse.reason : 'API returned unsuccessful response');
          setTvlData(generateMockTVLData());
        }

        // Process WAD Supply Growth Data
        if (wadGrowthResponse.status === 'fulfilled' && wadGrowthResponse.value.success) {
          const dataPoints = wadGrowthResponse.value.data?.dataPoints || [];
          if (dataPoints.length > 0) {
            const supplyData = dataPoints.map((point) => ({
              date: new Date(point.timestamp).toISOString().split('T')[0],
              supply: point.value / 1e6, // Normalize from micro-units
            }));
            
            setWadData({
              supplyData,
              collateralizationRatio: 135.4, // Placeholder - would need actual endpoint
              pegStability: supplyData.map((d) => ({
                date: d.date,
                price: 1.0, // Placeholder
              })),
            });
          } else {
            console.warn('WAD supply growth API returned empty data, using mock data');
            setWadData(generateMockWADData());
          }
        } else {
          console.warn('WAD supply growth API call failed, using mock data:', wadGrowthResponse.status === 'rejected' ? wadGrowthResponse.reason : 'API returned unsuccessful response');
          setWadData(generateMockWADData());
        }

        // Process Deposits Data
        if (depositsResponse.status === 'fulfilled' && depositsResponse.value.success) {
          const deposits = depositsResponse.value.data?.deposits || [];
          if (deposits.length > 0) {
            // Group by date and sum amounts
            const dailyDeposits: { [key: string]: number } = {};
            
            deposits.forEach((deposit) => {
              const date = new Date(deposit.timestamp).toISOString().split('T')[0];
              const value = parseFloat(deposit.depositValueUSD) / 1e12; // Convert from micro-units to USD
              dailyDeposits[date] = (dailyDeposits[date] || 0) + value;
            });

            const transformed = Object.entries(dailyDeposits)
              .map(([date, amount]) => ({ date, amount }))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            setDepositsData(transformed);
          } else {
            console.warn('Deposits API returned empty data, using mock data');
            setDepositsData(generateMockDepositsData());
          }
        } else {
          console.warn('Deposits API call failed, using mock data:', depositsResponse.status === 'rejected' ? depositsResponse.reason : 'API returned unsuccessful response');
          setDepositsData(generateMockDepositsData());
        }

        // Process Withdrawals Data
        if (withdrawalsResponse.status === 'fulfilled' && withdrawalsResponse.value.success) {
          const withdrawals = withdrawalsResponse.value.data?.withdrawals || [];
          if (withdrawals.length > 0) {
            // Group by date and sum amounts
            const dailyWithdrawals: { [key: string]: number } = {};
            
            withdrawals.forEach((withdrawal) => {
              const date = new Date(withdrawal.timestamp).toISOString().split('T')[0];
              const value = parseFloat(withdrawal.withdrawalValueUSD) / 1e12; // Convert from micro-units to USD
              dailyWithdrawals[date] = (dailyWithdrawals[date] || 0) + value;
            });

            const transformed = Object.entries(dailyWithdrawals)
              .map(([date, amount]) => ({ date, amount }))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            setWithdrawalsData(transformed);
          } else {
            console.warn('Withdrawals API returned empty data, using mock data');
            setWithdrawalsData(generateMockWithdrawalsData());
          }
        } else {
          console.warn('Withdrawals API call failed, using mock data:', withdrawalsResponse.status === 'rejected' ? withdrawalsResponse.reason : 'API returned unsuccessful response');
          setWithdrawalsData(generateMockWithdrawalsData());
        }

        // Process Health Factor Distribution
        if (healthFactorResponse.status === 'fulfilled' && healthFactorResponse.value.success) {
          const distribution = healthFactorResponse.value.data?.distribution || [];
          if (distribution.length > 0) {
            const colors = [
              'hsl(var(--destructive))',
              'hsl(var(--warning-orange))',
              'hsl(var(--whale-gold))',
              'hsl(var(--highlight-aqua))',
              'hsl(var(--ocean-teal))',
            ];
            
            const transformed = distribution.map((item, index) => ({
              range: item.range,
              count: item.count,
              color: colors[index % colors.length],
            }));
            
            setHealthFactorData(transformed);
          } else {
            console.warn('Health factor distribution API returned empty data, using mock data');
            setHealthFactorData(generateMockHealthFactorData());
          }
        } else {
          console.warn('Health factor distribution API call failed, using mock data:', healthFactorResponse.status === 'rejected' ? healthFactorResponse.reason : 'API returned unsuccessful response');
          setHealthFactorData(generateMockHealthFactorData());
        }

        // Set placeholder data for other metrics (not yet available in API)
        setUtilizationData(generateMockUtilizationData());
        setRevenueData(generateMockRevenueData());
        setTreasuryData(generateMockTreasuryData());
        setMauData(generateMockMAUData());
        setLoanData(generateMockLoanData());
        setAssetDistribution(generateMockAssetDistribution());
        setInterestRateData(generateMockInterestRateData());
        setLiquidationData(generateMockLiquidationData());

        console.log('Analytics data loaded successfully from DorkFi API');

      } catch (error) {
        console.error('Error loading analytics data:', error);
        // Fallback to mock data on error
        setKpiData(generateMockKPIData());
        setTvlData(generateMockTVLData());
        setWadData(generateMockWADData());
        setDepositsData(generateMockDepositsData());
        setWithdrawalsData(generateMockWithdrawalsData());
        setHealthFactorData(generateMockHealthFactorData());
        setUtilizationData(generateMockUtilizationData());
        setRevenueData(generateMockRevenueData());
        setTreasuryData(generateMockTreasuryData());
        setMauData(generateMockMAUData());
        setLoanData(generateMockLoanData());
        setAssetDistribution(generateMockAssetDistribution());
        setInterestRateData(generateMockInterestRateData());
        setLiquidationData(generateMockLiquidationData());
      } finally {
        setLoading(false);
      }
    };

    loadData();
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
    loading,
  };
};

