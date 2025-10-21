import { Card, CardContent } from "@/components/ui/card";
import React from 'react';
import UnderwaterScene from './liquidation/UnderwaterScene';
import PositionStatsGrid from './liquidation/PositionStatsGrid';
import HealthFactorActions from './liquidation/HealthFactorActions';

interface EnhancedHealthFactorProps {
  healthFactor: number | null;
  totalCollateral: number;
  totalBorrowed: number;
  liquidationMargin: number;
  netLTV: number;
  dorkNftImage: string;
  underwaterBg: string;
  onAddCollateral: () => void;
  onBuyVoi: () => void;
}

const EnhancedHealthFactor = ({
  healthFactor,
  totalCollateral,
  totalBorrowed,
  liquidationMargin,
  netLTV,
  dorkNftImage,
  underwaterBg,
  onAddCollateral,
  onBuyVoi
}: EnhancedHealthFactorProps) => {
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
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedHealthFactor;
