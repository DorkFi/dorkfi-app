import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { getAllTokensWithDisplayInfo, NetworkId, getCurrentNetworkConfig, getLendingPools } from '@/config';
import { fetchMarketInfo, type MarketInfo } from '@/services/lendingService';

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
}

export type SortField = 'asset' | 'totalSupplyUSD' | 'supplyAPY' | 'totalBorrowUSD' | 'borrowAPY' | 'utilization';
export type SortOrder = 'asc' | 'desc';

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
  searchTerm = '',
  sortField = 'totalSupplyUSD',
  sortOrder = 'desc',
  pageSize = 10,
  autoLoad = true,
  throttleMs = DEFAULT_THROTTLE_MS
}: UseOnDemandMarketDataProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [marketsData, setMarketsData] = useState<Record<string, OnDemandMarketData>>({});
  const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
  const { currentNetwork } = useNetwork();
  
  // Get token configuration for current network
  const tokens = useMemo(() => getAllTokensWithDisplayInfo(currentNetwork), [currentNetwork]);

  // Initialize market data structure from tokens
  useEffect(() => {
    const initialData: Record<string, OnDemandMarketData> = {};
    
    tokens.forEach((token) => {
      const key = token.symbol.toLowerCase();
      if (!marketsData[key]) {
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
          collectorContract: '',
          isLoading: false,
          isLoaded: false,
        };
      }
    });

    if (Object.keys(initialData).length > 0) {
      setMarketsData(prev => ({ ...prev, ...initialData }));
    }
  }, [tokens, currentNetwork]);

  // Load individual market data
  const loadMarketData = useCallback(async (marketKey: string, bypassCache = false) => {
    const token = tokens.find(t => t.symbol.toLowerCase() === marketKey);
    if (!token) return;

    // Check if already loading
    if (loadingMarkets.has(marketKey)) {
      return;
    }

    // Check throttling - if not bypassing cache and recently fetched, skip
    const existingData = marketsData[marketKey];
    if (!bypassCache && existingData?.lastFetched) {
      const timeSinceLastFetch = Date.now() - existingData.lastFetched;
      if (timeSinceLastFetch < throttleMs) {
        console.log(`Market ${marketKey} throttled. Last fetched ${Math.round(timeSinceLastFetch / 1000)}s ago`);
        return;
      }
    }

    setLoadingMarkets(prev => new Set(prev).add(marketKey));
    
    try {
      // Get pool ID from network config
      const lendingPools = getLendingPools(currentNetwork);
      const poolId = lendingPools[0] || '1'; // Use first lending pool or fallback
      
      const marketInfo = await fetchMarketInfo(
        poolId,
        token.underlyingContractId || token.underlyingAssetId || token.originalContractId,
        currentNetwork
      );

      if (marketInfo) {
        const marketData: OnDemandMarketData = {
          asset: token.symbol,
          icon: token.logoPath,
          totalSupply: parseFloat(marketInfo.totalDeposits) || 0,
          totalSupplyUSD: parseFloat(marketInfo.totalDeposits) || 0, // Assuming 1:1 for now
          supplyAPY: marketInfo.supplyRate * 100,
          totalBorrow: parseFloat(marketInfo.totalBorrows) || 0,
          totalBorrowUSD: parseFloat(marketInfo.totalBorrows) || 0, // Assuming 1:1 for now
          borrowAPY: marketInfo.borrowRateCurrent * 100,
          utilization: marketInfo.utilizationRate * 100,
          collateralFactor: marketInfo.collateralFactor * 100,
          walletBalance: 0, // This would need wallet integration
          supplyCap: parseFloat(marketInfo.maxTotalDeposits) || 0,
          supplyCapUSD: parseFloat(marketInfo.maxTotalDeposits) || 0,
          maxLTV: marketInfo.collateralFactor * 100,
          liquidationThreshold: marketInfo.liquidationThreshold * 100,
          liquidationPenalty: marketInfo.liquidationBonus * 100,
          reserveFactor: marketInfo.reserveFactor * 100,
          collectorContract: '', // Not available in MarketInfo
          isLoading: false,
          isLoaded: true,
          marketInfo,
          lastFetched: Date.now(),
        };

        setMarketsData(prev => ({
          ...prev,
          [marketKey]: marketData
        }));
      } else {
        // Handle case where market info couldn't be fetched
        setMarketsData(prev => ({
          ...prev,
          [marketKey]: {
            ...prev[marketKey],
            isLoading: false,
            isLoaded: true,
            error: 'Failed to load market data',
            lastFetched: Date.now(),
          }
        }));
      }
    } catch (error) {
      console.error(`Error loading market data for ${marketKey}:`, error);
      setMarketsData(prev => ({
        ...prev,
        [marketKey]: {
          ...prev[marketKey],
          isLoading: false,
          isLoaded: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastFetched: Date.now(),
        }
      }));
    } finally {
      setLoadingMarkets(prev => {
        const newSet = new Set(prev);
        newSet.delete(marketKey);
        return newSet;
      });
    }
  }, [tokens, currentNetwork, loadingMarkets, marketsData, throttleMs]);

  // Load market data for visible markets
  const loadVisibleMarkets = useCallback((visibleMarketKeys: string[]) => {
    if (!autoLoad) return;
    
    visibleMarketKeys.forEach(marketKey => {
      if (!marketsData[marketKey]?.isLoaded && !loadingMarkets.has(marketKey)) {
        loadMarketData(marketKey);
      }
    });
  }, [autoLoad, marketsData, loadingMarkets, loadMarketData]);

  // Convert markets data to array format
  const marketDataArray = useMemo(() => {
    return Object.values(marketsData).map(market => ({
      ...market,
      isLoading: loadingMarkets.has(market.asset.toLowerCase())
    }));
  }, [marketsData, loadingMarkets]);

  // Filter and sort data
  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter data based on search term
    let filtered = marketDataArray.filter(market =>
      market.asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort data
    filtered.sort((a, b) => {
      let aValue: number | string = a[sortField];
      let bValue: number | string = b[sortField];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === 'asc') {
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
      paginatedData: paginated
    };
  }, [searchTerm, sortField, sortOrder, currentPage, pageSize, marketDataArray]);

  const handleSearchChange = (newSearchTerm: string) => {
    setCurrentPage(1);
  };

  const handleSortChange = (newSortField: SortField, newSortOrder: SortOrder) => {
    setCurrentPage(1);
  };

  // Load market data with cache bypass (for view modal, refresh, etc.)
  const loadMarketDataWithBypass = useCallback((marketKey: string) => {
    return loadMarketData(marketKey, true);
  }, [loadMarketData]);

  // Load all markets (for cases where you want to preload everything)
  const loadAllMarkets = useCallback(() => {
    Object.keys(marketsData).forEach(marketKey => {
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
