import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  PrivyProvider,
  usePrivy,
  useSignTypedData,
  useWallets,
} from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { base } from "viem/chains";
import { isFeatureEnabled } from "@/config";
import { deriveAlgorandXchainAddress } from "@/services/xchainAddressService";
import { signPrivyXchainTransactions } from "@/wallet/privyXchainSignTransactions";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? "";

export type PrivyEasyStartState = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  evmAddress: string | null;
  algorandAddress: string | null;
  algorandAddressLoading: boolean;
  displayName: string | null;
  login: (() => void) | null;
  logout: (() => Promise<void>) | null;
  /** xChain EIP-712 signing for Algorand txn groups (Privy embedded wallet). */
  signTransactions: ((txns: Uint8Array[]) => Promise<Uint8Array[]>) | null;
};

const DEFAULT_STATE: PrivyEasyStartState = {
  enabled: false,
  configured: false,
  ready: false,
  authenticated: false,
  evmAddress: null,
  algorandAddress: null,
  algorandAddressLoading: false,
  displayName: null,
  login: null,
  logout: null,
  signTransactions: null,
};

const PrivyEasyStartContext = createContext<PrivyEasyStartState>(DEFAULT_STATE);

export function usePrivyEasyStart(): PrivyEasyStartState {
  return useContext(PrivyEasyStartContext);
}

/** @deprecated Use usePrivyEasyStart */
export function usePrivyEasyStartEnabled(): {
  enabled: boolean;
  configured: boolean;
} {
  const { enabled, configured } = usePrivyEasyStart();
  return { enabled, configured };
}

function privyDisplayName(
  user: ReturnType<typeof usePrivy>["user"]
): string | null {
  if (!user) return null;
  return (
    user.google?.name?.split(" ")[0] ??
    user.email?.address?.split("@")[0] ??
    null
  );
}

function PrivyEasyStartStateBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { signTypedData } = useSignTypedData();
  const { wallets } = useWallets();

  const wallet = useMemo(() => {
    if (!ready || !authenticated) return null;
    return (
      wallets.find((w) => w.walletClientType === "privy") ?? wallets[0] ?? null
    );
  }, [authenticated, ready, wallets]);

  const evmAddress = wallet?.address ?? null;

  const signTransactions = useCallback(
    async (txns: Uint8Array[]) => {
      if (!evmAddress) {
        throw new Error("Easy Start wallet not ready");
      }
      return signPrivyXchainTransactions(evmAddress, txns, signTypedData);
    },
    [evmAddress, signTypedData]
  );

  const algorandQuery = useQuery({
    queryKey: ["privy-xchain-address", evmAddress],
    queryFn: () => deriveAlgorandXchainAddress(evmAddress!),
    enabled: Boolean(authenticated && evmAddress),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const value = useMemo(
    (): PrivyEasyStartState => ({
      enabled: true,
      configured: true,
      ready,
      authenticated,
      evmAddress,
      algorandAddress: algorandQuery.data ?? null,
      algorandAddressLoading: algorandQuery.isLoading,
      displayName: privyDisplayName(user),
      login,
      logout,
      signTransactions: authenticated && evmAddress ? signTransactions : null,
    }),
    [
      algorandQuery.data,
      algorandQuery.isLoading,
      authenticated,
      evmAddress,
      login,
      logout,
      ready,
      signTransactions,
      user,
    ]
  );

  return (
    <PrivyEasyStartContext.Provider value={value}>
      {children}
    </PrivyEasyStartContext.Provider>
  );
}

interface PrivySessionProviderProps {
  children: ReactNode;
}

/**
 * Optional Privy wrapper for Easy Start onboarding. When disabled or unconfigured,
 * children render unchanged (existing wallet flow only).
 */
export function PrivySessionProvider({ children }: PrivySessionProviderProps) {
  const enabled = isFeatureEnabled("enablePrivyOnboarding");
  const configured = PRIVY_APP_ID.length > 0;

  const disabledValue = useMemo(
    (): PrivyEasyStartState => ({
      ...DEFAULT_STATE,
      enabled,
      configured,
    }),
    [configured, enabled]
  );

  if (!enabled || !configured) {
    return (
      <PrivyEasyStartContext.Provider value={disabledValue}>
        {children}
      </PrivyEasyStartContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "apple", "passkey"],
        appearance: {
          theme: "dark",
          accentColor: "#2d8b78",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <PrivyEasyStartStateBridge>{children}</PrivyEasyStartStateBridge>
    </PrivyProvider>
  );
}
