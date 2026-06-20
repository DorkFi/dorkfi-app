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

      {/* Actions: Supply and Repay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {onAddCollateral && (
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
        )}
        {totalBorrowed > 0 && onRepayDebt && (
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
        )}
      </div>

      {onWithdraw && (
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
          <span className="block w-full">
            <DorkFiButton
              variant="withdraw"
              size="lg"
              onClick={onWithdraw}
              disabled={isCritical}
              className="w-full min-w-0 h-12 gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpFromLine className="w-5 h-5 shrink-0" />
              Withdraw
            </DorkFiButton>
          </span>
        </DesktopTooltip>
      )}

      {isHighRisk && (
        <p className="text-xs text-muted-foreground mt-3">
          Volatility and interest can change your health factor. Review positions in Supplied and Borrowed Assets below.
        </p>
      )}
    </>
  );
};

export default HealthFactorActions;
