import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";

export function usePrivyXchainAddress() {
  const privy = usePrivyEasyStart();

  return {
    evmAddress: privy.evmAddress,
    algorandAddress: privy.algorandAddress,
    isLoading: privy.algorandAddressLoading,
    isError: false,
    error: null,
    refetch: () => undefined,
  };
}
