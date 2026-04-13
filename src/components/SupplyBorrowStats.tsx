import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateDepositAPY, calculateBorrowAPY } from "@/utils/apyCalculations";
import { isAtDepositCap } from "@/constants/lendingCaps";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useMemo, useState } from "react";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";
import { cn } from "@/lib/utils";
import {
  buildLiquidationThresholdSummaryForDeposit,
  DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX,
  estimatePoolHealthAfterBorrow,
  estimatePoolHealthAfterDeposit,
} from "@/utils/depositModalPoolHealthEstimate";

interface AssetData {
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  /** Percent 0–100, same scale as collateralFactor */
  liquidationThreshold?: number;
  liquidity: number;
  totalSupply?: number;
  totalSupplyUSD?: number;
  totalBorrow?: number;
  totalBorrowUSD?: number;
  reserveFactor?: number;
  maxTotalDeposits?: number;
  maxTotalBorrows?: number;
  apyCalculation?: { apy: number; [key: string]: unknown };
  borrowApyCalculation?: { apy: number };
  apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
}

interface SupplyBorrowStatsProps {
  mode: "deposit" | "borrow";
  asset: string;
  poolId?: string;
  /** Aligns token price with the modal network (e.g. cross-network portfolio). */
  network?: string;
  assetData: AssetData;
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  /** On-chain pool totals (USD) for this pool; used for est. health in deposit mode */
  poolGlobalUserData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  depositAmount?: number;
  borrowAmount?: number;
  userBorrowBalance?: number;
  userDepositBalance?: number;
  isSToken?: boolean;
  poolCollateralMarkets?: PoolCollateralMarketRow[];
}

const SupplyBorrowStats = ({
  mode,
  asset,
  poolId,
  network,
  assetData,
  userGlobalData,
  poolGlobalUserData,
  depositAmount = 0,
  borrowAmount = 0,
  userBorrowBalance = 0,
  userDepositBalance = 0,
  isSToken = false,
  poolCollateralMarkets,
}: SupplyBorrowStatsProps) => {
  const { price: tokenPrice } = useTokenPrice(asset, network);
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

  const liquidationThresholdSummary = useMemo(() => {
    if (
      (mode !== "deposit" && mode !== "borrow") ||
      assetData.liquidationThreshold == null
    ) {
      return null;
    }
    return buildLiquidationThresholdSummaryForDeposit(
      assetData.liquidationThreshold,
      poolCollateralMarkets,
      poolId
    );
  }, [mode, assetData.liquidationThreshold, poolCollateralMarkets, poolId]);

  const estimatedPoolHealthMeta = useMemo(() => {
    if (
      (mode !== "deposit" && mode !== "borrow") ||
      poolGlobalUserData == null
    ) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    if (!liquidationThresholdSummary) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    if (mode === "deposit") {
      const meta = estimatePoolHealthAfterDeposit(
        poolGlobalUserData,
        liquidationThresholdSummary,
        depositAmount,
        tokenPrice
      );
      if (!meta) {
        return {
          value: undefined as number | null | undefined,
          deltaPercent: undefined as number | null | undefined,
        };
      }
      return { value: meta.value, deltaPercent: meta.deltaPercent };
    }
    const meta = estimatePoolHealthAfterBorrow(
      poolGlobalUserData,
      liquidationThresholdSummary,
      borrowAmount,
      tokenPrice
    );
    if (!meta) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    return { value: meta.value, deltaPercent: meta.deltaPercent };
  }, [
    mode,
    poolGlobalUserData,
    liquidationThresholdSummary,
    depositAmount,
    borrowAmount,
    tokenPrice,
  ]);

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
                          {adjustedMetrics.apy.changePercent.toFixed(2)}%
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

        {/* Liquidation threshold: headline values + details (same expand pattern as Collateral Factor) */}
        {(mode === "deposit" || mode === "borrow") && liquidationThresholdSummary && (
          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
            <div className="flex justify-between items-start gap-2">
              <button
                onClick={() => handleToggleDetail("liquidationThreshold")}
                type="button"
                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity shrink-0"
              >
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                  Liquidation threshold
                </span>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {expandedDetail === "liquidationThreshold" ? (
                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                )}
              </button>
              <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-white">
                  {liquidationThresholdSummary.primaryPercent}%
                </span>
                {liquidationThresholdSummary.secondaryLine ? (
                  <span className="text-[10px] md:text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {liquidationThresholdSummary.secondaryLine}
                  </span>
                ) : null}
                {liquidationThresholdSummary.deltaFromPreviousPoolMin != null ? (
                  <span className="text-[10px] md:text-xs font-medium tabular-nums text-red-600 dark:text-red-400">
                    {liquidationThresholdSummary.deltaFromPreviousPoolMin > 0 ? "+" : ""}
                    {liquidationThresholdSummary.deltaFromPreviousPoolMin.toFixed(1)}%
                  </span>
                ) : null}
              </div>
            </div>
            {expandedDetail === "liquidationThreshold" && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                  <p>
                    {mode === "borrow"
                      ? "The large figure is the pool minimum liquidation threshold (the value Portfolio uses for aggregate health when this market is the binding constraint). The line below the figure, when shown, is this market's own threshold."
                      : "The large figure is the pool minimum liquidation threshold after this deposit (the value Portfolio uses for aggregate health when this market is the binding constraint). The line below the figure, when shown, is this market's own threshold. Liquidation may occur if health falls to this loan-to-value level."}
                  </p>
                  {poolCollateralMarkets &&
                    poolCollateralMarkets.length > 0 &&
                    poolId && (
                      <>
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          Your collateral in this pool
                        </p>
                        <div className="rounded-md border border-gray-200 dark:border-slate-600 overflow-hidden text-[10px] md:text-xs">
                          <div className="grid grid-cols-[1fr_auto] gap-2 px-2 py-1.5 bg-slate-100/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                            <span>Asset</span>
                            <span className="text-right">Liq. threshold</span>
                          </div>
                          {poolCollateralMarkets.map((row) => (
                            <div
                              key={`${row.symbol}-${row.poolId}`}
                              className={`grid grid-cols-[1fr_auto] gap-2 px-2 py-1.5 border-t border-gray-100 dark:border-slate-700/80 items-center ${
                                row.symbol === asset
                                  ? "bg-teal-500/5 dark:bg-teal-500/10"
                                  : ""
                              }`}
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-100 truncate pr-1">
                                {row.symbol}
                                {row.symbol === asset ? (
                                  <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">
                                    (supplied)
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {row.liquidationThresholdPercent.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  {assetData.liquidationThreshold != null &&
                    poolCollateralMarkets &&
                    poolCollateralMarkets.length > 0 &&
                    poolId &&
                    (() => {
                      const peers = poolCollateralMarkets.filter(
                        (r) => r.symbol !== asset
                      );
                      if (peers.length === 0) return null;
                      const peerLts = peers.map(
                        (p) => p.liquidationThresholdPercent
                      );
                      const maxPeerLt = Math.max(...peerLts);
                      const minPeerLt = Math.min(...peerLts);
                      const depLt = assetData.liquidationThreshold;
                      if (depLt < minPeerLt) {
                        return (
                          <p className="text-amber-800 dark:text-amber-200/90">
                            This market&apos;s liquidation threshold is lower than your other supplied collateral in this pool, so this deposit is subject to that stricter threshold. The minimum liquidation threshold across your collateral in the pool will drop accordingly, and Portfolio will use this new minimum in aggregate health factor and related displays for your position.
                          </p>
                        );
                      }
                      if (depLt < maxPeerLt) {
                        return (
                          <p>
                            This market&apos;s liquidation threshold is below some of your other collateral in this pool. Aggregate risk still follows the minimum threshold across your supplied assets; Portfolio reflects that minimum in aggregate health factor and related metrics.
                          </p>
                        );
                      }
                      return (
                        <p>
                          This market&apos;s liquidation threshold is at or above your other collateral in this pool (by LT), so it will not increase the minimum threshold used in Portfolio aggregate health.
                        </p>
                      );
                    })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estimated pool health factor (after deposit or borrow); below liquidation threshold */}
        {(mode === "deposit" || mode === "borrow") &&
          poolGlobalUserData != null &&
          estimatedPoolHealthMeta.value !== undefined && (
            <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                    Est. health factor
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        {mode === "borrow"
                          ? "Estimate for this lending pool after this borrow: (collateral × pool minimum liquidation threshold) ÷ total borrows (including this amount in USD), same shape as on-chain health, capped at 3.00 like Portfolio. The colored change is percent vs your current pool position before this borrow."
                          : "Estimate for this lending pool after this deposit: (collateral × pool minimum liquidation threshold) ÷ borrows, same shape as on-chain health, capped at 3.00 like Portfolio. Collateral includes your current pool total plus the USD value of the amount above (uses oracle price when available). The colored change is percent vs your current pool position at the prior minimum threshold (before this deposit)."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex min-w-0 flex-col items-end gap-0.5 text-right shrink-0">
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      estimatedPoolHealthMeta.value != null &&
                        estimatedPoolHealthMeta.value <
                          DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-800 dark:text-white"
                    )}
                  >
                    {estimatedPoolHealthMeta.value == null
                      ? "—"
                      : estimatedPoolHealthMeta.value.toFixed(2)}
                  </span>
                  {estimatedPoolHealthMeta.deltaPercent != null ? (
                    <span
                      className={cn(
                        "text-[10px] md:text-xs font-medium tabular-nums",
                        estimatedPoolHealthMeta.deltaPercent > 0
                          ? "text-green-600 dark:text-green-400"
                          : estimatedPoolHealthMeta.deltaPercent < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {estimatedPoolHealthMeta.deltaPercent > 0 ? "+" : ""}
                      {estimatedPoolHealthMeta.deltaPercent.toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              </div>
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
                {assetData.totalSupply != null && assetData.maxTotalDeposits > 0 && !isAtDepositCap(assetData.totalSupply, assetData.maxTotalDeposits)
                  ? `${((assetData.maxTotalDeposits - assetData.totalSupply) / assetData.maxTotalDeposits * 100).toFixed(2)}% available`
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
