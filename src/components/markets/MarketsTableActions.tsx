
import DorkFiButton from "@/components/ui/DorkFiButton";

interface MarketsTableActionsProps {
  asset: string;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
}

const MarketsTableActions = ({ asset, onDepositClick, onBorrowClick }: MarketsTableActionsProps) => {
  return (
    <div className="flex space-x-2">
      <DorkFiButton
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation();
          onDepositClick(asset);
        }}
      >
        Deposit
      </DorkFiButton>
      <DorkFiButton
        variant="borrow-outline"
        onClick={(e) => {
          e.stopPropagation();
          onBorrowClick(asset);
        }}
      >
        Borrow
      </DorkFiButton>
    </div>
  );
};

export default MarketsTableActions;
