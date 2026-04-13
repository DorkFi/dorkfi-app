import DorkFiButton from "@/components/ui/DorkFiButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface HealthFactorActionsProps {
  healthFactor: number | null;
  onAddCollateral?: () => void;
  onBuyVoi?: () => void;
  onRepayDebt?: () => void;
  onWithdraw?: () => void;
  totalBorrowed?: number;
}

const HealthFactorActions = ({
  healthFactor,
  onAddCollateral,
  onBuyVoi,
  onRepayDebt,
  onWithdraw,
  totalBorrowed = 0,
}: HealthFactorActionsProps) => {
  const isHighRisk = healthFactor !== null && healthFactor <= 1.2;
  const isCritical = healthFactor !== null && healthFactor <= 1.0;

  return (
    <>
      {/* Actions: Supply and Repay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {onAddCollateral && (
          <Tooltip>
            <TooltipTrigger asChild>
              <DorkFiButton
                onClick={onAddCollateral}
                variant={isHighRisk ? "danger" : "primary"}
                size="lg"
                className="w-full min-w-0 h-12 gap-2"
              >
                <Plus className="w-5 h-5 shrink-0" />
                Supply
              </DorkFiButton>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>Add assets to earn yield and use as collateral. Improves health factor.</p>
            </TooltipContent>
          </Tooltip>
        )}
        {totalBorrowed > 0 && onRepayDebt && (
          <Tooltip>
            <TooltipTrigger asChild>
              <DorkFiButton
                variant={isHighRisk ? "danger-outline" : "secondary"}
                size="lg"
                onClick={onRepayDebt}
                className="w-full min-w-0 h-12 gap-2"
              >
                <ArrowDownToLine className="w-5 h-5 shrink-0" />
                Repay
              </DorkFiButton>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>Pay down debt to improve health factor and reduce liquidation risk.</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {onWithdraw && (
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>
              {isCritical
                ? "Withdrawals are blocked while health factor is at or below 1.0. Supply collateral or repay debt first."
                : "Withdraw supplied assets to your wallet (up to the HF-safe maximum)."}
            </p>
          </TooltipContent>
        </Tooltip>
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
