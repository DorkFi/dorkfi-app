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
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { isFeatureEnabled } from "@/config";
import { EasyStartLoginDialog } from "@/components/easy-start/EasyStartLoginDialog";
import { dynamicClient, dynamicEnvironmentId } from "@/dynamic/dynamicClient";
import { deriveAlgorandXchainAddress } from "@/services/xchainAddressService";
import { useToast } from "@/hooks/use-toast";
import {
  createDynamicBaseProvider,
  type DynamicEip1193Provider,
} from "@/wallet/dynamicBaseProvider";
import {
  getDynamicWalletClient,
  signDynamicXchainTransactions,
} from "@/wallet/dynamicXchainSignTransactions";
import { resolvePrivyOnboardingEnabled } from "@/utils/privyOrigin";

export type EasyStartSendTransaction = (input: {
  to: string;
  value?: bigint;
  data?: Hex;
  chainId?: number;
}) => Promise<{ hash: Hex }>;

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
  /** xChain EIP-712 signing for Algorand txn groups (Dynamic embedded wallet). */
  signTransactions: ((txns: Uint8Array[]) => Promise<Uint8Array[]>) | null;
  /** Base USDC transfer used by cash-out. */
  sendBaseTransaction: EasyStartSendTransaction | null;
  /** EIP-1193 provider for the Allbridge Base leg. */
  getEvmProvider: (() => Promise<DynamicEip1193Provider>) | null;
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
  sendBaseTransaction: null,
  getEvmProvider: null,
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

function displayNameFromUser(user: { email?: string | null; firstName?: string | null } | null): string | null {
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
        missingChains = getChainsMissingWaasWalletAccounts();
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
  const { data: initStatus } = useInitStatus();
  const { data: user } = useUser();
  const { data: accounts = [] } = useGetWalletAccounts();
  const logoutMutation = useLogout();
  const [loginOpen, setLoginOpen] = useState(false);

  const ready = initStatus === "finished";
  const authenticated = Boolean(user);

  const evmAccount = useMemo((): EvmWalletAccount | null => {
    return accounts.find(isEvmWalletAccount) ?? null;
  }, [accounts]);

  const accountRef = useRef(evmAccount);
  accountRef.current = evmAccount;

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
    return getDynamicWalletClient(account);
  }, []);

  const signTransactions = useCallback(
    async (txns: Uint8Array[]) => {
      if (!evmAddress) throw new Error("Easy Start wallet not ready");
      return signDynamicXchainTransactions(evmAddress, txns, getWalletClient);
    },
    [evmAddress, getWalletClient]
  );

  const sendBaseTransaction = useCallback<EasyStartSendTransaction>(
    async (input) => {
      const walletClient = await getWalletClient();
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: input.to as Address,
        data: input.data,
        value: input.value ?? 0n,
      } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);
      return { hash };
    },
    [getWalletClient]
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

  const login = useCallback(() => {
    setLoginOpen(true);
  }, []);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const walletReady = authenticated && Boolean(evmAddress);

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
      sendBaseTransaction: walletReady ? sendBaseTransaction : null,
      getEvmProvider: walletReady ? getEvmProvider : null,
    }),
    [
      algorandAddress,
      algorandQuery.isLoading,
      authenticated,
      evmAddress,
      getEvmProvider,
      login,
      logout,
      ready,
      sendBaseTransaction,
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

/**
 * Easy Start session. Dynamic embedded EVM wallet on Base, Algorand address
 * derived with xChain. When disabled or missing an environment id, children
 * render with the existing wallet flow only.
 */
export function PrivySessionProvider({ children }: PrivySessionProviderProps) {
  const enabled = resolvePrivyOnboardingEnabled(
    isFeatureEnabled("enablePrivyOnboarding")
  );
  const configured = dynamicEnvironmentId.length > 0 && dynamicClient != null;

  const disabledValue = useMemo(
    (): PrivyEasyStartState => ({
      ...DEFAULT_STATE,
      enabled,
      configured,
    }),
    [configured, enabled]
  );

  if (!enabled || !configured || !dynamicClient) {
    return (
      <PrivyEasyStartContext.Provider value={disabledValue}>
        {children}
      </PrivyEasyStartContext.Provider>
    );
  }

  return (
    <DynamicProvider client={dynamicClient}>
      <DynamicEasyStartBridge>{children}</DynamicEasyStartBridge>
    </DynamicProvider>
  );
}
