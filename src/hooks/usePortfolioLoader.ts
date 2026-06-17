import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  collectPositionMarketKeys,
  fetchAllMarkets,
  fetchUserDataFromChain,
  postRefreshMarketDataSnapshot,
} from "@/services/lendingService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import {
  filterPortfolioVisibleMarketRows,
  getEnabledNetworks,
  type NetworkId,
} from "@/config";
import { marketsQueryOptions } from "@/hooks/marketQueryKeys";
import {
  applyPortfolioUserComputed,
  extractUserProfileAvatar,
} from "@/utils/portfolioUserComputed";

type PortfolioUser = Record<string, unknown>;

export interface UsePortfolioLoaderArgs {
  displayAddress: string | undefined;
  setUser: (user: PortfolioUser | null) => void;
  setMarketData: (data: unknown[]) => void;
  setUserProfileAvatar: (avatar: string | null) => void;
  setIsLoadingData: (loading: boolean) => void;
  setIsLoadingPositions: (loading: boolean) => void;
}

async function fetchMarketsForAllNetworks(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<unknown[]> {
  const enabledNetworks = getEnabledNetworks();
  const results = await Promise.all(
    enabledNetworks.map(async (networkId) => {
      const markets = await queryClient.fetchQuery(
        marketsQueryOptions(networkId as NetworkId)
      );
      return filterPortfolioVisibleMarketRows(
        networkId as NetworkId,
        markets
      );
    })
  );
  return results.flat();
}

async function refreshPositionMarkets(
  computed:
    | {
        deposits?: Record<string, unknown>[];
        borrows?: Record<string, unknown>[];
      }
    | undefined
): Promise<void> {
  const rows = [
    ...(computed?.deposits ?? []),
    ...(computed?.borrows ?? []),
  ];
  const keys = collectPositionMarketKeys(rows);
  if (keys.length === 0) return;

  await Promise.all(
    keys.map((k) =>
      postRefreshMarketDataSnapshot(k.networkId, k.poolId, k.marketId)
    )
  );
}

async function resolveUserFromApiOrChain(
  displayAddress: string
): Promise<PortfolioUser | null> {
  const apiResponse = await dorkfiAPIService.getUser(displayAddress);
  if (apiResponse.success && apiResponse.data) {
    return applyPortfolioUserComputed(
      apiResponse.data as Record<string, unknown>
    );
  }

  const chain = await fetchUserDataFromChain(displayAddress);
  if (!chain) return null;

  return applyPortfolioUserComputed({
    address: displayAddress,
    globalUserData: chain.globalUserData,
    userData: chain.userData,
    userDataSource: "chain",
  });
}

/**
 * Orchestrates portfolio load: parallel user + markets, then scoped POST refresh for positions.
 */
export function usePortfolioLoader({
  displayAddress,
  setUser,
  setMarketData,
  setUserProfileAvatar,
  setIsLoadingData,
  setIsLoadingPositions,
}: UsePortfolioLoaderArgs) {
  const queryClient = useQueryClient();
  const loadIdRef = useRef(0);

  const invalidateMarketsCache = useCallback(() => {
    for (const networkId of getEnabledNetworks()) {
      void queryClient.invalidateQueries({
        queryKey: marketsQueryOptions(networkId as NetworkId).queryKey,
      });
    }
  }, [queryClient]);

  const loadPortfolio = useCallback(
    async (address: string) => {
      const loadId = ++loadIdRef.current;

      setUser(null);
      setMarketData([]);
      setUserProfileAvatar(null);
      setIsLoadingData(true);
      setIsLoadingPositions(false);

      try {
        const [computedUser, initialMarkets] = await Promise.all([
          resolveUserFromApiOrChain(address),
          fetchMarketsForAllNetworks(queryClient),
        ]);

        if (loadId !== loadIdRef.current) return;

        if (computedUser) {
          setUser(computedUser);
          const avatar = extractUserProfileAvatar(computedUser);
          setUserProfileAvatar(avatar);
        }

        setMarketData(initialMarkets);
        setIsLoadingData(false);

        const computed = computedUser?.computed as
          | {
              deposits?: Record<string, unknown>[];
              borrows?: Record<string, unknown>[];
            }
          | undefined;

        const positionKeys = collectPositionMarketKeys([
          ...(computed?.deposits ?? []),
          ...(computed?.borrows ?? []),
        ]);

        if (positionKeys.length === 0) return;

        setIsLoadingPositions(true);
        await refreshPositionMarkets(computed);
        if (loadId !== loadIdRef.current) return;

        invalidateMarketsCache();
        const refreshedMarkets = await fetchMarketsForAllNetworks(queryClient);
        if (loadId !== loadIdRef.current) return;

        setMarketData(refreshedMarkets);
      } catch (error) {
        console.error("[usePortfolioLoader] load failed:", error);
        if (loadId === loadIdRef.current) {
          setIsLoadingData(false);
        }
      } finally {
        if (loadId === loadIdRef.current) {
          setIsLoadingPositions(false);
        }
      }
    },
    [
      invalidateMarketsCache,
      queryClient,
      setIsLoadingData,
      setIsLoadingPositions,
      setMarketData,
      setUser,
      setUserProfileAvatar,
    ]
  );

  useEffect(() => {
    if (!displayAddress) {
      loadIdRef.current += 1;
      setUser(null);
      setMarketData([]);
      setUserProfileAvatar(null);
      setIsLoadingData(false);
      setIsLoadingPositions(false);
      return;
    }

    void loadPortfolio(displayAddress);
  }, [
    displayAddress,
    loadPortfolio,
    setIsLoadingData,
    setIsLoadingPositions,
    setMarketData,
    setUser,
    setUserProfileAvatar,
  ]);

  return { reloadPortfolio: loadPortfolio, invalidateMarketsCache };
}
