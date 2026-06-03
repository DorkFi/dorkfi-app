import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import { MARKET_TIER_OPTIONS } from "@/components/markets/MarketsTierFilter";

interface MarketsTierFilterMobileSelectProps {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
  hasDMarketTab: boolean;
  totalItems?: number;
}

/**
 * Native select for pool tier on narrow viewports — reliable taps on Android Chrome
 * (horizontal pill rows can steal touch events as scroll gestures).
 */
const MarketsTierFilterMobileSelect = ({
  value,
  onChange,
  hasDMarketTab,
  totalItems,
}: MarketsTierFilterMobileSelectProps) => {
  const options = MARKET_TIER_OPTIONS.filter(
    (o) => o.value !== "D" || hasDMarketTab
  );
  const activeOption = options.find((o) => o.value === value);

  return (
    <div className="w-full min-w-0">
      <Select
        value={value}
        onValueChange={(v) => onChange(v as MarketFilter)}
      >
        <SelectTrigger
          className="min-h-11 w-full touch-manipulation bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30"
          aria-label="Filter by pool tier"
        >
          <SelectValue placeholder="All markets" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== "all" && totalItems != null && (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Showing {activeOption?.label ?? value} · {totalItems} market
          {totalItems === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
};

export default MarketsTierFilterMobileSelect;
