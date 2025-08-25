
import { useMemo } from 'react';
import { LiquidationAccount } from './useLiquidationData';

export interface LiquidationStats {
  totalAccounts: number;
  liquidatableAccounts: number;
  dangerZoneAccounts: number;
  moderateRiskAccounts: number;
  safeAccounts: number;
  totalValueAtRisk: number;
  averageHealthFactor: number;
  riskDistribution: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
}

export interface StatsConfig {
  riskThresholds: {
    liquidatable: number;
    danger: number;
    moderate: number;
  };
  includeTotalValue?: boolean;
  includeAverages?: boolean;
}

export const useLiquidationStats = (
  accounts: LiquidationAccount[],
  config: StatsConfig = {
    riskThresholds: { liquidatable: 1.05, danger: 1.2, moderate: 1.5 },
    includeTotalValue: true,
    includeAverages: true,
  }
): LiquidationStats => {
  return useMemo(() => {
    const totalAccounts = accounts.length;
    
    const liquidatableAccounts = accounts.filter(
      acc => acc.healthFactor <= config.riskThresholds.liquidatable
    ).length;
    
    const dangerZoneAccounts = accounts.filter(
      acc => acc.healthFactor > config.riskThresholds.liquidatable && 
             acc.healthFactor <= config.riskThresholds.danger
    ).length;
    
    const moderateRiskAccounts = accounts.filter(
      acc => acc.healthFactor > config.riskThresholds.danger && 
             acc.healthFactor <= config.riskThresholds.moderate
    ).length;
    
    const safeAccounts = accounts.filter(
      acc => acc.healthFactor > config.riskThresholds.moderate
    ).length;

    const totalValueAtRisk = config.includeTotalValue 
      ? accounts.reduce((sum, acc) => sum + acc.totalBorrowed, 0)
      : 0;

    const averageHealthFactor = config.includeAverages && totalAccounts > 0
      ? accounts.reduce((sum, acc) => sum + acc.healthFactor, 0) / totalAccounts
      : 0;

    const riskDistribution = [
      {
        name: 'Liquidatable',
        value: liquidatableAccounts,
        percentage: totalAccounts > 0 ? (liquidatableAccounts / totalAccounts) * 100 : 0,
      },
      {
        name: 'Danger Zone',
        value: dangerZoneAccounts,
        percentage: totalAccounts > 0 ? (dangerZoneAccounts / totalAccounts) * 100 : 0,
      },
      {
        name: 'Moderate Risk',
        value: moderateRiskAccounts,
        percentage: totalAccounts > 0 ? (moderateRiskAccounts / totalAccounts) * 100 : 0,
      },
      {
        name: 'Safe Harbor',
        value: safeAccounts,
        percentage: totalAccounts > 0 ? (safeAccounts / totalAccounts) * 100 : 0,
      },
    ];

    return {
      totalAccounts,
      liquidatableAccounts,
      dangerZoneAccounts,
      moderateRiskAccounts,
      safeAccounts,
      totalValueAtRisk,
      averageHealthFactor,
      riskDistribution,
    };
  }, [accounts, config]);
};
