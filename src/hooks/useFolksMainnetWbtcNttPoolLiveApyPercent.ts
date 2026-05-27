import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  fetchFolksMainnetWbtcNttPoolApySnapshot,
  type FolksMainnetUsdcPoolApySnapshot,
} from "@/services/folksMainnetDepositApyService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live Folks V2 WBTC (NTT) pool APYs — pass as
 * `live.folksMainnetWbtcNttDepositPercent` / `live.folksMainnetWbtcNttBorrowPercent`.
 */
export function useFolksMainnetWbtcNttPoolLiveApyPercent(
  enabled: boolean
): FolksMainnetUsdcPoolApySnapshot | null {
  const { data, status, error, fetchStatus } = useQuery({
    queryKey: ["folks-mainnet-wbtc-ntt-pool-apy"],
    queryFn: async () => {
      const net = getAlgorandNetworkFromNetworkId("algorand-mainnet");
      if (!net) {
        throw new Error("algorand-mainnet not mapped to algod network");
      }
      const { algod } = algorandService.initializeClients(net);
      return fetchFolksMainnetWbtcNttPoolApySnapshot(algod);
    },
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    if (status === "success" && data) {
      console.debug("[folks-wbtc-ntt-apy] live snapshot", {
        folksMainnetWbtcNttDepositPercent: data.depositPercent,
        folksMainnetWbtcNttBorrowPercent: data.borrowPercent,
        mapsTo: {
          intrinsicApyLiveSource: "folks_mainnet_wbtc_ntt_pool_deposit",
          intrinsicBorrowApyLiveSource: "folks_mainnet_wbtc_ntt_pool_deposit",
        },
      });
    } else if (status === "error") {
      console.warn("[folks-wbtc-ntt-apy] fetch failed", {
        fetchStatus,
        error: error instanceof Error ? error.message : error,
      });
    }
  }, [enabled, status, data, error, fetchStatus]);

  return data ?? null;
}
