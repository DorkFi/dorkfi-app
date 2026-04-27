import DorkFiButton from "@/components/ui/DorkFiButton";
import { Plus, Minus, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { useNetwork } from "@/contexts/NetworkContext";
import { getTokenConfig, getMarketLabel } from "@/config";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";
import { shouldShowConfigSymbolUnderDisplayAsset } from "@/utils/portfolioAssetSubline";

interface PortfolioTableMobileCardProps {
  asset: string;
  /** Canonical token key when display `asset` is shared (e.g. fALGO vs ALGO both "Algo"). */
  configSymbol?: string;
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
  configSymbol,
  icon,
  value,
  balance,
  apy,
  intrinsicApyPercent,
  rewardBonusAprPercent,
  accruedInterest,
  accruedInterestValue,
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
                  className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full ${marketPoolBadgeBgClassName(
                    marketLabel
                  )} border-2 border-white dark:border-slate-800 flex items-center justify-center z-10`}
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
              {shouldShowConfigSymbolUnderDisplayAsset(asset, configSymbol) && (
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {configSymbol}
                  </div>
                )}
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
              })}
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
              })}
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

        {/* Liquidation price (borrow, when enabled) */}
        {!isDeposit && liquidationPrice !== undefined && (
          <div className="pt-2 border-t border-border">
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
          </div>
        )}

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

