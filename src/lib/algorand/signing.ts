/**
 * Wallet signing for Claim All batches.
 *
 * Signing batches flatten multiple atomic groups for fewer wallet popups. After signing, we
 * slice the signed byte array back into per-group chunks using `groupSizes` before submission.
 */

import algosdk from "algosdk";
import type {
  SignTransactionsFn,
  SigningBatchPlan,
  SigningBatchPlanEncoded,
} from "@/lib/dorkfi/types";
import { isInvalidGroupSignError } from "@/utils/errorUtils";

export function transactionsToBytes(txns: algosdk.Transaction[]): Uint8Array[] {
  return txns.map((t) => algosdk.encodeUnsignedTransaction(t));
}

export function normalizeSignedBytes(
  signed: Uint8Array | Uint8Array[] | (Uint8Array | null)[]
): Uint8Array[] {
  const arr = Array.isArray(signed) ? signed : [signed];
  return arr.map((t, i) => {
    if (t == null) {
      throw new Error(`Wallet returned null at signed transaction index ${i}`);
    }
    return t;
  });
}

/**
 * Reconstruct signed atomic groups from one flat signed array and per-group sizes.
 */
export function reconstructSignedGroups(
  signedFlat: Uint8Array[],
  groupSizes: number[]
): Uint8Array[][] {
  const expected = groupSizes.reduce((s, n) => s + n, 0);
  if (signedFlat.length !== expected) {
    throw new Error(
      `Signed length ${signedFlat.length} does not match expected ${expected} from group sizes`
    );
  }
  const out: Uint8Array[][] = [];
  let offset = 0;
  for (const size of groupSizes) {
    out.push(signedFlat.slice(offset, offset + size));
    offset += size;
  }
  return out;
}

export type SignBatchResult = {
  signedGroups: Uint8Array[][];
  /** True if we fell back to one wallet prompt per atomic group (batch sign rejected). */
  usedPerGroupFallback: boolean;
};

/**
 * Sign one signing batch. Tries flattened batch first; on Invalid Group (4300), signs each
 * atomic group in the batch separately.
 */
export async function signBatch(
  plan: SigningBatchPlan,
  signTransactions: SignTransactionsFn
): Promise<SignBatchResult> {
  const unsignedFlat = transactionsToBytes(plan.flat);

  try {
    const signedFlat = normalizeSignedBytes(await signTransactions(unsignedFlat));
    return {
      signedGroups: reconstructSignedGroups(signedFlat, plan.groupSizes),
      usedPerGroupFallback: false,
    };
  } catch (err) {
    if (!isInvalidGroupSignError(err) || plan.groups.length <= 1) {
      throw err;
    }
    const signedGroups: Uint8Array[][] = [];
    for (const group of plan.groups) {
      const bytes = transactionsToBytes(group);
      signedGroups.push(normalizeSignedBytes(await signTransactions(bytes)));
    }
    return { signedGroups, usedPerGroupFallback: true };
  }
}

/**
 * Sign every batch in order. `onBatchStart` runs before each wallet prompt (cancel check).
 */
export async function signAllBatches(
  batches: SigningBatchPlan[],
  signTransactions: SignTransactionsFn,
  options?: {
    onBatchStart?: (batchIndex: number, total: number) => void;
    shouldCancel?: () => boolean;
  }
): Promise<{ signedGroups: Uint8Array[][]; usedPerGroupFallback: boolean }> {
  const allSigned: Uint8Array[][] = [];
  let usedFallback = false;

  for (let i = 0; i < batches.length; i++) {
    if (options?.shouldCancel?.()) {
      throw new ClaimAllCancelledError();
    }
    options?.onBatchStart?.(i, batches.length);
    const batch = batches[i]!;
    const result = await signBatch(batch, signTransactions);
    allSigned.push(...result.signedGroups);
    if (result.usedPerGroupFallback) usedFallback = true;
  }

  return { signedGroups: allSigned, usedPerGroupFallback: usedFallback };
}

/**
 * Sign one encoded batch. Uses raw ulujs bytes (no decode). Multi-group batches sign
 * one atomic group per wallet call — Lute/Pera reject flattened multi-group (4300).
 */
export async function signEncodedBatch(
  plan: SigningBatchPlanEncoded,
  signTransactions: SignTransactionsFn
): Promise<SignBatchResult> {
  if (plan.groups.length > 1) {
    return signEachEncodedGroup(plan.groups, signTransactions);
  }

  try {
    const signedFlat = normalizeSignedBytes(await signTransactions(plan.flat));
    return {
      signedGroups: reconstructSignedGroups(signedFlat, plan.groupSizes),
      usedPerGroupFallback: false,
    };
  } catch (err) {
    if (!isInvalidGroupSignError(err)) throw err;
    return signEachEncodedGroup(plan.groups, signTransactions);
  }
}

async function signEachEncodedGroup(
  groups: Uint8Array[][],
  signTransactions: SignTransactionsFn
): Promise<SignBatchResult> {
  const signedGroups: Uint8Array[][] = [];
  for (const group of groups) {
    signedGroups.push(normalizeSignedBytes(await signTransactions(group)));
  }
  return { signedGroups, usedPerGroupFallback: groups.length > 1 };
}

/**
 * Sign pre-built encoded atomic groups (NFT drip / ulujs path).
 */
export async function signAllEncodedBatches(
  batches: SigningBatchPlanEncoded[],
  signTransactions: SignTransactionsFn,
  options?: {
    onBatchStart?: (batchIndex: number, total: number) => void;
    onGroupStart?: (groupIndex: number, totalGroups: number) => void;
    shouldCancel?: () => boolean;
  }
): Promise<{ signedGroups: Uint8Array[][]; usedPerGroupFallback: boolean }> {
  const allSigned: Uint8Array[][] = [];
  let usedFallback = false;
  let globalGroupIndex = 0;

  for (let i = 0; i < batches.length; i++) {
    if (options?.shouldCancel?.()) throw new ClaimAllCancelledError();
    options?.onBatchStart?.(i, batches.length);
    const batch = batches[i]!;

    if (batch.groups.length > 1) {
      for (const group of batch.groups) {
        if (options?.shouldCancel?.()) throw new ClaimAllCancelledError();
        options?.onGroupStart?.(globalGroupIndex, batches.reduce((n, b) => n + b.groups.length, 0));
        allSigned.push(normalizeSignedBytes(await signTransactions(group)));
        globalGroupIndex++;
        usedFallback = true;
      }
      continue;
    }

    const result = await signEncodedBatch(batch, signTransactions);
    allSigned.push(...result.signedGroups);
    globalGroupIndex += batch.groups.length;
    if (result.usedPerGroupFallback) usedFallback = true;
  }

  return { signedGroups: allSigned, usedPerGroupFallback: usedFallback };
}

export class ClaimAllCancelledError extends Error {
  constructor() {
    super("Claim All cancelled before signing");
    this.name = "ClaimAllCancelledError";
  }
}
