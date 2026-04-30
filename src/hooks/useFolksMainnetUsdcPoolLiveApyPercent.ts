import { useQuery } from "@tanstack/react-query";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  fetchFolksMainnetUsdcPoolApySnapshot,
  type FolksMainnetUsdcPoolApySnapshot,
} from "@/services/folksMainnetDepositApyService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live Folks mainnet USDC pool APYs — pass deposit to {@link resolveIntrinsicSupplyApyPercent}
 * and borrow to {@link resolveIntrinsicBorrowApyPercent} via `live` snapshot fields. Inactive when
 * `enabled` is false.
 */
export function useFolksMainnetUsdcPoolLiveApyPercent(
  enabled: boolean
): FolksMainnetUsdcPoolApySnapshot | null {
  const { data } = useQuery({
    queryKey: ["folks-mainnet-usdc-pool-apy"],
    queryFn: async () => {
      const net = getAlgorandNetworkFromNetworkId("algorand-mainnet");
      if (!net) {
        throw new Error("algorand-mainnet not mapped to algod network");
      }
      const { algod } = algorandService.initializeClients(net);
      return fetchFolksMainnetUsdcPoolApySnapshot(algod);
    },
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return data ?? null;
}
