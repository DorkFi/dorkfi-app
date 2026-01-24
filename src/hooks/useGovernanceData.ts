import { useState, useEffect } from "react";
import { Proposal, VotingStats } from "@/types/governanceTypes";
import { getEvents, decodeProposalCreatedEvent, getProposal } from "@/services/governanceService";
import { convertServiceProposalToUI } from "@/utils/governanceUtils";
import { useWallet } from "@txnlab/use-wallet-react";

// Mock data for development (fallback)
const mockProposals: Proposal[] = [
  {
    id: "prop-001",
    title: "Adjust USDC Interest Rate Parameters",
    description: "Proposal to increase the base borrowing rate for USDC from 2% to 3.5% to better align with market conditions and improve protocol sustainability.",
    category: "interest-rates",
    proposer: "ALGORAND_ADDRESS_123...XYZ",
    status: "active",
    votesFor: 1250000,
    votesAgainst: 350000,
    totalVotes: 1600000,
    quorum: 1000000,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    details: {
      type: "interest-rates",
      baseRate: 3.5,
      slope1: 4.0,
      slope2: 75,
      optimalUtilization: 80,
      asset: "USDC"
    }
  },
  {
    id: "prop-002",
    title: "Add ALGO as Collateral Asset",
    description: "Enable native ALGO token as an approved collateral type with a 65% collateral factor and 75% liquidation threshold.",
    category: "collateral-listing",
    proposer: "ALGORAND_ADDRESS_456...ABC",
    status: "active",
    votesFor: 890000,
    votesAgainst: 620000,
    totalVotes: 1510000,
    quorum: 1000000,
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    details: {
      type: "collateral-listing",
      assetName: "Algorand",
      assetSymbol: "ALGO",
      assetId: 0,
      collateralFactor: 65,
      liquidationThreshold: 75,
      liquidationPenalty: 10
    }
  },
  {
    id: "prop-003",
    title: "Increase Liquidation Bonus for WBTC",
    description: "Raise the liquidation bonus for WBTC positions from 5% to 7.5% to incentivize liquidators and reduce protocol risk.",
    category: "liquidation-settings",
    proposer: "ALGORAND_ADDRESS_789...DEF",
    status: "passed",
    votesFor: 2100000,
    votesAgainst: 450000,
    totalVotes: 2550000,
    quorum: 1000000,
    startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    executionTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    details: {
      type: "liquidation-settings",
      asset: "WBTC",
      closeFactor: 50,
      liquidationBonus: 7.5,
      liquidationThreshold: 80
    }
  },
  {
    id: "prop-004",
    title: "Treasury Allocation: Security Audit Fund",
    description: "Allocate 50,000 USDC from protocol treasury to fund a comprehensive security audit by Trail of Bits.",
    category: "treasury",
    proposer: "ALGORAND_ADDRESS_101...GHI",
    status: "passed",
    votesFor: 1850000,
    votesAgainst: 280000,
    totalVotes: 2130000,
    quorum: 1000000,
    startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    executionTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    details: {
      type: "treasury",
      recipient: "Trail of Bits",
      amount: 50000,
      asset: "USDC",
      purpose: "Comprehensive security audit"
    }
  },
  {
    id: "prop-005",
    title: "Deploy to Arbitrum Network",
    description: "Expand DorkFi protocol to Arbitrum for lower transaction costs and broader user access.",
    category: "features",
    proposer: "ALGORAND_ADDRESS_202...JKL",
    status: "rejected",
    votesFor: 650000,
    votesAgainst: 1420000,
    totalVotes: 2070000,
    quorum: 1000000,
    startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
    details: {
      type: "features",
      featureName: "Arbitrum Deployment",
      description: "Full protocol deployment on Arbitrum L2",
      blockchain: "Arbitrum"
    }
  }
];

const mockStats: VotingStats = {
  totalUnitSupply: 10000000,
  yourVotingPower: 50000,
  activeProposals: 2,
  totalProposals: 5,
  participationRate: 42.5
};

/**
 * Calculate voting stats from proposals
 */
const calculateStatsFromProposals = (
  proposals: Proposal[],
  userVotingPower: number = 0
): VotingStats => {
  const activeProposals = proposals.filter((p) => p.status === "active").length;
  const totalProposals = proposals.length;
  
  // Calculate total voting power from all proposals (use max quorum as proxy for total supply)
  const maxQuorum = proposals.length > 0
    ? Math.max(...proposals.map((p) => p.quorum))
    : 0;
  const totalUnitSupply = maxQuorum > 0 ? maxQuorum * 2 : 10000000; // Estimate if no proposals

  // Calculate participation rate from average of proposals
  const avgParticipation = proposals.length > 0
    ? proposals.reduce((sum, p) => {
        const participation = p.quorum > 0 ? (p.totalVotes / p.quorum) * 100 : 0;
        return sum + participation;
      }, 0) / proposals.length
    : 0;

  return {
    totalUnitSupply,
    yourVotingPower: userVotingPower,
    activeProposals,
    totalProposals,
    participationRate: avgParticipation,
  };
};

export const useGovernanceData = () => {
  const { activeAccount } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<VotingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch governance events
        const events = await getEvents();
        const eventsArray = Array.isArray(events) ? events : [events];

        // Extract ProposalCreated events and fetch proposal details
        const proposalCreatedEvents: string[] = [];
        for (const group of eventsArray) {
          if (group?.name === "ProposalCreated" && Array.isArray(group?.events)) {
            for (const ev of group.events) {
              if (Array.isArray(ev) && ev.length >= 4) {
                try {
                  const decoded = decodeProposalCreatedEvent(ev as [string, unknown, unknown, string]);
                  proposalCreatedEvents.push(decoded.proposal_id);
                } catch (err) {
                  console.error("Failed to decode ProposalCreated event:", err);
                }
              }
            }
          }
        }

        // Fetch proposal details for each ProposalCreated event
        const fetchedProposals: Proposal[] = [];
        for (const proposalId of proposalCreatedEvents) {
          try {
            const serviceProposal = await getProposal(proposalId);
            const uiProposal = convertServiceProposalToUI(serviceProposal, proposalId);
            fetchedProposals.push(uiProposal);
          } catch (err: any) {
            console.error(`Failed to fetch proposal ${proposalId}:`, err);
            // Continue fetching other proposals even if one fails
          }
        }

        // Use fetched proposals if available, otherwise fall back to mock data
        if (fetchedProposals.length > 0) {
          setProposals(fetchedProposals);
          // Calculate stats from fetched proposals
          const calculatedStats = calculateStatsFromProposals(fetchedProposals, 0);
          setStats(calculatedStats);
        } else {
          // Fallback to mock data if no proposals found
          console.warn("No proposals found from governance events, using mock data");
          setProposals(mockProposals);
          setStats(mockStats);
        }
      } catch (err: any) {
        console.error("Failed to fetch governance data:", err);
        setError(err?.message || "Failed to load governance data");
        // Fallback to mock data on error
        setProposals(mockProposals);
        setStats(mockStats);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const vote = async (proposalId: string, support: boolean, votingPower: number) => {
    // TODO: Implement actual voting transaction
    // For now, simulate voting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setUserVotes((prev) => new Map(prev).set(proposalId, support));

    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            votesFor: support ? p.votesFor + votingPower : p.votesFor,
            votesAgainst: !support ? p.votesAgainst + votingPower : p.votesAgainst,
            totalVotes: p.totalVotes + votingPower,
          };
        }
        return p;
      })
    );
  };

  const getProposalsByStatus = (status: Proposal["status"]) => {
    return proposals.filter((p) => p.status === status);
  };

  const getProposalsByCategory = (category: Proposal["category"]) => {
    return proposals.filter((p) => p.category === category);
  };

  return {
    proposals,
    stats,
    loading,
    error,
    userVotes,
    vote,
    getProposalsByStatus,
    getProposalsByCategory,
  };
};
