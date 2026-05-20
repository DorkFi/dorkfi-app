
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { OnDemandMarketData, SortField, SortOrder } from "@/hooks/useOnDemandMarketData";
import MarketsDesktopTable from "./MarketsDesktopTable";
import MarketsTabletTable from "./MarketsTabletTable";
import MarketCardView from "./MarketCardView";

interface MarketsTableContentProps {
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
  getMarketActionHoverHandlers?: (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    onDepositMouseEnter?: (e: React.MouseEvent) => void;
    onBorrowMouseEnter?: (e: React.MouseEvent) => void;
    onMintMouseEnter?: (e: React.MouseEvent) => void;
  };
  onRowMouseEnter?: (market: OnDemandMarketData) => void;
}

const MarketsTableContent = ({ 
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
  isLoadingBalance = false,
  getMarketActionHoverHandlers,
  onRowMouseEnter,
}: MarketsTableContentProps) => {
  const breakpoint = useBreakpoint();

  if (breakpoint === "mobile") {
    return (
      <MarketCardView
        markets={markets}
        onRowClick={onRowClick}
        onInfoClick={onInfoClick}
        onDepositClick={onDepositClick}
        onBorrowClick={onBorrowClick}
        onMintClick={onMintClick}
        onMigrateClick={onMigrateClick}
        getMarketActionHoverHandlers={getMarketActionHoverHandlers}
        onRowMouseEnter={onRowMouseEnter}
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
        getMarketActionHoverHandlers={getMarketActionHoverHandlers}
        onRowMouseEnter={onRowMouseEnter}
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
      getMarketActionHoverHandlers={getMarketActionHoverHandlers}
      onRowMouseEnter={onRowMouseEnter}
    />
  );
};

export default MarketsTableContent;
