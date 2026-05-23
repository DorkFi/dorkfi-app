import algosdk, { type Algodv2 } from "algosdk";
import { abi, CONTRACT } from "ulujs";
import type { UnitNftDripCampaignConfig } from "@/config/nftDrips";

const ONE_WEEK_SECONDS = 7 * 24 * 3600;

/** Algorand atomic transaction group size limit. */
export const ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP = 16;

export { MAX_TXNS_PER_GROUP, MAX_GROUPS_PER_SIGNING } from "@/lib/dorkfi/types";
export type { ClaimAllProgress, ClaimAllResult, ClaimState } from "@/lib/dorkfi/types";
export { claimAllFromEncodedGroups, claimAllRewards, retryFailedClaimGroups } from "@/lib/dorkfi/claimAll";

/** Max NFTs per wallet claim (Nautilus-style single `custom()` group). */
export const NFT_DRIP_CLAIMS_PER_GROUP = 6;
/** @deprecated Use {@link NFT_DRIP_CLAIMS_PER_GROUP}. */
export const NFT_DRIP_MAX_CLAIMS_PER_SESSION = NFT_DRIP_CLAIMS_PER_GROUP;

export type NftDripInfo = {
  collectionId: number;
  tokenId: string;
  lastDripTimestamp: number;
  claimAmount: number;
  maxClaimAmount: number;
  availableClaimAmount: number;
  claimableAmount: number;
};

export type NftDripClaimTarget = {
  contractId: number;
  tokenId: string;
  claimableAmount: number;
  config: UnitNftDripCampaignConfig;
};

function toNum(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function computeClaimableAmount(
  lastDripTimestamp: number,
  availableClaimAmount: number,
  dripPerWeekRaw: number
): number {
  if (availableClaimAmount <= 0) return 0;
  if (lastDripTimestamp <= 0) return availableClaimAmount;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, nowSeconds - lastDripTimestamp);
  const accrued = (elapsed / ONE_WEEK_SECONDS) * dripPerWeekRaw;
  const amountDivisible = Math.floor(accrued / dripPerWeekRaw) * dripPerWeekRaw;
  return Math.min(amountDivisible, availableClaimAmount);
}

export async function readNftDripInfo(
  cfg: UnitNftDripCampaignConfig,
  nftContractId: number,
  tokenId: string,
  owner: string,
  algod: Algodv2
): Promise<NftDripInfo | null> {
  if (!cfg.dripContractId) return null;

  const tryDrip = async (readonly: boolean): Promise<NftDripInfo | null> => {
    const CONTRACT_CI = new CONTRACT(
      cfg.dripContractId,
      algod,
      undefined,
      {
        name: "drip",
        desc: "drip",
        methods: [
          {
            name: "drip",
            args: [
              { type: "uint64", name: "collection_id" },
              { type: "uint256", name: "token_id" },
            ],
            readonly,
            returns: { type: "(uint64,uint256,uint64,uint256,uint256)" },
          },
        ],
        events: [],
      },
      { addr: owner, sk: new Uint8Array(0) }
    );
    const result = await CONTRACT_CI.drip(Number(nftContractId), Number(tokenId));
    if (!result.success) return null;
    const rv = result.returnValue;
    if (rv === undefined || rv === null) return null;
    const r = rv as Record<number, unknown>;
    const claimAmount = toNum(r[3]);
    const maxClaimAmount = toNum(r[4]);
    const lastDripTimestamp = toNum(r[2]);
    const availableClaimAmount = Math.max(0, maxClaimAmount - claimAmount);
    const claimableAmount = computeClaimableAmount(
      lastDripTimestamp,
      availableClaimAmount,
      cfg.dripPerWeekRaw
    );
    return {
      collectionId: toNum(r[0]),
      tokenId: r[1] != null ? String(r[1]) : tokenId,
      lastDripTimestamp,
      claimAmount,
      maxClaimAmount,
      availableClaimAmount,
      claimableAmount,
    };
  };

  try {
    const info = await tryDrip(true);
    if (info !== null) return info;
    return await tryDrip(false);
  } catch {
    return null;
  }
}

function errorMessageChain(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" ");
}

function isOversizedAtomicGroupBuildError(err: unknown): boolean {
  const msg = errorMessageChain(err);
  return (
    /max group size is 16/i.test(msg) ||
    /grouped together but max/i.test(msg) ||
    /transaction group limit/i.test(msg)
  );
}

function throwOversizedClaimBatchError(targetCount: number): never {
  throw new Error(
    `${targetCount} claims exceed the ${ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP}-transaction atomic group limit`
  );
}

/** True when ulujs can build this slice as one atomic group (≤16 txns). */
async function claimSliceFitsOneAtomicGroup(
  cfg: UnitNftDripCampaignConfig,
  slice: NftDripClaimTarget[],
  ownerAddress: string,
  algod: Algodv2,
  maxTxnsPerGroup = ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP
): Promise<boolean> {
  try {
    const built = await buildNftDripClaimGroupBytes(cfg, slice, ownerAddress, algod);
    return built.length > 0 && built.length <= maxTxnsPerGroup;
  } catch (err) {
    if (isOversizedAtomicGroupBuildError(err)) return false;
    throw err;
  }
}

/**
 * Splits claims into multiple on-chain groups (each ≤16 txns via separate `custom()` builds).
 */
export async function chunkClaimTargetsByTxnLimit(
  cfg: UnitNftDripCampaignConfig,
  targets: NftDripClaimTarget[],
  ownerAddress: string,
  algod: Algodv2,
  maxTxnsPerGroup = ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP
): Promise<{ chunks: NftDripClaimTarget[][]; builtGroups: Uint8Array[][] }> {
  if (targets.length === 0) return { chunks: [], builtGroups: [] };

  const soloFits = await claimSliceFitsOneAtomicGroup(
    cfg,
    [targets[0]!],
    ownerAddress,
    algod,
    maxTxnsPerGroup
  );
  if (!soloFits) {
    throw new Error(
      `NFT #${targets[0]!.tokenId} exceeds the ${maxTxnsPerGroup}-transaction atomic group limit`
    );
  }

  let txnsPerAdditionalClaim = 1;
  if (targets.length >= 2) {
    const twoFits = await claimSliceFitsOneAtomicGroup(
      cfg,
      targets.slice(0, 2),
      ownerAddress,
      algod,
      maxTxnsPerGroup
    );
    if (twoFits) {
      const oneGroup = await buildNftDripClaimGroupBytes(cfg, [targets[0]!], ownerAddress, algod);
      const twoGroup = await buildNftDripClaimGroupBytes(
        cfg,
        targets.slice(0, 2),
        ownerAddress,
        algod
      );
      txnsPerAdditionalClaim = Math.max(1, twoGroup.length - oneGroup.length);
    }
  }

  let estimatedMaxClaims = 1;
  const oneLen = (await buildNftDripClaimGroupBytes(cfg, [targets[0]!], ownerAddress, algod)).length;
  let estimatedTotal = oneLen;
  while (estimatedTotal + txnsPerAdditionalClaim <= maxTxnsPerGroup) {
    estimatedTotal += txnsPerAdditionalClaim;
    estimatedMaxClaims++;
  }

  const chunks: NftDripClaimTarget[][] = [];
  const builtGroups: Uint8Array[][] = [];
  let index = 0;
  while (index < targets.length) {
    let size = Math.min(estimatedMaxClaims, targets.length - index);
    let placed = false;
    while (size >= 1) {
      const slice = targets.slice(index, index + size);
      const fits = await claimSliceFitsOneAtomicGroup(
        cfg,
        slice,
        ownerAddress,
        algod,
        maxTxnsPerGroup
      );
      if (fits) {
        const built = await buildNftDripClaimGroupBytes(cfg, slice, ownerAddress, algod);
        chunks.push(slice);
        builtGroups.push(built);
        index += size;
        placed = true;
        break;
      }
      size--;
    }
    if (!placed) {
      const t = targets[index]!;
      throw new Error(
        `Could not fit NFT #${t.tokenId} into a valid transaction group (max ${maxTxnsPerGroup} per group)`
      );
    }
  }
  return { chunks, builtGroups };
}

export type NftDripClaimSigningBundle = {
  /** All unsigned txns in wallet order (multiple atomic groups concatenated). */
  unsignedFlat: Uint8Array[];
  /** Txn count per on-chain atomic group. */
  groupSizes: number[];
  /** Every target included across all groups. */
  targetsForSign: NftDripClaimTarget[];
  /** Wallet-ready bytes per on-chain group (used if batch sign fails). */
  preparedGroups: Uint8Array[][];
};

/**
 * Use ulujs `custom()` bytes as-is (do not re-assign group id — that breaks signing with 4300).
 */
export function flattenBuiltGroupsForSigning(builtGroups: Uint8Array[][]): Pick<
  NftDripClaimSigningBundle,
  "unsignedFlat" | "groupSizes" | "preparedGroups"
> {
  const preparedGroups: Uint8Array[][] = [];
  const groupSizes: number[] = [];
  const unsignedFlat: Uint8Array[] = [];

  for (const groupBytes of builtGroups) {
    if (groupBytes.length > ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP) {
      throw new Error(
        `Transaction group has ${groupBytes.length} transactions (max ${ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP})`
      );
    }
    preparedGroups.push(groupBytes);
    groupSizes.push(groupBytes.length);
    unsignedFlat.push(...groupBytes);
  }
  return { unsignedFlat, groupSizes, preparedGroups };
}

export async function buildNftDripClaimSigningBundle(
  cfg: UnitNftDripCampaignConfig,
  targets: NftDripClaimTarget[],
  ownerAddress: string,
  algod: Algodv2
): Promise<NftDripClaimSigningBundle> {
  if (targets.length === 0) {
    return { unsignedFlat: [], groupSizes: [], targetsForSign: [], preparedGroups: [] };
  }
  if (targets.length > NFT_DRIP_CLAIMS_PER_GROUP) {
    throw new Error(
      `At most ${NFT_DRIP_CLAIMS_PER_GROUP} NFTs per claim (got ${targets.length})`
    );
  }

  // Never pass the full claim list into one `custom()` probe — ulujs simulates all extra txns
  // together and throws "168 transactions grouped together but max group size is 16".
  // Only try the Nautilus single-group path for small selections.
  if (targets.length <= NFT_DRIP_CLAIMS_PER_GROUP) {
    try {
      if (await claimSliceFitsOneAtomicGroup(cfg, targets, ownerAddress, algod)) {
        const built = await buildNftDripClaimGroupBytes(cfg, targets, ownerAddress, algod);
        const flat = flattenBuiltGroupsForSigning([built]);
        return { ...flat, targetsForSign: targets };
      }
    } catch (err) {
      if (!isOversizedAtomicGroupBuildError(err)) throw err;
    }
  }

  const { chunks, builtGroups } = await chunkClaimTargetsByTxnLimit(
    cfg,
    targets,
    ownerAddress,
    algod
  );
  const flat = flattenBuiltGroupsForSigning(builtGroups);
  return {
    ...flat,
    targetsForSign: chunks.flat(),
  };
}

export type SignTransactionsFn = import("@/lib/dorkfi/types").SignTransactionsFn;

/** Build one atomic claim group (same reward token + drip app). Caller must keep ≤16 txns. */
export async function buildNftDripClaimGroupBytes(
  cfg: UnitNftDripCampaignConfig,
  targets: NftDripClaimTarget[],
  ownerAddress: string,
  algod: Algodv2
): Promise<Uint8Array[]> {
  if (targets.length === 0) throw new Error("No NFTs to claim");

  const sym = cfg.rewardSymbol;
  const ci = new CONTRACT(
    cfg.rewardTokenContractId,
    algod,
    undefined,
    abi.custom,
    { addr: ownerAddress, sk: new Uint8Array(0) }
  );
  const builder = {
    drip: new CONTRACT(
      cfg.dripContractId,
      algod,
      undefined,
      {
        name: "drip",
        desc: "drip",
        methods: [
          {
            name: "claim",
            args: [
              { type: "uint64", name: "collection_id" },
              { type: "uint256", name: "token_id" },
            ],
            readonly: false,
            returns: { type: "uint256" },
          },
        ],
        events: [],
      },
      { addr: ownerAddress, sk: new Uint8Array(0) },
      true,
      false,
      true
    ),
  };

  const buildN: Record<string, unknown>[] = [];
  let i = 0;
  for (const t of targets) {
    const txnO = (await builder.drip.claim(Number(t.contractId), Number(t.tokenId))).obj;
    buildN.push({
      ...txnO,
      payment: 1e6 - 7000 + i++,
      note: new TextEncoder().encode(`claim ${sym} from ${t.contractId}-${t.tokenId}`),
    });
  }
  if (buildN.length === 0) throw new Error("Failed to build claim transaction(s)");
  ci.setExtraTxns(buildN);
  ci.setEnableGroupResourceSharing(true);
  ci.setFee(4000);

  let customR: { success: boolean; txns?: string[] };
  try {
    customR = await ci.custom();
  } catch (err) {
    if (isOversizedAtomicGroupBuildError(err)) throwOversizedClaimBatchError(targets.length);
    throw err;
  }

  if (!customR.success || !Array.isArray(customR.txns)) {
    if (targets.length > 1) throwOversizedClaimBatchError(targets.length);
    throw new Error("Failed to build claim transaction(s)");
  }
  if (customR.txns.length > ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP) {
    throwOversizedClaimBatchError(targets.length);
  }
  return (customR.txns as string[]).map((txn) => Uint8Array.from(Buffer.from(txn, "base64")));
}

export function formatDripRewardAmount(raw: number, decimals: number): string {
  const div = 10 ** decimals;
  return (raw / div).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 8),
  });
}
