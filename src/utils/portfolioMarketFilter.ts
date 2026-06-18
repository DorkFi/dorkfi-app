import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import {
  getEnabledNetworks,
  getLendingPools,
  getMarketLabel,
  getNetworkConfig,
  type NetworkId,
} from "@/config";

export type PortfolioNetworkFilterValue = "all" | "algorand" | "voi";

export function enabledNetworksHaveDMarket(): boolean {
  return (getEnabledNetworks() as NetworkId[]).some((networkId) =>
    getLendingPools(networkId).some(
      (poolId) => getMarketLabel(networkId, String(poolId)) === "D"
    )
  );
}

export function positionMatchesMarketFilter(
  networkId: string | null | undefined,
  poolId: string | null | undefined,
  marketFilter: MarketFilter
): boolean {
  if (marketFilter === "all") return true;
  if (!networkId || !poolId) return false;
  return getMarketLabel(networkId as NetworkId, poolId) === marketFilter;
}

export function positionMatchesNetworkFilter(
  networkId: string | null | undefined,
  networkFilter: PortfolioNetworkFilterValue
): boolean {
  if (networkFilter === "all") return true;
  if (!networkId) return true;
  const normalizedNetwork = networkId.toLowerCase();
  if (networkFilter === "algorand") {
    return normalizedNetwork.includes("algorand");
  }
  if (networkFilter === "voi") {
    return normalizedNetwork.includes("voi");
  }
  return true;
}

export function portfolioNetworkFilterLabel(
  value: PortfolioNetworkFilterValue
): string {
  if (value === "all") return "All Networks";
  if (value === "algorand") {
    return getNetworkConfig("algorand-mainnet").name;
  }
  return getNetworkConfig("voi-mainnet").name;
}

export function portfolioMarketFilterLabel(value: MarketFilter): string {
  if (value === "all") return "All Markets";
  return `${value} Market`;
}

export function hasActivePortfolioPositionFilters(
  networkFilter: PortfolioNetworkFilterValue,
  marketFilter: MarketFilter,
  searchTerm: string
): boolean {
  return (
    networkFilter !== "all" ||
    marketFilter !== "all" ||
    searchTerm.trim() !== ""
  );
}
