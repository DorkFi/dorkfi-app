
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { liquidatableAccounts } from './liquidatableAccounts';
import { dangerAccounts } from './dangerAccounts';
import { moderateAccounts } from './moderateAccounts';
import { safeAccounts } from './safeAccounts';

export const mockLiquidationData: LiquidationAccount[] = [
  ...liquidatableAccounts,
  ...dangerAccounts,
  ...moderateAccounts,
  ...safeAccounts
];

// Export individual risk categories for targeted filtering
export {
  liquidatableAccounts,
  dangerAccounts,
  moderateAccounts,
  safeAccounts
};
