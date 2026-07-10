import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";

/** Privy embedded wallet address when Easy Start is active. */
export function usePrivyEmbeddedWallet() {
  const privy = usePrivyEasyStart();

  return {
    ready: privy.ready,
    authenticated: privy.authenticated,
    wallet: null,
    evmAddress: privy.evmAddress,
  };
}
