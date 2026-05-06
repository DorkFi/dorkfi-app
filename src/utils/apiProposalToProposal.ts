import type {
  Proposal,
  ProposalCategory,
  ProposalStatus,
} from "@/types/governanceTypes";
import { config, type NetworkId } from "@/config";
import {
  CATEGORY_ID_TO_CATEGORY,
  GOVERNANCE_PASS_THRESHOLD_YES_FRACTION,
  PROPOSAL_CATEGORY_DISPLAY_NAMES,
} from "@/constants/governanceConstants";

const VALID_CATEGORIES = new Set<ProposalCategory>([
  "interest-rates",
  "collateral-listing",
  "liquidation-settings",
  "treasury",
  "features",
  "governance",
  "infrastructure",
]);

function isNetworkIdConfigured(id: string): id is NetworkId {
  return id in config.networks;
}

function filterKnownNetworkIds(ids: unknown): NetworkId[] | undefined {
  if (!Array.isArray(ids)) return undefined;
  const out: NetworkId[] = [];
  for (const x of ids) {
    if (typeof x !== "string") continue;
    if (isNetworkIdConfigured(x)) out.push(x);
  }
  return out.length > 0 ? out : undefined;
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDateField(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v.length > 0) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeStatus(raw: unknown): ProposalStatus {
  if (typeof raw !== "string") return "pending";
  const s = raw.toLowerCase().trim() as ProposalStatus;
  if (
    s === "active" ||
    s === "passed" ||
    s === "rejected" ||
    s === "pending" ||
    s === "executed"
  ) {
    return s;
  }
  return "pending";
}

/**
 * After voting ends, align status with the ≥69% rule (on-chain style).
 * Uses `totalPowerOrVotesTotal` as denominator when it is a valid total (yes / total power),
 * otherwise for + against + abstain. Call for **both** power-based and count-only API rows so
 * an optimistic `passed` from the node is corrected when tallies disagree.
 */
export function deriveClosedStatusFromVoteCounts(
  status: ProposalStatus,
  end: Date,
  votesFor: number,
  votesAgainst: number,
  votesAbstain: number,
  totalPowerOrVotesTotal?: number | null
): ProposalStatus {
  if (status === "executed") return status;
  if (status === "pending") return status;

  if (!end || end.getTime() <= 0 || end.getTime() > Date.now()) {
    return status;
  }

  const abstain = Math.max(0, votesAbstain);
  const sum = votesFor + votesAgainst + abstain;
  const totalFromField =
    totalPowerOrVotesTotal != null &&
    Number.isFinite(totalPowerOrVotesTotal) &&
    totalPowerOrVotesTotal > 0
      ? totalPowerOrVotesTotal
      : 0;
  const denom =
    totalFromField > 0 && totalFromField + 1e-9 >= votesFor
      ? totalFromField
      : sum;

  if (denom <= 0) {
    if (status === "active") return "rejected";
    if (status === "passed") return "rejected";
    return status;
  }

  const met =
    votesFor >= denom * GOVERNANCE_PASS_THRESHOLD_YES_FRACTION;
  if (status === "active") {
    return met ? "passed" : "rejected";
  }
  if (status === "passed" || status === "rejected") {
    return met ? "passed" : "rejected";
  }
  return status;
}

function categoryFromContractId(id: number): ProposalCategory | undefined {
  return CATEGORY_ID_TO_CATEGORY[id as keyof typeof CATEGORY_ID_TO_CATEGORY];
}

/**
 * Resolves `ProposalCategory` from governance-node payloads (slug, display name, contract id, etc.).
 */
export function normalizeApiProposalCategory(
  record: Record<string, unknown>
): ProposalCategory {
  const idKeys = [
    "categoryId",
    "proposalCategoryId",
    "category_id",
    "proposal_category_id",
  ] as const;
  for (const key of idKeys) {
    const v = record[key];
    const n = parseNumber(v);
    if (n != null && Number.isInteger(n) && n >= 0) {
      const c = categoryFromContractId(n);
      if (c) return c;
    }
  }

  let catRaw: unknown =
    record.category ??
    record.type ??
    record.proposalType ??
    record.tag ??
    record.proposalCategory;

  if (typeof catRaw === "object" && catRaw !== null) {
    const o = catRaw as Record<string, unknown>;
    catRaw =
      o.slug ?? o.id ?? o.key ?? o.name ?? o.label ?? o.code ?? null;
  }

  if (typeof catRaw === "number" && Number.isInteger(catRaw)) {
    const c = categoryFromContractId(catRaw);
    if (c) return c;
  }

  if (typeof catRaw !== "string" || !catRaw.trim()) {
    return "governance";
  }

  const trimmed = catRaw.trim();
  const asSlug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");

  if (VALID_CATEGORIES.has(asSlug as ProposalCategory)) {
    return asSlug as ProposalCategory;
  }

  const tl = trimmed.toLowerCase();
  for (const [cat, label] of Object.entries(
    PROPOSAL_CATEGORY_DISPLAY_NAMES
  ) as [ProposalCategory, string][]) {
    if (label.toLowerCase() === tl) return cat;
  }

  return "governance";
}

/**
 * Maps a loose governance-node proposal record into the UI `Proposal` shape.
 */
export function apiRecordToProposal(record: Record<string, unknown>): Proposal {
  const idRaw =
    record.id ?? record.proposalId ?? record.uuid ?? record.slug ?? "";
  const id = String(idRaw);

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : id
        ? `Proposal ${id.slice(0, 12)}${id.length > 12 ? "…" : ""}`
        : "Untitled proposal";

  const description =
    typeof record.description === "string"
      ? record.description
      : typeof record.summary === "string"
        ? record.summary
        : "";

  const category = normalizeApiProposalCategory(record);

  const proposer =
    typeof record.proposer === "string" && record.proposer
      ? record.proposer
      : typeof record.author === "string" && record.author
        ? record.author
        : "—";

  const startTime =
    parseDateField(record.votingStart) ??
    parseDateField(record.startDate) ??
    parseDateField(record.createdAt) ??
    new Date(0);

  const endTime =
    parseDateField(record.votingEnd) ??
    parseDateField(record.endDate) ??
    parseDateField(record.votingEndTime) ??
    new Date(0);

  let status = normalizeStatus(record.status);
  const totalPowerRaw =
    parseNumber(record.proposalTotalPower) ??
    parseNumber(record.totalPower) ??
    null;
  const yesPowerRaw =
    parseNumber(record.proposalYesPower) ??
    parseNumber(record.votesFor) ??
    null;

  let votesFor = parseNumber(record.votesFor) ?? 0;
  let votesAgainst = parseNumber(record.votesAgainst) ?? 0;
  let totalVotes = parseNumber(record.totalVotes);

  if (totalPowerRaw != null && yesPowerRaw != null) {
    totalVotes = totalPowerRaw / 1e8;
    votesFor = yesPowerRaw / 1e8;
    votesAgainst = Math.max(0, totalVotes - votesFor);
  } else if (totalVotes == null || !Number.isFinite(totalVotes)) {
    totalVotes = votesFor + votesAgainst;
  }

  if (!Number.isFinite(totalVotes) || totalVotes < 0) totalVotes = 0;
  if (!Number.isFinite(votesFor) || votesFor < 0) votesFor = 0;
  if (!Number.isFinite(votesAgainst) || votesAgainst < 0) votesAgainst = 0;

  const votesAbstain =
    parseNumber(record.votesAbstain) ??
    parseNumber(record.votes_abstain) ??
    0;
  const usedPowerPath = totalPowerRaw != null && yesPowerRaw != null;
  status = deriveClosedStatusFromVoteCounts(
    status,
    endTime,
    votesFor,
    votesAgainst,
    votesAbstain,
    totalVotes
  );

  let quorum = parseNumber(record.quorum) ?? parseNumber(record.quorumThreshold) ?? 0;
  if (!Number.isFinite(quorum) || quorum <= 0) {
    quorum = Math.max(1, totalVotes || 1);
  }

  const networkIds =
    filterKnownNetworkIds(record.networkIds) ??
    (typeof record.networkId === "string" && isNetworkIdConfigured(record.networkId)
      ? [record.networkId]
      : undefined);

  const singleNetwork =
    typeof record.networkId === "string" && isNetworkIdConfigured(record.networkId)
      ? record.networkId
      : networkIds?.length === 1
        ? networkIds[0]
        : undefined;

  return {
    id,
    title,
    description,
    category,
    proposer,
    status,
    votesFor,
    votesAgainst,
    totalVotes,
    quorum,
    startTime,
    endTime,
    details: {
      type: "governance",
      description: description || title,
    },
    ...(usedPowerPath ? { usesVotingPowerTally: true as const } : {}),
    ...(networkIds && networkIds.length > 1
      ? { networkIds, networkId: undefined as undefined }
      : singleNetwork
        ? { networkId: singleNetwork, networkIds: [singleNetwork] }
        : {}),
  };
}
