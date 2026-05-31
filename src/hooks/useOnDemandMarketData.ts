import { useState, useMemo, useCallback, useEffect } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAllTokensWithDisplayInfo,
  isMarketsTableExcludedPool,
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
import { fetchMarketInfo, type MarketInfo } from "@/services/lendingService";
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
}

// Throttle duration: 2 minute
const DEFAULT_THROTTLE_MS = 120 * 1000;

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
}: UseOnDemandMarketDataProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [marketsData, setMarketsData] = useState<
    Record<string, OnDemandMarketData>
  >({});
  const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
  const { currentNetwork } = useNetwork();
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

  // Get token configuration for current network (omit pools excluded from Markets table)
  const tokens = useMemo(
    () =>
      getAllTokensWithDisplayInfo(currentNetwork).filter(
        (token) =>
          !isMarketsTableExcludedPool(currentNetwork, token.poolId)
      ),
    [currentNetwork]
  );

  // Clear markets data when network changes
  useEffect(() => {
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

  // Load individual market data
  const loadMarketData = useCallback(
    async (marketKey: string, bypassCache = false) => {
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

      // Load all matching markets (key must match initialData: symbol-poolId as string)
      for (const token of matchingTokens) {
        const tokenMarketKey = marketRowCacheKey(token);

        // Skip if already loading this specific market
        if (loadingMarkets.has(tokenMarketKey)) {
          continue;
        }

        // Check throttling for this specific market
        const existingData = marketsData[tokenMarketKey];
        if (!bypassCache && existingData?.lastFetched) {
          const timeSinceLastFetch = Date.now() - existingData.lastFetched;
          if (timeSinceLastFetch < throttleMs) {
            console.log(
              `Market ${tokenMarketKey} throttled. Last fetched ${Math.round(
                timeSinceLastFetch / 1000
              )}s ago`
            );
            continue;
          }
        }

        setLoadingMarkets((prev) => new Set(prev).add(tokenMarketKey));

        try {
          // Use the pool ID directly from the token config
          const marketId =
            token.underlyingContractId ||
            token.underlyingAssetId ||
            token.originalContractId;
          const tokenPoolId = token.poolId;

          if (!tokenPoolId) {
            console.log(`No pool ID configured for token ${token.symbol}`);
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
            setLoadingMarkets((prev) => {
              const newSet = new Set(prev);
              newSet.delete(tokenMarketKey);
              return newSet;
            });
            continue;
          }

          console.log(
            `Loading market ${marketId} for token ${token.symbol} using pool: ${tokenPoolId}`
          );

          // Fetch market info using the configured pool ID
          // Use "contract" source when bypassing cache to get fresh blockchain data
          const marketInfo = await fetchMarketInfo(
            tokenPoolId,
            marketId,
            currentNetwork,
            bypassCache ? "contract" : "api"
          );

          if (marketInfo) {
            // Use the pool ID from the token config
            console.log(
              `Setting market data for ${token.symbol} with pool ID: ${tokenPoolId}`
            );
            // Calculate USD values using the market price
            let tokenPrice = parseFloat(marketInfo.price) || 0;
            const isWad = token.symbol.toUpperCase() === "WAD";
            if (isWad) {
              tokenPrice = normalizeWadUsdPerToken(tokenPrice);
            }
            const totalSupplyAmount = parseFloat(marketInfo.totalDeposits) || 0;
            const totalBorrowAmount = parseFloat(marketInfo.totalBorrows) || 0;
            const supplyCapAmount = parseFloat(marketInfo.maxTotalDeposits) || 0;
            const borrowCapAmount = parseFloat(marketInfo.maxTotalBorrows) || 0;

            // Get the original token config to access isStoken / Folks adapter
            const networkConfig = getNetworkConfig(currentNetwork);
            const configSymbol = token.originalSymbol ?? token.symbol;
            const tokensMapKey = tokenConfigObjectKey(token);
            const tokenConfigRaw = networkConfig.tokens[tokensMapKey];
            const tokenConfig = resolveTokenConfigFromMapEntry(
              tokenConfigRaw,
              token,
              tokenPoolId
            );

            /** On-chain totals are f-asset; for Folks markets show underlying-equivalent using minted f-asset for 1.0 underlying. */
            let totalSupplyDisplay = totalSupplyAmount;
            let totalBorrowDisplay = totalBorrowAmount;
            let supplyCapDisplay = supplyCapAmount;
            let borrowCapDisplay = borrowCapAmount;
            const folksOd = tokenConfig
              ? getAnyFolksAdapter(tokenConfig)
              : undefined;
            if (
              folksOd &&
              currentNetwork === "algorand-mainnet"
            ) {
              const algodNet = getAlgorandNetworkFromNetworkId(currentNetwork);
              if (algodNet) {
                try {
                  const clients = algorandService.initializeClients(algodNet);
                  const oneUnderlyingAtomic = BigInt(
                    new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
                  );
                  const { mintedFAsset } =
                    await estimateFolksDepositMintedFAssetAmount({
                      poolName: folksOd.folksParams.pool,
                      underlyingAmount: oneUnderlyingAtomic,
                      algod: clients.algod,
                    });
                  if (mintedFAsset > BigInt(0)) {
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
            }

            // WAD: oracle can be micro-USD per token; store TVL as micro-USD (÷1e6 in UI).
            // All other assets: legacy decimal-scaled formula (do not change — used across the app).
            const decScale =
              Math.pow(10, token.decimals + 6) / Math.pow(10, 12);
            const totalSupplyUSD = isWad
              ? Number(totalSupplyDisplay * tokenPrice * 1e6)
              : Number(totalSupplyDisplay * tokenPrice * decScale);
            const totalBorrowUSD = isWad
              ? Number(totalBorrowDisplay * tokenPrice * 1e6)
              : Number(totalBorrowDisplay * tokenPrice * decScale);
            console.log(`USD calculations for ${token.symbol}:`, {
              tokenPrice,
              totalSupplyAmount,
              totalSupplyDisplay,
              totalSupplyUSD,
              totalBorrowAmount,
              totalBorrowDisplay,
              totalBorrowUSD,
            });

            const rewardsMeta = getRewardsMetaForTokenRow(
              currentNetwork,
              tokenConfig as TokenConfig | undefined
            );

            const intrinsicApr = resolveIntrinsicSupplyApyPercentForTokenConfig(
              currentNetwork,
              tokenConfig,
              liveIntrinsicSupplyApy
            );
            const intrinsicBorrowApy =
              resolveIntrinsicBorrowApyPercentForTokenConfig(
                currentNetwork,
                tokenConfig,
                liveIntrinsicSupplyApy
              );

            // Safely resolve supplyAPY - avoid NaN when supplyRate is undefined
            const supplyAPYValue =
              (typeof marketInfo.apyCalculation?.apy === "number" &&
                !Number.isNaN(marketInfo.apyCalculation.apy))
                ? marketInfo.apyCalculation.apy
                : typeof marketInfo.supplyRate === "number" &&
                  !Number.isNaN(marketInfo.supplyRate)
                  ? marketInfo.supplyRate * 100
                  : 0;

            // Safely resolve borrowAPY - avoid NaN when borrowRateCurrent is undefined
            const borrowAPYValue =
              (typeof marketInfo.borrowApyCalculation?.apy === "number" &&
                !Number.isNaN(marketInfo.borrowApyCalculation.apy))
                ? marketInfo.borrowApyCalculation.apy
                : typeof marketInfo.borrowRateCurrent === "number" &&
                  !Number.isNaN(marketInfo.borrowRateCurrent)
                  ? marketInfo.borrowRateCurrent * 100
                  : 0;

            const marketData: OnDemandMarketData = {
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
              walletBalance: 0, // This would need wallet integration
              supplyCap: supplyCapDisplay,
              supplyCapUSD: isWad
                ? supplyCapDisplay * tokenPrice * 1e6
                : supplyCapDisplay * tokenPrice,
              borrowCap: borrowCapDisplay,
              maxLTV: marketInfo.collateralFactor * 100,
              liquidationThreshold: marketInfo.liquidationThreshold * 100,
              liquidationPenalty: marketInfo.liquidationBonus * 100,
              reserveFactor: marketInfo.reserveFactor * 100,
              collectorContract: "", // Not available in MarketInfo
              isLoading: false,
              isLoaded: true,
              marketInfo, // This contains the correct poolId for this market
              lastFetched: Date.now(),
              apyCalculation: marketInfo.apyCalculation, // Include APY calculation results
              borrowApyCalculation: marketInfo.borrowApyCalculation, // Include borrow APY calculation results
              isSToken: tokenConfig?.isStoken || false,
              poolId: tokenPoolId, // Store poolId for multi-market tokens
              isNew: token.isNew,
              ...rewardsMeta,
              intrinsicSupplyApyPercent:
                intrinsicApr > 0 ? intrinsicApr : undefined,
              intrinsicBorrowApyPercent:
                intrinsicBorrowApy > 0 ? intrinsicBorrowApy : undefined,
            };

            console.log(`Market data for ${token.symbol}:`, marketData);

            setMarketsData((prev) => ({
              ...prev,
              [tokenMarketKey]: marketData,
            }));
          } else {
            // Handle case where market info couldn't be fetched
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
          console.error(`Error loading market data for ${tokenMarketKey}:`, error);
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
          setLoadingMarkets((prev) => {
            const newSet = new Set(prev);
            newSet.delete(tokenMarketKey);
            return newSet;
          });
        }
      }
    },
    [
      tokens,
      currentNetwork,
      loadingMarkets,
      marketsData,
      throttleMs,
      liveIntrinsicSupplyApy,
    ]
  );

  // Load market data for visible markets
  const loadVisibleMarkets = useCallback(
    (visibleMarketKeys: string[]) => {
      if (!autoLoad) return;

      visibleMarketKeys.forEach((marketKey) => {
        if (
          !marketsData[marketKey]?.isLoaded &&
          !loadingMarkets.has(marketKey)
        ) {
          loadMarketData(marketKey);
        }
      });
    },
    [autoLoad, marketsData, loadingMarkets, loadMarketData]
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

  // Filter and sort data
  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter out paused markets
    let filtered = marketDataArray.filter(
      (market) => !market.marketInfo?.isPaused
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

  // Load all markets (for cases where you want to preload everything)
  const loadAllMarkets = useCallback(() => {
    Object.keys(marketsData).forEach((marketKey) => {
      if (!loadingMarkets.has(marketKey)) {
        loadMarketData(marketKey);
      }
    });
  }, [marketsData, loadingMarkets, loadMarketData]);

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
    isLoading: loadingMarkets.size > 0,
    marketsData,
    newMarketsCount,
    rewardMarketsCount,
    multiPoolMarketsCount,
    hasDMarketTab,
  };
};
