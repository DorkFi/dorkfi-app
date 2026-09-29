import type { EasyStartBridgeDirection } from "@/components/easy-start/easyStartBridgePhase";
import type { EasyStartBridgePhase } from "@/components/easy-start/easyStartBridgePhase";
import {
  createXoFixedOrder,
  createXoFloatingOrder,
  fetchXoOrder,
  fetchXoSwapHealth,
  updateXoOrder,
} from "@/lib/easyStart/xoSwap/api";
import {
  XO_PAIR_ALGO_TO_BASE,
  XO_PAIR_BASE_TO_ALGO,
  XO_SWAP_MAX_POLLS,
  XO_SWAP_POLL_MS,
} from "@/lib/easyStart/xoSwap/constants";
import {
  isXoAbortError,
  isXoGeoRestricted,
} from "@/lib/easyStart/xoSwap/errors";
import { quoteXoPair } from "@/lib/easyStart/xoSwap/quotePair";
import {
  isAlgoCreditArrived,
  isBaseCreditArrived,
  isXoOrderFailed,
  isXoOrderSettled,
} from "@/lib/easyStart/xoSwap/settle";
import {
  ensureAlgorandUsdcOptIn,
  sendAlgorandUsdc,
  type SignAlgorandTxns,
} from "@/lib/easyStart/sendAlgorandUsdc";
import {
  sendBaseUsdc,
  type SendUsdcFn,
} from "@/lib/easyStart/sendBaseUsdc";
import {
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";
import type { Address } from "viem";

export type RunXoUsdcSwapArgs = {
  direction: EasyStartBridgeDirection;
  /** Human USDC amount */
  amount: string;
  evmAddress: string;
  algorandAddress: string;
  sendTransaction: SendUsdcFn;
  signTransactions: SignAlgorandTxns;
  signal?: AbortSignal;
  onPhase?: (phase: EasyStartBridgePhase, detail?: string | null) => void;
  /** Algorand USDC before this Base → Algo swap. Used to detect payout. */
  baselineAlgoUsdc?: number;
  /** Base USDC before this Algo → Base swap. Used to detect payout. */
  baselineBaseUsdc?: number;
  onFundsSent?: (info: {
    orderId: string;
    fromTxId: string;
    expectedToAmount: number;
  }) => void;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function pairIdFor(direction: EasyStartBridgeDirection): string {
  return direction === "algo-to-base"
    ? XO_PAIR_ALGO_TO_BASE
    : XO_PAIR_BASE_TO_ALGO;
}

function parseAmount(amount: string): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid USDC amount");
  }
  return n;
}

/**
 * Full XO Swap Direct flow for Easy Start Base ↔ Algorand USDC:
 * rates/quote → create order → send to payIn → PATCH txid → poll until complete.
 */
export async function runXoUsdcSwap(
  args: RunXoUsdcSwapArgs
): Promise<{ orderId: string }> {
  const fromAmount = parseAmount(args.amount);
  const pairId = pairIdFor(args.direction);
  const fromAddress =
    args.direction === "algo-to-base"
      ? args.algorandAddress
      : args.evmAddress;
  const toAddress =
    args.direction === "algo-to-base"
      ? args.evmAddress
      : args.algorandAddress;

  const report = (
    phase: EasyStartBridgePhase,
    detail?: string | null
  ) => {
    args.onPhase?.(phase, detail);
  };

  report("preparing");

  const xoReq = { signal: args.signal };
  const health = await fetchXoSwapHealth(xoReq);
  if (!health.configured) {
    throw new Error(
      "XO Swap is not configured. Set XO_SWAP_APP_NAME on the API host."
    );
  }

  // Receiving Algorand USDC requires an ASA opt-in first.
  if (args.direction === "base-to-algo") {
    report("signing", "Opting into Algorand USDC…");
    await ensureAlgorandUsdcOptIn({
      address: args.algorandAddress,
      signTransactions: args.signTransactions,
    });
    report("preparing");
  }

  if (args.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  let quoted;
  try {
    quoted = await quoteXoPair(pairId, fromAmount, xoReq);
  } catch (err) {
    if (isXoGeoRestricted(err)) {
      throw err instanceof Error
        ? err
        : new Error("USDC moves aren’t available in your region yet.");
    }
    if (isXoAbortError(err)) throw err;
    throw err;
  }

  if (!quoted.inRange || quoted.toAmount == null) {
    if (quoted.min != null && fromAmount < quoted.min) {
      throw new Error(`Amount is below the ${quoted.min} USDC minimum`);
    }
    if (quoted.max != null && fromAmount > quoted.max) {
      throw new Error(`Amount is above the ${quoted.max} USDC maximum`);
    }
    throw new Error("No XO Swap rate for this amount");
  }

  const toAmount = quoted.toAmount;
  const useFloating = quoted.useFloating;

  if (args.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  report("preparing", "Creating swap order…");
  const create = useFloating ? createXoFloatingOrder : createXoFixedOrder;
  const order = await create(
    {
      pairId,
      fromAmount,
      fromAddress,
      toAddress,
      toAmount,
    },
    xoReq
  );

  const payIn = order.payInAddress;
  if (!payIn) {
    throw new Error("XO Swap order missing pay-in address");
  }

  report("signing");
  let fromTxId: string;
  if (args.direction === "algo-to-base") {
    fromTxId = await sendAlgorandUsdc({
      from: args.algorandAddress,
      to: payIn,
      amount: args.amount,
      signTransactions: args.signTransactions,
    });
  } else {
    fromTxId = await sendBaseUsdc({
      sendTransaction: args.sendTransaction,
      to: payIn,
      amount: args.amount,
      fromAddress: args.evmAddress,
    });
  }

  report("sending");
  args.onFundsSent?.({
    orderId: order.id,
    fromTxId,
    expectedToAmount: toAmount,
  });
  await updateXoOrder(order.id, { fromTransactionId: fromTxId }, xoReq);

  const watchAlgoCredit =
    args.direction === "base-to-algo" &&
    typeof args.baselineAlgoUsdc === "number" &&
    Number.isFinite(args.baselineAlgoUsdc);

  const algoCreditReady = async (): Promise<boolean> => {
    if (!watchAlgoCredit) return false;
    try {
      const bal = await fetchAlgorandUsdcBalance(args.algorandAddress);
      return isAlgoCreditArrived({
        current: Number.parseFloat(bal.formatted),
        baseline: args.baselineAlgoUsdc!,
        expectedToAmount: toAmount,
      });
    } catch {
      return false;
    }
  };

  const watchBaseCredit =
    args.direction === "algo-to-base" &&
    typeof args.baselineBaseUsdc === "number" &&
    Number.isFinite(args.baselineBaseUsdc);

  const baseCreditReady = async (): Promise<boolean> => {
    if (!watchBaseCredit) return false;
    try {
      const bal = await fetchBaseUsdcBalance(args.evmAddress as Address);
      return isBaseCreditArrived({
        current: Number.parseFloat(bal.formatted),
        baseline: args.baselineBaseUsdc!,
        expectedToAmount: toAmount,
      });
    } catch {
      return false;
    }
  };

  const payoutReady = async (): Promise<boolean> =>
    (await algoCreditReady()) || (await baseCreditReady());

  report("waiting");
  for (let i = 0; i < XO_SWAP_MAX_POLLS; i++) {
    if (args.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const latest = await fetchXoOrder(order.id, xoReq);
    if (isXoOrderSettled(latest) || (await payoutReady())) {
      report("success");
      return { orderId: order.id };
    }
    if (isXoOrderFailed(latest)) {
      throw new Error(latest.message || `Swap ${latest.status || "failed"}`);
    }
    await sleep(XO_SWAP_POLL_MS, args.signal);
  }

  if (await payoutReady()) {
    report("success");
    return { orderId: order.id };
  }

  throw new Error("Swap timed out waiting for XO Swap confirmation");
}
