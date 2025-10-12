import { useState, useEffect, useCallback } from 'react';
import { fetchMarketInfo } from '@/services/lendingService';
import { getAllTokensWithDisplayInfo } from '@/config';
import { useNetwork } from '@/contexts/NetworkContext';

interface UseTokenPriceResult {
  price: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTokenPrice = (tokenSymbol: string): UseTokenPriceResult => {
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
      // Get token configuration to find pool and market IDs
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find(t => t.symbol === tokenSymbol);
      
      if (!token || !token.poolId || !token.underlyingContractId) {
        throw new Error(`Token ${tokenSymbol} not found or missing configuration`);
      }

      // Fetch market info to get the real market price
      const marketInfo = await fetchMarketInfo(
        token.poolId,
        token.underlyingContractId,
        currentNetwork
      );

      if (marketInfo && marketInfo.price) {
        // Market prices are scaled by 10^6, so we need to divide by 10^6 to get USD price
        const scaledPrice = parseFloat(marketInfo.price);
        const marketPrice = scaledPrice / Math.pow(10, 6);
        
        console.log(`Market price for ${tokenSymbol}: $${marketPrice} (scaled by 10^6)`);
        setPrice(marketPrice);
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
  }, [tokenSymbol, currentNetwork]);

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
