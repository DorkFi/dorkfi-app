import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { getPrivyOriginHint } from "@/utils/privyOrigin";

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

function PrivyEasyStartStateBridge({
  children,
  onReadyStuck,
}: {
  children: ReactNode;
  onReadyStuck?: () => void;
}) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { signTypedData } = useSignTypedData();
  const { wallets } = useWallets();

  useEffect(() => {
    const originHint = getPrivyOriginHint();
    if (originHint) {
      console.error("[Easy Start] Privy cannot init on this origin:", originHint);
      return;
    }
    if (ready) return;
    const t = window.setTimeout(() => {
      console.warn(
        "[Easy Start] Privy ready is still false after 8s. Use http://localhost:8080 and hard-refresh.",
        { origin: window.location.origin }
      );
      onReadyStuck?.();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [ready, onReadyStuck]);

  /** Survive Privy wallets[] blips (e.g. after Allbridge chain switch). */
  const [stableEvmAddress, setStableEvmAddress] = useState<string | null>(null);
  const [stableAlgorandAddress, setStableAlgorandAddress] = useState<
    string | null
  >(null);

  const liveWallet = useMemo(() => {
    if (!ready || !authenticated) return null;
    return (
      wallets.find((w) => w.walletClientType === "privy") ?? wallets[0] ?? null
    );
  }, [authenticated, ready, wallets]);

  const liveEvmAddress = liveWallet?.address ?? null;

  useEffect(() => {
    if (!authenticated) {
      setStableEvmAddress(null);
      setStableAlgorandAddress(null);
      return;
    }
    if (liveEvmAddress) {
      setStableEvmAddress(liveEvmAddress);
    }
  }, [authenticated, liveEvmAddress]);

  const evmAddress = authenticated
    ? liveEvmAddress ?? stableEvmAddress
    : null;

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

  useEffect(() => {
    if (!authenticated) return;
    if (algorandQuery.data) {
      setStableAlgorandAddress(algorandQuery.data);
    }
  }, [authenticated, algorandQuery.data]);

  const algorandAddress = authenticated
    ? algorandQuery.data ?? stableAlgorandAddress
    : null;

  const value = useMemo(
    (): PrivyEasyStartState => ({
      enabled: true,
      configured: true,
      ready,
      authenticated,
      evmAddress,
      algorandAddress,
      algorandAddressLoading:
        algorandQuery.isLoading && !algorandAddress,
      displayName: privyDisplayName(user),
      login,
      logout,
      signTransactions: authenticated && evmAddress ? signTransactions : null,
    }),
    [
      algorandAddress,
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
  /** Remount Privy after HMR / stuck init so `ready` can recover (once). */
  const [providerKey, setProviderKey] = useState(0);
  const remountCountRef = useRef(0);

  const disabledValue = useMemo(
    (): PrivyEasyStartState => ({
      ...DEFAULT_STATE,
      enabled,
      configured,
    }),
    [configured, enabled]
  );

  const handleReadyStuck = useCallback(() => {
    if (remountCountRef.current >= 1) return;
    remountCountRef.current += 1;
    setProviderKey((k) => k + 1);
  }, []);

  if (!enabled || !configured) {
    return (
      <PrivyEasyStartContext.Provider value={disabledValue}>
        {children}
      </PrivyEasyStartContext.Provider>
    );
  }

  return (
    <PrivyProvider
      key={providerKey}
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
      <PrivyEasyStartStateBridge onReadyStuck={handleReadyStuck}>
        {children}
      </PrivyEasyStartStateBridge>
    </PrivyProvider>
  );
}
