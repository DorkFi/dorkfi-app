/**
 * On-chain submission for Claim All.
 *
 * Each atomic group is broadcast with `sendRawTransaction(group)` and confirmed independently.
 * A failure in one group does not prevent submitting later groups (partial failure handling).
 */

import algosdk, { type Algodv2 } from "algosdk";
import { TX_CONFIRMATION_WAIT_ROUNDS } from "@/utils/transactionUtils";

export type GroupSubmitResult = {
  groupIndex: number;
  txId?: string;
  confirmedRound?: number;
  error?: string;
};

export type SubmitSignedGroupsOptions = {
  algod: Algodv2;
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
  const { algod, signedGroups, waitRounds = TX_CONFIRMATION_WAIT_ROUNDS, onlyGroupIndices, onGroupSubmitted } = options;
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
      const res = await algod.sendRawTransaction(group).do();
      const pending = await algosdk.waitForConfirmation(algod, res.txid, waitRounds);
      const round = pending.confirmedRound ?? 0;
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
