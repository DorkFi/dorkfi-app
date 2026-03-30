// src/components/market-modal/types.ts

export interface MarketData {
  icon: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  priceHistory: { time: number; price: number }[];
  totalSupply: number;
  totalBorrow: number;
  availableLiquidity: number;
  utilization: number;
  supplyAPY: number;
  borrowAPY: number;
  /** Base borrow rate from the interest curve (fraction 0–1, e.g. 0.02 = 2%). */
  borrowRate?: number;
  /** Utilization slope on the borrow curve (fraction 0–1). */
  slope?: number;
  maxLTV: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  reserveFactor: number;
  supplyCap: number;
  borrowCap: number;
  oracleStatus: 'live' | 'stale';
  auditProvider: string;
}

export interface UserPosition {
  supplied: number;
  borrowed: number;
  withdrawable: number;
  borrowable: number;
  healthFactor: number;
  earnings: number;
}

