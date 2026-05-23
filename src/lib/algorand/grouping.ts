/**
 * Algorand transaction grouping for Claim All.
 *
 * ## Atomic groups (execution)
 * On-chain, up to {@link MAX_TXNS_PER_GROUP} transactions share one group ID and succeed or fail
 * together. A single ARC-200 claim path may expand to several txns (opt-in, app call, transfer).
 *
 * ## Signing batches (wallet)
 * Wallets sign bytes, not "logical claims". We may flatten up to {@link MAX_GROUPS_PER_SIGNING}
 * atomic groups into one `signTransactions` call to reduce popups. That batch is NOT one atomic
 * group — each subgroup keeps its own group ID and is submitted separately after signing.
 */

import algosdk from "algosdk";
import { MAX_GROUPS_PER_SIGNING, MAX_TXNS_PER_GROUP } from "@/lib/dorkfi/types";
import type { SigningBatchPlan, SigningBatchPlanEncoded } from "@/lib/dorkfi/types";

/** Split an array into fixed-size chunks (last chunk may be smaller). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Partition flat transactions into atomic groups (≤ {@link MAX_TXNS_PER_GROUP} each)
 * and assign a fresh group ID per chunk.
 */
export function groupTransactions(txns: algosdk.Transaction[]): algosdk.Transaction[][] {
  if (txns.length === 0) return [];
  const chunks = chunk(txns, MAX_TXNS_PER_GROUP);
  return chunks.map((group) => {
    const copy = group.map((t) =>
      algosdk.decodeUnsignedTransaction(algosdk.encodeUnsignedTransaction(t))
    );
    algosdk.assignGroupID(copy);
    return copy;
  });
}

/** Decode encoded groups produced by external builders (e.g. ulujs `custom()`). */
export function decodeTransactionGroups(encodedGroups: Uint8Array[][]): algosdk.Transaction[][] {
  return encodedGroups.map((groupBytes) =>
    groupBytes.map((b) => algosdk.decodeUnsignedTransaction(b))
  );
}

/** Encode atomic groups for wallet / algod submission. */
export function encodeTransactionGroups(groups: algosdk.Transaction[][]): Uint8Array[][] {
  return groups.map((group) =>
    group.map((txn) => algosdk.encodeUnsignedTransaction(txn))
  );
}

/**
 * Assign group IDs only when needed (ulujs `custom()` groups are often already valid).
 */
export function ensureAtomicGroups(groups: algosdk.Transaction[][]): algosdk.Transaction[][] {
  return groups.map((group) => {
    if (group.length > MAX_TXNS_PER_GROUP) {
      throw new Error(
        `Atomic group has ${group.length} transactions (max ${MAX_TXNS_PER_GROUP})`
      );
    }
    if (group.length <= 1) return group;
    const expected = algosdk.computeGroupID(group);
    const valid =
      !isZeroGroup(expected) &&
      group.every((t) => t.group && Buffer.compare(t.group, expected) === 0);
    if (valid) return group;
    const copy = group.map((t) =>
      algosdk.decodeUnsignedTransaction(algosdk.encodeUnsignedTransaction(t))
    );
    algosdk.assignGroupID(copy);
    return copy;
  });
}

function isZeroGroup(group: Uint8Array): boolean {
  return group.every((b) => b === 0);
}

/**
 * Build wallet signing batches: up to {@link MAX_GROUPS_PER_SIGNING} atomic groups flattened
 * per batch. Returns one flat array per batch (what you pass to `signTransactions`).
 */
export function createSigningBatches(
  groups: algosdk.Transaction[][]
): SigningBatchPlan[] {
  if (groups.length === 0) return [];

  const groupBatches = chunk(groups, MAX_GROUPS_PER_SIGNING);
  const plans: SigningBatchPlan[] = [];
  let startGroupIndex = 0;

  for (const batchGroups of groupBatches) {
    const groupSizes = batchGroups.map((g) => g.length);
    const flat = batchGroups.flat();
    plans.push({
      startGroupIndex,
      groups: batchGroups,
      flat,
      groupSizes,
    });
    startGroupIndex += batchGroups.length;
  }
  return plans;
}

/** Full plan: atomic groups + signing batches. */
export function createClaimAllPlan(groups: algosdk.Transaction[][]): {
  groups: algosdk.Transaction[][];
  signingBatches: SigningBatchPlan[];
} {
  const normalized = ensureAtomicGroups(groups);
  return {
    groups: normalized,
    signingBatches: createSigningBatches(normalized),
  };
}

/**
 * Signing batches from pre-built encoded groups (e.g. ulujs `custom()`).
 * Does not decode/re-encode — preserves wallet-valid group bytes.
 */
export function createSigningBatchesFromEncoded(
  encodedGroups: Uint8Array[][]
): SigningBatchPlanEncoded[] {
  if (encodedGroups.length === 0) return [];

  for (const group of encodedGroups) {
    if (group.length > MAX_TXNS_PER_GROUP) {
      throw new Error(
        `Atomic group has ${group.length} transactions (max ${MAX_TXNS_PER_GROUP})`
      );
    }
  }

  const groupBatches = chunk(encodedGroups, MAX_GROUPS_PER_SIGNING);
  const plans: SigningBatchPlanEncoded[] = [];
  let startGroupIndex = 0;

  for (const batchGroups of groupBatches) {
    const groupSizes = batchGroups.map((g) => g.length);
    plans.push({
      startGroupIndex,
      groups: batchGroups,
      flat: batchGroups.flat(),
      groupSizes,
    });
    startGroupIndex += batchGroups.length;
  }
  return plans;
}
