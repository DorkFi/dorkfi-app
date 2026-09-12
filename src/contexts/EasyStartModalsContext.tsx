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
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { IsolateErrorBoundary } from "@/components/IsolateErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  EasyStartModalsContext,
  type EasyStartModalsContextValue,
} from "@/contexts/easyStartModals";

/**
 * Lazy-load Easy Start sheets so `@privy-io/wagmi` stays out of first paint.
 * IsolateErrorBoundary keeps a failed sheet fetch from blanking the app.
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
  "bg-background text-foreground rounded-2xl border border-border/60 shadow-xl max-w-[95vw] md:max-w-md p-0";

function EasyStartSheetError({
  open,
  onOpenChange,
  title,
  error,
  retry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  error: Error;
  retry: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_FALLBACK_CLASS}>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <DialogHeader>
            <DialogTitle>{title} failed</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive" role="alert">
            {error.message || "Something went wrong."}
          </p>
          <Button
            className="h-11 w-full rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
            onClick={retry}
          >
            Try again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
          <p className="text-sm text-muted-foreground">
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
  const consumerCopy = useConsumerCopy();
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
            <IsolateErrorBoundary
              label="Add money"
              fallback={({ error, retry }) => (
                <EasyStartSheetError
                  open={depositOpen}
                  onOpenChange={setDepositOpen}
                  title="Add money"
                  error={error}
                  retry={retry}
                />
              )}
            >
              <Suspense
                fallback={
                  <EasyStartSheetFallback
                    open={depositOpen}
                    onOpenChange={setDepositOpen}
                    title="Add money"
                  />
                }
              >
                <EasyStartDepositSheet
                  open={depositOpen}
                  onOpenChange={setDepositOpen}
                  onOpenAdvancedBridge={
                    consumerCopy ? undefined : openAdvancedBridge
                  }
                />
              </Suspense>
            </IsolateErrorBoundary>
          ) : null}
          {withdrawOpen ? (
            <IsolateErrorBoundary
              label="Cash out"
              fallback={({ error, retry }) => (
                <EasyStartSheetError
                  open={withdrawOpen}
                  onOpenChange={setWithdrawOpen}
                  title="Cash out"
                  error={error}
                  retry={retry}
                />
              )}
            >
              <Suspense
                fallback={
                  <EasyStartSheetFallback
                    open={withdrawOpen}
                    onOpenChange={setWithdrawOpen}
                    title="Cash out"
                  />
                }
              >
                <EasyStartWithdrawSheet
                  open={withdrawOpen}
                  onOpenChange={setWithdrawOpen}
                  onOpenAdvancedBridge={
                    consumerCopy ? undefined : openAdvancedBridge
                  }
                />
              </Suspense>
            </IsolateErrorBoundary>
          ) : null}
          {bridgeOpen && !consumerCopy ? (
            <IsolateErrorBoundary
              label="Bridge"
              fallback={({ error, retry }) => (
                <EasyStartSheetError
                  open={bridgeOpen}
                  onOpenChange={setBridgeOpen}
                  title="Bridge"
                  error={error}
                  retry={retry}
                />
              )}
            >
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
            </IsolateErrorBoundary>
          ) : null}
        </>
      ) : null}
    </EasyStartModalsContext.Provider>
  );
}
