import { useMemo, useState } from "react";
import { Gift, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { PORTFOLIO_ACHIEVEMENT_FAMILIES } from "@/data/achievementsCatalog";
import { useUserAchievements } from "@/hooks/useUserAchievements";
import { AchievementsModal } from "@/components/portfolio/AchievementsModal";
import { AchievementWhaleIcon } from "@/components/portfolio/AchievementWhaleIcon";
import PortfolioInsightChip from "@/components/portfolio/PortfolioInsightChip";
import PortfolioNetworkBreakdownModal from "@/components/portfolio/PortfolioNetworkBreakdownModal";
import type {
  PortfolioBorrowSummary,
  PortfolioPoolBreakdownRow,
} from "@/components/portfolio/portfolioPoolBreakdownTypes";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import type { PortfolioNetworkFilterValue } from "@/utils/portfolioMarketFilter";

export type PortfolioInsightsLayout = "chips" | "toolbar";

type PortfolioInsightsHubProps = {
  className?: string;
  embedded?: boolean;
  layout?: PortfolioInsightsLayout;
  showNetworkRow: boolean;
  poolPortfolioBreakdown: PortfolioPoolBreakdownRow[];
  networkPortfolioPoolsFiltered: PortfolioPoolBreakdownRow[];
  positionsNetworkFilter: PortfolioNetworkFilterValue;
  positionsMarketFilter: MarketFilter;
  borrows: PortfolioBorrowSummary[];
  healthFactor: number | null;
  displayHealthFactor: number | null;
  totalBorrowed: number;
  isMobile: boolean;
  displayAddress?: string | null;
  isViewOnly?: boolean;
  showNftRow: boolean;
  nftRewardsLoading: boolean;
  nftClaimableDisplay?: string;
  nftHasClaimable: boolean;
  onOpenNftRewards: () => void;
};

const PortfolioInsightsHub = ({
  className,
  embedded = false,
  layout = "chips",
  showNetworkRow,
  poolPortfolioBreakdown,
  networkPortfolioPoolsFiltered,
  positionsNetworkFilter,
  positionsMarketFilter,
  borrows,
  healthFactor,
  displayHealthFactor,
  totalBorrowed,
  isMobile,
  displayAddress,
  isViewOnly = false,
  showNftRow,
  nftRewardsLoading,
  nftClaimableDisplay,
  nftHasClaimable,
  onOpenNftRewards,
}: PortfolioInsightsHubProps) => {
  const { formatCurrency } = useNumberI18n();
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);

  const { data: earned = {}, isLoading, isFetching } = useUserAchievements(
    displayAddress ?? undefined
  );

  const showAchievementsRow = Boolean(displayAddress);
  const earnedCount = PORTFOLIO_ACHIEVEMENT_FAMILIES.filter(
    (family) => earned[family.id] != null
  ).length;
  const totalFamilies = PORTFOLIO_ACHIEVEMENT_FAMILIES.length;
  const achievementsLoading =
    showAchievementsRow && (isLoading || isFetching);

  const networkSummary = useMemo(() => {
    const count = poolPortfolioBreakdown.length;
    const netTotal = poolPortfolioBreakdown.reduce(
      (sum, row) => sum + row.netValue,
      0
    );
    return { count, netTotal };
  }, [poolPortfolioBreakdown]);

  const visibleRows = [
    showNetworkRow,
    showAchievementsRow,
    showNftRow,
  ].filter(Boolean).length;

  if (visibleRows === 0) return null;

  const netFormatted = formatCurrency(networkSummary.netTotal, "USD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const networkTooltip =
    networkSummary.count === 0
      ? "No pool data"
      : `${networkSummary.count} pool${networkSummary.count === 1 ? "" : "s"} · ${netFormatted} net`;

  const achievementsTooltip = achievementsLoading
    ? "Loading achievements…"
    : `${earnedCount} of ${totalFamilies} earned${isViewOnly ? " (viewing)" : ""}`;

  const nftTooltip = nftRewardsLoading
    ? "Loading NFT holder rewards…"
    : nftHasClaimable
      ? `${nftClaimableDisplay} claimable — tap to claim UNIT`
      : "No claimable balance right now";

  const toolbar = (
    <div
      className={cn(
        "grid gap-2",
        visibleRows === 1 && "grid-cols-1",
        visibleRows === 2 && "grid-cols-2",
        visibleRows === 3 && "grid-cols-3",
        className
      )}
    >
      {showNetworkRow ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiButton
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 w-full min-w-0 gap-1.5 px-2"
              onClick={() => setNetworkModalOpen(true)}
              aria-label={`Networks. ${networkTooltip}. Open breakdown.`}
            >
              <Globe className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Networks</span>
            </DorkFiButton>
          </TooltipTrigger>
          <TooltipContent>{networkTooltip}</TooltipContent>
        </Tooltip>
      ) : null}

      {showAchievementsRow ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiButton
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 w-full min-w-0 gap-1.5 px-2"
              disabled={achievementsLoading}
              onClick={() => setAchievementsModalOpen(true)}
              aria-label={`Achievements. ${achievementsTooltip}. Open details.`}
            >
              {achievementsLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <AchievementWhaleIcon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {achievementsLoading
                  ? "…"
                  : `${earnedCount}/${totalFamilies} Achievements`}
              </span>
            </DorkFiButton>
          </TooltipTrigger>
          <TooltipContent>{achievementsTooltip}</TooltipContent>
        </Tooltip>
      ) : null}

      {showNftRow ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiButton
              type="button"
              variant={nftHasClaimable ? "moderate" : "secondary"}
              size="sm"
              className={cn(
                "h-10 w-full min-w-0 gap-1.5 px-2",
                nftHasClaimable &&
                  "border-yellow-500/60 bg-yellow-400/90 text-slate-900 hover:bg-yellow-300"
              )}
              disabled={nftRewardsLoading}
              onClick={onOpenNftRewards}
              aria-label={`NFT rewards. ${nftTooltip}`}
            >
              {nftRewardsLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Gift className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="truncate">Rewards</span>
            </DorkFiButton>
          </TooltipTrigger>
          <TooltipContent>{nftTooltip}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );

  const chipGrid = (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40",
        visibleRows === 1 && "grid-cols-1",
        visibleRows === 2 && "grid-cols-2",
        visibleRows === 3 && "grid-cols-1 sm:grid-cols-3",
        className
      )}
    >
      {showNetworkRow ? (
        <PortfolioInsightChip
          label="Networks"
          primary={
            networkSummary.count === 0
              ? "—"
              : `${networkSummary.count} pool${networkSummary.count === 1 ? "" : "s"}`
          }
          secondary={
            networkSummary.count === 0 ? "No pool data" : `${netFormatted} net`
          }
          onClick={() => setNetworkModalOpen(true)}
          ariaLabel={`Networks, ${networkSummary.count} pools, ${netFormatted} net. Open breakdown.`}
        />
      ) : null}

      {showAchievementsRow ? (
        <PortfolioInsightChip
          label="Achievements"
          primary={
            achievementsLoading ? "…" : `${earnedCount} / ${totalFamilies}`
          }
          secondary={
            achievementsLoading
              ? "Loading…"
              : isViewOnly
                ? "earned · viewing"
                : "earned"
          }
          loading={achievementsLoading}
          onClick={() => setAchievementsModalOpen(true)}
          ariaLabel={
            achievementsLoading
              ? "Loading achievements"
              : `Achievements, ${earnedCount} of ${totalFamilies} earned. Open details.`
          }
        />
      ) : null}

      {showNftRow ? (
        <PortfolioInsightChip
          label="NFT rewards"
          primary={
            nftRewardsLoading
              ? "…"
              : nftHasClaimable
                ? nftClaimableDisplay ?? "Claimable"
                : "—"
          }
          secondary={
            nftRewardsLoading
              ? "Loading…"
              : nftHasClaimable
                ? "Tap to claim UNIT"
                : "Nothing to claim"
          }
          highlight={nftHasClaimable}
          dimmed={!nftHasClaimable && !nftRewardsLoading}
          loading={nftRewardsLoading}
          onClick={onOpenNftRewards}
          ariaLabel={
            nftRewardsLoading
              ? "Loading NFT holder rewards"
              : nftHasClaimable
                ? `Claim NFT holder rewards, ${nftClaimableDisplay} claimable`
                : "NFT holder rewards, no balance claimable"
          }
        />
      ) : null}
    </div>
  );

  const surface =
    layout === "toolbar" ? (
      toolbar
    ) : embedded ? (
      chipGrid
    ) : (
      <DorkFiCard className="overflow-hidden border-2 border-ocean-teal/20 p-4 shadow-sm sm:p-5">
        {chipGrid}
      </DorkFiCard>
    );

  return (
    <>
      {surface}

      {showNetworkRow ? (
        <PortfolioNetworkBreakdownModal
          open={networkModalOpen}
          onOpenChange={setNetworkModalOpen}
          pools={networkPortfolioPoolsFiltered}
          networkFilter={positionsNetworkFilter}
          marketFilter={positionsMarketFilter}
          borrows={borrows}
          healthFactor={healthFactor}
          displayHealthFactor={displayHealthFactor}
          totalBorrowed={totalBorrowed}
          isMobile={isMobile}
        />
      ) : null}

      {showAchievementsRow ? (
        <AchievementsModal
          open={achievementsModalOpen}
          onOpenChange={setAchievementsModalOpen}
          earned={earned}
        />
      ) : null}
    </>
  );
};

export default PortfolioInsightsHub;
