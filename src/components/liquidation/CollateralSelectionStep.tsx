import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { Coins, Info, Check, AlertTriangle } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { useUserAssets } from '@/hooks/useUserAssets';

interface CollateralSelectionStepProps {
  account: LiquidationAccount;
  selectedCollateral: string;
  onCollateralChange: (collateral: string) => void;
}

export default function CollateralSelectionStep({
  account,
  selectedCollateral,
  onCollateralChange
}: CollateralSelectionStepProps) {
  // Fetch real user assets
  const { assets, isLoading, error } = useUserAssets(account.walletAddress);

  // Calculate maximum liquidatable amount based on close factor
  const calculateMaxLiquidatable = (asset: any) => {
    // Default close factor is 50% (5000 basis points)
    const defaultCloseFactor = 0.5;
    
    // Get the close factor from the asset's market data if available
    const closeFactor = asset.closeFactor ? Number(asset.closeFactor) / 10000 : defaultCloseFactor;
    
    // Maximum liquidatable amount: collateral value * close factor
    const maxLiquidatableUSD = asset.valueUSD * closeFactor;
    
    // Convert to asset amount based on asset price
    const assetPrice = asset.valueUSD / asset.amount;
    const maxLiquidatableAmount = maxLiquidatableUSD / assetPrice;
    
    return {
      maxLiquidatableUSD,
      maxLiquidatableAmount,
      closeFactor: closeFactor * 100, // Convert to percentage
      collateralValueUSD: asset.valueUSD
    };
  };

  // Transform fetched assets into collateral assets (only those with deposits)
  const collateralAssets = assets
    .filter((asset) => asset.depositBalance > 0)
    .map((asset) => ({
      symbol: asset.symbol,
      amount: asset.depositBalance,
      valueUSD: asset.depositValueUSD,
      collateralFactor: asset.collateralFactor,
      liquidationThreshold: asset.liquidationThreshold,
    }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Collateral Asset</h2>
          <p className="text-muted-foreground">
            Loading asset data...
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Collateral Asset</h2>
          <p className="text-muted-foreground">
            Error loading asset data: {error}
          </p>
        </div>
      </div>
    );
  }

  if (collateralAssets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Collateral Asset</h2>
          <p className="text-muted-foreground">
            No collateral assets found for this account.
          </p>
        </div>
        <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              This account has no deposited assets that can be used as collateral for liquidation.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Select Collateral Asset</h2>
        <p className="text-muted-foreground">
          Choose which collateral will be seized to cover the debt. You'll receive a liquidation bonus.
        </p>
      </div>

      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Coins className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-800 dark:text-white">
                Available Collateral Assets
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Select the asset you want to use as collateral for liquidation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            <div className="space-y-3">
              {collateralAssets.map((asset) => {
                const liquidationInfo = calculateMaxLiquidatable(asset);
                return (
                  <div
                    key={asset.symbol}
                    className={`
                      flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-pointer
                      ${selectedCollateral === asset.symbol
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }
                    `}
                    onClick={() => onCollateralChange(asset.symbol)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Coins className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 dark:text-white">{asset.symbol}</h3>
                          {selectedCollateral === asset.symbol && (
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Amount: {asset.amount.toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Value: ${asset.valueUSD.toLocaleString()}
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Liquidate up to: {liquidationInfo.maxLiquidatableAmount.toFixed(4)} ({liquidationInfo.closeFactor.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-sm space-y-1">
                            <div>Collateral Factor: {((asset.collateralFactor || 0.8) * 100).toFixed(1)}%</div>
                            <div>Liquidation Threshold: {((asset.liquidationThreshold || 0.85) * 100).toFixed(1)}%</div>
                            <div className="border-t pt-1 mt-2">
                              <div className="font-semibold text-orange-400">Liquidation Limits:</div>
                              <div>Close Factor: {liquidationInfo.closeFactor.toFixed(1)}%</div>
                              <div className="text-xs text-muted-foreground">
                                Collateral Value: ${liquidationInfo.collateralValueUSD.toFixed(2)}
                              </div>
                              <div className="font-semibold text-green-400">
                                Max Liquidatable: ${liquidationInfo.maxLiquidatableUSD.toFixed(2)}
                              </div>
                              <div>Max Amount: {liquidationInfo.maxLiquidatableAmount.toFixed(4)} {asset.symbol}</div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <DorkFiButton
                        variant={selectedCollateral === asset.symbol ? "primary" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCollateralChange(asset.symbol);
                        }}
                        className="min-w-[80px]"
                      >
                        {selectedCollateral === asset.symbol ? 'Selected' : 'Select'}
                      </DorkFiButton>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCollateral && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Selected Asset</span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  {(() => {
                    const asset = collateralAssets.find(a => a.symbol === selectedCollateral);
                    if (!asset) return null;
                    
                    const liquidationInfo = calculateMaxLiquidatable(asset);
                    return (
                      <>
                        <div className="font-medium">{asset.symbol}</div>
                        <div>Amount: {asset.amount.toLocaleString()}</div>
                        <div>Value: ${asset.valueUSD.toLocaleString()}</div>
                        <div>Collateral Factor: {((asset.collateralFactor || 0.8) * 100).toFixed(1)}%</div>
                        <div className="border-t pt-2 mt-2 border-blue-300 dark:border-blue-700">
                          <div className="font-semibold text-orange-600 dark:text-orange-400">Liquidation Limits:</div>
                          <div>Close Factor: {liquidationInfo.closeFactor.toFixed(1)}%</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Collateral Value: ${liquidationInfo.collateralValueUSD.toFixed(2)}
                          </div>
                          <div className="font-semibold text-green-600 dark:text-green-400">
                            Max Liquidatable: ${liquidationInfo.maxLiquidatableUSD.toFixed(2)}
                          </div>
                          <div>Max Amount: {liquidationInfo.maxLiquidatableAmount.toFixed(4)} {asset.symbol}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
