
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsDesktopTable from "./MarketsDesktopTable";
import MarketsTabletTable from "./MarketsTabletTable";
import MarketCardView from "./MarketCardView";

interface MarketsTableContentProps {
  markets: OnDemandMarketData[];
  userDeposits?: Record<string, number>;
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onWithdrawClick?: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
  onMigrateClick?: (asset: string) => void;
  isLoadingBalance?: boolean;
}

const MarketsTableContent = ({ 
  markets, 
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
