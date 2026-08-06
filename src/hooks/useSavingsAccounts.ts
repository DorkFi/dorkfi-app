import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { NetworkId } from "@/config";
import { useWadUsdcTinymanApyPercent } from "@/hooks/useWadUsdcTinymanApyPercent";
import {
  listCoreSavingsAssetConfigKeys,
  listHighYieldSavingsAssetConfigKeys,
  resolveSavingsRoute,
} from "@/services/savingsRouteResolver";
import {
  isLeveragedWadUsdcRoute,
  LEVERAGED_WAD_USDC_SAVINGS_KEY,
} from "@/services/leveragedWadLpService";
import type { SavingsRoute } from "@/types/easySavings";
import { fetchMarketInfo, type MarketInfo } from "@/services/lendingService";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";

export type SavingsAccountRow = {
  route: SavingsRoute;
  apy: number | null;
  totalDeposits: number | null;
  supplyCap: number | null;
  price: number | null;
  tvlUsd: number | null;
  isLoading: boolean;
  isHighYield: boolean;
};

function parseHuman(cap: string | undefined): number | null {
  if (cap == null || cap === "") return null;
  const n = parseFloat(cap);
  return Number.isFinite(n) ? n : null;
}

function apyFromMarket(market: MarketInfo | null | undefined): number | null {
  if (!market) return null;
  const apy = market.apyCalculation?.apy;
  if (apy != null && Number.isFinite(apy)) return apy;
  if (market.supplyRate != null && Number.isFinite(market.supplyRate)) {
    return market.supplyRate * 100;
  }
  return null;
}

function routesForKeys(
  networkId: NetworkId,
  keys: string[]
): SavingsRoute[] {
  const out: SavingsRoute[] = [];
  for (const key of keys) {
    const route = resolveSavingsRoute({
      networkId,
      assetConfigKey: key,
    });
    if (route) out.push(route);
  }
  return out;
}

function toRows(
  routes: SavingsRoute[],
  queries: Array<{ data?: MarketInfo; isLoading?: boolean }>,
  offset: number,
  isHighYield: boolean,
  wadUsdcTinyman?: { apyPercent: number | null; isLoading: boolean }
): SavingsAccountRow[] {
  return routes.map((route, i) => {
    const q = queries[offset + i];
    const market = q?.data ?? null;
    const price =
      market != null
        ? (() => {
            const priceRaw = usdPerTokenFromMarketInfoPrice(
              market.price,
              route.asset.decimals
            );
            return Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null;
          })()
        : null;
    const totalDeposits = parseHuman(market?.totalDeposits);
    const supplyCap = parseHuman(market?.maxTotalDeposits);
    const tvlUsd =
      totalDeposits != null && price != null ? totalDeposits * price : null;

    const marketApy = apyFromMarket(market);
    const isWadUsdc = isLeveragedWadUsdcRoute(route.asset.configKey);
    const apy = isWadUsdc
      ? wadUsdcTinyman?.apyPercent ??
        (wadUsdcTinyman?.isLoading ? null : marketApy)
      : marketApy;

    return {
      route,
      apy,
      totalDeposits,
      supplyCap,
      price,
      tvlUsd,
      isLoading:
        Boolean(q?.isLoading) ||
        Boolean(isWadUsdc && wadUsdcTinyman?.isLoading),
      isHighYield,
    };
  });
}

/**
 * Sidebar account lists for Easy Savings — core single-asset + high-yield LPs.
 */
export function useSavingsAccounts(networkId: NetworkId): {
  core: SavingsAccountRow[];
  highYield: SavingsAccountRow[];
  all: SavingsAccountRow[];
} {
  const coreRoutes = useMemo(
    () => routesForKeys(networkId, listCoreSavingsAssetConfigKeys(networkId)),
    [networkId]
  );
  const highYieldRoutes = useMemo(
    () =>
      routesForKeys(networkId, listHighYieldSavingsAssetConfigKeys(networkId)),
    [networkId]
  );

  const allRoutes = useMemo(
    () => [...coreRoutes, ...highYieldRoutes],
    [coreRoutes, highYieldRoutes]
  );

  const needsWadUsdcTinyman = highYieldRoutes.some(
    (r) => r.asset.configKey === LEVERAGED_WAD_USDC_SAVINGS_KEY
  );
  const wadUsdcTinyman = useWadUsdcTinymanApyPercent(
    networkId,
    needsWadUsdcTinyman
  );

  const queries = useQueries({
    queries: allRoutes.map((route) => ({
      queryKey: [
        "easySavings",
        "sidebarMarket",
        networkId,
        route.poolId,
        route.asset.contractId,
      ],
      queryFn: () =>
        fetchMarketInfo(route.poolId, route.asset.contractId, networkId),
      staleTime: 60_000,
    })),
  });

  const core = toRows(coreRoutes, queries, 0, false);
  const highYield = toRows(
    highYieldRoutes,
    queries,
    coreRoutes.length,
    true,
    wadUsdcTinyman
  );

  return {
    core,
    highYield,
    all: [...core, ...highYield],
  };
}
