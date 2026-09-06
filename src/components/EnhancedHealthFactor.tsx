import { Card, CardContent } from "@/components/ui/card";
import React, { type ReactNode } from "react";
import UnderwaterScene from "./liquidation/UnderwaterScene";
import PositionStatsGrid from "./liquidation/PositionStatsGrid";
import HealthFactorActions from "./liquidation/HealthFactorActions";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { RefreshCw, HelpCircle } from "lucide-react";
import {
  DesktopTooltip,
} from "@/components/ui/tooltip";
import { portfolioSectionTitleClassName } from "@/components/portfolio/portfolioSectionTitle";
import { getHealthFactorStatusPanel } from "@/utils/healthFactorUx";
import { cn } from "@/lib/utils";

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
        <CardContent className="px-4 pt-3 pb-4 sm:p-6 md:p-8">
          {/* Enhanced Responsive Layout */}
          <div className="grid grid-cols-1 items-start gap-4 sm:gap-8 lg:grid-cols-[420px,1fr] lg:gap-10">
            {/* Left Side - Enhanced Health Gauge + Status message */}
            <div className="order-2 space-y-4 lg:order-1 lg:border-r-2 lg:border-ocean-teal/20 lg:pr-8">
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
              {insights ? (
                <div className="border-t border-border/50 pt-4 lg:hidden">
                  {insights}
                </div>
              ) : null}
            </div>

            {/* Right Side - Stats Panel & CTAs */}
            <div className="order-1 space-y-4 sm:space-y-6 lg:order-2">
              {/* Enhanced Header — hidden on mobile; refresh lives in HealthFactorActions */}
              <div className="hidden border-b-2 border-ocean-teal/20 pb-4 sm:block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className={portfolioSectionTitleClassName}>
                        Position Overview
                      </h2>
                      <DesktopTooltip
                        className="max-w-xs text-left"
                        content={
                          <p>
                            All collateral contributes to your health factor.
                            Actions are limited so your position stays above the
                            liquidation threshold (HF = 1.0).
                          </p>
                        }
                      >
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground rounded-full p-0.5"
                          aria-label="About health factor"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </DesktopTooltip>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
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
                        className={cn(
                          "mr-2 h-4 w-4",
                          isRefreshingMarkets && "animate-spin"
                        )}
                      />
                      Refresh
                    </DorkFiButton>
                  )}
                </div>
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
                onRefreshMarkets={onRefreshMarkets}
                isRefreshingMarkets={isRefreshingMarkets}
              />

              {insights ? (
                <div className="hidden border-t border-border/50 pt-4 lg:block">
                  {insights}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedHealthFactor;
