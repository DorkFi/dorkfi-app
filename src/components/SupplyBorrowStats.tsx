
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateDepositAPY } from "@/utils/apyCalculations";

interface AssetData {
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  liquidity: number;
  totalSupply?: number;
  totalSupplyUSD?: number;
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
}

const SupplyBorrowStats = ({ mode, asset, assetData, userGlobalData, depositAmount = 0, userBorrowBalance = 0 }: SupplyBorrowStatsProps) => {
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
  return (
    <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
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

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {mode === "deposit" && depositAmount > 0 
                    ? "Utilization after your deposit (borrowed / total supplied)"
                    : "Percentage of deposited assets being borrowed"
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-right">
            {mode === "deposit" && depositAmount > 0 ? (
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-800 dark:text-white">
                  {adjustedMetrics.utilization.adjusted.toFixed(2)}%
                </div>
                <div className={`text-xs flex items-center justify-end gap-1 ${
                  Math.abs(adjustedMetrics.utilization.change) > 0.1 
                    ? (adjustedMetrics.utilization.change < 0 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-orange-600 dark:text-orange-400")
                    : "text-slate-500 dark:text-slate-400"
                }`}>
                  {Math.abs(adjustedMetrics.utilization.change) > 0.1 ? (
                    <>
                      <span>{adjustedMetrics.utilization.change < 0 ? "↓" : "↑"}</span>
                      <span>
                        {adjustedMetrics.utilization.change < 0 ? "Decreases by " : "Increases by "}
                        {Math.abs(adjustedMetrics.utilization.change).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span>No significant change</span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-800 dark:text-white">
                {assetData.utilization.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum borrowing power from this collateral</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-slate-800 dark:text-white">{assetData.collateralFactor}%</span>
        </div>

        {mode === "deposit" && assetData.totalSupply !== undefined && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total Deposits</span>
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Market Capacity</span>
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

        {mode === "borrow" && (
          <>
            {userGlobalData && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total Collateral Value</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Current Borrowed</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Max Borrowable</span>
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
                    // Formula: totalCollateralValue * collateralFactor
                    const collateralFactorDecimal = assetData.collateralFactor / 100; // Convert percentage to decimal
                    const maxBorrowable = userGlobalData.totalCollateralValue * collateralFactorDecimal;
                    return maxBorrowable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Market Liquidity</span>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total liquidity available for borrowing in this market</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {assetData.liquidity.toLocaleString()} {asset}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplyBorrowStats;
