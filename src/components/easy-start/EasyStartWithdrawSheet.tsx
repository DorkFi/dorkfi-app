import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import type { CardProvider } from "@/components/easy-start/EasyStartCardProviderPicker";
import { EasyStartOfframpCashOut } from "@/components/easy-start/EasyStartOfframpCashOut";
import type { Address } from "viem";
import {
  AmountHero,
  AmountPresets,
  ChooseSummary,
  ContinueLabel,
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingPrimaryButton,
  FundingSheetHeader,
  InstantTagIcon,
  PayMethodList,
  PrivySecureNote,
  ReviewBreakdown,
  ReviewPayWithCard,
  SecuredByPrivy,
  TermsNote,
  TrustInline,
  TrustValueList,
  type PayMethodOption,
} from "@/components/easy-start/EasyStartFundingUi";

const PRESET_AMOUNTS = ["25", "50", "100", "250"] as const;

type WithdrawPhase = "idle" | "error";
type WithdrawStep = "choose" | "review";
type WithdrawPayMethod = "debit_card" | "bank";

interface EasyStartWithdrawSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAdvancedBridge?: () => void;
}

function methodToProvider(method: WithdrawPayMethod): CardProvider {
  return method === "bank" ? "coinbase" : "moonpay";
}

/**
 * Cash out Base USDC (MoonPay / Coinbase). Earn withdraws should already
 * have swapped Algorand → Base before this sheet.
 */
export function EasyStartWithdrawSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
}: EasyStartWithdrawSheetProps) {
  const { evmAddress } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { formatCurrency } = useNumberI18n();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<WithdrawPayMethod>("debit_card");
  const [step, setStep] = useState<WithdrawStep>("choose");
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const address = evmAddress as Address | null;
  const cashOutProvider = methodToProvider(method);

  const { data: baseUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && address),
    refetchInterval: open ? 10_000 : false,
  });

  const availableNum = baseUsdc ? Number.parseFloat(baseUsdc.formatted) : 0;
  const hasAvailable = Number.isFinite(availableNum) && availableNum > 0.01;
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

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setError(null);
    setStep("choose");
    setEditingAmount(false);
    setMethod("debit_card");
    setAmount("");
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      resetLocal();
    }
    onOpenChange(next);
  };

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
      setError(
        consumerCopy
          ? `You only have ${availableDisplay} available. If funds are in savings, withdraw from earn first.`
          : `You only have ${availableDisplay} available. Withdraw from savings first if funds are still earning.`
      );
      return;
    }
    setStep("review");
  };

  const cashOutAmount =
    amount.trim() ||
    (hasAvailable
      ? availableNum.toFixed(6).replace(/\.?0+$/, "")
      : null);

  const payMethods: PayMethodOption[] = useMemo(
    () => [
      {
        id: "debit_card",
        title: "Debit card",
        description: "Instant · Fee shown at checkout",
        icon: <CreditCard className="h-5 w-5" />,
        badge: "Recommended",
        tag: { label: "Fastest", tone: "fast" },
      },
      {
        id: "bank",
        title: "Bank account",
        description: "Usually 1–3 business days · Fee shown at checkout",
        icon: <Building2 className="h-5 w-5" />,
        tag: { label: "Bank", tone: "muted" },
      },
    ],
    []
  );

  const selectedMethod =
    payMethods.find((m) => m.id === method) ?? payMethods[0];
  const methodTitle =
    method === "bank" ? "bank" : "debit card";

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
                title={`Cash out ${amountDisplay}`}
                subtitle="Review your cash-out details"
              />
              <div className="px-6 pb-6 pt-3 space-y-4">
                <ReviewPayWithCard
                  icon={selectedMethod.icon}
                  title={selectedMethod.title}
                  tags={
                    method === "bank"
                      ? [{ label: "1–3 business days" }, { label: "Fee shown at checkout" }]
                      : [
                          { label: "Instant", icon: <InstantTagIcon /> },
                          { label: "Fee shown at checkout" },
                        ]
                  }
                  onChange={() => setStep("choose")}
                />
                <ReviewBreakdown
                  amountLabel="Amount"
                  amountValue={amountDisplay}
                  feeLabel="Processing fee"
                  feeValue="Shown at checkout"
                  receiveLabel="You'll cash out"
                  receiveValue={amountDisplay}
                  footnote={
                    method === "bank"
                      ? "Sent to your bank. Timing depends on the payout."
                      : "Sent to your debit card. Timing depends on the payout."
                  }
                />
                <TrustValueList />
                <TermsNote />
                <EasyStartOfframpCashOut
                  evmAddress={evmAddress}
                  amount={cashOutAmount}
                  provider={cashOutProvider}
                  onProviderChange={(p) =>
                    setMethod(p === "coinbase" ? "bank" : "debit_card")
                  }
                  hideProviderPicker
                  ctaLabel={`Cash out ${amountDisplay} to ${methodTitle}`}
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
                    {consumerCopy
                      ? "Nothing available to cash out yet. If funds are in savings, withdraw from earn first."
                      : "Nothing available to cash out yet. Withdraw from savings first, then cash out here."}
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

                <PayMethodList
                  label="Choose how to cash out"
                  options={payMethods}
                  value={method}
                  onChange={(id) => setMethod(id as WithdrawPayMethod)}
                />

                <PrivySecureNote />

                <ChooseSummary
                  addLabel={`You'll cash out ${amountValid ? amountDisplay : availableDisplay}`}
                  feeLabel="Fee shown at checkout"
                  receiveLabel={
                    method === "bank"
                      ? "Sent to your bank"
                      : "Sent to your debit card"
                  }
                />

                <FundingPrimaryButton
                  disabled={!address || !hasAvailable || !amountValid}
                  onClick={goReview}
                >
                  <ContinueLabel>Continue</ContinueLabel>
                </FundingPrimaryButton>

                {onOpenAdvancedBridge ? (
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
