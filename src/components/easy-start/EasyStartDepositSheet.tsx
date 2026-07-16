import { useState } from "react";
import { useFundWallet } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { CreditCard, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

const PRESET_AMOUNTS = ["50", "100", "250", "500"];

/** Wait for Radix Dialog overlay/focus trap to tear down before opening Privy. */
const PRIVY_MODAL_HANDOFF_MS = 200;

const EASY_START_DIALOG_CONTENT_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

interface EasyStartDepositSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueToBridge?: () => void;
}

function isUserCanceledFunding(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("close") ||
    lower.includes("exited") ||
    lower.includes("dismiss")
  );
}

/** Must render under PrivyProvider (only opened from authenticated Easy Start menu). */
export function EasyStartDepositSheet({
  open,
  onOpenChange,
  onContinueToBridge,
}: EasyStartDepositSheetProps) {
  const { fundWallet } = useFundWallet();
  const { evmAddress } = usePrivyEasyStart();
  const { toast } = useToast();

  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFund = async () => {
    if (!evmAddress) return;
    setLoading(true);
    setError(null);

    // Close Add USDC first so Privy's funding modal is not nested under Radix Dialog.
    onOpenChange(false);
    await new Promise((resolve) => setTimeout(resolve, PRIVY_MODAL_HANDOFF_MS));

    try {
      // Privy react-auth v2 API: fundWallet(address, config) — not the v3 object form.
      await fundWallet(evmAddress, {
        chain: base,
        asset: "USDC",
        amount,
        defaultFundingMethod: "card",
        card: {
          preferredProvider: "moonpay",
        },
      });
      setSuccess(true);
      onOpenChange(true);
      toast({
        title: "Deposit initiated",
        description:
          "USDC is on its way. Next, move it to Algorand to use DorkFi markets.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        return;
      }
      const display = message || "Something went wrong opening payment";
      setError(display);
      onOpenChange(true);
      toast({
        title: "Payment couldn’t start",
        description: display,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSuccess(false);
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={EASY_START_DIALOG_CONTENT_CLASS}>
        <div className="flex flex-col min-h-0">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
            <DialogHeader className="pb-0 space-y-2">
              <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                Add USDC
              </DialogTitle>
              <div className="flex items-center justify-center gap-2 pb-1">
                <CreditCard className="h-5 w-5 text-ocean-teal" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Card · Apple Pay · Google Pay
                </span>
              </div>
              <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400">
                Funds arrive as USDC on Base, then you can move them to your
                Algorand account to start earning.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 pt-4">
            {success ? (
              <div className="py-4 text-center space-y-4">
                <p className="text-lg font-semibold text-slate-800 dark:text-white">
                  Deposit initiated
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  USDC is on its way. Next, move it to Algorand to use DorkFi
                  markets.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  {onContinueToBridge ? (
                    <Button
                      className="bg-ocean-teal hover:bg-ocean-teal/90 text-white"
                      onClick={() => {
                        handleClose(false);
                        onContinueToBridge();
                      }}
                    >
                      Move to Algorand
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="border-ocean-teal/40"
                    onClick={() => handleClose(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                    Amount (USD)
                  </p>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={cn(
                          "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                          amount === preset
                            ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                            : "border-gray-200/80 dark:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-white"
                        )}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                  <label
                    className="text-xs text-slate-500 dark:text-slate-400"
                    htmlFor="deposit-custom-amount"
                  >
                    Custom amount
                  </label>
                  <input
                    id="deposit-custom-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200/80 dark:border-slate-600 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-teal/40"
                  />
                </div>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                {!evmAddress ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Waiting for your Easy Start wallet… If this persists, sign
                    out and sign in again.
                  </p>
                ) : null}

                <Button
                  className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                  disabled={
                    loading || !evmAddress || !amount || Number(amount) <= 0
                  }
                  onClick={() => void handleFund()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening payment…
                    </>
                  ) : (
                    "Continue to payment"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
