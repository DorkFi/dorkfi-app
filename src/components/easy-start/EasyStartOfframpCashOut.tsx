import { useCallback, useEffect, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { MoonPayProvider, MoonPaySellWidget } from "@moonpay/moonpay-react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";

type CashOutPhase =
  | "idle"
  | "opening"
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
}

/**
 * In-app cash-out after Base USDC arrives:
 * - Coinbase: CDP session → sell widget → poll to_address → Privy USDC transfer
 * - MoonPay: sell widget + signed URL → onInitiateDeposit → Privy USDC transfer
 */
export function EasyStartOfframpCashOut({
  evmAddress,
  amount,
  provider,
  onProviderChange,
  onDone,
}: EasyStartOfframpCashOutProps) {
  const { sendTransaction } = useSendTransaction();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();

  const [health, setHealth] = useState<OfframpHealth | null>(null);
  const [phase, setPhase] = useState<CashOutPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partnerUserRef, setPartnerUserRef] = useState<string | null>(null);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const moonpayKey = moonpayPublishableKey();

  useEffect(() => {
    void fetchOfframpHealth()
      .then(setHealth)
      .catch(() =>
        setHealth({ ok: false, coinbase: false, moonpay: false })
      );
  }, []);

  const providerReady =
    provider === "coinbase"
      ? Boolean(health?.coinbase)
      : Boolean(health?.moonpay && moonpayKey);

  const sendUsdcTo = useCallback(
    async (to: string, cryptoAmount: string) => {
      setPhase("sending");
      const hash = await sendBaseUsdc({
        sendTransaction: (input) =>
          sendTransaction({
            to: input.to as `0x${string}`,
            data: input.data,
            value: input.value != null ? `0x${input.value.toString(16)}` : "0x0",
            chainId: input.chainId,
          }),
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
          await sendUsdcTo(to, sellAmt);
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
      window.open(session.sellUrl, "_blank", "noopener,noreferrer");
      setPhase("awaiting_provider");
      toast({
        title: "Complete sell in Coinbase",
        description:
          "After you confirm the cash-out, we’ll prompt you to send funds from your account.",
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

  const handleCashOut = () => {
    if (provider === "coinbase") void startCoinbase();
    else startMoonpay();
  };

  const moonpayAmount =
    amount && Number(amount) > 0
      ? Number(amount).toFixed(6).replace(/\.?0+$/, "")
      : undefined;

  const body = (
    <div className="space-y-4 text-left">
      <EasyStartCardProviderPicker
        value={provider}
        onChange={onProviderChange}
        label="Cash out with"
      />

      {health && !providerReady ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          {provider === "coinbase"
            ? "Coinbase off-ramp needs CDP_API_KEY_ID + CDP_API_KEY_SECRET on the offramp API."
            : "MoonPay off-ramp needs VITE_MOONPAY_API_KEY and MOONPAY_SECRET_KEY."}
        </p>
      ) : null}

      {phase === "awaiting_provider" && provider === "coinbase" ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Waiting for Coinbase sell details…
        </p>
      ) : null}

      {phase === "sending" ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-ocean-teal" />
          Confirming transfer…
        </div>
      ) : null}

      {phase === "done" ? (
        <p className="text-sm text-ocean-teal text-center">
          Transfer submitted
          {txHash && !consumerCopy ? ` (${txHash.slice(0, 10)}…)` : ""}. Fiat payout continues
          with the provider.
        </p>
      ) : null}

      {error || phase === "error" ? (
        <p className="text-sm text-destructive text-center" role="alert">
          {error ?? "Cash-out failed"}
        </p>
      ) : null}

      {phase === "done" ? (
        <Button
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
          onClick={() => onDone?.()}
        >
          Done
        </Button>
      ) : (
        <Button
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
          disabled={
            !evmAddress ||
            !providerReady ||
            phase === "opening" ||
            phase === "sending" ||
            phase === "awaiting_provider"
          }
          onClick={handleCashOut}
        >
          {phase === "opening" || phase === "sending" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Working…
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Cash out with {provider === "coinbase" ? "Coinbase" : "MoonPay"}
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
  );

  if (!moonpayKey) {
    return body;
  }

  return (
    <MoonPayProvider apiKey={moonpayKey} debug={import.meta.env.DEV}>
      {body}
      <MoonPaySellWidget
        variant="overlay"
        visible={moonpayVisible}
        baseCurrencyCode="usdc"
        baseCurrencyAmount={moonpayAmount}
        walletAddress={evmAddress ?? undefined}
        onClose={async () => {
          setMoonpayVisible(false);
          if (phase === "awaiting_provider") setPhase("idle");
        }}
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
    </MoonPayProvider>
  );
}
