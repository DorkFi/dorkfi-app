import { Card, CardContent } from "@/components/ui/card";
import React, { type ReactNode } from "react";
import UnderwaterScene from "./liquidation/UnderwaterScene";
import PositionStatsGrid from "./liquidation/PositionStatsGrid";
import HealthFactorActions from "./liquidation/HealthFactorActions";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { RefreshCw, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { portfolioSectionTitleClassName } from "@/components/portfolio/portfolioSectionTitle";
import { getHealthFactorStatusPanel } from "@/utils/healthFactorUx";

interface EnhancedHealthFactorProps {
  healthFactor: number | null;
  /** e.g. "Algorand · Market A" — which pool the headline HF applies to */
  marketContextLine?: string | null;
  totalCollateral: number;
  totalBorrowed: number;
  dorkNftImage?: string;
  underwaterBg: string;
  onAddCollateral?: () => void;
  onBuyVoi?: () => void;
  onEditProfile?: () => void;
  onRefreshMarkets?: () => void;
  isRefreshingMarkets?: boolean;
  onRepayDebt?: () => void;
  onWithdraw?: () => void;
  insights?: ReactNode;
}

const EnhancedHealthFactor = ({
  healthFactor,
  marketContextLine,
  totalCollateral,
  totalBorrowed,
  dorkNftImage,
  underwaterBg,
  onAddCollateral,
  onBuyVoi,
  onEditProfile,
  onRefreshMarkets,
  isRefreshingMarkets,
  onRepayDebt,
  onWithdraw,
  insights,
}: EnhancedHealthFactorProps) => {
  const hfStatusPanel = getHealthFactorStatusPanel(healthFactor);

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <Card className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-2 border-gray-200/50 dark:border-ocean-teal/30 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:border-ocean-teal/50">
        <CardContent className="p-6 md:p-8">
          {/* Enhanced Responsive Layout */}
          <div className="grid grid-cols-1 items-start xl:grid-cols-[420px,1fr] gap-8 lg:gap-10">
            {/* Left Side - Enhanced Health Gauge + Status message */}
            <div className="xl:border-r-2 xl:border-ocean-teal/20 xl:pr-8 order-2 xl:order-1 space-y-4">
              <UnderwaterScene
                healthFactor={healthFactor}
                marketContextLine={marketContextLine}
                dorkNftImage={dorkNftImage}
                underwaterBg={underwaterBg}
                onEdit={onEditProfile}
              />
              <div
                className={`rounded-xl border-2 p-4 transition-all duration-300 ${hfStatusPanel.panelClassName}`}
              >
                <p className="text-sm font-medium text-foreground">
                  {hfStatusPanel.message}
                </p>
              </div>
            </div>

            {/* Right Side - Stats Panel & CTAs */}
            <div className="space-y-6 order-1 xl:order-2">
              {/* Enhanced Header */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-ocean-teal/20 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className={portfolioSectionTitleClassName}>
                      Position Overview
                    </h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5"
                          aria-label="About health factor"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-left">
                        <p>
                          All collateral contributes to your health factor. Actions are limited so your position stays above the liquidation threshold (HF = 1.0).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Health factor is your main risk number—keep it above 1.0
                  </p>
                </div>
                {onRefreshMarkets && (
                  <DorkFiButton
                    onClick={onRefreshMarkets}
                    disabled={isRefreshingMarkets}
                    variant="secondary"
                    size="sm"
                    className="min-w-0 shrink-0"
                    title="Refresh all market data"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${
                        isRefreshingMarkets ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </DorkFiButton>
                )}
                {/*
<div className={`px-3 py-1 rounded-full text-xs font-semibold ${
  healthFactor === null ? 'bg-gray-500/20 text-gray-400' :
  healthFactor <= 1.0 ? 'bg-red-500/20 text-red-400' :
  healthFactor <= 1.2 ? 'bg-orange-500/20 text-orange-400' :
  healthFactor <= 1.5 ? 'bg-yellow-500/20 text-yellow-400' :
  'bg-green-500/20 text-green-400'
}`}>
  {healthFactor === null ? 'No Collateral' :
   healthFactor <= 1.0 ? 'Critical' :
   healthFactor <= 1.2 ? 'High Risk' :
   healthFactor <= 1.5 ? 'Moderate' : 'Safe'}
</div>
*/}
              </div>
              
              {/* Stats Grid with Tooltips */}
              <PositionStatsGrid
                totalCollateral={totalCollateral}
                totalBorrowed={totalBorrowed}
                healthFactor={healthFactor}
              />
              
              {/* Action Buttons and Risk Warning */}
              <HealthFactorActions 
                healthFactor={healthFactor}
                onAddCollateral={onAddCollateral}
                onBuyVoi={onBuyVoi}
                onRepayDebt={onRepayDebt}
                onWithdraw={onWithdraw}
                totalBorrowed={totalBorrowed}
              />

              {insights ? (
                <div className="border-t border-border/50 pt-4">{insights}</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedHealthFactor;
