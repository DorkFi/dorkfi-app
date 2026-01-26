import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { GovernanceHero } from "@/components/governance/GovernanceHero";
import { GovernanceDashboardCard } from "@/components/governance/GovernanceDashboardCard";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { useGovernanceData } from "@/hooks/useGovernanceData";
import { ProposalStatus } from "@/types/governanceTypes";
import { Loader2 } from "lucide-react";
import { H2 } from "@/components/ui/Typography";
import { calculateNFTMultiplier } from "@/components/governance/NFTMultiplierDropdown";
import { isFeatureEnabled } from "@/config";
import { useUserNFTs } from "@/hooks/useUserNFTs";

const Governance = () => {
  const { proposals, stats, loading, userVotes, vote, userVoterInfo } = useGovernanceData();
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | "all">("all");
  const nftBoostEnabled = isFeatureEnabled("enableNFTBoost");
  const { userNFTs } = useUserNFTs();

  // Calculate effective voting power (same logic as GovernanceDashboardCard)
  const effectiveVotingPower = useMemo(() => {
    // Calculate base power
    const basePower = userVoterInfo 
      ? Number(userVoterInfo.voteBasePower) / 1e8 
      : (stats?.yourVotingPower ?? 0);

    // Calculate NFT multiplier
    const nftMultiplier = (() => {
      if (!nftBoostEnabled) return 1;
      // If voter info exists, use contract multiplier (divide by 10000)
      if (userVoterInfo) {
        return Number(userVoterInfo.voteMultiplier) / 10000;
      }
      // Otherwise calculate from fetched user NFTs
      return calculateNFTMultiplier(userNFTs);
    })();

    // Calculate effective power
    if (userVoterInfo) {
      return Number(userVoterInfo.voteTotalPower) / 1e8;
    }
    return Math.floor(basePower * nftMultiplier);
  }, [userVoterInfo, stats?.yourVotingPower, nftBoostEnabled, userNFTs]);

  const handleVote = async (proposalId: string, support: boolean) => {
    if (!stats) {
      throw new Error("Voting stats not loaded");
    }
    await vote(proposalId, support, effectiveVotingPower);
  };

  const filteredProposals = proposals.filter((proposal) => {
    return selectedStatus === "all" || proposal.status === selectedStatus;
  });

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      
      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header />
      
      <div className="max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 relative z-10">
        {/* Hero - Full Width */}
        <GovernanceHero stats={stats} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Unified Dashboard Card */}
            <div className="mt-6">
              <GovernanceDashboardCard
                stats={stats}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                userVoterInfo={userVoterInfo}
              />
            </div>

            {/* Proposals List - Full Width Below */}
            <div className="mt-6 space-y-4">
              <H2>
                {selectedStatus === "all" ? "All" : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Proposals
              </H2>
              
              {filteredProposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No proposals found matching your filters
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onVote={handleVote}
                      userVote={userVotes.get(proposal.id)}
                      votingPower={effectiveVotingPower}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Governance;
