import { lazy, Suspense, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  bridgePhaseLabel,
  type EasyStartBridgeDirection,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";

const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const PRESET_AMOUNTS = ["25", "50", "100", "250"];

const DIALOG_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

interface EasyStartBridgeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Advanced Easy Start USDC move: Base ↔ Algorand via Aramid Bridge.
 * Escape hatch when Deposit / Withdraw orchestration is not enough.
 */
export function EasyStartBridgeSheet({
  open,
  onOpenChange,
}: EasyStartBridgeSheetProps) {
  const { evmAddress, algorandAddress } = usePrivyEasyStart();
  const { toast } = useToast();

  const [direction, setDirection] =
    useState<EasyStartBridgeDirection>("base-to-algo");
  const [amount, setAmount] = useState("100");
  const [running, setRunning] = useState(false);
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(evmAddress && algorandAddress);
  const busy = running;

  const reset = () => {
    setRunning(false);
    setBridgePhase("preparing");
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      if (!running) reset();
    }
    onOpenChange(next);
  };

  const start = () => {
    if (!ready || !amount || Number(amount) <= 0) return;
    setError(null);
    setBridgePhase("preparing");
    setRunning(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={DIALOG_CLASS}>
          <DialogHeader className="px-5 pt-5 pb-2 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ArrowLeftRight className="h-5 w-5 text-ocean-teal" />
              Move USDC
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300">
              Base ↔ Algorand USDC via Aramid Bridge
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
            <Tabs
              value={direction}
              onValueChange={(v) => {
                if (running) return;
                setDirection(v as EasyStartBridgeDirection);
              }}
              className="w-full"
            >
              <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
                <TabsTrigger
                  value="base-to-algo"
                  className="rounded-lg text-xs"
                  disabled={running}
                >
                  Base → Algorand
                </TabsTrigger>
                <TabsTrigger
                  value="algo-to-base"
                  className="rounded-lg text-xs"
                  disabled={running}
                >
                  Algorand → Base
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {!running ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white/80 dark:bg-slate-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ocean-teal/40"
                  />
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AMOUNTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs",
                          amount === p
                            ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                            : "border-border text-slate-600 dark:text-slate-300"
                        )}
                        onClick={() => setAmount(p)}
                      >
                        ${p}
                      </button>
                    ))}
                  </div>
                </div>

                {!ready ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Easy Start wallet is still preparing…
                  </p>
                ) : null}

                {error ? (
                  error.startsWith("http") ? (
                    <p className="text-xs">
                      <a
                        href={error}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ocean-teal underline break-all"
                      >
                        Need help?
                      </a>
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  )
                ) : null}

                <Button
                  className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                  disabled={!ready || !amount || Number(amount) <= 0}
                  onClick={start}
                >
                  Bridge USDC
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                {bridgePhase === "success" ? null : (
                  <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                )}
                <p className="text-sm font-medium">
                  {bridgePhaseLabel(bridgePhase, direction)}
                </p>
                {error ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {direction === "algo-to-base"
                      ? "This can take a few minutes. You can close this and check back."
                      : "Keep this window open until the swap finishes."}
                  </p>
                )}
                {error ? (
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      reset();
                    }}
                  >
                    Try again
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {running && amount ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={amount}
            direction={direction}
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                setError(err ?? "Swap failed");
              }
              if (p === "pending") {
                setError(err);
                setRunning(false);
              }
            }}
            onComplete={() => {
              setBridgePhase("success");
              setRunning(false);
              toast({
                title: "Swap complete",
                description:
                  direction === "algo-to-base"
                    ? "USDC is ready on your Base wallet."
                    : "USDC is ready on your Algorand account.",
              });
              onOpenChange(false);
              reset();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
