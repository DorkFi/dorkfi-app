import {
  getPoolCLendingPoolId,
  getPoolELendingPoolId,
  getUnitLendingWadBorrowMarketConfig,
  getWadLpLendingWadBorrowMarketConfig,
  getNetworkConfig,
  getLendingPoolIdForMarketContract,
  getTokenDisplayInfo,
  isUnitLpCollateralMarketContract,
  isWadLpCollateralMarketContract,
  type NetworkId,
  type TokenConfig,
} from "@/config";

/** Supported liquidity DEX integrations on the Pools page. */
export type LiquidityPlatformId = "tinyman";

export const LIQUIDITY_PLATFORM_LABELS: Record<LiquidityPlatformId, string> = {
  tinyman: "Tinyman",
};

/** Curated liquidity pair on a supported AVM network + DEX platform. */
export interface LiquidityPoolPairConfig {
  id: string;
  platform: LiquidityPlatformId;
  networkId: NetworkId;
  asset1Id: number;
  asset2Id: number;
  /** Optional display label (defaults to `SYM1 / SYM2`). */
  label?: string;
  /** When the pool ASA id differs from lending token config (e.g. Tinyman UNIT). */
  asset2Symbol?: string;
  asset2Decimals?: number;
  asset2LogoPath?: string;
  /** Tinyman LP token ASA id for this pool (TMPOOL2). */
  lpTokenId: number;
  /** nt200 market application id for the LP token (ASA deposit target). */
  lpContractId: number;
  /** DEX pool account address (add liquidity / farm deep links). */
  poolAddr?: string;
  /** LP farm program ids on the platform — uses {@link poolAddr}. */
  farms?: number[];
}

/** True when the curated pair has at least one Tinyman farm program configured. */
export function poolHasTinymanFarm(
  pair: Pick<LiquidityPoolPairConfig, "farms">
): boolean {
  return (pair.farms?.length ?? 0) > 0;
}

/** Shown on pool cards and supply modal when {@link poolHasTinymanFarm} is true. */
export const POOL_FARM_SUPPLY_NOTICE =
  "If pool has an active Tinyman farm. Supplying LP to the platform may disqualify your LP from farm rewards.";

/** Base-token filters for the Pools page (UNIT / WAD curated pairs). */
export const POOL_BASE_TOKEN_FILTERS = [
  { id: "unit", symbol: "UNIT", assetId: 3121954282 },
  { id: "wad", symbol: "WAD", assetId: 3334160924 },
] as const;

export type PoolBaseTokenFilterId =
  | (typeof POOL_BASE_TOKEN_FILTERS)[number]["id"]
  | "all";

export function getPoolBaseTokenFilterAssetId(
  filterId: PoolBaseTokenFilterId
): number | null {
  if (filterId === "all") return null;
  return (
    POOL_BASE_TOKEN_FILTERS.find((filter) => filter.id === filterId)?.assetId ??
    null
  );
}

export function poolMatchesBaseTokenFilter(
  pair: LiquidityPoolPairConfig,
  filterAssetId: number | null
): boolean {
  if (filterAssetId == null) return true;
  return pair.asset1Id === filterAssetId || pair.asset2Id === filterAssetId;
}

const WAD_FILTER_ASSET_ID =
  POOL_BASE_TOKEN_FILTERS.find((f) => f.id === "wad")?.assetId ?? null;

/** True when the curated pair includes WAD as either pool asset. */
export function pairIncludesWad(pair: LiquidityPoolPairConfig): boolean {
  if (WAD_FILTER_ASSET_ID == null) return false;
  return (
    pair.asset1Id === WAD_FILTER_ASSET_ID ||
    pair.asset2Id === WAD_FILTER_ASSET_ID
  );
}

export function countPoolsByBaseTokenFilter(
  pairs: LiquidityPoolPairConfig[]
): Record<PoolBaseTokenFilterId, number> {
  const counts: Record<PoolBaseTokenFilterId, number> = {
    all: pairs.length,
    unit: 0,
    wad: 0,
  };

  for (const filter of POOL_BASE_TOKEN_FILTERS) {
    counts[filter.id] = pairs.filter((pair) =>
      poolMatchesBaseTokenFilter(pair, filter.assetId)
    ).length;
  }

  return counts;
}

export const TINYMAN_APP_POOL_BASE = "https://app.tinyman.org/pool";

export function getTinymanPoolUrl(poolAddr: string): string {
  return `${TINYMAN_APP_POOL_BASE}/${poolAddr}`;
}

/** Tinyman pool page with add-liquidity tab active. */
export function getTinymanAddLiquidityUrl(poolAddr: string): string {
  return `${TINYMAN_APP_POOL_BASE}/${poolAddr}/add-liquidity`;
}

export function getTinymanFarmingProgramUrl(
  poolAddr: string,
  farmId: number
): string {
  return `${TINYMAN_APP_POOL_BASE}/${poolAddr}/farming-programs/${farmId}`;
}

export function getDexAddLiquidityUrl(
  platform: LiquidityPlatformId,
  poolAddr: string
): string | null {
  switch (platform) {
    case "tinyman":
      return getTinymanAddLiquidityUrl(poolAddr);
    default:
      return null;
  }
}

export function getDexFarmingProgramUrl(
  platform: LiquidityPlatformId,
  poolAddr: string,
  farmId: number
): string | null {
  switch (platform) {
    case "tinyman":
      return getTinymanFarmingProgramUrl(poolAddr, farmId);
    default:
      return null;
  }
}

/**
 * Select liquidity pairs exposed on the Pools page.
 * Use underlying ASA ids for asset1Id/asset2Id (ALGO = 0); lpTokenId / lpContractId are Tinyman LP metadata.
 */
export const CURATED_LIQUIDITY_POOLS: LiquidityPoolPairConfig[] = [
  // TMPOOL2 3157974960 6 3577729953
  {
    id: "unit-algo",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3157974960,
    lpContractId: 3577729953,
    asset1Id: 3121954282,
    asset2Id: 0,
    label: "UNIT / ALGO",
    poolAddr:
      "5T5VBTBOPW2ZRJX6QJYCBMZ24VAW7IWFGV7GHCBKFNKIN2XYHP5OLOSQJQ",
    farms: [252],
  },
  // TMPOOL2 3159132330 6 3577777819
  {
    id: "unit-gobtc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3159132330,
    lpContractId: 3577777819,
    asset1Id: 3121954282,
    asset2Id: 386192725,
    label: "UNIT / goBTC",
    poolAddr:
      "YQJ7QB4AWGA6XDHABFI5JXSDQUMM4JVG7EG4FXT4WQXUKVA44BGSSN2BZA",
    farms: [],
  },
  // TMPOOL2 3334546641 6 3577783311
  {
    id: "wad-unit",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3334546641,
    lpContractId: 3577783311,
    asset1Id: 3334160924,
    asset2Id: 3121954282,
    label: "WAD / UNIT",
    poolAddr:
      "77FCRUX5B4AKC3SQ4KB6SP6SIXUQFU3QYYTZSJWMOSDJO3AO4E6P4Z6EXE",
    farms: [],
  },
  // TMPOOL2 3334448440 6 3577799583
  {
    id: "wad-usdc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3334448440,
    lpContractId: 3577799583,
    asset1Id: 3334160924,
    asset2Id: 31566704,
    label: "WAD / USDC",
    poolAddr:
      "NDQE23CVD5R2ZE3VKAZK6JEJUGYGM7A2VARYEOOWXOVA4GYAOV74PS7ALI",
    farms: [],
  },
  // TMPOOL2 3355755995 6 3578387558
  {
    id: "wad-gobtc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3355755995,
    lpContractId: 3578387558,
    asset1Id: 3334160924,
    asset2Id: 386192725,
    label: "WAD / goBTC",
    poolAddr:
      "T7ZSLWI462QQCDAERZ4TEBL3U3WSA2R4WBVL62LQ33WV2XVYT2YEWN75Q4",
    farms: [],
  },
  // TMPOOL2 3495913115 6 3578394082
  {
    id: "wad-goeth",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3495913115,
    lpContractId: 3578394082,
    asset1Id: 3334160924,
    asset2Id: 386195940,
    label: "WAD / goETH",
    poolAddr:
      "Q5HKO22ZGLV7R6WHYOCKRD5SZFLXNMI2HX6DCZ4YAAOSNPV2HLMVOYB7CA",
    farms: [],
  },
  // TMPOOL2 3346320836 6 3578405588
  {
    id: "wad-algo",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3346320836,
    lpContractId: 3578405588,
    asset1Id: 3334160924,
    asset2Id: 0,
    label: "WAD / ALGO",
    poolAddr:
      "T4VXZUUONE2DS7G5QXGVBDR27G32MCM25KEQLBITC4ENOK6N7CMM5VLRSM",
    farms: [],
  },
];

export function getCuratedLiquidityPoolsForNetwork(
  networkId: NetworkId
): LiquidityPoolPairConfig[] {
  return CURATED_LIQUIDITY_POOLS.filter((p) => p.networkId === networkId);
}

/** Lending market row in config (`LP_*`) matching a curated Tinyman pool. */
export interface LiquidityPoolLendingMarket {
  configSymbol: string;
  poolId: string;
  marketId: string;
  displaySymbol: string;
  displayName: string;
  logoPath: string;
  decimals: number;
  assetId: string;
}

/**
 * Resolve a platform lending market for this pool when `network.tokens` contains
 * an `LP_*` entry whose ASA + nt200 contract match the pair's LP metadata.
 */
export function resolveLiquidityPoolLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): LiquidityPoolLendingMarket | null {
  const tokens = getNetworkConfig(networkId).tokens;
  if (!tokens) return null;

  for (const [key, tokenConfig] of Object.entries(tokens)) {
    if (!key.startsWith("LP_")) continue;
    const tc: TokenConfig = Array.isArray(tokenConfig)
      ? tokenConfig[0]
      : tokenConfig;
    if (!tc?.assetId || !tc.contractId) continue;
    if (
      String(tc.assetId) !== String(pair.lpTokenId) ||
      String(tc.contractId) !== String(pair.lpContractId)
    ) {
      continue;
    }
    const display = getTokenDisplayInfo(networkId, key);
    const poolId =
      tc.poolId != null
        ? String(tc.poolId)
        : getLendingPoolIdForMarketContract(networkId, tc.contractId);
    return {
      configSymbol: key,
      poolId: poolId ?? "",
      marketId: String(tc.contractId),
      displaySymbol: display?.symbol ?? tc.symbol,
      displayName: display?.name ?? tc.name,
      logoPath: tc.logoPath,
      decimals: tc.decimals ?? 6,
      assetId: String(tc.assetId),
    };
  }
  return null;
}

/** True when the curated pair supplies UNIT LP collateral on Pool C. */
export function pairHasUnitLpLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  return isUnitLpCollateralMarketContract(networkId, pair.lpContractId);
}

/** True when the curated pair supplies WAD LP collateral on Pool E. */
export function pairHasWadLpCollateralLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  return isWadLpCollateralMarketContract(networkId, pair.lpContractId);
}

/** Lending pool app ids for UNIT LP markets among the given curated pairs. */
export function resolveUnitLendingPoolIdsForPairs(
  networkId: NetworkId,
  pairs: LiquidityPoolPairConfig[]
): string[] {
  const poolIds = new Set<string>();
  for (const pair of pairs) {
    if (!pairHasUnitLpLendingMarket(networkId, pair)) continue;
    const market = resolveLiquidityPoolLendingMarket(networkId, pair);
    if (market?.poolId) {
      poolIds.add(market.poolId);
    }
  }
  return [...poolIds];
}

/** Pool C lending pool id for UNIT TMPOOL2 markets (all share one pool). */
export function resolvePoolCLendingPoolId(networkId: NetworkId): string | null {
  return getPoolCLendingPoolId(networkId);
}

/** True when UNIT LP collateral on this network borrows against a configured WAD market. */
export function hasUnitLendingWadBorrowAssociation(
  networkId: NetworkId
): boolean {
  return getUnitLendingWadBorrowMarketConfig(networkId) != null;
}

/** True when WAD LP collateral on Pool E borrows against a configured WAD market. */
export function hasWadLpLendingWadBorrowAssociation(
  networkId: NetworkId
): boolean {
  return getWadLpLendingWadBorrowMarketConfig(networkId) != null;
}

/** True when the curated pair shows platform lending on the Pools page. */
export function pairHasPoolsPageLendingPosition(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  if (!hasUnitLendingWadBorrowAssociation(networkId)) return false;
  return pairHasUnitLpLendingMarket(networkId, pair);
}

/** Lending market row for Pools page supply/withdraw (UNIT LP collateral or WAD LP markets). */
export function resolvePoolsPageLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): LiquidityPoolLendingMarket | null {
  const hasLending =
    pairHasPoolsPageLendingPosition(networkId, pair) ||
    pairHasWadLpLendingMarket(networkId, pair);
  if (!hasLending) return null;
  return resolveLiquidityPoolLendingMarket(networkId, pair);
}

/** Pool ids for UNIT LP global user reads on the Pools page. */
export function resolveUnitLendingPoolIdsForFilter(
  networkId: NetworkId,
  filteredPairs: LiquidityPoolPairConfig[]
): string[] {
  if (!hasUnitLendingWadBorrowAssociation(networkId)) return [];

  const unitPairs = filteredPairs.filter((pair) =>
    pairHasUnitLpLendingMarket(networkId, pair)
  );
  if (unitPairs.length === 0) return [];

  const poolC = resolvePoolCLendingPoolId(networkId);
  if (poolC) return [poolC];
  return resolveUnitLendingPoolIdsForPairs(networkId, unitPairs);
}

/** Pool ids for WAD LP global user reads on the Pools page (Pool E). */
export function resolveWadLendingPoolIdsForFilter(
  networkId: NetworkId,
  filteredPairs: LiquidityPoolPairConfig[]
): string[] {
  const wadPairs = filteredPairs.filter(
    (pair) =>
      pairHasWadLpLendingMarket(networkId, pair) &&
      pairHasWadLpCollateralLendingMarket(networkId, pair)
  );
  if (wadPairs.length === 0) return [];

  const poolE = getPoolELendingPoolId(networkId);
  if (poolE) return [poolE];
  return resolveWadLendingPoolIdsForPairs(networkId, wadPairs);
}

/** LP lending is enabled for WAD-base Tinyman pairs with configured `LP_TMPOOL2_WAD_*` markets. */
export function pairHasWadLpLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  const market = resolveLiquidityPoolLendingMarket(networkId, pair);
  return (
    market != null && market.configSymbol.startsWith("LP_TMPOOL2_WAD_")
  );
}

/** Lending pool app ids for WAD LP markets among the given curated pairs. */
export function resolveWadLendingPoolIdsForPairs(
  networkId: NetworkId,
  pairs: LiquidityPoolPairConfig[]
): string[] {
  const poolIds = new Set<string>();
  for (const pair of pairs) {
    if (!pairHasWadLpLendingMarket(networkId, pair)) continue;
    const market = resolveLiquidityPoolLendingMarket(networkId, pair);
    if (market?.poolId) {
      poolIds.add(market.poolId);
    }
  }
  return [...poolIds];
}

/** WAD borrow market paired with Pool C UNIT LP collateral. */
export function resolvePoolCWadMarket(
  networkId: NetworkId
): TokenConfig | null {
  return getUnitLendingWadBorrowMarketConfig(networkId);
}

/** WAD borrow market paired with Pool E WAD LP collateral. */
export function resolvePoolEWadMarket(
  networkId: NetworkId
): TokenConfig | null {
  return getWadLpLendingWadBorrowMarketConfig(networkId);
}
