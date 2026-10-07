import DorkFiButton from "@/components/ui/DorkFiButton";
import { DesktopTooltip } from "@/components/ui/tooltip";
import { Plus, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthFactorActionsProps {
  healthFactor: number | null;
  onAddCollateral?: () => void;
  onBuyVoi?: () => void;
  onRepayDebt?: () => void;
  onWithdraw?: () => void;
  totalBorrowed?: number;
  onRefreshMarkets?: () => void;
  isRefreshingMarkets?: boolean;
}

const HealthFactorActions = ({
  healthFactor,
  onAddCollateral,
  onBuyVoi,
  onRepayDebt,
  onWithdraw,
  totalBorrowed = 0,
  onRefreshMarkets,
  isRefreshingMarkets,
}: HealthFactorActionsProps) => {
  const isHighRisk = healthFactor !== null && healthFactor <= 1.2;
  const isCritical = healthFactor !== null && healthFactor <= 1.0;

  return (
    <>
      {onRefreshMarkets && (
        <DorkFiButton
          onClick={onRefreshMarkets}
          disabled={isRefreshingMarkets}
          variant="secondary"
          size="sm"
          className="mb-3 w-full !min-h-10 !min-w-0 gap-2 sm:hidden"
          title="Refresh all market data"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 shrink-0",
              isRefreshingMarkets && "animate-spin"
            )}
          />
          Refresh
        </DorkFiButton>
      )}

      {/* Supply + Withdraw side by side from md up; stacked on mobile. Repay sits next to Supply when there is no Withdraw, otherwise full width below. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 pt-1",
          (onAddCollateral && onWithdraw) ||
            (onAddCollateral && totalBorrowed > 0 && onRepayDebt) ||
            (onWithdraw && totalBorrowed > 0 && onRepayDebt)
            ? "md:grid-cols-2"
            : null
        )}
      >
        {onAddCollateral && (
          <div className="min-w-0">
            <DesktopTooltip
              side="top"
              className="max-w-xs"
              content={
                <p>
                  Add assets to earn yield and use as collateral. Improves health
                  factor.
                </p>
              }
            >
              <DorkFiButton
                onClick={onAddCollateral}
                variant={isHighRisk ? "danger" : "primary"}
                size="lg"
                className="w-full min-w-0 h-12 gap-2"
              >
                <Plus className="w-5 h-5 shrink-0" />
                Supply
              </DorkFiButton>
            </DesktopTooltip>
          </div>
        )}
        {onWithdraw && (
          <div className="min-w-0">
            <DesktopTooltip
              side="top"
              className="max-w-xs"
              content={
                <p>
                  {isCritical
                    ? "Withdrawals are blocked while health factor is at or below 1.0. Supply collateral or repay debt first."
                    : "Withdraw supplied assets to your wallet (up to the HF-safe maximum)."}
                </p>
              }
            >
              <DorkFiButton
                variant="withdraw"
                size="lg"
                onClick={onWithdraw}
                disabled={isCritical}
                className="w-full min-w-0 h-12 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpFromLine className="w-5 h-5 shrink-0" />
                Withdraw
              </DorkFiButton>
            </DesktopTooltip>
          </div>
        )}
        {totalBorrowed > 0 && onRepayDebt && (
          <div
            className={cn(
              "min-w-0",
              onAddCollateral && onWithdraw && "md:col-span-2"
            )}
          >
            <DesktopTooltip
              side="top"
              className="max-w-xs"
              content={
                <p>
                  Pay down debt to improve health factor and reduce liquidation
                  risk.
                </p>
              }
            >
              <DorkFiButton
                variant={isHighRisk ? "danger-outline" : "secondary"}
                size="lg"
                onClick={onRepayDebt}
                className="w-full min-w-0 h-12 gap-2"
              >
                <ArrowDownToLine className="w-5 h-5 shrink-0" />
                Repay
              </DorkFiButton>
            </DesktopTooltip>
          </div>
        )}
      </div>

      {isHighRisk && (
        <p className="text-xs text-muted-foreground mt-3">
          Volatility and interest can change your health factor. Review positions in Supplied and Borrowed Assets below.
        </p>
      )}
    </>
  );
};

export default HealthFactorActions;
