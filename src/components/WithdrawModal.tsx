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
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  currentlyDeposited: number;
  nTokenBalance?: number;
  marketStats: {
    supplyAPY: number;
    utilization: number;
    collateralFactor: number;
    tokenPrice: number;
    liquidationMargin?: number;
    healthFactor?: number;
    ltv?: number;
    accruedInterest?: number;
  };
  onSubmit?: (amount: string) => void;
  isLoading?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onRefreshBalance?: () => void;
}

const WithdrawModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  currentlyDeposited,
  nTokenBalance = 0,
  marketStats,
  onSubmit,
  isLoading = false,
  showTooltip = false,
  tooltipText = "",
  onRefreshBalance,
}: WithdrawModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState({
    supplyAPY: false,
    accruedInterest: false,
    utilization: false,
    collateralFactor: false,
    liquidationMargin: false,
    healthFactor: false,
    ltv: false,
  });

  const toggleDetail = (key: keyof typeof expandedDetails) => {
    setExpandedDetails(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
    setAmount(currentlyDeposited.toString());
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(amount);
    } else {
      console.log(`Withdraw ${amount} ${tokenSymbol}`);

      setTimeout(() => {
        setShowSuccess(true);
      }, 500);
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

  const isValidAmount =
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= currentlyDeposited;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 sm:p-8 max-h-[90vh] overflow-y-auto">
        {showSuccess ? (
          <div className="p-6 overflow-y-auto">
            <SupplyBorrowCongrats
              transactionType="withdraw"
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
            <div className="sticky top-0 z-20 bg-card dark:bg-slate-900 pt-6 px-8 pb-4">
              <DialogHeader className="pb-0">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Withdraw
                </DialogTitle>
                <DialogDescription className="text-center mt-1 text-sm text-slate-400 dark:text-slate-400">
                  Enter the amount to withdraw. Your deposited total and rates are
                  shown below.
                </DialogDescription>
                <div className="flex items-center justify-center gap-3 pb-2 mt-3">
                  <img
                    src={tokenIcon}
                    alt={tokenSymbol}
                    className="w-12 h-12 rounded-full shadow"
                  />
                  {showTooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xl font-semibold text-slate-800 dark:text-white cursor-help underline decoration-dotted">
                          {tokenSymbol}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xl font-semibold text-slate-800 dark:text-white">
                      {tokenSymbol}
                    </span>
                  )}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 pt-2 px-8 pb-8 touch-pan-y">
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:bg-red-400/10 h-8 px-3"
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
                {/* Balance Information */}
                <div className="space-y-3">
                  {/* nToken Balance Display */}
                  <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          nToken Balance
                        </span>
                        {onRefreshBalance && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onRefreshBalance}
                            className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800"
                            title="Refresh nToken balance"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </Button>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                          {nTokenBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} n{tokenSymbol}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          ≈ {currentlyDeposited.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Currently Deposited Summary */}
                  <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Total Deposited Value
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {currentlyDeposited.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          ≈ ${(currentlyDeposited * marketStats.tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Position Details Section */}
                <div className="lg:w-80 lg:flex-shrink-0 mt-6">
                  <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700 lg:sticky lg:top-4">
                    <CardContent className="p-3 md:p-5 lg:p-6">
                      <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 md:mb-4">Position Details</h3>
                      <div className="space-y-2 md:space-y-4">
                        {/* Supply APY */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('supplyAPY')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Supply APY</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.supplyAPY ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-teal-600 dark:text-teal-400">{marketStats.supplyAPY?.toFixed(2)}%</span>
                          </div>
                          {expandedDetails.supplyAPY && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">Annual percentage yield for supplying {tokenSymbol}. This is the interest rate you earn for providing liquidity to this market.</p>
                            </div>
                          )}
                        </div>

                        {/* Utilization */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('utilization')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.utilization ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-fuchsia-600 dark:text-fuchsia-400">{marketStats.utilization?.toFixed(2)}%</span>
                          </div>
                          {expandedDetails.utilization && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">Current percentage of total deposited assets that are being borrowed. High utilization may increase interest rates and affect withdrawal availability.</p>
                            </div>
                          )}
                        </div>

                        {/* Collateral Factor */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('collateralFactor')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.collateralFactor ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-purple-600 dark:text-purple-400">{marketStats.collateralFactor?.toFixed(0)}%</span>
                          </div>
                          {expandedDetails.collateralFactor && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">The percentage of your deposited {tokenSymbol} value that can be used as collateral for borrowing other assets. Higher collateral factors provide greater borrowing power.</p>
                            </div>
                          )}
                        </div>

                        {/* Accrued Interest */}
                        <div className="pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('accruedInterest')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Accrued Interest</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.accruedInterest ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400">
                              {(marketStats.accruedInterest ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenSymbol}
                            </span>
                          </div>
                          {expandedDetails.accruedInterest && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">The interest you have earned on your supplied {tokenSymbol} since deposit. This is currently included in your nToken balance.</p>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                {/* Add additional details/breakdown if you wish */}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Liquidation Margin (if available) */}
                        {marketStats.liquidationMargin !== undefined && (
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('liquidationMargin')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Liquidation Margin</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.liquidationMargin ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-teal-600 dark:text-teal-400">{marketStats.liquidationMargin?.toFixed(2)}%</span>
                          </div>
                          {expandedDetails.liquidationMargin && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">The safety buffer before your position can be liquidated. Higher values mean more safety, lower values approach the liquidation threshold.</p>
                            </div>
                          )}
                        </div>
                        )}

                        {/* Health Factor (if available) */}
                        {marketStats.healthFactor !== undefined && (
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('healthFactor')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Health Factor</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.healthFactor ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400">{marketStats.healthFactor?.toFixed(2)}</span>
                          </div>
                          {expandedDetails.healthFactor && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Health Factor = (Collateral × 0.8) / Borrowed</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                A measure of your account's safety from liquidation. Higher is safer.
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
                        )}

                        {/* LTV (Loan-to-Value ratio, if available) */}
                        {marketStats.ltv !== undefined && (
                        <div>
                          <div className="flex justify-between items-center">
                            <button onClick={() => toggleDetail('ltv')} className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity" type="button">
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">LTV</span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.ltv ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">{marketStats.ltv?.toFixed(2)}%</span>
                          </div>
                          {expandedDetails.ltv && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">Loan-to-Value ratio of your position. This shows what percentage of your collateral is being used for borrowing.</p>
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!isValidAmount || isLoading}
                className="w-full font-semibold text-white h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Processing..." : `Withdraw ${showTooltip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        {tokenSymbol}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  tokenSymbol
                )}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawModal;
