import { useState, useMemo, useCallback, useEffect } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAllTokensWithDisplayInfo,
  NetworkId,
  getNetworkConfig,
  getLendingPools,
} from "@/config";
import { fetchMarketInfo, type MarketInfo } from "@/services/lendingService";
import { APYCalculationResult } from "@/utils/apyCalculations";

export interface OnDemandMarketData {
  asset: string;
  icon: string;
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

export type MarketFilter = "all" | "A" | "B";

interface UseOnDemandMarketDataProps {
  searchTerm?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  pageSize?: number;
  autoLoad?: boolean; // Whether to automatically load markets when they come into view
  throttleMs?: number; // Throttle duration in milliseconds (default: 1 minute)
  marketFilter?: MarketFilter; // "all" | "A" (first lending pool) | "B" (second lending pool)
}

// Throttle duration: 1 minute
const DEFAULT_THROTTLE_MS = 60 * 1000;

export const useOnDemandMarketData = ({
  searchTerm = "",
  sortField = "default",
  sortOrder = "desc",
  pageSize = 10,
  autoLoad = true,
  throttleMs = DEFAULT_THROTTLE_MS,
  marketFilter = "all",
}: UseOnDemandMarketDataProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [marketsData, setMarketsData] = useState<
    Record<string, OnDemandMarketData>
  >({});
  const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
  const { currentNetwork } = useNetwork();

  // Get token configuration for current network
  const tokens = useMemo(
    () => getAllTokensWithDisplayInfo(currentNetwork),
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
      // Use poolId in key to support multiple markets per symbol (e.g. 2 WAD markets)
      const key =
        token.poolId != null && token.poolId !== ""
          ? `${token.symbol.toLowerCase()}-${String(token.poolId)}`
          : token.symbol.toLowerCase();

      // Get the original token config to access isStoken property
      const networkConfig = getNetworkConfig(currentNetwork);
      const tokenConfigRaw = networkConfig.tokens[token.symbol];
      // Compare poolIds as strings to ensure exact match
      const tokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw.find((tc) => String(tc.poolId) === String(token.poolId)) || tokenConfigRaw[0]
        : tokenConfigRaw;

      initialData[key] = {
        asset: token.symbol,
        icon: token.logoPath,
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
        maxLTV: 0,
        liquidationThreshold: 0,
        liquidationPenalty: 0,
        reserveFactor: 0,
        collectorContract: "",
        isLoading: false,
        isLoaded: false,
        isSToken: tokenConfig?.isStoken || false,
        poolId: token.poolId, // Store poolId for multi-market tokens
      };
    });

    if (Object.keys(initialData).length > 0) {
      setMarketsData(initialData);
    }
  }, [tokens, currentNetwork]);

  // Load individual market data
  const loadMarketData = useCallback(
    async (marketKey: string, bypassCache = false) => {
      // Parse marketKey to handle both old format (symbol) and new format (symbol-poolId)
      const parts = marketKey.split('-');
      const symbol = parts[0];
      const poolIdFromKey = parts.length > 1 ? parts.slice(1).join('-') : undefined;

      // Find matching tokens (compare poolId as string so "123" and 123 both match – e.g. 2 WAD markets)
      const matchingTokens = tokens.filter((t) => {
        const matchesSymbol = t.symbol.toLowerCase() === symbol.toLowerCase();
        if (poolIdFromKey != null && poolIdFromKey !== "") {
          return matchesSymbol && String(t.poolId) === String(poolIdFromKey);
        }
        return matchesSymbol;
      });

      if (matchingTokens.length === 0) return;

      // Load all matching markets (key must match initialData: symbol-poolId as string)
      for (const token of matchingTokens) {
        const tokenMarketKey =
          token.poolId != null && token.poolId !== ""
            ? `${token.symbol.toLowerCase()}-${String(token.poolId)}`
            : token.symbol.toLowerCase();

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
            const tokenPrice = parseFloat(marketInfo.price) || 0;
            const totalSupplyAmount = parseFloat(marketInfo.totalDeposits) || 0;
            const totalBorrowAmount = parseFloat(marketInfo.totalBorrows) || 0;
            const supplyCapAmount = parseFloat(marketInfo.maxTotalDeposits) || 0;

            console.log(`USD calculations for ${token.symbol}:`, {
              tokenPrice,
              totalSupplyAmount,
              totalSupplyUSD: totalSupplyAmount * tokenPrice * Math.pow(10, token.decimals + 6) / Math.pow(10, 12),
              totalBorrowAmount,
              totalBorrowUSD: totalBorrowAmount * tokenPrice * Math.pow(10, token.decimals + 6) / Math.pow(10, 12),
            });

            // Get the original token config to access isStoken property
            const networkConfig = getNetworkConfig(currentNetwork);
            const tokenConfigRaw = networkConfig.tokens[token.symbol];
            const tokenConfig = Array.isArray(tokenConfigRaw)
              ? tokenConfigRaw.find((tc) => tc.poolId === tokenPoolId) || tokenConfigRaw[0]
              : tokenConfigRaw;

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
              icon: token.logoPath,
              totalSupply: totalSupplyAmount,
              totalSupplyUSD: Number(totalSupplyAmount * tokenPrice * Math.pow(10, token.decimals + 6) / Math.pow(10, 12)),
              supplyAPY: supplyAPYValue,
              totalBorrow: totalBorrowAmount,
              totalBorrowUSD: totalBorrowAmount * tokenPrice * Math.pow(10, token.decimals + 6) / Math.pow(10, 12),
              borrowAPY: borrowAPYValue,
              utilization: tokenConfig?.isStoken
                ? 100.0
                : marketInfo.utilizationRate * 100,
              collateralFactor: marketInfo.collateralFactor * 100,
              walletBalance: 0, // This would need wallet integration
              supplyCap: supplyCapAmount,
              supplyCapUSD: supplyCapAmount * tokenPrice,
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
    [tokens, currentNetwork, loadingMarkets, marketsData, throttleMs]
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

  // Lending pool IDs for A/B filter (first = A, second = B)
  const lendingPools = useMemo(() => {
    try {
      return getLendingPools(currentNetwork as NetworkId) ?? [];
    } catch {
      return [];
    }
  }, [currentNetwork]);

  // Filter and sort data
  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter out paused markets
    let filtered = marketDataArray.filter(
      (market) => !market.marketInfo?.isPaused
    );
    // Filter by market (All / A / B)
    if (marketFilter !== "all" && lendingPools.length >= 2) {
      const poolIdA = lendingPools[0];
      const poolIdB = lendingPools[1];
      filtered = filtered.filter((market) => {
        const pid = market.poolId != null ? String(market.poolId) : "";
        if (marketFilter === "A") return pid === String(poolIdA);
        if (marketFilter === "B") return pid === String(poolIdB);
        return true;
      });
    }
    // Filter data based on search term
    filtered = filtered.filter((market) =>
      market.asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
  };
};
