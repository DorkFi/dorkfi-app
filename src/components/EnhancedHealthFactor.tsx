import { Card, CardContent } from "@/components/ui/card";
import React from 'react';
import UnderwaterScene from './liquidation/UnderwaterScene';
import PositionStatsGrid from './liquidation/PositionStatsGrid';
import HealthFactorActions from './liquidation/HealthFactorActions';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal } from "lucide-react";
import PositionSafetyLevers from "./liquidation/PositionSafetyLevers";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}: EnhancedHealthFactorProps) => {
  const [safetyOpen, setSafetyOpen] = React.useState(false);
  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <Card className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-2 border-gray-200/50 dark:border-ocean-teal/30 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:border-ocean-teal/50">
        <CardContent className="p-6 md:p-8">
          {/* Enhanced Responsive Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-8 lg:gap-10">
            {/* Left Side - Enhanced Health Gauge */}
            <div className="xl:border-r-2 xl:border-ocean-teal/20 xl:pr-8 order-2 xl:order-1">
              <UnderwaterScene 
                healthFactor={healthFactor}
                dorkNftImage={dorkNftImage}
                underwaterBg={underwaterBg}
                onEdit={onEditProfile}
              />
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
                  <Button
                    onClick={onRefreshMarkets}
                    disabled={isRefreshingMarkets}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs sm:text-sm border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh all market data"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${
                        isRefreshingMarkets ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>
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
                totalBorrowed={totalBorrowed}
              />

              <Collapsible open={safetyOpen} onOpenChange={setSafetyOpen}>
                <Card className="bg-white/60 dark:bg-slate-950/25 border border-gray-200/60 dark:border-ocean-teal/20 shadow-sm">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-ocean-teal/5"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-whale-gold" />
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          Safety Levers
                        </span>
                      </div>
                      {safetyOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <PositionSafetyLevers
                        totalCollateral={totalCollateral}
                        totalBorrowed={totalBorrowed}
                        weightedCollateralFactor={weightedCollateralFactor}
                        weightedLiquidationThreshold={weightedLiquidationThreshold}
                        onAddCollateral={onAddCollateral}
                        onRepayDebt={onRepayDebt}
                      />
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedHealthFactor;
