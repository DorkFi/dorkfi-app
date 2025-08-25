
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TopLiquidatedAssets from './TopLiquidatedAssets';

export default function TopLiquidatedAssetsSection() {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              Top Liquidated Assets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Interactive visualization showing the most actively liquidated assets
            </p>
          </div>
          <Badge 
            variant="outline" 
            className="bg-ocean-teal/10 border-ocean-teal/30 text-ocean-teal w-fit"
          >
            Live Data
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <TopLiquidatedAssets className="min-h-[500px]" />
      </CardContent>
    </Card>
  );
}
