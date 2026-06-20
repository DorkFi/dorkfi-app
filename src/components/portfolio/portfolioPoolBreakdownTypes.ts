export type PortfolioPoolBreakdownRow = {
  poolKey: string;
  poolId: string;
  network: string;
  networkDisplayName: string;
  marketLabel: string | null;
  title: string;
  chartLabel: string;
  collateral: number;
  borrow: number;
  netValue: number;
  healthFactor: number | null;
  liquidationMargin: number;
};

export type PortfolioBorrowSummary = {
  asset: string;
  value: number;
};
