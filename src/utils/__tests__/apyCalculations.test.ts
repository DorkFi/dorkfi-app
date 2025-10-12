/**
 * Tests for APY Calculation Utilities
 */

import { 
  calculateDepositAPY, 
  calculateUtilizationRate, 
  calculateBorrowRate, 
  calculateSupplyRate,
  convertSupplyRateToAPY,
  formatAPY,
  getAPYColorClass
} from '../apyCalculations';

describe('APY Calculations', () => {
  describe('calculateUtilizationRate', () => {
    it('should calculate utilization rate correctly', () => {
      expect(calculateUtilizationRate(1000, 500)).toBe(0.5); // 50% utilization
      expect(calculateUtilizationRate(1000, 0)).toBe(0); // 0% utilization
      expect(calculateUtilizationRate(0, 100)).toBe(0); // No deposits
    });
  });

  describe('calculateBorrowRate', () => {
    it('should calculate borrow rate with slope', () => {
      const baseRate = 500; // 5% in basis points
      const slope = 1000; // 10% in basis points
      const utilization = 0.5; // 50%
      
      const result = calculateBorrowRate(baseRate, slope, utilization);
      expect(result).toBeCloseTo(0.1, 3); // 10% (5% + 5%)
    });
  });

  describe('calculateSupplyRate', () => {
    it('should calculate supply rate after reserve factor', () => {
      const borrowRate = 0.1; // 10%
      const utilization = 0.5; // 50%
      const reserveFactor = 1000; // 10% in basis points
      
      const result = calculateSupplyRate(borrowRate, utilization, reserveFactor);
      expect(result).toBeCloseTo(0.045, 3); // 4.5% (10% * 50% * 90%)
    });
  });

  describe('convertSupplyRateToAPY', () => {
    it('should convert daily rate to APY', () => {
      const dailyRate = 0.0001; // 0.01% daily
      const result = convertSupplyRateToAPY(dailyRate);
      expect(result).toBeCloseTo(3.72, 1); // ~3.72% APY
    });
  });

  describe('calculateDepositAPY', () => {
    it('should calculate complete APY for a market', () => {
      const parameters = {
        borrowRate: 500, // 5% base rate
        slope: 1000, // 10% slope
        reserveFactor: 1000 // 10% reserve factor
      };
      
      const state = {
        totalScaledDeposits: 1000000,
        totalScaledBorrows: 500000, // 50% utilization
        lastUpdateTime: Date.now()
      };
      
      const result = calculateDepositAPY(parameters, state);
      
      expect(result.utilizationRate).toBe(0.5);
      expect(result.borrowRate).toBeCloseTo(0.1, 3); // 10%
      expect(result.supplyRate).toBeCloseTo(0.045, 3); // 4.5%
      expect(result.apy).toBeGreaterThan(0);
      expect(result.apyFormatted).toMatch(/\d+\.\d+%/);
    });

    it('should handle zero deposits', () => {
      const parameters = {
        borrowRate: 500,
        slope: 1000,
        reserveFactor: 1000
      };
      
      const state = {
        totalScaledDeposits: 0,
        totalScaledBorrows: 100000,
        lastUpdateTime: Date.now()
      };
      
      const result = calculateDepositAPY(parameters, state);
      
      expect(result.utilizationRate).toBe(0);
      expect(result.borrowRate).toBeCloseTo(0.05, 3); // Base rate only
      expect(result.supplyRate).toBe(0);
      expect(result.apy).toBe(0);
    });

    it('should handle high utilization', () => {
      const parameters = {
        borrowRate: 500, // 5%
        slope: 2000, // 20%
        reserveFactor: 500 // 5%
      };
      
      const state = {
        totalScaledDeposits: 1000000,
        totalScaledBorrows: 900000, // 90% utilization
        lastUpdateTime: Date.now()
      };
      
      const result = calculateDepositAPY(parameters, state);
      
      expect(result.utilizationRate).toBe(0.9);
      expect(result.borrowRate).toBeCloseTo(0.23, 2); // 5% + (20% * 90%) = 23%
      expect(result.supplyRate).toBeCloseTo(0.19665, 3); // 23% * 90% * 95%
      expect(result.apy).toBeGreaterThan(20); // High APY due to high utilization
    });
  });

  describe('formatAPY', () => {
    it('should format APY correctly', () => {
      expect(formatAPY(5.25)).toBe('5.25%');
      expect(formatAPY(0.005)).toBe('<0.01%');
      expect(formatAPY(1500)).toBe('>1000%');
      expect(formatAPY(0)).toBe('0.00%');
    });
  });

  describe('getAPYColorClass', () => {
    it('should return appropriate color classes', () => {
      expect(getAPYColorClass(15)).toContain('green');
      expect(getAPYColorClass(7)).toContain('blue');
      expect(getAPYColorClass(3)).toContain('yellow');
      expect(getAPYColorClass(1)).toContain('gray');
    });
  });
});
