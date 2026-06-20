import { Search, X } from "lucide-react";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import MarketsTierFilter from "@/components/markets/MarketsTierFilter";
import PortfolioNetworkFilterDropdown from "@/components/portfolio/PortfolioNetworkFilterDropdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  hasActivePortfolioPositionFilters,
  portfolioMarketFilterLabel,
  portfolioNetworkFilterLabel,
  type PortfolioNetworkFilterValue,
} from "@/utils/portfolioMarketFilter";
import { cn } from "@/lib/utils";

interface PortfolioPositionsFilterBarProps {
  networkFilter: PortfolioNetworkFilterValue;
  onNetworkFilterChange: (value: PortfolioNetworkFilterValue) => void;
  marketFilter: MarketFilter;
  onMarketFilterChange: (value: MarketFilter) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  hasDMarketTab: boolean;
  isMobile?: boolean;
  className?: string;
}

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-ocean-teal/40 bg-ocean-teal/10 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-ocean-teal/20"
    >
      <span>{label}</span>
      <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">Remove {label} filter</span>
    </button>
  );
}

const PortfolioPositionsFilterBar = ({
  networkFilter,
  onNetworkFilterChange,
  marketFilter,
  onMarketFilterChange,
  searchTerm,
  onSearchTermChange,
  hasDMarketTab,
  isMobile = false,
  className,
}: PortfolioPositionsFilterBarProps) => {
  const hasActiveFilters = hasActivePortfolioPositionFilters(
    networkFilter,
    marketFilter,
    searchTerm
  );

  const clearAllFilters = () => {
    onNetworkFilterChange("all");
    onMarketFilterChange("all");
    onSearchTermChange("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-xl border border-border/80 bg-muted/25 px-2.5 py-2 shadow-sm dark:bg-muted/10 sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <PortfolioNetworkFilterDropdown
            value={networkFilter}
            onChange={onNetworkFilterChange}
            compact
          />
          <MarketsTierFilter
            hideLabel
            value={marketFilter}
            onChange={onMarketFilterChange}
            hasDMarketTab={hasDMarketTab}
            isMobile={isMobile}
            className="min-w-0"
          />
          <div className="relative min-w-0 flex-1 basis-[12rem] sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 border-border bg-background/80 pl-9 text-sm dark:bg-slate-800/40"
            />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          {networkFilter !== "all" && (
            <ActiveFilterChip
              label={portfolioNetworkFilterLabel(networkFilter)}
              onRemove={() => onNetworkFilterChange("all")}
            />
          )}
          {marketFilter !== "all" && (
            <ActiveFilterChip
              label={portfolioMarketFilterLabel(marketFilter)}
              onRemove={() => onMarketFilterChange("all")}
            />
          )}
          {searchTerm.trim() !== "" && (
            <ActiveFilterChip
              label={`"${searchTerm.trim()}"`}
              onRemove={() => onSearchTermChange("")}
            />
          )}
        </div>
      )}
    </div>
  );
};

export function PortfolioPositionsFilteredEmptyState({
  totalCount,
  entityLabel,
  onClearFilters,
}: {
  totalCount: number;
  entityLabel: string;
  onClearFilters: () => void;
}) {
  if (totalCount === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>No {entityLabel}</p>
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <p className="font-medium text-foreground">
        No {entityLabel} match your filters
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try adjusting network, market, or search filters.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={onClearFilters}
      >
        Clear filters
      </Button>
    </div>
  );
}

export default PortfolioPositionsFilterBar;
