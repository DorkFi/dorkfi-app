import {
  getPoolCLendingPoolId,
  getPoolELendingPoolId,
  getPoolFLendingPoolId,
  getUnitLendingWadBorrowMarketConfig,
  getUsdcLpLendingWadBorrowMarketConfig,
  getWadLpLendingWadBorrowMarketConfig,
  getNetworkConfig,
  getLendingPoolIdForMarketContract,
  getTokenDisplayInfo,
  isRegisterableMythLpPoolId,
  isUnitLpCollateralMarketContract,
  isUsdcLpCollateralMarketContract,
  isWadLpCollateralMarketContract,
  type NetworkId,
  type TokenConfig,
} from "@/config";

/** Supported liquidity DEX integrations on the Pools page. */
export type LiquidityPlatformId = "tinyman" | "myth";

export const LIQUIDITY_PLATFORM_LABELS: Record<LiquidityPlatformId, string> = {
  tinyman: "Tinyman",
  myth: "Myth",
};

/** Extra Add button when the same pair also exists on another DEX. */
export interface LiquidityPoolExtraAddLink {
  platform: LiquidityPlatformId;
  url: string;
}

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
  /** LP / LST token ASA id (Tinyman TMPOOL2, or Myth dualSTAKE LST). */
  lpTokenId: number;
  /** LP token decimals (Tinyman TMPOOL2 and Myth LSTs are 6). */
  lpDecimals?: number;
  /**
   * nt200 market application id for the LP token (ASA deposit target).
   * Myth pairs omit this until a tester lists `LP_MYTH_*` via env; then
   * {@link getCuratedLiquidityPoolsForNetwork} hydrates it from token config.
   */
  lpContractId?: number;
  /** DEX pool account (Tinyman pool, or Myth dualSTAKE app account). */
  poolAddr?: string;
  /** Override Add URL (Myth mint page, etc.). */
  addUrl?: string;
  /** LP farm program ids on the platform — uses {@link poolAddr}. */
  farms?: number[];
  /**
   * More Add buttons under the primary DEX link. Use when another venue lists
   * the same pair (not necessarily the same LP ASA). Supply should later light
   * if either LP token is in the wallet — add those ids on `alternateLpTokenIds`.
   */
  extraAddLinks?: LiquidityPoolExtraAddLink[];
  /** Other LP ASAs that also enable Supply on this card. */
  alternateLpTokenIds?: number[];
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

/** Base-token filters for the Pools page. */
export const POOL_BASE_TOKEN_FILTERS = [
  { id: "unit", symbol: "UNIT", assetId: 3121954282 },
  { id: "wad", symbol: "WAD", assetId: 3334160924 },
  { id: "usdc", symbol: "USDC", assetId: 31566704 },
  { id: "finite", symbol: "FINITE", assetId: 400593267 },
  { id: "coop", symbol: "COOP", assetId: 796425061 },
  { id: "alpha", symbol: "ALPHA", assetId: 2726252423 },
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
    usdc: 0,
    finite: 0,
    coop: 0,
    alpha: 0,
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

export const MYTH_ASSET_BASE = "https://myth.finance/asset";

export function getMythAddLiquidityUrl(lpTokenId: number): string {
  return `${MYTH_ASSET_BASE}/${lpTokenId}`;
}

export function getDexAddButtonLabel(platform: LiquidityPlatformId): string {
  if (platform === "myth") return "Add on Myth Finance";
  return `Add on ${LIQUIDITY_PLATFORM_LABELS[platform]}`;
}

export function getDexAddLiquidityUrl(
  pair: Pick<
    LiquidityPoolPairConfig,
    "platform" | "poolAddr" | "addUrl" | "lpTokenId"
  >
): string | null {
  if (pair.addUrl) return pair.addUrl;
  switch (pair.platform) {
    case "tinyman":
      return pair.poolAddr ? getTinymanAddLiquidityUrl(pair.poolAddr) : null;
    case "myth":
      return pair.lpTokenId ? getMythAddLiquidityUrl(pair.lpTokenId) : null;
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

export const FINITE_ASA_ID = 400593267;
export const COOP_ASA_ID = 796425061;
export const ALPHA_ASA_ID = 2726252423;
/** Myth finiteALGO dualSTAKE LST (ALGO + FINITE). */
export const MYTH_FINITE_ALGO_LST_ID = 3012888000;
/** dualSTAKE app account that holds staked ALGO + paired FINITE. */
export const MYTH_FINITE_ALGO_APP_ADDR =
  "QVNUOH7G6MZINPTVLHSLZL53SCXVFA3PTHDJUMGPS6GPBLI5GPZVUYYX6I";
/** Myth coopALGO dualSTAKE LST (ALGO + COOP). */
export const MYTH_COOP_ALGO_LST_ID = 2933499000;
export const MYTH_COOP_ALGO_APP_ADDR =
  "TWJNSHH6DMO2TA4P4Z6ENCSA37R2U3UDNHOYSRS6W6UZYBJWIS6EFD5PXQ";
/** Myth alphaALGO dualSTAKE LST (ALGO + ALPHA). */
export const MYTH_ALPHA_ALGO_LST_ID = 2944427000;
export const MYTH_ALPHA_ALGO_APP_ADDR =
  "HHOEDHJ7O4TECGRF4VRZIYEL374ESIIMIO6ASOZQV7WYLZGLJ3IOMN2ACM";

/**
 * Select liquidity pairs exposed on the Pools page.
 * Use underlying ASA ids for asset1Id/asset2Id (ALGO = 0).
 * Tinyman: lpTokenId / lpContractId are TMPOOL2 + nt200.
 * Myth dualSTAKE: lpTokenId is the LST ASA; lpContractId is hydrated from
 * tester-listed `LP_MYTH_*` token config when present.
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
  // TMPOOL2 1002590888 6 3589026317
  {
    id: "usdc-algo",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 1002590888,
    lpContractId: 3589026317,
    asset1Id: 31566704,
    asset2Id: 0,
    label: "USDC / ALGO",
    poolAddr:
      "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM",
    farms: [],
  },
  // TMPOOL2 2537254960 6 3589029580
  {
    id: "talgo-usdc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 2537254960,
    lpContractId: 3589029580,
    asset1Id: 2537013734,
    asset2Id: 31566704,
    label: "tALGO / USDC",
    poolAddr:
      "VVBWRAJ3YSZGXBGJ2K654J3WA2VZOJW5U4SJCZWLM634H572WTGWTT53EE",
    farms: [],
  },
  // TMPOOL2 3196310546 6 3589032117
  {
    id: "hay-usdc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 3196310546,
    lpContractId: 3589032117,
    asset1Id: 3160000000,
    asset2Id: 31566704,
    label: "HAY / USDC",
    poolAddr:
      "HHDWSEYBFMKLEUC6ZNHUK4AAKXJMSVK4NQFKO7JFB4OEHRAS4SJ32LOTVA",
    farms: [],
  },
  // TMPOOL2 2741116468 6 3589036846
  {
    id: "alpha-usdc",
    platform: "tinyman",
    networkId: "algorand-mainnet",
    lpTokenId: 2741116468,
    lpContractId: 3589036846,
    asset1Id: 2726252423,
    asset2Id: 31566704,
    label: "ALPHA / USDC",
    poolAddr:
      "J7CN6WTMUWXY2KODKAMM5BLZ42FEIQLM4D32FRQ23VOOJC2SEUHKE565T4",
    farms: [],
  },
  // Myth coopALGO dualSTAKE — LST 2933499000 (6). No DorkFi nt200 yet.
  {
    id: "myth-coop-algo",
    platform: "myth",
    networkId: "algorand-mainnet",
    lpTokenId: MYTH_COOP_ALGO_LST_ID,
    lpDecimals: 6,
    asset1Id: COOP_ASA_ID,
    asset2Id: 0,
    label: "COOP / ALGO",
    poolAddr: MYTH_COOP_ALGO_APP_ADDR,
    addUrl: getMythAddLiquidityUrl(MYTH_COOP_ALGO_LST_ID),
  },
  // Myth alphaALGO dualSTAKE — LST 2944427000 (6). No DorkFi nt200 yet.
  {
    id: "myth-alpha-algo",
    platform: "myth",
    networkId: "algorand-mainnet",
    lpTokenId: MYTH_ALPHA_ALGO_LST_ID,
    lpDecimals: 6,
    asset1Id: ALPHA_ASA_ID,
    asset2Id: 0,
    label: "ALPHA / ALGO",
    poolAddr: MYTH_ALPHA_ALGO_APP_ADDR,
    addUrl: getMythAddLiquidityUrl(MYTH_ALPHA_ALGO_LST_ID),
  },
  // Myth finiteALGO dualSTAKE — LST 3012888000 (6). No DorkFi nt200 yet.
  {
    id: "myth-finite-algo",
    platform: "myth",
    networkId: "algorand-mainnet",
    lpTokenId: MYTH_FINITE_ALGO_LST_ID,
    lpDecimals: 6,
    asset1Id: FINITE_ASA_ID,
    asset2Id: 0,
    label: "FINITE / ALGO",
    poolAddr: MYTH_FINITE_ALGO_APP_ADDR,
    addUrl: getMythAddLiquidityUrl(MYTH_FINITE_ALGO_LST_ID),
  },
];

function hydrateMythLendingContract(
  pair: LiquidityPoolPairConfig
): LiquidityPoolPairConfig {
  if (pair.platform !== "myth" || pairHasLendingContract(pair)) return pair;
  const market = resolveLiquidityPoolLendingMarket(pair.networkId, pair);
  if (!market?.marketId) return pair;
  const contractId = Number(market.marketId);
  if (!Number.isFinite(contractId) || contractId <= 0) return pair;
  return { ...pair, lpContractId: contractId };
}

export function getCuratedLiquidityPoolsForNetwork(
  networkId: NetworkId
): LiquidityPoolPairConfig[] {
  return CURATED_LIQUIDITY_POOLS.filter((p) => p.networkId === networkId).map(
    hydrateMythLendingContract
  );
}

export function pairLpDecimals(pair: Pick<LiquidityPoolPairConfig, "lpDecimals">): number {
  return pair.lpDecimals ?? 6;
}

export function pairHasLendingContract(
  pair: Pick<LiquidityPoolPairConfig, "lpContractId">
): boolean {
  return typeof pair.lpContractId === "number" && pair.lpContractId > 0;
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
  if (pair.lpContractId == null && pair.platform !== "myth") return null;

  for (const [key, tokenConfig] of Object.entries(tokens)) {
    if (!key.startsWith("LP_")) continue;
    const tc: TokenConfig = Array.isArray(tokenConfig)
      ? tokenConfig[0]
      : tokenConfig;
    if (!tc?.assetId || !tc.contractId) continue;
    if (String(tc.assetId) !== String(pair.lpTokenId)) continue;
    if (
      pair.lpContractId != null &&
      String(tc.contractId) !== String(pair.lpContractId)
    ) {
      continue;
    }
    if (pair.platform === "myth" && !key.startsWith("LP_MYTH_")) continue;
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

/** Lending market row for Pools page supply/withdraw (UNIT/WAD/USDC Tinyman LP or Myth LST). */
export function resolvePoolsPageLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): LiquidityPoolLendingMarket | null {
  const hasLending =
    pairHasPoolsPageLendingPosition(networkId, pair) ||
    pairHasWadLpLendingMarket(networkId, pair) ||
    pairHasUsdcLpLendingMarket(networkId, pair) ||
    pairHasMythLpLendingMarket(networkId, pair);
  if (!hasLending) return null;
  return resolveLiquidityPoolLendingMarket(networkId, pair);
}

/** True when a tester-listed `LP_MYTH_*` market matches this Myth dualSTAKE pair. */
export function pairHasMythLpLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  if (pair.platform !== "myth") return false;
  const market = resolveLiquidityPoolLendingMarket(networkId, pair);
  if (market == null || !market.configSymbol.startsWith("LP_MYTH_")) {
    return false;
  }
  return isRegisterableMythLpPoolId(market.poolId);
}

/** Lending pool app ids for listed Myth LST markets among the given curated pairs. */
export function resolveMythLendingPoolIdsForFilter(
  networkId: NetworkId,
  filteredPairs: LiquidityPoolPairConfig[]
): string[] {
  const poolIds = new Set<string>();
  for (const pair of filteredPairs) {
    if (!pairHasMythLpLendingMarket(networkId, pair)) continue;
    const market = resolveLiquidityPoolLendingMarket(networkId, pair);
    if (market?.poolId) poolIds.add(market.poolId);
  }
  return [...poolIds];
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

/** Pool ids for USDC LP global user reads on the Pools page (Pool F). */
export function resolveUsdcLendingPoolIdsForFilter(
  networkId: NetworkId,
  filteredPairs: LiquidityPoolPairConfig[]
): string[] {
  const usdcPairs = filteredPairs.filter(
    (pair) =>
      pairHasUsdcLpLendingMarket(networkId, pair) &&
      pairHasUsdcLpCollateralLendingMarket(networkId, pair)
  );
  if (usdcPairs.length === 0) return [];

  const poolF = getPoolFLendingPoolId(networkId);
  if (poolF) return [poolF];
  return resolveUsdcLendingPoolIdsForPairs(networkId, usdcPairs);
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

/** WAD borrow market paired with Pool F USDC LP collateral. */
export function resolvePoolFWadMarket(
  networkId: NetworkId
): TokenConfig | null {
  return getUsdcLpLendingWadBorrowMarketConfig(networkId);
}

/** LP lending is enabled for USDC-base Tinyman pairs on Pool F. */
export function pairHasUsdcLpLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  if (!isUsdcLpCollateralMarketContract(networkId, pair.lpContractId)) {
    return false;
  }
  return resolveLiquidityPoolLendingMarket(networkId, pair) != null;
}

/** True when the curated pair supplies USDC-base LP collateral on Pool F. */
export function pairHasUsdcLpCollateralLendingMarket(
  networkId: NetworkId,
  pair: LiquidityPoolPairConfig
): boolean {
  return isUsdcLpCollateralMarketContract(networkId, pair.lpContractId);
}

/** Lending pool app ids for USDC LP markets among the given curated pairs. */
export function resolveUsdcLendingPoolIdsForPairs(
  networkId: NetworkId,
  pairs: LiquidityPoolPairConfig[]
): string[] {
  const poolIds = new Set<string>();
  for (const pair of pairs) {
    if (!pairHasUsdcLpLendingMarket(networkId, pair)) continue;
    const market = resolveLiquidityPoolLendingMarket(networkId, pair);
    if (market?.poolId) {
      poolIds.add(market.poolId);
    }
  }
  return [...poolIds];
}
