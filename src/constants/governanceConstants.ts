import { ProposalCategory } from "@/types/governanceTypes";

/**
 * Governance proposal category ID mapping
 * Maps category strings to numeric IDs used by the governance contract
 */
export const PROPOSAL_CATEGORY_IDS: Record<ProposalCategory, number> = {
  "interest-rates": 1,
  "collateral-listing": 2,
  "liquidation-settings": 3,
  "treasury": 4,
  "features": 5,
  "governance": 6,
  "infrastructure": 7,
};

/**
 * Reverse mapping: category ID to category string
 */
export const CATEGORY_ID_TO_CATEGORY: Record<number, ProposalCategory> = {
  1: "interest-rates",
  2: "collateral-listing",
  3: "liquidation-settings",
  4: "treasury",
  5: "features",
  6: "governance",
  7: "infrastructure",
};

/**
 * Display names for Admin UI and proposal cards
 * Value (ID) → Display name
 */
export const PROPOSAL_CATEGORY_DISPLAY_NAMES: Record<ProposalCategory, string> = {
  "interest-rates": "Interest Rates",
  "collateral-listing": "Collateral Listing",
  "liquidation-settings": "Liquidation Settings",
  "treasury": "Treasury",
  "features": "Features",
  "governance": "Governance",
  "infrastructure": "Infrastructure",
};

/**
 * Get the category ID for a given category string
 */
export const getCategoryId = (category: ProposalCategory): number => {
  return PROPOSAL_CATEGORY_IDS[category];
};

/**
 * Get the category string for a given category ID
 */
export const getCategoryFromId = (categoryId: number): ProposalCategory | undefined => {
  return CATEGORY_ID_TO_CATEGORY[categoryId];
};

/**
 * Minimum fraction of total voting power in the tally that must be "yes" for a proposal to pass
 * when we derive passed/rejected from on-chain power after voting ends (contract may still show active).
 * Aligns with protocol rules — see dorkfi-app#215.
 */
export const GOVERNANCE_PASS_THRESHOLD_YES_FRACTION = 0.69;

/** Human-readable threshold for governance UI copy. */
export const GOVERNANCE_PASS_THRESHOLD_DISPLAY = "69%";

/**
 * Proposal IDs to hide from the governance UI (e.g. test or invalid proposals).
 * Use full 64-char hex; comparison is normalized (lowercase, padded to 64).
 */
export const GOVERNANCE_PROPOSAL_BLACKLIST: string[] = [
  "4a6c554441c0412819991dbd14fe8597074ab188ad8efe0fe66aca63b6c5476f", // Reward WAD/USDC LP Holders proposal with errors
  "358c2ec4acd829f644965a3be92e0d8702f538a5d653dd009b3deb61b2cb64d0", // Reward WAD/USDC LP Holders proposal with errors
];

/**
 * Normalize proposal ID for blacklist comparison (lowercase, 64-char hex).
 */
const normalizeProposalId = (id: string): string => {
  const hex = (id.startsWith("0x") ? id.slice(2) : id).toLowerCase();
  return hex.padStart(64, "0").slice(-64);
};

/**
 * Returns true if the proposal should be hidden from the governance list.
 */
export const isProposalBlacklisted = (proposalId: string): boolean => {
  const normalized = normalizeProposalId(proposalId);
  return GOVERNANCE_PROPOSAL_BLACKLIST.some(
    (b) => normalizeProposalId(b) === normalized
  );
};
