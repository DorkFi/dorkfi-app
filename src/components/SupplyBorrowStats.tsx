import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateDepositAPY, calculateBorrowAPY } from "@/utils/apyCalculations";
import { isAtBorrowCap, isAtDepositCap } from "@/constants/lendingCaps";
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
        beforeValue: undefined as number | null | undefined,
      };
    }
    if (!liquidationThresholdSummary) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
        beforeValue: undefined as number | null | undefined,
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
          beforeValue: undefined as number | null | undefined,
        };
      }
      return {
        value: meta.value,
        deltaPercent: meta.deltaPercent,
        beforeValue: meta.beforeValue ?? null,
      };
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
        beforeValue: undefined as number | null | undefined,
      };
    }
    return {
      value: meta.value,
      deltaPercent: meta.deltaPercent,
      beforeValue: meta.beforeValue ?? null,
    };
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
                <p className="text-xs text-slate-600 dark:text-slate-400">Estimated annual percentage yield for new supply based on current market rates.</p>
              </div>
            )}
          </div>
        )}

        {mode === "borrow" && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                Borrow APY
              </span>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {borrowAmount > 0
                      ? "APY after your borrow (based on adjusted utilization)"
                      : `Annual percentage yield for borrowing ${asset}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-right">
              {borrowAmount > 0 ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
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
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {(Number.isFinite(assetData.borrowAPY) ? assetData.borrowAPY : 0).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        )}

        {(mode === "deposit" || mode === "borrow") &&
          poolGlobalUserData != null &&
          estimatedPoolHealthMeta.value !== undefined && (
            <div className="space-y-2 border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
              <div className="flex justify-between items-start gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDetail("poolHealthEst")}
                  className="flex flex-1 items-center gap-1.5 md:gap-2 min-w-0 hover:opacity-70 transition-opacity text-left"
                >
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                    Pool health (est.)
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex shrink-0"
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                      >
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        {mode === "borrow"
                          ? "Estimate for this lending pool after this borrow: (collateral × pool minimum liquidation threshold) ÷ total borrows (including this amount in USD), same shape as on-chain health, capped at 3.00 like Portfolio. When expanded, the bar and change strip show detail; the change is percent vs your position before this borrow."
                          : "Estimate for this lending pool after this deposit: (collateral × pool minimum liquidation threshold) ÷ borrows, same shape as on-chain health, capped at 3.00 like Portfolio. Collateral includes your current pool total plus the USD value of the amount above (uses oracle price when available). When expanded, the bar and change strip show detail; the change is percent vs your position at the prior minimum threshold."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {expandedDetail === "poolHealthEst" ? (
                    <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                {expandedDetail !== "poolHealthEst" && (
                  <div className="text-right shrink-0 space-y-0.5">
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
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      vs 3.00 max
                    </div>
                    {estimatedPoolHealthMeta.deltaPercent != null && (
                      <div
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
                      </div>
                    )}
                  </div>
                )}
              </div>

              {expandedDetail === "poolHealthEst" && (
                <div className="space-y-3 pt-1.5 border-t border-gray-200 dark:border-slate-700">
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Health vs max (3.00)
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tabular-nums",
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
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      vs 3.00 max (Portfolio)
                    </div>
                  </div>
                  {(() => {
                    const hfCap = 3;
                    const afterVal = estimatedPoolHealthMeta.value ?? 0;
                    const beforeVal = estimatedPoolHealthMeta.beforeValue;
                    const afterPct = Math.min(
                      100,
                      Math.max(0, (afterVal / hfCap) * 100)
                    );
                    const beforePct =
                      beforeVal != null && Number.isFinite(beforeVal)
                        ? Math.min(100, Math.max(0, (beforeVal / hfCap) * 100))
                        : null;
                    const isCritical =
                      estimatedPoolHealthMeta.value != null &&
                      estimatedPoolHealthMeta.value <
                        DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX;
                    const showAddedSplit =
                      !isCritical &&
                      beforePct != null &&
                      afterPct > beforePct + 1e-6;

                    return (
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        {isCritical ? (
                          <div
                            className="h-full rounded-full bg-red-500 transition-all"
                            style={{ width: `${afterPct}%` }}
                          />
                        ) : showAddedSplit ? (
                          <div
                            className="flex h-full overflow-hidden rounded-full"
                            style={{ width: `${afterPct}%` }}
                          >
                            <div
                              className="h-full shrink-0 rounded-l-full bg-teal-800 dark:bg-teal-700"
                              style={{
                                width: `${(beforePct / afterPct) * 100}%`,
                              }}
                            />
                            <div className="h-full min-w-0 flex-1 rounded-r-full bg-teal-300 dark:bg-teal-400" />
                          </div>
                        ) : (
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all dark:bg-teal-500"
                            style={{ width: `${afterPct}%` }}
                          />
                        )}
                      </div>
                    );
                  })()}

                  {estimatedPoolHealthMeta.deltaPercent != null && (
                    <div
                      className={cn(
                        "flex justify-between items-center rounded-md px-2 py-1.5 text-[10px] md:text-xs",
                        estimatedPoolHealthMeta.deltaPercent > 0
                          ? "bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/50"
                          : estimatedPoolHealthMeta.deltaPercent < 0
                            ? "bg-slate-100/80 dark:bg-slate-800/60"
                            : "bg-slate-100/80 dark:bg-slate-800/60"
                      )}
                    >
                      <span
                        className={cn(
                          estimatedPoolHealthMeta.deltaPercent > 0
                            ? "text-teal-800/90 dark:text-teal-200/90"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        Change vs prior position
                      </span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          estimatedPoolHealthMeta.deltaPercent > 0
                            ? "text-teal-700 dark:text-teal-300"
                            : estimatedPoolHealthMeta.deltaPercent < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {estimatedPoolHealthMeta.deltaPercent > 0 ? "+" : ""}
                        {estimatedPoolHealthMeta.deltaPercent.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


        {mode === "deposit" && assetData.totalSupply !== undefined && (() => {
          const currentSupply = assetData.totalSupply;
          const cap =
            assetData.maxTotalDeposits != null && assetData.maxTotalDeposits > 0
              ? assetData.maxTotalDeposits
              : null;
          const pending = Math.max(0, depositAmount);
          const projectedSupply = currentSupply + pending;
          const remainingAfter =
            cap != null ? Math.max(0, cap - projectedSupply) : null;
          const capUsedPercent =
            cap != null && cap > 0
              ? Math.min(100, (projectedSupply / cap) * 100)
              : 0;
          const currentCapUsagePercent =
            cap != null && cap > 0
              ? Math.min(100, Math.max(0, (currentSupply / cap) * 100))
              : 0;
          const supplyCapUsageDeltaPts = capUsedPercent - currentCapUsagePercent;
          const atCap =
            cap != null &&
            isAtDepositCap(currentSupply, cap) &&
            pending <= 0;

          const showUtilization =
            isSToken ||
            (Number.isFinite(assetData.utilization) && assetData.utilization > 0) ||
            pending > 0;
          const utilizationPercent = isSToken
            ? 100
            : pending > 0
              ? adjustedMetrics.utilization.adjusted
              : assetData.utilization;
          const utilizationProgressValue = Math.min(
            100,
            Math.max(
              0,
              Number.isFinite(utilizationPercent) ? utilizationPercent : 0
            )
          );

          const borrowCap =
            assetData.maxTotalBorrows != null && assetData.maxTotalBorrows > 0
              ? assetData.maxTotalBorrows
              : null;
          const currentBorrowsAbs = Math.abs(assetData.totalBorrow ?? 0);
          const projectedBorrows = currentBorrowsAbs;
          const borrowCapUsedPercent =
            borrowCap != null && borrowCap > 0
              ? Math.min(100, (projectedBorrows / borrowCap) * 100)
              : 0;
          const remainingBorrowCap =
            borrowCap != null ? Math.max(0, borrowCap - projectedBorrows) : null;
          const atBorrowCapMarket =
            borrowCap != null &&
            isAtBorrowCap(projectedBorrows, borrowCap);
          const borrowCapHighUsage = borrowCapUsedPercent >= 95;

          const showSupplyCapacityBorrowSection =
            borrowCap != null || showUtilization;

          const utilizationSection = borrowCap ? (
            <div className="space-y-2 border-t border-gray-200 dark:border-slate-700 pt-2 mt-1">
              <div className="flex justify-between items-start gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDetail("borrowCapUsage")}
                  className="flex flex-1 items-center gap-1.5 md:gap-2 min-w-0 hover:opacity-70 transition-opacity text-left"
                >
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                    Borrow cap usage
                  </span>
                  <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  {expandedDetail === "borrowCapUsage" ? (
                    <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                {expandedDetail !== "borrowCapUsage" && (
                  <div className="text-right shrink-0">
                    <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-white">
                      {borrowCapUsedPercent.toFixed(2)}%
                    </span>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      of borrow cap
                    </div>
                  </div>
                )}
              </div>
              {expandedDetail === "borrowCapUsage" && (
                <div className="space-y-3 pt-1.5 border-t border-gray-200 dark:border-slate-700">
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Borrows vs borrow cap
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-slate-800 dark:text-white">
                      {borrowCapUsedPercent.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      of borrow cap
                    </div>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        borrowCapHighUsage
                          ? "bg-amber-600 dark:bg-amber-500"
                          : "bg-rose-600 dark:bg-rose-500"
                      )}
                      style={{ width: `${borrowCapUsedPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="min-w-0">
                      <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                        Current borrows
                      </div>
                      <div className="text-xs md:text-sm font-medium tabular-nums text-slate-800 dark:text-white truncate">
                        {projectedBorrows.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {asset}
                      </div>
                    </div>
                    <div className="min-w-0 border-x border-gray-200 dark:border-slate-600 px-1">
                      <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                        Borrow cap
                      </div>
                      <div className="text-xs md:text-sm font-medium tabular-nums text-slate-800 dark:text-white truncate">
                        {borrowCap.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {asset}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                        Remaining
                      </div>
                      <div
                        className={cn(
                          "text-xs md:text-sm font-medium tabular-nums truncate",
                          atBorrowCapMarket
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-slate-800 dark:text-white"
                        )}
                      >
                        {remainingBorrowCap != null
                          ? remainingBorrowCap.toLocaleString()
                          : "—"}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {asset}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 text-left">
                    Total borrows in this market vs the protocol borrow cap (same
                    idea as supply vs supply cap above). At high usage, rates and
                    available borrow can tighten.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 text-left">
                    <strong>Borrows ÷ supply</strong> (utilization) is{" "}
                    {isSToken ? "100.00" : utilizationPercent.toFixed(2)}% — that
                    ratio drives interest curves; it is not the same as borrow
                    cap usage.
                  </p>
                </div>
              )}
            </div>
          ) : showUtilization ? (
            <div className="space-y-1.5 border-t border-gray-200 dark:border-slate-700 pt-2 mt-1">
              <div className="flex justify-between items-start gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDetail("utilization")}
                  className="flex items-center gap-1.5 md:gap-2 min-w-0 hover:opacity-70 transition-opacity text-left"
                >
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                    Borrows ÷ supply
                  </span>
                  <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  {expandedDetail === "utilization" ? (
                    <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                <div className="text-right shrink-0">
                  <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-white">
                    {isSToken ? "100.00" : utilizationPercent.toFixed(2)}%
                  </span>
                  {!isSToken &&
                    pending > 0 &&
                    Math.abs(adjustedMetrics.utilization.change) > 0.01 && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        was {assetData.utilization.toFixed(2)}%
                      </div>
                    )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Utilization (no borrow cap)
                </div>
                <Progress
                  value={isSToken ? 100 : utilizationProgressValue}
                  className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 [&>div]:bg-slate-500 dark:[&>div]:bg-slate-400"
                />
              </div>
              {expandedDetail === "utilization" && (
                <div className="pt-1.5 border-t border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-400 text-left">
                    Share of supplied assets that is borrowed (borrows ÷ supply).
                    Higher utilization often increases rates and can affect
                    withdrawals. This market does not expose a separate borrow cap
                    in the UI.
                  </p>
                </div>
              )}
            </div>
          ) : null;

          if (cap == null) {
            if (!showUtilization) {
              return (
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                      Total Supply
                    </span>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total amount supplied in this market.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-right">
                    {pending > 0 ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-800 dark:text-white">
                          {projectedSupply.toLocaleString()} {asset}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          +{pending.toLocaleString()} from your supply
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {currentSupply.toLocaleString()} {asset}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="space-y-2 border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                      {borrowCap != null
                        ? "Supply & borrow cap"
                        : "Supply & utilization"}
                    </span>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          <strong>Total supply</strong> is what is already in this
                          market.
                          {borrowCap != null ? (
                            <>
                              {" "}
                              <strong>Borrow cap usage</strong> below is borrows
                              vs this market&apos;s borrow cap.
                            </>
                          ) : (
                            <>
                              {" "}
                              Below, <strong>borrows ÷ supply</strong> is the
                              utilization rate.
                            </>
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    Total supply
                  </span>
                  <div className="text-right">
                    {pending > 0 ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-800 dark:text-white">
                          {projectedSupply.toLocaleString()} {asset}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          +{pending.toLocaleString()} from your supply
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {currentSupply.toLocaleString()} {asset}
                      </span>
                    )}
                  </div>
                </div>
                {utilizationSection}
              </div>
            );
          }

          return (
            <div className="space-y-2 border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
              <div className="flex justify-between items-start gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDetail("supplyCapacityBorrow")}
                  className="flex flex-1 items-center gap-1.5 md:gap-2 min-w-0 hover:opacity-70 transition-opacity text-left"
                >
                  <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                    {showSupplyCapacityBorrowSection
                      ? "Supply cap usage"
                      : "Supply & capacity"}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex shrink-0"
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                      >
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        The bar is <strong>supply cap usage</strong> (supply vs
                        this market&apos;s cap, including the amount you
                        entered). When you add supply, the darker segment is
                        usage from the market today and the lighter segment is
                        from the amount you entered. The grid shows current
                        supply, cap, and remaining headroom.
                        {showSupplyCapacityBorrowSection ? (
                          <>
                            {" "}
                            <strong>Borrow cap usage</strong> (below) is total
                            borrows vs this market&apos;s borrow cap — separate
                            from supply cap and from borrows ÷ supply.
                          </>
                        ) : null}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {expandedDetail === "supplyCapacityBorrow" ? (
                    <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                {expandedDetail !== "supplyCapacityBorrow" && (
                  <div className="text-right shrink-0 space-y-0.5">
                    <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-white">
                      {capUsedPercent.toFixed(2)}%
                    </span>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      of supply cap
                    </div>
                    {Math.abs(supplyCapUsageDeltaPts) > 0.01 && (
                      <div
                        className={cn(
                          "text-[10px] md:text-xs font-medium tabular-nums",
                          supplyCapUsageDeltaPts > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {supplyCapUsageDeltaPts > 0 ? "+" : ""}
                        {supplyCapUsageDeltaPts.toFixed(1)}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              {expandedDetail === "supplyCapacityBorrow" && (
                <div className="space-y-3 pt-1.5 border-t border-gray-200 dark:border-slate-700">
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Supply vs supply cap
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-slate-800 dark:text-white">
                      {capUsedPercent.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      of supply cap
                    </div>
                  </div>
                {(() => {
                  const afterPct = capUsedPercent;
                  const beforePct =
                    cap != null && cap > 0
                      ? Math.min(
                          100,
                          Math.max(0, (currentSupply / cap) * 100)
                        )
                      : 0;
                  const showAddedSplit =
                    pending > 1e-9 && afterPct > beforePct + 1e-6;
                  const highUsage = capUsedPercent >= 95;

                  return (
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      {showAddedSplit ? (
                        <div
                          className="flex h-full overflow-hidden rounded-full"
                          style={{ width: `${afterPct}%` }}
                        >
                          <div
                            className={cn(
                              "h-full shrink-0 rounded-l-full",
                              highUsage
                                ? "bg-amber-800 dark:bg-amber-700"
                                : "bg-teal-800 dark:bg-teal-700"
                            )}
                            style={{
                              width: `${(beforePct / afterPct) * 100}%`,
                            }}
                          />
                          <div
                            className={cn(
                              "h-full min-w-0 flex-1 rounded-r-full",
                              highUsage
                                ? "bg-amber-300 dark:bg-amber-400"
                                : "bg-teal-300 dark:bg-teal-400"
                            )}
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            highUsage
                              ? "bg-amber-600 dark:bg-amber-500"
                              : "bg-teal-600 dark:bg-teal-500"
                          )}
                          style={{ width: `${afterPct}%` }}
                        />
                      )}
                    </div>
                  );
                })()}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="min-w-0">
                  <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    Current supply
                  </div>
                  <div className="text-xs md:text-sm font-medium tabular-nums text-slate-800 dark:text-white truncate">
                    {currentSupply.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {asset}
                  </div>
                </div>
                <div className="min-w-0 border-x border-gray-200 dark:border-slate-600 px-1">
                  <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    Supply cap
                  </div>
                  <div className="text-xs md:text-sm font-medium tabular-nums text-slate-800 dark:text-white truncate">
                    {cap.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {asset}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    Remaining
                  </div>
                  <div
                    className={cn(
                      "text-xs md:text-sm font-medium tabular-nums truncate",
                      atCap && pending <= 0
                        ? "text-amber-700 dark:text-amber-400"
                        : remainingAfter === 0 && pending > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-slate-800 dark:text-white"
                    )}
                  >
                    {remainingAfter != null ? remainingAfter.toLocaleString() : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {asset}
                  </div>
                </div>
              </div>
              {pending > 0 && (
                <div className="flex justify-between items-center rounded-md bg-slate-100/80 dark:bg-slate-800/60 px-2 py-1.5 text-[10px] md:text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    This supply
                  </span>
                  <span className="font-medium tabular-nums text-teal-700 dark:text-teal-300">
                    +{pending.toLocaleString()} {asset}
                    <span className="text-slate-600 dark:text-slate-400 font-normal">
                      {" "}
                      → total {projectedSupply.toLocaleString()} {asset}
                    </span>
                  </span>
                </div>
              )}
                </div>
              )}
              {utilizationSection}
            </div>
          );
        })()}

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
                    <p>Total amount supplied to this market</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {(assetData.totalSupply ?? 0).toLocaleString()} {asset}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplyBorrowStats;
