import { useQuery } from "@tanstack/react-query";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import { fetchFolksMainnetAlgoPoolDepositApyPercentPoints } from "@/services/folksMainnetDepositApyService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live Folks mainnet ALGO pool deposit APY (fALGO) — pass as `live.folksMainnetAlgoDepositPercent`
 * to {@link resolveIntrinsicSupplyApyPercent}. Inactive when `enabled` is false.
 */
export function useFolksMainnetAlgoDepositLiveApyPercent(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["folks-mainnet-algo-pool-deposit-apy"],
    queryFn: async () => {
      const net = getAlgorandNetworkFromNetworkId("algorand-mainnet");
      if (!net) {
        throw new Error("algorand-mainnet not mapped to algod network");
      }
      const { algod } = algorandService.initializeClients(net);
      return fetchFolksMainnetAlgoPoolDepositApyPercentPoints(algod);
    },
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return data ?? null;
}
