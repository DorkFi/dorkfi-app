import type {
  EasyStartBridgeDirection,
  EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import {
  ARAMID_AVM_BRIDGE,
  ARAMID_BASE_USDC,
  ARAMID_EVM_BRIDGE,
  ARAMID_MAX_POLLS,
  ARAMID_POLL_MS,
  aramidClaimUrl,
} from "@/lib/easyStart/aramid/constants";
import {
  fetchUsdcAllowance,
  waitForBaseTx,
} from "@/lib/easyStart/aramid/baseClient";
import { splitAramidFee, usdcToAtomic } from "@/lib/easyStart/aramid/fees";
import {
  encodeAramidLockTokens,
  encodeUsdcApprove,
} from "@/lib/easyStart/aramid/lockTokens";
import { encodeAramidAvmToBaseNote } from "@/lib/easyStart/aramid/note";
import { assertAramidBaseCanRelease } from "@/lib/easyStart/aramid/liquidity";
import { waitForBaseUsdcCredit } from "@/lib/easyStart/aramid/waitForBaseCredit";
import {
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";
import {
  ensureAlgorandUsdcOptIn,
  sendAlgorandUsdc,
  type SignAlgorandTxns,
} from "@/lib/easyStart/sendAlgorandUsdc";
import type { SendUsdcFn } from "@/lib/easyStart/sendBaseUsdc";
import { base } from "viem/chains";
import type { Address, Hex } from "viem";

export type RunAramidUsdcBridgeArgs = {
  direction: EasyStartBridgeDirection;
  /** Human USDC amount */
  amount: string;
  evmAddress: string;
  algorandAddress: string;
  sendTransaction: SendUsdcFn;
  signTransactions: SignAlgorandTxns;
  signal?: AbortSignal;
  onPhase?: (phase: EasyStartBridgePhase, detail?: string | null) => void;
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

async function sendBaseCall(args: {
  sendTransaction: SendUsdcFn;
  to: Address;
  data: Hex;
}): Promise<Hex> {
  const { hash } = await args.sendTransaction({
    to: args.to,
    data: args.data,
    value: 0n,
    chainId: base.id,
  });
  await waitForBaseTx(hash);
  return hash;
}

/**
 * Easy Start Base ↔ Algorand USDC via Aramid Bridge.
 * Deposit: approve + lockTokens, then poll Algorand credit.
 * Withdraw: liquidity check, ASA transfer with Aramid note, poll Base.
 */
export async function runAramidUsdcBridge(
  args: RunAramidUsdcBridgeArgs
): Promise<{ txId: string }> {
  const totalAtomic = usdcToAtomic(args.amount);
  const { feeAmount, destinationAmount } = splitAramidFee(totalAtomic);

  const report = (
    phase: EasyStartBridgePhase,
    detail?: string | null
  ) => {
    args.onPhase?.(phase, detail);
  };

  report("preparing");

  if (args.direction === "base-to-algo") {
    report("signing", "Opting into Algorand USDC…");
    await ensureAlgorandUsdcOptIn({
      address: args.algorandAddress,
      signTransactions: args.signTransactions,
    });

    const before = await fetchAlgorandUsdcBalance(args.algorandAddress);
    const owner = args.evmAddress as Address;

    report("signing", "Approving USDC…");
    const allowance = await fetchUsdcAllowance(owner);
    if (allowance < totalAtomic) {
      const approveData = encodeUsdcApprove(ARAMID_EVM_BRIDGE, totalAtomic);
      await sendBaseCall({
        sendTransaction: args.sendTransaction,
        to: ARAMID_BASE_USDC,
        data: approveData,
      });
    }

    report("signing", "Bridging to Algorand…");
    const lockData = encodeAramidLockTokens({
      feeAmount,
      rootAmount: destinationAmount,
      algorandAddress: args.algorandAddress,
    });
    report("sending");
    const hash = await sendBaseCall({
      sendTransaction: args.sendTransaction,
      to: ARAMID_EVM_BRIDGE,
      data: lockData,
    });

    report("waiting", "Waiting for USDC on Algorand…");
    await waitForBalanceIncrease({
      read: () => fetchAlgorandUsdcBalance(args.algorandAddress).then((b) => b.value),
      start: before.value,
      minIncrease: destinationAmount,
      signal: args.signal,
    });

    report("success");
    return { txId: hash };
  }

  const before = await fetchBaseUsdcBalance(args.evmAddress as Address);
  await assertAramidBaseCanRelease({ destinationAtomic: destinationAmount });
  report("signing");
  const note = encodeAramidAvmToBaseNote({
    evmAddress: args.evmAddress,
    feeAmount,
    destinationAmount,
  });
  const txId = await sendAlgorandUsdc({
    from: args.algorandAddress,
    to: ARAMID_AVM_BRIDGE,
    amount: args.amount,
    signTransactions: args.signTransactions,
    note,
  });

  report("sending");
  report("waiting", aramidClaimUrl(txId));
  await waitForBaseUsdcCredit({
    evmAddress: args.evmAddress as Address,
    start: before.value,
    minIncrease: destinationAmount,
    claimTxId: txId,
    signal: args.signal,
    sendTransaction: args.sendTransaction,
    onClaim: () => report("signing", "Confirm receive on Base…"),
    onClaimSettled: () => report("waiting", aramidClaimUrl(txId)),
  });

  report("success");
  return { txId };
}

async function waitForBalanceIncrease(args: {
  read: () => Promise<bigint>;
  start: bigint;
  minIncrease: bigint;
  signal?: AbortSignal;
}): Promise<void> {
  for (let i = 0; i < ARAMID_MAX_POLLS; i++) {
    if (args.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const latest = await args.read();
    if (latest >= args.start + args.minIncrease) {
      return;
    }
    // Credit can be slightly below minIncrease if fee rounding differs; accept any increase after first polls.
    if (i > 2 && latest > args.start) {
      return;
    }
    await sleep(ARAMID_POLL_MS, args.signal);
  }
  throw new Error("Bridge timed out");
}
