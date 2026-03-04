# Asset Decimals and Display

This document describes how the frontend handles **token decimals** for balance/amount display and **USD value consistency** in the withdraw flow. It is the reference for the behavior introduced to address [DorkFi/dorkfi-app#239](https://github.com/DorkFi/dorkfi-app/issues/239) (3.3 cop feedback: GoBTC showing only 6 decimals on portfolio and 3 in withdraw) and the follow-up fix for deposited value mismatch in the withdraw modal.

## Overview

- **Decimal display:** Assets with up to 8 decimals (e.g. goBTC on Algorand) must show that full precision everywhere so users do not think they "lost" small amounts when depositing.
- **Withdraw modal USD value:** The deposited balance USD in the withdraw modal must match the Supplied Assets table. This requires using the **deposit’s network** (not the app’s current network) when resolving token config and computing token price.

## Decimal display (up to 8 decimals)

### Rule

- Display decimals = `min(token.decimals, 8)`.
- Use the **token’s** decimals from config (per network and, when relevant, per `poolId`), not hardcoded 3 or 6.

### Where it’s applied

| Location | What uses token decimals |
|---------|---------------------------|
| **WithdrawModal** | Amount input, MAX button, validation rounding, “Deposited Balance” amount, “You can withdraw up to X” text. Prop: `tokenDecimals` (default 8). |
| **PortfolioModals** | Passes `tokenDecimals={withdrawToken?.decimals ?? 8}` into WithdrawModal. |
| **PreFi** | Passes `tokenDecimals={selectedMarket.decimals ?? 8}` into WithdrawModal. |
| **MarketsTable** | `getAssetData()` returns `decimals` from token config; passes `tokenDecimals={assetData.decimals ?? 8}` to WithdrawModal. |
| **DepositsList** | Balance, nToken balance, and accrued interest formatted with `displayDecimals = min(token.decimals ?? 6, 8)` from `getTokenConfig(currentNetwork, deposit.asset)` (and `poolId` when applicable). |
| **PortfolioTableMobileCard** | Balance and accrued interest use `displayDecimals` from `getTokenConfig(currentNetwork, asset)` (and `poolId` when applicable), capped at 8. |
| **AccruedInterestMobileCard** | Net / earned / owed interest use same `displayDecimals` from token config, capped at 8. |
| **Portfolio.tsx (Supplied Assets table)** | Desktop table: “Supplied” and “Accrued Interest” columns use `suppliedDisplayDecimals` from `getTokenConfig(depositNetwork, deposit.asset)` (and `poolId` when applicable), capped at 8. |

### Adding a new asset or new place that shows amounts

1. Resolve token config with **the correct network** (and `poolId` if the token has multiple markets).
2. Use `decimals` from that config; cap at 8 for display: `displayDecimals = Math.min(tokenConfig?.decimals ?? 6, 8)`.
3. Use `displayDecimals` in:
   - `toLocaleString(..., { maximumFractionDigits: displayDecimals })`
   - `toFixed(displayDecimals)` where appropriate
   - `formatNumber(..., { maximumFractionDigits: displayDecimals })`
   - WithdrawModal: pass `tokenDecimals` so the modal can use it for amount and validation.

## Withdraw modal: deposited value (USD) consistency

### Problem

The modal showed a different USD value for the same deposited balance than the Supplied Assets table (e.g. ~$7.26 vs ~$72 for the same goBTC amount) when:

- The **deposit** was on one network (e.g. Algorand), and
- The app’s **current network** was another (e.g. VOI).

Token config and price were being resolved using `currentNetwork`, so decimals and/or price could be wrong for that deposit.

### Rule

When computing **token price** for the withdraw modal (and any other deposit-specific USD value):

- Use the **deposit’s network**, not the app’s current network, to:
  - Resolve token config (and thus token decimals).
  - Ensure the same market/price source as the Supplied Assets table is used.

### Where it’s implemented

- **PortfolioModals.tsx — `getMarketStatsForDeposit`**
  - `depositNetwork = depositAny?.network || currentNetwork`
  - Token lookup: `getAllTokensWithDisplayInfo(depositNetwork)` (not `currentNetwork`).
  - Token price is then derived from `market.price` using the correct `tokenDecimals` for that network.
  - On error, fallback uses `deposit?.tokenPrice` when available so we don’t overwrite with a wrong value.

### WithdrawModal USD formatting

- “Deposited Balance” USD line uses `toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` so the modal always shows a consistent 2-decimal USD amount.

## Oracle price scale (reference)

The price oracle uses a **12-decimal scale**. Conversion to human-readable price uses token decimals:

- `targetAdjustment = 12 - tokenDecimals`
- `divisor = 10^targetAdjustment`
- `tokenPrice = parseFloat(market.price) / divisor`

So correct **token decimals** are required for correct USD values. Using the deposit’s network when resolving token config ensures the right decimals (and consistent behavior with the table).

## Related code

- **Config:** `src/config/index.ts` — token definitions including `decimals` (e.g. goBTC: 8).
- **Token lookup:** `getTokenConfig(networkId, symbol)`, `getAllTokensWithDisplayInfo(networkId)` from `@/config`.
- **Withdraw modal:** `src/components/WithdrawModal.tsx`.
- **Portfolio modals & price:** `src/components/PortfolioModals.tsx` (`getMarketStatsForDeposit`).
- **Supplied Assets table:** `src/components/Portfolio.tsx` (desktop table and mobile cards).
- **Deposits list / cards:** `src/components/DepositsList.tsx`, `src/components/portfolio/PortfolioTableMobileCard.tsx`, `src/components/portfolio/AccruedInterestMobileCard.tsx`.
