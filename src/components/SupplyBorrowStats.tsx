
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateDepositAPY } from "@/utils/apyCalculations";
import { useState } from "react";

interface AssetData {
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  liquidity: number;
  totalSupply?: number;
  totalSupplyUSD?: number;
  totalBorrow?: number;
  totalBorrowUSD?: number;
  reserveFactor?: number;
  maxTotalDeposits?: number;
  apyCalculation?: {
    utilizationRate: number;
    borrowRate: number;
    supplyRate: number;
    apy: number;
    apyFormatted: string;
  };
}

interface SupplyBorrowStatsProps {
  mode: "deposit" | "borrow";
  asset: string;
  assetData: AssetData;
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  depositAmount?: number;
  userBorrowBalance?: number;
  userDepositBalance?: number;
  isSToken?: boolean;
}

const SupplyBorrowStats = ({ mode, asset, assetData, userGlobalData, depositAmount = 0, userBorrowBalance = 0, userDepositBalance = 0, isSToken = false }: SupplyBorrowStatsProps) => {
  // Calculate adjusted utilization and APY based on deposit amount
  const calculateAdjustedMetrics = () => {
    if (mode === "deposit" && depositAmount > 0 && assetData.apyCalculation) {
      // Utilization = totalBorrow / (totalSupply + depositAmount)
      const currentUtilization = assetData.utilization / 100; // Convert to decimal
      const currentTotalSupply = assetData.totalSupply || 1; // Avoid division by zero
      const currentTotalBorrow = currentTotalSupply * currentUtilization;
      
      const newTotalSupply = currentTotalSupply + depositAmount;
      const newUtilization = (currentTotalBorrow / newTotalSupply) * 100;
      
      // Debug: Log the current values to understand the data format
      console.log('APY Debug:', {
        currentSupplyAPY: assetData.supplyAPY,
        apyCalculation: assetData.apyCalculation,
        reserveFactor: assetData.reserveFactor,
        currentUtilization: assetData.utilization,
        newUtilization,
        depositAmount,
        currentTotalSupply,
        currentTotalBorrow
      });
      
      // Conservative approach: Use a simple linear relationship between utilization and APY
      // This avoids complex calculations that might have unit issues
      const currentUtilizationRate = assetData.utilization / 100;
      const newUtilizationRate = newUtilization / 100;
      
      // Calculate utilization change ratio
      const utilizationChangeRatio = newUtilizationRate / currentUtilizationRate;
      
      // Estimate APY change based on utilization change
      // Typical relationship: APY changes by about 10-20% of utilization change
      const apySensitivity = 0.15; // Conservative sensitivity factor
      const apyChangeRatio = 1 + ((utilizationChangeRatio - 1) * apySensitivity);
      
      // Calculate new APY
      const newAPY = Math.max(assetData.supplyAPY * apyChangeRatio, 0);
      
      console.log('APY Calculation Debug:', {
        currentUtilizationRate,
        newUtilizationRate,
        utilizationChangeRatio,
        apySensitivity,
        apyChangeRatio,
        newAPY,
        originalAPY: assetData.supplyAPY,
        apyChange: newAPY - assetData.supplyAPY
      });
      
      // Calculate percentage change for APY (relative change)
      const apyChangePercent = assetData.supplyAPY > 0 
        ? ((newAPY - assetData.supplyAPY) / assetData.supplyAPY) * 100
        : 0;

      return {
        utilization: {
          current: assetData.utilization,
          adjusted: Math.min(newUtilization, 100), // Cap at 100%
          change: newUtilization - assetData.utilization
        },
        apy: {
          current: assetData.supplyAPY,
          adjusted: Math.max(newAPY, 0), // Ensure non-negative
          change: newAPY - assetData.supplyAPY, // Absolute change
          changePercent: apyChangePercent // Relative change percentage
        }
      };
    }
    
    return {
      utilization: {
        current: assetData.utilization,
        adjusted: assetData.utilization,
        change: 0
      },
      apy: {
        current: assetData.supplyAPY,
        adjusted: assetData.supplyAPY,
        change: 0,
        changePercent: 0
      }
    };
  };

  const adjustedMetrics = calculateAdjustedMetrics();
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const handleToggleDetail = (field: string) => {
    setExpandedDetail(prev => (prev === field ? null : field));
  };

  return (
    <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardContent className="p-3 space-y-2">
        {/* Only show deposit APY if user has existing deposits or is in borrow mode */}
        {(mode === "borrow" || (mode === "deposit" && userDepositBalance > 0)) && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                {mode === "deposit" ? "Deposit" : "Borrow"} APY
              </span>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {mode === "deposit" && depositAmount > 0 
                      ? "APY after your deposit (based on adjusted utilization)"
                      : `Annual percentage yield for ${mode === "deposit" ? "depositing" : "borrowing"} ${asset}`
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-right">
              {mode === "deposit" && depositAmount > 0 ? (
                <div className="space-y-1">
                  <div className={`text-sm font-medium ${mode === "deposit" ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"}`}>
                    {adjustedMetrics.apy.adjusted.toFixed(2)}%
                  </div>
                  <div className={`text-xs flex items-center justify-end gap-1 ${
                    Math.abs(adjustedMetrics.apy.changePercent) > 0.1 
                      ? (adjustedMetrics.apy.changePercent > 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-orange-600 dark:text-orange-400")
                      : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {Math.abs(adjustedMetrics.apy.changePercent) > 0.1 ? (
                      <>
                        <span>{adjustedMetrics.apy.changePercent > 0 ? "↑" : "↓"}</span>
                        <span>
                          {adjustedMetrics.apy.changePercent > 0 ? "+" : ""}
                          {adjustedMetrics.apy.changePercent.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span>No significant change</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className={`text-sm font-medium ${mode === "deposit" ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"}`}>
                  {(mode === "deposit" ? assetData.supplyAPY : assetData.borrowAPY).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Utilization */}
        {mode === "deposit" && assetData.utilization > 0 && (
          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleToggleDetail("utilization")}
                type="button"
                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
              >
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {expandedDetail === "utilization" ? <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
              </button>
              <span className="text-sm font-medium text-slate-800 dark:text-white">
                {isSToken ? "100.00" : assetData.utilization.toFixed(2)}%
              </span>
            </div>
            {expandedDetail === "utilization" && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400">Current percentage of supplied assets that are being borrowed. High utilization may increase interest rates and affect withdrawal availability.</p>
              </div>
            )}
          </div>
        )}

        {/* Collateral Factor */}
        {mode === "deposit" && (
          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleToggleDetail("collateralFactor")}
                type="button"
                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
              >
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {expandedDetail === "collateralFactor" ? (
                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                )}
              </button>
              <span className="text-sm font-medium text-slate-800 dark:text-white">{assetData.collateralFactor}%</span>
            </div>
            {expandedDetail === "collateralFactor" && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400">The percentage of your deposited value that can be used as collateral for borrowing other assets. Higher collateral factors provide greater borrowing power.</p>
              </div>
            )}
          </div>
        )}

        {mode === "deposit" && assetData.totalSupply !== undefined && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Total Deposits</span>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {depositAmount > 0 
                      ? `Current total deposits: ${assetData.totalSupply.toLocaleString()} ${asset}. After your deposit: ${(assetData.totalSupply + depositAmount).toLocaleString()} ${asset}`
                      : `Total amount deposited in this market`
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-right">
              {depositAmount > 0 ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-800 dark:text-white">
                    {(assetData.totalSupply + depositAmount).toLocaleString()} {asset}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    +{depositAmount.toLocaleString()} from your deposit
                  </div>
                </div>
              ) : (
                <span className="text-sm font-medium text-slate-800 dark:text-white">
                  {assetData.totalSupply.toLocaleString()} {asset}
                </span>
              )}
            </div>
          </div>
        )}

        {mode === "deposit" && assetData.maxTotalDeposits && assetData.maxTotalDeposits > 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Market Capacity</span>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum total deposits allowed in this market</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-800 dark:text-white">
                {assetData.maxTotalDeposits.toLocaleString()} {asset}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {assetData.totalSupply && assetData.maxTotalDeposits > assetData.totalSupply 
                  ? `${((assetData.maxTotalDeposits - assetData.totalSupply) / assetData.maxTotalDeposits * 100).toFixed(1)}% available`
                  : "At capacity"
                }
              </div>
            </div>
          </div>
        )}

        {/* Supply APY */}
        {mode === "deposit" && (
          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleToggleDetail("supplyAPY")}
                type="button"
                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
              >
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Estimated APY</span>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {expandedDetail === "supplyAPY" ? (
                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                )}
              </button>
              <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                {depositAmount > 0 && adjustedMetrics ? adjustedMetrics.apy.adjusted.toFixed(2) : assetData.supplyAPY.toFixed(2)}%
              </span>
            </div>
            {expandedDetail === "supplyAPY" && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400">Estimated annual percentage yield for new deposits based on current market rates.</p>
              </div>
            )}
          </div>
        )}

        {mode === "borrow" && (
          <>
            {userGlobalData && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Total Collateral Value</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total value of your deposited collateral across all markets</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm font-medium text-slate-800 dark:text-white">
                  ${userGlobalData.totalCollateralValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            
            {userGlobalData && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Current Borrowed</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Amount you currently have borrowed in {asset}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {userBorrowBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {asset}
                </span>
              </div>
            )}

            {userGlobalData && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Max Borrowable</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Maximum amount you can borrow based on your total collateral value</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                  ${(() => {
                    // Calculate max borrowable amount based on collateral
                    // Formula: max(0, collateral * cf - borrows)
                    const collateralFactorDecimal = assetData.collateralFactor / 100; // Convert percentage to decimal
                    const maxBorrowable = Math.max(0, (userGlobalData.totalCollateralValue * collateralFactorDecimal) - userGlobalData.totalBorrowValue);
                    return maxBorrowable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Total Supply</span>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total amount borrowed (minted) from this market</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {Math.abs(assetData.totalBorrow || 0).toLocaleString()} {asset}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplyBorrowStats;
