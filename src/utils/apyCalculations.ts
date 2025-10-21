/**
 * APY Calculation Utilities
 * 
 * This module provides utilities for calculating deposit APY based on market parameters
 * and state, following the same logic as the smart contract.
 */

import BigNumber from 'bignumber.js';

export interface MarketParameters {
  borrowRate: number; // Base borrow rate (in basis points, e.g., 500 = 5%)
  slope: number; // Interest rate slope (in basis points)
  reserveFactor: number; // Reserve factor (in basis points, e.g., 1000 = 10%)
}

export interface MarketState {
  totalScaledDeposits: string | number;
  totalScaledBorrows: string | number;
  lastUpdateTime: number;
}

export interface APYCalculationResult {
  utilizationRate: number; // Utilization rate as decimal (e.g., 0.5 = 50%)
  borrowRate: number; // Current borrow rate as decimal
  supplyRate: number; // Current supply rate as decimal
  apy: number; // Annual Percentage Yield as percentage (e.g., 5.25 = 5.25%)
  apyFormatted: string; // Formatted APY string (e.g., "5.25%")
}

/**
 * Calculate utilization rate from market state
 */
export function calculateUtilizationRate(
  totalScaledDeposits: string | number,
  totalScaledBorrows: string | number
): number {
  const deposits = new BigNumber(totalScaledDeposits);
  const borrows = new BigNumber(totalScaledBorrows);
  
  if (deposits.isZero()) {
    return 0;
  }
  
  return borrows.dividedBy(deposits).toNumber();
}

/**
 * Calculate current borrow rate based on utilization
 */
export function calculateBorrowRate(
  baseBorrowRate: number,
  slope: number,
  utilizationRate: number
): number {
  // Convert basis points to decimals
  const baseRate = baseBorrowRate / 10000;
  const slopeRate = slope / 10000;
  
  return baseRate + (slopeRate * utilizationRate);
}

/**
 * Calculate current supply rate (what depositors earn)
 */
export function calculateSupplyRate(
  borrowRate: number,
  utilizationRate: number,
  reserveFactor: number
): number {
  // Convert reserve factor from basis points to decimal
  const reserveFactorDecimal = reserveFactor / 10000;
  
  // Supply rate = borrow rate * utilization * (1 - reserve factor)
  return borrowRate * utilizationRate * (1 - reserveFactorDecimal);
}

/**
 * Convert supply rate to APY (Annual Percentage Yield)
 * APY = (1 + supply_rate)^365 - 1
 */
export function convertSupplyRateToAPY(supplyRate: number): number {
  // Convert daily rate to annual rate
  const dailyRate = supplyRate / 365;
  const apy = Math.pow(1 + dailyRate, 365) - 1;
  
  return apy * 100; // Convert to percentage
}

/**
 * Convert borrow rate to APY (Annual Percentage Yield)
 * APY = (1 + borrow_rate)^365 - 1
 */
export function convertBorrowRateToAPY(borrowRate: number): number {
  // Convert daily rate to annual rate
  const dailyRate = borrowRate / 365;
  const apy = Math.pow(1 + dailyRate, 365) - 1;
  
  return apy * 100; // Convert to percentage
}

/**
 * Main function to calculate borrow APY from market parameters and state
 */
export function calculateBorrowAPY(
  parameters: MarketParameters,
  state: MarketState,
  isSToken: boolean = false
): APYCalculationResult {
  try {
    // Calculate utilization rate
    let utilizationRate = calculateUtilizationRate(
      state.totalScaledDeposits,
      state.totalScaledBorrows
    );
    
    // For s-tokens, use 100% utilization
    if (isSToken) {
      utilizationRate = 1.0; // 100% utilization
    }
    
    // Calculate current borrow rate
    const borrowRate = calculateBorrowRate(
      parameters.borrowRate,
      parameters.slope,
      utilizationRate
    );
    
    // Convert to APY
    const apy = convertBorrowRateToAPY(borrowRate);
    
    return {
      utilizationRate,
      borrowRate,
      supplyRate: 0, // Not applicable for borrow APY
      apy,
      apyFormatted: `${apy.toFixed(2)}%`
    };
  } catch (error) {
    console.error('Error calculating borrow APY:', error);
    return {
      utilizationRate: 0,
      borrowRate: 0,
      supplyRate: 0,
      apy: 0,
      apyFormatted: '0.00%'
    };
  }
}

/**
 * Main function to calculate deposit APY from market parameters and state
 */
export function calculateDepositAPY(
  parameters: MarketParameters,
  state: MarketState
): APYCalculationResult {
  try {
    // Calculate utilization rate
    const utilizationRate = calculateUtilizationRate(
      state.totalScaledDeposits,
      state.totalScaledBorrows
    );
    
    // Calculate current borrow rate
    const borrowRate = calculateBorrowRate(
      parameters.borrowRate,
      parameters.slope,
      utilizationRate
    );
    
    // Calculate supply rate (what depositors earn)
    const supplyRate = calculateSupplyRate(
      borrowRate,
      utilizationRate,
      parameters.reserveFactor
    );
    
    // Convert to APY
    const apy = convertSupplyRateToAPY(supplyRate);
    
    return {
      utilizationRate,
      borrowRate,
      supplyRate,
      apy,
      apyFormatted: `${apy.toFixed(2)}%`
    };
  } catch (error) {
    console.error('Error calculating deposit APY:', error);
    
    // Return fallback values
    return {
      utilizationRate: 0,
      borrowRate: 0,
      supplyRate: 0,
      apy: 0,
      apyFormatted: '0.00%'
    };
  }
}

/**
 * Calculate APY for a market with simplified parameters
 * This is a convenience function for when you have the basic market info
 */
export function calculateMarketAPY(
  totalDeposits: number,
  totalBorrows: number,
  borrowRateBps: number = 500, // 5% default
  slopeBps: number = 1000, // 10% default
  reserveFactorBps: number = 1000 // 10% default
): APYCalculationResult {
  const parameters: MarketParameters = {
    borrowRate: borrowRateBps,
    slope: slopeBps,
    reserveFactor: reserveFactorBps
  };
  
  const state: MarketState = {
    totalScaledDeposits: totalDeposits,
    totalScaledBorrows: totalBorrows,
    lastUpdateTime: Date.now()
  };
  
  return calculateDepositAPY(parameters, state);
}

/**
 * Format APY for display with appropriate precision
 */
export function formatAPY(apy: number, precision: number = 2): string {
  if (apy < 0.01) {
    return '<0.01%';
  }
  
  if (apy > 1000) {
    return '>1000%';
  }
  
  return `${apy.toFixed(precision)}%`;
}

/**
 * Get APY color class based on value
 */
export function getAPYColorClass(apy: number): string {
  if (apy >= 10) {
    return 'text-green-600 dark:text-green-400';
  } else if (apy >= 5) {
    return 'text-blue-600 dark:text-blue-400';
  } else if (apy >= 2) {
    return 'text-yellow-600 dark:text-yellow-400';
  } else {
    return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Calculate APY breakdown for tooltip display
 */
export function getAPYBreakdown(
  parameters: MarketParameters,
  state: MarketState
): {
  utilizationRate: string;
  borrowRate: string;
  supplyRate: string;
  reserveFactor: string;
  apy: string;
} {
  const result = calculateDepositAPY(parameters, state);
  
  return {
    utilizationRate: `${(result.utilizationRate * 100).toFixed(1)}%`,
    borrowRate: `${(result.borrowRate * 100).toFixed(2)}%`,
    supplyRate: `${(result.supplyRate * 100).toFixed(4)}%`,
    reserveFactor: `${(parameters.reserveFactor / 100).toFixed(1)}%`,
    apy: result.apyFormatted
  };
}
