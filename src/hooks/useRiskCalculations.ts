
import { useMemo } from 'react';
import { LiquidationAccount } from './useLiquidationData';

export interface RiskThresholds {
  liquidatable: number;
  danger: number;
  moderate: number;
}

export interface RiskAssessment {
  level: 'liquidatable' | 'danger' | 'moderate' | 'safe';
  severity: number; // 0-100 scale
  timeToLiquidation?: string;
  recommendedActions: string[];
}

export const useRiskCalculations = (
  thresholds: RiskThresholds = { liquidatable: 1.05, danger: 1.2, moderate: 1.5 }
) => {
  const assessRisk = useMemo(() => {
    return (account: LiquidationAccount): RiskAssessment => {
      const { healthFactor, ltv } = account;
      
      let level: RiskAssessment['level'];
      let severity: number;
      let timeToLiquidation: string | undefined;
      let recommendedActions: string[] = [];

      if (healthFactor <= thresholds.liquidatable) {
        level = 'liquidatable';
        severity = 100 - (healthFactor / thresholds.liquidatable) * 20;
        timeToLiquidation = 'Immediate';
        recommendedActions = [
          'Add collateral immediately',
          'Repay debt to improve health factor',
          'Consider partial liquidation'
        ];
      } else if (healthFactor <= thresholds.danger) {
        level = 'danger';
        severity = 80 - ((healthFactor - thresholds.liquidatable) / (thresholds.danger - thresholds.liquidatable)) * 30;
        timeToLiquidation = '< 24 hours';
        recommendedActions = [
          'Monitor position closely',
          'Prepare to add collateral',
          'Consider reducing leverage'
        ];
      } else if (healthFactor <= thresholds.moderate) {
        level = 'moderate';
        severity = 50 - ((healthFactor - thresholds.danger) / (thresholds.moderate - thresholds.danger)) * 30;
        timeToLiquidation = '1-7 days';
        recommendedActions = [
          'Review position regularly',
          'Set up alerts for health factor changes'
        ];
      } else {
        level = 'safe';
        severity = Math.max(0, 20 - (healthFactor - thresholds.moderate) * 2);
        recommendedActions = [
          'Position is healthy',
          'Monitor for market changes'
        ];
      }

      return {
        level,
        severity: Math.max(0, Math.min(100, severity)),
        timeToLiquidation,
        recommendedActions,
      };
    };
  }, [thresholds]);

  const calculateLiquidationPrice = useMemo(() => {
    return (account: LiquidationAccount, assetSymbol: string): number | null => {
      // Simplified liquidation price calculation
      // In a real implementation, this would use actual oracle prices and liquidation thresholds
      const collateralAsset = account.collateralAssets.find(asset => asset.symbol === assetSymbol);
      if (!collateralAsset) return null;

      const liquidationThreshold = 0.85; // 85% LTV threshold
      const currentPrice = collateralAsset.valueUSD / collateralAsset.amount;
      
      return currentPrice * (account.totalBorrowed / account.totalSupplied) / liquidationThreshold;
    };
  }, []);

  const formatHealthFactor = useMemo(() => {
    return (healthFactor: number): string => {
      if (healthFactor < 0.01) return '0.00';
      if (healthFactor < 1) return healthFactor.toFixed(3);
      if (healthFactor < 10) return healthFactor.toFixed(2);
      return healthFactor.toFixed(1);
    };
  }, []);

  const formatCurrency = useMemo(() => {
    return (amount: number, currency: string = 'USD'): string => {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return formatter.format(amount);
    };
  }, []);

  const formatPercentage = useMemo(() => {
    return (value: number, decimals: number = 2): string => {
      return `${(value * 100).toFixed(decimals)}%`;
    };
  }, []);

  return {
    assessRisk,
    calculateLiquidationPrice,
    formatHealthFactor,
    formatCurrency,
    formatPercentage,
  };
};
