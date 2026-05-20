
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  OnDemandMarketData,
  SortField,
  SortOrder,
  type MarketFilter,
} from "@/hooks/useOnDemandMarketData";
import MarketsDesktopTable from "./MarketsDesktopTable";
import MarketsTabletTable from "./MarketsTabletTable";
import MarketCardView from "./MarketCardView";

interface MarketsTableContentProps {
  marketFilter?: MarketFilter;
  markets: OnDemandMarketData[];
  sortField?: SortField;
  sortOrder?: SortOrder;
  userDeposits?: Record<string, number>;
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onWithdrawClick?: (asset: string) => void;
  onBorrowClick: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onMintClick?: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onMigrateClick?: (asset: string) => void;
  isLoadingBalance?: boolean;
}

const MarketsTableContent = ({
  marketFilter = "all",
  markets,
  sortField,
  sortOrder,
  userDeposits,
  onRowClick, 
  onInfoClick, 
  onDepositClick, 
  onWithdrawClick, 
  onBorrowClick,
  onMintClick,
  onMigrateClick,
  isLoadingBalance = false 
}: MarketsTableContentProps) => {
  const breakpoint = useBreakpoint();

  if (breakpoint === "mobile") {
    return (
      <MarketCardView
        key={marketFilter}
        markets={markets}
        onRowClick={onRowClick}
        onInfoClick={onInfoClick}
        onDepositClick={onDepositClick}
        onBorrowClick={onBorrowClick}
        onMintClick={onMintClick}
        onMigrateClick={onMigrateClick}
      />
    );
  }

  if (breakpoint === "tablet") {
    return (
      <MarketsTabletTable
        markets={markets}
        sortField={sortField}
        sortOrder={sortOrder}
        onRowClick={onRowClick}
        onInfoClick={onInfoClick}
        onDepositClick={onDepositClick}
        onBorrowClick={onBorrowClick}
        onMintClick={onMintClick}
        onMigrateClick={onMigrateClick}
        isLoadingBalance={isLoadingBalance}
      />
    );
  }

  // desktop
  return (
    <MarketsDesktopTable
      markets={markets}
      sortField={sortField}
      sortOrder={sortOrder}
      onRowClick={onRowClick}
      onInfoClick={onInfoClick}
      onDepositClick={onDepositClick}
      onBorrowClick={onBorrowClick}
      onMintClick={onMintClick}
      onMigrateClick={onMigrateClick}
      isLoadingBalance={isLoadingBalance}
    />
  );
};

export default MarketsTableContent;
