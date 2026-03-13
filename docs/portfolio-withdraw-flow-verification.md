# Portfolio Withdraw Flow – Verification Report

Verification performed against the test plan (portfolio withdraw flow). Code review + build/tests run on **2025-03-12**.

## 1. Withdraw modal (desktop) ✓

- **Open paths**: Health card Withdraw CTA (`HealthFactorActions` → `onWithdraw` → first deposit), Supplied Assets table row Withdraw (`handleWithdrawClick`), and mobile supplied cards (`PortfolioTableMobileCard` → `onWithdrawClick` → `handleWithdrawClick`) all open the same withdraw modal via `setWithdrawModal({ isOpen: true, asset, poolId, network })`.
- **Asset selector**: `WithdrawModal` receives `availableAssets` and `onSelectAsset` from `PortfolioModals`; when multiple deposits exist, header shows logo + token name + `ChevronDown`; `onSelectAsset` updates modal state via `setWithdrawModal(prev => ({ ...prev, asset, poolId, network }))` so `currentlyDeposited`, max withdraw text, and market stats update per selection.
- **Validation**: `isValidAmount` requires positive, finite amount ≤ `maxRounded`; submit button disabled when invalid; MAX uses `effectiveMaxWithdraw` (health-factor-safe when `maxWithdrawUnderlying` is set).
- **Submit**: Orange outline styling on submit button (`border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white`); success uses `SupplyBorrowCongrats`; `handleWithdrawSubmit` in `PortfolioModals` performs withdraw and closes modal.

## 2. Withdraw modal from mobile ✓

- Same `WithdrawModal` and `PortfolioModals` wiring; mobile supplied cards use `PortfolioTableMobileCard` with `onWithdrawClick` → `handleWithdrawClick`, so opening from mobile card uses the same modal and behavior as desktop.

## 3. Supplied & Borrowed table actions (desktop) ✓

- **Supplied**: Supply = `variant="secondary"`, Withdraw = `variant="withdraw"`; both `min-w-[92px] h-8 px-2 gap-1` (matching width/height).
- **Borrowed**: Borrow = `variant="borrow-outline"`, Repay = `variant="danger-outline"`; same `min-w-[92px] h-8 px-2 gap-1`. Clicks call `handleBorrowClick` / `handleRepayClick` with correct asset/pool/network.

## 4. Mobile action buttons ✓

- **PortfolioTableMobileCard**: Deposit type → Supply `secondary`, Withdraw `withdraw`; Borrow type → Borrow `borrow-outline`, Repay `danger-outline`; actions use `flex-1 min-w-0` so buttons share width.
- **DepositsList** (used where list view is shown): Withdraw button updated from `danger-outline` to `variant="withdraw"` for consistency with plan.

## 5. Quick actions & market modal ✓

- **QuickActionsPanel**: Quick Withdraw buttons updated from `variant="outline"` to `variant="withdraw"` (orange). Quick Repay already uses `variant="danger-outline"`. Handlers call `onWithdraw(asset)` / `onRepayDebt(asset, poolId, network)` and open the same modals as elsewhere.
- **MarketDetailModal**: Has Deposit and Borrow primary actions only (no Withdraw tab). Plan’s “market modal Withdraw tab” is N/A for this modal; no change made.

## 6. Regression checks ✓

- **Supply / Borrow / Repay flows**: Handlers and modal state (`depositModal`, `borrowModal`, `repayModal`) and `PortfolioModals` render paths unchanged; no regressions identified in code.
- **Health card**: `HealthFactorActions` uses `onWithdraw`, `onRepayDebt`, `onAddCollateral`; health factor and totals come from `totalCollateral` / `totalBorrowed` and `calculateHealthFactor`; no changes to health card logic.
- **Build & tests**: `npm run test` (46 tests) and `npm run build` both succeeded.

## Code changes made

1. **QuickActionsPanel.tsx**: Quick Withdraw buttons — `variant="outline"` → `variant="withdraw"`.
2. **DepositsList.tsx**: Withdraw button — `variant="danger-outline"` → `variant="withdraw"`.

No other code changes were required; desktop/mobile table and card actions already matched the plan.
