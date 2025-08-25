
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const safeAccounts: LiquidationAccount[] = [
  {
    id: '16',
    walletAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    healthFactor: 1.85,
    liquidationMargin: 1200,
    totalSupplied: 35000,
    totalBorrowed: 18000,
    ltv: 0.51,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 21.875, valueUSD: 35000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 18000, valueUSD: 18000 }
    ],
    lastUpdated: '2024-01-15T07:00:00Z'
  },
  {
    id: '17',
    walletAddress: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
    healthFactor: 2.1,
    liquidationMargin: 2100,
    totalSupplied: 48000,
    totalBorrowed: 22000,
    ltv: 0.46,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 25, valueUSD: 40000 },
      { symbol: 'AAVE', amount: 60, valueUSD: 8000 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 22000, valueUSD: 22000 }
    ],
    lastUpdated: '2024-01-15T06:45:00Z'
  },
  {
    id: '18',
    walletAddress: '0x1f573d6Fb3F13d689FF844B4cE37794d79a7FF1C',
    healthFactor: 1.95,
    liquidationMargin: 850,
    totalSupplied: 28000,
    totalBorrowed: 14000,
    ltv: 0.50,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'WBTC', amount: 1.4, valueUSD: 28000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 14000, valueUSD: 14000 }
    ],
    lastUpdated: '2024-01-15T06:30:00Z'
  },
  {
    id: '19',
    walletAddress: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
    healthFactor: 2.3,
    liquidationMargin: 1800,
    totalSupplied: 55000,
    totalBorrowed: 23000,
    ltv: 0.42,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 30, valueUSD: 48000 },
      { symbol: 'UNI', amount: 1400, valueUSD: 7000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 15000, valueUSD: 15000 },
      { symbol: 'DAI', amount: 8000, valueUSD: 8000 }
    ],
    lastUpdated: '2024-01-15T06:15:00Z'
  },
  {
    id: '20',
    walletAddress: '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
    healthFactor: 1.75,
    liquidationMargin: 2400,
    totalSupplied: 42000,
    totalBorrowed: 22000,
    ltv: 0.52,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 26.25, valueUSD: 42000 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 22000, valueUSD: 22000 }
    ],
    lastUpdated: '2024-01-15T06:00:00Z'
  },
  {
    id: '21',
    walletAddress: '0x408e41876cCCDC0F92210600ef50372656052a38',
    healthFactor: 2.05,
    liquidationMargin: 950,
    totalSupplied: 33000,
    totalBorrowed: 15000,
    ltv: 0.45,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'WBTC', amount: 1.25, valueUSD: 25000 },
      { symbol: 'LINK', amount: 730, valueUSD: 8000 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 15000, valueUSD: 15000 }
    ],
    lastUpdated: '2024-01-15T05:45:00Z'
  },
  {
    id: '22',
    walletAddress: '0x56178a0d5F301bAf6CF3e17126317900Daf6a178',
    healthFactor: 1.68,
    liquidationMargin: 3100,
    totalSupplied: 52000,
    totalBorrowed: 28000,
    ltv: 0.54,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 28, valueUSD: 44800 },
      { symbol: 'AAVE', amount: 52, valueUSD: 7200 }
    ],
    borrowedAssets: [
      { symbol: 'USDC', amount: 20000, valueUSD: 20000 },
      { symbol: 'DAI', amount: 8000, valueUSD: 8000 }
    ],
    lastUpdated: '2024-01-15T05:30:00Z'
  },
  {
    id: '23',
    walletAddress: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC',
    healthFactor: 2.45,
    liquidationMargin: 680,
    totalSupplied: 38000,
    totalBorrowed: 15000,
    ltv: 0.39,
    riskLevel: 'safe',
    collateralAssets: [
      { symbol: 'ETH', amount: 23.75, valueUSD: 38000 }
    ],
    borrowedAssets: [
      { symbol: 'DAI', amount: 15000, valueUSD: 15000 }
    ],
    lastUpdated: '2024-01-15T05:15:00Z'
  }
];
