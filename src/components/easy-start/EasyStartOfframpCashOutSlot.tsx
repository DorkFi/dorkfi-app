import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { IsolateErrorBoundary } from "@/components/IsolateErrorBoundary";
import { Button } from "@/components/ui/button";
import type { CardProvider } from "@/components/easy-start/EasyStartCardProviderPicker";

const EasyStartOfframpCashOut = lazy(() =>
  import("@/components/easy-start/EasyStartOfframpCashOut").then((m) => ({
    default: m.EasyStartOfframpCashOut,
  }))
);

type EasyStartOfframpCashOutSlotProps = {
  evmAddress: string | null;
  amount: string | null;
  provider: CardProvider;
  onProviderChange: (provider: CardProvider) => void;
  onDone?: () => void;
  hideProviderPicker?: boolean;
  ctaLabel?: string;
  resumePartnerUserRef?: string | null;
  resumeSendTxHash?: string | null;
  onResumeConsumed?: () => void;
};

/**
 * Lazy cash-out with an error boundary so a MoonPay/Privy hook throw cannot
 * unmount PrivyProvider (PrivyMountErrorBoundary sits above this tree).
 */
export function EasyStartOfframpCashOutSlot(
  props: EasyStartOfframpCashOutSlotProps
) {
  return (
    <IsolateErrorBoundary
      label="Cash out"
      fallback={({ error, retry }) => (
        <div className="space-y-3 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error.message || "Cash-out failed to load."}
          </p>
          <Button
            className="h-12 w-full rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
            onClick={retry}
          >
            Try again
          </Button>
        </div>
      )}
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-ocean-teal" />
          </div>
        }
      >
        <EasyStartOfframpCashOut {...props} />
      </Suspense>
    </IsolateErrorBoundary>
  );
}
