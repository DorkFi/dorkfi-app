export type ProposalStatus = "active" | "passed" | "rejected" | "pending" | "executed";

export type ProposalCategory = 
  | "interest-rates" 
  | "collateral-listing" 
  | "liquidation-settings" 
  | "treasury" 
  | "features" 
  | "governance"
  | "infrastructure";

export interface Proposal {
  id: string;
  /** Network this proposal lives on (single-network view). Used for voting and user votes. */
  networkId?: string;
  /** Networks this proposal exists on (grouped view). When set, voting data is aggregated across these networks. */
  networkIds?: string[];
  title: string;
  description: string;
  category: ProposalCategory;
  proposer: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorum: number;
  startTime: Date;
  endTime: Date;
  executionTime?: Date;
  details: ProposalDetails;
}

export type ProposalDetails = 
  | InterestRateProposal
  | CollateralListingProposal
  | LiquidationSettingsProposal
  | TreasuryProposal
  | FeaturesProposal
  | GovernanceProposal;

export interface InterestRateProposal {
  type: "interest-rates";
  baseRate: number;
  slope1: number;
  slope2: number;
  optimalUtilization: number;
  asset: string;
}

export interface CollateralListingProposal {
  type: "collateral-listing";
  assetName: string;
  assetSymbol: string;
  assetId: number;
  collateralFactor: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
}

export interface LiquidationSettingsProposal {
  type: "liquidation-settings";
  asset: string;
  closeFactor: number;
  liquidationBonus: number;
  liquidationThreshold: number;
}

export interface TreasuryProposal {
  type: "treasury";
  recipient: string;
  amount: number;
  asset: string;
  purpose: string;
}

export interface FeaturesProposal {
  type: "features";
  featureName: string;
  description: string;
  blockchain?: string;
  partnerProtocol?: string;
}

export interface GovernanceProposal {
  type: "governance";
  description: string;
}

export interface Vote {
  proposalId: string;
  voter: string;
  support: boolean;
  votingPower: number;
  timestamp: Date;
}

export interface VotingStats {
  totalUnitSupply: number;
  yourVotingPower: number;
  activeProposals: number;
  totalProposals: number;
  participationRate: number;
}
