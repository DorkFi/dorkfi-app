import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import PortfolioPositionsFilterBar from "@/components/portfolio/PortfolioPositionsFilterBar";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { H1 } from "@/components/ui/Typography";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RefreshCw } from "lucide-react";
import type { PortfolioNetworkFilterValue } from "@/utils/portfolioMarketFilter";

interface PortfolioPositionsCardHeaderProps {
  portfolioPositionsTab: "supplied" | "borrowed";
  onTabChange: (tab: "supplied" | "borrowed") => void;
  hasBothPositionTypes: boolean;
  hasSupplied: boolean;
  hasBorrowed: boolean;
  filteredSuppliedCount: number;
  filteredBorrowedCount: number;
  isViewOnly: boolean;
  refreshingSection: string | null;
  onRefreshSupplied: () => void;
  onRefreshBorrowed: () => void;
  networkFilter: PortfolioNetworkFilterValue;
  onNetworkFilterChange: (value: PortfolioNetworkFilterValue) => void;
  marketFilter: MarketFilter;
  onMarketFilterChange: (value: MarketFilter) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  hasDMarketTab: boolean;
  isMobile: boolean;
}

const PortfolioPositionsCardHeader = ({
  portfolioPositionsTab,
  onTabChange,
  hasBothPositionTypes,
  hasSupplied,
  hasBorrowed,
  filteredSuppliedCount,
  filteredBorrowedCount,
  isViewOnly,
  refreshingSection,
  onRefreshSupplied,
  onRefreshBorrowed,
  networkFilter,
  onNetworkFilterChange,
  marketFilter,
  onMarketFilterChange,
  searchTerm,
  onSearchTermChange,
  hasDMarketTab,
  isMobile,
}: PortfolioPositionsCardHeaderProps) => {
  const showToggle = hasBothPositionTypes;

  const activeRefreshSection = showToggle
    ? portfolioPositionsTab === "supplied"
      ? "Supplied Assets"
      : "Borrowed Assets"
    : hasSupplied
      ? "Supplied Assets"
      : "Borrowed Assets";

  const handleRefresh = () => {
    if (showToggle) {
      if (portfolioPositionsTab === "supplied") {
        onRefreshSupplied();
      } else {
        onRefreshBorrowed();
      }
      return;
    }
    if (hasSupplied) onRefreshSupplied();
    if (hasBorrowed) onRefreshBorrowed();
  };

  const refreshTitle = isViewOnly
    ? "Refresh market data (view-only mode)"
    : showToggle
      ? portfolioPositionsTab === "supplied"
        ? "Refresh market data for supplied assets"
        : "Refresh market data for borrowed assets"
      : "Refresh market data for positions";

  return (
    <div className="mb-4 md:mb-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <H1 className="m-0 shrink-0 text-xl md:text-2xl">Positions</H1>
          {showToggle && (
            <ToggleGroup
              type="single"
              value={portfolioPositionsTab}
              onValueChange={(v) => {
                if (v === "supplied" || v === "borrowed") {
                  onTabChange(v);
                }
              }}
              variant="outline"
              className="inline-flex w-full max-w-md gap-0 rounded-lg border border-input bg-background p-1 shadow-sm sm:w-auto"
              aria-label="Switch between supplied and borrowed positions"
            >
              <ToggleGroupItem
                value="supplied"
                className="flex-1 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:min-w-[8rem]"
              >
                Supplied ({filteredSuppliedCount})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="borrowed"
                className="flex-1 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:min-w-[8rem]"
              >
                Borrowed ({filteredBorrowedCount})
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        <DorkFiButton
          onClick={handleRefresh}
          disabled={refreshingSection === activeRefreshSection}
          variant="secondary"
          size="sm"
          className="shrink-0 self-start lg:self-auto"
          title={refreshTitle}
        >
          <RefreshCw
            className={`mr-1.5 h-3 w-3 ${refreshingSection === activeRefreshSection ? "animate-spin" : ""}`}
          />
          Refresh
        </DorkFiButton>
      </div>
      <PortfolioPositionsFilterBar
        networkFilter={networkFilter}
        onNetworkFilterChange={onNetworkFilterChange}
        marketFilter={marketFilter}
        onMarketFilterChange={onMarketFilterChange}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        hasDMarketTab={hasDMarketTab}
        isMobile={isMobile}
      />
    </div>
  );
};

export default PortfolioPositionsCardHeader;
