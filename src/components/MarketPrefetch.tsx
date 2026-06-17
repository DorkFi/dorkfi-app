import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEnabledNetworks } from "@/config";
import { marketsQueryOptions } from "@/hooks/marketQueryKeys";

/** Warm market cache on app mount so portfolio/markets load faster after wallet connect. */
export function MarketPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    for (const networkId of getEnabledNetworks()) {
      void queryClient.prefetchQuery(marketsQueryOptions(networkId));
    }
  }, [queryClient]);

  return null;
}
