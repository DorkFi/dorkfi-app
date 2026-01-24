import { Proposal as UIProposal, ProposalStatus, ProposalCategory } from "@/types/governanceTypes";
import { Proposal as ServiceProposal } from "@/services/governanceService";
import { getCategoryFromId } from "@/constants/governanceConstants";

/**
 * Converts a service Proposal (from governance contract) to UI Proposal format
 * @param serviceProposal The proposal data from the governance service
 * @param proposalId The proposal ID (hex string)
 * @returns UI Proposal object
 */
export const convertServiceProposalToUI = (
  serviceProposal: ServiceProposal,
  proposalId: string
): UIProposal => {
  // Map proposal status from number to ProposalStatus type
  // Status mapping: 0 = pending, 1 = active, 2 = passed, 3 = rejected, 4 = executed
  const statusMap: Record<string, ProposalStatus> = {
    "0": "pending",
    "1": "active",
    "2": "passed",
    "3": "rejected",
    "4": "executed",
  };
  const status = statusMap[serviceProposal.proposalStatus] || "pending";

  // Get category
  const categoryId = Number(serviceProposal.proposalCategoryId);
  const category = getCategoryFromId(categoryId) || "features";

  // Calculate votes
  const totalVotes = Number(serviceProposal.proposalTotalVotes);
  const yesVotes = Number(serviceProposal.proposalYesVotes);
  const votesAgainst = totalVotes - yesVotes;
  const quorum = Number(serviceProposal.proposalQuorumThreshold);

  // Parse timestamps (they're in seconds)
  const startTime = new Date(Number(serviceProposal.votingStartTimestamp) * 1000);
  const endTime = new Date(Number(serviceProposal.votingEndTimestamp) * 1000);
  const executionTime =
    serviceProposal.executedAtTimestamp && serviceProposal.executedAtTimestamp !== "0"
      ? new Date(Number(serviceProposal.executedAtTimestamp) * 1000)
      : undefined;

  return {
    id: proposalId,
    title: serviceProposal.proposalTitle?.replace(/\0/g, "").trim() || "Untitled Proposal",
    description: serviceProposal.proposalDescription?.replace(/\0/g, "").trim() || "",
    category: category as ProposalCategory,
    proposer: serviceProposal.proposer,
    status: status,
    votesFor: yesVotes,
    votesAgainst: votesAgainst,
    totalVotes: totalVotes,
    quorum: quorum,
    startTime: startTime,
    endTime: endTime,
    executionTime: executionTime,
    details: {
      type: category as ProposalCategory,
    } as any, // Details would need to be parsed from proposalActionHash if available
  };
};
