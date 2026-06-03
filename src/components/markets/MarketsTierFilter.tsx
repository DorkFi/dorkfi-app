import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";
import { cn } from "@/lib/utils";

export const MARKET_TIER_OPTIONS: {
  value: MarketFilter;
  label: string;
  description: string;
  poolLetter?: string;
}[] = [
  {
    value: "all",
    label: "All Markets",
    description: "Every lending market on this network.",
  },
  {
    value: "A",
    label: "A Markets",
    poolLetter: "A",
    description:
      "Core liquidity markets with standard risk parameters and WAD minting support.",
  },
  {
    value: "B",
    label: "B Markets",
    poolLetter: "B",
    description:
      "Isolated higher-risk markets with stricter collateral limits and reduced exposure.",
  },
  {
    value: "D",
    label: "D Markets",
    poolLetter: "D",
    description:
      "Dynamic routing markets that optimize liquidity and yield across multiple pools.",
  },
];

interface MarketsTierFilterProps {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
  hasDMarketTab: boolean;
  isMobile?: boolean;
  totalItems?: number;
  className?: string;
  /** Hide section title (when parent supplies layout). */
  hideLabel?: boolean;
}

function TierHelpButton({
  options,
}: {
  options: typeof MARKET_TIER_OPTIONS;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="About market pool tiers"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs space-y-2 p-3 text-left">
        {options
          .filter((o) => o.value !== "all")
          .map((o) => (
            <div key={o.value}>
              <p className="font-medium text-foreground">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.description}</p>
            </div>
          ))}
      </TooltipContent>
    </Tooltip>
  );
}

const MarketsTierFilter = ({
  value,
  onChange,
  hasDMarketTab,
  isMobile = false,
  totalItems,
  className,
  hideLabel = false,
}: MarketsTierFilterProps) => {
  const options = MARKET_TIER_OPTIONS.filter(
    (o) => o.value !== "D" || hasDMarketTab
  );

  const activeOption = options.find((o) => o.value === value);

  return (
    <div className={cn("min-w-0", className)}>
      {!hideLabel && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pool tier
          </span>
          <TierHelpButton options={options} />
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-2",
          isMobile && "overflow-x-auto pb-0.5"
        )}
        role="radiogroup"
        aria-label="Filter by pool tier"
      >
        {options.map((o) => {
          const isActive = value === o.value;
          const isLetterOnly = !!o.poolLetter;

          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={o.label}
              title={o.description}
              onClick={() => onChange(o.value)}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "inline-flex shrink-0 items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-teal/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isLetterOnly
                  ? "h-9 w-9 rounded-full border text-sm"
                  : "rounded-full border px-3.5 py-2 text-sm",
                isActive
                  ? "border-ocean-teal/60 bg-ocean-teal/15 text-foreground shadow-[0_0_0_1px_rgba(13,255,190,0.25)]"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:border-ocean-teal/35 hover:bg-muted/50 hover:text-foreground dark:bg-slate-800/30",
                isLetterOnly &&
                  isActive &&
                  "ring-2 ring-ocean-teal/40 ring-offset-2 ring-offset-background"
              )}
            >
              {o.poolLetter ? (
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white",
                    marketPoolBadgeBgClassName(o.poolLetter)
                  )}
                >
                  {o.poolLetter}
                </span>
              ) : (
                <span className="whitespace-nowrap">All Markets</span>
              )}
            </button>
          );
        })}
        {hideLabel && <TierHelpButton options={options} />}
      </div>

      {value !== "all" && totalItems != null && !hideLabel && (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Showing {activeOption?.label ?? value} · {totalItems} market
          {totalItems === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
};

export default MarketsTierFilter;
