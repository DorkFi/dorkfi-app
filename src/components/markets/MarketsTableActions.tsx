
import DorkFiButton from "@/components/ui/DorkFiButton";

interface MarketsTableActionsProps {
  asset: string;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
  isLoadingBalance?: boolean;
  isSToken?: boolean;
}

const MarketsTableActions = ({ 
  asset, 
  onDepositClick, 
  onBorrowClick, 
  onMintClick,
  isLoadingBalance = false,
  isSToken = false 
}: MarketsTableActionsProps) => {
  return (
    <div className="flex space-x-2">
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
        className={isSToken ? "w-full" : ""}
      >
        {isSToken ? "Mint" : "Borrow"}
      </DorkFiButton>
    </div>
  );
};

export default MarketsTableActions;
