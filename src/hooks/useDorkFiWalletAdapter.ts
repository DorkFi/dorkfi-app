import { useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { privyEasyStartSyntheticWallet } from "@/wallet/privySyntheticWallet";

type WalletAccount = NonNullable<
  ReturnType<typeof useWallet>["activeAccount"]
>;

/**
 * Normalize wallet / xChain addresses to plain strings.
 * Dual algosdk copies turn Address objects into `Not an address` via instanceof.
 */
function asAddressString(address: unknown): string | undefined {
  if (address == null) return undefined;
  let value: string | undefined;
  if (typeof address === "string") {
    value = address.trim();
  } else if (
    typeof address === "object" &&
    typeof (address as { toString?: () => string }).toString === "function"
  ) {
    const s = (address as { toString: () => string }).toString().trim();
    if (s && s !== "[object Object]") value = s;
  }
  if (!value) return undefined;
  return algosdk.isValidAddress(value) ? value : undefined;
}

/**
 * Extends `useWallet()` with Privy Easy Start: Algorand xChain address + EIP-712 signing
 * when no native wallet is connected.
 */
export function useDorkFiWalletAdapter() {
  const wallet = useWallet();
  const privy = usePrivyEasyStart();

  const walletAddress = asAddressString(wallet.activeAccount?.address);
  const privyAlgoAddress = asAddressString(privy.algorandAddress);

  const isPrivySession = useMemo(
    () =>
      !walletAddress &&
      privy.authenticated &&
      Boolean(privy.evmAddress || privyAlgoAddress),
    [privy.authenticated, privy.evmAddress, privyAlgoAddress, walletAddress]
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
    if (wallet.activeAccount && walletAddress) {
      return { ...wallet.activeAccount, address: walletAddress };
    }
    if (!isPrivySession || !privyAlgoAddress) return undefined;
    return { address: privyAlgoAddress } as WalletAccount;
  }, [
    isPrivySession,
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
