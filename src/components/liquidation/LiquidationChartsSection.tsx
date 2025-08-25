
import React from 'react';
import TopLiquidatedAssetsSection from './TopLiquidatedAssetsSection';
import RiskDistributionBar from './RiskDistributionBar';

interface LiquidationChartsSectionProps {
  riskDistributionData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  healthFactorData: Array<{
    range: string;
    count: number;
    fill: string;
  }>;
}

export default function LiquidationChartsSection({ 
  riskDistributionData, 
  healthFactorData 
}: LiquidationChartsSectionProps) {
  // Calculate totals for the new component
  const totalAccounts = healthFactorData.reduce((sum, item) => sum + item.count, 0);
  const liquidatable = healthFactorData.find(item => item.range === '0-1.0')?.count || 0;
  const dangerZone = healthFactorData.find(item => item.range === '1.0-1.1')?.count || 0;
  const moderate = healthFactorData.find(item => item.range === '1.1-1.2')?.count || 0;
  const safe = healthFactorData.find(item => item.range === '>1.2')?.count || 0;

  return (
    <div className="space-y-8">
      {/* Enhanced Bubble Chart with Time Controls */}
      <TopLiquidatedAssetsSection />
      
      {/* Risk Distribution Bar */}
      <RiskDistributionBar
        totalAccounts={totalAccounts}
        liquidatable={liquidatable}
        dangerZone={dangerZone}
        moderate={moderate}
        safe={safe}
      />
    </div>
  );
}
