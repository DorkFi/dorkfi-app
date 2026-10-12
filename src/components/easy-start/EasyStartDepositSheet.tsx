import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
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
import { deriveAlgorandAddressFromSolana } from "@/lib/easyStart/algorandFromSolana";
import {
  fetchAlgorandAlgoTotal,
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
  CoinbaseGlyph,
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
type DepositPayMethod =
  | "coinbase"
  | "coinbase-send"
  | "external"
  | "balance";

const ACCOUNT_OPEN_MICRO = 100_000n;

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
  const [openingCrypto, setOpeningCrypto] = useState<"send" | "wallet" | null>(
    null
  );
  const [copiedAlgo, setCopiedAlgo] = useState(false);
  const [algoWaiting, setAlgoWaiting] = useState(false);
  const [algoBaseline, setAlgoBaseline] = useState<bigint | null>(null);
  const [fundedWithAlgo, setFundedWithAlgo] = useState(false);
  const { data: walletAccounts = [] } = useGetWalletAccounts();

  const address = evmAddress as Address | null;
  const solanaAddress =
    walletAccounts.find((account) => account.chain === "SOL")?.address ?? null;
  const algorandAddress = useMemo(() => {
    if (!solanaAddress) return null;
    try {
      return deriveAlgorandAddressFromSolana(solanaAddress);
    } catch {
      return null;
    }
  }, [solanaAddress]);
  const cryptoMethod = method === "coinbase-send" || method === "external";
  const skipFiat = method === "balance";
  const usdcBeforeRef = useRef(resumeBankDeposit?.usdcBefore ?? 0);
  const resumeAt = resumeBankDeposit?.at ?? null;

  const algoBalanceQuery = useQuery({
    queryKey: ["easy-start-algo-total", algorandAddress],
    queryFn: () => fetchAlgorandAlgoTotal(algorandAddress!),
    enabled: Boolean(open && algorandAddress && cryptoMethod),
    refetchInterval: algoWaiting ? 4_000 : false,
  });

  useEffect(() => {
    if (!algoWaiting || algoBaseline == null) return;
    const total = algoBalanceQuery.data?.totalMicro;
    if (total == null || total < algoBaseline + ACCOUNT_OPEN_MICRO) return;
    setFundedWithAlgo(true);
    setPhase("success");
  }, [algoBalanceQuery.data?.totalMicro, algoBaseline, algoWaiting]);

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

  const ensureAlgorandWallet = async () => {
    if (algorandAddress && solanaAddress) {
      return { algorandAddress, solanaAddress };
    }
    const missing = getChainsMissingWaasWalletAccounts();
    if (!missing.includes("SOL")) {
      throw new Error(
        "Solana embedded wallets are not enabled in this Dynamic environment."
      );
    }
    setOpeningCrypto("wallet");
    await createWaasWalletAccounts({ chains: ["SOL"] });
    return null;
  };

  const openCoinbaseTransfer = async () => {
    if (!getAccessToken) return;
    setError(null);
    try {
      const wallet = await ensureAlgorandWallet();
      if (!wallet) {
        setError("Algorand wallet created. Tap Transfer from Coinbase again.");
        return;
      }
      setOpeningCrypto("send");
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sign in to open Coinbase.");
      setAlgoBaseline(algoBalanceQuery.data?.totalMicro ?? 0n);
      setAlgoWaiting(true);
      const session = await createCoinbaseSession({
        address: wallet.algorandAddress,
        solanaAddress: wallet.solanaAddress,
        accessToken,
        destination: "algorand",
      });
      if (!session.sendUrl) {
        throw new Error("Coinbase transfer URL missing. Restart the dev server.");
      }
      const popup = window.open(session.sendUrl, "_blank", "noopener,noreferrer");
      setPopupBlocked(!popup);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningCrypto(null);
    }
  };

  const copyAlgorandAddress = async () => {
    setError(null);
    try {
      const wallet = await ensureAlgorandWallet();
      if (!wallet) {
        setError("Algorand wallet created. Tap Copy address again.");
        return;
      }
      await navigator.clipboard.writeText(wallet.algorandAddress);
      setCopiedAlgo(true);
      setAlgoBaseline(algoBalanceQuery.data?.totalMicro ?? 0n);
      setAlgoWaiting(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t copy the address. Select it and copy it manually."
      );
    } finally {
      setOpeningCrypto(null);
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
        id: "coinbase",
        title: "Bank Deposits",
        description: "Transfer from your bank account",
        icon: <Landmark className="h-5 w-5" />,
        badge: "Lowest Fees",
      },
      {
        id: "coinbase-send",
        title: "Coinbase balance",
        description: "Transfer ALGO you already hold",
        icon: <CoinbaseGlyph />,
      },
      {
        id: "external",
        title: "Another wallet",
        description: "Send ALGO on Algorand",
        icon: <Wallet className="h-5 w-5" />,
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
      : method === "coinbase-send"
        ? "Transfer from Coinbase"
        : method === "external"
          ? copiedAlgo
            ? "Address copied"
            : "Copy Algorand address"
          : `Continue with ${amountDisplay}`;

  const busy = phase === "funding" || openingCrypto != null;
  const canContinue = cryptoMethod
    ? !busy
    : Boolean(address) && amountValid && !busy;

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
                  fundedWithAlgo
                    ? "ALGO is in your Algorand account."
                    : consumerCopy
                      ? "Your funds are in your account."
                      : "USDC is in your Base wallet."
                }
              />
              <div className="px-6 pb-6 pt-2 space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-ocean-teal" />
                <p className="text-sm text-muted-foreground">
                  {fundedWithAlgo
                    ? "0.1 ALGO stays in the account so it can remain open."
                    : consumerCopy
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
                subtitle={
                  cryptoMethod
                    ? "Send ALGO to your Algorand account."
                    : "Transfer from your bank with Coinbase."
                }
              />
              <div className="px-6 pb-6 pt-3 space-y-5">
                {cryptoMethod ? null : (
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
                )}

                <PayMethodList
                  label="Choose how to add money"
                  options={payMethods}
                  value={method}
                  onChange={selectMethod}
                />

                <PrivySecureNote />

                {cryptoMethod && algorandAddress ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {method === "coinbase-send"
                        ? "Coinbase will send ALGO you already hold to this Algorand address."
                        : "Send ALGO on Algorand mainnet. At least 0.1 ALGO opens the account."}
                    </p>
                    <input
                      readOnly
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                      value={algorandAddress}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>
                ) : null}

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                {!cryptoMethod && !address ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Waiting for your account…
                  </p>
                ) : null}

                <ChooseSummary
                  addLabel={
                    method === "coinbase-send"
                      ? "You'll transfer ALGO from Coinbase"
                      : method === "external"
                        ? "You'll send ALGO from another wallet"
                        : `You'll add ${amountDisplay}`
                  }
                  feeLabel={
                    cryptoMethod
                      ? "0.1 ALGO stays locked to open the account"
                      : "Fee shown at checkout"
                  }
                  receiveLabel={
                    cryptoMethod
                      ? "Added to your Algorand account"
                      : consumerCopy
                        ? "Added to your SimplFi balance"
                        : "Added to your account"
                  }
                />

                {algoWaiting && !fundedWithAlgo ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Watching for ALGO. Send at least 0.1 ALGO on Algorand
                    mainnet.
                    {popupBlocked
                      ? " If Coinbase didn’t open, tap Transfer from Coinbase again."
                      : ""}
                  </p>
                ) : null}

                <FundingPrimaryButton
                  disabled={!canContinue}
                  onClick={() => {
                    if (method === "coinbase-send") {
                      void openCoinbaseTransfer();
                      return;
                    }
                    if (method === "external") {
                      void copyAlgorandAddress();
                      return;
                    }
                    goReview();
                  }}
                >
                  {cryptoMethod ? (
                    payCta
                  ) : (
                    <ContinueLabel>Continue to payment</ContinueLabel>
                  )}
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
