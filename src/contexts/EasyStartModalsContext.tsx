import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EasyStartDepositSheet } from "@/components/easy-start/EasyStartDepositSheet";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";

/** Lazy so `@privy-io/wagmi` is not loaded until the bridge opens (keeps Privy `ready`). */
const EasyStartBridgeSheet = lazy(() =>
  import("@/components/easy-start/EasyStartBridgeSheet").then((m) => ({
    default: m.EasyStartBridgeSheet,
  }))
);

type EasyStartModalsContextValue = {
  openDeposit: () => void;
  openBridge: () => void;
};

const EasyStartModalsContext =
  createContext<EasyStartModalsContextValue | null>(null);

export function useEasyStartModals(): EasyStartModalsContextValue {
  const ctx = useContext(EasyStartModalsContext);
  if (!ctx) {
    return {
      openDeposit: () => {
        console.warn("EasyStartModalsProvider is not mounted");
      },
      openBridge: () => {
        console.warn("EasyStartModalsProvider is not mounted");
      },
    };
  }
  return ctx;
}

/**
 * Single mount point for Easy Start deposit/bridge modals so Portfolio and
 * header do not nest multiple Privy wagmi providers (which breaks Email login).
 * Must sit under NetworkProvider/WalletProvider — the bridge adapter calls useWallet().
 */
export function EasyStartModalsProvider({ children }: { children: ReactNode }) {
  const privy = usePrivyEasyStart();
  const [depositOpen, setDepositOpen] = useState(false);
  const [bridgeOpen, setBridgeOpen] = useState(false);

  const openDeposit = useCallback(() => setDepositOpen(true), []);
  const openBridge = useCallback(() => setBridgeOpen(true), []);

  const value = useMemo(
    () => ({ openDeposit, openBridge }),
    [openDeposit, openBridge]
  );

  const showSheets = privy.enabled && privy.configured && privy.authenticated;

  return (
    <EasyStartModalsContext.Provider value={value}>
      {children}
      {showSheets ? (
        <>
          <EasyStartDepositSheet
            open={depositOpen}
            onOpenChange={setDepositOpen}
            onContinueToBridge={() => {
              setDepositOpen(false);
              setBridgeOpen(true);
            }}
          />
          {bridgeOpen ? (
            <Suspense fallback={null}>
              <EasyStartBridgeSheet
                open={bridgeOpen}
                onOpenChange={setBridgeOpen}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}
    </EasyStartModalsContext.Provider>
  );
}
