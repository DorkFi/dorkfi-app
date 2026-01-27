import { useMemo } from "react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { VotingStats, ProposalStatus } from "@/types/governanceTypes";
import { Zap } from "lucide-react";
import { NFTMultiplierDropdown, calculateNFTMultiplier } from "./NFTMultiplierDropdown";
import { isFeatureEnabled } from "@/config";
import { Voter } from "@/services/governanceService";
import { useUserNFTs } from "@/hooks/useUserNFTs";

interface GovernanceDashboardCardProps {
  stats: VotingStats | null;
  selectedStatus: ProposalStatus | "all";
  onStatusChange: (status: ProposalStatus | "all") => void;
  userVoterInfo?: Voter | null;
}

export const GovernanceDashboardCard = ({
  stats,
  selectedStatus,
  onStatusChange,
  userVoterInfo,
}: GovernanceDashboardCardProps) => {
  const statuses: (ProposalStatus | "all")[] = ["all", "active", "passed", "rejected"];
  const nftBoostEnabled = isFeatureEnabled("enableNFTBoost");
  const { userNFTs } = useUserNFTs();

  // Use voter info if available, otherwise fall back to stats
  const basePower = userVoterInfo 
    ? Number(userVoterInfo.voteBasePower) / 1e8 
    : (stats?.yourVotingPower ?? 0);

  const hasVotingPower = basePower > 0;

  // Calculate NFT multiplier - use contract multiplier if available, otherwise calculate from NFTs
  const nftMultiplier = useMemo(() => {
    if (!nftBoostEnabled) return 1;
    // If voter info exists, use contract multiplier (divide by 10000)
    if (userVoterInfo) {
      return Number(userVoterInfo.voteMultiplier) / 10000;
    }
    // Otherwise calculate from fetched user NFTs
    return calculateNFTMultiplier(userNFTs);
  }, [userVoterInfo, nftBoostEnabled, userNFTs]);
  
  // Use voteTotalPower from voter info if available, otherwise calculate from basePower * nftMultiplier
  const effectivePower = userVoterInfo 
    ? Number(userVoterInfo.voteTotalPower) / 1e8 
    : Math.floor(basePower * nftMultiplier);
  
  // Calculate supply percentage using basePower (not effectivePower)
  // Use hardcoded total supply of 420,069
  const totalSupply = 420069;
  const supplyPercentage = totalSupply > 0
    ? (basePower / totalSupply) * 100 
    : 0;
  
  // Apply non-linear transformation to progress bar for better visibility
  // Use tighter curve for 0-10%, then linear for values over 10%
  // Formula: visual = (actual / 10)^0.3 * 100 for 0-10%, actual for >10%
  const curveThreshold = 10; // Use curve up to 10%
  const visualProgressPercentage = useMemo(() => {
    if (supplyPercentage <= 0) return 0;
    if (supplyPercentage <= curveThreshold) {
      // Tighter power curve (0.3): makes small percentages fill bar more aggressively
      return Math.pow(supplyPercentage / curveThreshold, 0.3) * 100;
    }
    // For values over 10%, show actual percentage (capped at 100% visually)
    return Math.min(supplyPercentage, 100);
  }, [supplyPercentage]);

  return (
    <DorkFiCard className="p-4 md:p-6">
      {/* Voting Power Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-full bg-primary/20">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Your Voting Power
        </h2>
      </div>

      {/* Two-Column Power Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left Column - Main Power Display */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
          <div className="text-xs text-muted-foreground mb-1">Base Power</div>
          <div className="text-4xl md:text-5xl font-bold text-whale-gold animate-fade-in">
            {basePower > 0 ? basePower.toLocaleString() : "—"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">UNIT tokens</div>
          
          {/* Supply Progress Bar */}
          {totalSupply > 0 && (
            <div className="mt-4">
              <Progress 
                value={visualProgressPercentage} 
                className="h-2 bg-muted/30"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                <span>{supplyPercentage.toFixed(1)}% of supply</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Effective Power Card */}
        <div className="flex flex-col justify-center">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
            {/* NFT Boost - Always show */}
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1">NFT Boost</div>
              <div className={`text-2xl font-bold ${nftMultiplier > 1 ? 'text-whale-gold' : 'text-muted-foreground'}`}>
                {nftMultiplier.toFixed(2)}x
              </div>
            </div>

            {/* Effective Power */}
            <Separator className="mb-4" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Effective Voting Power</div>
              {hasVotingPower ? (
                <div className={`text-3xl font-bold ${userVoterInfo && Number(userVoterInfo.voteTotalPower) > Number(userVoterInfo.voteBasePower) ? 'text-whale-gold animate-glow-pulse' : 'text-whale-gold'}`}>
                  {effectivePower.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UNIT</span>
                </div>
              ) : (
                <div className="text-3xl font-bold text-muted-foreground/50">
                  — <span className="text-sm font-normal text-muted-foreground/50">UNIT</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NFT Multipliers Section */}
      {nftBoostEnabled && (
        <>
          <NFTMultiplierDropdown userNFTs={userNFTs} multiplier={nftMultiplier} />
          <Separator className="my-4" />
        </>
      )}

      {!nftBoostEnabled && <Separator className="my-4" />}

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Filter by Status</label>
        <Tabs value={selectedStatus} onValueChange={(v) => onStatusChange(v as ProposalStatus | "all")}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            {statuses.map((status) => (
              <TabsTrigger key={status} value={status} className="text-xs md:text-sm">
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </DorkFiCard>
  );
};
