import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMarketInfo } from '@/services/lendingService';
import { getAllTokensWithDisplayInfo } from '@/config';
import { useNetwork } from '@/contexts/NetworkContext';
import { resolveUsdPerTokenFromMarketInfo } from '@/utils/assetDecimals';
import { overlayUsdWithDisplayPrice } from '@/utils/displayUsdPerToken';
import { resolveAsaIdForDisplayUsd } from '@/utils/resolveAsaIdForDisplayUsd';
import { useDisplayAssetUsdMap } from '@/hooks/useDisplayAssetUsdMap';
import { withRpcReadCache } from '@/utils/rpcReadCache';

interface UseTokenPriceResult {
  price: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const TOKEN_PRICE_CACHE_TTL_MS = 60_000;

async function fetchTokenPriceUsd(
  tokenSymbol: string,
  networkToUse: string
): Promise<number> {
  const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
  const token = tokens.find(t => t.symbol === tokenSymbol);

  if (!token || !token.poolId || !token.underlyingContractId) {
    const { getEnabledNetworks } = await import('@/config');
    const enabledNetworks = getEnabledNetworks();

    for (const network of enabledNetworks) {
      if (network === networkToUse) continue;

      const otherTokens = getAllTokensWithDisplayInfo(network as any);
      const otherToken = otherTokens.find(t => t.symbol === tokenSymbol);

      if (otherToken && otherToken.poolId && otherToken.underlyingContractId) {
        const marketInfo = await fetchMarketInfo(
          otherToken.poolId,
          otherToken.underlyingContractId,
          network
        );
        const decimals = otherToken.decimals ?? 6;
        if (marketInfo) {
          const usd = resolveUsdPerTokenFromMarketInfo(marketInfo, decimals);
          const marketPrice = Number.isFinite(usd) && usd > 0 ? usd : null;
          if (marketPrice != null && marketPrice > 0) {
            return marketPrice;
          }
        }
      }
    }

    throw new Error(`Token ${tokenSymbol} not found or missing configuration`);
  }

  const marketInfo = await fetchMarketInfo(
    token.poolId,
    token.underlyingContractId,
    networkToUse
  );

  const decimals = token.decimals ?? 6;
  if (marketInfo) {
    const usd = resolveUsdPerTokenFromMarketInfo(marketInfo, decimals);
    const marketPrice = Number.isFinite(usd) && usd > 0 ? usd : null;
    if (marketPrice != null && marketPrice > 0) {
      return marketPrice;
    }
  }

  throw new Error(`No market price data available for ${tokenSymbol}`);
}

export const useTokenPrice = (tokenSymbol: string, networkId?: string): UseTokenPriceResult => {
  const [protocolPrice, setProtocolPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currentNetwork } = useNetwork();
  const networkToUse = networkId || currentNetwork;

  const asaId = useMemo(() => {
    if (!tokenSymbol || networkToUse !== "algorand-mainnet") return null;
    return resolveAsaIdForDisplayUsd({
      networkId: networkToUse,
      configKey: tokenSymbol,
      displaySymbol: tokenSymbol,
    });
  }, [tokenSymbol, networkToUse]);

  const asaIds = useMemo(() => (asaId != null ? [asaId] : []), [asaId]);
  const dexUsdByAsaId = useDisplayAssetUsdMap(
    asaIds,
    asaId != null
  );

  const fetchPrice = useCallback(async () => {
    if (!tokenSymbol) {
      setProtocolPrice(0);
      return;
    }

    if (!networkToUse) {
      setError('No network specified');
      return;
    }

    setIsLoading(true);
    setError(null);

    const cacheKey = `tokenPrice:${networkToUse}:${tokenSymbol}`;

    try {
      const marketPrice = await withRpcReadCache(
        cacheKey,
        () => fetchTokenPriceUsd(tokenSymbol, networkToUse),
        TOKEN_PRICE_CACHE_TTL_MS
      );
      setProtocolPrice(marketPrice);
    } catch (err) {
      console.error(`Error fetching market price for ${tokenSymbol}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market price');

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

      setProtocolPrice(mockPrices[tokenSymbol] || 1.0);
    } finally {
      setIsLoading(false);
    }
  }, [tokenSymbol, networkToUse]);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  const refetch = useCallback(() => {
    fetchPrice();
  }, [fetchPrice]);

  const price = overlayUsdWithDisplayPrice(
    protocolPrice,
    asaId != null ? dexUsdByAsaId.get(asaId) : undefined
  );

  return {
    price,
    isLoading,
    error,
    refetch
  };
};
