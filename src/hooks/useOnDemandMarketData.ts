import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAllTokensWithDisplayInfo,
  getMarketsTableVisibleTokensWithDisplayInfo,
  NetworkId,
  getNetworkConfig,
  getLendingPools,
  getMarketLabel,
  getRewardsProgramPublicBaseUrl,
  resolveIntrinsicSupplyApyPercent,
  resolveIntrinsicSupplyApyPercentForTokenConfig,
  resolveIntrinsicBorrowApyPercent,
  resolveIntrinsicBorrowApyPercentForTokenConfig,
  tokenRowUsesLiveIntrinsicApy,
  tokenRowUsesLiveIntrinsicBorrowApy,
  type LiveIntrinsicSupplyApySnapshot,
  getAlgorandNetworkFromNetworkId,
  type TokenConfig,
  getAnyFolksAdapter,
} from "@/config";
import {
  buildMarketInfoFromRawMarketData,
  fetchBulkApiMarketDataMap,
  fetchMarketInfo,
  marketDataLookupKey,
  type MarketData,
  type MarketInfo,
} from "@/services/lendingService";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
} from "@/services/folksDepositAdapter";
import algorandService from "@/services/algorandService";
import { normalizeWadUsdPerToken } from "@/lib/utils";
import { APYCalculationResult } from "@/utils/apyCalculations";
import BigNumber from "bignumber.js";
import { useTinymanLiquidStakingLiveApyPercent } from "@/hooks/useTinymanLiquidStakingLiveApyPercent";
import { useXalgoGovernanceLiveApyPercent } from "@/hooks/useXalgoGovernanceLiveApyPercent";
import { useFolksMainnetAlgoDepositLiveApyPercent } from "@/hooks/useFolksMainnetAlgoDepositLiveApyPercent";
import { useFolksMainnetUsdcPoolLiveApyPercent } from "@/hooks/useFolksMainnetUsdcPoolLiveApyPercent";
import { useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent } from "@/hooks/useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent";
import { useFolksMainnetFiTinyEcosystemPoolLiveApyPercent } from "@/hooks/useFolksMainnetFiTinyEcosystemPoolLiveApyPercent";
import { useFolksMainnetWbtcNttPoolLiveApyPercent } from "@/hooks/useFolksMainnetWbtcNttPoolLiveApyPercent";
import { useFolksMainnetWethNttPoolLiveApyPercent } from "@/hooks/useFolksMainnetWethNttPoolLiveApyPercent";
import { resolveTokenIconBadgeUrl } from "@/utils/tokenImageUtils";
import { withRpcReadCache, getRpcReadCache } from "@/utils/rpcReadCache";

export interface OnDemandMarketData {
  asset: string;
  /** Canonical key in `network.tokens` (e.g. `ALGO` when {@link asset} is display `Algo`). */
  configSymbol?: string;
  icon: string;
  /** Bottom-right badge on market icon (from token config `iconBadgeFromSymbol`). */
  iconBadgeUrl?: string;
  totalSupply: number;
  totalSupplyUSD: number;
  supplyAPY: number;
  totalBorrow: number;
  totalBorrowUSD: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  walletBalance: number;
  supplyCap: number;
  supplyCapUSD: number;
  borrowCap: number;
  maxLTV: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  reserveFactor: number;
  collectorContract: string;
  isLoading: boolean;
  isLoaded: boolean;
  error?: string;
  marketInfo?: MarketInfo;
  lastFetched?: number; // Timestamp of last fetch
  // APY calculation results
  apyCalculation?: APYCalculationResult;
  borrowApyCalculation?: APYCalculationResult;
  // S-token flag
  isSToken?: boolean;
  // Pool ID to identify specific market when multiple markets exist for same symbol
  poolId?: string;
  /** From token config `dataAddedAt` (recent listings). */
  isNew?: boolean;
  /** Token row participates in bonus rewards (from config). */
  hasRewards?: boolean;
  /** Resolved public origin for the rewards app (`getRewardsProgramPublicBaseUrl`). */
  rewardsPublicBaseUrlResolved?: string | null;
  /**
   * Bonus supply APR from rewards API (`targetAprAdjustedToSupplyPercent`), merged in MarketsTable.
   * Percentage points to add to on-chain supply APY for display.
   */
  rewardsBonusSupplyAprPercent?: number | null;
  /**
   * Intrinsic supply APY from token config (`intrinsicApyPercent`); percentage points added to
   * on-chain supply APY for display (e.g. governance staking).
   */
  intrinsicSupplyApyPercent?: number | null;
  /**
   * Intrinsic borrow APY from token config (`intrinsicBorrowApyPercent`); percentage points added
   * to on-chain borrow APY for display.
   */
  intrinsicBorrowApyPercent?: number | null;
  /** Cache key from `useOnDemandMarketData` (`marketsData`); unique per config row when display names collide. */
  _sortKey?: string;
}

/**
 * Stable row / cache key: canonical config symbol (not display override) + pool id (+ market contract when set).
 * Required when multiple markets share the same display name and pool (e.g. ALGO vs fALGO, legacy vs V2 wBTC).
 */
export function marketRowCacheKey(token: {
  originalSymbol?: string;
  symbol: string;
  poolId?: string | null;
  underlyingContractId?: string;
}): string {
  const sym = (token.originalSymbol ?? token.symbol).toLowerCase();
  const pool =
    token.poolId != null && String(token.poolId) !== ""
      ? String(token.poolId)
      : "";
  const contract = String(token.underlyingContractId ?? "").trim();
  if (pool !== "" && contract !== "") {
    return `${sym}-${pool}-${contract}`;
  }
  if (pool !== "") {
    return `${sym}-${pool}`;
  }
  return sym;
}

/** Parse {@link marketRowCacheKey} back into symbol / pool / optional market contract. */
export function parseMarketRowCacheKey(marketKey: string): {
  symbol: string;
  poolId?: string;
  contractId?: string;
} {
  const key = String(marketKey ?? "").trim();
  const parts = key.split("-").filter((p) => p !== "");
  const symbol = parts[0] ?? "";
  if (parts.length >= 3) {
    const contractId = parts[parts.length - 1];
    const poolId = parts.slice(1, -1).join("-");
    return { symbol, poolId, contractId };
  }
  if (parts.length === 2) {
    return { symbol, poolId: parts[1] };
  }
  return { symbol };
}

/** Market contract id encoded in {@link marketRowCacheKey} (`sym-pool-contract`), when present. */
export function marketContractIdFromRowCacheKey(
  marketRowKey: string | undefined
): string | undefined {
  const parsed = parseMarketRowCacheKey(String(marketRowKey ?? "").trim());
  const contract = parsed.contractId?.trim();
  return contract !== "" && contract != null && /^\d+$/.test(contract)
    ? contract
    : undefined;
}

/** `network.tokens` object key (e.g. `ALGO` when the row's `originalSymbol` is `fALGO`). */
function tokenConfigObjectKey(token: {
  configKey?: string;
  originalSymbol?: string;
  symbol: string;
}): string {
  return token.configKey ?? token.originalSymbol ?? token.symbol;
}

/** Several `tokens.USDC[]` rows can share the same `poolId`; match `contractId` when available. */
function resolveTokenConfigFromMapEntry(
  tokenConfigRaw: TokenConfig | TokenConfig[] | undefined,
  token: {
    poolId?: string | null;
    underlyingContractId?: string;
    originalContractId?: string;
  },
  tokenPoolIdOverride?: string
): TokenConfig | undefined {
  if (!tokenConfigRaw) return undefined;
  if (!Array.isArray(tokenConfigRaw)) return tokenConfigRaw;
  const poolStr =
    tokenPoolIdOverride != null && String(tokenPoolIdOverride) !== ""
      ? String(tokenPoolIdOverride)
      : token.poolId != null && String(token.poolId) !== ""
        ? String(token.poolId)
        : "";
  const contractStr = String(
    token.originalContractId ?? token.underlyingContractId ?? ""
  ).trim();
  if (poolStr !== "" && contractStr !== "") {
    const byBoth = tokenConfigRaw.find(
      (tc) =>
        String(tc.poolId) === poolStr &&
        String(tc.contractId ?? "").trim() === contractStr
    );
    if (byBoth) return byBoth;
  }
  if (poolStr !== "") {
    return (
      tokenConfigRaw.find((tc) => String(tc.poolId) === poolStr) ??
      tokenConfigRaw[0]
    );
  }
  return tokenConfigRaw[0];
}

/** Pool app id for filters (skeleton rows may only have `marketInfo.poolId` after load). */
export function marketRowPoolIdForFilter(m: OnDemandMarketData): string {
  const raw =
    m.poolId ??
    (m as { marketInfo?: { poolId?: string | number } }).marketInfo?.poolId;
  return raw != null && String(raw) !== "" ? String(raw) : "";
}

/** WAD sToken mint market — rendered outside the markets table as a standalone card. */
export function isWadMintMarket(market: OnDemandMarketData): boolean {
  return market.isSToken === true && market.asset === "WAD";
}

export type SortField =
  | "default"
  | "asset"
  | "totalSupplyUSD"
  | "supplyAPY"
  | "totalBorrowUSD"
  | "borrowAPY"
  | "utilization";
export type SortOrder = "asc" | "desc";

const NUMERIC_SORT_FIELDS: SortField[] = [
  "totalSupplyUSD",
  "supplyAPY",
  "totalBorrowUSD",
  "borrowAPY",
  "utilization",
];

export type MarketFilter = "all" | "A" | "B" | "D";

function getRewardsMetaForTokenRow(
  networkId: NetworkId,
  tokenConfig: TokenConfig | undefined
): {
  hasRewards?: boolean;
  rewardsPublicBaseUrlResolved: string | null;
} {
  if (!tokenConfig) {
    return { rewardsPublicBaseUrlResolved: null };
  }
  const hasRewards = tokenConfig.hasRewards === true;
  const poolId = tokenConfig.poolId;
  const contractId = tokenConfig.contractId;
  if (!hasRewards || poolId == null || contractId == null) {
    return { hasRewards, rewardsPublicBaseUrlResolved: null };
  }
  return {
    hasRewards,
    rewardsPublicBaseUrlResolved: getRewardsProgramPublicBaseUrl(
      networkId,
      poolId,
      contractId,
      tokenConfig
    ),
  };
}

interface UseOnDemandMarketDataProps {
  searchTerm?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  pageSize?: number;
  autoLoad?: boolean; // Whether to automatically load markets when they come into view
  throttleMs?: number; // Throttle duration in milliseconds (default: 1 minute)
  marketFilter?: MarketFilter; // "all" | "A" | "B" | "D" (third lending pool when configured)
  /** When true, only markets flagged as new (recent `dataAddedAt` in config) are shown. */
  newMarketsOnly?: boolean;
  /** When true, only markets with `hasRewards` in config are shown. */
  rewardMarketsOnly?: boolean;
  /** When true, only assets that have a market in more than one lending pool are shown. */
  multiPoolOnly?: boolean;
  /** Include Pool C (and other markets-table-excluded pools); use on Admin. */
  includeExcludedPools?: boolean;
}

// Throttle duration: 2 minute
const DEFAULT_THROTTLE_MS = 120 * 1000;
/** Cap parallel per-market work (oracle / Folks / API gap-fills) to avoid RPC stampedes. */
const MARKET_FETCH_CONCURRENCY = 6;
const FOLKS_MINT_RATIO_CACHE_TTL_MS = 60_000;
/** Persist last fast-paint snapshot so remounts can show data before the bulk GET returns. */
const MARKETS_SESSION_CACHE_TTL_MS = 60_000;

function folksMintRatioCacheKey(
  networkId: NetworkId,
  poolName: string,
  decimals: number
): string {
  return `folksMintRatio:${networkId}:${poolName}:${decimals}`;
}

function marketsSessionCacheKey(networkId: NetworkId): string {
  return `dorkfi:marketsHydrate:${networkId}`;
}

function readMarketsSessionCache(
  networkId: NetworkId
): Record<string, OnDemandMarketData> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(marketsSessionCacheKey(networkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: Record<string, OnDemandMarketData>;
    };
    if (
      !parsed?.savedAt ||
      !parsed.data ||
      Date.now() - parsed.savedAt > MARKETS_SESSION_CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMarketsSessionCache(
  networkId: NetworkId,
  data: Record<string, OnDemandMarketData>
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const slim: Record<string, OnDemandMarketData> = {};
    for (const [key, row] of Object.entries(data)) {
      if (row?.isLoaded && !row.error) {
        slim[key] = row;
      }
    }
    sessionStorage.setItem(
      marketsSessionCacheKey(networkId),
      JSON.stringify({ savedAt: Date.now(), data: slim })
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        await worker(items[index]);
      }
    }
  );
  await Promise.all(runners);
}

async function getCachedFolksMintedFAssetPerOneUnderlying(input: {
  poolName: string;
  decimals: number;
  networkId: NetworkId;
}): Promise<bigint | null> {
  const { poolName, decimals, networkId } = input;
  return withRpcReadCache(
    folksMintRatioCacheKey(networkId, poolName, decimals),
    async () => {
      const algodNet = getAlgorandNetworkFromNetworkId(networkId);
      if (!algodNet) return null;
      const clients = algorandService.initializeClients(algodNet);
      const oneUnderlyingAtomic = BigInt(
        new BigNumber(1).shiftedBy(decimals).toFixed(0)
      );
      const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
        poolName,
        underlyingAmount: oneUnderlyingAtomic,
        algod: clients.algod,
      });
      return mintedFAsset > BigInt(0) ? mintedFAsset : null;
    },
    FOLKS_MINT_RATIO_CACHE_TTL_MS
  );
}

export const useOnDemandMarketData = ({
  searchTerm = "",
  sortField = "default",
  sortOrder = "desc",
  pageSize = 10,
  autoLoad = true,
  throttleMs = DEFAULT_THROTTLE_MS,
  marketFilter = "all",
  newMarketsOnly = false,
  rewardMarketsOnly = false,
  multiPoolOnly = false,
  includeExcludedPools = false,
}: UseOnDemandMarketDataProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [marketsData, setMarketsData] = useState<
    Record<string, OnDemandMarketData>
  >({});
  const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
  const { currentNetwork } = useNetwork();
  const marketsDataRef = useRef(marketsData);
  marketsDataRef.current = marketsData;
  const loadingMarketsRef = useRef(loadingMarkets);
  loadingMarketsRef.current = loadingMarkets;
  /**
   * Bumped on network change and whenever a new hydrate starts so in-flight
   * async work cannot write stale rows after a switch / superseding refresh.
   */
  const marketsDataEpochRef = useRef(0);
  const algorandMainnetMarkets = currentNetwork === "algorand-mainnet";
  const tinymanLiveIntrinsicApyPct = useTinymanLiquidStakingLiveApyPercent(
    algorandMainnetMarkets
  );
  const xalgoLiveIntrinsicApyPct = useXalgoGovernanceLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksAlgoDepositLiveApyPct = useFolksMainnetAlgoDepositLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksUsdcPoolLiveApy = useFolksMainnetUsdcPoolLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksFiUsdcEcosystemLiveApy = useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksFiTinyEcosystemLiveApy = useFolksMainnetFiTinyEcosystemPoolLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksWbtcNttLiveApy = useFolksMainnetWbtcNttPoolLiveApyPercent(
    algorandMainnetMarkets
  );
  const folksWethNttLiveApy = useFolksMainnetWethNttPoolLiveApyPercent(
    algorandMainnetMarkets
  );
  const liveIntrinsicSupplyApy = useMemo<LiveIntrinsicSupplyApySnapshot>(
    () => ({
      tinymanLiquidStakingPercent: tinymanLiveIntrinsicApyPct,
      xalgoGovernanceLambdaPercent: xalgoLiveIntrinsicApyPct,
      folksMainnetAlgoDepositPercent: folksAlgoDepositLiveApyPct,
      folksMainnetUsdcDepositPercent: folksUsdcPoolLiveApy?.depositPercent ?? null,
      folksMainnetUsdcBorrowPercent: folksUsdcPoolLiveApy?.borrowPercent ?? null,
      folksMainnetFiUsdcEcosystemDepositPercent:
        folksFiUsdcEcosystemLiveApy?.depositPercent ?? null,
      folksMainnetFiUsdcEcosystemBorrowPercent:
        folksFiUsdcEcosystemLiveApy?.borrowPercent ?? null,
      folksMainnetFiTinyEcosystemDepositPercent:
        folksFiTinyEcosystemLiveApy?.depositPercent ?? null,
      folksMainnetFiTinyEcosystemBorrowPercent:
        folksFiTinyEcosystemLiveApy?.borrowPercent ?? null,
      folksMainnetWbtcNttDepositPercent:
        folksWbtcNttLiveApy?.depositPercent ?? null,
      folksMainnetWbtcNttBorrowPercent:
        folksWbtcNttLiveApy?.borrowPercent ?? null,
      folksMainnetWethNttDepositPercent:
        folksWethNttLiveApy?.depositPercent ?? null,
      folksMainnetWethNttBorrowPercent:
        folksWethNttLiveApy?.borrowPercent ?? null,
    }),
    [
      tinymanLiveIntrinsicApyPct,
      xalgoLiveIntrinsicApyPct,
      folksAlgoDepositLiveApyPct,
      folksUsdcPoolLiveApy,
      folksFiUsdcEcosystemLiveApy,
      folksFiTinyEcosystemLiveApy,
      folksWbtcNttLiveApy,
      folksWethNttLiveApy,
    ]
  );

  // Omit Pool C/E/F LP markets from the table; WAD @ those pools remains visible.
  const tokens = useMemo(
    () =>
      includeExcludedPools
        ? getAllTokensWithDisplayInfo(currentNetwork)
        : getMarketsTableVisibleTokensWithDisplayInfo(currentNetwork),
    [currentNetwork, includeExcludedPools]
  );

  // Clear markets data when network changes (invalidate in-flight hydrates/loads)
  useEffect(() => {
    marketsDataEpochRef.current += 1;
    setMarketsData({});
    setLoadingMarkets(new Set());
    setCurrentPage(1);
  }, [currentNetwork]);

  // Initialize market data structure from tokens
  useEffect(() => {
    const initialData: Record<string, OnDemandMarketData> = {};

    tokens.forEach((token) => {
      // Row id for UI / cache (may be `fALGO`); `network.tokens` key is often `ALGO` — use {@link tokenConfigObjectKey}.
      const configSymbol = token.originalSymbol ?? token.symbol;
      const tokensMapKey = tokenConfigObjectKey(token);

      const key = marketRowCacheKey(token);

      // Get the original token config to access isStoken property
      const networkConfig = getNetworkConfig(currentNetwork);
      const tokenConfigRaw = networkConfig.tokens[tokensMapKey];
      const tokenConfig = resolveTokenConfigFromMapEntry(
        tokenConfigRaw,
        token,
        undefined
      );

      const rewardsMeta = getRewardsMetaForTokenRow(
        currentNetwork,
        tokenConfig as TokenConfig | undefined
      );

      const intrinsicApr = resolveIntrinsicSupplyApyPercentForTokenConfig(
        currentNetwork,
        tokenConfig,
        liveIntrinsicSupplyApy
      );
      const intrinsicBorrowApy = resolveIntrinsicBorrowApyPercentForTokenConfig(
        currentNetwork,
        tokenConfig,
        liveIntrinsicSupplyApy
      );

      initialData[key] = {
        asset: token.symbol,
        configSymbol,
        icon: token.logoPath,
        iconBadgeUrl: resolveTokenIconBadgeUrl(
          tokenConfig?.iconBadgeFromSymbol
        ),
        totalSupply: 0,
        totalSupplyUSD: 0,
        supplyAPY: 0,
        totalBorrow: 0,
        totalBorrowUSD: 0,
        borrowAPY: 0,
        utilization: 0,
        collateralFactor: 0,
        walletBalance: 0,
        supplyCap: 0,
        supplyCapUSD: 0,
        borrowCap: 0,
        maxLTV: 0,
        liquidationThreshold: 0,
        liquidationPenalty: 0,
        reserveFactor: 0,
        collectorContract: "",
        isLoading: false,
        isLoaded: false,
        isSToken: tokenConfig?.isStoken || false,
        poolId: token.poolId, // Store poolId for multi-market tokens
        isNew: token.isNew,
        ...rewardsMeta,
        intrinsicSupplyApyPercent:
          intrinsicApr > 0 ? intrinsicApr : undefined,
        intrinsicBorrowApyPercent:
          intrinsicBorrowApy > 0 ? intrinsicBorrowApy : undefined,
      };
    });

    if (Object.keys(initialData).length > 0) {
      setMarketsData(initialData);
    }
  }, [tokens, currentNetwork]);

  useEffect(() => {
    if (currentNetwork !== "algorand-mainnet") return;
    setMarketsData((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, row] of Object.entries(prev)) {
        const sym = row.configSymbol ?? row.asset;
        const poolId =
          row.poolId != null && String(row.poolId) !== ""
            ? String(row.poolId)
            : undefined;
        const contractId = parseMarketRowCacheKey(key).contractId;
        let rowNext = row;
        const patchRow = (partial: Partial<OnDemandMarketData>) => {
          rowNext = { ...rowNext, ...partial };
          changed = true;
        };

        if (
          tokenRowUsesLiveIntrinsicApy(
            currentNetwork,
            sym,
            poolId,
            contractId
          )
        ) {
          const resolved = resolveIntrinsicSupplyApyPercent(
            currentNetwork,
            sym,
            poolId,
            liveIntrinsicSupplyApy,
            contractId
          );
          const newSupply = resolved > 0 ? resolved : undefined;
          if (rowNext.intrinsicSupplyApyPercent !== newSupply) {
            patchRow({ intrinsicSupplyApyPercent: newSupply });
          }
        }
        if (
          tokenRowUsesLiveIntrinsicBorrowApy(
            currentNetwork,
            sym,
            poolId,
            contractId
          )
        ) {
          const resolvedBorrow = resolveIntrinsicBorrowApyPercent(
            currentNetwork,
            sym,
            poolId,
            liveIntrinsicSupplyApy,
            contractId
          );
          const newBorrow =
            resolvedBorrow > 0 ? resolvedBorrow : undefined;
          if (rowNext.intrinsicBorrowApyPercent !== newBorrow) {
            patchRow({ intrinsicBorrowApyPercent: newBorrow });
          }
        }
        if (rowNext !== row) {
          next[key] = rowNext;
        }
      }
      return changed ? next : prev;
    });
  }, [currentNetwork, liveIntrinsicSupplyApy]);

  const buildOnDemandRow = useCallback(
    async (
      token: (typeof tokens)[0],
      marketInfo: MarketInfo,
      tokenPoolId: string,
      options?: { deferExtras?: boolean }
    ): Promise<OnDemandMarketData> => {
      const deferExtras = options?.deferExtras === true;
      let tokenPrice = parseFloat(marketInfo.price) || 0;
      const isWad = token.symbol.toUpperCase() === "WAD";
      if (isWad) {
        tokenPrice = normalizeWadUsdPerToken(tokenPrice);
      }
      const totalSupplyAmount = parseFloat(marketInfo.totalDeposits) || 0;
      const totalBorrowAmount = parseFloat(marketInfo.totalBorrows) || 0;
      const supplyCapAmount = parseFloat(marketInfo.maxTotalDeposits) || 0;
      const borrowCapAmount = parseFloat(marketInfo.maxTotalBorrows) || 0;

      const networkConfig = getNetworkConfig(currentNetwork);
      const configSymbol = token.originalSymbol ?? token.symbol;
      const tokensMapKey = tokenConfigObjectKey(token);
      const tokenConfigRaw = networkConfig.tokens[tokensMapKey];
      const tokenConfig = resolveTokenConfigFromMapEntry(
        tokenConfigRaw,
        token,
        tokenPoolId
      );

      let totalSupplyDisplay = totalSupplyAmount;
      let totalBorrowDisplay = totalBorrowAmount;
      let supplyCapDisplay = supplyCapAmount;
      let borrowCapDisplay = borrowCapAmount;
      const folksOd = tokenConfig ? getAnyFolksAdapter(tokenConfig) : undefined;
      if (folksOd && currentNetwork === "algorand-mainnet") {
        try {
          const cacheKey = folksMintRatioCacheKey(
            currentNetwork,
            folksOd.folksParams.pool,
            token.decimals
          );
          let mintedFAsset: bigint | null = null;
          if (deferExtras) {
            // Fast path: only use an already-warmed in-memory cache entry.
            mintedFAsset = getRpcReadCache<bigint | null>(cacheKey) ?? null;
          } else {
            mintedFAsset = await getCachedFolksMintedFAssetPerOneUnderlying({
              poolName: folksOd.folksParams.pool,
              decimals: token.decimals,
              networkId: currentNetwork,
            });
          }
          if (mintedFAsset != null && mintedFAsset > BigInt(0)) {
            const dec = token.decimals;
            totalSupplyDisplay = folksFAssetHumanToUnderlyingHuman(
              totalSupplyAmount,
              mintedFAsset,
              dec
            );
            totalBorrowDisplay = folksFAssetHumanToUnderlyingHuman(
              totalBorrowAmount,
              mintedFAsset,
              dec
            );
            supplyCapDisplay = folksFAssetHumanToUnderlyingHuman(
              supplyCapAmount,
              mintedFAsset,
              dec
            );
            borrowCapDisplay = folksFAssetHumanToUnderlyingHuman(
              borrowCapAmount,
              mintedFAsset,
              dec
            );
          }
        } catch (e) {
          console.warn(
            "Folks mint ratio for market table underlying display failed",
            { configSymbol, tokensMapKey, error: e }
          );
        }
      }

      const decScale = Math.pow(10, token.decimals + 6) / Math.pow(10, 12);
      const totalSupplyUSD = isWad
        ? Number(totalSupplyDisplay * tokenPrice * 1e6)
        : Number(totalSupplyDisplay * tokenPrice * decScale);
      const totalBorrowUSD = isWad
        ? Number(totalBorrowDisplay * tokenPrice * 1e6)
        : Number(totalBorrowDisplay * tokenPrice * decScale);

      const rewardsMeta = getRewardsMetaForTokenRow(
        currentNetwork,
        tokenConfig as TokenConfig | undefined
      );

      const intrinsicApr = resolveIntrinsicSupplyApyPercentForTokenConfig(
        currentNetwork,
        tokenConfig,
        liveIntrinsicSupplyApy
      );
      const intrinsicBorrowApy = resolveIntrinsicBorrowApyPercentForTokenConfig(
        currentNetwork,
        tokenConfig,
        liveIntrinsicSupplyApy
      );

      const supplyAPYValue =
        typeof marketInfo.apyCalculation?.apy === "number" &&
        !Number.isNaN(marketInfo.apyCalculation.apy)
          ? marketInfo.apyCalculation.apy
          : typeof marketInfo.supplyRate === "number" &&
              !Number.isNaN(marketInfo.supplyRate)
            ? marketInfo.supplyRate * 100
            : 0;

      const borrowAPYValue =
        typeof marketInfo.borrowApyCalculation?.apy === "number" &&
        !Number.isNaN(marketInfo.borrowApyCalculation.apy)
          ? marketInfo.borrowApyCalculation.apy
          : typeof marketInfo.borrowRateCurrent === "number" &&
              !Number.isNaN(marketInfo.borrowRateCurrent)
            ? marketInfo.borrowRateCurrent * 100
            : 0;

      return {
        asset: token.symbol,
        configSymbol,
        icon: token.logoPath,
        iconBadgeUrl: resolveTokenIconBadgeUrl(
          tokenConfig?.iconBadgeFromSymbol
        ),
        totalSupply: totalSupplyDisplay,
        totalSupplyUSD,
        supplyAPY: supplyAPYValue,
        totalBorrow: totalBorrowDisplay,
        totalBorrowUSD,
        borrowAPY: borrowAPYValue,
        utilization: tokenConfig?.isStoken
          ? 100.0
          : marketInfo.utilizationRate * 100,
        collateralFactor: marketInfo.collateralFactor * 100,
        walletBalance: 0,
        supplyCap: supplyCapDisplay,
        supplyCapUSD: isWad
          ? supplyCapDisplay * tokenPrice * 1e6
          : supplyCapDisplay * tokenPrice,
        borrowCap: borrowCapDisplay,
        maxLTV: marketInfo.collateralFactor * 100,
        liquidationThreshold: marketInfo.liquidationThreshold * 100,
        liquidationPenalty: marketInfo.liquidationBonus * 100,
        reserveFactor: marketInfo.reserveFactor * 100,
        collectorContract: "",
        isLoading: false,
        isLoaded: true,
        marketInfo,
        lastFetched: Date.now(),
        apyCalculation: marketInfo.apyCalculation,
        borrowApyCalculation: marketInfo.borrowApyCalculation,
        isSToken: tokenConfig?.isStoken || false,
        poolId: tokenPoolId,
        isNew: token.isNew,
        ...rewardsMeta,
        intrinsicSupplyApyPercent: intrinsicApr > 0 ? intrinsicApr : undefined,
        intrinsicBorrowApyPercent:
          intrinsicBorrowApy > 0 ? intrinsicBorrowApy : undefined,
      };
    },
    [currentNetwork, liveIntrinsicSupplyApy]
  );

  // Load individual market data
  const loadMarketData = useCallback(
    async (marketKey: string, bypassCache = false) => {
      const epoch = marketsDataEpochRef.current;
      const isCurrent = () => marketsDataEpochRef.current === epoch;

      const { symbol, poolId: poolIdFromKey, contractId: contractFromKey } =
        parseMarketRowCacheKey(marketKey);

      const canonical = (t: (typeof tokens)[0]) =>
        (t.originalSymbol ?? t.symbol).toLowerCase();

      const matchingTokens = tokens.filter((t) => {
        if (canonical(t) !== symbol.toLowerCase()) return false;
        if (poolIdFromKey != null && poolIdFromKey !== "") {
          if (String(t.poolId) !== String(poolIdFromKey)) return false;
        }
        if (contractFromKey != null && contractFromKey !== "") {
          if (String(t.underlyingContractId ?? "") !== String(contractFromKey)) {
            return false;
          }
        }
        return true;
      });

      if (matchingTokens.length === 0) return;

      for (const token of matchingTokens) {
        if (!isCurrent()) return;

        const tokenMarketKey = marketRowCacheKey(token);

        if (loadingMarketsRef.current.has(tokenMarketKey)) {
          continue;
        }

        const existingData = marketsDataRef.current[tokenMarketKey];
        if (!bypassCache && existingData?.lastFetched) {
          const timeSinceLastFetch = Date.now() - existingData.lastFetched;
          if (timeSinceLastFetch < throttleMs) {
            continue;
          }
        }

        setLoadingMarkets((prev) => new Set(prev).add(tokenMarketKey));

        try {
          const marketId =
            token.underlyingContractId ||
            token.underlyingAssetId ||
            token.originalContractId;
          const tokenPoolId = token.poolId;

          if (!tokenPoolId) {
            if (!isCurrent()) return;
            setMarketsData((prev) => ({
              ...prev,
              [tokenMarketKey]: {
                ...prev[tokenMarketKey],
                isLoading: false,
                isLoaded: true,
                error: "No pool ID configured for this token",
                lastFetched: Date.now(),
              },
            }));
            continue;
          }

          const marketInfo = await fetchMarketInfo(
            tokenPoolId,
            marketId,
            currentNetwork,
            bypassCache ? "contract" : "api"
          );
          if (!isCurrent()) return;

          if (marketInfo) {
            const marketData = await buildOnDemandRow(
              token,
              marketInfo,
              tokenPoolId
            );
            if (!isCurrent()) return;
            setMarketsData((prev) => ({
              ...prev,
              [tokenMarketKey]: marketData,
            }));
          } else {
            setMarketsData((prev) => ({
              ...prev,
              [tokenMarketKey]: {
                ...prev[tokenMarketKey],
                isLoading: false,
                isLoaded: true,
                error: "Failed to load market data",
                lastFetched: Date.now(),
              },
            }));
          }
        } catch (error) {
          if (!isCurrent()) return;
          console.error(
            `Error loading market data for ${tokenMarketKey}:`,
            error
          );
          setMarketsData((prev) => ({
            ...prev,
            [tokenMarketKey]: {
              ...prev[tokenMarketKey],
              isLoading: false,
              isLoaded: true,
              error: error instanceof Error ? error.message : "Unknown error",
              lastFetched: Date.now(),
            },
          }));
        } finally {
          if (isCurrent()) {
            setLoadingMarkets((prev) => {
              const newSet = new Set(prev);
              newSet.delete(tokenMarketKey);
              return newSet;
            });
          }
        }
      }
    },
    [tokens, currentNetwork, throttleMs, buildOnDemandRow]
  );

  /**
   * Hydrate the markets table from a single bulk API response, then gap-fill
   * any missing rows with capped concurrency.
   */
  const hydrateMarkets = useCallback(
    async (opts?: { bypassCache?: boolean }) => {
      const bypassCache = opts?.bypassCache ?? false;
      if (tokens.length === 0) return;

      const keys = tokens.map((t) => marketRowCacheKey(t));
      if (!bypassCache) {
        const allFresh = keys.every((k) => {
          const d = marketsDataRef.current[k];
          return (
            d?.isLoaded === true &&
            d.lastFetched != null &&
            Date.now() - d.lastFetched < throttleMs
          );
        });
        if (allFresh) return;
      }

      // Supersede any in-flight hydrate / per-market loads for this network.
      const epoch = ++marketsDataEpochRef.current;
      const isCurrent = () => marketsDataEpochRef.current === epoch;

      setLoadingMarkets((prev) => {
        const next = new Set(prev);
        for (const k of keys) {
          if (bypassCache || !marketsDataRef.current[k]?.isLoaded) {
            next.add(k);
          }
        }
        return next;
      });

      try {
        // Instant remount: paint last session snapshot while the bulk GET is in flight.
        if (!bypassCache) {
          const sessionCached = readMarketsSessionCache(currentNetwork);
          if (sessionCached && Object.keys(sessionCached).length > 0) {
            if (!isCurrent()) return;
            setMarketsData((prev) => ({ ...prev, ...sessionCached }));
            setLoadingMarkets((prev) => {
              const next = new Set(prev);
              for (const k of Object.keys(sessionCached)) next.delete(k);
              return next;
            });
          }
        }

        let bulkMap: Map<string, MarketData> | null = null;
        try {
          bulkMap = await fetchBulkApiMarketDataMap(currentNetwork);
        } catch (e) {
          console.warn(
            "Bulk market-data fetch failed; falling back to per-market loads",
            e
          );
        }
        if (!isCurrent()) return;

        const gapFillTokens: (typeof tokens)[0][] = [];
        type RefineJob = {
          token: (typeof tokens)[0];
          raw: MarketData;
          tokenPoolId: string;
          marketId: string;
          tokenMarketKey: string;
        };
        const refineJobs: RefineJob[] = [];
        const phaseAUpdates: Record<string, OnDemandMarketData> = {};

        // Phase A: CPU-only build from bulk API (no oracle / Folks RPC) → paint ASAP.
        for (const token of tokens) {
          if (!isCurrent()) return;

          const tokenMarketKey = marketRowCacheKey(token);
          const existing = marketsDataRef.current[tokenMarketKey];
          if (
            !bypassCache &&
            existing?.isLoaded &&
            existing.lastFetched != null &&
            Date.now() - existing.lastFetched < throttleMs
          ) {
            continue;
          }

          const marketId =
            token.underlyingContractId ||
            token.underlyingAssetId ||
            token.originalContractId;
          const tokenPoolId = token.poolId;

          if (!tokenPoolId || !marketId) {
            phaseAUpdates[tokenMarketKey] = {
              ...(existing ?? ({} as OnDemandMarketData)),
              asset: token.symbol,
              isLoading: false,
              isLoaded: true,
              error: "No pool ID configured for this token",
              lastFetched: Date.now(),
            };
            continue;
          }

          const raw = bulkMap?.get(marketDataLookupKey(tokenPoolId, marketId));
          if (!raw) {
            gapFillTokens.push(token);
            continue;
          }

          try {
            const marketInfo = await buildMarketInfoFromRawMarketData(
              raw,
              String(tokenPoolId),
              String(marketId),
              currentNetwork,
              { applyOracle: false }
            );
            if (!isCurrent()) return;
            if (!marketInfo) {
              gapFillTokens.push(token);
              continue;
            }
            phaseAUpdates[tokenMarketKey] = await buildOnDemandRow(
              token,
              marketInfo,
              String(tokenPoolId),
              { deferExtras: true }
            );
            if (!isCurrent()) return;
            refineJobs.push({
              token,
              raw,
              tokenPoolId: String(tokenPoolId),
              marketId: String(marketId),
              tokenMarketKey,
            });
          } catch (error) {
            console.error(
              `Error hydrating market ${tokenMarketKey} from bulk (phase A):`,
              error
            );
            gapFillTokens.push(token);
          }
        }

        if (!isCurrent()) return;

        if (Object.keys(phaseAUpdates).length > 0) {
          const mergedPhaseA = {
            ...marketsDataRef.current,
            ...phaseAUpdates,
          };
          setMarketsData(mergedPhaseA);
          writeMarketsSessionCache(currentNetwork, mergedPhaseA);
          setLoadingMarkets((prev) => {
            const next = new Set(prev);
            for (const k of Object.keys(phaseAUpdates)) next.delete(k);
            return next;
          });
        }

        // Phase B: refine oracle prices + Folks conversions in the background (non-blocking).
        if (refineJobs.length > 0) {
          void runWithConcurrency(
            refineJobs,
            MARKET_FETCH_CONCURRENCY,
            async (job) => {
              if (!isCurrent()) return;
              try {
                const marketInfo = await buildMarketInfoFromRawMarketData(
                  job.raw,
                  job.tokenPoolId,
                  job.marketId,
                  currentNetwork,
                  { applyOracle: true }
                );
                if (!isCurrent() || !marketInfo) return;
                const row = await buildOnDemandRow(
                  job.token,
                  marketInfo,
                  job.tokenPoolId,
                  { deferExtras: false }
                );
                if (!isCurrent()) return;
                setMarketsData((prev) => {
                  const next = { ...prev, [job.tokenMarketKey]: row };
                  return next;
                });
                writeMarketsSessionCache(currentNetwork, {
                  ...marketsDataRef.current,
                  [job.tokenMarketKey]: row,
                });
              } catch (error) {
                console.warn(
                  `Background oracle/Folks refine failed for ${job.tokenMarketKey}`,
                  error
                );
              }
            }
          );
        }

        // Gap-fill markets missing from the bulk response (capped concurrency).
        if (gapFillTokens.length > 0) {
          await runWithConcurrency(
            gapFillTokens,
            MARKET_FETCH_CONCURRENCY,
            async (token) => {
              if (!isCurrent()) return;
              const tokenMarketKey = marketRowCacheKey(token);
              const marketId =
                token.underlyingContractId ||
                token.underlyingAssetId ||
                token.originalContractId;
              const tokenPoolId = token.poolId;
              if (!tokenPoolId || !marketId) return;

              try {
                const marketInfo = await fetchMarketInfo(
                  String(tokenPoolId),
                  String(marketId),
                  currentNetwork,
                  bypassCache ? "contract" : "api"
                );
                if (!isCurrent()) return;
                if (marketInfo) {
                  const row = await buildOnDemandRow(
                    token,
                    marketInfo,
                    String(tokenPoolId)
                  );
                  if (!isCurrent()) return;
                  setMarketsData((prev) => ({
                    ...prev,
                    [tokenMarketKey]: row,
                  }));
                } else {
                  setMarketsData((prev) => ({
                    ...prev,
                    [tokenMarketKey]: {
                      ...prev[tokenMarketKey],
                      isLoading: false,
                      isLoaded: true,
                      error: "Failed to load market data",
                      lastFetched: Date.now(),
                    },
                  }));
                }
              } catch (error) {
                if (!isCurrent()) return;
                console.error(
                  `Error gap-filling market ${tokenMarketKey}:`,
                  error
                );
                setMarketsData((prev) => ({
                  ...prev,
                  [tokenMarketKey]: {
                    ...prev[tokenMarketKey],
                    isLoading: false,
                    isLoaded: true,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Unknown error",
                    lastFetched: Date.now(),
                  },
                }));
              } finally {
                if (isCurrent()) {
                  setLoadingMarkets((prev) => {
                    const next = new Set(prev);
                    next.delete(tokenMarketKey);
                    return next;
                  });
                }
              }
            }
          );
        }
      } finally {
        if (isCurrent()) {
          setLoadingMarkets((prev) => {
            const next = new Set(prev);
            for (const k of keys) next.delete(k);
            return next;
          });
        }
      }
    },
    [tokens, currentNetwork, throttleMs, buildOnDemandRow]
  );

  // Auto-hydrate once tokens are ready for the current network.
  useEffect(() => {
    if (!autoLoad) return;
    if (tokens.length === 0) return;
    void hydrateMarkets();
    // Intentionally keyed on network + token set, not hydrateMarkets identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, currentNetwork, tokens]);

  // Load market data for visible markets (progressive / page change)
  const loadVisibleMarkets = useCallback(
    (visibleMarketKeys: string[]) => {
      if (!autoLoad) return;

      const toLoad = visibleMarketKeys.filter(
        (marketKey) =>
          !marketsDataRef.current[marketKey]?.isLoaded &&
          !loadingMarketsRef.current.has(marketKey)
      );
      if (toLoad.length === 0) return;

      void runWithConcurrency(toLoad, MARKET_FETCH_CONCURRENCY, async (key) => {
        await loadMarketData(key);
      });
    },
    [autoLoad, loadMarketData]
  );

  // Convert markets data to array format (include _sortKey for stable tie-breaking)
  const marketDataArray = useMemo(() => {
    return Object.entries(marketsData).map(([key, market]) => ({
      ...market,
      isLoading: loadingMarkets.has(key),
      _sortKey: key,
    }));
  }, [marketsData, loadingMarkets]);

  /** Lending pool app ids in order: A = [0], B = [1], D = [2] when present. */
  const lendingPools = useMemo(() => {
    try {
      return getLendingPools(currentNetwork as NetworkId) ?? [];
    } catch {
      return [];
    }
  }, [currentNetwork]);

  const hasDMarketTab = useMemo(() => {
    const nid = currentNetwork as NetworkId;
    return lendingPools.some(
      (pid) => getMarketLabel(nid, String(pid)) === "D"
    );
  }, [lendingPools, currentNetwork]);

  const newMarketsCount = useMemo(() => {
    return marketDataArray.filter((market) => {
      if (!market.isNew) return false;
      if (market.marketInfo?.isPaused) return false;
      return true;
    }).length;
  }, [marketDataArray]);

  const rewardMarketsCount = useMemo(() => {
    return marketDataArray.filter((market) => {
      if (!market.hasRewards) return false;
      if (market.marketInfo?.isPaused) return false;
      return true;
    }).length;
  }, [marketDataArray]);

  /**
   * Display `asset` keys (what users see, e.g. "Algo") with more than one distinct listed market.
   * Counts: (1) same config on multiple pools, e.g. ALGO @ A + ALGO @ B, and (2) same display label
   * with different listings on the same pool, e.g. ALGO + fALGO both shown as "Algo".
   */
  const multiPoolAssetKeys = useMemo(() => {
    const rowIdsByDisplayAsset = new Map<string, Set<string>>();
    marketDataArray.forEach((m) => {
      const displayKey = m.asset.toLowerCase();
      const rowId =
        (m as { _sortKey?: string })._sortKey ??
        `${m.configSymbol ?? ""}|${m.poolId ?? ""}`;
      if (!rowIdsByDisplayAsset.has(displayKey)) {
        rowIdsByDisplayAsset.set(displayKey, new Set());
      }
      rowIdsByDisplayAsset.get(displayKey)!.add(rowId);
    });
    const multi = new Set<string>();
    rowIdsByDisplayAsset.forEach((ids, displayKey) => {
      if (ids.size > 1) multi.add(displayKey);
    });
    return multi;
  }, [marketDataArray]);

  const multiPoolMarketsCount = useMemo(() => {
    return marketDataArray.filter((market) => {
      if (!multiPoolAssetKeys.has(market.asset.toLowerCase())) return false;
      if (market.marketInfo?.isPaused) return false;
      return true;
    }).length;
  }, [marketDataArray, multiPoolAssetKeys]);

  const wadMintMarket = useMemo(() => {
    return (
      marketDataArray.find(
        (m) => isWadMintMarket(m) && !m.marketInfo?.isPaused
      ) ?? null
    );
  }, [marketDataArray]);

  // Filter and sort data
  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter out paused markets and the standalone WAD Mint card market
    let filtered = marketDataArray.filter(
      (market) => !market.marketInfo?.isPaused && !isWadMintMarket(market)
    );
    // New markets only (config-driven)
    if (newMarketsOnly) {
      filtered = filtered.filter((market) => market.isNew);
    }
    // Reward markets only (config `hasRewards`)
    if (rewardMarketsOnly) {
      filtered = filtered.filter((market) => market.hasRewards === true);
    }
    // Multi-pool: same display asset with multiple listed markets (multi-pool and/or multi-contract).
    if (multiPoolOnly) {
      filtered = filtered.filter((market) =>
        multiPoolAssetKeys.has(market.asset.toLowerCase())
      );
    }
    // Filter by market letter (A / B / D) via {@link getMarketLabel}, not raw `lendingPools` index —
    // prod has pools [A, B, D] and token/API pool ids must match the label map, not only [0]/[1].
    if (marketFilter !== "all") {
      const nid = currentNetwork as NetworkId;
      filtered = filtered.filter(
        (market) =>
          getMarketLabel(nid, marketRowPoolIdForFilter(market) || undefined) ===
          marketFilter
      );
    }
    // Filter data based on search term
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter((market) => {
      if (market.asset.toLowerCase().includes(q)) return true;
      const cs = market.configSymbol?.toLowerCase();
      return cs != null && cs !== "" && cs.includes(q);
    });

    // Sort data (with stable tie-breaker so desc is true reverse of asc)
    const isNumericField = NUMERIC_SORT_FIELDS.includes(sortField);
    const isDefaultSort = sortField === "default";
    filtered.sort((a, b) => {
      // Default sort: greater of totalSupplyUSD and totalBorrowUSD (desc = largest first)
      if (isDefaultSort) {
        const aNum = Math.max(
          Number(a.totalSupplyUSD) || 0,
          Number(a.totalBorrowUSD) || 0
        );
        const bNum = Math.max(
          Number(b.totalSupplyUSD) || 0,
          Number(b.totalBorrowUSD) || 0
        );
        let cmp = 0;
        if (aNum < bNum) cmp = -1;
        else if (aNum > bNum) cmp = 1;
        if (sortOrder === "desc") cmp = -cmp;
        if (cmp !== 0) return cmp;
        const aKey = (a as { _sortKey?: string })._sortKey ?? "";
        const bKey = (b as { _sortKey?: string })._sortKey ?? "";
        return aKey.localeCompare(bKey);
      }

      const aValue: number | string | undefined = a[sortField];
      const bValue: number | string | undefined = b[sortField];

      // Numeric fields: coerce to number so "123" sorts by value not string order; treat NaN as missing
      if (isNumericField) {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        const aMissing =
          aValue === undefined ||
          aValue === null ||
          Number.isNaN(aNum);
        const bMissing =
          bValue === undefined ||
          bValue === null ||
          Number.isNaN(bNum);
        if (aMissing && bMissing) {
          const aKey = (a as { _sortKey?: string })._sortKey ?? "";
          const bKey = (b as { _sortKey?: string })._sortKey ?? "";
          return aKey.localeCompare(bKey);
        }
        if (aMissing) return 1;
        if (bMissing) return -1;
        // Compare with explicit sign to avoid float precision issues; return -1 | 0 | 1
        let cmp = 0;
        if (aNum < bNum) cmp = -1;
        else if (aNum > bNum) cmp = 1;
        if (sortOrder === "desc") cmp = -cmp;
        if (cmp !== 0) return cmp;
      } else {
        // String field (asset): handle undefined/null, then compare lexicographically
        const aMissing = aValue === undefined || aValue === null;
        const bMissing = bValue === undefined || bValue === null;
        if (aMissing && bMissing) {
          return (a as { _sortKey?: string })._sortKey?.localeCompare((b as { _sortKey?: string })._sortKey ?? "") ?? 0;
        }
        if (aMissing) return 1;
        if (bMissing) return -1;
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        let cmp = 0;
        if (sortOrder === "asc") {
          cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          cmp = aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
        if (cmp !== 0) return cmp;
      }

      // Tie-breaker: same primary value → sort by _sortKey (asc) so order is deterministic and desc is true reverse
      const aKey = (a as { _sortKey?: string })._sortKey ?? "";
      const bKey = (b as { _sortKey?: string })._sortKey ?? "";
      return aKey.localeCompare(bKey);
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      filteredData: filtered,
      totalPages,
      paginatedData: paginated,
    };
  }, [
    searchTerm,
    sortField,
    sortOrder,
    currentPage,
    pageSize,
    marketDataArray,
    marketFilter,
    lendingPools,
    currentNetwork,
    newMarketsOnly,
    rewardMarketsOnly,
    multiPoolOnly,
    multiPoolAssetKeys,
  ]);

  const handleSearchChange = (newSearchTerm: string) => {
    setCurrentPage(1);
  };

  const handleSortChange = (
    newSortField: SortField,
    newSortOrder: SortOrder
  ) => {
    setCurrentPage(1);
  };

  // Load market data with cache bypass (for view modal, refresh, etc.)
  const loadMarketDataWithBypass = useCallback(
    (marketKey: string) => {
      return loadMarketData(marketKey, true);
    },
    [loadMarketData]
  );

  const isLoadingVisible = useMemo(() => {
    return paginatedData.some(
      (m) => m._sortKey != null && loadingMarkets.has(m._sortKey)
    );
  }, [paginatedData, loadingMarkets]);

  // Load all markets via bulk hydrate (refresh / admin).
  const loadAllMarkets = useCallback(
    (bypassCache = false) => {
      return hydrateMarkets({ bypassCache });
    },
    [hydrateMarkets]
  );

  return {
    data: paginatedData,
    totalItems: filteredData.length,
    totalPages,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handleSortChange,
    loadMarketData,
    loadMarketDataWithBypass,
    loadVisibleMarkets,
    loadAllMarkets,
    hydrateMarkets,
    isLoading: loadingMarkets.size > 0,
    isLoadingVisible,
    marketsData,
    wadMintMarket,
    newMarketsCount,
    rewardMarketsCount,
    multiPoolMarketsCount,
    hasDMarketTab,
  };
};
