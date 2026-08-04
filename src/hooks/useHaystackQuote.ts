import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import BigNumber from "bignumber.js";
import type { NetworkId } from "@/config";
import {
  createHaystackRouterClient,
  isHaystackSwapSupported,
} from "@/services/haystackRouter";
import type { SwapQuote } from "@txnlab/haystack-router";

export type HaystackQuoteInput = {
  networkId: NetworkId;
  fromAssetId: number;
  toAssetId: number;
  /** Human amount string */
  amount: string;
  fromDecimals: number;
  toDecimals: number;
  enabled?: boolean;
};

export type HaystackQuoteResult = {
  quote: SwapQuote | null;
  amountOutHuman: string | null;
  usdIn: number | null;
  usdOut: number | null;
  priceImpact: number | null;
  isLoading: boolean;
  error: string | null;
};

function toAtomic(amount: string, decimals: number): bigint | null {
  try {
    const bn = new BigNumber(amount || "0");
    if (!bn.isFinite() || bn.lte(0)) return null;
    return BigInt(
      bn.shiftedBy(decimals).integerValue(BigNumber.ROUND_DOWN).toFixed(0)
    );
  } catch {
    return null;
  }
}

export function formatAtomicToHuman(
  atomic: bigint | number | string | null | undefined,
  decimals: number
): string | null {
  if (atomic == null) return null;
  try {
    const bn = new BigNumber(atomic.toString());
    if (!bn.isFinite()) return null;
    return bn
      .shiftedBy(-decimals)
      .decimalPlaces(8, BigNumber.ROUND_DOWN)
      .toFixed();
  } catch {
    return null;
  }
}

/**
 * Haystack fixed-input swap quote (react-query cached / polled).
 */
export function useHaystackSwapQuote(
  input: HaystackQuoteInput
): HaystackQuoteResult {
  const { activeAccount } = useWallet();
  const address = activeAccount?.address;
  const atomic = toAtomic(input.amount, input.fromDecimals);
  const supported = isHaystackSwapSupported(input.networkId);
  const enabled =
    (input.enabled ?? true) &&
    supported &&
    atomic != null &&
    input.fromAssetId !== input.toAssetId;

  const query = useQuery({
    queryKey: [
      "haystackQuote",
      input.networkId,
      input.fromAssetId,
      input.toAssetId,
      atomic?.toString() ?? "0",
      address ?? "",
    ],
    enabled,
    staleTime: 8_000,
    refetchInterval: enabled ? 20_000 : false,
    queryFn: async () => {
      const client = createHaystackRouterClient(input.networkId);
      if (!client || atomic == null) return null;
      return client.newQuote({
        fromASAID: input.fromAssetId,
        toASAID: input.toAssetId,
        amount: atomic,
        type: "fixed-input",
        address,
      });
    },
  });

  return useMemo(() => {
    const quote = query.data ?? null;
    const err = query.error as Error | null;
    return {
      quote,
      amountOutHuman: quote
        ? formatAtomicToHuman(quote.quote, input.toDecimals)
        : null,
      usdIn: quote?.usdIn ?? null,
      usdOut: quote?.usdOut ?? null,
      priceImpact:
        quote?.userPriceImpact != null && Number.isFinite(quote.userPriceImpact)
          ? quote.userPriceImpact
          : null,
      isLoading: query.isFetching,
      error: err?.message ?? null,
    };
  }, [query.data, query.error, query.isFetching, input.toDecimals]);
}
