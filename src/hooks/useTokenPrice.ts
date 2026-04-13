import { useState, useEffect, useCallback } from 'react';
import { fetchMarketInfo } from '@/services/lendingService';
import { getAllTokensWithDisplayInfo } from '@/config';
import { useNetwork } from '@/contexts/NetworkContext';
import { usdPerTokenFromMarketInfoFormattedPrice } from '@/utils/assetDecimals';

/**
 * Same USD/token as Portfolio tables and wallet lines: `MarketInfo.price` is already ÷1e18
 * in lendingService; we then apply 12 − tokenDecimals (e.g. ÷1e4 for 8-dec UNIT, ÷1e6 for 6-dec USDC).
 */
function usdPerTokenFromMarketInfo(
  marketInfo: { price: string },
  tokenDecimals: number
): number | null {
  const usd = usdPerTokenFromMarketInfoFormattedPrice(
    marketInfo.price,
    tokenDecimals
  );
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return usd;
}

interface UseTokenPriceResult {
  price: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTokenPrice = (tokenSymbol: string, networkId?: string): UseTokenPriceResult => {
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currentNetwork } = useNetwork();

  const fetchPrice = useCallback(async () => {
    if (!tokenSymbol) {
      setPrice(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use provided networkId or fallback to currentNetwork
      const networkToUse = networkId || currentNetwork;
      
      if (!networkToUse) {
        throw new Error('No network specified');
      }

      // Get token configuration to find pool and market IDs
      const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
      const token = tokens.find(t => t.symbol === tokenSymbol);
      
      if (!token || !token.poolId || !token.underlyingContractId) {
        // If token not found in specified network, try other enabled networks
        if (!networkId) {
          // Only try other networks if networkId wasn't explicitly provided
          const { getEnabledNetworks } = await import('@/config');
          const enabledNetworks = getEnabledNetworks();
          
          for (const network of enabledNetworks) {
            if (network === networkToUse) continue; // Skip the one we already tried
            
            const otherTokens = getAllTokensWithDisplayInfo(network as any);
            const otherToken = otherTokens.find(t => t.symbol === tokenSymbol);
            
            if (otherToken && otherToken.poolId && otherToken.underlyingContractId) {
              // Found token in another network, use that network
              const marketInfo = await fetchMarketInfo(
                otherToken.poolId,
                otherToken.underlyingContractId,
                network
              );
              const decimals = otherToken.decimals ?? 6;
              if (marketInfo) {
                const marketPrice = usdPerTokenFromMarketInfo(marketInfo, decimals);
                if (marketPrice != null && marketPrice > 0) {
                  console.log(`Market price for ${tokenSymbol} on ${network}: $${marketPrice}`);
                  setPrice(marketPrice);
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
        }
        
        throw new Error(`Token ${tokenSymbol} not found or missing configuration`);
      }

      // Fetch market info to get the real market price
      const marketInfo = await fetchMarketInfo(
        token.poolId,
        token.underlyingContractId,
        networkToUse
      );

      const decimals = token.decimals ?? 6;
      if (marketInfo) {
        const marketPrice = usdPerTokenFromMarketInfo(marketInfo, decimals);
        if (marketPrice != null && marketPrice > 0) {
          console.log(`Market price for ${tokenSymbol}: $${marketPrice} (decimals=${decimals})`);
          setPrice(marketPrice);
        } else {
          throw new Error(`No market price data available for ${tokenSymbol}`);
        }
      } else {
        throw new Error(`No market price data available for ${tokenSymbol}`);
      }
    } catch (err) {
      console.error(`Error fetching market price for ${tokenSymbol}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market price');
      
      // Fallback to mock prices
      const mockPrices: Record<string, number> = {
        'VOI': 0.05,
        'UNIT': 0.1,
        'USDC': 1.0,
        'BTC': 45000,
        'ETH': 3000,
        'ALGO': 0.2,
        'POW': 0.01,
        'cbBTC': 45000,
        'USDT': 1.0,
        'DAI': 1.0
      };
      
      setPrice(mockPrices[tokenSymbol] || 1.0);
    } finally {
      setIsLoading(false);
    }
  }, [tokenSymbol, networkId, currentNetwork]);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  const refetch = useCallback(() => {
    fetchPrice();
  }, [fetchPrice]);

  return {
    price,
    isLoading,
    error,
    refetch
  };
};
