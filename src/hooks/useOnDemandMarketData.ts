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
  | "asset"
  | "totalSupplyUSD"
  | "supplyAPY"
  | "totalBorrowUSD"
  | "borrowAPY"
  | "utilization";
export type SortOrder = "asc" | "desc";

interface UseOnDemandMarketDataProps {
  searchTerm?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  pageSize?: number;
  autoLoad?: boolean; // Whether to automatically load markets when they come into view
  throttleMs?: number; // Throttle duration in milliseconds (default: 1 minute)
}

// Throttle duration: 1 minute
const DEFAULT_THROTTLE_MS = 60 * 1000;

export const useOnDemandMarketData = ({
  searchTerm = "",
  sortField = "totalSupplyUSD",
  sortOrder = "desc",
  pageSize = 10,
  autoLoad = true,
  throttleMs = DEFAULT_THROTTLE_MS,
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
      // Use poolId in key to support multiple markets per symbol
      const key = token.poolId 
        ? `${token.symbol.toLowerCase()}-${token.poolId}`
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
      const poolId = parts.length > 1 ? parts.slice(1).join('-') : undefined;
      
      // Find matching tokens
      const matchingTokens = tokens.filter((t) => {
        const matchesSymbol = t.symbol.toLowerCase() === symbol.toLowerCase();
        if (poolId) {
          return matchesSymbol && t.poolId === poolId;
        }
        return matchesSymbol;
      });
      
      if (matchingTokens.length === 0) return;
      
      // Load all matching markets
      for (const token of matchingTokens) {
        const tokenMarketKey = token.poolId 
          ? `${token.symbol.toLowerCase()}-${token.poolId}`
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
              totalSupplyUSD: totalSupplyAmount * tokenPrice,
              totalBorrowAmount,
              totalBorrowUSD: totalBorrowAmount * tokenPrice,
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
              totalSupplyUSD:
                (totalSupplyAmount * tokenPrice * Math.pow(10, token.decimals)) /
                Math.pow(10, 6),
              supplyAPY: supplyAPYValue,
              totalBorrow: totalBorrowAmount,
              totalBorrowUSD:
                (totalBorrowAmount * tokenPrice * Math.pow(10, token.decimals)) /
                Math.pow(10, 6),
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

  // Convert markets data to array format
  const marketDataArray = useMemo(() => {
    return Object.entries(marketsData).map(([key, market]) => ({
      ...market,
      isLoading: loadingMarkets.has(key),
    }));
  }, [marketsData, loadingMarkets]);

  // Filter and sort data
  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter data based on search term
    let filtered = marketDataArray.filter((market) =>
      market.asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort data
    filtered.sort((a, b) => {
      let aValue: number | string = a[sortField];
      let bValue: number | string = b[sortField];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
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
