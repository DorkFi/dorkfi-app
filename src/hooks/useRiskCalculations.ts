
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
  /**
   * Factual risk context only (not recommendations or investment advice).
   * Safe to surface in UI as neutral information.
   */
  riskContextNotes: string[];
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
      let riskContextNotes: string[] = [];

      if (healthFactor <= thresholds.liquidatable) {
        level = 'liquidatable';
        severity = 100 - (healthFactor / thresholds.liquidatable) * 20;
        timeToLiquidation = 'Immediate';
        riskContextNotes = [
          'Health factor is at or below the liquidatable band in this model.',
          'Liquidation can occur when health factor is below 1.0 on-chain.',
          'Collateral, borrows, and oracle prices determine liquidation eligibility.',
        ];
      } else if (healthFactor <= thresholds.danger) {
        level = 'danger';
        severity = 80 - ((healthFactor - thresholds.liquidatable) / (thresholds.danger - thresholds.liquidatable)) * 30;
        timeToLiquidation = '< 24 hours';
        riskContextNotes = [
          'Health factor is in the elevated-risk band in this model.',
          'Distance to liquidation depends on collateral value, debt, and thresholds.',
        ];
      } else if (healthFactor <= thresholds.moderate) {
        level = 'moderate';
        severity = 50 - ((healthFactor - thresholds.danger) / (thresholds.moderate - thresholds.danger)) * 30;
        timeToLiquidation = '1-7 days';
        riskContextNotes = [
          'Health factor is in the moderate band in this model.',
          'Volatility in collateral or borrows can move health factor quickly.',
        ];
      } else {
        level = 'safe';
        severity = Math.max(0, 20 - (healthFactor - thresholds.moderate) * 2);
        riskContextNotes = [
          'Health factor is above the moderate threshold in this model.',
          'On-chain parameters and prices still change with markets.',
        ];
      }

      return {
        level,
        severity: Math.max(0, Math.min(100, severity)),
        timeToLiquidation,
        riskContextNotes,
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
