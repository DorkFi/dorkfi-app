import DorkFiCard from "@/components/ui/DorkFiCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VotingStats, ProposalStatus, ProposalCategory } from "@/types/governanceTypes";
import { Vote, Sparkles } from "lucide-react";

interface GovernanceDashboardCardProps {
  stats: VotingStats | null;
  selectedStatus: ProposalStatus | "all";
  selectedCategory: ProposalCategory | "all";
  onStatusChange: (status: ProposalStatus | "all") => void;
  onCategoryChange: (category: ProposalCategory | "all") => void;
}

export const GovernanceDashboardCard = ({
  stats,
  selectedStatus,
  selectedCategory,
  onStatusChange,
  onCategoryChange,
}: GovernanceDashboardCardProps) => {
  const hasVotingPower = stats && stats.yourVotingPower > 0;

  const statuses: (ProposalStatus | "all")[] = ["all", "active", "passed", "rejected", "pending", "executed"];
  const categories: (ProposalCategory | "all")[] = [
    "all",
    "interest-rates",
    "collateral-listing",
    "liquidation-settings",
    "treasury",
    "features",
  ];

  return (
    <DorkFiCard className="p-4 md:p-6">
      {/* Top Row: Voting Power + Protocol Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: Voting Power - spans 1 column */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Vote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Voting Power</h3>
              <p className="text-2xl font-bold text-foreground">
                {stats ? stats.yourVotingPower.toLocaleString() : "—"}{" "}
                <span className="text-base font-normal text-muted-foreground">UNIT</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {hasVotingPower
                ? "Vote on active proposals using your UNIT tokens."
                : "Hold UNIT tokens to participate in governance."}
            </p>
          </div>
        </div>

        {/* Right: Protocol Stats - spans 2 columns, 4 stats in a row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:col-span-2">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Total UNIT Supply</p>
            <p className="text-lg font-bold text-foreground">
              {stats?.totalUnitSupply.toLocaleString() ?? "—"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Active Proposals</p>
            <p className="text-lg font-bold text-primary">
              {stats?.activeProposals ?? "—"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Total Proposals</p>
            <p className="text-lg font-bold text-foreground">
              {stats?.totalProposals ?? "—"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Participation Rate</p>
            <p className="text-lg font-bold text-foreground">
              {stats?.participationRate ? `${stats.participationRate.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Filters Section */}
      <div className="space-y-4">
        {/* Status Tabs */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Status</label>
          <Tabs value={selectedStatus} onValueChange={(v) => onStatusChange(v as ProposalStatus | "all")}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
              {statuses.map((status) => (
                <TabsTrigger key={status} value={status} className="text-xs md:text-sm">
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Category Buttons */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange(category)}
                className="text-xs"
              >
                {category === "all"
                  ? "All Categories"
                  : category.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </DorkFiCard>
  );
};
