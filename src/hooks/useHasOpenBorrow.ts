import { useQuery } from "@tanstack/react-query";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { useNetwork } from "@/contexts/NetworkContext";
import { fetchUserGlobalData } from "@/services/lendingService";
import { invalidateRpcReadCache } from "@/utils/rpcReadCache";

const DUST_USD = 1e-6;

export const hasOpenBorrowQueryKey = (
  networkId: string,
  address: string
) => ["has-open-borrow", networkId, address] as const;

/**
 * True when the connected account has outstanding protocol borrow value.
 * Used by Chub to gate the Portfolio tab until a borrow exists.
 */
export function useHasOpenBorrow() {
  const { activeAccount } = useDorkFiWalletAdapter();
  const { currentNetwork } = useNetwork();
  const address = activeAccount?.address?.trim() || "";

  const query = useQuery({
    queryKey: hasOpenBorrowQueryKey(currentNetwork, address),
    enabled: Boolean(address),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    // Keep checking until the first open borrow so the Portfolio tab can appear after mint/borrow.
    refetchInterval: (q) => {
      if (!address) return false;
      return q.state.data === true ? false : 12_000;
    },
    queryFn: async () => {
      // Avoid a stale pre-borrow RPC cache after a successful borrow tx.
      invalidateRpcReadCache(`userGlobal:${currentNetwork}:${address}`);
      const data = await fetchUserGlobalData(address, currentNetwork);
      return (data?.totalBorrowValue ?? 0) > DUST_USD;
    },
  });

  return {
    hasOpenBorrow: Boolean(address && query.data === true),
    isLoading: Boolean(address && query.isPending),
  };
}
