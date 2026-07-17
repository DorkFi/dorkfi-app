import { lazy, Suspense, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  CheckCircle2,
  Loader2,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useToast } from "@/hooks/use-toast";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { cn } from "@/lib/utils";
import {
  fetchAlgorandAlgoBalance,
  fetchAlgorandUsdcBalance,
  hasEnoughAlgorandAlgo,
} from "@/lib/easyStart/baseBalances";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";

/** Loaded only while bridging so opening Withdraw never waits on `@privy-io/wagmi`. */
const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const PRESET_AMOUNTS = ["25", "50", "100", "250"];

const EASY_START_DIALOG_CONTENT_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

type WithdrawPhase =
  | "idle"
  | "fee_check"
  | "bridging"
  | "success"
  | "error";

interface EasyStartWithdrawSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAdvancedBridge?: () => void;
}

/**
 * Cash Stash–style one-click withdraw: amount → Algorand→Base USDC bridge → done.
 * Bank/card off-ramp is not wired; funds land as USDC on the Easy Start Base wallet.
 */
export function EasyStartWithdrawSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
}: EasyStartWithdrawSheetProps) {
  const { algorandAddress, evmAddress } = usePrivyEasyStart();
  const { toast } = useToast();
  const { formatNumber, formatCurrency } = useNumberI18n();

  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: algoUsdc, refetch: refetchUsdc } = useQuery({
    queryKey: ["easy-start-algo-usdc", algorandAddress],
    queryFn: () => fetchAlgorandUsdcBalance(algorandAddress!),
    enabled: Boolean(open && algorandAddress),
    refetchInterval: open ? 10_000 : false,
  });

  const availableNum = algoUsdc
    ? Number.parseFloat(algoUsdc.formatted)
    : 0;
  const hasAvailable =
    Number.isFinite(availableNum) && availableNum > 0.01;

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setBridgePhase("preparing");
    setBridgeAmount(null);
    setError(null);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      if (
        phase === "idle" ||
        phase === "success" ||
        phase === "error" ||
        phase === "fee_check"
      ) {
        resetLocal();
        setAmount("");
      }
    }
    onOpenChange(next);
  };

  const setMax = () => {
    if (!hasAvailable) return;
    const max = Math.max(0, Math.floor(availableNum * 100) / 100);
    setAmount(String(max));
  };

  const startWithdraw = async () => {
    if (!algorandAddress) return;
    setError(null);

    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      setError("Enter an amount to withdraw.");
      return;
    }
    if (requested > availableNum + 1e-9) {
      setError(
        `You only have ${availableNum.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} USDC available on Algorand. If funds are supplied to markets, withdraw them in Portfolio first.`
      );
      return;
    }

    setPhase("fee_check");
    try {
      const algo = await fetchAlgorandAlgoBalance(algorandAddress);
      if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
        setError(
          "Your Algorand account needs a little ALGO for network fees (~0.1 ALGO). Bridge a small deposit again or fund the account, then retry."
        );
        setPhase("error");
        return;
      }

      const formatted =
        requested.toFixed(6).replace(/\.?0+$/, "") || String(requested);
      setBridgeAmount(formatted);
      setPhase("bridging");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check Algorand fees");
      setPhase("error");
    }
  };

  const busy = phase === "bridging" || phase === "fee_check";

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={EASY_START_DIALOG_CONTENT_CLASS}>
          <div className="flex flex-col min-h-0">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0 space-y-2">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Withdraw
                </DialogTitle>
                <div className="flex items-center justify-center gap-2 pb-1">
                  <ArrowDownToLine className="h-5 w-5 text-ocean-teal" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Move cash back to Base
                  </span>
                </div>
                <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400">
                  {phase === "idle"
                    ? "We’ll move USDC from Algorand to your Easy Start Base wallet in one step."
                    : phase === "bridging" || phase === "fee_check"
                      ? bridgePhaseLabel(bridgePhase, "algo-to-base")
                      : phase === "success"
                        ? "USDC is ready on Base."
                        : phase === "error"
                          ? "Something went wrong — you can retry."
                          : "Working on your withdrawal…"}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6 pt-4">
              {phase === "success" ? (
                <div className="py-4 text-center space-y-4">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-ocean-teal" />
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">
                    Withdrawal complete
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    USDC is in your Base wallet
                    {evmAddress
                      ? ` (${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)})`
                      : ""}
                    . You can send it from there with your Easy Start wallet.
                  </p>
                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
                    onClick={() => handleClose(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : phase === "bridging" || phase === "fee_check" ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {phase === "fee_check"
                      ? "Checking network fees…"
                      : bridgePhaseLabel(bridgePhase, "algo-to-base")}
                  </p>
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : phase === "error" ? (
                <div className="space-y-4 py-2 text-center">
                  <p className="text-sm text-destructive" role="alert">
                    {error ?? "Withdrawal failed"}
                  </p>
                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
                    onClick={() => resetLocal()}
                  >
                    Try again
                  </Button>
                  {onOpenAdvancedBridge ? (
                    <Button
                      variant="outline"
                      className="w-full border-ocean-teal/40"
                      onClick={() => {
                        handleClose(false);
                        onOpenAdvancedBridge();
                      }}
                    >
                      Open advanced bridge
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-ocean-teal/20 bg-white/50 dark:bg-slate-900/40 px-3 py-2.5 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Available on Algorand
                    </p>
                    <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">
                      {formatCurrency(
                        Number.isFinite(availableNum) ? availableNum : 0,
                        "USD",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </div>

                  {!hasAvailable ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                      No USDC in your Algorand wallet yet. If you supplied to
                      markets, withdraw from Portfolio first, then come back
                      here.
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Amount (USD)
                        </p>
                        <button
                          type="button"
                          className="text-xs font-semibold text-ocean-teal hover:underline"
                          onClick={setMax}
                        >
                          Max
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {PRESET_AMOUNTS.map((preset) => {
                          const disabled =
                            !hasAvailable || Number(preset) > availableNum;
                          return (
                            <button
                              key={preset}
                              type="button"
                              disabled={disabled}
                              onClick={() => setAmount(preset)}
                              className={cn(
                                "rounded-xl border py-2.5 text-sm font-semibold transition-colors disabled:opacity-40",
                                amount === preset
                                  ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                                  : "border-gray-200/80 dark:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-white"
                              )}
                            >
                              ${preset}
                            </button>
                          );
                        })}
                      </div>
                      <label
                        className="text-xs text-slate-500 dark:text-slate-400"
                        htmlFor="withdraw-custom-amount"
                      >
                        Custom amount
                      </label>
                      <input
                        id="withdraw-custom-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200/80 dark:border-slate-600 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-teal/40"
                      />
                      {hasAvailable ? (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Up to{" "}
                          {formatNumber(availableNum, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          USDC
                        </p>
                      ) : null}
                    </div>
                  )}

                  {error && phase === "idle" ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                    disabled={
                      busy ||
                      !algorandAddress ||
                      !hasAvailable ||
                      !amount ||
                      Number(amount) <= 0
                    }
                    onClick={() => void startWithdraw()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Working…
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-2 h-4 w-4" />
                        Withdraw
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                    Funds move to Base USDC (not a bank transfer). Bank/card
                    cash-out isn’t available in Easy Start yet.
                  </p>

                  {onOpenAdvancedBridge ? (
                    <button
                      type="button"
                      className="w-full text-center text-xs text-slate-500 hover:text-ocean-teal underline-offset-2 hover:underline"
                      onClick={() => {
                        handleClose(false);
                        onOpenAdvancedBridge();
                      }}
                    >
                      Advanced bridge options
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {phase === "bridging" && bridgeAmount ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            direction="algo-to-base"
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                setError(err ?? "Bridge failed");
                setPhase("error");
              }
            }}
            onComplete={() => {
              setPhase("success");
              void refetchUsdc();
              onOpenChange(true);
              toast({
                title: "Withdrawal complete",
                description: "USDC is ready on your Base wallet.",
              });
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
