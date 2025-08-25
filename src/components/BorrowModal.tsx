
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import BorrowHeader from "./BorrowHeader";
import BorrowForm from "./BorrowForm";
import BorrowStats from "./BorrowStats";

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  availableToBorrow: number;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number;
    currentLTV: number;
    tokenPrice: number;
  };
}

const BorrowModal = ({ isOpen, onClose, tokenSymbol, tokenIcon, availableToBorrow, marketStats }: BorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
    }
  }, [isOpen]);

  const handleAmountChange = (newAmount: string, newFiatValue: number) => {
    setAmount(newAmount);
    setFiatValue(newFiatValue);
  };

  const handleSubmit = () => {
    console.log(`Borrow ${amount} ${tokenSymbol}`);
    
    setTimeout(() => {
      setShowSuccess(true);
    }, 500);
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-md px-0 py-0">
          {showSuccess ? (
            <div className="p-6">
              <SupplyBorrowCongrats
                transactionType="borrow"
                asset={tokenSymbol}
                assetIcon={tokenIcon}
                amount={amount}
                onViewTransaction={handleViewTransaction}
                onGoToPortfolio={handleGoToPortfolio}
                onMakeAnother={handleMakeAnother}
                onClose={onClose}
              />
            </div>
          ) : (
            <>
              <DialogHeader className="pt-6 px-8 pb-1">
                <DialogTitle className="sr-only">Borrow {tokenSymbol}</DialogTitle>
                <BorrowHeader 
                  tokenSymbol={tokenSymbol}
                  tokenIcon={tokenIcon}
                />
              </DialogHeader>
              
              <div className="space-y-6 pt-2 px-8 pb-8">
                <BorrowForm
                  tokenSymbol={tokenSymbol}
                  availableToBorrow={availableToBorrow}
                  tokenPrice={marketStats.tokenPrice}
                  onAmountChange={handleAmountChange}
                  onSubmit={handleSubmit}
                />

                <BorrowStats
                  tokenSymbol={tokenSymbol}
                  marketStats={marketStats}
                />
              </div>
            </>
          )}
        </DialogContent>
    </Dialog>
  );
};

export default BorrowModal;
