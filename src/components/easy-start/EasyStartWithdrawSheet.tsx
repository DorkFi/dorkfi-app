import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import {
  cashOutEmptyBucket,
  cashOutEmptyDescription,
} from "@/lib/easyStart/cashOutBuckets";
import { useEasyStartPortfolioTotal } from "@/hooks/useEasyStartPortfolioTotal";
import type { CardProvider } from "@/components/easy-start/EasyStartCardProviderPicker";
import type { Address } from "viem";
import {
  AmountHero,
  AmountPresets,
  ChooseSummary,
  ContinueLabel,
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingPrimaryButton,
  FundingSheetHeader,
  PrivySecureNote,
  ReviewBreakdown,
  ReviewPayWithCard,
  SecuredByPrivy,
  TermsNote,
  TrustInline,
  TrustValueList,
} from "@/components/easy-start/EasyStartFundingUi";
import { EasyStartOfframpCashOutSlot } from "@/components/easy-start/EasyStartOfframpCashOutSlot";

const PRESET_AMOUNTS = ["25", "50", "100", "250"] as const;

type WithdrawPhase = "idle" | "error";
type WithdrawStep = "choose" | "review";

interface EasyStartWithdrawSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAdvancedBridge?: () => void;
  /** Resume Coinbase cash-out after same-tab return to /savings. */
  resumeOfframp?: {
    partnerUserRef: string;
    amount: string | null;
    sendTxHash?: string | null;
  } | null;
  onResumeConsumed?: () => void;
}

/**
 * Cash out Base USDC through Coinbase. Earn withdraws should already
 * have swapped Algorand → Base before this sheet.
 */
export function EasyStartWithdrawSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
  resumeOfframp = null,
  onResumeConsumed,
}: EasyStartWithdrawSheetProps) {
  const { evmAddress } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { formatCurrency } = useNumberI18n();

  const [amount, setAmount] = useState(resumeOfframp?.amount ?? "");
  const [step, setStep] = useState<WithdrawStep>(
    resumeOfframp ? "review" : "choose"
  );
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const address = evmAddress as Address | null;
  const cashOutProvider: CardProvider = "coinbase";

  const { data: baseUsdc, isLoading: baseUsdcLoading } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && address),
    refetchInterval: open ? 10_000 : false,
  });

  const availableNum = baseUsdc ? Number.parseFloat(baseUsdc.formatted) : 0;
  const hasAvailable = Number.isFinite(availableNum) && availableNum > 0.01;
  const portfolio = useEasyStartPortfolioTotal();
  const earnUsd = portfolio.depositUsd;
  const algorandUsd = portfolio.algoWalletUsd ?? 0;
  const bucketsLoading =
    !hasAvailable &&
    (portfolio.isLoading || (Boolean(address) && baseUsdcLoading && !baseUsdc));
  const emptyDescription = bucketsLoading
    ? null
    : cashOutEmptyDescription({
        consumerCopy,
        baseUsd: Number.isFinite(availableNum) ? availableNum : 0,
        earnUsd,
        algorandUsd,
      });
  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const amountDisplay = formatCurrency(amountValid ? amountNum : 0, "USD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const availableDisplay = formatCurrency(
    Number.isFinite(availableNum) ? availableNum : 0,
    "USD",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );

  const applyResume = useCallback(() => {
    if (!resumeOfframp) return;
    if (resumeOfframp.amount) setAmount(resumeOfframp.amount);
    setStep("review");
    setEditingAmount(false);
    setPhase("idle");
    setError(null);
  }, [resumeOfframp]);

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setError(null);
    setStep("choose");
    setEditingAmount(false);
    setAmount("");
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      resetLocal();
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open || !resumeOfframp) return;
    applyResume();
  }, [applyResume, open, resumeOfframp]);

  const setMax = () => {
    if (!hasAvailable) return;
    const max = Math.max(0, Math.floor(availableNum * 100) / 100);
    setAmount(String(max));
    setEditingAmount(false);
  };

  const goReview = () => {
    setError(null);
    if (!amountValid) {
      setError("Enter an amount to cash out.");
      return;
    }
    if (amountNum > availableNum + 1e-9) {
      const elsewhere = cashOutEmptyBucket({
        baseUsd: 0,
        earnUsd,
        algorandUsd,
      });
      const ready = consumerCopy
        ? `You only have ${availableDisplay} ready to cash out.`
        : `You only have ${availableDisplay} available.`;
      const hint =
        elsewhere === "earn"
          ? consumerCopy
            ? " Withdraw from Earn first."
            : " Withdraw from savings first."
          : elsewhere === "algorand"
            ? consumerCopy
              ? " The rest isn’t ready to cash out. Move it to your account first."
              : " The rest is on Algorand. Move it to Base before cashing out."
            : "";
      setError(`${ready}${hint}`);
      return;
    }
    setStep("review");
  };

  const cashOutAmount =
    amount.trim() ||
    (hasAvailable
      ? availableNum.toFixed(6).replace(/\.?0+$/, "")
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="flex flex-col min-h-0">
          {phase === "error" ? (
            <>
              <FundingSheetHeader
                title="Couldn’t cash out"
                subtitle="Something went wrong — you can retry."
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {error ?? "Withdrawal failed"}
                </p>
                <FundingPrimaryButton
                  onClick={() => {
                    setPhase("idle");
                    setError(null);
                    setStep("choose");
                  }}
                >
                  Try again
                </FundingPrimaryButton>
              </div>
            </>
          ) : step === "review" ? (
            <>
              <FundingSheetHeader
                onBack={() => setStep("choose")}
                title="Review cash-out"
                subtitle="Amount to send. Fee and arrival time are shown on the next screen."
              />
              <div className="px-6 pb-6 pt-3 space-y-4">
                <ReviewPayWithCard
                  icon={<Landmark className="h-5 w-5" />}
                  title="Cash out"
                  tags={[{ label: "Fee and arrival time shown on the next screen" }]}
                />
                <ReviewBreakdown
                  amountLabel="Amount to send"
                  amountValue={amountDisplay}
                  feeLabel="Fee and arrival"
                  feeValue="Shown on the next screen"
                  footnote="You’ll pick the payout on the next screen. Fee and arrival time are shown there."
                />
                <TrustValueList />
                <TermsNote />
                <EasyStartOfframpCashOutSlot
                  evmAddress={evmAddress}
                  amount={cashOutAmount}
                  provider={cashOutProvider}
                  onProviderChange={() => {
                    // One Coinbase session. Payout method is chosen there.
                  }}
                  hideProviderPicker
                  ctaLabel="Continue"
                  resumePartnerUserRef={resumeOfframp?.partnerUserRef ?? null}
                  resumeSendTxHash={resumeOfframp?.sendTxHash ?? null}
                  onResumeConsumed={onResumeConsumed}
                  onDone={() => handleClose(false)}
                />
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => handleClose(false)}
                >
                  {consumerCopy ? "Keep in account" : "Keep in wallet"}
                </Button>
                <SecuredByPrivy />
              </div>
            </>
          ) : (
            <>
              <FundingSheetHeader
                title="Cash out"
                subtitle={
                  consumerCopy
                    ? "Send money from your SimplFi balance."
                    : "Send money from your account."
                }
              />
              <div className="px-6 pb-6 pt-3 space-y-5">
                <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Available
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {availableDisplay}
                  </p>
                </div>

                {!hasAvailable ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    {bucketsLoading
                      ? "Checking your balances…"
                      : (emptyDescription ?? "Nothing to cash out.")}
                  </p>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                    <AmountPresets
                      amounts={PRESET_AMOUNTS}
                      value={amount}
                      onChange={(next) => {
                        setAmount(next);
                        setEditingAmount(false);
                      }}
                      disabledAmount={(preset) => Number(preset) > availableNum}
                    />
                    <div className="mt-3">
                      <AmountHero
                        id="withdraw-custom-amount"
                        amount={amount}
                        onChange={setAmount}
                        editing={editingAmount}
                        onEditingChange={setEditingAmount}
                        display={amountDisplay}
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div className="mt-2.5">
                      <TrustInline>
                        Your money is secure and always under your control.
                      </TrustInline>
                    </div>
                  </div>
                )}

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="rounded-xl border border-border bg-background px-4 py-3.5">
                  <p className="text-sm font-semibold">Cash out</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    You’ll pick the payout on the next screen. Fee and arrival
                    time are shown there.
                  </p>
                </div>

                <PrivySecureNote />

                <ChooseSummary
                  addLabel={`Amount to send ${amountValid ? amountDisplay : availableDisplay}`}
                  feeLabel="Fee and arrival time shown on the next screen"
                  receiveLabel="Payout chosen on the next screen"
                />

                <FundingPrimaryButton
                  disabled={!address || !hasAvailable || !amountValid}
                  onClick={goReview}
                >
                  <ContinueLabel>Continue</ContinueLabel>
                </FundingPrimaryButton>

                {onOpenAdvancedBridge && !consumerCopy ? (
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground hover:text-ocean-teal underline-offset-2 hover:underline"
                    onClick={() => {
                      handleClose(false);
                      onOpenAdvancedBridge();
                    }}
                  >
                    Advanced bridge options
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
