import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { CreditCard, Info, Check, Wallet } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { useUserAssets } from '@/hooks/useUserAssets';
import { useWallet } from '@txnlab/use-wallet-react';
import { getCurrentNetworkConfig } from '@/config';
import algorandService, { AlgorandNetwork } from '@/services/algorandService';
import { ARC200Service } from '@/services/arc200Service';

interface DebtSelectionStepProps {
  account: LiquidationAccount;
  selectedDebt: string;
  onDebtChange: (debt: string) => void;
  selectedCollateral: string;
}

export default function DebtSelectionStep({
  account,
  selectedDebt,
  onDebtChange,
  selectedCollateral
}: DebtSelectionStepProps) {
  // Fetch real user assets
  const { assets, isLoading, error } = useUserAssets(account.walletAddress);
  const { activeAccount } = useWallet();
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Fetch wallet balances for all debt assets
  useEffect(() => {
    const fetchBalances = async () => {
      if (!activeAccount?.address || assets.length === 0) return;
      
      setLoadingBalances(true);
      const balances: Record<string, number> = {};
      
      try {
        const networkConfig = getCurrentNetworkConfig();
        const clients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );
        ARC200Service.initialize(clients);
        
        for (const asset of assets.filter(a => a.borrowBalance > 0)) {
          try {
            // Use the market contract ID directly from the asset
            console.log(`Fetching wallet balance for ${asset.symbol} using contract ID: ${asset.contractId}`);
            const balance = await ARC200Service.getBalance(
              activeAccount.address,
              asset.contractId
            );
            
            if (balance) {
              // Convert from smallest units to human readable format
              const formattedBalance = parseFloat(ARC200Service.formatBalance(balance, 6)); // Assuming 6 decimals
              balances[asset.symbol] = formattedBalance;
              console.log(`Wallet balance for ${asset.symbol}: ${formattedBalance}`);
            } else {
              balances[asset.symbol] = 0;
              console.log(`No wallet balance found for ${asset.symbol}`);
            }
          } catch (error) {
            console.error(`Error fetching balance for ${asset.symbol}:`, error);
            balances[asset.symbol] = 0;
          }
        }
        
        setWalletBalances(balances);
      } catch (error) {
        console.error('Error fetching wallet balances:', error);
      } finally {
        setLoadingBalances(false);
      }
    };

    fetchBalances();
  }, [activeAccount?.address, assets]);

  // Transform fetched assets into borrowed assets (only those with borrows)
  const borrowedAssets = assets
    .filter((asset) => asset.borrowBalance > 0)
    .map((asset) => ({
      symbol: asset.symbol,
      amount: asset.borrowBalance,
      valueUSD: asset.borrowValueUSD,
      collateralFactor: asset.collateralFactor,
      liquidationThreshold: asset.liquidationThreshold,
    }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Debt Asset</h2>
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
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Debt Asset</h2>
          <p className="text-muted-foreground">
            Error loading asset data: {error}
          </p>
        </div>
      </div>
    );
  }

  if (borrowedAssets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Select Debt Asset</h2>
          <p className="text-muted-foreground">
            No borrowed assets found for this account.
          </p>
        </div>
        <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              This account has no borrowed assets that can be repaid through liquidation.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Select Debt Asset</h2>
        <p className="text-muted-foreground">
          Choose which debt you want to repay. You can only repay debts that exist in the account.
        </p>
      </div>

      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <CreditCard className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-800 dark:text-white">
                Available Debt Assets
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Select the debt asset you want to repay
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            {!selectedCollateral && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">Select Collateral First</span>
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please go back to Step 1 and select a collateral asset before choosing which debt to repay.
                </div>
              </div>
            )}

            {selectedCollateral && (
              <>
                <div className="space-y-3">
                  {borrowedAssets.map((asset) => (
                    <div
                      key={asset.symbol}
                      className={`
                        flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-pointer
                        ${selectedDebt === asset.symbol
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }
                      `}
                      onClick={() => onDebtChange(asset.symbol)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                          <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 dark:text-white">{asset.symbol}</h3>
                            {selectedDebt === asset.symbol && (
                              <Check className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Borrowed: {asset.amount.toLocaleString()}
                          </div>
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Borrowed Value: ${asset.valueUSD.toLocaleString()}
                          </div>
                          <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            <span>Wallet: {loadingBalances ? '...' : (walletBalances[asset.symbol] || 0).toLocaleString()}</span>
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
                                <div className="font-semibold text-orange-400">Debt Information:</div>
                                <div>Borrowed: {asset.amount.toLocaleString()} {asset.symbol}</div>
                                <div>Borrowed Value: ${asset.valueUSD.toFixed(2)}</div>
                                <div className="font-semibold text-blue-400">Wallet Balance:</div>
                                <div>Available: {loadingBalances ? '...' : (walletBalances[asset.symbol] || 0).toLocaleString()} {asset.symbol}</div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        <DorkFiButton
                          variant={selectedDebt === asset.symbol ? "primary" : "outline"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDebtChange(asset.symbol);
                          }}
                          className="min-w-[80px]"
                        >
                          {selectedDebt === asset.symbol ? 'Selected' : 'Select'}
                        </DorkFiButton>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDebt && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-orange-800 dark:text-orange-200">Selected Debt</span>
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">
                      {(() => {
                        const asset = borrowedAssets.find(a => a.symbol === selectedDebt);
                        return asset ? (
                          <>
                            <div className="font-medium">{asset.symbol}</div>
                            <div>Borrowed: {asset.amount.toLocaleString()}</div>
                            <div>Borrowed Value: ${asset.valueUSD.toLocaleString()}</div>
                            <div className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Wallet className="h-3 w-3" />
                              <span>Wallet: {loadingBalances ? '...' : (walletBalances[asset.symbol] || 0).toLocaleString()}</span>
                            </div>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Collateral Context</span>
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    You selected <strong>{selectedCollateral}</strong> as collateral. This asset will be seized to cover the debt you choose to repay.
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
