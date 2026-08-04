import type { NetworkId, TokenConfig, TokenStandard } from "@/config";

/** How the borrow leg is executed against existing lending builders. */
export type BorrowTransactionMechanism =
  /** Pool A WAD `isStoken` mint UX — still uses `borrow()` under the hood. */
  | "wad_mint_via_borrow"
  /** Standard pool borrow (including WAD on non-stoken rows / LP pools). */
  | "pool_borrow";

/**
 * Stable identity for one configured market row (config key + pool + contract).
 * Prefer this over symbol alone — ALGO/USDC/WAD appear in multiple pools.
 */
export type EasyBorrowMarketRef = {
  configKey: string;
  poolId: string;
  contractId: string;
  nTokenId: string;
  symbol: string;
  decimals: number;
  tokenStandard: TokenStandard;
  logoPath: string;
  isStoken: boolean;
};

export type BorrowRoute = {
  networkId: NetworkId;
  poolId: string;
  /** A / B / C / D / E / F from {@link getLendingPoolLabel}. */
  marketLabel: string;
  collateral: EasyBorrowMarketRef;
  borrow: EasyBorrowMarketRef;
  mechanism: BorrowTransactionMechanism;
  /** True when collateral is an explicit C/E/F LP→WAD curated route. */
  isExplicitLpWadRoute: boolean;
  /** Full token configs for deposit/borrow builders. */
  collateralToken: TokenConfig;
  borrowToken: TokenConfig;
};

export type ResolveBorrowRouteInput = {
  networkId: NetworkId;
  /** Config map key, e.g. `ALGO`, `LP_TMPOOL2_UNIT_ALGO`. */
  collateralConfigKey: string;
  borrowConfigKey: string;
  /** Optional disambiguators when the same key exists in multiple pools. */
  collateralContractId?: string;
  collateralPoolId?: string;
  borrowContractId?: string;
  borrowPoolId?: string;
  /**
   * Prefer a pool where the user already has collateral (remaining borrow capacity).
   * When set, matching routes rank higher.
   */
  preferredPoolIds?: readonly string[];
};

export type BorrowRouteLiveParams = {
  collateralFactor: number | null;
  liquidationThreshold: number | null;
  supplyCap: string | null;
  borrowCap: string | null;
  availableLiquidity: number | null;
  borrowAPR: number | null;
  oraclePriceCollateral: number | null;
  oraclePriceBorrow: number | null;
};
