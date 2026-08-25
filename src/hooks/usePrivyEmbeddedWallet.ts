import { useMemo } from "react";
import { useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";

/** Privy embedded wallet when Easy Start is active (must run under PrivyProvider). */
export function usePrivyEmbeddedWallet(): {
  ready: boolean;
  authenticated: boolean;
  wallet: ConnectedWallet | null;
  evmAddress: string | null;
} {
  const privy = usePrivyEasyStart();
  const { wallets } = useWallets();

  const wallet = useMemo(() => {
    if (!privy.authenticated) return null;
    const byType = wallets.find((w) => w.walletClientType === "privy");
    if (byType) return byType;
    if (privy.evmAddress) {
      const target = privy.evmAddress.toLowerCase();
      return (
        wallets.find((w) => w.address.toLowerCase() === target) ?? null
      );
    }
    return wallets[0] ?? null;
  }, [privy.authenticated, privy.evmAddress, wallets]);

  return {
    ready: privy.ready,
    authenticated: privy.authenticated,
    wallet,
    evmAddress: privy.evmAddress ?? wallet?.address ?? null,
  };
}
