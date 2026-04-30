import { useQuery } from "@tanstack/react-query";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  fetchFolksMainnetFiUsdcEcosystemPoolApySnapshot,
  type FolksMainnetUsdcPoolApySnapshot,
} from "@/services/folksMainnetDepositApyService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live Folks Algorand Ecosystem USDC pool APYs (fiUSDC) — pass as
 * `live.folksMainnetFiUsdcEcosystemDepositPercent` / `live.folksMainnetFiUsdcEcosystemBorrowPercent`.
 */
export function useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent(
  enabled: boolean
): FolksMainnetUsdcPoolApySnapshot | null {
  const { data } = useQuery({
    queryKey: ["folks-mainnet-fiusdc-ecosystem-pool-apy"],
    queryFn: async () => {
      const net = getAlgorandNetworkFromNetworkId("algorand-mainnet");
      if (!net) {
        throw new Error("algorand-mainnet not mapped to algod network");
      }
      const { algod } = algorandService.initializeClients(net);
      return fetchFolksMainnetFiUsdcEcosystemPoolApySnapshot(algod);
    },
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return data ?? null;
}
