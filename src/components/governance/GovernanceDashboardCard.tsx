import { useMemo } from "react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { VotingStats, ProposalStatus } from "@/types/governanceTypes";
import { Zap } from "lucide-react";
import { NFTMultiplierDropdown, calculateNFTMultiplier, getDefaultNFTs } from "./NFTMultiplierDropdown";
import { isFeatureEnabled } from "@/config";

interface GovernanceDashboardCardProps {
  stats: VotingStats | null;
  selectedStatus: ProposalStatus | "all";
  onStatusChange: (status: ProposalStatus | "all") => void;
}

export const GovernanceDashboardCard = ({
  stats,
  selectedStatus,
  onStatusChange,
}: GovernanceDashboardCardProps) => {
  const hasVotingPower = stats && stats.yourVotingPower > 0;
  const statuses: (ProposalStatus | "all")[] = ["all", "active", "passed", "rejected"];
  const nftBoostEnabled = isFeatureEnabled("enableNFTBoost");

  // Calculate NFT multiplier and effective power
  const nftMultiplier = useMemo(() => {
    if (!nftBoostEnabled) return 1;
    return calculateNFTMultiplier(getDefaultNFTs());
  }, [nftBoostEnabled]);
  const supplyPercentage = stats 
    ? (stats.yourVotingPower / stats.totalUnitSupply) * 100 
    : 0;
  const effectivePower = stats 
    ? Math.floor(stats.yourVotingPower * nftMultiplier) 
    : 0;

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
            {stats ? stats.yourVotingPower.toLocaleString() : "—"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">UNIT tokens</div>
          
          {/* Supply Progress Bar */}
          <div className="mt-4">
            <Progress 
              value={supplyPercentage} 
              className="h-2 bg-muted/30"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
              <span>{supplyPercentage.toFixed(1)}% of supply</span>
              <span>{stats?.totalUnitSupply.toLocaleString()} total</span>
            </div>
          </div>
        </div>

        {/* Right Column - Effective Power Card */}
        <div className="flex flex-col justify-center">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
            {/* NFT Boost */}
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1">NFT Boost</div>
              <div className={`text-2xl font-bold ${nftBoostEnabled && nftMultiplier > 1 ? 'text-whale-gold' : 'text-muted-foreground'}`}>
                {nftMultiplier.toFixed(2)}x
              </div>
            </div>

            {/* Effective Power */}
            <Separator className="mb-4" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Effective Voting Power</div>
              {hasVotingPower && nftBoostEnabled && nftMultiplier > 1 ? (
                <div className="text-3xl font-bold text-whale-gold animate-glow-pulse">
                  {effectivePower.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UNIT</span>
                </div>
              ) : hasVotingPower ? (
                <div className="text-3xl font-bold text-whale-gold">
                  {stats.yourVotingPower.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UNIT</span>
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
          <NFTMultiplierDropdown />
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
