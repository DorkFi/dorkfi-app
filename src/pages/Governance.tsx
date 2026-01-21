import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CanvasBubbles from "@/components/CanvasBubbles";
import { GovernanceHero } from "@/components/governance/GovernanceHero";
import { GovernanceDashboardCard } from "@/components/governance/GovernanceDashboardCard";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { useGovernanceData } from "@/hooks/useGovernanceData";
import { ProposalStatus, ProposalCategory } from "@/types/governanceTypes";
import { Loader2 } from "lucide-react";
import { H2 } from "@/components/ui/Typography";

interface GovernanceProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const Governance = ({ activeTab, onTabChange }: GovernanceProps) => {
  const { proposals, stats, loading, userVotes, vote } = useGovernanceData();
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<ProposalCategory | "all">("all");

  const handleVote = async (proposalId: string, support: boolean) => {
    if (!stats) {
      throw new Error("Voting stats not loaded");
    }
    await vote(proposalId, support, stats.yourVotingPower);
  };

  const filteredProposals = proposals.filter((proposal) => {
    const statusMatch = selectedStatus === "all" || proposal.status === selectedStatus;
    const categoryMatch = selectedCategory === "all" || proposal.category === selectedCategory;
    return statusMatch && categoryMatch;
  });

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      
      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      {/* Advanced Canvas Bubble System - Dark Mode Only */}
      <div className="hidden dark:block">
        <CanvasBubbles />
      </div>

      <Header activeTab={activeTab} onTabChange={onTabChange} />
      
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
                selectedCategory={selectedCategory}
                onStatusChange={setSelectedStatus}
                onCategoryChange={setSelectedCategory}
              />
            </div>

            {/* Proposals List - Full Width Below */}
            <div className="mt-6 space-y-4">
              <H2>
                {selectedStatus === "all" ? "All" : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Proposals
                {selectedCategory !== "all" && (
                  <span className="text-muted-foreground">
                    {" "}· {selectedCategory.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </span>
                )}
              </H2>
              
              {filteredProposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No proposals found matching your filters
                </div>
              ) : (
                <div className="grid gap-4 sm:gap-6">
                  {filteredProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onVote={handleVote}
                      userVote={userVotes.get(proposal.id)}
                      votingPower={stats?.yourVotingPower ?? 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Governance;
