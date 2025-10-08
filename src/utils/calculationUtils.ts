
import { LiquidationAccount } from '@/hooks/useLiquidationData';

export const calculateTotalValueLocked = (accounts: LiquidationAccount[]): number => {
  return accounts.reduce((total, account) => total + account.totalSupplied, 0);
};

export const calculateTotalBorrowed = (accounts: LiquidationAccount[]): number => {
  return accounts.reduce((total, account) => total + account.totalBorrowed, 0);
};

/**
 * Convert a bigint amount from base units to a decimal number
 * @param amt - The amount in base units (bigint)
 * @param decimals - The number of decimal places
 * @returns The amount as a decimal number
 */
export const fromBase = (amt: bigint, decimals: number): number => {
  return Number(amt) / 10 ** decimals;
};

/**
 * Convert a decimal number to base units (bigint)
 * @param amt - The amount as a decimal number
 * @param decimals - The number of decimal places
 * @returns The amount in base units (bigint)
 */
export const toBase = (amt: number, decimals: number): bigint => {
  return BigInt(Math.round(amt * 10 ** decimals));
};
