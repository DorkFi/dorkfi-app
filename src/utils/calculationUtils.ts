
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const calculateTotalValueLocked = (accounts: LiquidationAccount[]): number => {
  return accounts.reduce((total, account) => total + account.totalSupplied, 0);
};

export const calculateTotalBorrowed = (accounts: LiquidationAccount[]): number => {
  return accounts.reduce((total, account) => total + account.totalBorrowed, 0);
};
