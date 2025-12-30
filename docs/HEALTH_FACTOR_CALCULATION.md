# Health Factor Calculation Documentation

## Overview

Health Factor is a critical metric that indicates the safety of a user's lending position. It measures how close a position is to liquidation. A health factor below 1.0 means the position can be liquidated.

This document explains how health factors are calculated in the DorkFi application, including both user-level and network-level calculations.

## Key Concepts

### Collateral Factor vs. Liquidation Threshold

It's important to understand the difference between these two metrics:

- **Collateral Factor (CF)**: The maximum percentage of collateral value that can be borrowed against. Used for calculating borrowing power.
  - Example: If you have $1000 in collateral with 80% CF, you can borrow up to $800.

- **Liquidation Threshold (LT)**: The percentage at which a position becomes liquidatable. Always lower than or equal to the collateral factor.
  - Example: If your position reaches 85% LTV (loan-to-value), it can be liquidated.

**Important**: Health factor calculations use **liquidation threshold**, not collateral factor.

### Total Collateral Value

`totalCollateralValue` is the **sum of deposit values** (not weighted by collateral factors):

```
Total Collateral Value = Σ(Deposit Value_i)
```

Where:
- `Deposit Value_i` = USD value of deposits in asset `i`

**Important**: This is the raw sum of all deposit values, not weighted by collateral factors. The liquidation threshold is applied during the health factor calculation itself.

## User Health Factor Calculation

### Formula

The user health factor calculation applies the liquidation threshold:

```
User Health Factor = (Total Collateral Value × Liquidation Threshold) / Total Borrow Value
```

Where:
- `Total Collateral Value` = Sum of deposit values
- `Liquidation Threshold` = Minimum liquidation threshold from markets with deposits
- `Total Borrow Value` = Total borrow value

### Edge Cases

1. **No borrows**: Returns `10.0` (excellent health, no liquidation risk)
2. **No collateral but has borrows**: Returns `null` (invalid state)
3. **Both zero**: Returns `null` (no position data)
4. **Invalid calculation**: Returns `null` if result is ≤ 0 or non-finite

### Display Saturation

For display purposes, health factors are capped at 3.0.

## Network Health Factor Calculation

Network health factor is calculated per network (e.g., Algorand, VOI) and uses a more conservative approach.

### Formula

```
Network Health Factor = (Network Collateral × min(Liquidation Threshold)) / Network Borrow
```

Where:
- `min(Liquidation Threshold)` = Minimum liquidation threshold among all markets where the user has deposits in that network
- `Network Collateral` = Total collateral value in USD for that network
- `Network Borrow` = Total borrow value in USD for that network

### Why Minimum Liquidation Threshold?

Using the minimum liquidation threshold provides the most conservative (safest) health factor calculation. This ensures that if any asset in the portfolio has a lower liquidation threshold, the entire network's health factor reflects that risk.

### Fallback Behavior

If no deposits are found for a network, the calculation falls back to using a default liquidation threshold of 85% (0.85).

## Health Factor Interpretation

### Health Factor Ranges

| Health Factor | Status | Description |
|--------------|--------|-------------|
| ≥ 2.0 | Low Risk | Position is safe, well above liquidation threshold |
| 1.5 - 2.0 | Moderate Risk | Position is safe but approaching caution zone |
| 1.0 - 1.5 | High Risk | Position is close to liquidation threshold |
| < 1.0 | Critical Risk | Position can be liquidated |

### Display Values

- **"N/A"**: Shown when health factor is `null` (no position data or invalid calculation)
- **Capped at 3.0**: Health factors above 3.0 are displayed as 3.0 for UI consistency
- **No borrows**: Displayed as 3.0 (excellent health)

## Examples

### Example 1: User Health Factor

**User Position:**
- Deposits: $10,000 USDC (LT: 85%), $5,000 ALGO (LT: 80%)
- Borrows: $6,000 USDC

**Calculation:**
1. Total Collateral Value = $10,000 + $5,000 = $15,000 (sum of deposit values)
2. Minimum Liquidation Threshold = min(0.85, 0.80) = 0.80
3. Health Factor = ($15,000 × 0.80) / $6,000 = $12,000 / $6,000 = **2.0**

**Result**: Low risk (above 1.5 threshold)

### Example 2: Network Health Factor

**Network: Algorand**
- Deposits: $10,000 USDC (LT: 85%), $5,000 ALGO (LT: 80%)
- Borrows: $7,000 USDC

**Calculation:**
1. min(Liquidation Threshold) = min(0.85, 0.80) = **0.80**
2. Network Collateral = $15,000
3. Health Factor = ($15,000 × 0.80) / $7,000 = **1.71**

**Result**: Moderate risk (between 1.5 and 2.0)

### Example 3: No Borrows

**User Position:**
- Deposits: $10,000 USDC
- Borrows: $0

**Calculation:**
- Health Factor = **10.0** (displayed as 3.0)

**Result**: Excellent health, no liquidation risk

### Example 4: Critical Risk

**User Position:**
- Deposits: $5,000 USDC (LT: 85%)
- Borrows: $4,500 USDC

**Calculation:**
1. Total Collateral Value = $5,000 (sum of deposit values)
2. Liquidation Threshold = 0.85
3. Health Factor = ($5,000 × 0.85) / $4,500 = $4,250 / $4,500 = **0.94**

**Result**: Critical risk - position can be liquidated

## Data Sources

### User Health Factor

- **Collateral Value**: Sum of deposit values
- **Borrow Value**: Total borrow value
- **Liquidation Threshold**: Minimum liquidation threshold from markets with deposits (applied in calculation)

### Network Health Factor

- **Network Collateral**: Aggregated from `user.globalUserData` by network (sum of deposit values)
- **Network Borrow**: Aggregated from `user.globalUserData` by network
- **Liquidation Thresholds**: From `marketData` for each market with deposits (minimum is used)

## Important Notes

1. **Total Collateral Value**: `totalCollateralValue` is the **sum of deposit values** (not weighted by collateral factors). This is the raw USD value of all deposits.

2. **Liquidation Threshold Application**: The liquidation threshold is applied during the health factor calculation: `(collateral_value × liquidation_threshold) / borrow_value`. The minimum liquidation threshold from markets with deposits should be used.

3. **Minimum Threshold**: Using the minimum liquidation threshold for network calculations provides the most conservative (safest) estimate.

4. **Display Capping**: Health factors are capped at 3.0 for display purposes, but the actual calculation may be higher.

5. **Null Handling**: `null` health factors indicate missing or invalid data, not a zero value.

## Related Files

- `src/components/Portfolio.tsx` - Main health factor calculation logic
- `src/services/lendingService.ts` - Data fetching
- `src/components/PortfolioModals.tsx` - Health factor display in modals
- `src/components/RepayModal.tsx` - Health factor display in repay modal

