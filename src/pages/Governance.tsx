import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { GovernanceHero } from "@/components/governance/GovernanceHero";
import { GovernanceDashboardCard } from "@/components/governance/GovernanceDashboardCard";
import { GovernanceVotingInfoCard } from "@/components/governance/GovernanceVotingInfoCard";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { BatchVoteConfirmationModal } from "@/components/governance/BatchVoteConfirmationModal";
import { useGovernanceData } from "@/hooks/useGovernanceData";
import { ProposalStatus, Proposal } from "@/types/governanceTypes";
import { Loader2, ChevronDown } from "lucide-react";
import { H2 } from "@/components/ui/Typography";
import { Button } from "@/components/ui/button";
import { calculateNFTMultiplier } from "@/components/governance/NFTMultiplierDropdown";
import {
  isFeatureEnabled,
  getNetworksWithGovernance,
  getNetworkConfig,
  type NetworkId,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getNetworkLogoPath } from "@/utils/tokenImageUtils";

const MAX_SELECTION_LIMIT = 8;

const Governance = () => {
  const { currentNetwork, switchNetwork } = useNetwork();
  const governanceNetworks = useMemo(() => getNetworksWithGovernance(), []);
  const hasGovernanceOnCurrentNetwork = governanceNetworks.includes(currentNetwork);
  const effectiveGovernanceNetwork: NetworkId | null = hasGovernanceOnCurrentNetwork
    ? currentNetwork
    : null;

  const { proposals, stats, loading, userVotes, vote, batchVote, userVoterInfo, getVoteKey } =
    useGovernanceData(effectiveGovernanceNetwork);
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | "all">("all");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [selectedVotes, setSelectedVotes] = useState<Map<string, boolean>>(new Map());
  const [isBatchVoting, setIsBatchVoting] = useState(false);
  const [showBatchConfirmation, setShowBatchConfirmation] = useState(false);
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

  const handleVote = async (proposalId: string, support: boolean, networkId?: NetworkId) => {
    if (!stats) {
      throw new Error("Voting stats not loaded");
    }
    await vote(proposalId, support, effectiveVotingPower, networkId);
  };

  const handleSelectProposal = (proposalId: string, selected: boolean) => {
    setSelectedProposals((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        // Check if we've reached the limit
        if (prev.size >= MAX_SELECTION_LIMIT) {
          toast({
            title: "Selection Limit Reached",
            description: `You can only select up to ${MAX_SELECTION_LIMIT} proposals at a time. Please deselect a proposal first.`,
            variant: "destructive",
          });
          return prev;
        }
        newSet.add(proposalId);
      } else {
        newSet.delete(proposalId);
        setSelectedVotes((prevVotes) => {
          const newVotes = new Map(prevVotes);
          newVotes.delete(proposalId);
          return newVotes;
        });
      }
      return newSet;
    });
  };

  const handleSelectVote = (proposalId: string, support: boolean | null) => {
    setSelectedVotes((prev) => {
      const newVotes = new Map(prev);
      if (support === null) {
        newVotes.delete(proposalId);
      } else {
        newVotes.set(proposalId, support);
      }
      return newVotes;
    });
  };

  const handleBatchVoteClick = () => {
    // Validate that all selected proposals have a vote direction
    const selectedWithoutVote = Array.from(selectedProposals).filter(
      (proposalId) => !selectedVotes.has(proposalId)
    );

    if (selectedWithoutVote.length > 0) {
      toast({
        title: "Missing Vote Directions",
        description: `Please select For or Against for all ${selectedProposals.size} selected proposal${selectedProposals.size > 1 ? 's' : ''}. ${selectedWithoutVote.length} proposal${selectedWithoutVote.length > 1 ? 's' : ''} still need${selectedWithoutVote.length === 1 ? 's' : ''} a vote direction.`,
        variant: "destructive",
      });
      return;
    }

    setShowBatchConfirmation(true);
  };

  const handleBatchVoteConfirm = async () => {
    setShowBatchConfirmation(false);
    
    if (selectedProposals.size === 0) {
      return;
    }

    // Only include proposals on current network (batch vote is per-network)
    const votesToCast = Array.from(selectedProposals)
      .map((proposalId) => {
        const support = selectedVotes.get(proposalId);
        if (support === undefined) return null;
        const proposal = proposals.find((p) => p.id === proposalId);
        if (!proposal) return null;
        const onCurrentNetwork =
          (effectiveGovernanceNetwork && proposal.networkIds?.includes(effectiveGovernanceNetwork)) ||
          proposal.networkId === effectiveGovernanceNetwork;
        if (effectiveGovernanceNetwork && !onCurrentNetwork) return null;
        return { proposalId, support };
      })
      .filter((v): v is { proposalId: string; support: boolean } => v !== null);

    if (votesToCast.length === 0) {
      if (effectiveGovernanceNetwork) {
        toast({
          title: "No proposals on current network",
          description: "Batch vote only includes proposals on the currently selected network. Switch network to vote on the selected proposals.",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      setIsBatchVoting(true);
      await batchVote(votesToCast, effectiveVotingPower);
      // Clear selections after successful vote
      setSelectedProposals(new Set());
      setSelectedVotes(new Map());
    } catch (error) {
      // Error is handled in the batchVote function
    } finally {
      setIsBatchVoting(false);
    }
  };

  const filteredProposals = proposals.filter((proposal) => {
    return selectedStatus === "all" || proposal.status === selectedStatus;
  });

  const activeProposals = filteredProposals.filter(
    (p) =>
      p.status === "active" &&
      userVotes.get(getVoteKey(p, effectiveGovernanceNetwork ?? undefined)) === undefined
  );
  // Validate that all selected proposals have a vote direction
  const allSelectedHaveVotes = selectedProposals.size > 0 && 
    Array.from(selectedProposals).every((id) => selectedVotes.has(id));
  const canBatchVote = batchMode && selectedProposals.size > 0 && allSelectedHaveVotes;
  
  const allActiveSelected = batchMode && activeProposals.length > 0 && 
    activeProposals.every((p) => selectedProposals.has(p.id));

  const handleSelectAll = () => {
    if (allActiveSelected) {
      // Deselect all
      setSelectedProposals(new Set());
      setSelectedVotes(new Map());
    } else {
      // Select up to MAX_SELECTION_LIMIT active proposals (one card per proposalId)
      const proposalsToSelect = activeProposals.slice(0, MAX_SELECTION_LIMIT);
      const selectedIds = new Set(proposalsToSelect.map((p) => p.id));
      setSelectedProposals(selectedIds);
      
      // If there are more proposals than the limit, show a message
      if (activeProposals.length > MAX_SELECTION_LIMIT) {
        toast({
          title: "Selection Limited",
          description: `Only the first ${MAX_SELECTION_LIMIT} proposals were selected. You can select up to ${MAX_SELECTION_LIMIT} proposals at a time.`,
        });
      }
      // Don't auto-select vote direction - user needs to choose
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      
      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header />
      
      <div className="max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 relative z-10">
        {/* Network selector and prompt when current network has no governance */}
        {governanceNetworks.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {!hasGovernanceOnCurrentNetwork ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-900/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-sm text-foreground">
                  Governance is available on{" "}
                  {governanceNetworks.map((nid) => getNetworkConfig(nid).name).join(", ")}.
                  Switch network to view and vote on proposals.
                </p>
                <Button
                  size="sm"
                  onClick={() => switchNetwork(governanceNetworks[0])}
                  className="shrink-0"
                >
                  Switch to {getNetworkConfig(governanceNetworks[0]).name}
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 dark:bg-muted/20 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors w-fit">
                    <img
                      src={getNetworkLogoPath(currentNetwork)}
                      alt=""
                      className="h-5 w-5 rounded-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                    <span className="text-sm font-medium">
                      {getNetworkConfig(currentNetwork).name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Governance network
                  </div>
                  <DropdownMenuSeparator />
                  {governanceNetworks.map((networkId) => {
                    const networkConfig = getNetworkConfig(networkId);
                    const isCurrent = currentNetwork === networkId;
                    return (
                      <DropdownMenuItem
                        key={networkId}
                        onClick={() => switchNetwork(networkId)}
                        className="cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={getNetworkLogoPath(networkId)}
                            alt=""
                            className="h-5 w-5 rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder.svg";
                            }}
                          />
                          <span className="text-sm">{networkConfig.name}</span>
                        </div>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Hero - Full Width */}
        <GovernanceHero stats={stats} />

        {!effectiveGovernanceNetwork ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Switch to a governance-enabled network above to view proposals.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Governance Voting Info Card */}
            <div className="mt-6">
              <GovernanceVotingInfoCard />
            </div>

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
              <div className="space-y-4">
                <H2 className="text-xl sm:text-2xl">
                  {selectedStatus === "all" ? "All" : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Proposals
                </H2>
                {activeProposals.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="batch-mode"
                        checked={batchMode}
                        onCheckedChange={(checked) => {
                          setBatchMode(checked);
                          if (!checked) {
                            setSelectedProposals(new Set());
                            setSelectedVotes(new Map());
                          }
                        }}
                      />
                      <Label htmlFor="batch-mode" className="cursor-pointer text-sm sm:text-base">
                        Batch Vote Mode
                      </Label>
                    </div>
                    {batchMode && activeProposals.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          className="text-sm w-full sm:w-auto"
                        >
                          {allActiveSelected 
                            ? "Deselect All" 
                            : `Select All (${Math.min(activeProposals.length, MAX_SELECTION_LIMIT)})`}
                        </Button>
                        {selectedProposals.size > 0 && (
                          <span className="text-sm text-muted-foreground text-center sm:text-left">
                            {selectedProposals.size}/{MAX_SELECTION_LIMIT} selected
                          </span>
                        )}
                      </div>
                    )}
                    {canBatchVote && (
                      <Button
                        onClick={handleBatchVoteClick}
                        disabled={isBatchVoting}
                        className="bg-primary hover:bg-primary/90 w-full sm:w-auto min-h-[44px]"
                      >
                        {isBatchVoting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Voting...
                          </>
                        ) : (
                          `Vote on ${selectedProposals.size} Proposal${selectedProposals.size > 1 ? 's' : ''}`
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {filteredProposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground px-4">
                  No proposals found matching your filters
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                  {filteredProposals.map((proposal) => {
                    const isSelected = selectedProposals.has(proposal.id);
                    const isLimitReached = selectedProposals.size >= MAX_SELECTION_LIMIT && !isSelected;
                    const voteKeyForUser = getVoteKey(proposal, effectiveGovernanceNetwork ?? undefined);
                    const voteNetworkId =
                      effectiveGovernanceNetwork && proposal.networkIds?.includes(effectiveGovernanceNetwork)
                        ? effectiveGovernanceNetwork
                        : proposal.networkId;
                    return (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        onVote={handleVote}
                        userVote={userVotes.get(voteKeyForUser)}
                        votingPower={effectiveVotingPower}
                        isSelected={isSelected}
                        selectedVote={selectedVotes.get(proposal.id) ?? null}
                        onSelect={handleSelectProposal}
                        onSelectVote={handleSelectVote}
                        voteNetworkId={voteNetworkId}
                        batchMode={batchMode}
                        isSelectionDisabled={isLimitReached}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Batch Vote Confirmation Modal */}
        {canBatchVote && (
          <BatchVoteConfirmationModal
            open={showBatchConfirmation}
            onOpenChange={setShowBatchConfirmation}
            votes={Array.from(selectedProposals)
              .map((proposalId) => {
                const proposal = proposals.find((p) => p.id === proposalId);
                const support = selectedVotes.get(proposalId);
                if (!proposal || support === undefined) return null;
                return { proposal, support };
              })
              .filter((v): v is { proposal: Proposal; support: boolean } => v !== null)}
            votingPower={effectiveVotingPower}
            onConfirm={handleBatchVoteConfirm}
          />
        )}
      </div>
    </div>
  );
};

export default Governance;
