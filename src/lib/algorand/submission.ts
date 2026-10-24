/**
 * On-chain submission for Claim All.
 *
 * Each atomic group is broadcast with `sendRawTransaction(group)` and confirmed independently.
 * A failure in one group does not prevent submitting later groups (partial failure handling).
 */

import algosdk, { type Algodv2, type Indexer } from "algosdk";
import { TX_CONFIRMATION_WAIT_ROUNDS } from "@/utils/transactionUtils";

const INDEXER_CONFIRM_POLL_MS = 2000;

function assertSignedAtomicGroup(group: Uint8Array[]): void {
  if (group.length <= 1) return;
  const groupIds = group.map((bytes) => {
    const tx = algosdk.decodeSignedTransaction(bytes).txn;
    if (!tx.group || tx.group.length === 0) return "";
    return Buffer.from(tx.group).toString("base64");
  });
  const head = groupIds[0];
  if (groupIds.some((id) => id !== head)) {
    throw new Error(
      "Wallet returned mismatched group IDs for one atomic transfer. Refresh and try again, or bridge one NFT at a time."
    );
  }
}

/** Voi public algod often blocks pending-txn reads; indexer confirms after a successful broadcast. */
async function waitForConfirmationViaIndexer(
  indexer: Indexer,
  txid: string,
  waitRounds: number
): Promise<number> {
  const deadline = Date.now() + waitRounds * 3500;
  while (Date.now() < deadline) {
    try {
      const res = (await indexer.lookupTransactionByID(txid).do()) as {
        transaction?: { "confirmed-round"?: number };
      };
      const round = res.transaction?.["confirmed-round"];
      if (round != null && round > 0) return round;
    } catch {
      // not indexed yet
    }
    await new Promise((resolve) => setTimeout(resolve, INDEXER_CONFIRM_POLL_MS));
  }
  throw new Error(`Transaction not confirmed after ${waitRounds} rounds`);
}

async function confirmSubmittedGroup(
  algod: Algodv2,
  txid: string,
  waitRounds: number,
  indexer?: Indexer
): Promise<number> {
  try {
    const pending = await algosdk.waitForConfirmation(algod, txid, waitRounds);
    return pending.confirmedRound ?? 0;
  } catch (algodErr) {
    if (!indexer) throw algodErr;
    try {
      return await waitForConfirmationViaIndexer(indexer, txid, waitRounds);
    } catch (indexerErr) {
      const algodMsg =
        algodErr instanceof Error ? algodErr.message : String(algodErr);
      const indexerMsg =
        indexerErr instanceof Error ? indexerErr.message : String(indexerErr);
      throw new Error(
        `${algodMsg}${indexerMsg !== algodMsg ? ` (indexer: ${indexerMsg})` : ""}`
      );
    }
  }
}

export type GroupSubmitResult = {
  groupIndex: number;
  txId?: string;
  confirmedRound?: number;
  error?: string;
};

export type SubmitSignedGroupsOptions = {
  algod: Algodv2;
  /** When algod pending/wait endpoints are restricted, confirm via indexer after broadcast. */
  indexer?: Indexer;
  signedGroups: Uint8Array[][];
  waitRounds?: number;
  /** Only submit these global group indices (retry mode). */
  onlyGroupIndices?: number[];
  onGroupSubmitted?: (result: GroupSubmitResult) => void;
};

/**
 * Submit signed atomic groups independently; continue after individual failures.
 */
export async function submitSignedGroups(
  options: SubmitSignedGroupsOptions
): Promise<{
  successfulTxIds: string[];
  failedGroups: number[];
  confirmedRounds: number[];
}> {
  const {
    algod,
    indexer,
    signedGroups,
    waitRounds = TX_CONFIRMATION_WAIT_ROUNDS,
    onlyGroupIndices,
    onGroupSubmitted,
  } = options;
  const indices =
    onlyGroupIndices ?? signedGroups.map((_, i) => i);

  const successfulTxIds: string[] = [];
  const failedGroups: number[] = [];
  const confirmedRounds: number[] = [];

  for (const groupIndex of indices) {
    const group = signedGroups[groupIndex];
    if (!group?.length) {
      failedGroups.push(groupIndex);
      onGroupSubmitted?.({
        groupIndex,
        error: "Missing signed transaction group",
      });
      continue;
    }

    try {
      assertSignedAtomicGroup(group);
      const res = await algod.sendRawTransaction(group).do();
      const round = await confirmSubmittedGroup(
        algod,
        res.txid,
        waitRounds,
        indexer
      );
      successfulTxIds.push(res.txid);
      if (round > 0) confirmedRounds.push(round);
      onGroupSubmitted?.({ groupIndex, txId: res.txid, confirmedRound: round });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failedGroups.push(groupIndex);
      onGroupSubmitted?.({ groupIndex, error: message });
    }
  }

  return { successfulTxIds, failedGroups, confirmedRounds };
}
