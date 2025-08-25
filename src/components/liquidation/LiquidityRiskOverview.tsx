import React from 'react';
import { Separator } from '@/components/ui/separator';
import { H2 } from '@/components/ui/Typography';
import DebtByAssetChart from './DebtByAssetChart';
import ProtocolUtilizationChart from './ProtocolUtilizationChart';

export default function LiquidityRiskOverview() {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-2">
        <H2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Protocol Liquidity & Risk Overview
        </H2>
        <Separator className="bg-gradient-to-r from-ocean-teal/30 to-transparent" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Debt by Asset */}
        <DebtByAssetChart />
        
        {/* Right Column: Protocol Utilization */}
        <ProtocolUtilizationChart />
      </div>
    </div>
  );
}