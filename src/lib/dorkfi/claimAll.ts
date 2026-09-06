/**
 * DorkFi Claim All orchestration.
 *
 * ## Transaction lifecycle
 * 1. **Build** — `buildTransactions(positions)` returns unsigned txns (any mix of types).
 * 2. **Group** — chunk into atomic groups (≤16 txns), `assignGroupID` per group.
 * 3. **Sign batches** — flatten up to 16 groups per wallet call; reconstruct boundaries after.
 * 4. **Submit** — each atomic group is `sendRawTransaction` + `waitForConfirmation` separately.
 *
 * ## Why signing batches ≠ execution groups
 * - Execution group: Algorand consensus unit (max 16 txns, one group ID).
 * - Signing batch: UX unit for the wallet (may contain many execution groups).
 *
 * ## ARC-200 / NFT drip note
 * Builders like ulujs `custom()` may already return grouped bytes. Use
 * `claimAllFromEncodedGroups` instead of flat `buildTransactions` when groups are pre-built.
 */

import type { Algodv2 } from "algosdk";
import {
  createClaimAllPlan,
  createSigningBatchesFromEncoded,
  groupTransactions,
} from "@/lib/algorand/grouping";
import { ClaimAllCancelledError, signAllBatches, signAllEncodedBatches } from "@/lib/algorand/signing";
import { submitSignedGroups } from "@/lib/algorand/submission";
import type {
  ClaimAllProgress,
  ClaimAllResult,
  ClaimAllRewardsOptions,
  ClaimState,
} from "@/lib/dorkfi/types";
import { isTransactionUserRejection } from "@/utils/errorUtils";
import { TX_CONFIRMATION_WAIT_ROUNDS } from "@/utils/transactionUtils";

function emitProgress(
  onProgress: ((p: ClaimAllProgress) => void) | undefined,
  partial: Omit<ClaimAllProgress, "progressPercent"> & { progressPercent?: number }
): void {
  if (!onProgress) return;
  const total = partial.totalBatches || 1;
  const batchFrac = (partial.currentBatch + 1) / total;
  const groupFrac =
    partial.totalGroups > 0 ? partial.successfulGroups / partial.totalGroups : 0;
  const progressPercent =
    partial.progressPercent ??
    Math.round(
      (partial.state === "building"
        ? 10
        : partial.state === "awaiting_signature"
          ? 10 + batchFrac * 40
          : partial.state === "submitting"
            ? 50 + groupFrac * 50
            : partial.state === "complete"
              ? 100
              : partial.state === "partial_failure"
                ? 50 + groupFrac * 50
                : 0) * 10
    ) / 10;

  onProgress({ ...partial, progressPercent });
}

function setState(
  onStateChange: ((s: ClaimState) => void) | undefined,
  state: ClaimState
): void {
  onStateChange?.(state);
}

/**
 * Claim rewards for many positions with grouped atomic execution and batched signing.
 *
 * @example
 * ```ts
 * await claimAllRewards({
 *   positions: markets,
 *   buildTransactions: (p) => buildMarketClaimTxns(p),
 *   signTransactions,
 *   algodClient: algod,
 *   onProgress: (p) => setProgress(p),
 * });
 * ```
 */
export async function claimAllRewards<TPosition>(
  options: ClaimAllRewardsOptions<TPosition>
): Promise<ClaimAllResult> {
  const {
    positions,
    buildTransactions,
    signTransactions,
    algodClient,
    onProgress,
    onStateChange,
    signal,
    waitRounds = TX_CONFIRMATION_WAIT_ROUNDS,
    retryGroupIndices,
    preSignedGroups,
  } = options;

  if (positions.length === 0 && !preSignedGroups?.length) {
    return {
      successfulTxIds: [],
      failedGroups: [],
      confirmedRounds: [],
      state: "complete",
    };
  }

  try {
    setState(onStateChange, "building");
    emitProgress(onProgress, {
      state: "building",
      currentBatch: 0,
      totalBatches: 0,
      currentGroup: 0,
      totalGroups: 0,
      successfulGroups: 0,
      failedGroups: 0,
      message: "Building claim transactions…",
    });

    let signedGroups: Uint8Array[][];

    if (preSignedGroups?.length) {
      signedGroups = preSignedGroups;
    } else {
      const built = await buildTransactions(positions);
      const { groups, signingBatches } = createClaimAllPlan(groupTransactions(built));
      const totalGroups = groups.length;
      const totalBatches = signingBatches.length;

      setState(onStateChange, "awaiting_signature");
      emitProgress(onProgress, {
        state: "awaiting_signature",
        currentBatch: 0,
        totalBatches,
        currentGroup: 0,
        totalGroups,
        successfulGroups: 0,
        failedGroups: 0,
        message: "Approve transactions in your wallet",
      });

      if (signal?.aborted) throw new ClaimAllCancelledError();

      const signResult = await signAllBatches(signingBatches, signTransactions, {
        shouldCancel: () => signal?.aborted === true,
        onBatchStart: (batchIndex, total) => {
          emitProgress(onProgress, {
            state: "awaiting_signature",
            currentBatch: batchIndex,
            totalBatches: total,
            currentGroup: signingBatches[batchIndex]?.startGroupIndex ?? 0,
            totalGroups,
            successfulGroups: 0,
            failedGroups: 0,
            message: `Signing batch ${batchIndex + 1} of ${total}`,
          });
        },
      });
      signedGroups = signResult.signedGroups;
    }

    const totalGroups = signedGroups.length;
    setState(onStateChange, "submitting");
    let successfulGroups = 0;
    let failedCount = 0;

    const submitResult = await submitSignedGroups({
      algod: algodClient,
      signedGroups,
      waitRounds,
      onlyGroupIndices: retryGroupIndices,
      onGroupSubmitted: (r) => {
        if (r.txId) successfulGroups++;
        else failedCount++;
        emitProgress(onProgress, {
          state: "submitting",
          currentBatch: 0,
          totalBatches: 1,
          currentGroup: r.groupIndex,
          totalGroups,
          successfulGroups,
          failedGroups: failedCount,
          message: r.txId
            ? `Confirmed group ${r.groupIndex + 1}`
            : `Failed group ${r.groupIndex + 1}`,
        });
      },
    });

    const state: ClaimState =
      submitResult.failedGroups.length > 0 ? "partial_failure" : "complete";
    setState(onStateChange, state);
    emitProgress(onProgress, {
      state,
      currentBatch: 0,
      totalBatches: 1,
      currentGroup: totalGroups,
      totalGroups,
      successfulGroups: submitResult.successfulTxIds.length,
      failedGroups: submitResult.failedGroups.length,
      progressPercent: 100,
      message:
        state === "complete"
          ? "All claim groups confirmed"
          : `${submitResult.failedGroups.length} group(s) failed`,
    });

    return {
      ...submitResult,
      state,
      signedGroups,
    };
  } catch (err) {
    if (err instanceof ClaimAllCancelledError) {
      setState(onStateChange, "idle");
      return {
        successfulTxIds: [],
        failedGroups: [],
        confirmedRounds: [],
        cancelled: true,
        state: "idle",
      };
    }
    if (isTransactionUserRejection(err)) {
      setState(onStateChange, "idle");
      return {
        successfulTxIds: [],
        failedGroups: [],
        confirmedRounds: [],
        cancelled: true,
        state: "idle",
      };
    }
    setState(onStateChange, "error");
    throw err;
  }
}

export interface ClaimAllFromEncodedGroupsOptions {
  encodedGroups: Uint8Array[][];
  signTransactions: ClaimAllRewardsOptions<unknown>["signTransactions"];
  algodClient: Algodv2;
  onProgress?: (progress: ClaimAllProgress) => void;
  onStateChange?: (state: ClaimState) => void;
  signal?: AbortSignal;
  waitRounds?: number;
}

/**
 * Claim All when atomic groups are already built (e.g. ulujs NFT drip `custom()` output).
 */
export async function claimAllFromEncodedGroups(
  options: ClaimAllFromEncodedGroupsOptions
): Promise<ClaimAllResult> {
  const signingBatches = createSigningBatchesFromEncoded(options.encodedGroups);

  const emptyResult: ClaimAllResult = {
    successfulTxIds: [],
    failedGroups: [],
    confirmedRounds: [],
    state: "complete",
  };

  if (signingBatches.length === 0) return emptyResult;

  const {
    algodClient,
    signTransactions,
    onProgress,
    onStateChange,
    signal,
    waitRounds = TX_CONFIRMATION_WAIT_ROUNDS,
  } = options;

  const totalGroups = options.encodedGroups.length;
  const totalBatches = signingBatches.length;

  try {
    setState(onStateChange, "awaiting_signature");

    emitProgress(onProgress, {
      state: "awaiting_signature",
      currentBatch: 0,
      totalBatches,
      currentGroup: 0,
      totalGroups,
      successfulGroups: 0,
      failedGroups: 0,
      message: "Approve transactions in your wallet",
    });

    if (signal?.aborted) throw new ClaimAllCancelledError();

    const { signedGroups, usedPerGroupFallback } = await signAllEncodedBatches(
      signingBatches,
      signTransactions,
      {
        shouldCancel: () => signal?.aborted === true,
        onBatchStart: (batchIndex, total) => {
          emitProgress(onProgress, {
            state: "awaiting_signature",
            currentBatch: batchIndex,
            totalBatches: total,
            currentGroup: signingBatches[batchIndex]?.startGroupIndex ?? 0,
            totalGroups,
            successfulGroups: 0,
            failedGroups: 0,
            message: `Signing batch ${batchIndex + 1} of ${total}`,
          });
        },
        onGroupStart: (groupIndex, total) => {
          emitProgress(onProgress, {
            state: "awaiting_signature",
            currentBatch: 0,
            totalBatches,
            currentGroup: groupIndex,
            totalGroups: total,
            successfulGroups: 0,
            failedGroups: 0,
            message: `Approve group ${groupIndex + 1} of ${total}`,
          });
        },
      }
    );

    if (usedPerGroupFallback && onProgress) {
      emitProgress(onProgress, {
        state: "awaiting_signature",
        currentBatch: totalBatches,
        totalBatches,
        currentGroup: totalGroups,
        totalGroups,
        successfulGroups: 0,
        failedGroups: 0,
        message: "Signed one atomic group per wallet approval",
      });
    }

    setState(onStateChange, "submitting");
    let successfulGroups = 0;
    let failedCount = 0;

    const submitResult = await submitSignedGroups({
      algod: algodClient,
      signedGroups,
      waitRounds,
      onGroupSubmitted: (r) => {
        if (r.txId) successfulGroups++;
        else failedCount++;
        emitProgress(onProgress, {
          state: "submitting",
          currentBatch: 0,
          totalBatches: 1,
          currentGroup: r.groupIndex,
          totalGroups,
          successfulGroups,
          failedGroups: failedCount,
        });
      },
    });

    const state: ClaimState =
      submitResult.failedGroups.length > 0 ? "partial_failure" : "complete";
    setState(onStateChange, state);

    return { ...submitResult, state, signedGroups };
  } catch (err) {
    if (err instanceof ClaimAllCancelledError || isTransactionUserRejection(err)) {
      setState(onStateChange, "idle");
      return { ...emptyResult, cancelled: true, state: "idle" };
    }
    setState(onStateChange, "error");
    throw err;
  }
}

/**
 * Retry submission for failed groups only (no resign if `preSignedGroups` provided).
 */
export async function retryFailedClaimGroups(
  options: ClaimAllRewardsOptions<unknown> & {
    failedGroupIndices: number[];
    preSignedGroups: Uint8Array[][];
  }
): Promise<ClaimAllResult> {
  return claimAllRewards({
    ...options,
    positions: [],
    buildTransactions: async () => [],
    retryGroupIndices: options.failedGroupIndices,
    preSignedGroups: options.preSignedGroups,
  });
}
