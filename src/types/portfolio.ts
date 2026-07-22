/**
 * Shared portfolio position / user shapes used by Portfolio UI and related hooks.
 * Runtime data is often richer than the API types; optional fields cover both paths.
 */

/** Market row fields Portfolio reads after matching via {@link marketRowForPortfolioPosition}. */
export interface PortfolioMarketRow {
  marketId?: string | number;
  poolId?: string | number;
  appId?: string | number;
  symbol?: string;
  price?: string | number;
  supplyRate?: number;
  borrowRateCurrent?: number;
  collateralFactor?: number | string;
  liquidationThreshold?: number | string;
  depositIndex?: string | number;
  borrowIndex?: string | number;
  decimals?: number;
  apyCalculation?: { apy?: number };
  borrowApyCalculation?: { apy?: number };
  marketInfo?: {
    poolId?: string;
    liquidationThreshold?: number | string;
    collateralFactor?: number | string;
    price?: string | number;
  };
  // Allow MarketInfo / API extras without fighting structural assignability at call sites.
  [key: string]: unknown;
}

/** Raw deposit/borrow row from API `userData` / `computed.deposits|borrows`. */
export interface PortfolioComputedPosition {
  network?: string;
  marketId?: string | number;
  underlyingContractId?: string | number;
  appId?: string | number;
  poolId?: string | number;
  scaledDeposits?: string | number | bigint;
  scaledBorrows?: string | number | bigint;
  [key: string]: unknown;
}

export interface PortfolioNetworkValue {
  collateral: number;
  borrow: number;
  netValue: number;
}

export interface PortfolioUserComputed {
  globalCollateralValue?: number;
  globalBorrowValue?: number;
  globalNetPortfolioValue?: number;
  networkValues?: Record<string, PortfolioNetworkValue>;
  deposits?: PortfolioComputedPosition[];
  borrows?: PortfolioComputedPosition[];
}

/** Accrued-interest aggregation row (earned vs owed per market). */
export interface AccruedInterestMarketItem {
  asset: string;
  icon?: string;
  iconBadgeUrl?: string;
  network?: string;
  poolId?: string;
  tokenPrice?: number;
  earnedInterest: number;
  earnedInterestValue: number;
  owedInterest: number;
  owedInterestValue: number;
  netInterest?: number;
  netInterestValue?: number;
}

/** Table row after transforming API / chain positions. */
export interface PortfolioPositionRow {
  asset: string;
  icon: string;
  iconBadgeUrl?: string;
  balance: number;
  nTokenBalance?: number;
  value: number;
  apy: number;
  tokenPrice: number;
  type: "deposit" | "borrow";
  interest?: number;
  accruedInterest?: number;
  accruedInterestValue?: number;
  earnedInterest?: number;
  earnedInterestValue?: number;
  owedInterest?: number;
  owedInterestValue?: number;
  poolId?: string;
  network?: string;
  networkId?: string;
  originalSymbol?: string;
  configSymbol?: string;
  configKey?: string;
  marketId?: string;
  appId?: string;
  debtMarketId?: string;
  debtSymbol?: string;
  collateralMarketId?: string;
  userDepositIndex?: string | number;
  userBorrowIndex?: string | number;
  scaledDeposits?: string | number | bigint;
  scaledBorrows?: string | number | bigint;
  [key: string]: unknown;
}

/**
 * Narrow helper for network-tagged portfolio items (sorting, filters).
 * Also accepts loose token/display objects used at call sites.
 */
export interface ItemWithNetwork {
  network?: string;
  networkId?: string;
  originalSymbol?: string;
  configSymbol?: string;
  configKey?: string;
  marketId?: string;
  poolId?: string;
  asset?: string;
  symbol?: string;
  accruedInterest?: number;
  interest?: number;
  accruedInterestValue?: number;
  tokenPrice?: number;
  debtMarketId?: string;
  debtSymbol?: string;
  appId?: string;
  [key: string]: unknown;
}

export interface PortfolioUser {
  address?: string;
  avatar?: string;
  avatarImage?: string;
  profileImage?: string;
  globalUserData?: unknown;
  userData?: PortfolioComputedPosition[];
  userDataSource?: string;
  computed?: PortfolioUserComputed;
}
