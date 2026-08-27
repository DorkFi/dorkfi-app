import type { Address, Hex } from "viem";
import { base } from "viem/chains";
import {
  ARAMID_EVM_BRIDGE,
  ARAMID_MAX_POLLS,
  ARAMID_POLL_MS,
} from "@/lib/easyStart/aramid/constants";
import { AramidCreditPendingError } from "@/lib/easyStart/aramid/creditPending";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import { fetchAramidClaimData } from "@/lib/easyStart/aramid/claimData";
import { encodeAramidReleaseTokens } from "@/lib/easyStart/aramid/releaseTokens";
import { waitForBaseTx } from "@/lib/easyStart/aramid/baseClient";
import type { SendUsdcFn } from "@/lib/easyStart/sendBaseUsdc";

const FETCH_MS = 15_000;

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

async function readBaseUsdc(evmAddress: Address): Promise<bigint | null> {
  try {
    const result = await Promise.race([
      fetchBaseUsdcBalance(evmAddress).then((b) => b.value),
      sleep(FETCH_MS).then(() => {
        throw new Error("timeout");
      }),
    ]);
    return typeof result === "bigint" ? result : null;
  } catch {
    return null;
  }
}

async function trySubmitClaim(args: {
  claimTxId: string;
  sendTransaction: SendUsdcFn;
  signal?: AbortSignal;
  onClaim?: () => void;
  onClaimSettled?: () => void;
}): Promise<"no-payload" | "done"> {
  const claim = await fetchAramidClaimData(args.claimTxId, args.signal);
  if (!claim) return "no-payload";
  if (args.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  args.onClaim?.();
  try {
    const data = encodeAramidReleaseTokens(claim);
    const { hash } = await args.sendTransaction({
      to: ARAMID_EVM_BRIDGE,
      data,
      value: 0n,
      chainId: base.id,
    });
    await waitForBaseTx(hash as Hex, 20_000);
  } catch {
    // Already processed, user rejected, or send failed — keep polling USDC.
  } finally {
    args.onClaimSettled?.();
  }
  return "done";
}

/** Poll Base Circle USDC until it rises by at least `minIncrease`. */
export async function waitForBaseUsdcCredit(args: {
  evmAddress: Address;
  start: bigint;
  minIncrease: bigint;
  claimTxId?: string;
  signal?: AbortSignal;
  /** When set, submit `releaseTokens` once soldiers publish claim data. */
  sendTransaction?: SendUsdcFn;
  onClaim?: () => void;
  onClaimSettled?: () => void;
}): Promise<void> {
  let claimAttempted = false;
  let claimInFlight = false;

  const kickClaim = () => {
    if (
      !args.sendTransaction ||
      !args.claimTxId ||
      claimAttempted ||
      claimInFlight
    ) {
      return;
    }
    claimInFlight = true;
    void trySubmitClaim({
      claimTxId: args.claimTxId,
      sendTransaction: args.sendTransaction,
      signal: args.signal,
      onClaim: args.onClaim,
      onClaimSettled: args.onClaimSettled,
    })
      .then((result) => {
        if (result === "done") claimAttempted = true;
      })
      .catch(() => {
        /* aborted or lookup failed — retry on a later poll */
      })
      .finally(() => {
        claimInFlight = false;
      });
  };

  for (let i = 0; i < ARAMID_MAX_POLLS; i++) {
    if (args.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const latest = await readBaseUsdc(args.evmAddress);
    if (latest != null) {
      if (latest >= args.start + args.minIncrease) {
        return;
      }
      if (i > 2 && latest > args.start) {
        return;
      }
    }

    kickClaim();
    await sleep(ARAMID_POLL_MS, args.signal);
  }
  throw new AramidCreditPendingError(args.claimTxId);
}
