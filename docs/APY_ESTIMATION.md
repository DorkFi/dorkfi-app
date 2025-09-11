# APY Estimation Strategy for PreFi

This document explains how APY (Annual Percentage Yield) estimates are calculated in the DorkFi PreFi system.

## Overview

The PreFi APY estimation combines multiple factors to provide users with realistic yield expectations:

1. **Base Lending APY** - From the underlying lending protocol
2. **PreFi Reward APY** - Time-weighted VOI token rewards
3. **Risk Adjustment** - Based on token stability and adoption
4. **Fallback Values** - Static APY when calculations fail

## Core Components

### 1. Market Allocation Percentages

Each market receives a specific percentage of the total VOI rewards pool:

```typescript
const allocations = {
  'voi': 0.25,    // 25% - Native token, highest priority
  'unit': 0.20,   // 20% - Established token
  'ausd': 0.15,   // 15% - Stablecoin
  'btc': 0.12,    // 12% - High-value asset
  'cbbtc': 0.10,  // 10% - High-value asset
  'eth': 0.10,    // 10% - High-value asset
  'algo': 0.05,   // 5% - Cross-chain token
  'pow': 0.03,    // 3% - Newer token
};
```

**Rationale**: Native tokens and established assets receive higher allocations to incentivize participation in core markets.

### 2. Risk Adjustment Factors

Risk factors adjust PreFi rewards based on token stability:

```typescript
const riskFactors = {
  'voi': 1.0,     // Native token, lowest risk
  'ausd': 0.95,   // Stablecoin, very low risk
  'unit': 0.90,   // Established token
  'btc': 0.85,    // High value, moderate risk
  'cbbtc': 0.85,  // High value, moderate risk
  'eth': 0.80,    // High value, moderate risk
  'algo': 0.75,   // Cross-chain token, higher risk
  'pow': 0.70,    // Newer token, highest risk
};
```

**Rationale**: More stable and established tokens receive higher risk-adjusted rewards to encourage participation in safer markets.

### 3. PreFi Reward APY Calculation

The PreFi reward APY is calculated using a time-weighted approach:

```typescript
// Simplified calculation (actual implementation uses stake-seconds)
const estimatedUserReward = (userDeposit / 1000000) * (timeRemaining / (365 * 24 * 60 * 60)) * totalVOIRewards;

// Convert to APY
const rewardValueUSD = estimatedUserReward * voiPrice;
const depositValueUSD = userDeposit * marketPrice;

// Annualized APY
const apy = (rewardValueUSD / depositValueUSD) * (365 / daysRemaining) * 100;
```

**Key Factors**:
- **User Deposit Size**: Larger deposits earn proportionally more rewards
- **Time Remaining**: Earlier deposits earn more due to time-weighting
- **VOI Price**: Current market price affects USD value of rewards
- **Market Price**: Token price affects deposit value calculation

### 4. Total APY Calculation

The final APY combines all components:

```typescript
const totalAPY = baseAPY + (preFiRewardAPY * riskFactor);
```

**Constraints**:
- Minimum APY: 0.1%
- Maximum APY: 50%
- Fallback to static values on calculation errors

## Implementation Details

### Function Hierarchy

1. **`calculateMarketAPY()`** - Main calculation function
2. **`calculatePreFiRewardAPY()`** - PreFi-specific reward calculation
3. **`getMarketAllocation()`** - Market allocation percentages
4. **`getRiskAdjustmentFactor()`** - Risk adjustment factors
5. **`getFallbackAPY()`** - Static fallback values

### Error Handling

The system includes comprehensive error handling:

- **Missing Data**: Falls back to static APY values
- **Calculation Errors**: Logs errors and uses fallback
- **Edge Cases**: Handles zero deposits, negative time, etc.
- **Network Issues**: Graceful degradation when market data unavailable

### Real-time Updates

APY estimates update dynamically based on:

- **VOI Price Changes**: Affects reward USD value
- **User Deposit Changes**: Affects reward share calculation
- **Time Progression**: Reduces time-weighted rewards
- **Market Price Changes**: Affects deposit value

## Fallback Strategy

When dynamic calculations fail, the system uses static APY values:

```typescript
const fallbackAPYs = {
  'voi': 15.8,    // High APY for native token
  'ausd': 8.2,    // Moderate APY for stablecoin
  'unit': 12.4,   // High APY for established token
  'btc': 6.5,     // Lower APY for high-value asset
  'cbbtc': 6.3,   // Lower APY for high-value asset
  'eth': 7.1,     // Moderate APY for high-value asset
  'algo': 9.7,    // Higher APY for cross-chain token
  'pow': 10.2,    // High APY for newer token
};
```

## User Experience

### Display Locations

APY estimates are shown in:

1. **Mobile Market Cards**: Real-time APY for each market
2. **Desktop Market Table**: Column showing estimated APY
3. **Withdraw Modal**: APY context for withdrawal decisions
4. **Deposit Modal**: APY information for deposit decisions

### Formatting

- **Precision**: Displayed to 1 decimal place (e.g., "15.8%")
- **Loading State**: Shows "…" while calculating
- **Error State**: Falls back to static values seamlessly

## Future Enhancements

### Planned Improvements

1. **Real Stake-Seconds**: Replace simplified calculation with actual on-chain stake-seconds
2. **Market Data Integration**: Use real lending protocol APY data
3. **Dynamic Allocations**: Adjust market allocations based on participation
4. **Advanced Risk Models**: More sophisticated risk assessment
5. **Historical Analysis**: Track APY accuracy over time

### Data Sources

Future implementations will integrate:

- **On-chain Data**: Real stake-seconds and total deposits
- **Price Feeds**: Real-time token prices
- **Lending Protocol**: Actual supply/borrow rates
- **Market Analytics**: Historical performance data

## Technical Notes

### Performance Considerations

- **Caching**: APY calculations are cached to avoid repeated computation
- **Throttling**: Updates are throttled to prevent excessive recalculation
- **Lazy Loading**: Calculations only run when needed

### Accuracy Disclaimer

APY estimates are **indicative only** and subject to:

- **Market Conditions**: Token prices and lending rates change
- **Participation**: Total deposits affect individual reward shares
- **Time Decay**: Rewards decrease as launch approaches
- **Protocol Changes**: Smart contract parameters may change

### Risk Warnings

Users should understand that:

- **Estimates Only**: APY calculations are estimates, not guarantees
- **Market Risk**: Token prices can fluctuate significantly
- **Protocol Risk**: Smart contract risks exist
- **Liquidity Risk**: Withdrawals may be subject to liquidity constraints

## Conclusion

The PreFi APY estimation system provides users with transparent, dynamic yield expectations while maintaining robustness through fallback mechanisms. The multi-factor approach ensures fair reward distribution while accounting for risk and market conditions.

For technical implementation details, see the source code in `src/pages/PreFi.tsx` in the APY Calculation Utils section.
