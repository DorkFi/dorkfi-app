
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import SupplyBorrowHeader from "./SupplyBorrowHeader";
import SupplyBorrowForm from "./SupplyBorrowForm";
import SupplyBorrowStats from "./SupplyBorrowStats";

interface SupplyBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  mode: "deposit" | "borrow";
  assetData: {
    icon: string;
    totalSupply: number;
    totalSupplyUSD: number;
    supplyAPY: number;
    totalBorrow: number;
    totalBorrowUSD: number;
    borrowAPY: number;
    utilization: number;
    collateralFactor: number;
    liquidity: number;
    liquidityUSD: number;
  };
}

const SupplyBorrowModal = ({ isOpen, onClose, asset, mode, assetData }: SupplyBorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Mock user data - in real app this would come from wallet/smart contract
  const mockUserData = {
    walletBalance: mode === "deposit" ? 50000 : 25000,
    walletBalanceUSD: mode === "deposit" ? 50000 : 175000,
  };

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
    console.log(`${mode} ${amount} ${asset}`);
    
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
        <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-md p-6">
          {showSuccess ? (
            <SupplyBorrowCongrats
              transactionType={mode}
              asset={asset}
              assetIcon={assetData.icon}
              amount={amount}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
            />
          ) : (
            <>
              <DialogHeader className="pb-4">
                <DialogTitle className="sr-only">{mode === 'deposit' ? 'Deposit' : 'Borrow'} {asset}</DialogTitle>
                <SupplyBorrowHeader 
                  mode={mode}
                  asset={asset}
                  assetIcon={assetData.icon}
                />
              </DialogHeader>
              
              <div className="space-y-6">
                <SupplyBorrowForm
                  mode={mode}
                  asset={asset}
                  walletBalance={mockUserData.walletBalance}
                  walletBalanceUSD={mockUserData.walletBalanceUSD}
                  availableToSupplyOrBorrow={assetData.liquidity}
                  onAmountChange={handleAmountChange}
                  onSubmit={handleSubmit}
                />

                <SupplyBorrowStats
                  mode={mode}
                  asset={asset}
                  assetData={assetData}
                />
              </div>
            </>
          )}
        </DialogContent>
    </Dialog>
  );
};

export default SupplyBorrowModal;
