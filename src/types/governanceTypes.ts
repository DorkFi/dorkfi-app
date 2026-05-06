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
  /** Network this proposal lives on (e.g. "voi-mainnet", "algorand-mainnet"). */
  networkId?: string;
  /** When proposals are merged across networks, all source network IDs. */
  networkIds?: string[];
  /**
   * When true (e.g. governance node with power fields), `votesFor` is yes voting power
   * and `totalVotes` is total voting power cast — use their ratio for pass % and bars.
   */
  usesVotingPowerTally?: boolean;
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
