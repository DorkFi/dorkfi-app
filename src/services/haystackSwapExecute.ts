import type { Transaction } from "algosdk";
import type { Wallet } from "@txnlab/use-wallet-react";
import { RouterClient, type SwapComposer, type FetchQuoteResponse } from "@txnlab/haystack-router";
import type {
  HaystackQuoteResponse,
} from "@/services/haystackRouterService";
import { getHaystackProxyBaseUrl } from "@/services/haystackRouterService";
import { withRainbowkitHostDialogDismissed } from "@/wallet/xchainSignUi";

/**
 * Proxy quote JSON is the same shape the SDK expects; our local type is a
 * narrower structural mirror used by UI/hooks.
 */
export function asSdkQuote(quote: HaystackQuoteResponse): FetchQuoteResponse {
  return quote as unknown as FetchQuoteResponse;
}

/**
 * SDK calls `${apiBaseUrl}/fetchQuote` and `${apiBaseUrl}/fetchExecuteSwapTxns`.
 * Our Vite proxy serves those under `/api/haystack/api/…` and injects HAYSTACK_API_KEY.
 */
export function getHaystackSdkApiBaseUrl(): string {
  const base = getHaystackProxyBaseUrl().replace(/\/$/, "");
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}/api`;
  }
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8080";
  return `${origin}${base}/api`;
}

let routerClient: RouterClient | null = null;
let routerApiBaseUrl: string | null = null;

function getHaystackRouterClient(): RouterClient {
  const apiBaseUrl = getHaystackSdkApiBaseUrl();
  if (!routerClient || routerApiBaseUrl !== apiBaseUrl) {
    routerClient = new RouterClient({
      apiKey: "dorkfi-browser-proxy",
      apiBaseUrl,
    });
    routerApiBaseUrl = apiBaseUrl;
  }
  return routerClient;
}

export function pickSwapTxIdFromComposer(
  result: { txIds?: string[] } | null | undefined,
  swap: SwapComposer
): string | undefined {
  const fromResult =
    result?.txIds?.find((id) => typeof id === "string" && id.length > 0) ??
    result?.txIds?.[0];
  if (fromResult) return fromResult;
  try {
    return swap.getInputTransactionId() ?? undefined;
  } catch {
    return undefined;
  }
}

export type ExecuteHaystackSwapResult = {
  txId: string;
  /** True when the swap likely landed even if post-submit bookkeeping threw. */
  confirmedOrSubmitted: boolean;
};

/**
 * Execute a Haystack swap via SwapComposer.
 * If the group already confirmed but follow-up throws, still return a tx id
 * when available so callers do not re-prompt a duplicate swap.
 */
export async function executeHaystackSwap(args: {
  address: string;
  quote: HaystackQuoteResponse;
  /** Percent, e.g. 1 = 1% */
  slippagePercent: number;
  transactionSigner: (
    txnGroup: Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>;
  activeWallet: Wallet | null | undefined;
  setRainbowkitSuppressed?: (v: boolean) => void;
}): Promise<ExecuteHaystackSwapResult> {
  if (!args.quote?.txnPayload) {
    throw new Error("Haystack quote has no executable txnPayload");
  }
  if (!args.transactionSigner) {
    throw new Error("Wallet transactionSigner is required for Haystack swaps");
  }

  const router = getHaystackRouterClient();
  let swap: SwapComposer | null = null;

  try {
    const result = await withRainbowkitHostDialogDismissed({
      wallet: args.activeWallet,
      setSuppressed: args.setRainbowkitSuppressed ?? (() => {}),
      leaveOverlayDismissedOnSuccess: true,
      run: async () => {
        swap = await router.newSwap({
          quote: asSdkQuote(args.quote),
          address: args.address,
          slippage: args.slippagePercent,
          signer: args.transactionSigner,
        });
        await swap.addSwapTransactions();
        return swap.execute();
      },
    });

    const txId = pickSwapTxIdFromComposer(result, swap!);
    if (!txId) {
      throw new Error("Haystack swap submitted but no transaction id returned");
    }
    return { txId, confirmedOrSubmitted: true };
  } catch (error) {
    // Swap may have already been submitted/confirmed before a late error.
    if (swap) {
      const recovered = pickSwapTxIdFromComposer(null, swap);
      if (recovered) {
        console.warn(
          "[haystack] execute threw after submit; treating swap as succeeded",
          error
        );
        return { txId: recovered, confirmedOrSubmitted: true };
      }
    }
    throw error;
  }
}
