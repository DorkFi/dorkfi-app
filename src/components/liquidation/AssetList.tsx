
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Asset {
  symbol: string;
  amount: number;
  valueUSD: number;
  collateralFactor?: number;
  liquidationThreshold?: number;
}

interface AssetListProps {
  title: string;
  assets: Asset[];
  colorScheme: 'collateral' | 'borrowed';
  totalBorrowed?: number; // For calculating LTV per asset
  accountHealthFactor?: number; // Overall account health factor
  weightedCollateralValue?: number; // Weighted collateral value for proper calculations
}

export default function AssetList({ 
  title, 
  assets, 
  colorScheme, 
  totalBorrowed = 0, 
  accountHealthFactor = 3.0,
  weightedCollateralValue = 0 
}: AssetListProps) {
  const getColorClasses = (scheme: 'collateral' | 'borrowed') => {
    return scheme === 'collateral' 
      ? { bg: 'bg-ocean-teal/10', text: 'text-ocean-teal' }
      : { bg: 'bg-whale-gold/10', text: 'text-whale-gold' };
  };

  // Determine if a collateral asset is liquidatable based on global account state
  const isAssetLiquidatable = (asset: Asset): boolean => {
    if (colorScheme !== 'collateral') {
      return false;
    }
    
    // Asset is liquidatable if the overall account health factor is <= 1.0
    // This means the account can be liquidated, and any collateral can be seized
    return accountHealthFactor <= 1.0;
  };

  // Calculate total borrowed value for LTV calculation (only for collateral assets)
  const calculatedTotalBorrowed = colorScheme === 'collateral' 
    ? totalBorrowed 
    : assets.reduce((sum, asset) => sum + asset.valueUSD, 0);

  const colors = getColorClasses(colorScheme);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {assets.map((asset, index) => {
            const liquidatable = isAssetLiquidatable(asset);
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div className={`flex items-center justify-between p-2 rounded-lg min-w-0 transition-all ${
                    liquidatable 
                      ? 'bg-red-500/10 border border-red-500/30 shadow-sm' 
                      : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center flex-shrink-0 relative`}>
                        <span className={`text-xs font-bold ${colors.text}`}>
                          {asset.symbol.substring(0, 2)}
                        </span>
                        {liquidatable && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm lg:text-base leading-tight truncate">{asset.symbol}</span>
                          {liquidatable && (
                            <Badge variant="destructive" className="text-xs px-1 py-0">
                              LIQUIDATABLE
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs lg:text-sm text-muted-foreground mt-1 truncate">
                          {asset.amount.toLocaleString()} tokens
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="font-semibold text-sm lg:text-base">${asset.valueUSD.toLocaleString()}</div>
                      <div className="text-xs lg:text-sm text-muted-foreground">
                        ${(asset.valueUSD / asset.amount).toFixed(2)}/token
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-semibold">{asset.symbol}</p>
                    <p>Value: ${asset.valueUSD.toLocaleString()}</p>
                    {asset.collateralFactor && (
                      <p>Collateral Factor: {(asset.collateralFactor * 100).toFixed(1)}%</p>
                    )}
                    {asset.liquidationThreshold && (
                      <p>Liquidation Threshold: {(asset.liquidationThreshold * 100).toFixed(1)}%</p>
                    )}
                    {liquidatable && (
                      <p className="text-red-400 font-semibold mt-1">⚠️ Account is liquidatable (HF ≤ 1.0)</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
