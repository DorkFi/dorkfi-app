import type { Proposal } from "@/types/governanceTypes";
import type { NetworkId } from "@/config";

export const MOCK_GOVERNANCE_PROPOSAL_ID =
  "0000000000000000000000000000000000000000000000000000000000000001";

export function createMockGovernanceProposal(
  networkId: NetworkId = "voi-mainnet",
  overrides: Partial<Proposal> = {}
): Proposal {
  const now = new Date();
  const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    id: MOCK_GOVERNANCE_PROPOSAL_ID,
    title: "Increase USDC supply cap to 10M",
    description:
      "Mock proposal for local UI preview. Vote For or Against to walk through the confirmation and share modals without submitting an on-chain transaction.",
    category: "governance",
    proposer: "MOCKPREVIEW",
    status: "active",
    votesFor: 125_000,
    votesAgainst: 48_000,
    totalVotes: 173_000,
    quorum: 250_000,
    startTime: now,
    endTime,
    details: {
      type: "governance",
      description: "Mock governance proposal for development preview.",
    },
    networkId,
    ...overrides,
  };
}
