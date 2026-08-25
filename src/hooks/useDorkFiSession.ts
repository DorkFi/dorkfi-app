import { useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { isRainbowkitXchainWallet } from "@/wallet/xchainSignUi";
import {
  EMPTY_DORKFI_SESSION,
  type AuthPath,
  type DorkFiSession,
} from "@/wallet/sessionTypes";

/**
 * Unified session read: native AVM / RainbowKit xChain takes precedence over Privy.
 */
export function useDorkFiSession(): DorkFiSession {
  const { activeAccount, activeWallet } = useWallet();
  const privy = usePrivyEasyStart();

  return useMemo((): DorkFiSession => {
    if (activeAccount?.address) {
      const authPath: AuthPath = isRainbowkitXchainWallet(activeWallet)
        ? "rainbowkit"
        : "avm";

      return {
        authPath,
        algorandAddress: activeAccount.address,
        evmAddress: null,
        isAuthenticated: true,
        displayName: null,
      };
    }

    // Keep Easy Start session while authenticated even if wallets[] blips
    // (empty EVM list mid-bridge) — addresses are stabilized in PrivySessionProvider.
    if (privy.authenticated && (privy.evmAddress || privy.algorandAddress)) {
      return {
        authPath: "privy",
        algorandAddress: privy.algorandAddress,
        evmAddress: privy.evmAddress,
        isAuthenticated: true,
        displayName: privy.displayName,
      };
    }

    return EMPTY_DORKFI_SESSION;
  }, [
    activeAccount?.address,
    activeWallet,
    privy.algorandAddress,
    privy.authenticated,
    privy.displayName,
    privy.evmAddress,
  ]);
}

/** True when user has any active session (wallet or Privy Easy Start). */
export function useIsDorkFiAuthenticated(): boolean {
  return useDorkFiSession().isAuthenticated;
}

/** Best address for portfolio / read-only views. */
export function useDorkFiActiveAddress(): string | null {
  return useDorkFiSession().algorandAddress;
}
