import { useCallback, useEffect, useMemo, useState } from "react";
import { useFiatOnramp, useFundWallet } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { base } from "viem/chains";
import type { Address } from "viem";
import {
  CheckCircle2,
  CreditCard,
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
  BASE_MAINNET_USDC,
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import { isXoGeoRestricted } from "@/lib/easyStart/xoSwap/errors";
import type { DepositCardProvider } from "@/components/easy-start/EasyStartCardProviderPicker";
import {
  AmountHero,
  AmountPresets,
  ApplePayGlyph,
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

const PRESET_AMOUNTS = ["50", "100", "250", "500"] as const;
const PRIVY_MODAL_HANDOFF_MS = 200;
/** Small USD native top-up so Base can pay gas when the user later Deposits to Earn. */
const GAS_TOPUP_USD = "3";

type DepositPhase = "idle" | "funding" | "gas" | "success" | "error";
type DepositStep = "choose" | "review";
type DepositPayMethod = "apple_pay" | "card" | "balance";

interface EasyStartDepositSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional escape hatch to the advanced XO Swap UI. */
  onOpenAdvancedBridge?: () => void;
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

function methodToProvider(method: DepositPayMethod): DepositCardProvider {
  return method === "apple_pay" ? "stripe" : "moonpay";
}

/**
 * Fiat on-ramp to Base USDC. Funds stay in the Easy Start Base wallet until
 * the user Deposit to Earn (XO Swap + supply).
 * Must render under PrivyProvider.
 */
export function EasyStartDepositSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
}: EasyStartDepositSheetProps) {
  const { fundWallet } = useFundWallet();
  const { fund: fundFiatOnramp } = useFiatOnramp();
  const { evmAddress } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { formatCurrency } = useNumberI18n();
  const { toast } = useToast();

  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<DepositPayMethod>("apple_pay");
  const [step, setStep] = useState<DepositStep>("choose");
  const [editingAmount, setEditingAmount] = useState(false);
  const [phase, setPhase] = useState<DepositPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const address = evmAddress as Address | null;
  const cardProvider = methodToProvider(method);
  const skipFiat = method === "balance";

  const { data: baseUsdc, refetch: refetchUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && address),
    refetchInterval: open ? 10_000 : false,
  });

  const baseUsdcNum = baseUsdc ? Number.parseFloat(baseUsdc.formatted) : 0;
  const hasUsdcOnBase = Number.isFinite(baseUsdcNum) && baseUsdcNum > 0.01;

  useEffect(() => {
    if (method === "balance" && !hasUsdcOnBase) {
      setMethod("apple_pay");
      setAmount("100");
    }
  }, [hasUsdcOnBase, method]);

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
    setStep("choose");
    setEditingAmount(false);
    setMethod("apple_pay");
    setAmount("100");
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      if (
        phase === "idle" ||
        phase === "success" ||
        phase === "error" ||
        phase === "gas"
      ) {
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

  const ensureGasThenFinish = async () => {
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
  };

  const fundWithCardProvider = async (options: {
    asset: "USDC" | "native-currency";
    amount: string;
    preferredProvider?: "moonpay" | "coinbase";
  }) => {
    if (!address) return;
    await fundWallet({
      address,
      options: {
        chain: base,
        asset: options.asset,
        amount: options.amount,
        defaultFundingMethod: "card",
        ...(options.preferredProvider
          ? { card: { preferredProvider: options.preferredProvider } }
          : {}),
      },
    });
  };

  const fundWithStripeOnramp = async (usdAmount: string) => {
    if (!address) return;
    await fundFiatOnramp({
      source: {
        assets: ["usd"],
        defaultAsset: "usd",
      },
      destination: {
        asset: BASE_MAINNET_USDC,
        chain: "eip155:8453",
        address,
      },
      environment: import.meta.env.DEV ? "sandbox" : "production",
      defaultAmount: usdAmount,
    });
  };

  const handleFundGas = async () => {
    if (!address) return;
    setError(null);
    onOpenChange(false);
    await new Promise((r) => setTimeout(r, PRIVY_MODAL_HANDOFF_MS));
    try {
      await fundWithCardProvider({
        asset: "native-currency",
        amount: GAS_TOPUP_USD,
        preferredProvider: "moonpay",
      });
      await ensureGasThenFinish();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        setPhase("gas");
        onOpenChange(true);
        return;
      }
      setError(message || "Couldn’t add processing fee");
      setPhase("error");
      onOpenChange(true);
    }
  };

  const handleDeposit = async () => {
    if (!address) return;
    setError(null);

    if (skipFiat) {
      if (!hasUsdcOnBase) {
        setError(
          consumerCopy
            ? "No funds in your account yet. Add money with a card first."
            : "No USDC on Base yet. Deposit with a card first."
        );
        setPhase("error");
        return;
      }
      setPhase("funding");
      await ensureGasThenFinish();
      return;
    }

    setPhase("funding");
    onOpenChange(false);
    await new Promise((r) => setTimeout(r, PRIVY_MODAL_HANDOFF_MS));

    try {
      if (cardProvider === "stripe") {
        await fundWithStripeOnramp(amount);
      } else {
        await fundWithCardProvider({
          asset: "USDC",
          amount,
          preferredProvider: "moonpay",
        });
      }
      await new Promise((r) => setTimeout(r, 1500));
      await refetchUsdc();
      await ensureGasThenFinish();
      toast({
        title: "Payment received",
        description: consumerCopy
          ? "Funds are in your account."
          : "USDC is in your Base wallet.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        resetLocal();
        return;
      }
      setError(message || "Something went wrong opening payment");
      setPhase("error");
      onOpenChange(true);
      toast({
        title: "Payment couldn’t start",
        description: message,
        variant: "destructive",
      });
    }
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
        id: "apple_pay",
        title: "Apple Pay",
        description: "Instant · Fee shown at checkout",
        icon: <ApplePayGlyph />,
        badge: "Recommended",
        tag: { label: "Fastest", tone: "fast" },
      },
      {
        id: "card",
        title: "Debit or credit card",
        description: "Instant · Fee shown at checkout",
        icon: <CreditCard className="h-5 w-5" />,
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
    method === "apple_pay"
      ? `Pay ${amountDisplay} with Apple Pay`
      : method === "card"
        ? `Pay ${amountDisplay} with card`
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
                subtitle="Opening payment…"
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
                  {method === "apple_pay" ? (
                    <span className="inline-flex items-center gap-2">
                      <ApplePayGlyph className="h-4 w-4 text-white" />
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
                subtitle={
                  consumerCopy
                    ? "Add cash to your SimplFi balance and start earning."
                    : "Add cash to your account, then Deposit to Earn."
                }
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
