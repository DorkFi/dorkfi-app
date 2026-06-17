import type { NetworkId } from "@/config";
import { fetchAllMarkets } from "@/services/lendingService";

export const MARKETS_STALE_MS = 30_000;

export const marketQueryKeys = {
  all: ["markets"] as const,
  network: (networkId: NetworkId) => ["markets", networkId] as const,
};

export function marketsQueryOptions(networkId: NetworkId) {
  return {
    queryKey: marketQueryKeys.network(networkId),
    queryFn: () => fetchAllMarkets(networkId),
    staleTime: MARKETS_STALE_MS,
  };
}
