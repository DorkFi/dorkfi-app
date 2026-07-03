# Portfolio — Borrowed Assets (implementation reference)

This document describes how the **Borrowed Assets** section on the Portfolio page is implemented today. Use it as the working source of truth when changing UX, copy, filters, or risk metrics for borrowed positions.

## Location in the UI

- **Route:** Portfolio (`src/components/Portfolio.tsx`).
- **Visibility:** The section renders when `borrows.length > 0` (user has at least one borrow row after data resolution).
- **Layout:** Wrapped in `DorkFiCard`, with ordering relative to Supplied Assets when both exist (`hasBothPositionTypes` and `portfolioPositionsTab` on large screens).

## Primary code paths

| Concern | Where |
|--------|--------|
| Section UI, table, cards, filters, LTV | `src/components/Portfolio.tsx` (search for `Borrowed Assets` / `borrows`) |
| Mobile row card for borrow rows | `src/components/portfolio/PortfolioTableMobileCard.tsx` (`type="borrow"`) |
| Live balance / value overrides while rows are visible | `src/hooks/usePortfolioVisibleChainLive.ts` (`mergeBorrow`, `attachChainPollRow`, `portfolioPositionChainKey`) |
| Lending API helpers (refresh, on-chain reads) | `src/services/lendingService.ts`, `src/services/dorkfiAPIService.ts` |
| Market label **A** vs **B** (pool-based) | `getMarketLabel` in `src/config/index.ts` |
| APY math (utilization, rate curve, compound) | `src/utils/apyCalculations.ts` |
| Market objects enriched with `borrowApyCalculation` / deposit `apyCalculation` | `src/services/lendingService.ts` (`enhanceAVMMarketInfo`, `fetchMarketInfo`, etc.) |

## APY calculation (borrow column)

The **APY** shown on each borrow row is taken from the matched **market** row (same `asset` and `poolId` when present). Implementation in `Portfolio.tsx`:

```text
apy =
  market.borrowApyCalculation?.apy
  ?? (market.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0)
```

### Primary path: `borrowApyCalculation.apy`

Populated when market info is built (see `lendingService.ts`): `calculateBorrowAPY(parameters, state, isSToken)` in `src/utils/apyCalculations.ts`.

1. **Utilization** — `calculateUtilizationRate(totalScaledDeposits, totalScaledBorrows)` → `borrows / deposits` (0 if no deposits). **s-tokens** force **100%** utilization.

2. **Current borrow rate (decimal)** — `calculateBorrowRate(baseBorrowRateBps, slopeBps, utilization)`:

   ```text
   borrowRate = (baseBorrowRate / 10000) + (slope / 10000) × utilization
   ```

   `borrowRate` is a nominal annual rate as a decimal (e.g. `0.05` = 5%).

3. **Convert to APY %** — `convertBorrowRateToAPY(borrowRate)` assumes that nominal rate is earned with **daily** compounding:

   ```text
   dailyRate = borrowRate / 365
   APY = ((1 + dailyRate)^365 − 1) × 100
   ```

   The returned `apy` is a **percentage** (e.g. `5.12` for ~5.12%).

### Fallback: `borrowRateCurrent × 100`

If `borrowApyCalculation` is missing, the UI uses the contract’s current borrow rate decimal (`borrowRateCurrent`, from `borrowRate` in basis points ÷ 10000) and multiplies by **100** to display a percent. That value is **not** run through `convertBorrowRateToAPY`, so it behaves like a **spot annual borrow rate** (closer to a simple **APR**-style quote than to the compounded APY above). Prefer fixing data so `borrowApyCalculation` is present if you need consistent APY semantics.

### Deposit (supply) APY (related)

`calculateDepositAPY` in the same file: same utilization and `calculateBorrowRate`, then **`supplyRate`** = `borrowRate × utilization × (1 − reserveFactor)`, then **`convertSupplyRateToAPY(supplyRate)`** using the same daily-compounding formula as borrow. Used for supplied-asset displays, not the borrow column.

Full supply flow (deposit tx, config, portfolio rows): see [Lending Supply](LENDING_SUPPLY.md).

### Labeling: APY vs APR

- The **intended** borrow display number from `calculateBorrowAPY` is **APY** (daily compounded).
- The **`borrowRateCurrent` fallback** is an uncompounded annual rate as %; calling it “APY” is slightly loose—**APR** or “borrow rate” would be stricter for that path only.

## Data: where `borrows` comes from

1. **Preferred:** Rows are derived from `user.computed.borrows` (API user object). Each item is transformed in a `useMemo` (`transformedDepositsAndBorrows`) into table rows with:
   - `asset`, `icon`, `balance`, `value`, `apy`, `tokenPrice`, `poolId`, `network`, `type: "borrow"`.
   - Balances use scaled borrows × borrow index ÷ `1e18` (same scale as deposits), then token decimals.
   - **Accrued interest (owed):** from scaled borrows and the difference between current borrow index and the user’s snapshot index (`userBorrowIndex` / `borrowIndex` on the item), exposed as `accruedInterest` / `interest` and `accruedInterestValue`.
2. **Fallback:** If computed borrows are missing or transform to an empty list, `borrows` falls back to `userPositions` entries with `type === "borrow"` (legacy path from `fetchUserPositions` / chain balance fetches).

**Totals** used elsewhere (health, LTV, etc.): `totalBorrowed` prefers `user.computed.globalBorrowValue`, then `userGlobalData.totalBorrowValue`, then the sum of borrow row `value` fields. **`totalCollateral`** follows the same pattern for collateral (global computed → global API → sum of deposits).

## Desktop table: columns and behavior

Sortable columns (see `borrowedAssetsSort` state; default `column: "apy"`, `direction: "asc"`):

- **Asset** — sort by symbol.
- **Network** — sort by network string.
- **Market** — **A** / **B** via `getMarketLabel(borrowNetwork, borrow.poolId)` (not raw pool id).
- **Borrowed** — token amount (`balance`).
- **Value (USD)** — `value`.
- **APY** — borrow APY from market data (see [APY calculation](#apy-calculation-borrow-column)).
- **Accrued Interest** — accrued interest amount (owed).
- **LTV Usage** — per-row metric (see below); header has an info tooltip.
- **Liquidation Price** — only if `SHOW_LIQUIDATION_PRICE_IN_BORROWED` is `true` (currently **`false`** at the top of `Portfolio.tsx`). When enabled, includes explanatory tooltip copy.
- **Actions** — opens borrow or repay flows; borrow can be disabled when the market is paused or at borrow cap (`isAtBorrowCap`).

**Filters (desktop inline tabs):**

- **Search** — substring match on asset symbol (`borrowedAssetsSearchTerm`).
- **Network** — `all` | `algorand` | `voi` (string includes check on `borrow.network`).
- **Market** — `both` | `A` | `B` using `getMarketLabel` vs `borrowedAssetsMarketFilter`.

**Pagination:** Collapsed list shows **5** rows; **Show More** / **Show Less** toggles `showAllBorrowedAssets`. Changing search or network filter resets “show all” to collapsed (`useEffect` around `borrowedAssetsSearchTerm` / `borrowedAssetsNetworkFilter`).

## Mobile card view

- Uses **`PortfolioTableMobileCard`** with `type="borrow"`, passing `ltvUsage`, optional `liquidationPrice`, `borrowDisabled`, and callbacks for borrow/repay.
- **Filters applied in code:** search + network only (same substring / includes logic as desktop).
- **Market (A/B) filter:** state exists in the mobile filter dialog, but the mobile list pipeline **does not** apply `borrowedAssetsMarketFilter` (only the desktop table does). If product intent is parity, align these paths when changing filters.

**Sorting on mobile** is limited compared to desktop: the `switch` handles `value`, `apy`, `borrowed`, default `apy` — there is no `network` / `asset` / `accruedInterest` branch in the mobile sort block.

## LTV Usage (per row)

**Intent:** Show how this borrow’s **USD value** compares to **collateral for that lending pool**, not the whole-portfolio aggregate (unless the row has no pool).

**Pool collateral map (`collateralUsdByPoolId`):**

- Built in `useMemo` keyed by pool id (`appId` string).
- For each entry in `user.globalUserData`, `totalCollateralValue` is read and converted: `BigInt(...) / 1e12` → USD number (see inline comment in `Portfolio.tsx`).
- **Fallback:** For any pool id that still has no entry, sum **deposit** row `value` for that `poolId` from current `deposits`.

**Per borrow row:**

```text
poolCollateralUsd =
  borrow.poolId present
    ? collateralUsdByPoolId[borrow.poolId] ?? 0
    : totalCollateral

ltvUsage =
  poolCollateralUsd > 0
    ? (borrow.value / poolCollateralUsd) * 100
    : borrow.value > 0 ? 100 : 0
```

- **No pool id:** denominator is **`totalCollateral`** (portfolio-wide collateral total as computed above).
- **Zero pool collateral but positive borrow:** LTV Usage is **100%** (guards against divide-by-zero).

**User-facing tooltip** (desktop header + mobile info icon) summarizes: borrow USD vs that pool’s on-chain collateral; if the row isn’t linked to a pool, portfolio-wide collateral is used.

## Refresh

**Borrowed Assets** refresh button calls `handleRefreshBorrowedAssets`: for each borrow, resolves token via `getAllTokensWithDisplayInfo`, then `dorkfiAPIService.fetchFreshMarketData(network, appId, marketId)`. On success, triggers `fetchUser(displayAddress)` (or position refresh in view-only mode) after a short delay.

## Live chain polling (visible rows)

`usePortfolioVisibleChainLive` attaches intersection observers to row refs (`attachChainPollRow` + `portfolioPositionChainKey("borrow", …)`). When a borrow row is visible, the hook can merge fresher balances / values into the row (`mergeBorrow`) so displayed numbers track chain state without requiring a full navigation.

## Feature flags / constants (borrow-related)

| Constant | File | Purpose |
|----------|------|---------|
| `SHOW_LIQUIDATION_PRICE_IN_BORROWED` | `Portfolio.tsx` | Toggles Liquidation Price column and mobile field |
| `SHOW_ACCRUED_INTEREST_SECTION` | `Portfolio.tsx` | Separate accrued-interest section (not the per-row column) |

## Maintenance checklist

When changing borrowed logic, verify:

1. **LTV denominator** — still matches `collateralUsdByPoolId` + `totalCollateral` fallback behavior.
2. **Desktop vs mobile** — filter/sort parity if users expect the same list on both.
3. **Tooltips** — keep `Portfolio.tsx` and `PortfolioTableMobileCard.tsx` copy in sync for LTV Usage (and Liquidation Price when enabled).
4. **Refresh** — `handleRefreshBorrowedAssets` still lines up with how `poolId` / `underlyingContractId` are resolved for each network.
5. **APY** — if you change `apyCalculations.ts` or market enrichment, update this doc and keep Portfolio fallbacks aligned.

---

*Last reviewed against implementation in `Portfolio.tsx` and related hooks/components as of the doc’s introduction. Update this file when behavior changes.*
