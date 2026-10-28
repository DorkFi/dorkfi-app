import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Landmark, Loader2, Send, Wallet } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { fetchAlgorandAlgoBalance, fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import { isAlgorandAddress, sendAlgorandAlgo } from "@/lib/easyStart/sendAlgorandAlgo";
import type { CoinbaseOfframpPending } from "@/lib/easyStart/coinbaseOfframpResume";
import type { Address } from "viem";
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
import { EasyStartOfframpCashOutSlot } from "@/components/easy-start/EasyStartOfframpCashOutSlot";

const ALGO_PRESETS = ["5", "10", "25", "50"] as const;
const USD_PRESETS = ["25", "50", "100", "250"] as const;
/** Leave the flat Algorand fee behind when choosing Max. */
const FEE_RESERVE_ALGO = 0.001;

type WithdrawPhase = "idle" | "sending" | "done" | "error";
type WithdrawStep = "choose" | "review";
type WithdrawDestination = "bank" | "coinbase" | "algorand_wallet";
type LegacyPayMethod = "debit_card" | "bank";

interface EasyStartWithdrawSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAdvancedBridge?: () => void;
  /** Resume Coinbase cash-out after same-tab return to /portfolio. */
  resumeOfframp?: CoinbaseOfframpPending | null;
  onResumeConsumed?: () => void;
}

function formatAlgoAmount(
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  value: number
): string {
  return `${formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ALGO`;
}

function initialDestination(
  resume: CoinbaseOfframpPending | null
): WithdrawDestination {
  if (resume?.cashoutMethod === "CRYPTO_ACCOUNT") return "coinbase";
  return "bank";
}

/**
 * Cash out spendable Algorand ALGO to a bank, a Coinbase account, or another
 * Algorand address. An in-flight Base USDC cash-out still resumes on USDC.
 */
export function EasyStartWithdrawSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
  resumeOfframp = null,
  onResumeConsumed,
}: EasyStartWithdrawSheetProps) {
  const privy = usePrivyEasyStart();
  const { evmAddress, algorandAddress, signTransactions } = privy;
  const consumerCopy = useConsumerCopy();
  const { formatCurrency, formatNumber } = useNumberI18n();
  const { price: algoUsd } = useTokenPrice("ALGO", "algorand-mainnet");
  const queryClient = useQueryClient();
  const legacyUsdc = Boolean(resumeOfframp) && resumeOfframp?.asset !== "ALGO";

  const [amount, setAmount] = useState(resumeOfframp?.amount ?? "");
  const [destination, setDestination] = useState<WithdrawDestination>(
    initialDestination(resumeOfframp)
  );
  const [legacyMethod, setLegacyMethod] = useState<LegacyPayMethod>(
    resumeOfframp ? "bank" : "debit_card"
  );
  const [recipient, setRecipient] = useState("");
  const [step, setStep] = useState<WithdrawStep>(
    resumeOfframp ? "review" : "choose"
  );
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const address = evmAddress as Address | null;

  const { data: baseUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && legacyUsdc && address),
    refetchInterval: open && legacyUsdc ? 10_000 : false,
  });

  const { data: algoSpendable, isLoading: algoLoading } = useQuery({
    queryKey: ["easy-start-algo-spendable", algorandAddress],
    queryFn: () => fetchAlgorandAlgoBalance(algorandAddress!),
    enabled: Boolean(open && !legacyUsdc && algorandAddress),
    refetchInterval: open && !legacyUsdc ? 10_000 : false,
  });

  const legacyAvailable = baseUsdc ? Number.parseFloat(baseUsdc.formatted) : 0;
  const algoAvailable = algoSpendable
    ? Number.parseFloat(algoSpendable.formatted)
    : 0;
  const availableNum = legacyUsdc ? legacyAvailable : algoAvailable;
  const maxNum = legacyUsdc
    ? availableNum
    : Math.max(0, availableNum - FEE_RESERVE_ALGO);
  const hasAvailable = Number.isFinite(maxNum) && maxNum > 0;
  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const usdEstimate =
    !legacyUsdc && algoUsd > 0 && amountValid ? amountNum * algoUsd : null;
  const amountDisplay = legacyUsdc
    ? formatCurrency(amountValid ? amountNum : 0, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : formatAlgoAmount(formatNumber, amountValid ? amountNum : 0);
  const availableDisplay = legacyUsdc
    ? formatCurrency(Number.isFinite(availableNum) ? availableNum : 0, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : formatAlgoAmount(formatNumber, Number.isFinite(maxNum) ? maxNum : 0);
  const availableUsd =
    !legacyUsdc && algoUsd > 0 && hasAvailable ? maxNum * algoUsd : null;

  const applyResume = useCallback(() => {
    if (!resumeOfframp) return;
    setDestination(initialDestination(resumeOfframp));
    setLegacyMethod("bank");
    if (resumeOfframp.amount) setAmount(resumeOfframp.amount);
    setStep("review");
    setEditingAmount(false);
    setPhase("idle");
    setError(null);
  }, [resumeOfframp]);

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setTxId(null);
    setError(null);
    setStep("choose");
    setEditingAmount(false);
    setDestination("bank");
    setLegacyMethod("debit_card");
    setRecipient("");
    setAmount("");
  }, []);

  const handleClose = (next: boolean) => {
    if (!next && phase === "sending") return;
    if (!next) resetLocal();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open || !resumeOfframp) return;
    applyResume();
  }, [applyResume, open, resumeOfframp]);

  const setMax = () => {
    if (!hasAvailable) return;
    const max = legacyUsdc
      ? Math.max(0, Math.floor(maxNum * 100) / 100)
      : maxNum;
    const text = legacyUsdc
      ? String(max)
      : max.toFixed(6).replace(/\.?0+$/, "");
    setAmount(text);
    setEditingAmount(false);
  };

  const trimmedRecipient = recipient.trim();
  const recipientValid = isAlgorandAddress(trimmedRecipient);
  const recipientIsSelf =
    Boolean(algorandAddress) && trimmedRecipient === algorandAddress;

  const goReview = () => {
    setError(null);
    if (!amountValid) {
      setError(legacyUsdc ? "Enter an amount to cash out." : "Enter an ALGO amount.");
      return;
    }
    if (amountNum > maxNum + 1e-9) {
      setError(`You can send up to ${availableDisplay}.`);
      return;
    }
    if (!legacyUsdc && destination === "algorand_wallet") {
      if (!recipientValid) {
        setError("Enter a valid Algorand address.");
        return;
      }
      if (recipientIsSelf) {
        setError("Choose a different Algorand address.");
        return;
      }
    }
    setStep("review");
  };

  const sendToWallet = async () => {
    if (!algorandAddress || !signTransactions || !recipientValid) return;
    setError(null);
    setPhase("sending");
    try {
      const id = await sendAlgorandAlgo({
        from: algorandAddress,
        to: trimmedRecipient,
        amount: amount.trim(),
        signTransactions,
      });
      setTxId(id);
      setPhase("done");
      await queryClient.invalidateQueries({
        queryKey: ["easy-start-algo-spendable", algorandAddress],
      });
      await queryClient.invalidateQueries({
        queryKey: ["easy-start-algo-total", algorandAddress],
      });
    } catch (e: unknown) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Couldn’t send ALGO.");
    }
  };

  const payMethods: PayMethodOption[] = useMemo(
    () =>
      legacyUsdc
        ? [
            {
              id: "debit_card",
              title: "Debit card",
              description: "Fee shown at checkout",
              icon: <CreditCard className="h-5 w-5" />,
              badge: "Recommended",
            },
            {
              id: "bank",
              title: "Bank account",
              description: "Usually 1–3 business days · Fee shown at checkout",
              icon: <Building2 className="h-5 w-5" />,
              tag: { label: "Bank", tone: "muted" },
            },
          ]
        : [
            {
              id: "bank",
              title: "Bank account",
              description:
                "Dollars by ACH · usually 1–3 business days · fee shown at checkout",
              icon: <Landmark className="h-5 w-5" />,
              badge: "Recommended",
            },
            {
              id: "coinbase",
              title: "Coinbase account",
              description:
                "ALGO or dollars in your Coinbase account · fee shown at checkout",
              icon: <Wallet className="h-5 w-5" />,
            },
            {
              id: "algorand_wallet",
              title: "Algorand wallet",
              description: "ALGO sent to an address you enter · network fee only",
              icon: <Send className="h-5 w-5" />,
            },
          ],
    [legacyUsdc]
  );

  const selectedId = legacyUsdc ? legacyMethod : destination;
  const selectedMethod =
    payMethods.find((m) => m.id === selectedId) ?? payMethods[0];
  const cashoutMethod =
    destination === "coinbase" ? "CRYPTO_ACCOUNT" : "ACH_BANK_ACCOUNT";
  const methodTitle =
    destination === "coinbase"
      ? "Coinbase"
      : destination === "algorand_wallet"
        ? "Algorand wallet"
        : legacyUsdc && legacyMethod === "debit_card"
          ? "debit card"
          : "bank";
  const receiveLabel = legacyUsdc
    ? legacyMethod === "bank"
      ? "Sent to your bank"
      : "Sent to your debit card"
    : destination === "bank"
      ? "Dollars to your bank"
      : destination === "coinbase"
        ? "To your Coinbase account"
        : trimmedRecipient
          ? `To ${trimmedRecipient.slice(0, 6)}…${trimmedRecipient.slice(-4)}`
          : "To an Algorand address";
  const reviewFootnote = legacyUsdc
    ? legacyMethod === "bank"
      ? "Sent to your bank. Timing depends on the payout."
      : "Sent to your debit card. Timing depends on the payout."
    : destination === "bank"
      ? "Coinbase sells the ALGO and sends dollars to your bank."
      : destination === "coinbase"
        ? "Coinbase receives the ALGO. Confirm whether it stays as ALGO or becomes dollars before you finish."
        : "Sent from your Algorand account. About 0.001 ALGO covers the network fee.";

  const cashOutAmount =
    amount.trim() ||
    (hasAvailable ? maxNum.toFixed(6).replace(/\.?0+$/, "") : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="flex flex-col min-h-0">
          {phase === "error" && destination === "algorand_wallet" && !legacyUsdc ? (
            <>
              <FundingSheetHeader
                title="Couldn’t send ALGO"
                subtitle="The ALGO is still in your Algorand account."
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {error ?? "Transfer failed"}
                </p>
                <FundingPrimaryButton
                  onClick={() => {
                    setPhase("idle");
                    setError(null);
                  }}
                >
                  Try again
                </FundingPrimaryButton>
              </div>
            </>
          ) : phase === "done" && destination === "algorand_wallet" ? (
            <>
              <FundingSheetHeader
                title="ALGO sent"
                subtitle="The transfer is on Algorand."
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {amountDisplay} is on its way to{" "}
                  {trimmedRecipient.slice(0, 6)}…{trimmedRecipient.slice(-4)}.
                  {txId ? ` Transaction ${txId.slice(0, 8)}…` : ""}
                </p>
                <FundingPrimaryButton onClick={() => handleClose(false)}>
                  Done
                </FundingPrimaryButton>
              </div>
            </>
          ) : step === "review" ? (
            <>
              <FundingSheetHeader
                onBack={() => setStep("choose")}
                title={
                  legacyUsdc
                    ? `Cash out ${amountDisplay}`
                    : destination === "algorand_wallet"
                      ? `Send ${amountDisplay}`
                      : `Cash out ${amountDisplay}`
                }
                subtitle={
                  destination === "algorand_wallet" && !legacyUsdc
                    ? "Review the Algorand transfer"
                    : "Review your cash-out details"
                }
              />
              <div className="px-6 pb-6 pt-3 space-y-4">
                <ReviewPayWithCard
                  icon={selectedMethod.icon}
                  title={selectedMethod.title}
                  tags={
                    !legacyUsdc && destination === "algorand_wallet"
                      ? [{ label: "Network fee only" }]
                      : destination === "bank" || legacyMethod === "bank"
                        ? [
                            { label: "1–3 business days" },
                            { label: "Fee shown at checkout" },
                          ]
                        : [{ label: "Fee shown at checkout" }]
                  }
                  onChange={() => setStep("choose")}
                />
                <ReviewBreakdown
                  amountLabel="Amount"
                  amountValue={amountDisplay}
                  feeLabel={
                    !legacyUsdc && destination === "algorand_wallet"
                      ? "Network fee"
                      : "Processing fee"
                  }
                  feeValue={
                    !legacyUsdc && destination === "algorand_wallet"
                      ? "About 0.001 ALGO"
                      : "Shown at checkout"
                  }
                  receiveLabel={
                    !legacyUsdc && destination === "algorand_wallet"
                      ? "You'll send"
                      : "You'll cash out"
                  }
                  receiveValue={amountDisplay}
                  footnote={reviewFootnote}
                />
                {usdEstimate != null ? (
                  <p className="text-center text-xs text-muted-foreground">
                    About{" "}
                    {formatCurrency(usdEstimate, "USD", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                ) : null}
                <TrustValueList />
                <TermsNote />
                {!legacyUsdc && destination === "algorand_wallet" ? (
                  <FundingPrimaryButton
                    disabled={!signTransactions || phase === "sending"}
                    onClick={() => void sendToWallet()}
                  >
                    {phase === "sending" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      `Send ${amountDisplay}`
                    )}
                  </FundingPrimaryButton>
                ) : (
                  <EasyStartOfframpCashOutSlot
                    evmAddress={evmAddress}
                    algorandAddress={algorandAddress}
                    amount={cashOutAmount}
                    provider="coinbase"
                    onProviderChange={() => {}}
                    hideProviderPicker
                    ctaLabel={
                      legacyUsdc
                        ? `Cash out ${amountDisplay} to ${methodTitle}`
                        : `Cash out ${amountDisplay} to ${methodTitle}`
                    }
                    asset={legacyUsdc ? "USDC" : "ALGO"}
                    cashoutMethod={legacyUsdc ? undefined : cashoutMethod}
                    resumePartnerUserRef={resumeOfframp?.partnerUserRef ?? null}
                    resumeSendTxHash={resumeOfframp?.sendTxHash ?? null}
                    onResumeConsumed={onResumeConsumed}
                    onDone={() => handleClose(false)}
                  />
                )}
                {error && destination === "algorand_wallet" ? (
                  <p className="text-sm text-destructive text-center" role="alert">
                    {error}
                  </p>
                ) : null}
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
                  legacyUsdc
                    ? consumerCopy
                      ? "Send money from your SimplFi balance."
                      : "Send money from your account."
                    : "Send ALGO from your Algorand account."
                }
              />
              <div className="px-6 pb-6 pt-3 space-y-5">
                <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Available
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {algoLoading && !legacyUsdc ? "Loading…" : availableDisplay}
                  </p>
                  {availableUsd != null ? (
                    <p className="text-xs text-muted-foreground">
                      about{" "}
                      {formatCurrency(availableUsd, "USD", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  ) : null}
                </div>

                {!hasAvailable && !algoLoading ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    {legacyUsdc
                      ? "Nothing available to cash out yet. Withdraw from savings first, then cash out here."
                      : "No spendable ALGO yet. A bank deposit buys ALGO into this account."}
                  </p>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {legacyUsdc ? "Amount (USD)" : "Amount (ALGO)"}
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
                      amounts={legacyUsdc ? USD_PRESETS : ALGO_PRESETS}
                      prefix={legacyUsdc ? "$" : ""}
                      value={amount}
                      onChange={(next) => {
                        setAmount(next);
                        setEditingAmount(false);
                      }}
                      disabledAmount={(preset) => Number(preset) > maxNum}
                    />
                    <div className="mt-3">
                      <AmountHero
                        id="withdraw-custom-amount"
                        amount={amount}
                        onChange={setAmount}
                        editing={editingAmount}
                        onEditingChange={setEditingAmount}
                        display={amountDisplay}
                        prefix={legacyUsdc ? "$" : ""}
                        suffix={legacyUsdc ? undefined : "ALGO"}
                        min={0}
                        step={legacyUsdc ? 0.01 : 0.000001}
                      />
                    </div>
                    {usdEstimate != null ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        about{" "}
                        {formatCurrency(usdEstimate, "USD", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    ) : null}
                    <div className="mt-2.5">
                      <TrustInline>
                        {legacyUsdc
                          ? "Your money is secure and always under your control."
                          : "Max leaves the account minimum and the network fee in this wallet."}
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
                  label={legacyUsdc ? "Choose how to cash out" : "Choose where it goes"}
                  options={payMethods}
                  value={selectedId}
                  onChange={(id) => {
                    if (legacyUsdc) setLegacyMethod(id as LegacyPayMethod);
                    else setDestination(id as WithdrawDestination);
                  }}
                />

                {!legacyUsdc && destination === "algorand_wallet" ? (
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Recipient Algorand address
                    </span>
                    <input
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="Algorand address"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="w-full rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-ocean-teal"
                    />
                  </label>
                ) : null}

                <PrivySecureNote />

                <ChooseSummary
                  addLabel={
                    legacyUsdc
                      ? `You'll cash out ${amountValid ? amountDisplay : availableDisplay}`
                      : `You'll send ${amountValid ? amountDisplay : availableDisplay}`
                  }
                  feeLabel={
                    !legacyUsdc && destination === "algorand_wallet"
                      ? "Network fee only"
                      : "Fee shown at checkout"
                  }
                  receiveLabel={receiveLabel}
                />

                <FundingPrimaryButton
                  disabled={
                    (legacyUsdc ? !address : !algorandAddress) ||
                    !hasAvailable ||
                    !amountValid
                  }
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
