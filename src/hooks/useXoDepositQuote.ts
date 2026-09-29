import { useQuery } from "@tanstack/react-query";
import { XO_PAIR_BASE_TO_ALGO } from "@/lib/easyStart/xoSwap/constants";
import { quoteXoPair } from "@/lib/easyStart/xoSwap/quotePair";

export function useXoDepositQuote(args: {
  enabled: boolean;
  fromAmount: number;
}) {
  const { enabled, fromAmount } = args;
  const ready = enabled && Number.isFinite(fromAmount) && fromAmount > 0;

  return useQuery({
    queryKey: ["xo-deposit-quote", XO_PAIR_BASE_TO_ALGO, fromAmount],
    queryFn: ({ signal }) =>
      quoteXoPair(XO_PAIR_BASE_TO_ALGO, fromAmount, { signal }),
    enabled: ready,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}
