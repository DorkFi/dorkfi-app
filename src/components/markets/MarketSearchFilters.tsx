import { useState, type ReactNode } from "react";
import {
  Search,
  SortAsc,
  SortDesc,
  Sparkles,
  Gift,
  Layers,
  SlidersHorizontal,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SortField, SortOrder, type MarketFilter } from "@/hooks/useOnDemandMarketData";
import MarketsTierFilter from "@/components/markets/MarketsTierFilter";

interface MarketSearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  marketFilter: MarketFilter;
  onMarketFilterChange: (value: MarketFilter) => void;
  hasDMarketTab: boolean;
  isMobile?: boolean;
  newMarketsCount?: number;
  newMarketsOnly?: boolean;
  onNewMarketsOnlyChange?: (value: boolean) => void;
  rewardMarketsCount?: number;
  rewardMarketsOnly?: boolean;
  onRewardMarketsOnlyChange?: (value: boolean) => void;
  multiPoolMarketsCount?: number;
  multiPoolOnly?: boolean;
  onMultiPoolOnlyChange?: (value: boolean) => void;
  hasActiveFilters?: boolean;
  onClearAll?: () => void;
  embedded?: boolean;
}

function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-ocean-teal/50 bg-ocean-teal/15 text-ocean-teal dark:text-ocean-teal"
          : "border-border bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

const MarketSearchFilters = ({
  searchTerm,
  onSearchChange,
  sortField,
  sortOrder,
  onSortChange,
  marketFilter,
  onMarketFilterChange,
  hasDMarketTab,
  isMobile = false,
  newMarketsCount = 0,
  newMarketsOnly = false,
  onNewMarketsOnlyChange,
  rewardMarketsCount = 0,
  rewardMarketsOnly = false,
  onRewardMarketsOnlyChange,
  multiPoolMarketsCount = 0,
  multiPoolOnly = false,
  onMultiPoolOnlyChange,
  hasActiveFilters = false,
  onClearAll,
  embedded = false,
}: MarketSearchFiltersProps) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSortFieldChange = (field: SortField) => {
    onSortChange(field, sortOrder);
  };

  const toggleSortOrder = () => {
    onSortChange(sortField, sortOrder === "asc" ? "desc" : "asc");
  };

  const applyQuickSort = (field: SortField) => {
    onSortChange(field, "desc");
  };

  const topSupplyActive = sortField === "supplyAPY" && sortOrder === "desc";
  const topBorrowActive = sortField === "borrowAPY" && sortOrder === "desc";

  return (
    <div
      className={cn(
        embedded
          ? "mt-3"
          : "rounded-xl p-4 md:p-6 border border-gray-200/50 dark:border-ocean-teal/20 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 shadow-md"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <MarketsTierFilter
              hideLabel
              value={marketFilter}
              onChange={onMarketFilterChange}
              hasDMarketTab={hasDMarketTab}
              isMobile={isMobile}
            />
          </div>
          {hasActiveFilters && onClearAll && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-8 shrink-0 gap-1 self-start text-muted-foreground hover:text-foreground sm:self-end"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-ocean-teal h-4 w-4" />
            <Input
              placeholder="Search by asset name..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30 focus:border-ocean-teal text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-muted-foreground w-full"
            />
          </div>

          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-gray-300 dark:border-ocean-teal/30 shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" />
                More filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Sort
              </p>
              <div className="flex items-center gap-2">
                <Select value={sortField} onValueChange={handleSortFieldChange}>
                  <SelectTrigger className="flex-1 bg-background">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="totalSupplyUSD">Total supply</SelectItem>
                    <SelectItem value="supplyAPY">Supply APY</SelectItem>
                    <SelectItem value="totalBorrowUSD">Total borrow</SelectItem>
                    <SelectItem value="borrowAPY">Borrow APY</SelectItem>
                    <SelectItem value="utilization">Utilization</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleSortOrder}
                  aria-label="Toggle sort direction"
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {multiPoolMarketsCount > 0 && onMultiPoolOnlyChange && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiPoolOnly}
                    onChange={(e) => onMultiPoolOnlyChange(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Layers className="h-3.5 w-3.5 text-ocean-teal" />
                  Multi-pool only ({multiPoolMarketsCount})
                </label>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={topSupplyActive}
            onClick={() => applyQuickSort("supplyAPY")}
          >
            <TrendingUp className="h-3 w-3" />
            Top supply APY
          </FilterChip>
          <FilterChip
            active={topBorrowActive}
            onClick={() => applyQuickSort("borrowAPY")}
          >
            <TrendingUp className="h-3 w-3" />
            Top borrow APY
          </FilterChip>
          {rewardMarketsCount > 0 && onRewardMarketsOnlyChange && (
            <FilterChip
              active={rewardMarketsOnly}
              onClick={() => onRewardMarketsOnlyChange(!rewardMarketsOnly)}
            >
              <Gift className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Rewards ({rewardMarketsCount})
            </FilterChip>
          )}
          {newMarketsCount > 0 && onNewMarketsOnlyChange && (
            <FilterChip
              active={newMarketsOnly}
              onClick={() => onNewMarketsOnlyChange(!newMarketsOnly)}
            >
              <Sparkles className="h-3 w-3 text-ocean-teal" />
              New ({newMarketsCount})
            </FilterChip>
          )}
          {multiPoolMarketsCount > 0 &&
            onMultiPoolOnlyChange &&
            multiPoolOnly && (
              <FilterChip
                active={multiPoolOnly}
                onClick={() => onMultiPoolOnlyChange(false)}
              >
                <Layers className="h-3 w-3" />
                Multi-pool
              </FilterChip>
            )}
        </div>
      </div>
    </div>
  );
};

export default MarketSearchFilters;
