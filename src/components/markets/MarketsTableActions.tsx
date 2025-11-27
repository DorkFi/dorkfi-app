
import DorkFiButton from "@/components/ui/DorkFiButton";
import { ArrowRightLeft } from "lucide-react";

interface MarketsTableActionsProps {
  asset: string;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
  onMigrateClick?: (asset: string) => void;
  migrationBalance?: string; // Formatted balance to display
  isLoadingBalance?: boolean;
  isSToken?: boolean;
}

const MarketsTableActions = ({ 
  asset, 
  onDepositClick, 
  onBorrowClick, 
  onMintClick,
  onMigrateClick,
  migrationBalance,
  isLoadingBalance = false,
  isSToken = false 
}: MarketsTableActionsProps) => {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-row space-x-2">
        {!isSToken && (
          <DorkFiButton
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onDepositClick(asset);
            }}
            disabled={isLoadingBalance}
          >
            {isLoadingBalance ? "Loading..." : "Deposit"}
          </DorkFiButton>
        )}
        <DorkFiButton
          variant={isSToken ? "mint" : "borrow-outline"}
          onClick={(e) => {
            e.stopPropagation();
            if (isSToken && onMintClick) {
              onMintClick(asset);
            } else {
              onBorrowClick(asset);
            }
          }}
          className={isSToken ? "min-w-[140px] flex-1" : ""}
        >
          {isSToken ? "Mint" : "Borrow"}
        </DorkFiButton>
      </div>
      {onMigrateClick && !isSToken && (
        <DorkFiButton
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onMigrateClick(asset);
          }}
          className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20"
        >
          <ArrowRightLeft className="h-4 w-4" /> 
          {migrationBalance ? `Migrate ${migrationBalance} ${asset}` : "Migrate"}
        </DorkFiButton>
      )}
    </div>
  );
};

export default MarketsTableActions;
