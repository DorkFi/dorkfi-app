import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { Landmark, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { fetchAlgorandAlgoTotal } from "@/lib/easyStart/baseBalances";
import { createWalletCoinbaseSession } from "@/lib/easyStart/offrampApi";
import { signAlgorandOnrampProof } from "@/lib/easyStart/walletOnrampProof";
import {
  AmountHero,
  AmountPresets,
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingPrimaryButton,
  FundingSheetHeader,
  TermsNote,
} from "@/components/easy-start/EasyStartFundingUi";

type Phase = "form" | "signing" | "awaiting" | "success" | "error";

const PRESETS = ["50", "100", "250", "500"] as const;

interface WalletAddMoneySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}

/**
 * Bank buy of ALGO into a connected Algorand wallet (Pera, Defly, WalletConnect).
 * The wallet signs a 0 ALGO payment so the Coinbase session can only pay that address.
 */
export function WalletAddMoneySheet({
  open,
  onOpenChange,
  address,
}: WalletAddMoneySheetProps) {
  const { signTransactions } = useWallet();
  const { toast } = useToast();
  const { formatCurrency } = useNumberI18n();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("100");
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const beforeRef = useRef(0);

  const { data: algoTotal } = useQuery({
    queryKey: ["wallet-onramp-algo", address],
    queryFn: () => fetchAlgorandAlgoTotal(address),
    enabled: open && phase === "awaiting",
    refetchInterval: phase === "awaiting" ? 4_000 : false,
  });

  useEffect(() => {
    if (!open) {
      setPhase("form");
      setError(null);
      setPopupBlocked(false);
      setBuyUrl(null);
      setEditingAmount(false);
    }
  }, [open]);

  useEffect(() => {
    if (phase !== "awaiting" || !algoTotal) return;
    const now = Number(algoTotal.formatted);
    if (!Number.isFinite(now)) return;
    if (now - beforeRef.current < 0.5) return;
    setPhase("success");
    void queryClient.invalidateQueries({ queryKey: ["swapBalance"] });
  }, [algoTotal, phase, queryClient]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 1;
  const amountDisplay = formatCurrency(amountValid ? amountNum : 0, "USD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const openBuy = (url: string) => {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    setPopupBlocked(!popup);
    setPhase("awaiting");
  };

  const start = async () => {
    if (!amountValid) return;
    if (!signTransactions) {
      setError("This wallet can’t sign. Reconnect it and try again.");
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("signing");
    try {
      const before = await fetchAlgorandAlgoTotal(address);
      beforeRef.current = Number(before.formatted) || 0;
      const walletProof = await signAlgorandOnrampProof(
        address,
        signTransactions
      );
      const session = await createWalletCoinbaseSession({
        address,
        walletProof,
        amount,
      });
      if (!session.buyUrl) {
        throw new Error("Coinbase Onramp URL missing. Redeploy the API.");
      }
      setBuyUrl(session.buyUrl);
      openBuy(session.buyUrl);
      toast({
        title: "Finish your ALGO purchase",
        description:
          "Complete the purchase in the new tab. ALGO is sent to this wallet.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t open Coinbase");
      setPhase("error");
    }
  };

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        {phase === "success" ? (
          <>
            <FundingSheetHeader
              title="ALGO is on the way"
              subtitle={`Coinbase is sending ALGO to ${short}.`}
            />
            <div className="space-y-4 px-6 pb-6">
              <FundingPrimaryButton onClick={() => onOpenChange(false)}>
                Done
              </FundingPrimaryButton>
            </div>
          </>
        ) : phase === "signing" ? (
          <>
            <FundingSheetHeader
              title="Confirm in your wallet"
              subtitle="Sign a $0 payment to your own address. Nothing is sent."
            />
            <div className="flex flex-col items-center gap-3 px-6 pb-10 pt-4">
              <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
            </div>
          </>
        ) : phase === "awaiting" ? (
          <>
            <FundingSheetHeader
              title="Finish your bank deposit"
              subtitle="Complete the purchase in the Coinbase tab. We’ll detect the ALGO here."
            />
            <div className="space-y-4 px-6 pb-6 pt-2">
              <FundingPrimaryButton
                onClick={() => {
                  if (buyUrl) openBuy(buyUrl);
                }}
              >
                Reopen bank deposit
              </FundingPrimaryButton>
              {popupBlocked ? (
                <p className="text-center text-sm text-muted-foreground">
                  Your browser may have blocked the tab.
                </p>
              ) : null}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <FundingSheetHeader
              title="Add money"
              subtitle={`Buy ALGO for ${short}`}
              icon={
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal">
                  <Landmark className="h-7 w-7" />
                </span>
              }
            />
            <div className="space-y-4 px-6 pb-6">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <AmountHero
                id="wallet-add-money-amount"
                amount={amount}
                onChange={setAmount}
                editing={editingAmount}
                onEditingChange={setEditingAmount}
                display={amountDisplay}
              />
              <AmountPresets
                amounts={PRESETS}
                value={amount}
                onChange={setAmount}
              />
              <p className="text-center text-sm text-muted-foreground">
                Your wallet signs a $0 payment to itself so Coinbase can pay
                this address. The payment is not submitted.
              </p>
              <FundingPrimaryButton
                disabled={!amountValid}
                onClick={() => void start()}
              >
                Pay {amountDisplay} with bank deposit
              </FundingPrimaryButton>
              <TermsNote />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
