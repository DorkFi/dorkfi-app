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
