# PreFi Total Deposits Documentation

## Overview

This document provides comprehensive information about how total deposits work in the PreFi platform, including both individual user deposits and global market deposits across all networks.

## Table of Contents

1. [Types of Total Deposits](#types-of-total-deposits)
2. [Your Total Deposited](#your-total-deposited)
3. [Market Total Deposits](#market-total-deposits)
4. [Cross-Network Aggregation](#cross-network-aggregation)
5. [Deposit Limits and Caps](#deposit-limits-and-caps)
6. [Real-Time Updates](#real-time-updates)
7. [Technical Implementation](#technical-implementation)
8. [Troubleshooting](#troubleshooting)

## Types of Total Deposits

PreFi tracks several different types of total deposits:

### 1. Your Total Deposited (Personal)
- **Definition**: Sum of all your deposits across all markets in USD value
- **Display**: Shown in the main dashboard header
- **Purpose**: Gives you a quick overview of your total investment
- **Calculation**: Sum of (deposit amount × current token price) for all your deposits

### 2. Market Total Deposits (Per Market)
- **Definition**: Total deposits in a specific market across all users
- **Display**: Shown in individual market cards
- **Purpose**: Shows market activity and capacity utilization
- **Calculation**: Sum of all user deposits in that specific market

### 3. Global Total Deposits (All Markets)
- **Definition**: Total deposits across all markets and all networks
- **Display**: Used for reward allocation calculations
- **Purpose**: Determines market share for reward distribution
- **Calculation**: Sum of all deposits across all markets on all networks

## Your Total Deposited

### What It Shows

Your Total Deposited displays the combined USD value of all your deposits across all PreFi markets. This includes:

- **All Markets**: Deposits in VOI, aUSD, UNIT, BTC, ETH, ALGO, POW, etc.
- **All Networks**: Both Algorand and Voi network deposits
- **Real-Time Value**: Updated based on current token prices
- **USD Conversion**: All amounts converted to USD for easy comparison

### How It's Calculated

```typescript
// Simplified calculation logic
let totalUSD = 0;
for (each market you have deposits in) {
  const depositAmount = yourDepositAmount;
  const tokenPrice = currentTokenPrice;
  const depositValueUSD = depositAmount * tokenPrice;
  totalUSD += depositValueUSD;
}
```

### Display Location

- **Main Dashboard**: Top statistics section
- **Label**: "Your Total Deposited"
- **Format**: `$X,XXX.XX` (formatted with commas)
- **Icon**: Trending up arrow
- **Tooltip**: "Combined value of all your deposits across all markets. Earlier deposits earn more rewards."

### Important Notes

- **Price Dependent**: Value changes with token price fluctuations
- **Cross-Network**: Includes deposits from both Algorand and Voi networks
- **Real-Time**: Updates automatically as prices change
- **Reward Impact**: Higher total deposits = higher potential rewards

## Market Total Deposits

### What It Shows

Each market displays its total deposits, showing:

- **Current Deposits**: Total amount deposited by all users
- **Maximum Capacity**: Maximum deposits allowed for the market
- **Utilization**: Percentage of capacity currently used
- **Progress Bar**: Visual representation of market capacity

### Display Format

```
Pool Progress: $X,XXX,XXX / $X,XXX,XXX (XX%)
[Progress Bar Visualization]
```

### Market Capacity

Each market has a maximum total deposit limit:

- **VOI Market**: Typically $10M maximum
- **aUSD Market**: Typically $5M maximum
- **Other Markets**: Varies by market configuration
- **Dynamic Limits**: Can be adjusted by administrators

### Pool Progress Calculation

```typescript
// Pool progress calculation
const totalDepositsUSD = marketTotalDeposits[marketId];
const maxDeposits = marketMaxTotalDeposits[marketId];
const percentage = (totalDepositsUSD / maxDeposits) * 100;
```

## Cross-Network Aggregation

### How It Works

PreFi operates across multiple networks, and total deposits are aggregated:

1. **Algorand Network**: Traditional Algorand-based tokens
2. **Voi Network**: VOI-based tokens and assets
3. **Unified Tracking**: All networks contribute to global totals
4. **Real-Time Sync**: Data synchronized across networks

### Global Competition

Your rewards depend on your performance relative to ALL users across ALL networks:

- **Global Pool**: 5M VOI rewards shared across all networks
- **Cross-Network Competition**: You compete with users on both networks
- **Market Allocation**: Rewards allocated based on global market deposits
- **Fair Distribution**: No network gets preferential treatment

### Network-Specific Totals

While the system tracks global totals, you can also see:

- **Current Network**: Which network you're currently viewing
- **Network-Specific Deposits**: Your deposits on the current network
- **Cross-Network Summary**: Total across all networks in your personal total

## Deposit Limits and Caps

### Market-Level Limits

Each market has maximum total deposit limits:

- **Purpose**: Prevent over-concentration in single markets
- **Administrative Control**: Can be adjusted by platform administrators
- **Real-Time Enforcement**: New deposits blocked if limit reached
- **Dynamic Adjustment**: Limits can be increased if needed

### Individual Market Caps

```typescript
// Example market limits (varies by market)
{
  "VOI": { maxTotalDeposits: "10000000" },    // $10M
  "aUSD": { maxTotalDeposits: "5000000" },    // $5M
  "UNIT": { maxTotalDeposits: "2000000" },    // $2M
  "BTC": { maxTotalDeposits: "15000000" },    // $15M
  "ETH": { maxTotalDeposits: "12000000" }     // $12M
}
```

### Capacity Monitoring

The system continuously monitors:

- **Current Utilization**: How close markets are to their limits
- **Capacity Warnings**: Alerts when markets approach limits
- **Automatic Scaling**: Some markets may have dynamic limits
- **Emergency Adjustments**: Limits can be increased during high demand

## Real-Time Updates

### Update Frequency

Total deposits are updated in real-time through:

- **Blockchain Monitoring**: Direct on-chain data reading
- **Price Feeds**: Real-time token price updates
- **User Actions**: Immediate updates on deposit/withdrawal
- **Background Sync**: Continuous data synchronization

### Update Sources

1. **On-Chain Data**: Direct blockchain queries for deposit amounts
2. **Price APIs**: External price feeds for USD conversion
3. **User Transactions**: Immediate updates from user actions
4. **Network Sync**: Cross-network data synchronization

### Caching Strategy

The system uses intelligent caching:

- **Short-Term Cache**: Recent data cached for performance
- **Invalidation**: Cache cleared on significant changes
- **Fallback Data**: Backup data sources for reliability
- **Optimistic Updates**: UI updates immediately, syncs in background

## Technical Implementation

### Data Flow

```
Blockchain → Lending Service → Market Data → UI Display
     ↓              ↓              ↓           ↓
On-chain      Normalized      Aggregated   Formatted
Deposits      USD Values      Totals       Display
```

### Key Components

#### 1. Lending Service (`lendingService.ts`)
- Fetches raw deposit data from blockchain
- Normalizes amounts by token decimals
- Converts to USD values using current prices
- Provides market information including limits

#### 2. Market Data State (`PreFi.tsx`)
- `marketTotalDeposits`: Current deposits per market
- `marketMaxTotalDeposits`: Maximum limits per market
- `globalDeposited`: User's total across all markets

#### 3. Real-Time Updates
- React Query for data fetching and caching
- WebSocket connections for live updates
- Optimistic UI updates for better UX

### Data Structures

```typescript
// Market total deposits state
const [marketTotalDeposits, setMarketTotalDeposits] = useState<{
  [marketId: string]: number;
}>({});

// Market max deposits state  
const [marketMaxTotalDeposits, setMarketMaxTotalDeposits] = useState<{
  [marketId: string]: number;
}>({});

// Global deposited calculation
const globalDeposited = useMemo(() => {
  let sum = 0;
  for (const market of markets) {
    const marketState = marketsState[market.id];
    if (!marketState) continue;
    const tokenAmount = fromBase(marketState.depositedBase, market.decimals);
    const usdValue = tokenAmount * (marketPrices[market.symbol] || 0);
    sum += usdValue;
  }
  return sum;
}, [markets, marketsState, marketPrices]);
```

### API Endpoints

The system uses several data sources:

- **Blockchain RPC**: Direct on-chain data queries
- **Price APIs**: Token price feeds
- **Market APIs**: Market-specific information
- **Network APIs**: Cross-network data aggregation

## Troubleshooting

### Common Issues

#### 1. Total Deposits Not Updating
**Symptoms**: Dashboard shows old deposit amounts
**Solutions**:
- Refresh the page to force data reload
- Check network connection
- Verify wallet connection is active
- Wait for blockchain confirmation

#### 2. Incorrect USD Values
**Symptoms**: Total deposited amount seems wrong
**Solutions**:
- Check if token prices are loading correctly
- Verify you're on the correct network
- Clear browser cache and refresh
- Check if price feeds are working

#### 3. Market Capacity Issues
**Symptoms**: Can't deposit despite having balance
**Solutions**:
- Check if market has reached its deposit limit
- Try a smaller deposit amount
- Check if market is paused or restricted
- Contact support if limits seem incorrect

#### 4. Cross-Network Sync Issues
**Symptoms**: Deposits from other network not showing
**Solutions**:
- Switch networks to see deposits on each network
- Check if cross-network sync is working
- Verify deposits were made correctly
- Wait for synchronization to complete

### Debugging Steps

1. **Check Network**: Ensure you're on the correct network
2. **Verify Connection**: Confirm wallet is properly connected
3. **Check Balances**: Verify you have sufficient token balance
4. **Review Transactions**: Check blockchain explorer for transaction status
5. **Clear Cache**: Clear browser cache and refresh
6. **Contact Support**: Reach out if issues persist

### Best Practices

1. **Monitor Regularly**: Check your total deposits regularly
2. **Understand Limits**: Be aware of market deposit limits
3. **Diversify**: Consider spreading deposits across multiple markets
4. **Stay Updated**: Keep track of market capacity and utilization
5. **Verify Transactions**: Always confirm transactions on blockchain

## Advanced Features

### Historical Tracking

The system tracks deposit history:

- **Deposit Timeline**: When deposits were made
- **Value Changes**: How deposit values change over time
- **Performance Tracking**: ROI and reward calculations
- **Audit Trail**: Complete transaction history

### Analytics Integration

Total deposits feed into various analytics:

- **Market Analysis**: Market utilization and trends
- **User Analytics**: Individual performance tracking
- **Reward Calculations**: APY and reward estimations
- **Risk Assessment**: Portfolio diversification analysis

### API Access

Developers can access total deposit data through:

- **REST APIs**: Standard HTTP endpoints
- **GraphQL**: Flexible query interface
- **WebSocket**: Real-time data streams
- **SDK**: JavaScript/TypeScript libraries

## Conclusion

Understanding total deposits in PreFi is crucial for:

- **Maximizing Rewards**: Knowing how your deposits contribute to rewards
- **Market Analysis**: Understanding market capacity and utilization
- **Portfolio Management**: Tracking your overall investment
- **Strategic Planning**: Making informed deposit decisions

The system provides comprehensive tracking across all markets and networks, giving you complete visibility into your PreFi investment and the overall market activity.

---

*This documentation covers the current implementation of total deposits in PreFi. Features and calculations may be updated as the platform evolves.*
