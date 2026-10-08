import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import { isXoGeoRestricted } from "@/lib/easyStart/xoSwap/errors";
import { createCoinbaseSession } from "@/lib/easyStart/offrampApi";
import {
  BANK_DEPOSIT_MIN_GAIN_USDC,
  BANK_DEPOSIT_POLL_MS,
  bankDepositBaseline,
  clearPendingBankDeposit,
  readPendingBankDeposit,
  savePendingBankDeposit,
  type PendingBankDeposit,
} from "@/lib/easyStart/pendingBankDeposit";
import {
  AmountHero,
  AmountPresets,
  ChooseSummary,
  ContinueLabel,
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingPrimaryButton,
  FundingSheetHeader,
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

const PRESET_AMOUNTS = ["50", "100", "250", "500"] as const;

type DepositPhase =
  | "idle"
  | "funding"
  | "awaiting_coinbase"
  | "gas"
  | "success"
  | "error";
type DepositStep = "choose" | "review";
type DepositPayMethod = "coinbase" | "balance";

interface EasyStartDepositSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional escape hatch to the advanced XO Swap UI. */
  onOpenAdvancedBridge?: () => void;
  /** Saved bank deposit to restore after the sheet was closed. */
  resumeBankDeposit?: PendingBankDeposit | null;
  /** Fired when the user dismisses the follow-through and the watch should stop. */
  onBankDepositSettled?: () => void;
  /** Funds were seen. Stops the closed-sheet watcher from opening Add money again. */
  onBankDepositDetected?: () => void;
  /** The closed-sheet watch already saw the USDC credit. Skip the waiting screen. */
  bankDepositArrived?: boolean;
}

/**
 * Coinbase Onramp to Base USDC, using the existing CDP session API.
 * Funds stay in the Easy Start Base wallet until Deposit to Earn
 * (Exodus XO Swap + supply).
 */
export function EasyStartDepositSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
  resumeBankDeposit = null,
  onBankDepositSettled,
  onBankDepositDetected,
  bankDepositArrived = false,
}: EasyStartDepositSheetProps) {
  const { evmAddress, getAccessToken } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { formatCurrency } = useNumberI18n();
  const { toast } = useToast();

  const [amount, setAmount] = useState(resumeBankDeposit?.amount ?? "100");
  const [method, setMethod] = useState<DepositPayMethod>("coinbase");
  const [step, setStep] = useState<DepositStep>("choose");
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<DepositPhase>(
    bankDepositArrived
      ? "funding"
      : resumeBankDeposit
        ? "awaiting_coinbase"
        : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const address = evmAddress as Address | null;
  const skipFiat = method === "balance";
  const usdcBeforeRef = useRef(resumeBankDeposit?.usdcBefore ?? 0);
  const resumeAt = resumeBankDeposit?.at ?? null;

  const { data: baseUsdc, refetch: refetchUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && address),
    refetchInterval: open
      ? phase === "awaiting_coinbase"
        ? BANK_DEPOSIT_POLL_MS
        : 10_000
      : false,
  });

  const baseUsdcNum = baseUsdc ? Number.parseFloat(baseUsdc.formatted) : 0;
  const hasUsdcOnBase = Number.isFinite(baseUsdcNum) && baseUsdcNum > 0.01;

  useEffect(() => {
    if (method === "balance" && !hasUsdcOnBase) {
      setMethod("coinbase");
      setAmount("100");
    }
  }, [hasUsdcOnBase, method]);

  useEffect(() => {
    if (!resumeBankDeposit || resumeAt == null) return;
    if (
      address &&
      resumeBankDeposit.address.toLowerCase() !== address.toLowerCase()
    ) {
      return;
    }
    usdcBeforeRef.current = resumeBankDeposit.usdcBefore;
    setAmount(resumeBankDeposit.amount);
    setMethod("coinbase");
    setPhase((current) => {
      if (bankDepositArrived) return current;
      return current === "idle" || current === "awaiting_coinbase"
        ? "awaiting_coinbase"
        : current;
    });
  }, [address, bankDepositArrived, resumeAt, resumeBankDeposit]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const amountDisplay = formatCurrency(
    amountValid ? amountNum : 0,
    "USD",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setError(null);
    setPopupBlocked(false);
    setStep("choose");
    setEditingAmount(false);
    setMethod("coinbase");
    setAmount("100");
  }, []);

  const settleBankDeposit = () => {
    clearPendingBankDeposit();
    onBankDepositSettled?.();
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      if (phase === "awaiting_coinbase") {
        toast({
          title: "Still watching for your deposit",
          description:
            "You can close this. We’ll let you know when the money arrives.",
        });
      } else if (phase === "success" || phase === "gas") {
        settleBankDeposit();
        resetLocal();
      } else if (phase === "error" || phase === "idle") {
        resetLocal();
      }
    }
    onOpenChange(next);
  };

  const markSuccess = () => {
    void refetchUsdc();
    setPhase("success");
    onOpenChange(true);
  };

  const ensureGasThenFinish = useCallback(async () => {
    if (!address) return;
    try {
      const eth = await fetchBaseEthBalance(address);
      if (!hasEnoughBaseEth(eth.value)) {
        setPhase("gas");
        onOpenChange(true);
        return;
      }
      markSuccess();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check processing fees");
      setPhase("error");
      onOpenChange(true);
    }
  }, [address, onOpenChange]);

  const notedArrival = useRef(false);
  const noteArrival = useCallback(() => {
    if (notedArrival.current || !address) return;
    notedArrival.current = true;
    onBankDepositDetected?.();
    toast({
      title: "Payment received",
      description: consumerCopy
        ? "Funds are in your account."
        : "USDC is in your Base wallet.",
    });
    void ensureGasThenFinish();
  }, [
    address,
    consumerCopy,
    ensureGasThenFinish,
    onBankDepositDetected,
    toast,
  ]);

  useEffect(() => {
    if (bankDepositArrived && phase === "funding") {
      noteArrival();
      return;
    }
    if (phase !== "awaiting_coinbase") return;
    const gained = baseUsdcNum - usdcBeforeRef.current;
    if (gained < BANK_DEPOSIT_MIN_GAIN_USDC) return;
    setPhase("funding");
    noteArrival();
  }, [bankDepositArrived, baseUsdcNum, noteArrival, phase]);

  const handleCoinbaseOnramp = async () => {
    if (!address) return;
    setError(null);
    setPopupBlocked(false);
    if (!getAccessToken) {
      setError("Sign in to add money with Coinbase.");
      setPhase("error");
      return;
    }
    setPhase("funding");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to add money with Coinbase.");
      }
      const baseline = bankDepositBaseline({
        existing: readPendingBankDeposit(address),
        currentUsdc: baseUsdcNum,
      });
      usdcBeforeRef.current = baseline;
      const session = await createCoinbaseSession({
        address,
        accessToken,
        amount,
      });
      if (!session.buyUrl) {
        throw new Error("Coinbase Onramp URL missing. Redeploy the API.");
      }
      savePendingBankDeposit({
        address,
        amount,
        usdcBefore: baseline,
        partnerUserRef: session.partnerUserRef,
      });
      const popup = window.open(
        session.buyUrl,
        "_blank",
        "noopener,noreferrer"
      );
      // Browsers often return null even when the tab opened (especially with
      // noopener). Treat a missing handle as waiting, not a failed deposit.
      const opened = Boolean(popup);
      setPopupBlocked(!opened);
      setPhase("awaiting_coinbase");
      toast({
        title: "Finish your bank deposit",
        description: opened
          ? "Complete the transfer in the new tab. We’ll detect the funds automatically."
          : "If a new tab didn’t open, tap Reopen bank deposit.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t open Coinbase Onramp");
      setPhase("error");
      toast({
        title: "Coinbase Onramp couldn’t start",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleFundGas = async () => {
    if (!address) return;
    setError(null);
    try {
      const eth = await fetchBaseEthBalance(address);
      if (hasEnoughBaseEth(eth.value)) {
        markSuccess();
        return;
      }
      setPhase("gas");
      setError(
        "A small ETH balance is sponsored after you sign in. Wait a moment, then try again."
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check processing fees");
      setPhase("error");
    }
  };

  const handleDeposit = async () => {
    if (!address) return;
    setError(null);

    if (skipFiat) {
      if (!hasUsdcOnBase) {
        setError(
          consumerCopy
            ? "No funds in your account yet. Add money with a bank deposit first."
            : "No USDC on Base yet. Add money with a bank deposit first."
        );
        setPhase("error");
        return;
      }
      setPhase("funding");
      await ensureGasThenFinish();
      return;
    }

    await handleCoinbaseOnramp();
  };

  const selectMethod = (id: string) => {
    const next = id as DepositPayMethod;
    if (next === "balance" && hasUsdcOnBase) {
      const max = Math.max(0, Math.floor(baseUsdcNum * 100) / 100);
      setAmount(String(max));
    } else if (method === "balance" && next !== "balance") {
      setAmount("100");
    }
    setMethod(next);
  };

  const payMethods: PayMethodOption[] = useMemo(() => {
    const methods: PayMethodOption[] = [
      {
        id: "coinbase",
        title: "Bank Deposits",
        description: "Transfer from your bank account",
        icon: <Landmark className="h-5 w-5" />,
        badge: "Lowest Fees",
      },
    ];
    if (hasUsdcOnBase) {
      methods.push({
        id: "balance",
        title: consumerCopy ? "SimplFi balance" : "Account balance",
        description: `${formatCurrency(baseUsdcNum, "USD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} available`,
        icon: <Wallet className="h-5 w-5" />,
      });
    }
    return methods;
  }, [baseUsdcNum, consumerCopy, formatCurrency, hasUsdcOnBase]);

  const selectedMethod = payMethods.find((m) => m.id === method) ?? payMethods[0];
  const payCta =
    method === "coinbase"
      ? `Pay ${amountDisplay} with bank deposit`
      : `Continue with ${amountDisplay}`;

  const busy = phase === "funding";
  const canContinue = Boolean(address) && amountValid && !busy;

  const goReview = () => {
    setError(null);
    if (!amountValid) {
      setError("Enter an amount to add.");
      return;
    }
    setStep("review");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="flex flex-col min-h-0">
          {phase === "success" ? (
            <>
              <FundingSheetHeader
                title={consumerCopy ? "Money added" : "Deposit complete"}
                subtitle={
                  consumerCopy
                    ? "Your funds are in your account."
                    : "USDC is in your Base wallet."
                }
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-ocean-teal" />
                <p className="text-sm text-muted-foreground">
                  {consumerCopy
                    ? "Open Deposit to Earn when you’re ready to start earning."
                    : "Use Deposit to Earn to swap to Algorand and supply."}
                </p>
                <FundingPrimaryButton onClick={() => handleClose(false)}>
                  Done
                </FundingPrimaryButton>
              </div>
            </>
          ) : phase === "funding" ? (
            <>
              <FundingSheetHeader
                title={consumerCopy ? "Add money" : "Deposit"}
                subtitle={
                  bankDepositArrived
                    ? "Confirming your deposit…"
                    : "Opening payment…"
                }
              />
              <div className="px-6 pb-10 pt-4 flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </>
          ) : phase === "awaiting_coinbase" ? (
            <>
              <FundingSheetHeader
                title="Finish your bank deposit"
                subtitle="A new tab should have opened. Complete the transfer there, then return here."
              />
              <div className="px-6 pb-6 pt-2 space-y-4">
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground text-center">
                  We’ll detect the funds automatically.
                </p>
                {popupBlocked ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Your browser may have blocked it. Tap below to try again.
                  </p>
                ) : null}
                <FundingPrimaryButton
                  onClick={() => void handleCoinbaseOnramp()}
                >
                  Reopen bank deposit
                </FundingPrimaryButton>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => void ensureGasThenFinish()}
                >
                  I already deposited
                </Button>
              </div>
            </>
          ) : phase === "gas" ? (
            <>
              <FundingSheetHeader
                title="Almost there"
                subtitle="A small processing fee is needed so you can start earning later."
              />
              <div className="px-6 pb-6 pt-2 space-y-4">
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <FundingPrimaryButton onClick={() => void handleFundGas()}>
                  Continue
                </FundingPrimaryButton>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => void ensureGasThenFinish()}
                >
                  I already paid — continue
                </Button>
              </div>
            </>
          ) : phase === "error" ? (
            <>
              <FundingSheetHeader
                title="Couldn’t add money"
                subtitle={
                  isXoGeoRestricted(error)
                    ? "This payment method isn’t available in your region."
                    : "Something went wrong — you can retry."
                }
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {error ?? "Deposit failed"}
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
                {onOpenAdvancedBridge ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      handleClose(false);
                      onOpenAdvancedBridge();
                    }}
                  >
                    Open advanced bridge
                  </Button>
                ) : null}
              </div>
            </>
          ) : step === "review" ? (
            <>
              <FundingSheetHeader
                onBack={() => setStep("choose")}
                title={`Add ${amountDisplay}`}
                subtitle="Review your payment details"
              />
              <div className="px-6 pb-6 pt-3 space-y-4">
                <ReviewPayWithCard
                  icon={selectedMethod.icon}
                  title={selectedMethod.title}
                  tags={
                    method === "balance"
                      ? [{ label: "In your account" }]
                      : [
                            { label: "Lowest fees" },
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
                  receiveLabel="You'll add"
                  receiveValue={amountDisplay}
                  footnote={
                    consumerCopy
                      ? "This will be added to your SimplFi balance"
                      : "This will be added to your Base wallet"
                  }
                />
                <TrustValueList />
                <TermsNote />
                {!address ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    Waiting for your account…
                  </p>
                ) : null}
                <FundingPrimaryButton
                  disabled={!canContinue}
                  onClick={() => void handleDeposit()}
                >
                  {method === "coinbase" ? (
                    <span className="inline-flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-white" />
                      {payCta}
                    </span>
                  ) : (
                    payCta
                  )}
                </FundingPrimaryButton>
                <SecuredByPrivy />
              </div>
            </>
          ) : (
            <>
              <FundingSheetHeader
                title={consumerCopy ? "Add money" : "Deposit"}
                subtitle="Transfer from your bank with Coinbase."
              />
              <div className="px-6 pb-6 pt-3 space-y-5">
                <div>
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Amount (USD)
                  </p>
                  <AmountPresets
                    amounts={PRESET_AMOUNTS}
                    value={amount}
                    onChange={(next) => {
                      setAmount(next);
                      setEditingAmount(false);
                    }}
                  />
                  <div className="mt-3">
                    <AmountHero
                      id="deposit-custom-amount"
                      amount={amount}
                      onChange={setAmount}
                      editing={editingAmount}
                      onEditingChange={setEditingAmount}
                      display={amountDisplay}
                    />
                  </div>
                  <div className="mt-2.5">
                    <TrustInline>
                      Your money is secure and always under your control.
                    </TrustInline>
                  </div>
                </div>

                <PayMethodList
                  label="Choose how to add money"
                  options={payMethods}
                  value={method}
                  onChange={selectMethod}
                />

                <PrivySecureNote />

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                {!address ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Waiting for your account…
                  </p>
                ) : null}

                <ChooseSummary
                  addLabel={`You'll add ${amountDisplay}`}
                  feeLabel="Fee shown at checkout"
                  receiveLabel={
                    consumerCopy
                      ? "Added to your SimplFi balance"
                      : "Added to your account"
                  }
                />

                <FundingPrimaryButton
                  disabled={!canContinue}
                  onClick={goReview}
                >
                  <ContinueLabel>Continue to payment</ContinueLabel>
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
