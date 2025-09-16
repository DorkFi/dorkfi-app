import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NetworkId, getAllTokens, getNetworkConfig } from '@/config';
import { fetchMarketInfo } from '@/services/lendingService';
import { networkDataCache, generateCacheKey } from '@/services/networkDataCache';

export interface TLVData {
  networkId: NetworkId;
  totalValue: number;
  marketCount: number;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
}

export interface CombinedTLVData {
  totalValue: number;
  networkData: Record<NetworkId, TLVData>;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
}

export interface UseMultiNetworkTLVOptions {
  enabledNetworks: NetworkId[];
  refreshInterval?: number; // in milliseconds
  autoRefresh?: boolean;
  useCache?: boolean;
}

// Get markets from configuration - same logic as in PreFi.tsx
const getMarketsFromConfig = (networkId: NetworkId) => {
  const networkConfig = getNetworkConfig(networkId);
  const tokens = getAllTokens(networkId);

  return tokens.map((token) => {
    const tokenStandard = token.tokenStandard || 'asa';
    
    return {
      id: `${networkId}-${token.symbol}`,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      min: 0,
      max: 1_000_000_000,
      assetId: token.assetId || '0',
      contractId: token.contractId,
      poolId: token.poolId || '1',
      marketId: token.contractId || token.symbol,
      nTokenId: token.nTokenId,
      tokenStandard: tokenStandard as 'network' | 'asa' | 'arc200',
      logoPath: token.logoPath,
    };
  });
};

export const useMultiNetworkTLV = (options: UseMultiNetworkTLVOptions) => {
  const { 
    enabledNetworks, 
    refreshInterval = 30000, 
    autoRefresh = true,
    useCache = true 
  } = options;
  
  const [networkData, setNetworkData] = useState<Record<NetworkId, TLVData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Request counter for debugging (using ref to avoid dependency issues)
  const requestCountRef = useRef(0);
  const isLoadingRef = useRef(false);

  // Initialize network data structure
  useEffect(() => {
    const initialData: Record<NetworkId, TLVData> = {};
    enabledNetworks.forEach(networkId => {
      initialData[networkId] = {
        networkId,
        totalValue: 0,
        marketCount: 0,
        lastUpdated: 0,
        isLoading: false,
        error: null,
      };
    });
    setNetworkData(initialData);
  }, [enabledNetworks]);

  // Calculate TLV for a specific network
  const calculateNetworkTLV = useCallback(async (networkId: NetworkId): Promise<TLVData> => {
    const cacheKey = generateCacheKey.totalLockedValue(networkId);
    
    // Check cache first
    if (useCache) {
      const cached = networkDataCache.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached TLV data for ${networkId}: $${cached.data.totalValue.toFixed(2)}`);
        return cached.data;
      } else {
        console.log(`🔄 No cached data found for ${networkId}, fetching fresh data...`);
      }
    }

    try {
      const markets = getMarketsFromConfig(networkId);
      let totalValue = 0;
      let marketCount = 0;

      // Fetch market info for each market
      for (const market of markets) {
        try {
          console.log(`Fetching market info for ${market.symbol} on ${networkId}:`, {
            poolId: market.poolId,
            marketId: market.marketId,
            networkId
          });
          
          const marketInfo = await fetchMarketInfo(
            market.poolId,
            market.marketId,
            networkId
          );

          if (marketInfo && marketInfo.totalDeposits && marketInfo.price) {
            // totalDeposits is already normalized by lendingService.ts (divided by 10^decimals)
            const deposits = parseFloat(marketInfo.totalDeposits);
            
            // price needs additional scaling: lendingService divides by 10^18, but we need 10^6 more
            // So: price / (10^18 * 10^6) = price / 10^24
            const price = parseFloat(marketInfo.price) / Math.pow(10, 6);
            
            // Calculate market TVL: deposits * price
            const marketTVL = deposits * price;
            totalValue += marketTVL;
            marketCount++;
            
            console.log(`✅ Market ${market.symbol} on ${networkId}: deposits=${deposits}, price=$${price}, TVL=$${marketTVL.toFixed(2)}`);
          } else {
            console.warn(`⚠️ Market ${market.symbol} on ${networkId}: No valid market info`, marketInfo);
          }
        } catch (marketError) {
          console.error(`❌ Error fetching market ${market.symbol} for ${networkId}:`, marketError);
        }
      }

      const tlvData: TLVData = {
        networkId,
        totalValue,
        marketCount,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      };

      console.log(`📊 TLV calculation complete for ${networkId}: $${totalValue.toFixed(2)} (${marketCount} markets)`);

      // Cache the result
      if (useCache) {
        networkDataCache.set(cacheKey, tlvData, networkId);
        console.log(`💾 Cached TLV data for ${networkId}`);
      }

      return tlvData;

    } catch (error) {
      console.error(`Error calculating TLV for ${networkId}:`, error);
      return {
        networkId,
        totalValue: 0,
        marketCount: 0,
        lastUpdated: Date.now(),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [useCache]);

  // Load TLV data for all enabled networks
  const loadAllNetworksTLV = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      console.log('🔄 TLV load already in progress, skipping...');
      return;
    }

    requestCountRef.current += 1;
    const timestamp = new Date().toISOString();
    console.log(`🔄 TLV Request #${requestCountRef.current} at ${timestamp} - Loading data for networks:`, enabledNetworks);
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Call loadNetworkTLV directly without dependency
      await Promise.all(
        enabledNetworks.map(async (networkId) => {
          try {
            setNetworkData(prev => ({
              ...prev,
              [networkId]: {
                ...prev[networkId],
                isLoading: true,
                error: null,
              }
            }));

            const tlvData = await calculateNetworkTLV(networkId);

            setNetworkData(prev => ({
              ...prev,
              [networkId]: tlvData,
            }));

          } catch (error) {
            console.error(`Error loading TLV for ${networkId}:`, error);
            setNetworkData(prev => ({
              ...prev,
              [networkId]: {
                ...prev[networkId],
                isLoading: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            }));
          }
        })
      );
    } catch (error) {
      console.error('Error loading multi-network TLV:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [enabledNetworks, calculateNetworkTLV]);

  // Initial load
  useEffect(() => {
    loadAllNetworksTLV();
  }, [loadAllNetworksTLV]); // Include the memoized function

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadAllNetworksTLV();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadAllNetworksTLV]); // Include the memoized function

  // Refresh specific network
  const refreshNetwork = useCallback((networkId: NetworkId) => {
    // Clear cache for this network
    if (useCache) {
      networkDataCache.clearByNetwork(networkId);
    }
    // Call calculateNetworkTLV directly
    calculateNetworkTLV(networkId).then(tlvData => {
      setNetworkData(prev => ({
        ...prev,
        [networkId]: tlvData,
      }));
    }).catch(error => {
      console.error(`Error refreshing TLV for ${networkId}:`, error);
      setNetworkData(prev => ({
        ...prev,
        [networkId]: {
          ...prev[networkId],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }));
    });
  }, [useCache]);

  // Refresh all networks
  const refreshAll = () => {
    // Clear all cache
    if (useCache) {
      networkDataCache.clear();
    }
    loadAllNetworksTLV();
  };

  // Calculate combined TLV data
  const combinedData = useMemo((): CombinedTLVData => {
    let totalValue = 0;
    const networkDataMap: Record<NetworkId, TLVData> = {};
    let allLoading = true;
    let hasError = false;

    Object.values(networkData).forEach(data => {
      totalValue += data.totalValue;
      networkDataMap[data.networkId] = data;
      
      if (!data.isLoading) {
        allLoading = false;
      }
      
      if (data.error) {
        hasError = true;
      }
    });

    return {
      totalValue,
      networkData: networkDataMap,
      lastUpdated: Math.max(...Object.values(networkData).map(d => d.lastUpdated)),
      isLoading: allLoading,
      error: hasError ? 'Some networks have errors' : null,
    };
  }, [networkData]);

  return {
    networkData,
    combinedData,
    isLoading,
    error,
    refreshNetwork,
    refreshAll,
  };
};

// Hook for getting TLV data from a specific network
export const useNetworkTLV = (networkId: NetworkId) => {
  const enabledNetworks = useMemo(() => [networkId], [networkId]);
  const { networkData, refreshNetwork } = useMultiNetworkTLV({
    enabledNetworks,
  });

  return {
    data: networkData[networkId],
    refresh: () => refreshNetwork(networkId),
  };
};
