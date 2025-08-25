
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const liquidatableAccounts: LiquidationAccount[] = [
  {
    id: '1',
    walletAddress: '0x742d35Cc67677C94d6A2d97F12b7DeE3a3Db7e0a',
    healthFactor: 0.98,
    liquidationMargin: 15000,
    totalSupplied: 45000,
    totalBorrowed: 42000,
    ltv: 0.93,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'ETH', amount: 12.5, valueUSD: 25000 },
      { symbol: 'VOI', amount: 20000, valueUSD: 10000 },
      { symbol: 'UNIT', amount: 100000, valueUSD: 10000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 30000, valueUSD: 30000 },
      { symbol: 'DAI', amount: 12000, valueUSD: 12000 }
    ],
    lastUpdated: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    walletAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    healthFactor: 0.95,
    liquidationMargin: 18500,
    totalSupplied: 32000,
    totalBorrowed: 28000,
    ltv: 0.88,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'ETH', amount: 10, valueUSD: 20000 },
      { symbol: 'USDC', amount: 12000, valueUSD: 12000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 28000, valueUSD: 28000 }
    ],
    lastUpdated: '2024-01-15T10:25:00Z'
  },
  {
    id: '3',
    walletAddress: '0xA0b86a33E6A88C06b6E5bb4b18f0f83F44e6eEd2',
    healthFactor: 0.97,
    liquidationMargin: 12000,
    totalSupplied: 28000,
    totalBorrowed: 25000,
    ltv: 0.89,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'ETH', amount: 6, valueUSD: 12000 },
      { symbol: 'VOI', amount: 16000, valueUSD: 8000 },
      { symbol: 'LINK', amount: 800, valueUSD: 8000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 25000, valueUSD: 25000 }
    ],
    lastUpdated: '2024-01-15T10:20:00Z'
  },
  {
    id: '4',
    walletAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    healthFactor: 0.92,
    liquidationMargin: 22000,
    totalSupplied: 65000,
    totalBorrowed: 58000,
    ltv: 0.89,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'ETH', amount: 15, valueUSD: 30000 },
      { symbol: 'UNIT', amount: 200000, valueUSD: 20000 },
      { symbol: 'WBTC', amount: 0.33, valueUSD: 15000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 40000, valueUSD: 40000 },
      { symbol: 'DAI', amount: 18000, valueUSD: 18000 }
    ],
    lastUpdated: '2024-01-15T10:15:00Z'
  },
  {
    id: '5',
    walletAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    healthFactor: 0.89,
    liquidationMargin: 35000,
    totalSupplied: 120000,
    totalBorrowed: 105000,
    ltv: 0.88,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'ETH', amount: 50, valueUSD: 80000 },
      { symbol: 'WBTC', amount: 2.0, valueUSD: 40000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 70000, valueUSD: 70000 },
      { symbol: 'DAI', amount: 35000, valueUSD: 35000 }
    ],
    lastUpdated: '2024-01-15T09:45:00Z'
  },
  {
    id: '6',
    walletAddress: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
    healthFactor: 0.93,
    liquidationMargin: 8500,
    totalSupplied: 22000,
    totalBorrowed: 19500,
    ltv: 0.89,
    riskLevel: 'liquidatable',
    collateralAssets: [
      { symbol: 'AAVE', amount: 150, valueUSD: 22000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 19500, valueUSD: 19500 }
    ],
    lastUpdated: '2024-01-15T09:30:00Z'
  }
];
