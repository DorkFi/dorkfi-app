import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import {
  EasyStartModalsContext,
  type EasyStartModalsContextValue,
} from "@/contexts/easyStartModals";

/**
 * Lazy-load all Easy Start sheets so:
 * - `@privy-io/wagmi` never enters the initial App graph
 * - Fast Refresh churn on bridge helpers does not remount the whole app
 * Sheets only mount while open (avoids idle Dialog mounts when signed in).
 */
const EasyStartDepositSheet = lazy(() =>
  import("@/components/easy-start/EasyStartDepositSheet").then((m) => ({
    default: m.EasyStartDepositSheet,
  }))
);
const EasyStartWithdrawSheet = lazy(() =>
  import("@/components/easy-start/EasyStartWithdrawSheet").then((m) => ({
    default: m.EasyStartWithdrawSheet,
  }))
);
const EasyStartBridgeSheet = lazy(() =>
  import("@/components/easy-start/EasyStartBridgeSheet").then((m) => ({
    default: m.EasyStartBridgeSheet,
  }))
);

const SHEET_FALLBACK_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md p-0";

function EasyStartSheetFallback({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_FALLBACK_CLASS}>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Loader2 className="h-6 w-6 animate-spin text-ocean-teal" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Opening {title.toLowerCase()}…
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single mount point for Easy Start deposit/withdraw/bridge modals so Portfolio
 * and header do not nest multiple Privy wagmi providers (which breaks Email login).
 */
export function EasyStartModalsProvider({ children }: { children: ReactNode }) {
  const privy = usePrivyEasyStart();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [bridgeOpen, setBridgeOpen] = useState(false);

  const openDeposit = useCallback(() => setDepositOpen(true), []);
  const openWithdraw = useCallback(() => setWithdrawOpen(true), []);
  const openBridge = useCallback(() => setBridgeOpen(true), []);

  const value = useMemo(
    (): EasyStartModalsContextValue => ({
      openDeposit,
      openWithdraw,
      openBridge,
    }),
    [openDeposit, openWithdraw, openBridge]
  );

  const showSheets = privy.enabled && privy.configured && privy.authenticated;

  const openAdvancedBridge = useCallback(() => {
    setDepositOpen(false);
    setWithdrawOpen(false);
    setBridgeOpen(true);
  }, []);

  return (
    <EasyStartModalsContext.Provider value={value}>
      {children}
      {showSheets ? (
        <>
          {depositOpen ? (
            <Suspense
              fallback={
                <EasyStartSheetFallback
                  open={depositOpen}
                  onOpenChange={setDepositOpen}
                  title="Deposit"
                />
              }
            >
              <EasyStartDepositSheet
                open={depositOpen}
                onOpenChange={setDepositOpen}
                onOpenAdvancedBridge={openAdvancedBridge}
              />
            </Suspense>
          ) : null}
          {withdrawOpen ? (
            <Suspense
              fallback={
                <EasyStartSheetFallback
                  open={withdrawOpen}
                  onOpenChange={setWithdrawOpen}
                  title="Withdraw"
                />
              }
            >
              <EasyStartWithdrawSheet
                open={withdrawOpen}
                onOpenChange={setWithdrawOpen}
                onOpenAdvancedBridge={openAdvancedBridge}
              />
            </Suspense>
          ) : null}
          {bridgeOpen ? (
            <Suspense
              fallback={
                <EasyStartSheetFallback
                  open={bridgeOpen}
                  onOpenChange={setBridgeOpen}
                  title="Bridge"
                />
              }
            >
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
