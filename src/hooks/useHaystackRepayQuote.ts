import { useCallback, useEffect, useState } from "react";
import BigNumber from "bignumber.js";
import {
  fetchHaystackQuote,
  type HaystackQuoteResponse,
} from "@/services/haystackRouterService";
import { haystackRepayMaxGroupSize } from "@/services/haystackAtomicRepay";

export type UseHaystackRepayQuoteArgs = {
  enabled: boolean;
  /** Debt ASA to receive from the swap (fixed-output). */
  debtAsaId: number | null;
  /** Payment ASA spent by the user. */
  paymentAsaId: number | null;
  /** Human-readable debt amount to repay. */
  debtAmountHuman: string;
  debtDecimals: number;
  chain?: "mainnet" | "testnet";
};

export type HaystackRepayQuoteState = {
  quote: HaystackQuoteResponse | null;
  paymentAtomicNeeded: bigint | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

/**
 * Live Haystack fixed-output quote: how much payment ASA is needed to receive
 * `debtAmountHuman` of the debt asset.
 */
export function useHaystackRepayQuote(
  args: UseHaystackRepayQuoteArgs
): HaystackRepayQuoteState & { refresh: () => void } {
  const [quote, setQuote] = useState<HaystackQuoteResponse | null>(null);
  const [paymentAtomicNeeded, setPaymentAtomicNeeded] = useState<bigint | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (
      !args.enabled ||
      args.debtAsaId == null ||
      args.paymentAsaId == null ||
      args.debtAsaId === args.paymentAsaId
    ) {
      setQuote(null);
      setPaymentAtomicNeeded(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const trimmed = args.debtAmountHuman.trim();
    if (!trimmed || trimmed === "." || Number(trimmed) <= 0) {
      setQuote(null);
      setPaymentAtomicNeeded(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let debtAtomic: bigint;
    try {
      debtAtomic = BigInt(
        new BigNumber(trimmed)
          .times(new BigNumber(10).pow(args.debtDecimals))
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
    } catch {
      setError("Invalid repay amount");
      setQuote(null);
      setPaymentAtomicNeeded(null);
      return;
    }
    if (debtAtomic <= 0n) {
      setQuote(null);
      setPaymentAtomicNeeded(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const q = await fetchHaystackQuote({
            chain: args.chain ?? "mainnet",
            type: "fixed-output",
            amount: debtAtomic,
            fromASAID: args.paymentAsaId!,
            toASAID: args.debtAsaId!,
            // Compact routes so SwapComposer can append repay in one atomic group.
            maxGroupSize: haystackRepayMaxGroupSize(),
            disabledProtocols: ["Humble"],
          });
          if (cancelled) return;
          if (!q.txnPayload) {
            setQuote(null);
            setPaymentAtomicNeeded(null);
            setError("No executable route for this pair");
            return;
          }
          setQuote(q);
          // fixed-output: `quote` is input amount in base units of fromASAID
          setPaymentAtomicNeeded(BigInt(Math.floor(Number(q.quote))));
          setLastUpdated(new Date());
        } catch (e) {
          if (cancelled) return;
          setQuote(null);
          setPaymentAtomicNeeded(null);
          setError(e instanceof Error ? e.message : "Quote failed");
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    args.enabled,
    args.debtAsaId,
    args.paymentAsaId,
    args.debtAmountHuman,
    args.debtDecimals,
    args.chain,
    tick,
  ]);

  return {
    quote,
    paymentAtomicNeeded,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
