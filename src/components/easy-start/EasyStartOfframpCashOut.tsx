import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  useFundWallet,
  usePrivy,
  useSendTransaction,
} from "@privy-io/react-auth";
import { base } from "viem/chains";
import type { Address } from "viem";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IsolateErrorBoundary } from "@/components/IsolateErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import {
  EasyStartCardProviderPicker,
  type CardProvider,
} from "@/components/easy-start/EasyStartCardProviderPicker";
import {
  createCoinbaseOfframpSession,
  selectCoinbaseCashOutSale,
  fetchCoinbaseOfframpStatus,
  fetchOfframpHealth,
  moonpayPublishableKey,
  OfframpStatusForbiddenError,
  signMoonpayWidgetUrl,
  type OfframpHealth,
} from "@/lib/easyStart/offrampApi";
import { sendBaseUsdc } from "@/lib/easyStart/sendBaseUsdc";
import { sendAlgorandAlgo } from "@/lib/easyStart/sendAlgorandAlgo";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import {
  fetchBaseEthBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import {
  clearCoinbaseOfframpPending,
  patchCoinbaseOfframpPending,
  readCoinbaseOfframpPending,
  saveCoinbaseOfframpPending,
} from "@/lib/easyStart/coinbaseOfframpResume";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";

const EasyStartMoonPaySellHost = lazy(() =>
  import("@/components/easy-start/EasyStartMoonPaySellHost").then((m) => ({
    default: m.EasyStartMoonPaySellHost,
  }))
);

const GAS_TOPUP_USD = "3";

type CashOutPhase =
  | "idle"
  | "opening"
  | "gas"
  | "awaiting_provider"
  | "confirm"
  | "sending"
  | "done"
  | "error";

type ReadyCoinbaseSale = {
  to: string;
  amount: string;
};

interface EasyStartOfframpCashOutProps {
  evmAddress: string | null;
  /** USDC amount just bridged to Base (human units). */
  amount: string | null;
  provider: CardProvider;
  onProviderChange: (provider: CardProvider) => void;
  onDone?: () => void;
  hideProviderPicker?: boolean;
  ctaLabel?: string;
  /** Skip reopening Coinbase; poll and send on this tab after return. */
  resumePartnerUserRef?: string | null;
  resumeSendTxHash?: string | null;
  onResumeConsumed?: () => void;
  /** ALGO sells from the xChain account. Omitted keeps the Base USDC send. */
  asset?: "USDC" | "ALGO";
  algorandAddress?: string | null;
  cashoutMethod?: "ACH_BANK_ACCOUNT" | "CRYPTO_ACCOUNT";
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

/**
 * In-app cash-out after Base USDC arrives:
 * - Coinbase: CDP session → same-tab sell widget → return to /portfolio →
 *   poll this user's sale → confirm amount and destination → Privy transfer
 * - MoonPay: sell widget + signed URL → onInitiateDeposit → Privy USDC transfer
 *
 * MoonPay’s React SDK is lazy-mounted only while the sell overlay is open so it
 * cannot crash Privy during review, Coinbase cash-out, or gas top-up.
 */
export function EasyStartOfframpCashOut({
  evmAddress,
  amount,
  provider,
  onProviderChange,
  onDone,
  hideProviderPicker = false,
  ctaLabel,
  resumePartnerUserRef = null,
  resumeSendTxHash = null,
  onResumeConsumed,
  asset = "USDC",
  algorandAddress = null,
  cashoutMethod,
}: EasyStartOfframpCashOutProps) {
  const { sendTransaction } = useSendTransaction();
  const { fundWallet } = useFundWallet();
  const { getAccessToken } = usePrivy();
  const { signTransactions } = usePrivyEasyStart();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();

  const requireAccessToken = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error(
        consumerCopy
          ? "Sign in to cash out."
          : "Sign in to create a Coinbase session."
      );
    }
    return token;
  }, [consumerCopy, getAccessToken]);

  const [health, setHealth] = useState<OfframpHealth | null>(null);
  const [phase, setPhase] = useState<CashOutPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partnerUserRef, setPartnerUserRef] = useState<string | null>(null);
  const [readySale, setReadySale] = useState<ReadyCoinbaseSale | null>(null);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const confirmLock = useRef(false);

  const moonpayKey = moonpayPublishableKey();
  const address = evmAddress as Address | null;
  const showMoonpay =
    moonpayVisible && provider === "moonpay" && Boolean(moonpayKey);

  useEffect(() => {
    void fetchOfframpHealth()
      .then(setHealth)
      .catch(() =>
        setHealth({ ok: false, coinbase: false, moonpay: false })
      );
  }, []);

  useEffect(() => {
    if (provider !== "moonpay" && moonpayVisible) {
      setMoonpayVisible(false);
    }
  }, [moonpayVisible, provider]);

  const providerReady =
    provider === "coinbase"
      ? Boolean(health?.coinbase)
      : Boolean(health?.moonpay && moonpayKey);

  const walletHasGas = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    const eth = await fetchBaseEthBalance(address);
    return hasEnoughBaseEth(eth.value);
  }, [address]);

  const sendUsdcTo = useCallback(
    async (to: string, cryptoAmount: string) => {
      setPhase("sending");
      const hash = await sendBaseUsdc({
        sendTransaction,
        to,
        amount: cryptoAmount,
        fromAddress: evmAddress ?? undefined,
      });
      setTxHash(hash);
      patchCoinbaseOfframpPending({ sendTxHash: hash });
      setPhase("done");
      toast({
        title: "Sent",
        description: "Your cash-out is processing with the provider.",
      });
      return hash;
    },
    [evmAddress, sendTransaction, toast]
  );

  const sendAlgoTo = useCallback(
    async (to: string, cryptoAmount: string) => {
      if (!signTransactions || !algorandAddress) {
        throw new Error("Algorand wallet isn’t ready to sign.");
      }
      setPhase("sending");
      const txId = await sendAlgorandAlgo({
        from: algorandAddress,
        to,
        amount: cryptoAmount,
        signTransactions,
      });
      setTxHash(txId);
      patchCoinbaseOfframpPending({ sendTxHash: txId });
      setPhase("done");
      toast({
        title: "Sent",
        description: "Your ALGO cash-out is processing with Coinbase.",
      });
      return txId;
    },
    [algorandAddress, signTransactions, toast]
  );

  useEffect(() => {
    if (provider !== "coinbase" || !resumePartnerUserRef) return;
    if (resumeSendTxHash) {
      setPartnerUserRef(resumePartnerUserRef);
      setTxHash(resumeSendTxHash);
      setPhase("done");
      return;
    }
    if (asset === "ALGO") {
      setPartnerUserRef(resumePartnerUserRef);
      setPhase("awaiting_provider");
      return;
    }
    let cancelled = false;
    setPartnerUserRef(resumePartnerUserRef);
    void (async () => {
      try {
        const hasGas = await walletHasGas();
        if (cancelled) return;
        setPhase(hasGas ? "awaiting_provider" : "gas");
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Couldn’t check processing fees");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, provider, resumePartnerUserRef, resumeSendTxHash, walletHasGas]);

  const finishCashOut = useCallback(() => {
    clearCoinbaseOfframpPending();
    onResumeConsumed?.();
    onDone?.();
  }, [onDone, onResumeConsumed]);

  const cancelCoinbaseWait = useCallback(() => {
    clearCoinbaseOfframpPending();
    onResumeConsumed?.();
    setPartnerUserRef(null);
    setReadySale(null);
    confirmLock.current = false;
    setPhase("idle");
  }, [onResumeConsumed]);

  const closeMoonpay = useCallback(() => {
    setMoonpayVisible(false);
    setPhase((current) =>
      current === "awaiting_provider" ? "idle" : current
    );
  }, []);

  const stopWithoutSending = useCallback(
    (message: string) => {
      clearCoinbaseOfframpPending();
      onResumeConsumed?.();
      setPartnerUserRef(null);
      setReadySale(null);
      confirmLock.current = false;
      setError(message);
      setPhase("error");
    },
    [onResumeConsumed]
  );

  const confirmCoinbaseSend = useCallback(async () => {
    if (!readySale || confirmLock.current) return;
    confirmLock.current = true;
    try {
      if (asset === "ALGO") await sendAlgoTo(readySale.to, readySale.amount);
      else await sendUsdcTo(readySale.to, readySale.amount);
    } catch (e: unknown) {
      confirmLock.current = false;
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase("error");
    }
  }, [asset, readySale, sendAlgoTo, sendUsdcTo]);

  // Poll Coinbase for this user's sale. Signing waits for an explicit confirm.
  useEffect(() => {
    if (provider !== "coinbase" || !partnerUserRef) return;
    if (phase !== "awaiting_provider") return;

    let cancelled = false;
    let timer: number | undefined;
    const started = Date.now();
    const kind = asset === "ALGO" ? "algorand" : "evm";
    const connectedAddress = asset === "ALGO" ? algorandAddress : evmAddress;

    const tick = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || cancelled) return;
        const { transactions, latest } = await fetchCoinbaseOfframpStatus(
          partnerUserRef,
          accessToken
        );
        if (cancelled) return;
        const decision = selectCoinbaseCashOutSale({
          transactions: transactions?.length ? transactions : latest ? [latest] : [],
          kind,
          connectedAddress,
          expectedAmount: readCoinbaseOfframpPending()?.amount ?? null,
        });
        if (decision.action === "confirm") {
          setReadySale({ to: decision.to, amount: decision.amount });
          setPhase("confirm");
          return;
        }
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof OfframpStatusForbiddenError) {
          stopWithoutSending(
            "This cash-out doesn’t belong to this account. Nothing was sent."
          );
          return;
        }
      }
      if (cancelled) return;
      if (Date.now() - started > 30 * 60 * 1000) {
        setError("Timed out waiting for Coinbase sell details. Try again.");
        setPhase("error");
        return;
      }
      timer = window.setTimeout(() => void tick(), 4000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [
    algorandAddress,
    asset,
    evmAddress,
    getAccessToken,
    partnerUserRef,
    phase,
    provider,
    stopWithoutSending,
  ]);

  const startCoinbase = async () => {
    if (asset === "ALGO" ? !algorandAddress : !evmAddress) return;
    if (resumePartnerUserRef && !resumeSendTxHash) {
      setPartnerUserRef(resumePartnerUserRef);
      setPhase("awaiting_provider");
      return;
    }
    setError(null);
    setPhase("opening");
    try {
      const accessToken = await requireAccessToken();
      const session = await createCoinbaseOfframpSession({
        address: asset === "ALGO" ? algorandAddress! : evmAddress,
        accessToken,
        amount: amount ?? undefined,
        destination: asset === "ALGO" ? "algorand" : undefined,
        cashoutMethod: asset === "ALGO" ? cashoutMethod : undefined,
      });
      if (!session.sellUrl) {
        throw new Error("Coinbase cash-out URL missing. Redeploy the API.");
      }
      saveCoinbaseOfframpPending({
        partnerUserRef: session.partnerUserRef,
        amount: amount ?? null,
        asset,
        cashoutMethod: asset === "ALGO" ? cashoutMethod : undefined,
      });
      window.location.assign(session.sellUrl);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase("error");
    }
  };

  const startMoonpay = () => {
    if (!moonpayKey) {
      setError("Set VITE_MOONPAY_API_KEY for MoonPay sell.");
      setPhase("error");
      return;
    }
    if (!health?.moonpay) {
      setError("MoonPay signing isn’t configured (MOONPAY_SECRET_KEY).");
      setPhase("error");
      return;
    }
    setError(null);
    setMoonpayVisible(true);
    setPhase("awaiting_provider");
  };

  const startProvider = () => {
    if (provider === "coinbase") void startCoinbase();
    else startMoonpay();
  };

  const handleCashOut = async () => {
    if (asset === "ALGO") {
      if (!algorandAddress) return;
      setError(null);
      void startCoinbase();
      return;
    }
    if (!address) return;
    setError(null);
    setPhase("opening");
    try {
      if (!(await walletHasGas())) {
        setPhase("gas");
        return;
      }
      startProvider();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check processing fees");
      setPhase("error");
    }
  };

  const handleFundGas = async () => {
    if (!address) return;
    setError(null);
    setPhase("opening");
    try {
      await fundWallet({
        address,
        options: {
          chain: base,
          asset: "native-currency",
          amount: GAS_TOPUP_USD,
          defaultFundingMethod: "card",
          card: { preferredProvider: "moonpay" },
        },
      });
      if (await walletHasGas()) {
        startProvider();
        return;
      }
      setPhase("gas");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        setPhase("gas");
        return;
      }
      setError(message || "Couldn’t add processing fee");
      setPhase("error");
    }
  };

  const retryGasCheck = async () => {
    setError(null);
    setPhase("opening");
    try {
      if (await walletHasGas()) {
        startProvider();
        return;
      }
      setPhase("gas");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check processing fees");
      setPhase("error");
    }
  };

  const moonpayAmount =
    amount && Number(amount) > 0
      ? Number(amount).toFixed(6).replace(/\.?0+$/, "")
      : undefined;

  const unavailableCopy = consumerCopy
    ? "Cash-out isn’t available right now. Try again later."
    : provider === "coinbase"
      ? "Coinbase off-ramp needs CDP_API_KEY_ID + CDP_API_KEY_SECRET on the offramp API."
      : "MoonPay off-ramp needs VITE_MOONPAY_API_KEY and MOONPAY_SECRET_KEY.";

  const payLabel =
    ctaLabel ??
    (consumerCopy
      ? `Cash out to ${provider === "coinbase" ? "bank" : "debit card"}`
      : `Cash out with ${provider === "coinbase" ? "Coinbase" : "MoonPay"}`);

  const busy =
    phase === "opening" || phase === "sending" || phase === "awaiting_provider";

  return (
    <>
      <div className="space-y-4 text-left">
        {hideProviderPicker ? null : (
          <EasyStartCardProviderPicker
            value={provider}
            onChange={onProviderChange}
            label="Cash out with"
          />
        )}

        {health && !providerReady ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {unavailableCopy}
          </p>
        ) : null}

        {phase === "gas" ? (
          <p className="text-sm text-muted-foreground text-center">
            {consumerCopy
              ? "A small network fee is needed on Base to send your cash-out."
              : "A small amount of ETH on Base is needed to pay the transfer fee."}
          </p>
        ) : null}

        {phase === "awaiting_provider" && provider === "coinbase" ? (
          <p className="text-sm text-muted-foreground text-center">
            {consumerCopy
              ? "Waiting for cash-out details. You’ll review the amount and destination before anything is sent."
              : asset === "ALGO"
                ? "Waiting for Coinbase sell details. You’ll review the ALGO amount and destination before anything is sent."
                : "Waiting for Coinbase sell details. You’ll review the USDC amount and destination before anything is sent."}
          </p>
        ) : null}

        {phase === "confirm" && readySale ? (
          <div className="space-y-2 text-center">
            <p className="break-all text-sm text-foreground">
              Send {readySale.amount} {asset} to {readySale.to}.
            </p>
            <p className="text-sm text-muted-foreground">
              Review the amount and destination, then confirm. Nothing is sent until you do.
            </p>
          </div>
        ) : null}

        {phase === "sending" ? (
          <div className="flex items-center justify-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-ocean-teal" />
            Confirming transfer…
          </div>
        ) : null}

        {phase === "done" ? (
          <p className="text-sm text-ocean-teal text-center">
            Transfer submitted
            {txHash && !consumerCopy ? ` (${txHash.slice(0, 10)}…)` : ""}.
            {consumerCopy
              ? " Your payout is processing."
              : " Fiat payout continues with the provider."}
          </p>
        ) : null}

        {error || phase === "error" ? (
          <p className="text-sm text-destructive text-center" role="alert">
            {error ?? "Cash-out failed"}
          </p>
        ) : null}

        {phase === "done" ? (
          <Button
            className="h-12 w-full rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
            onClick={() => finishCashOut()}
          >
            Done
          </Button>
        ) : phase === "confirm" && readySale ? (
          <Button
            className="h-auto min-h-12 w-full whitespace-normal break-all rounded-xl bg-ocean-teal py-3 text-center text-base font-semibold text-white hover:bg-ocean-teal/90"
            disabled={asset === "ALGO" ? !algorandAddress : !evmAddress}
            onClick={() => void confirmCoinbaseSend()}
          >
            Send {readySale.amount} {asset} to {readySale.to}
          </Button>
        ) : phase === "gas" ? (
          <>
            <Button
              className="h-12 w-full rounded-xl bg-ocean-teal text-base font-semibold text-white hover:bg-ocean-teal/90"
              onClick={() => void handleFundGas()}
            >
              Add processing fee
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => void retryGasCheck()}
            >
              I already paid — continue
            </Button>
          </>
        ) : (
          <Button
            className="h-12 w-full rounded-xl bg-ocean-teal text-base font-semibold text-white hover:bg-ocean-teal/90"
            disabled={
              (asset === "ALGO" ? !algorandAddress : !evmAddress) ||
              !providerReady ||
              busy
            }
            onClick={() => void handleCashOut()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              <>
                {hideProviderPicker ? null : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {payLabel}
              </>
            )}
          </Button>
        )}

        {(phase === "awaiting_provider" || phase === "confirm") &&
        provider === "coinbase" ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={cancelCoinbaseWait}
          >
            {phase === "confirm" ? "Cancel" : "Cancel wait"}
          </Button>
        ) : null}
      </div>

      {showMoonpay && moonpayKey ? (
        <Suspense fallback={null}>
          <IsolateErrorBoundary
            label="MoonPay"
            fallback={({ error: moonpayError, retry }) => (
              <div className="mt-3 space-y-2 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {moonpayError.message || "Couldn’t open debit-card cash-out."}
                </p>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    closeMoonpay();
                    retry();
                  }}
                >
                  Close
                </Button>
              </div>
            )}
          >
            <EasyStartMoonPaySellHost
              apiKey={moonpayKey}
              evmAddress={evmAddress}
              amount={moonpayAmount}
              onClose={closeMoonpay}
              onUrlSignatureRequested={async (url) => {
                try {
                  const accessToken = await requireAccessToken();
                  return await signMoonpayWidgetUrl(url, accessToken);
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : String(e);
                  setError(message);
                  setPhase("error");
                  setMoonpayVisible(false);
                  return "";
                }
              }}
              onInitiateDeposit={async (props) => {
                try {
                  const hash = await sendUsdcTo(
                    props.depositWalletAddress,
                    props.cryptoCurrencyAmount
                  );
                  setMoonpayVisible(false);
                  return { depositId: hash, cancelTransactionOnError: false };
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : String(e);
                  setError(message);
                  setPhase("error");
                  setMoonpayVisible(false);
                  return { depositId: "", cancelTransactionOnError: true };
                }
              }}
            />
          </IsolateErrorBoundary>
        </Suspense>
      ) : null}
    </>
  );
}
