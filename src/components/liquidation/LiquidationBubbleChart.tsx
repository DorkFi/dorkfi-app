
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TopLiquidatedAssets from './TopLiquidatedAssets';

interface LiquidationBubbleChartProps {
  onTokenSelect: (token: any) => void;
  selectedToken: any;
}

export default function LiquidationBubbleChart({ onTokenSelect, selectedToken }: LiquidationBubbleChartProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-white mb-1">
              Top Liquidated Assets
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Interactive visualization of liquidation activity
            </p>
          </div>
          <Badge 
            variant="outline" 
            className="bg-ocean-teal/10 border-ocean-teal/30 text-ocean-teal text-xs"
          >
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TopLiquidatedAssets 
          className="min-h-[400px]" 
          onTokenSelect={onTokenSelect}
          selectedTokenId={selectedToken?.id}
        />
      </CardContent>
    </Card>
  );
}
