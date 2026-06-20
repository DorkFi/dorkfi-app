
import type { ReactNode } from "react";
import { DesktopTooltip } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  formatHealthFactorBuffer,
  getHealthFactorTextColorClass,
} from "@/utils/healthFactorUx";
import { H1 } from "@/components/ui/Typography";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import PortfolioWalletStatusBar, {
  type PortfolioWalletStatus,
} from "@/components/portfolio/PortfolioWalletStatusBar";

interface PositionStatsGridProps {
  totalCollateral: number;
  totalBorrowed: number;
  healthFactor: number | null;
  walletStatus?: PortfolioWalletStatus;
}

const usdOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

function StatInfoTooltip({ children }: { children: ReactNode }) {
  return (
    <DesktopTooltip className="max-w-xs" content={children}>
      <Info className="h-3 w-3 cursor-help" />
    </DesktopTooltip>
  );
}

const PositionStatsGrid = ({
  totalCollateral,
  totalBorrowed,
  healthFactor,
  walletStatus,
}: PositionStatsGridProps) => {
  const { formatCurrency } = useNumberI18n();
  const formatUsd = (value: number) =>
    formatCurrency(value, "USD", usdOptions);

  const bufferText = formatHealthFactorBuffer(healthFactor);
  const hfColorClass =
    healthFactor !== null
      ? getHealthFactorTextColorClass(healthFactor)
      : "text-muted-foreground";
  const netValue = totalCollateral - totalBorrowed;
  const netColorClass =
    netValue >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  return (
    <>
      {/* Mobile: hero-style title + stats */}
      <div className="sm:hidden">
        <div className="mb-3 text-left">
          <H1 className="m-0 text-2xl font-semibold leading-none tracking-tight">
            <span className="hero-header">Portfolio Overview</span>
          </H1>
          {walletStatus ? (
            <PortfolioWalletStatusBar className="mt-2" {...walletStatus} />
          ) : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 px-4 pb-4 pt-3 dark:bg-muted/10">
          <div className="text-sm text-muted-foreground">Net Portfolio Value</div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${netColorClass}`}>
            {formatUsd(netValue)}
          </div>
          {totalCollateral > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {((netValue / totalCollateral) * 100).toFixed(1)}% of collateral
              value
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
            <div>
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                Collateral
              </div>
              <div className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
                {formatUsd(totalCollateral)}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                Borrowed
              </div>
              <div className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatUsd(totalBorrowed)}
              </div>
            </div>
            <div className="col-span-2">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                Liquidation buffer
              </div>
              <div className={`text-lg font-bold tabular-nums ${hfColorClass}`}>
                {bufferText}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet / desktop: full 2×2 grid */}
      <div className="hidden gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40 sm:grid sm:grid-cols-2">
        <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
          <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Total Collateral
            <StatInfoTooltip>
              <p>Total USD value of assets you have supplied.</p>
            </StatInfoTooltip>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatUsd(totalCollateral)}
          </div>
        </div>

        <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
          <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Total Borrowed
            <StatInfoTooltip>
              <p>Total USD value of your outstanding debt (accrues interest).</p>
            </StatInfoTooltip>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatUsd(totalBorrowed)}
          </div>
        </div>

        <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
          <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-cyan-500" />
            Liquidation buffer
            <StatInfoTooltip>
              <p>
                How far your health factor is above liquidation (HF = 1.0).
                Higher buffer means more room before actions are blocked.
              </p>
            </StatInfoTooltip>
          </div>
          <div className={`text-2xl font-bold ${hfColorClass}`}>{bufferText}</div>
        </div>

        <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
          <div className="mb-2 text-sm text-muted-foreground">
            Net Portfolio Value
          </div>
          <div className={`text-2xl font-bold ${netColorClass}`}>
            {formatUsd(netValue)}
          </div>
          {totalCollateral > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {((netValue / totalCollateral) * 100).toFixed(1)}% of collateral
              value
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PositionStatsGrid;
