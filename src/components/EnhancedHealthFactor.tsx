import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import UnderwaterScene from "./liquidation/UnderwaterScene";
import PositionStatsGrid from "./liquidation/PositionStatsGrid";
import HealthFactorActions from "./liquidation/HealthFactorActions";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { RefreshCw } from "lucide-react";

interface EnhancedHealthFactorProps {
  healthFactor: number | null;
  totalCollateral: number;
  totalBorrowed: number;
  liquidationMargin: number;
  netLTV: number;
  weightedCollateralFactor?: number;
  weightedLiquidationThreshold?: number;
  dorkNftImage?: string;
  underwaterBg: string;
  onAddCollateral?: () => void;
  onBuyVoi?: () => void;
  onEditProfile?: () => void;
  onRefreshMarkets?: () => void;
  isRefreshingMarkets?: boolean;
  onRepayDebt?: () => void;
  onWithdraw?: () => void;
}

const EnhancedHealthFactor = ({
  healthFactor,
  totalCollateral,
  totalBorrowed,
  liquidationMargin,
  netLTV,
  weightedCollateralFactor = 0.8,
  weightedLiquidationThreshold = 0.85,
  dorkNftImage,
  underwaterBg,
  onAddCollateral,
  onBuyVoi,
  onEditProfile,
  onRefreshMarkets,
  isRefreshingMarkets,
  onRepayDebt,
  onWithdraw,
}: EnhancedHealthFactorProps) => {
  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <Card className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-2 border-gray-200/50 dark:border-ocean-teal/30 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:border-ocean-teal/50">
        <CardContent className="p-6 md:p-8">
          {/* Enhanced Responsive Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-8 lg:gap-10">
            {/* Left Side - Enhanced Health Gauge + Status message */}
            <div className="xl:border-r-2 xl:border-ocean-teal/20 xl:pr-8 order-2 xl:order-1 space-y-4">
              <UnderwaterScene 
                healthFactor={healthFactor}
                dorkNftImage={dorkNftImage}
                underwaterBg={underwaterBg}
                onEdit={onEditProfile}
              />
              {/* Status message - directly below health factor value */}
              <div
                className={`rounded-xl border-2 p-4 transition-all duration-300 ${
                  healthFactor === null
                    ? "bg-slate-500/10 border-slate-500/30"
                    : healthFactor <= 1.0
                    ? "bg-red-500/15 border-red-500/40"
                    : healthFactor <= 1.2
                    ? "bg-amber-500/15 border-amber-500/40"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                <p className="text-sm font-medium text-foreground">
                  {healthFactor === null && "No collateral yet. Supply assets to earn yield and borrow."}
                  {healthFactor !== null && healthFactor <= 1.0 && "Action needed: supply more collateral or repay debt to avoid liquidation."}
                  {healthFactor !== null && healthFactor > 1.0 && healthFactor <= 1.2 && "Consider supplying more or repaying debt to improve your health factor."}
                  {healthFactor !== null && healthFactor > 1.2 && "Position looks healthy. Supply or repay below to adjust."}
                </p>
              </div>
            </div>

            {/* Right Side - Stats Panel & CTAs */}
            <div className="space-y-6 order-1 xl:order-2">
              {/* Enhanced Header */}
              <div className="flex items-center justify-between pb-4 border-b-2 border-ocean-teal/20">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    Position Overview
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Monitor your portfolio health and manage risk
                  </p>
                </div>
                {onRefreshMarkets && (
                  <DorkFiButton
                    onClick={onRefreshMarkets}
                    disabled={isRefreshingMarkets}
                    variant="secondary"
                    size="sm"
                    className="min-w-0"
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
                liquidationMargin={liquidationMargin}
                netLTV={netLTV}
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedHealthFactor;
