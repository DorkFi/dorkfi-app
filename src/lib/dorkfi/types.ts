/**
 * Shared types for DorkFi "Claim All" batching.
 *
 * Lifecycle: idle → building → awaiting_signature → submitting → complete | partial_failure | error
 */

/** Algorand protocol limit: transactions in one atomic group. */
export const MAX_TXNS_PER_GROUP = 16;

/**
 * Wallet signing batch limit: how many atomic groups to flatten into one `signTransactions` call.
 * Execution still submits each atomic group separately on-chain.
 */
export const MAX_GROUPS_PER_SIGNING = 16;

export type ClaimState =
  | "idle"
  | "building"
  | "awaiting_signature"
  | "submitting"
  | "complete"
  | "partial_failure"
  | "error";

export interface ClaimAllProgress {
  state: ClaimState;
  /** 0-based signing batch index (wallet popup). */
  currentBatch: number;
  totalBatches: number;
  /** 0-based atomic group index across the full run. */
  currentGroup: number;
  totalGroups: number;
  successfulGroups: number;
  failedGroups: number;
  /** 0–100 for UI progress bars. */
  progressPercent: number;
  message?: string;
}

export interface ClaimAllResult {
  successfulTxIds: string[];
  /** Global atomic group indices (0..totalGroups-1) that failed submission. */
  failedGroups: number[];
  confirmedRounds: number[];
  /** True if the user rejected a wallet signature. */
  cancelled?: boolean;
  /** Final state after the run. */
  state: ClaimState;
  /** Signed bytes per atomic group (for retry-failed submission). */
  signedGroups?: Uint8Array[][];
}

/** Metadata for one signing batch (subset of atomic groups). */
export interface SigningBatchPlan {
  /** Global index of the first atomic group in this batch. */
  startGroupIndex: number;
  /** Atomic groups included in this batch (each already has assignGroupID applied). */
  groups: import("algosdk").Transaction[][];
  /** Flattened txns passed to the wallet for this batch. */
  flat: import("algosdk").Transaction[];
  /** Txn count per atomic group within `flat`, in order. */
  groupSizes: number[];
}

/** Signing batch using raw unsigned bytes (from on-chain builders). */
export interface SigningBatchPlanEncoded {
  startGroupIndex: number;
  groups: Uint8Array[][];
  flat: Uint8Array[];
  groupSizes: number[];
}

/** Full plan after building and grouping, before signing. */
export interface ClaimAllPlan {
  /** All atomic groups in execution order. */
  groups: import("algosdk").Transaction[][];
  signingBatches: SigningBatchPlan[];
}

export type SignTransactionsFn = (
  txns: Uint8Array[]
) => Promise<Uint8Array | Uint8Array[] | (Uint8Array | null)[]>;

export interface ClaimAllRewardsOptions<TPosition> {
  /** Claimable positions/markets/NFTs — interpreted by `buildTransactions`. */
  positions: TPosition[];
  /** Build unsigned claim txns (app calls, ARC-200 transfers, payments, etc.). */
  buildTransactions: (positions: TPosition[]) => Promise<import("algosdk").Transaction[]>;
  signTransactions: SignTransactionsFn;
  algodClient: import("algosdk").Algodv2;
  onProgress?: (progress: ClaimAllProgress) => void;
  onStateChange?: (state: ClaimState) => void;
  /** Abort before the next wallet sign (checked between signing batches). */
  signal?: AbortSignal;
  waitRounds?: number;
  /**
   * When set, only submit these global group indices (retry failed groups).
   * Caller must supply already-signed bytes via `preSignedGroups`.
   */
  retryGroupIndices?: number[];
  preSignedGroups?: Uint8Array[][];
}
