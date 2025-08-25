
import React from 'react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress } from '@/utils/liquidationUtils';
import { getRiskColor, getRiskLevel, getRiskVariant } from '@/utils/riskCalculations';
import DorkFiButton from '@/components/ui/DorkFiButton';
import HealthFactorGauge from './HealthFactorGauge';
import PositionSummary from './PositionSummary';
import AssetList from './AssetList';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Zap } from 'lucide-react';

interface AccountOverviewProps {
  account: LiquidationAccount;
  onInitiateLiquidation: () => void;
}

export default function AccountOverview({ account, onInitiateLiquidation }: AccountOverviewProps) {
  const riskColor = getRiskColor(account.healthFactor);
  const riskLevel = getRiskLevel(account.healthFactor);
  const isLiquidatable = account.healthFactor <= 1.0;
  const isHighRisk = account.healthFactor <= 1.1;

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Account Address</p>
          <p className="font-mono text-lg font-semibold text-foreground">
            {shortenAddress(account.walletAddress, 8)}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground mb-1">Health Factor</p>
            <p className={`text-2xl font-bold ${riskColor}`}>
              {account.healthFactor.toFixed(3)}
            </p>
          </div>
          
          {(isLiquidatable || isHighRisk) && (
            <DorkFiButton
              variant={isLiquidatable ? "danger-outline" : "high"}
              onClick={onInitiateLiquidation}
              className="flex items-center gap-2 px-4 py-2 hover:scale-105 transition-all"
            >
              {isLiquidatable ? <Zap className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {isLiquidatable ? "Liquidate Now" : "Monitor Position"}
            </DorkFiButton>
          )}
        </div>
      </div>

      {/* Health Factor Gauge */}
      <HealthFactorGauge healthFactor={account.healthFactor} />

      {/* Position Summary */}
      <PositionSummary account={account} />

      {/* Asset Lists */}
      <div className="grid gap-6 md:grid-cols-2">
        <AssetList 
          title="Collateral Assets" 
          assets={account.collateralAssets} 
          colorScheme="collateral" 
        />
        <AssetList 
          title="Borrowed Assets" 
          assets={account.borrowedAssets} 
          colorScheme="borrowed" 
        />
      </div>

      {/* Risk Warning for Liquidatable Positions */}
      {isLiquidatable && (
        <Alert 
          variant="destructive" 
          className="border-2 border-destructive/50 bg-destructive/20 shadow-lg shadow-destructive/10 animate-pulse relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-destructive"
        >
          <AlertTriangle className="h-5 w-5 animate-bounce" />
          <AlertTitle className="text-lg font-bold text-destructive">
            Critical Risk Warning
          </AlertTitle>
          <AlertDescription className="text-foreground font-medium">
            This position can be liquidated immediately. The health factor is below 1.0, making it eligible for liquidation by any user.
            Liquidators can claim up to 50% of the collateral with a 5% bonus.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
