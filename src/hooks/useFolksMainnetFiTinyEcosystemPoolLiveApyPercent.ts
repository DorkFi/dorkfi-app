import { useQuery } from "@tanstack/react-query";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  fetchFolksMainnetFiTinyEcosystemPoolApySnapshot,
  type FolksMainnetUsdcPoolApySnapshot,
} from "@/services/folksMainnetDepositApyService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live Folks Algorand Ecosystem TINY pool APYs (fiTINY) — pass as
 * `live.folksMainnetFiTinyEcosystemDepositPercent` / `live.folksMainnetFiTinyEcosystemBorrowPercent`.
 */
export function useFolksMainnetFiTinyEcosystemPoolLiveApyPercent(
  enabled: boolean
): FolksMainnetUsdcPoolApySnapshot | null {
  const { data } = useQuery({
    queryKey: ["folks-mainnet-fitiny-ecosystem-pool-apy"],
    queryFn: async () => {
      const net = getAlgorandNetworkFromNetworkId("algorand-mainnet");
      if (!net) {
        throw new Error("algorand-mainnet not mapped to algod network");
      }
      const { algod } = algorandService.initializeClients(net);
      return fetchFolksMainnetFiTinyEcosystemPoolApySnapshot(algod);
    },
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return data ?? null;
}
