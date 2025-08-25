
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Asset {
  symbol: string;
  amount: number;
  valueUSD: number;
}

interface AssetListProps {
  title: string;
  assets: Asset[];
  colorScheme: 'collateral' | 'borrowed';
}

export default function AssetList({ title, assets, colorScheme }: AssetListProps) {
  const getColorClasses = (scheme: 'collateral' | 'borrowed') => {
    return scheme === 'collateral' 
      ? { bg: 'bg-ocean-teal/10', text: 'text-ocean-teal' }
      : { bg: 'bg-whale-gold/10', text: 'text-whale-gold' };
  };

  const colors = getColorClasses(colorScheme);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assets.map((asset, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-xs font-bold ${colors.text}`}>
                    {asset.symbol.substring(0, 2)}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="font-medium text-base leading-tight">{asset.symbol}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {asset.amount.toLocaleString()} tokens
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold">${asset.valueUSD.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">
                  ${(asset.valueUSD / asset.amount).toFixed(2)}/token
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
