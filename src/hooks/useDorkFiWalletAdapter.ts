import { useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { asAlgorandAddressString } from "@/lib/algorand/addressString";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
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
  const consumerCopy = useConsumerCopy();

  const walletAddress = asAlgorandAddressString(wallet.activeAccount?.address);
  const privyAlgoAddress = asAlgorandAddressString(privy.algorandAddress);
  const preferPrivy =
    consumerCopy && privy.authenticated && Boolean(privyAlgoAddress);

  const isPrivySession = useMemo(
    () =>
      (preferPrivy || !walletAddress) &&
      privy.authenticated &&
      Boolean(privy.evmAddress || privyAlgoAddress),
    [
      preferPrivy,
      privy.authenticated,
      privy.evmAddress,
      privyAlgoAddress,
      walletAddress,
    ]
  );

  /** Full Easy Start (can sign + load Algorand portfolio). */
  const isPrivyActive = useMemo(
    () =>
      isPrivySession &&
      Boolean(privy.evmAddress) &&
      Boolean(privyAlgoAddress) &&
      Boolean(privy.signTransactions),
    [
      isPrivySession,
      privy.evmAddress,
      privyAlgoAddress,
      privy.signTransactions,
    ]
  );

  const activeAccount = useMemo((): WalletAccount | undefined => {
    if (preferPrivy && privyAlgoAddress) {
      return { address: privyAlgoAddress } as WalletAccount;
    }
    if (wallet.activeAccount && walletAddress) {
      return { ...wallet.activeAccount, address: walletAddress };
    }
    if (!isPrivySession || !privyAlgoAddress) return undefined;
    return { address: privyAlgoAddress } as WalletAccount;
  }, [
    isPrivySession,
    preferPrivy,
    privyAlgoAddress,
    wallet.activeAccount,
    walletAddress,
  ]);

  const activeWallet = useMemo(() => {
    if (wallet.activeWallet) return wallet.activeWallet;
    if (!isPrivySession) return undefined;
    return privyEasyStartSyntheticWallet;
  }, [isPrivySession, wallet.activeWallet]);

  const signTransactions = useCallback(
    (txns: Uint8Array[]) => {
      if (preferPrivy && isPrivyActive && privy.signTransactions) {
        return privy.signTransactions(txns);
      }
      if (walletAddress) {
        return wallet.signTransactions(txns);
      }
      if (isPrivyActive && privy.signTransactions) {
        return privy.signTransactions(txns);
      }
      return wallet.signTransactions(txns);
    },
    [
      isPrivyActive,
      preferPrivy,
      privy.signTransactions,
      wallet.signTransactions,
      walletAddress,
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
