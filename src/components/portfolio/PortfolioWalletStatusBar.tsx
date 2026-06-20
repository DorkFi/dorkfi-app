import { cn } from "@/lib/utils";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { XchainUsdcBridgeControls } from "@/components/xchain/XchainUsdcBridgeControls";

export type PortfolioWalletStatus = {
  hasComputedData: boolean;
  hasUserGlobalData: boolean;
  addressLabel: string;
  globalNetPortfolioValue?: number | null;
  showRiskMetrics: boolean;
  weightedCollateralFactor: number;
  weightedLiquidationThreshold: number;
};

export type PortfolioWalletStatusBarProps = PortfolioWalletStatus & {
  className?: string;
  /** When true, content is centered (desktop hero). Otherwise left-aligned (mobile strip). */
  centered?: boolean;
};

const PortfolioWalletStatusBar = ({
  className,
  centered = false,
  hasComputedData,
  hasUserGlobalData,
  addressLabel,
  globalNetPortfolioValue,
  showRiskMetrics,
  weightedCollateralFactor,
  weightedLiquidationThreshold,
}: PortfolioWalletStatusBarProps) => {
  const { formatCurrency, formatPercent } = useNumberI18n();

  const dataSourceLabel = hasComputedData
    ? "Global Portfolio Data"
    : hasUserGlobalData
      ? "Live Data"
      : "No Data";

  const hasLiveIndicator = hasComputedData || hasUserGlobalData;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        centered ? "justify-center" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          hasLiveIndicator ? "bg-green-500" : "bg-gray-500"
        )}
      />
      <span className="min-w-0">
        {dataSourceLabel} • {addressLabel}
      </span>
      {globalNetPortfolioValue !== undefined &&
      globalNetPortfolioValue !== null ? (
        <span className="shrink-0">
          • Net Value:{" "}
          {formatCurrency(Number(globalNetPortfolioValue), "USD", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ) : null}
      {showRiskMetrics ? (
        <span className={cn(centered ? "ml-2" : "w-full basis-full")}>
          • Collateral Factor:{" "}
          {formatPercent(weightedCollateralFactor, { maximumFractionDigits: 0 })}{" "}
          • Liquidation Threshold:{" "}
          {formatPercent(weightedLiquidationThreshold, {
            maximumFractionDigits: 1,
          })}
        </span>
      ) : null}
      <div
        className={cn(
          "flex w-full shrink-0 basis-full px-0 empty:hidden",
          centered
            ? "mt-2 justify-center px-2 lg:mt-0 lg:ml-2 lg:w-auto lg:basis-auto lg:px-0 lg:justify-start"
            : "mt-1 justify-start"
        )}
      >
        <XchainUsdcBridgeControls
          className={centered ? "justify-center lg:justify-start" : "justify-start"}
        />
      </div>
    </div>
  );
};

export default PortfolioWalletStatusBar;
