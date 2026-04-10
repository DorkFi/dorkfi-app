import DorkFiButton from "@/components/ui/DorkFiButton";
import { Plus, Minus, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { useNetwork } from "@/contexts/NetworkContext";
import { getTokenConfig, getMarketLabel } from "@/config";

interface PortfolioTableMobileCardProps {
  asset: string;
  icon: string;
  value: number;
  balance?: number;
  apy?: number;
  /** Extra supply APY from token config (% points); shown as +X.XX% when &gt; 0. */
  intrinsicApyPercent?: number;
  /** Bonus rewards APR (% points); shown as +X.XX% when &gt; 0. */
  rewardBonusAprPercent?: number;
  accruedInterest?: number;
  accruedInterestValue?: number;
  collateralFactor?: number;
  liquidationFactor?: number;
  /** Network (or portfolio) health factor for supplied positions; null if unknown. */
  positionHealth?: number | null;
  ltvUsage?: number;
  liquidationPrice?: number;
  network?: string;
  poolId?: string;
  onDepositClick?: () => void;
  onWithdrawClick?: () => void;
  onRefreshClick?: () => void;
  isRefreshing?: boolean;
  type?: "deposit" | "borrow";
  /** When true, deposit button is disabled (e.g. market at or over deposit cap). */
  depositDisabled?: boolean;
  /** When true, borrow button is disabled (e.g. market at or over borrow cap). */
  borrowDisabled?: boolean;
}

const PortfolioTableMobileCard = ({
  asset,
  icon,
  value,
  balance,
  apy,
  intrinsicApyPercent,
  rewardBonusAprPercent,
  accruedInterest,
  accruedInterestValue,
  collateralFactor,
  liquidationFactor,
  positionHealth,
  ltvUsage,
  liquidationPrice,
  network,
  poolId,
  onDepositClick,
  onWithdrawClick,
  onRefreshClick,
  isRefreshing,
  type = "deposit",
  depositDisabled = false,
  borrowDisabled = false,
}: PortfolioTableMobileCardProps) => {
  const { currentNetwork } = useNetwork();
  const tokenConfigRaw = getTokenConfig(currentNetwork, asset);
  const tokenConfig = Array.isArray(tokenConfigRaw)
    ? poolId ? tokenConfigRaw.find((c: { poolId?: string }) => String(c.poolId) === String(poolId)) ?? tokenConfigRaw[0] : tokenConfigRaw[0]
    : tokenConfigRaw;
  const displayDecimals = Math.min((tokenConfig as { decimals?: number } | undefined)?.decimals ?? 6, 8);

  const marketLabel = getMarketLabel(
    network || currentNetwork,
    poolId
  );

  const isDeposit = type === "deposit";
  const valueColor = isDeposit ? "text-green-400" : "text-red-400";
  const apyColor = isDeposit ? "text-green-400" : "text-red-400";
  const bgColor = isDeposit
    ? "bg-green-500/5 border-green-500/10"
    : "bg-red-500/5 border-red-500/10";

  return (
    <DorkFiCard className={`p-4 ${bgColor} border`}>
      <div className="space-y-3">
        {/* Header: Asset Icon above Ticker + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <div className="relative flex-shrink-0">
              <img
                src={icon}
                alt={asset}
                className="w-12 h-12 rounded-full flex-shrink-0"
              />
              {marketLabel && (
                <div
                  className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full ${
                    marketLabel === "A"
                      ? "bg-blue-500 dark:bg-blue-600"
                      : "bg-purple-500 dark:bg-purple-600"
                  } border-2 border-white dark:border-slate-800 flex items-center justify-center z-10`}
                >
                  <span className="text-[10px] font-bold text-white leading-none">
                    {marketLabel}
                  </span>
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="font-semibold text-base text-slate-800 dark:text-white">
                {asset}
              </div>
              {network && (
                <div className="text-xs text-muted-foreground">
                  {network.split("-")[0].charAt(0).toUpperCase() +
                    network.split("-")[0].slice(1)}
                </div>
              )}
            </div>
          </div>
          {onRefreshClick && (
            <DorkFiButton
              variant="secondary"
              size="sm"
              onClick={onRefreshClick}
              disabled={isRefreshing}
              className="min-w-0 h-8 w-8 p-0"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </DorkFiButton>
          )}
        </div>

        {/* Value and APY */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Value</div>
            <div className={`text-lg font-bold ${valueColor}`}>
              ${value.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          {apy !== undefined && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-end">
                APY
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      {isDeposit
                        ? "Annual percentage yield earned on this deposit"
                        : "Annual interest rate on this borrow"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className={`text-lg font-semibold ${apyColor}`}>
                {apy.toFixed(2)}%
              </div>
              {isDeposit &&
                intrinsicApyPercent != null &&
                intrinsicApyPercent > 0 && (
                  <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 mt-0.5 tabular-nums">
                    +{intrinsicApyPercent.toFixed(2)}%
                  </div>
                )}
              {isDeposit &&
                rewardBonusAprPercent != null &&
                rewardBonusAprPercent > 0 && (
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                    +{rewardBonusAprPercent.toFixed(2)}%
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Balance */}
        {balance !== undefined && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {balance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {asset}
            </div>
          </div>
        )}

        {/* Accrued Interest — amber styling for both supply and borrow (matches desktop) */}
        {accruedInterest !== undefined && accruedInterest > 0 && (
          <div className="p-2 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="text-xs font-semibold mb-1 text-amber-600 dark:text-amber-400">
              {isDeposit ? "Accrued Interest (Earned)" : "Accrued Interest (Owed)"}
            </div>
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {isDeposit ? "+" : ""}{accruedInterest.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: displayDecimals,
              })}{" "}
              {asset}
            </div>
            {accruedInterestValue && (
              <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
                {isDeposit ? "+" : ""}${accruedInterestValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            )}
          </div>
        )}

        {/* Additional Info Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          {isDeposit ? (
            <>
              {collateralFactor !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Collateral Factor
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Maximum percentage of collateral value that can be borrowed</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-sm font-semibold">
                    {(collateralFactor * 100).toFixed(2)}%
                  </div>
                </div>
              )}
              {liquidationFactor !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Liquidation Threshold
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>LTV percentage at which position becomes liquidatable</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-sm font-semibold">
                    {(liquidationFactor * 100).toFixed(2)}%
                  </div>
                </div>
              )}
              {positionHealth !== undefined && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    Position Health
                  </div>
                  {positionHealth === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    (() => {
                      const s = Math.min(positionHealth, 3);
                      const barColor =
                        s >= 2
                          ? "bg-green-500"
                          : s >= 1.5
                            ? "bg-yellow-500"
                            : s >= 1
                              ? "bg-orange-500"
                              : "bg-red-500";
                      const textClass =
                        s >= 2
                          ? "text-green-600 dark:text-green-400"
                          : s >= 1.5
                            ? "text-yellow-600 dark:text-yellow-400"
                            : s >= 1
                              ? "text-orange-500"
                              : "text-red-500";
                      const barPct = Math.min(Math.max(s, 0), 3) * (100 / 3);
                      return (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[60px]">
                            <div
                              className={`h-2 rounded-full ${barColor}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-semibold tabular-nums ${textClass}`}
                          >
                            {s.toFixed(2)}
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {ltvUsage !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    LTV Usage
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Your borrow&apos;s value in USD, compared to this
                          lending pool&apos;s total collateral (from on-chain
                          data).
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          If this row isn&apos;t linked to a pool, we use your
                          portfolio-wide collateral instead.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[60px]">
                      <div
                        className={`h-2 rounded-full ${
                          ltvUsage >= 80
                            ? "bg-red-500"
                            : ltvUsage >= 60
                            ? "bg-orange-500"
                            : ltvUsage >= 40
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(ltvUsage, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {ltvUsage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
              {liquidationPrice !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Liquidation Price
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Estimated price at which liquidation could occur</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-sm font-semibold">
                    ${liquidationPrice.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onDepositClick && (
            <DorkFiButton
              variant={isDeposit ? "secondary" : "borrow-outline"}
              size="sm"
              onClick={onDepositClick}
              className="flex-1 min-w-0"
              disabled={isDeposit ? depositDisabled : borrowDisabled}
              title={
                isDeposit && depositDisabled
                  ? "Market at deposit cap"
                  : !isDeposit && borrowDisabled
                    ? "Market at borrow cap"
                    : undefined
              }
            >
              <Plus className="w-4 h-4 mr-1" />
              {isDeposit ? "Deposit" : "Borrow"}
            </DorkFiButton>
          )}
          {onWithdrawClick && (
            <DorkFiButton
              variant={isDeposit ? "withdraw" : "danger-outline"}
              size="sm"
              onClick={onWithdrawClick}
              className="flex-1 min-w-0"
            >
              <Minus className="w-4 h-4 mr-1" />
              {isDeposit ? "Withdraw" : "Repay"}
            </DorkFiButton>
          )}
        </div>
      </div>
    </DorkFiCard>
  );
};

export default PortfolioTableMobileCard;

