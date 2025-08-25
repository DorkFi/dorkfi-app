import { Card, CardContent } from "@/components/ui/card";
import React from 'react';
import UnderwaterScene from './liquidation/UnderwaterScene';
import PositionStatsGrid from './liquidation/PositionStatsGrid';
import HealthFactorActions from './liquidation/HealthFactorActions';

interface EnhancedHealthFactorProps {
  healthFactor: number;
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
    <div className="w-full max-w-6xl mx-auto">
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 overflow-hidden shadow-md card-hover transition-all hover:border-ocean-teal/40">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - NFT + Underwater Visual */}
            <UnderwaterScene 
              healthFactor={healthFactor}
              dorkNftImage={dorkNftImage}
              underwaterBg={underwaterBg}
            />

            {/* Right Side - Stats Panel & CTAs */}
            <div className="space-y-6">
              <div className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Position Overview</div>
              
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
