import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  userBalance: number;
  marketStats: {
    supplyAPY: number;
    utilization: number;
    collateralFactor: number;
    tokenPrice: number;
  };
}

const DepositModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  userBalance,
  marketStats,
}: DepositModalProps) => {
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

  useEffect(() => {
    if (amount) {
      const numAmount = parseFloat(amount);
      setFiatValue(numAmount * marketStats.tokenPrice);
    } else {
      setFiatValue(0);
    }
  }, [amount, marketStats.tokenPrice]);

  const handleMaxClick = () => {
    setAmount(userBalance.toString());
  };

  const handleSubmit = () => {
    console.log(`Deposit ${amount} ${tokenSymbol}`);

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

  const isValidAmount =
    amount && parseFloat(amount) > 0 && parseFloat(amount) <= userBalance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-md px-0 py-0">
        {showSuccess ? (
          <div className="p-6">
            <SupplyBorrowCongrats
              transactionType="deposit"
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
              <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                Deposit
              </DialogTitle>
              <DialogDescription className="text-center mt-1 text-sm text-slate-400 dark:text-slate-400">
                Enter the amount to deposit. Your available balance and rates
                are shown below.
              </DialogDescription>
              <div className="flex items-center justify-center gap-3 pb-2 mt-3">
                <img
                  src={tokenIcon}
                  alt={tokenSymbol}
                  className="w-12 h-12 rounded-full shadow"
                />
                <span className="text-xl font-semibold text-slate-800 dark:text-white">
                  {tokenSymbol}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-6 pt-2 px-8 pb-8">
              <div className="space-y-3">
                <Label
                  htmlFor="amount"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  Amount
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMaxClick}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:bg-teal-400/10 h-8 px-3"
                  >
                    MAX
                  </Button>
                </div>
                {fiatValue > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ≈ $
                    {fiatValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Wallet Balance: {userBalance.toLocaleString()} {tokenSymbol}
                  (${(userBalance * marketStats.tokenPrice).toLocaleString()})
                </p>
              </div>

              <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Supply APY
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Annual percentage yield for supplying {tokenSymbol}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                      {marketStats.supplyAPY.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Utilization
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Percentage of supplied assets being borrowed</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                      {marketStats.utilization.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Collateral Factor
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Maximum borrowing power from this collateral</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                      {marketStats.collateralFactor}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleSubmit}
                disabled={!isValidAmount}
                className="w-full font-semibold text-white h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deposit {tokenSymbol}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
