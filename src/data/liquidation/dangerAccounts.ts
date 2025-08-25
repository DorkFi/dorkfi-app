
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const dangerAccounts: LiquidationAccount[] = [
  {
    id: '7',
    walletAddress: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    healthFactor: 1.05,
    liquidationMargin: 6200,
    totalSupplied: 35000,
    totalBorrowed: 28000,
    ltv: 0.80,
    riskLevel: 'danger',
    collateralAssets: [
      { symbol: 'ETH', amount: 18, valueUSD: 28800 },
      { symbol: 'UNI', amount: 1200, valueUSD: 6200 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 28000, valueUSD: 28000 }
    ],
    lastUpdated: '2024-01-15T09:15:00Z'
  },
  {
    id: '8',
    walletAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    healthFactor: 1.08,
    liquidationMargin: 4500,
    totalSupplied: 26000,
    totalBorrowed: 20000,
    ltv: 0.77,
    riskLevel: 'danger',
    collateralAssets: [
      { symbol: 'ETH', amount: 16.25, valueUSD: 26000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 20000, valueUSD: 20000 }
    ],
    lastUpdated: '2024-01-15T09:00:00Z'
  },
  {
    id: '9',
    walletAddress: '0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413',
    healthFactor: 1.07,
    liquidationMargin: 7800,
    totalSupplied: 42000,
    totalBorrowed: 32000,
    ltv: 0.76,
    riskLevel: 'danger',
    collateralAssets: [
      { symbol: 'WBTC', amount: 1.8, valueUSD: 36000 },
      { symbol: 'LINK', amount: 550, valueUSD: 6000 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 32000, valueUSD: 32000 }
    ],
    lastUpdated: '2024-01-15T08:45:00Z'
  },
  {
    id: '10',
    walletAddress: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    healthFactor: 1.09,
    liquidationMargin: 3200,
    totalSupplied: 18000,
    totalBorrowed: 14000,
    ltv: 0.78,
    riskLevel: 'danger',
    collateralAssets: [
      { symbol: 'ETH', amount: 11.25, valueUSD: 18000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 14000, valueUSD: 14000 }
    ],
    lastUpdated: '2024-01-15T08:30:00Z'
  },
  {
    id: '11',
    walletAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    healthFactor: 1.06,
    liquidationMargin: 9500,
    totalSupplied: 55000,
    totalBorrowed: 42000,
    ltv: 0.76,
    riskLevel: 'danger',
    collateralAssets: [
      { symbol: 'ETH', amount: 30, valueUSD: 48000 },
      { symbol: 'AAVE', amount: 50, valueUSD: 7000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 25000, valueUSD: 25000 },
      { symbol: 'DAI', amount: 17000, valueUSD: 17000 }
    ],
    lastUpdated: '2024-01-15T08:15:00Z'
  }
];
