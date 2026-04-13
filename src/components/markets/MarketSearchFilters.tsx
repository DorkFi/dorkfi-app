import { Search, SortAsc, SortDesc, Sparkles, Gift, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SortField, SortOrder } from "@/hooks/useOnDemandMarketData";

interface MarketSearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  /** When > 0, shows "New markets only" toggle. */
  newMarketsCount?: number;
  newMarketsOnly?: boolean;
  onNewMarketsOnlyChange?: (value: boolean) => void;
  /** When > 0, shows "Reward markets only" toggle. */
  rewardMarketsCount?: number;
  rewardMarketsOnly?: boolean;
  onRewardMarketsOnlyChange?: (value: boolean) => void;
  /** When > 0, shows "Multi-pool" toggle. */
  multiPoolMarketsCount?: number;
  multiPoolOnly?: boolean;
  onMultiPoolOnlyChange?: (value: boolean) => void;
}

const MarketSearchFilters = ({
  searchTerm,
  onSearchChange,
  sortField,
  sortOrder,
  onSortChange,
  newMarketsCount = 0,
  newMarketsOnly = false,
  onNewMarketsOnlyChange,
  rewardMarketsCount = 0,
  rewardMarketsOnly = false,
  onRewardMarketsOnlyChange,
  multiPoolMarketsCount = 0,
  multiPoolOnly = false,
  onMultiPoolOnlyChange,
}: MarketSearchFiltersProps) => {
  const handleSortFieldChange = (field: SortField) => {
    onSortChange(field, sortOrder);
  };

  const toggleSortOrder = () => {
    onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 md:p-6 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-600 dark:text-ocean-teal h-4 w-4" />
          <Input
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30 focus:border-ocean-teal text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-muted-foreground w-full"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={sortField} onValueChange={handleSortFieldChange}>
            <SelectTrigger className="w-full md:w-48 bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30 text-slate-800 dark:text-white">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="totalSupplyUSD">Total Supply</SelectItem>
              <SelectItem value="supplyAPY">Deposit APY</SelectItem>
              <SelectItem value="totalBorrowUSD">Total Borrow</SelectItem>
              <SelectItem value="borrowAPY">Borrow APY</SelectItem>
              <SelectItem value="utilization">Utilization</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            className="border-gray-300 dark:border-ocean-teal/30 hover:bg-ocean-teal/10 text-slate-700 dark:text-ocean-teal"
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {((newMarketsCount > 0 && onNewMarketsOnlyChange) ||
        (rewardMarketsCount > 0 && onRewardMarketsOnlyChange) ||
        (multiPoolMarketsCount > 0 && onMultiPoolOnlyChange)) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-5">
          {newMarketsCount > 0 && onNewMarketsOnlyChange && (
            <div className="flex items-center gap-2">
              <Switch
                id="markets-new-only"
                checked={newMarketsOnly}
                onCheckedChange={onNewMarketsOnlyChange}
                aria-label="Show new markets only"
              />
              <Label
                htmlFor="markets-new-only"
                className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-ocean-teal shrink-0" aria-hidden />
                New markets only
                <span className="text-xs font-normal text-muted-foreground">
                  ({newMarketsCount})
                </span>
              </Label>
            </div>
          )}
          {rewardMarketsCount > 0 && onRewardMarketsOnlyChange && (
            <div className="flex items-center gap-2">
              <Switch
                id="markets-rewards-only"
                checked={rewardMarketsOnly}
                onCheckedChange={onRewardMarketsOnlyChange}
                aria-label="Show reward markets only"
              />
              <Label
                htmlFor="markets-rewards-only"
                className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <Gift className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                Reward markets only
                <span className="text-xs font-normal text-muted-foreground">
                  ({rewardMarketsCount})
                </span>
              </Label>
            </div>
          )}
          {multiPoolMarketsCount > 0 && onMultiPoolOnlyChange && (
            <div className="flex items-center gap-2">
              <Switch
                id="markets-multi-pool-only"
                checked={multiPoolOnly}
                onCheckedChange={onMultiPoolOnlyChange}
                aria-label="Show multi-pool markets only"
              />
              <Label
                htmlFor="markets-multi-pool-only"
                className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5 text-ocean-teal shrink-0" aria-hidden />
                Multi-pool
                <span className="text-xs font-normal text-muted-foreground">
                  ({multiPoolMarketsCount})
                </span>
              </Label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketSearchFilters;
