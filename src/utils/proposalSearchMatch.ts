import type { Proposal } from "@/types/governanceTypes";
import { PROPOSAL_CATEGORY_DISPLAY_NAMES } from "@/constants/governanceConstants";

/** Case-insensitive substring match across common proposal fields (loaded proposals only). */
export function proposalMatchesSearch(proposal: Proposal, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    proposal.title,
    proposal.description,
    proposal.id,
    proposal.proposer,
    PROPOSAL_CATEGORY_DISPLAY_NAMES[proposal.category],
    proposal.status,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
