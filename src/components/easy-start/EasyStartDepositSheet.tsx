import { useState } from "react";
import { useFundWallet } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { CreditCard, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { cn } from "@/lib/utils";

const PRESET_AMOUNTS = ["50", "100", "250", "500"];

interface EasyStartDepositSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueToBridge?: () => void;
}

/** Must render under PrivyProvider (only opened from authenticated Easy Start menu). */
export function EasyStartDepositSheet({
  open,
  onOpenChange,
  onContinueToBridge,
}: EasyStartDepositSheetProps) {
  const { fundWallet } = useFundWallet();
  const { evmAddress } = usePrivyEasyStart();

  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFund = async () => {
    if (!evmAddress) return;
    setLoading(true);
    setError(null);
    try {
      await fundWallet({
        address: evmAddress,
        options: {
          chain: base,
          asset: "USDC",
          amount,
        },
      });
      setSuccess(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.toLowerCase().includes("cancel") ||
        message.toLowerCase().includes("close")
      ) {
        return;
      }
      setError(message || "Something went wrong");
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
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-ocean-teal" />
            Add USDC
          </SheetTitle>
          <SheetDescription>
            Pay with debit card, Apple Pay, or Google Pay. Funds arrive as USDC,
            then you can move them to your Algorand account to start earning.
          </SheetDescription>
        </SheetHeader>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-lg font-semibold">Deposit initiated</p>
            <p className="text-sm text-muted-foreground">
              USDC is on its way. Next, move it to Algorand to use DorkFi markets.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {onContinueToBridge ? (
                <Button
                  className="bg-ocean-teal hover:bg-ocean-teal/90"
                  onClick={() => {
                    handleClose(false);
                    onContinueToBridge();
                  }}
                >
                  Move to Algorand
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
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
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <label
                className="text-xs text-muted-foreground"
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
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              className="w-full bg-ocean-teal hover:bg-ocean-teal/90"
              disabled={loading || !evmAddress || !amount || Number(amount) <= 0}
              onClick={handleFund}
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
      </SheetContent>
    </Sheet>
  );
}
