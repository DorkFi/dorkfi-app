import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateDepositAPY, calculateBorrowAPY } from "@/utils/apyCalculations";
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
  apyCalculation?: { apy: number; [key: string]: unknown };
  borrowApyCalculation?: { apy: number };
  apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
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
  borrowAmount?: number;
  userBorrowBalance?: number;
  userDepositBalance?: number;
  isSToken?: boolean;
}

const SupplyBorrowStats = ({ mode, asset, assetData, userGlobalData, depositAmount = 0, borrowAmount = 0, userBorrowBalance = 0, userDepositBalance = 0, isSToken = false }: SupplyBorrowStatsProps) => {
  const safeSupplyAPY = Number.isFinite(assetData.supplyAPY) ? assetData.supplyAPY : 0;
  const safeBorrowAPY = Number.isFinite(assetData.borrowAPY) ? assetData.borrowAPY : 0;

  // Calculate adjusted utilization and APY using protocol APY formulas when apyParameters are available
  const calculateAdjustedMetrics = () => {
    const params = assetData.apyParameters;
    const totalSupply = assetData.totalSupply ?? 0;
    const totalBorrow = assetData.totalBorrow ?? 0;

    if (mode === "deposit" && depositAmount > 0 && params) {
      const newTotalSupply = totalSupply + depositAmount;
      const adjustedState = {
        totalScaledDeposits: newTotalSupply,
        totalScaledBorrows: totalBorrow,
        lastUpdateTime: Date.now(),
      };
      const result = calculateDepositAPY(
        { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
        adjustedState
      );
      const newUtilization = result.utilizationRate * 100;
      const apyChangePercent = safeSupplyAPY > 0 ? ((result.apy - safeSupplyAPY) / safeSupplyAPY) * 100 : 0;
      return {
        utilization: { current: assetData.utilization, adjusted: Math.min(newUtilization, 100), change: newUtilization - assetData.utilization },
        apy: { current: safeSupplyAPY, adjusted: Math.max(result.apy, 0), change: result.apy - safeSupplyAPY, changePercent: apyChangePercent },
      };
    }

    if (mode === "borrow" && borrowAmount > 0 && params) {
      const newTotalBorrow = totalBorrow + borrowAmount;
      const adjustedState = {
        totalScaledDeposits: totalSupply,
        totalScaledBorrows: newTotalBorrow,
        lastUpdateTime: Date.now(),
      };
      const result = calculateBorrowAPY(
        { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
        adjustedState,
        isSToken
      );
      const apyChangePercent = safeBorrowAPY > 0 ? ((result.apy - safeBorrowAPY) / safeBorrowAPY) * 100 : 0;
      return {
        utilization: { current: assetData.utilization, adjusted: assetData.utilization, change: 0 },
        apy: { current: safeBorrowAPY, adjusted: Math.max(result.apy, 0), change: result.apy - safeBorrowAPY, changePercent: apyChangePercent },
      };
    }

    return {
      utilization: { current: assetData.utilization, adjusted: assetData.utilization, change: 0 },
      apy: {
        current: mode === "deposit" ? safeSupplyAPY : safeBorrowAPY,
        adjusted: mode === "deposit" ? safeSupplyAPY : safeBorrowAPY,
        change: 0,
        changePercent: 0,
      },
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
                    {(mode === "deposit" && depositAmount > 0) || (mode === "borrow" && borrowAmount > 0)
                      ? `APY after your ${mode === "deposit" ? "deposit" : "borrow"} (based on adjusted utilization)`
                      : `Annual percentage yield for ${mode === "deposit" ? "depositing" : "borrowing"} ${asset}`
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-right">
              {(mode === "deposit" && depositAmount > 0) || (mode === "borrow" && borrowAmount > 0) ? (
                <div className="space-y-1">
                  <div className={`text-sm font-medium ${mode === "deposit" ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"}`}>
                    {(Number.isFinite(adjustedMetrics.apy.adjusted) ? adjustedMetrics.apy.adjusted : 0).toFixed(2)}%
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
                    {(Number.isFinite(mode === "deposit" ? assetData.supplyAPY : assetData.borrowAPY)
                      ? (mode === "deposit" ? assetData.supplyAPY : assetData.borrowAPY)
                      : 0
                    ).toFixed(2)}%
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
                {(depositAmount > 0 && adjustedMetrics
                  ? Number.isFinite(adjustedMetrics.apy.adjusted)
                    ? adjustedMetrics.apy.adjusted
                    : 0
                  : Number.isFinite(assetData.supplyAPY)
                    ? assetData.supplyAPY
                    : 0
                ).toFixed(2)}%
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
                      <p>Maximum amount you can borrow based on your total collateral value (from the protocol).</p>
                      {userGlobalData.totalCollateralValue === 0 && userGlobalData.totalBorrowValue === 0 && (
                        <p className="mt-1 text-amber-600 dark:text-amber-400 text-xs">If you have supplied collateral but see $0, refresh the page or sync your position so the protocol can update your account.</p>
                      )}
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
