import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthFactorActionsProps {
  healthFactor: number | null;
  onAddCollateral: () => void;
  onBuyVoi: () => void;
}

const HealthFactorActions = ({
  healthFactor,
  onAddCollateral,
  onBuyVoi,
}: HealthFactorActionsProps) => {
  const getRiskLevel = (hf: number | null) => {
    if (hf === null)
      return { level: "No Collateral", color: "gray", urgency: "none" };
    if (hf <= 1.0)
      return { level: "Critical", color: "red", urgency: "immediate" };
    if (hf <= 1.1)
      return { level: "Danger", color: "orange", urgency: "urgent" };
    if (hf <= 1.2)
      return { level: "Caution", color: "yellow", urgency: "monitor" };
    if (hf <= 1.5)
      return { level: "Moderate", color: "blue", urgency: "stable" };
    return { level: "Safe", color: "green", urgency: "healthy" };
  };

  const risk = getRiskLevel(healthFactor);
  const isHighRisk = healthFactor !== null && healthFactor <= 1.2;
  const isCritical = healthFactor !== null && healthFactor <= 1.0;

  return (
    <>
      {/* Risk Assessment Card */}
      <div
        className={`p-4 rounded-lg border-2 transition-all duration-300 ${
          healthFactor === null
            ? "bg-gray-500/20 border-gray-500/50"
            : isCritical
            ? "bg-red-500/20 border-red-500/50 animate-pulse"
            : isHighRisk
            ? "bg-orange-500/20 border-orange-500/50"
            : "bg-blue-500/20 border-blue-500/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-3 h-3 rounded-full ${
              healthFactor === null
                ? "bg-gray-500"
                : isCritical
                ? "bg-red-500 animate-pulse"
                : isHighRisk
                ? "bg-orange-500"
                : "bg-blue-500"
            }`}
          ></div>
          <div>
            <div
              className={`font-semibold ${
                healthFactor === null
                  ? "text-gray-400"
                  : isCritical
                  ? "text-red-400"
                  : isHighRisk
                  ? "text-orange-400"
                  : "text-blue-400"
              }`}
            >
              {risk.level} Risk Level
            </div>
            <div className="text-xs text-muted-foreground">
              Health Factor: {healthFactor !== null ? healthFactor.toFixed(3) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Contextual Recommendations */}
        <div className="text-sm space-y-1">
          {healthFactor === null && (
            <div className="text-gray-300 font-medium">
              💡 No collateral deposited. Add assets to start earning and borrowing.
            </div>
          )}
          {isCritical && (
            <div className="text-red-300 font-medium">
              🚨 Immediate action required! Add collateral or repay debt to
              avoid liquidation.
            </div>
          )}
          {isHighRisk && !isCritical && (
            <div className="text-orange-300">
              ⚠️ Consider adding collateral or reducing debt to improve your
              position.
            </div>
          )}
          {!isHighRisk && healthFactor !== null && (
            <div className="text-blue-300">
              ✅ Your position is stable. Monitor market conditions regularly.
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons with Enhanced Styling */}
      <div className="space-y-3 pt-2">
        {/*
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onAddCollateral}
              className={`w-full font-semibold py-3 transition-all duration-300 ${
                isHighRisk
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
                  : "bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              }`}
            >
              {isHighRisk ? "🚨 Add Collateral (Urgent)" : "Add Collateral"}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Deposit more assets to increase your collateral, improve your
              health factor, and gain more borrowing capacity. Recommended when
              health factor is low.
            </p>
          </TooltipContent>
        </Tooltip>*/}

        {/*<Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onBuyVoi}
              variant="outline"
              className="w-full border-whale-gold text-whale-gold hover:bg-whale-gold hover:text-black font-semibold py-3 transition-all duration-300"
            >
              Buy VOI
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Purchase VOI tokens to use as collateral or to repay VOI-denominated debt. Helps strengthen your position in the VOI ecosystem.</p>
          </TooltipContent>
        </Tooltip>*/}
      </div>

      {/* Additional Risk Information */}
      {isHighRisk && (
        <div className="mt-4 p-3 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Risk Factors:</div>
            <div>• Market volatility can quickly change your health factor</div>
            <div>• Interest accrual increases your debt over time</div>
            <div>
              • Consider setting up price alerts for your collateral assets
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthFactorActions;
