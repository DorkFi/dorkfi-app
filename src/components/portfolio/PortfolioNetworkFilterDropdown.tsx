import { ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNetworkConfig, type NetworkId } from "@/config";
import { getNetworkLogoPath } from "@/utils/tokenImageUtils";
import type { PortfolioNetworkFilterValue } from "@/utils/portfolioMarketFilter";
import { cn } from "@/lib/utils";

export type { PortfolioNetworkFilterValue };

const PORTFOLIO_NETWORK_FILTER_OPTIONS: {
  value: PortfolioNetworkFilterValue;
  label: string;
  networkId?: NetworkId;
}[] = [
  { value: "all", label: "All Networks" },
  {
    value: "algorand",
    label: "Algorand Mainnet",
    networkId: "algorand-mainnet",
  },
  { value: "voi", label: "VOI Network", networkId: "voi-mainnet" },
];

function optionForValue(value: PortfolioNetworkFilterValue) {
  return (
    PORTFOLIO_NETWORK_FILTER_OPTIONS.find((o) => o.value === value) ??
    PORTFOLIO_NETWORK_FILTER_OPTIONS[0]
  );
}

interface PortfolioNetworkFilterDropdownProps {
  value: PortfolioNetworkFilterValue;
  onChange: (value: PortfolioNetworkFilterValue) => void;
  className?: string;
  /** When true, show a section label above the trigger (desktop filter rows). */
  showLabel?: boolean;
  /** Compact inline toolbar style (Markets page). */
  compact?: boolean;
}

const PortfolioNetworkFilterDropdown = ({
  value,
  onChange,
  className,
  showLabel = false,
  compact = false,
}: PortfolioNetworkFilterDropdownProps) => {
  const active = optionForValue(value);
  const activeNetworkId = active.networkId;

  return (
    <div className={cn("min-w-0", className)}>
      {showLabel && (
        <span className="mb-2 block text-sm font-medium">Network</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "justify-between gap-1.5 rounded-lg border-border bg-muted/40 px-2.5 text-xs dark:bg-muted/25 hover:bg-muted/60 dark:hover:bg-muted/35 sm:text-sm",
              compact
                ? "h-8 w-auto shrink-0"
                : "h-9 w-full min-w-[10.5rem] sm:min-w-[12rem]"
            )}
            aria-label={`Network filter: ${active.label}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {activeNetworkId ? (
                <img
                  src={getNetworkLogoPath(activeNetworkId)}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/placeholder.svg";
                  }}
                />
              ) : (
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate font-medium", compact && "max-w-[9rem] sm:max-w-none")}>
                {active.label}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Network
          </div>
          <DropdownMenuSeparator />
          {PORTFOLIO_NETWORK_FILTER_OPTIONS.map((option) => {
            const isActive = value === option.value;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onChange(option.value)}
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {option.networkId ? (
                    <img
                      src={getNetworkLogoPath(option.networkId)}
                      alt=""
                      className="h-5 w-5 rounded-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                  ) : (
                    <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {option.networkId
                      ? getNetworkConfig(option.networkId).name
                      : option.label}
                  </span>
                </div>
                {isActive && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default PortfolioNetworkFilterDropdown;
