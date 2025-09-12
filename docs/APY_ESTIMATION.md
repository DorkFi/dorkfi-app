# APY Estimation Strategy for PreFi

This document explains how APY (Annual Percentage Yield) estimates are calculated and presented in the DorkFi PreFi system, reflecting both raw reward math and user-facing display values.

## Overview

The PreFi APY estimation combines several components to provide users with credible, market-aware yield expectations:

- **Reward APY (Raw)** – Based on VOI emissions distributed relative to market deposit caps.
- **Normalization Layer** – Converts raw APRs into user-friendly ranges to avoid extreme values.
- **Risk & Market Adjustments** – Highlights volatility and risk in experimental or microcap markets.
- **Fallback Values** – Static APY numbers used if calculations fail or data is missing.

> **Note:** Actual rewards are distributed based on deposit-USD-seconds (amount × time), meaning that both deposit size and how long funds remain deposited determine the final payout.

## Core Components

### 1. Reward Allocation by Deposit Caps

Rewards are diluted across markets according to deposit caps (USD value).

**Formula:**
```
APR = (Monthly VOI Rewards Value ÷ Deposit Cap) × 12
```

- **Smaller-cap markets** → higher raw APR
- **Larger-cap markets** → lower raw APR

### 2. Actual Deposits vs Cap

The realized APR depends on actual deposits:

```
APR = (Monthly VOI Rewards Value ÷ Actual Deposits) × 12
```

- If actual deposits < cap, APR is higher (fewer depositors sharing rewards).
- If actual deposits = cap, APR = cap-based estimate.
- If actual deposits > cap, APR stabilizes at the cap level.

### 3. Normalization Layer (Display APYs)

To avoid confusing spikes (e.g., 400% APR on ALGO with low deposits), raw APRs are mapped into display ranges:

- **2–4%** → Stable anchors (e.g., USDC, BTC, ETH)
- **5–8%** → Governance / derivative tokens
- **10–15%** → Boosted or community tokens
- **20%+** → High-risk / microcap experimental markets

In the app, the high end of the range is displayed.
For example: "5–8%" → "8%".

### 4. Example Display APYs

#### Voi A Market
- **VOI** → 12%
- **aUSD** → 8%
- **UNIT** → 15%
- **ALGO** → 20%+
- **ETH** → 12%
- **WBTC / cbBTC** → 8%
- **POW** → 15%

#### Algorand A Market
- **USDC** → 4%
- **ALGO** → 4%
- **VOI** → 12%
- **UNIT** → 12%
- **POW** → 15%
- **TINY** → 15%
- **COMPX** → 20%+
- **FINITE** → 15%

**Major bridged assets (ETH, BTC, Wormhole)** → 4–7%

#### Community Markets (B tiers)
- **SHELLY, COOP, ALPHA, CORN** → 12–15%
- **NODE, MONKO, AMMO, GM, IAT** → 20%+

### 5. Fallback Strategy

If dynamic calculations fail, static APYs are used:

```typescript
const fallbackAPYs = {
  'usdc': 4,
  'algo': 4,
  'voi': 12,
  'unit': 12,
  'pow': 15,
  'shelly': 15,
  'monko': 20,
};
```

Fallbacks mirror display-normalized values, not raw APRs.

## Implementation Details

### Calculation Flow

1. **`calculateRewardAPR()`** – Computes raw APR from deposit caps or actual deposits.
2. **`normalizeAPR()`** – Maps raw APR into user-facing ranges.
3. **`getDisplayAPY()`** – Chooses the high end of the range for app display.
4. **`getFallbackAPY()`** – Static values used when calculations fail.

### Real-Time Updates

APY estimates update dynamically based on:

- **VOI price** (affects reward value)
- **Actual deposits** (affects dilution)
- **Deposit-USD-seconds accumulation** (time-weighted rewards)
- **Market participation**

## User Experience

### Display Strategy

- **Market Cards / Tables** → Show display APY (high end of range).
- **Deposit/Withdraw Modals** → Show current APR with context:
  - "Current APR based on $X deposited: Y% (normalizes as deposits approach cap)."

### Formatting

- Use single numbers (e.g., "12%") rather than ranges.
- Use "20%+" for volatile microcap markets.
- Show tooltips explaining that APYs are estimates, not guarantees.

## Future Enhancements

- **Dynamic VOI Distribution** – Adjust reward pools based on market demand.
- **On-Chain Integration** – Use actual utilization and stake-seconds.
- **Historical Analysis** – Track how display APYs matched realized yields.
- **Advanced Risk Modeling** – More nuanced volatility & liquidity adjustments.

## Disclaimer

APY estimates are indicative only and subject to:

- Market conditions (token prices, utilization)
- Participation (actual deposits vs caps)
- Reward schedule changes
- Smart contract risks

Users should not treat APYs as guaranteed returns.
Final rewards are calculated using deposit-USD-seconds, ensuring fair distribution by deposit size and time.

