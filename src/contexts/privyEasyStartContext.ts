import { createContext, useContext } from "react";

export type PrivyEasyStartState = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  evmAddress: string | null;
  algorandAddress: string | null;
  algorandAddressLoading: boolean;
  displayName: string | null;
  login: ((options?: { loginMethods?: string[] }) => void) | null;
  logout: (() => Promise<void>) | null;
  /** xChain EIP-712 signing for Algorand txn groups (Dynamic embedded wallet). */
  signTransactions: ((txns: Uint8Array[]) => Promise<Uint8Array[]>) | null;
  /** Dynamic access token for Easy Start APIs (sponsor, offramp). */
  getAccessToken: (() => Promise<string | null>) | null;
  /** Base transaction sender used by cash-out and XO Swap. */
  sendTransaction: ((
    input: {
      to: string;
      value?: bigint;
      data?: `0x${string}`;
      chainId?: number;
    },
    options?: { address?: string }
  ) => Promise<{ hash: `0x${string}` }>) | null;
  /** EIP-1193 provider for the Allbridge Base leg. */
  getEvmProvider: (() => Promise<{
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  }>) | null;
  /** Why Easy Start cannot open (origin block, crash, or missing config). */
  blockReason: string | null;
};

export const DEFAULT_PRIVY_EASY_START_STATE: PrivyEasyStartState = {
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
  getAccessToken: null,
  sendTransaction: null,
  getEvmProvider: null,
  blockReason: null,
};

export const PrivyEasyStartContext = createContext<PrivyEasyStartState>(
  DEFAULT_PRIVY_EASY_START_STATE
);

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

let queuedEasyStartLogin = false;

/** Survive the lazy Privy remount so Get Started still opens the modal. */
export function queueEasyStartLogin() {
  queuedEasyStartLogin = true;
}

export function takeQueuedEasyStartLogin() {
  const queued = queuedEasyStartLogin;
  queuedEasyStartLogin = false;
  return queued;
}

export function hasQueuedEasyStartLogin() {
  return queuedEasyStartLogin;
}
