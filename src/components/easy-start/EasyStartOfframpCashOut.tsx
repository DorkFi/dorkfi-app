import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { useFundWallet, useSendTransaction } from "@privy-io/react-auth";
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
  coinbaseDepositAddress,
  coinbaseSellAmount,
  createCoinbaseOfframpSession,
  fetchCoinbaseOfframpStatus,
  fetchOfframpHealth,
  moonpayPublishableKey,
  signMoonpayWidgetUrl,
  type OfframpHealth,
} from "@/lib/easyStart/offrampApi";
import { sendBaseUsdc } from "@/lib/easyStart/sendBaseUsdc";
import {
  fetchBaseEthBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
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
  | "sending"
  | "done"
  | "error";

interface EasyStartOfframpCashOutProps {
  evmAddress: string | null;
  /** USDC amount just bridged to Base (human units). */
  amount: string | null;
  provider: CardProvider;
  onProviderChange: (provider: CardProvider) => void;
  onDone?: () => void;
  hideProviderPicker?: boolean;
  ctaLabel?: string;
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
 * - Coinbase: CDP session → sell widget → poll to_address → Privy USDC transfer
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
}: EasyStartOfframpCashOutProps) {
  const { sendTransaction } = useSendTransaction();
  const { fundWallet } = useFundWallet();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();

  const [health, setHealth] = useState<OfframpHealth | null>(null);
  const [phase, setPhase] = useState<CashOutPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partnerUserRef, setPartnerUserRef] = useState<string | null>(null);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

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
      setPhase("done");
      toast({
        title: "Sent",
        description: "Your cash-out is processing with the provider.",
      });
      return hash;
    },
    [evmAddress, sendTransaction, toast]
  );

  const closeMoonpay = useCallback(() => {
    setMoonpayVisible(false);
    setPhase((current) =>
      current === "awaiting_provider" ? "idle" : current
    );
  }, []);

  // Poll Coinbase for deposit address after widget session starts.
  useEffect(() => {
    if (provider !== "coinbase" || !partnerUserRef) return;
    if (phase !== "awaiting_provider") return;

    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      try {
        const { latest } = await fetchCoinbaseOfframpStatus(partnerUserRef);
        const to = coinbaseDepositAddress(latest);
        const sellAmt = coinbaseSellAmount(latest) || amount;
        if (to && sellAmt && !cancelled) {
          try {
            await sendUsdcTo(to, sellAmt);
          } catch (e: unknown) {
            if (cancelled) return;
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            setPhase("error");
          }
          return;
        }
      } catch {
        // keep polling until timeout
      }
      if (cancelled) return;
      if (Date.now() - started > 30 * 60 * 1000) {
        setError("Timed out waiting for Coinbase sell details. Try again.");
        setPhase("error");
        return;
      }
      window.setTimeout(() => void tick(), 4000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [amount, partnerUserRef, phase, provider, sendUsdcTo]);

  const startCoinbase = async () => {
    if (!evmAddress) return;
    setError(null);
    setPhase("opening");
    try {
      const session = await createCoinbaseOfframpSession({
        address: evmAddress,
        amount: amount ?? undefined,
      });
      setPartnerUserRef(session.partnerUserRef);
      const popup = window.open(
        session.sellUrl,
        "_blank",
        "noopener,noreferrer"
      );
      if (!popup) {
        setError(
          consumerCopy
            ? "Allow pop-ups to continue cash-out."
            : "Allow pop-ups to open Coinbase cash-out."
        );
        setPhase("error");
        return;
      }
      setPhase("awaiting_provider");
      toast({
        title: consumerCopy ? "Complete cash-out" : "Complete sell in Coinbase",
        description: consumerCopy
          ? "After you confirm, we’ll send the funds from your account."
          : "After you confirm the cash-out, we’ll prompt you to send funds from your account.",
      });
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
    ? provider === "coinbase"
      ? "Bank cash-out isn’t available right now. Try debit card."
      : "Card cash-out isn’t available right now. Try again later."
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
              ? "Waiting for bank cash-out details…"
              : "Waiting for Coinbase sell details…"}
          </p>
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
            onClick={() => onDone?.()}
          >
            Done
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
            disabled={!evmAddress || !providerReady || busy}
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

        {phase === "awaiting_provider" && provider === "coinbase" ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setPartnerUserRef(null);
              setPhase("idle");
            }}
          >
            Cancel wait
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
                  return await signMoonpayWidgetUrl(url);
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
