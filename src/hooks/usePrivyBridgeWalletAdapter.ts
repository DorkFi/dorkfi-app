import { useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useQueryClient } from "@tanstack/react-query";
import type { BridgeWalletAdapter } from "@d13co/algo-x-evm-ui";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { usePrivyEmbeddedWallet } from "@/hooks/usePrivyEmbeddedWallet";

/**
 * Bridge wallet adapter for Privy Easy Start (separate from RainbowKit xChain).
 * Feeds Allbridge `useBridgePanel` with Privy EVM provider + EIP-712 Algorand signing.
 */
export function usePrivyBridgeWalletAdapter(): BridgeWalletAdapter & {
  ready: boolean;
} {
  const privy = usePrivyEasyStart();
  const { wallet } = usePrivyEmbeddedWallet();
  const { algodClient } = useWallet();
  const queryClient = useQueryClient();

  const signTransactions = useCallback(
    async (txns: Uint8Array[]) => {
      if (!privy.signTransactions) {
        throw new Error("Easy Start signing is not ready");
      }
      return privy.signTransactions(txns);
    },
    [privy.signTransactions]
  );

  const getEvmProvider = useCallback(async () => {
    if (!wallet) {
      throw new Error("Easy Start EVM wallet is not ready");
    }
    return wallet.getEthereumProvider();
  }, [wallet]);

  const onTransactionSuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-info"] });
    void queryClient.invalidateQueries({ queryKey: ["account-balance"] });
  }, [queryClient]);

  const ready = Boolean(
    privy.authenticated &&
      privy.evmAddress &&
      privy.algorandAddress &&
      privy.signTransactions &&
      wallet
  );

  return useMemo(
    (): BridgeWalletAdapter & { ready: boolean } => ({
      ready,
      activeAddress: privy.algorandAddress,
      algodClient: algodClient ?? null,
      signTransactions,
      onTransactionSuccess,
      evmAddress: privy.evmAddress,
      isAlgoXEvm: ready,
      getEvmProvider: ready ? getEvmProvider : undefined,
    }),
    [
      algodClient,
      getEvmProvider,
      onTransactionSuccess,
      privy.algorandAddress,
      privy.evmAddress,
      ready,
      signTransactions,
    ]
  );
}
