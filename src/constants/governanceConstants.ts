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
