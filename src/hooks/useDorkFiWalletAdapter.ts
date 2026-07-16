import { useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { privyEasyStartSyntheticWallet } from "@/wallet/privySyntheticWallet";

type WalletAccount = NonNullable<
  ReturnType<typeof useWallet>["activeAccount"]
>;

/**
 * Extends `useWallet()` with Privy Easy Start: Algorand xChain address + EIP-712 signing
 * when no native wallet is connected.
 */
export function useDorkFiWalletAdapter() {
  const wallet = useWallet();
  const privy = usePrivyEasyStart();

  const isPrivySession = useMemo(
    () =>
      !wallet.activeAccount?.address &&
      privy.authenticated &&
      Boolean(privy.evmAddress || privy.algorandAddress),
    [
      privy.algorandAddress,
      privy.authenticated,
      privy.evmAddress,
      wallet.activeAccount?.address,
    ]
  );

  /** Full Easy Start (can sign + load Algorand portfolio). */
  const isPrivyActive = useMemo(
    () =>
      isPrivySession &&
      Boolean(privy.evmAddress) &&
      Boolean(privy.algorandAddress) &&
      Boolean(privy.signTransactions),
    [
      isPrivySession,
      privy.algorandAddress,
      privy.evmAddress,
      privy.signTransactions,
    ]
  );

  const activeAccount = useMemo((): WalletAccount | undefined => {
    if (wallet.activeAccount) return wallet.activeAccount;
    if (!isPrivySession || !privy.algorandAddress) return undefined;
    return { address: privy.algorandAddress } as WalletAccount;
  }, [isPrivySession, privy.algorandAddress, wallet.activeAccount]);

  const activeWallet = useMemo(() => {
    if (wallet.activeWallet) return wallet.activeWallet;
    if (!isPrivySession) return undefined;
    return privyEasyStartSyntheticWallet;
  }, [isPrivySession, wallet.activeWallet]);

  const signTransactions = useCallback(
    (txns: Uint8Array[]) => {
      if (wallet.activeAccount?.address) {
        return wallet.signTransactions(txns);
      }
      if (isPrivyActive && privy.signTransactions) {
        return privy.signTransactions(txns);
      }
      return wallet.signTransactions(txns);
    },
    [
      isPrivyActive,
      privy.signTransactions,
      wallet.activeAccount?.address,
      wallet.signTransactions,
    ]
  );

  return {
    ...wallet,
    activeAccount,
    activeWallet,
    signTransactions,
    isPrivyEasyStart: isPrivyActive,
    isPrivyEasyStartSession: isPrivySession,
  };
}
