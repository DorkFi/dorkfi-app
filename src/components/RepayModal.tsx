import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  currentBorrow: number;
  accruedInterest: number;
  walletBalance: number;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number;
    currentLTV: number;
    tokenPrice: number;
  };
  onSubmit: (amount: string) => Promise<void>;
}

const RepayModal = ({ isOpen, onClose, tokenSymbol, tokenIcon, currentBorrow, accruedInterest, walletBalance, marketStats, onSubmit }: RepayModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<{
    borrowAPY: boolean;
    accruedInterest: boolean;
    liquidationMargin: boolean;
    healthFactor: boolean;
    ltv: boolean;
  }>({
    borrowAPY: false,
    accruedInterest: false,
    liquidationMargin: false,
    healthFactor: false,
    ltv: false,
  });

  // Get health factor label and color based on ranges
  const getHealthFactorLabel = (healthFactor: number): { label: string; color: string } => {
    if (healthFactor >= 3.0) {
      return { label: "Safe", color: "text-green-600 dark:text-green-400" };
    } else if (healthFactor >= 1.5) {
      return { label: "Moderate", color: "text-blue-600 dark:text-blue-400" };
    } else if (healthFactor >= 1.2) {
      return { label: "Caution", color: "text-yellow-600 dark:text-yellow-400" };
    } else if (healthFactor >= 1.0) {
      return { label: "Critical", color: "text-orange-600 dark:text-orange-400" };
    } else {
      return { label: "Liquidatable", color: "text-red-600 dark:text-red-400" };
    }
  };

  const healthFactorLabel = getHealthFactorLabel(marketStats.healthFactor);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setIsLoading(false);
      setExpandedDetails({
        borrowAPY: false,
        accruedInterest: false,
        liquidationMargin: false,
        healthFactor: false,
        ltv: false,
      });
    }
  }, [isOpen]);

  const toggleDetail = (key: keyof typeof expandedDetails) => {
    setExpandedDetails(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    if (amount) {
      const numAmount = parseFloat(amount);
      setFiatValue(numAmount * marketStats.tokenPrice);
    } else {
      setFiatValue(0);
    }
  }, [amount, marketStats.tokenPrice]);

  const maxRepayAmount = Math.min(currentBorrow, walletBalance);

  const handleMaxClick = () => {
    setAmount(maxRepayAmount.toString());
  };

  const handleSubmit = async () => {
    console.log(`Repay ${amount} ${tokenSymbol}`);
    
    try {
      setIsLoading(true);
      
      // Call the onSubmit prop with the amount and wait for it to complete
      await onSubmit(amount);
      
      // Only show success modal after transaction is actually completed
      setShowSuccess(true);
    } catch (error) {
      console.error("Repay transaction failed:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
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

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= maxRepayAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-[95vw] md:max-w-lg lg:max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col px-0 py-0">
          {showSuccess ? (
            <div className="p-6 overflow-y-auto">
              <SupplyBorrowCongrats
                transactionType="repay"
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
            <div className="flex flex-col h-full">
              <div className="sticky top-0 z-20 bg-card dark:bg-slate-900 pt-6 px-6 md:px-8 lg:px-10 pb-4 border-b border-gray-200/50 dark:border-slate-700/50">
                <DialogHeader className="pb-0">
                  <div className="flex items-center justify-center gap-4">
                    <img 
                      src={tokenIcon} 
                      alt={tokenSymbol}
                      className="w-14 h-14 rounded-full ring-2 ring-whale-gold/20 dark:ring-whale-gold/30"
                    />
                    <div className="flex flex-col items-start">
                      <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                        Repay {tokenSymbol}
                      </DialogTitle>
                      <span className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        ${marketStats.tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    </div>
                  </div>
                </DialogHeader>
              </div>
              
              <div className="flex-1 overflow-y-auto overscroll-contain pt-2 px-6 md:px-8 lg:px-10 pb-6 md:pb-8 touch-pan-y">
                <div className="flex flex-col lg:flex-row lg:gap-8 space-y-6 lg:space-y-0">
                  {/* Left Column: Input Form */}
                  <div className="flex-1 space-y-6 min-w-0">
                    <div className="space-y-3">
                      <Label htmlFor="amount" className="text-sm font-medium text-slate-600 dark:text-slate-300">
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-whale-gold hover:bg-whale-gold/10 h-8 px-3"
                        >
                          MAX
                        </Button>
                      </div>
                      {fiatValue > 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          ≈ ${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                      <div className="pt-2">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-row justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Wallet Balance</p>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                {walletBalance.toLocaleString()} {tokenSymbol} 
                                <span className="text-slate-500 dark:text-slate-400 ml-1">
                                  (${(walletBalance * marketStats.tokenPrice).toLocaleString()})
                                </span>
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current Borrow</p>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                {currentBorrow.toLocaleString()} {tokenSymbol} 
                                <span className="text-slate-500 dark:text-slate-400 ml-1">
                                  (${(currentBorrow * marketStats.tokenPrice).toLocaleString()})
                                </span>
                              </p>
                            </div>
                          </div>
                          {accruedInterest > 0 && (
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Accrued Interest</p>
                              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium break-words">
                                {accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenSymbol} 
                                <span className="text-amber-600 dark:text-amber-400 ml-1">
                                  (${(accruedInterest * marketStats.tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                </span>
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                This is the interest that has accrued on your borrow since you borrowed. It's included in your current borrow amount.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={!isValidAmount || isLoading}
                      className="w-full font-semibold h-12 bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed lg:mt-auto"
                    >
                      {isLoading ? "Processing..." : `Repay ${tokenSymbol}`}
                    </Button>
                  </div>

                  {/* Right Column: Stats Card */}
                  <div className="lg:w-80 lg:flex-shrink-0">
                    <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700 lg:sticky lg:top-4">
                      <CardContent className="p-3 md:p-5 lg:p-6">
                        <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 md:mb-4">Position Details</h3>
                        <div className="space-y-2 md:space-y-4">
                          {/* Borrow APY */}
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail('borrowAPY')}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Borrow APY</span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.borrowAPY ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">{marketStats.borrowAPY.toFixed(2)}%</span>
                            </div>
                            {expandedDetails.borrowAPY && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Annual percentage yield for borrowing {tokenSymbol}. This is the interest rate you'll pay on your borrowed amount.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Accrued Interest */}
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail('accruedInterest')}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Accrued Interest</span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.accruedInterest ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400">
                                {accruedInterest > 0 
                                  ? `${accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${tokenSymbol}`
                                  : `0 ${tokenSymbol}`}
                              </span>
                            </div>
                            {expandedDetails.accruedInterest && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                  The interest that has accrued on your borrow since you borrowed. This is included in your current borrow amount.
                                </p>
                                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                  <p className="font-semibold">Current Borrow: {currentBorrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenSymbol}</p>
                                  <p className="text-amber-600 dark:text-amber-400">Accrued Interest: {accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenSymbol}</p>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    USD Value: ${(accruedInterest * marketStats.tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Liquidation Margin */}
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail('liquidationMargin')}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Liquidation Margin</span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.liquidationMargin ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-teal-600 dark:text-teal-400">{marketStats.liquidationMargin.toFixed(2)}%</span>
                            </div>
                            {expandedDetails.liquidationMargin && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  How much safety margin you have before your position can be liquidated. Higher values mean more safety.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Health Factor */}
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail('healthFactor')}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Health Factor</span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.healthFactor ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className={`text-xs md:text-sm font-medium ${healthFactorLabel.color}`}>
                                {healthFactorLabel.label} ({marketStats.healthFactor.toFixed(2)})
                              </span>
                            </div>
                            {expandedDetails.healthFactor && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 space-y-2">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Health Factor = (Collateral × 0.8) / Borrowed
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {marketStats.healthFactor >= 3.0
                                    ? `✓ Safe: ${marketStats.healthFactor.toFixed(2)} (excellent health)`
                                    : marketStats.healthFactor >= 1.5
                                    ? `✓ Moderate: ${marketStats.healthFactor.toFixed(2)} (good health)`
                                    : marketStats.healthFactor >= 1.2
                                    ? `⚠ Caution: ${marketStats.healthFactor.toFixed(2)} (monitor closely)`
                                    : marketStats.healthFactor >= 1.0
                                    ? `⚠ Critical: ${marketStats.healthFactor.toFixed(2)} (at liquidation threshold)`
                                    : `✗ Liquidatable: ${marketStats.healthFactor.toFixed(2)} (can be liquidated)`}
                                </p>
                                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                  <p>• Safe (≥3.0): Excellent health</p>
                                  <p>• Moderate (≥1.5): Good health</p>
                                  <p>• Caution (≥1.2): Monitor closely</p>
                                  <p>• Critical (≥1.0): At liquidation threshold</p>
                                  <p>• Liquidatable (&lt;1.0): Can be liquidated</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* LTV */}
                          <div>
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail('ltv')}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">LTV</span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.ltv ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">{marketStats.currentLTV.toFixed(2)}%</span>
                            </div>
                            {expandedDetails.ltv && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Loan-to-Value ratio of your position. This shows what percentage of your collateral is being used for borrowing.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
    </Dialog>
  );
};

export default RepayModal;
