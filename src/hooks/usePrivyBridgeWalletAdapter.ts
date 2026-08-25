import { useCallback, useMemo } from "react";
import { Algodv2 } from "algosdk";
import { useQueryClient } from "@tanstack/react-query";
import type { BridgeWalletAdapter } from "@d13co/algo-x-evm-ui";
import { base } from "viem/chains";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { usePrivyEmbeddedWallet } from "@/hooks/usePrivyEmbeddedWallet";

/**
 * Allbridge Base→Algorand always targets Algorand Mainnet ASA opt-in / receive.
 * Do not use the app's network-scoped useWallet().algodClient — Easy Start can run
 * while the saved network is VOI, which would skip or break USDC opt-in checks.
 */
const ALGORAND_MAINNET_ALGOD = new Algodv2(
  "",
  "https://mainnet-api.4160.nodely.dev",
  "443"
);

/**
 * @deprecated Easy Start deposit/withdraw now use Aramid Bridge (`runAramidUsdcBridge`).
 * Kept for possible RainbowKit / Allbridge cleanup; not mounted by Easy Start UI.
 *
 * Bridge wallet adapter for Privy Easy Start (separate from RainbowKit xChain).
 * Feeds Allbridge `useBridgePanel` with Privy EVM provider + EIP-712 Algorand signing.
 */
export function usePrivyBridgeWalletAdapter(): BridgeWalletAdapter & {
  ready: boolean;
} {
  const privy = usePrivyEasyStart();
  const { wallet } = usePrivyEmbeddedWallet();
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
    // Allbridge Base→ALG expects the embedded wallet on Base before approve/send.
    try {
      await wallet.switchChain(base.id);
    } catch (err) {
      console.warn("Easy Start bridge: switchChain(Base) failed", err);
    }
    return wallet.getEthereumProvider();
  }, [wallet]);

  const onTransactionSuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-info"] });
    void queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
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
      algodClient: ALGORAND_MAINNET_ALGOD,
      signTransactions,
      onTransactionSuccess,
      evmAddress: privy.evmAddress,
      isAlgoXEvm: ready,
      getEvmProvider: ready ? getEvmProvider : undefined,
    }),
    [
      getEvmProvider,
      onTransactionSuccess,
      privy.algorandAddress,
      privy.evmAddress,
      ready,
      signTransactions,
    ]
  );
}
