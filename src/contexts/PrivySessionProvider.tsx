import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { switchActiveNetwork } from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount, type EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import {
  DynamicProvider,
  useGetWalletAccounts,
  useInitStatus,
  useLogout,
  useOnEvent,
  useUser,
} from "@dynamic-labs-sdk/react-hooks";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { base } from "viem/chains";
import { isFeatureEnabled } from "@/config";
import { EasyStartLoginDialog } from "@/components/easy-start/EasyStartLoginDialog";
import { dynamicClient, dynamicEnvironmentId } from "@/dynamic/dynamicClient";
import { deriveAlgorandXchainAddress } from "@/services/xchainAddressService";
import { useSyncPendingEarnDeposit } from "@/hooks/usePendingEarnDeposit";
import {
  isSponsorFullyFunded,
  requestEasyStartSponsor,
} from "@/lib/easyStart/sponsorApi";
import { recordAccountActivity } from "@/lib/easyStart/accountActivity";
import type { SendUsdcFn } from "@/lib/easyStart/sendBaseUsdc";
import {
  createDynamicBaseProvider,
  type DynamicEip1193Provider,
} from "@/wallet/dynamicBaseProvider";
import {
  getDynamicWalletClient,
  signDynamicXchainTransactions,
} from "@/wallet/dynamicXchainSignTransactions";
import {
  getPrivyOriginHint,
  resolvePrivyOnboardingEnabled,
} from "@/utils/privyOrigin";
import {
  DEFAULT_PRIVY_EASY_START_STATE,
  PrivyEasyStartContext,
  takeQueuedEasyStartLogin,
  type PrivyEasyStartState,
} from "@/contexts/privyEasyStartContext";

/** Dynamic network id for Base mainnet (chain 8453). */
const BASE_NETWORK_ID = "8453";

function displayNameFromUser(
  user: { email?: string | null; firstName?: string | null } | null
): string | null {
  if (!user) return null;
  return user.firstName ?? user.email?.split("@")[0] ?? null;
}

function WaasBootstrap() {
  const { toast } = useToast();
  const creatingRef = useRef(false);

  useOnEvent({
    event: "userChanged",
    listener: async ({ user }) => {
      if (!user || creatingRef.current) return;
      let missingChains: ReturnType<typeof getChainsMissingWaasWalletAccounts>;
      try {
        missingChains = getChainsMissingWaasWalletAccounts().filter(
          (chain) => chain === "EVM"
        );
      } catch (err) {
        console.error("[Easy Start] could not check embedded wallets", err);
        return;
      }
      if (missingChains.length === 0) return;
      creatingRef.current = true;
      try {
        await createWaasWalletAccounts({ chains: missingChains });
      } catch (err) {
        console.error("[Easy Start] embedded wallet creation failed", err);
        toast({
          title: "Wallet wasn’t created",
          description:
            err instanceof Error
              ? err.message
              : "Dynamic couldn’t create an embedded wallet. Check that embedded wallets and Base are enabled.",
          variant: "destructive",
        });
      } finally {
        creatingRef.current = false;
      }
    },
  });

  return null;
}

function DynamicEasyStartBridge({ children }: { children: ReactNode }) {
  const { data: initStatus, error: initError } = useInitStatus();
  const { data: user } = useUser();
  const { data: accounts = [] } = useGetWalletAccounts();
  const logoutMutation = useLogout();
  const [loginOpen, setLoginOpen] = useState(false);
  useSyncPendingEarnDeposit();

  const ready = initStatus === "finished";
  const authenticated = Boolean(user);

  const evmAccount = useMemo((): EvmWalletAccount | null => {
    return accounts.find(isEvmWalletAccount) ?? null;
  }, [accounts]);

  const accountRef = useRef(evmAccount);
  accountRef.current = evmAccount;

  const login = useCallback(() => {
    setLoginOpen(true);
  }, []);

  useEffect(() => {
    const originHint = getPrivyOriginHint();
    if (originHint) {
      console.error("[Easy Start] Dynamic cannot init on this origin:", originHint);
      return;
    }
    if (ready || initStatus === "failed") return;
    const t = window.setTimeout(() => {
      console.warn(
        "[Easy Start] Dynamic ready is still false after 8s. Hard-refresh this origin.",
        { origin: window.location.origin }
      );
    }, 8000);
    return () => window.clearTimeout(t);
  }, [initStatus, ready]);

  useEffect(() => {
    if (!ready) return;
    if (takeQueuedEasyStartLogin()) {
      try {
        login();
      } catch (error) {
        console.error("[Easy Start] queued login() threw", error);
      }
    }
  }, [ready, login]);

  const [stableEvmAddress, setStableEvmAddress] = useState<string | null>(null);
  const [stableAlgorandAddress, setStableAlgorandAddress] = useState<
    string | null
  >(null);

  const liveEvmAddress = evmAccount?.address ?? null;

  useEffect(() => {
    if (!authenticated) {
      setStableEvmAddress(null);
      setStableAlgorandAddress(null);
      return;
    }
    if (liveEvmAddress) setStableEvmAddress(liveEvmAddress);
  }, [authenticated, liveEvmAddress]);

  const evmAddress = authenticated
    ? liveEvmAddress ?? stableEvmAddress
    : null;

  const getWalletClient = useCallback(async () => {
    const account = accountRef.current;
    if (!account) throw new Error("Easy Start wallet not ready");
    try {
      await switchActiveNetwork({
        walletAccount: account,
        networkId: BASE_NETWORK_ID,
      });
    } catch (err) {
      console.warn("[Easy Start] could not switch embedded wallet to Base", err);
    }
    return getDynamicWalletClient(account);
  }, []);

  const signTransactions = useCallback(
    async (txns: Uint8Array[]) => {
      if (!evmAddress) throw new Error("Easy Start wallet not ready");
      return signDynamicXchainTransactions(evmAddress, txns, getWalletClient);
    },
    [evmAddress, getWalletClient]
  );

  const sendTransaction = useCallback<SendUsdcFn>(
    async (input, options) => {
      if (
        options?.address &&
        evmAddress &&
        options.address.toLowerCase() !== evmAddress.toLowerCase()
      ) {
        throw new Error("Easy Start wallet address mismatch");
      }
      const walletClient = await getWalletClient();
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        chain: base,
        to: input.to as Address,
        data: input.data,
        value: input.value ?? 0n,
      } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);
      return { hash: hash as Hex };
    },
    [evmAddress, getWalletClient]
  );

  const getEvmProvider = useCallback(async () => {
    if (!evmAddress) throw new Error("Easy Start wallet not ready");
    return createDynamicBaseProvider({
      address: evmAddress as Address,
      getWalletClient,
    });
  }, [evmAddress, getWalletClient]);

  const algorandQuery = useQuery({
    queryKey: ["dynamic-xchain-address", evmAddress],
    queryFn: () => deriveAlgorandXchainAddress(evmAddress!),
    enabled: Boolean(authenticated && evmAddress),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (!authenticated) return;
    if (algorandQuery.data) setStableAlgorandAddress(algorandQuery.data);
  }, [authenticated, algorandQuery.data]);

  const algorandAddress = authenticated
    ? algorandQuery.data ?? stableAlgorandAddress
    : null;

  const getAccessToken = useCallback(async () => {
    return dynamicClient?.token ?? null;
  }, []);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const sponsoredEvmRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      sponsoredEvmRef.current = null;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !evmAddress || !algorandAddress) return;
    if (sponsoredEvmRef.current === evmAddress) return;
    let cancelled = false;
    void (async () => {
      const delaysMs = [0, 2_000, 5_000];
      for (const delayMs of delaysMs) {
        if (cancelled) return;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (cancelled) return;
        }
        try {
          const token = await getAccessToken();
          if (!token || cancelled) return;
          const result = await requestEasyStartSponsor({
            accessToken: token,
            evmAddress,
          });
          if (cancelled) return;
          if (isSponsorFullyFunded(result)) {
            sponsoredEvmRef.current = evmAddress;
            if (result.algo.status === "sent" && result.algo.txHash) {
              recordAccountActivity({
                id: result.algo.txHash,
                address: algorandAddress,
                networkId: "algorand-mainnet",
                title: "Account funded",
                detail: `Processing fee ${result.algo.txHash}`,
              });
            }
            return;
          }
        } catch (error) {
          console.warn("[Easy Start] sponsor", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, evmAddress, algorandAddress, getAccessToken]);

  const walletReady = authenticated && Boolean(evmAddress);
  const blockReason =
    initStatus === "failed"
      ? initError?.message ?? "Dynamic failed to initialize."
      : null;

  const value = useMemo(
    (): PrivyEasyStartState => ({
      enabled: true,
      configured: true,
      ready,
      authenticated,
      evmAddress,
      algorandAddress,
      algorandAddressLoading: algorandQuery.isLoading && !algorandAddress,
      displayName: displayNameFromUser(user ?? null),
      login,
      logout,
      signTransactions: walletReady ? signTransactions : null,
      getAccessToken: authenticated ? getAccessToken : null,
      sendTransaction: walletReady ? sendTransaction : null,
      getEvmProvider: walletReady ? getEvmProvider : null,
      blockReason,
    }),
    [
      algorandAddress,
      algorandQuery.isLoading,
      authenticated,
      blockReason,
      evmAddress,
      getAccessToken,
      getEvmProvider,
      login,
      logout,
      ready,
      sendTransaction,
      signTransactions,
      user,
      walletReady,
    ]
  );

  return (
    <PrivyEasyStartContext.Provider value={value}>
      <WaasBootstrap />
      <EasyStartLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      {children}
    </PrivyEasyStartContext.Provider>
  );
}

interface PrivySessionProviderProps {
  children: ReactNode;
}

class DynamicMountErrorBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      "[Easy Start] Dynamic crashed; continuing without Easy Start.",
      error
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function mountBlockReason(): string | null {
  if (typeof window === "undefined") return null;
  const originHint = getPrivyOriginHint();
  if (originHint) return originHint;
  if (!window.isSecureContext) {
    return "Dynamic embedded wallets need HTTPS or localhost. This page is not a secure context.";
  }
  return null;
}

/**
 * Easy Start session. Dynamic embedded EVM wallet on Base, Algorand address
 * derived with xChain. Coinbase on/off-ramp keeps the existing CDP keys.
 * Base ↔ Algorand USDC moves go through Exodus XO Swap, signed here.
 * When disabled or missing an environment id, children render with the
 * existing wallet flow only.
 */
export function PrivySessionProvider({ children }: PrivySessionProviderProps) {
  const enabled = resolvePrivyOnboardingEnabled(
    isFeatureEnabled("enablePrivyOnboarding")
  );
  const configured = dynamicEnvironmentId.length > 0 && dynamicClient != null;
  const originBlock = mountBlockReason();

  const disabledValue = useMemo(
    (): PrivyEasyStartState => ({
      ...DEFAULT_PRIVY_EASY_START_STATE,
      enabled,
      configured,
      blockReason:
        originBlock ??
        (!enabled
          ? "Easy Start is turned off."
          : !configured
            ? "Missing Dynamic environment id (VITE_DYNAMIC_ENVIRONMENT_ID)."
            : null),
    }),
    [configured, enabled, originBlock]
  );

  const crashValue = useMemo(
    (): PrivyEasyStartState => ({
      ...DEFAULT_PRIVY_EASY_START_STATE,
      enabled,
      configured,
      blockReason:
        "Dynamic crashed while loading. Check the console, then hard-refresh.",
    }),
    [configured, enabled]
  );

  const fallback = (
    <PrivyEasyStartContext.Provider value={disabledValue}>
      {children}
    </PrivyEasyStartContext.Provider>
  );

  const crashFallback = (
    <PrivyEasyStartContext.Provider value={crashValue}>
      {children}
    </PrivyEasyStartContext.Provider>
  );

  if (!enabled || !configured || originBlock || !dynamicClient) {
    if (originBlock) {
      console.error("[Easy Start] Dynamic cannot init on this origin:", originBlock);
    }
    return fallback;
  }

  return (
    <DynamicMountErrorBoundary fallback={crashFallback}>
      <DynamicProvider client={dynamicClient}>
        <DynamicEasyStartBridge>{children}</DynamicEasyStartBridge>
      </DynamicProvider>
    </DynamicMountErrorBoundary>
  );
}
