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
            <DorkFiButton
              variant="withdraw"
              size="lg"
              onClick={onWithdraw}
              className="w-full min-w-0 h-12 gap-2 mt-1"
            >
              <ArrowUpFromLine className="w-5 h-5 shrink-0" />
              Withdraw
            </DorkFiButton>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>Withdraw supplied assets back to your wallet.</p>
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
