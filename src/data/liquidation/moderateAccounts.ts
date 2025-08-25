
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const moderateAccounts: LiquidationAccount[] = [
  {
    id: '12',
    walletAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    healthFactor: 1.15,
    liquidationMargin: 2800,
    totalSupplied: 32000,
    totalBorrowed: 24000,
    ltv: 0.75,
    riskLevel: 'moderate',
    collateralAssets: [
      { symbol: 'ETH', amount: 20, valueUSD: 32000 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 24000, valueUSD: 24000 }
    ],
    lastUpdated: '2024-01-15T08:00:00Z'
  },
  {
    id: '13',
    walletAddress: '0x1985365e9f78359a9B6AD760e32412f4a445E862',
    healthFactor: 1.18,
    liquidationMargin: 5100,
    totalSupplied: 38000,
    totalBorrowed: 28000,
    ltv: 0.74,
    riskLevel: 'moderate',
    collateralAssets: [
      { symbol: 'WBTC', amount: 1.5, valueUSD: 30000 },
      { symbol: 'UNI', amount: 1600, valueUSD: 8000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 28000, valueUSD: 28000 }
    ],
    lastUpdated: '2024-01-15T07:45:00Z'
  },
  {
    id: '14',
    walletAddress: '0xd533a949740bb3306d119CC777fa900bA034cd52',
    healthFactor: 1.19,
    liquidationMargin: 1850,
    totalSupplied: 24000,
    totalBorrowed: 17000,
    ltv: 0.71,
    riskLevel: 'moderate',
    collateralAssets: [
      { symbol: 'ETH', amount: 15, valueUSD: 24000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 17000, valueUSD: 17000 }
    ],
    lastUpdated: '2024-01-15T07:30:00Z'
  },
  {
    id: '15',
    walletAddress: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    healthFactor: 1.16,
    liquidationMargin: 4200,
    totalSupplied: 45000,
    totalBorrowed: 32000,
    ltv: 0.71,
    riskLevel: 'moderate',
    collateralAssets: [
      { symbol: 'ETH', amount: 22, valueUSD: 35200 },
      { symbol: 'LINK', amount: 900, valueUSD: 9800 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 32000, valueUSD: 32000 }
    ],
    lastUpdated: '2024-01-15T07:15:00Z'
  }
];
