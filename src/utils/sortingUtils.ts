
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const sortAccountsByRisk = (accounts: LiquidationAccount[]): LiquidationAccount[] => {
  const riskOrder = { liquidatable: 0, danger: 1, moderate: 2, safe: 3 };
  return [...accounts].sort((a, b) => {
    const riskComparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (riskComparison !== 0) return riskComparison;
    return a.healthFactor - b.healthFactor;
  });
};
