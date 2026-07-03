# Lending Supply — Developer Guide

This document describes how **supplying collateral into lending markets** (deposit) is implemented in the DorkFi frontend. Use it as the working source of truth when changing supply UX, transaction building, position display, or APY for supplied assets.

**Scope:** Live lending supply on AVM networks (Voi Mainnet, Algorand Mainnet). This is **not** the PreFi pre-launch deposit program — see [PreFi User Guide](prefi/USER_GUIDE_PREFI.md) and [Total Deposits Guide](TOTAL_DEPOSITS.md) for that flow.

**Companion doc:** [Portfolio — Borrowed Assets](PORTFOLIO_BORROW_ASSETS.md) covers the symmetric borrow side.

**Market-specific:** [Voi Mainnet A Market — VOI Supply](VOI_MAINNET_A_MARKET_VOI_SUPPLY.md) — native VOI on pool `47139778`, market `41877720`, no adapters.

---

## Mental model

1. **All production supply UX** flows through `SupplyBorrowModal` with `mode="deposit"`.
2. **All production supply transactions** are built by `lendingService.deposit()` (plus optional Folks, xALGO, or tALGO preambles).
3. **Config** (`src/config/index.ts`) determines token standard, pool/market IDs, adapters, and opt-in flags; **amounts and caps** come from on-chain market state.
4. **Portfolio supplied rows** come from the DorkFi API (`user.computed.deposits`), not directly from wallet balances.
5. **After confirmation**, the app POSTs to `/transaction-metadata/{txId}` so positions update before the background indexer runs.

`DepositModal.tsx` is a **mock UI stub** (simulated delay, no `lendingService`). It is not the production deposit path.

---

## Entry points

| Entry | File | Opens |
|-------|------|-------|
| Markets table Deposit button | `src/components/MarketsTable.tsx` | `SupplyBorrowModal` via local `depositModal` state |
| Portfolio Supplied Assets / CTAs | `src/components/Portfolio.tsx` → `PortfolioModals.tsx` | `SupplyBorrowModal` with explicit `network` |
| Market detail | `src/components/MarketDetailModal.tsx` | `SupplyBorrowModal` (`mode="deposit"`) |
| Pool lending UI | `src/components/pools/PoolLendingModals.tsx`, `PoolsWadBorrowSection.tsx` | Pool-scoped supply modal |
| PreFi page (legacy) | `src/pages/PreFi.tsx` | Inline dialog calling `deposit()` directly — fewer features than `SupplyBorrowModal` |

### Opening a supply modal (Portfolio example)

`Portfolio.handleDepositClick(asset, poolId, networkId, configSymbol, marketId)`:

1. Guards: wallet connected, market data loaded.
2. Resolves market row and blocks if `isAtDepositCap(totalDeposits, maxTotalDeposits)`.
3. Sets `depositModal` state → `PortfolioModals` renders `SupplyBorrowModal`.
4. Prefetches wallet balance (and other deposit rows for cross-network portfolio).

Markets table follows the same cap guard before opening the modal.

---

## Primary code paths

| Concern | Where |
|--------|--------|
| Supply modal (build, sign, confirm, refresh) | `src/components/SupplyBorrowModal.tsx` |
| Amount input, max, cap validation | `src/components/SupplyBorrowForm.tsx` |
| Modal stats (APY, utilization, caps) | `src/components/SupplyBorrowStats.tsx`, `SupplyBorrowHeader.tsx` |
| Success screen | `src/components/SupplyBorrowCongrats.tsx` |
| Transaction builder | `src/services/lendingService.ts` — `deposit()`, `migrate()` |
| Folks mint preamble | `src/services/folksDepositAdapter.ts` |
| xALGO mint + supply (single group) | `src/services/xalgoMintSupplySingleGroup.ts`, `xalgoConsensusAdapter.ts` |
| tALGO Tinyman mint + supply | `src/services/talgoMintSupplySingleGroup.ts`, `tinymanTalgoAdapter.ts` |
| Chain clients | `src/services/algorandService.ts` |
| Post-tx API refresh | `src/services/dorkfiAPIService.ts` |
| Market enrichment + `apyCalculation` | `src/services/lendingService.ts` — `enhanceAVMMarketInfo`, `fetchMarketInfo`, `fetchMarketInfoFromContract` |
| Supply APY math | `src/utils/apyCalculations.ts` — `calculateDepositAPY` |
| Deposit cap threshold (95%) | `src/constants/lendingCaps.ts` — `isAtDepositCap` |
| Pool health guard before deposit | `src/utils/depositModalPoolHealthEstimate.ts` |
| Token / market config | `src/config/index.ts` |
| Supplied Assets table + row transform | `src/components/Portfolio.tsx` |
| Live balance while row visible | `src/hooks/usePortfolioVisibleChainLive.ts` |
| Pool farm informational notice | `src/components/pools/PoolFarmSupplyNotice.tsx` |

---

## Supply transaction flow

```text
User enters amount in SupplyBorrowModal
  → resolve token config (symbol, poolId, marketId, network)
  → optional deposit route (Folks underlying/f-asset, xALGO consensus, tALGO Tinyman)
  → pre-checks (balance, deposit cap, opt-in, pool health estimate)
  → lendingService.deposit() → unsigned txn group (base64[])
  → TransactionSignPreview → wallet signTransactions
  → algod sendRawTransaction → waitForConfirmation
  → POST /transaction-metadata/{poolAppCallTxId}?network=...
  → fetchFreshUserData + fetchFreshUserHealth + fetchMarketInfoFromContract
  → SupplyBorrowCongrats / onTransactionSuccess
```

### Inside `lendingService.deposit()`

Signature:

```typescript
deposit(
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,           // atomic units
  userAddress: string,
  networkId: NetworkId,
  options?: {
    depositAdapterId?: string;
    xalgoConsensusMintAlgoMicros?: bigint;
    tinymanTalgoMintAlgoMicros?: bigint;
    folksTwoStep?: "folks_mint_only";
  }
)
```

Steps (Algorand-compatible networks only; EVM throws not supported):

1. Initialize algod clients for the target `networkId` (not the app's current network).
2. Resolve `TokenConfig` from `getAllTokensWithDisplayInfo` (prefer `poolId` + `underlyingContractId` match).
3. Resolve Folks adapter via `resolveDepositFolksAdapter` when `depositAdapterId` is set.
4. **`isMarketPaused`** — throws if market is paused.
5. **`fetchMarketInfo`** — market state for simulation (UI enforces deposit cap; service-side cap check is commented out).
6. **ARC200 balance adjustment** — if user already holds nt200 market tokens, reduce the axfer leg (`applyArc200DepositBalanceAdjustment`).
7. **Optional preambles** (mutually exclusive where noted):
   - Folks mint (`buildFolksDepositMintTxns`) with **−100 atomic haircut** on estimated f-asset mint.
   - xALGO governance `immediate_mint` (via `xalgoConsensusMintAlgoMicros`).
   - tALGO Tinyman mint (via `tinymanTalgoMintAlgoMicros`).
8. **nt200 deposit leg** by `tokenStandard`:
   - `network` — native payment + `token.deposit`
   - `asa` / `network-asa` / `asa-asa` — ASA axfer + `token.deposit`
   - `arc200-exchange` — `arc200_redeem` + axfer
9. **`arc200_approve`** for pool spender (~110% of pull amount).
10. **`lending.deposit(marketId, amount)`** with network-specific `foreignApps` and MBR payment variants.
11. **`ci.custom()`** simulates and tries combinations until the group succeeds.
12. Returns `{ success: true, txns: string[] }` (base64-encoded unsigned txns).

Folks-only features (Algorand Mainnet): two-step ALGO deposit when `VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP` is enabled — step 1 mints f-ALGO (`folksTwoStep: "folks_mint_only"`), step 2 supplies from f-asset wallet route.

### Inside `SupplyBorrowModal.finalizeAfterSign`

After `waitForConfirmation`:

1. Decode signed group; find the **last** `appl` call to `poolAppId`.
2. Wait ~5 seconds, then **POST** `{VITE_DORKFI_API_URL}/transaction-metadata/{poolTxnID}?network={networkId}` with exponential backoff (up to 10 retries).
3. Parallel refresh: `fetchFreshUserData`, `fetchMarketInfoFromContract`, `fetchFreshUserHealth`.
4. Call parent `onTransactionSuccess` / show `SupplyBorrowCongrats`.

See [Transaction Metadata Integration](TRANSACTION_METADATA.md) for the full pattern.

---

## Config fields used for supply

| Field | Role |
|-------|------|
| `poolId` | Lending pool application ID passed to `deposit()` |
| `contractId` / `marketOverride.underlyingContractId` | Market contract ID (`deposit` arg) |
| `assetId` | ASA ID for axfer; Folks f-asset ID for opt-in / wallet balance |
| `decimals` | Human ↔ atomic conversion |
| `tokenStandard` | Selects nt200 deposit path (`network`, `asa`, `arc200-exchange`, etc.) |
| `marketOverride` | Display symbol vs underlying contract/asset |
| `adapters` | Folks routes: `type: "folks"`, `folksParams`, `depositWalletBasis`, `phases` |
| `requireStandaloneFAssetOptInBeforeDeposit` | Separate opt-in tx before main group (group size limit) |
| `requireStandaloneMarketAsaOptInBeforeDeposit` | Opt-in to market ASA (e.g. xALGO) before supply |
| `migration` | Old pool IDs for **migrate** flow (not normal wallet supply) |
| `isStoken` | s-token markets: special APY/cap handling in some UI paths |
| `intrinsicApyPercent` / `intrinsicApyLiveSource` | Added to displayed supply APY (governance / Folks live rates) |

**On-chain (not in config):** `maxTotalDeposits`, `totalDeposits`, `depositIndex`, `nTokenId` (resolved at runtime from market info).

Shared Folks adapter IDs: `FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING`, `FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET` in config.

---

## Displaying supplied positions

### Data source (preferred)

Rows come from **`user.computed.deposits`** on the DorkFi API user object. `Portfolio.transformedDepositsAndBorrows` maps each item to a table row:

```text
actualBalance = (scaledDeposits × depositIndex) / 1e18 / 10^decimals
```

- Match token via `getAllTokensWithDisplayInfo(network)` + `marketId` + `poolId` (`appId`).
- APY from matched market: `market.apyCalculation.apy ?? market.supplyRate × 100`.
- Accrued interest from `userDepositIndex` vs current `depositIndex`.
- Folks f-asset rows may use underlying USD price as fallback.

### Fallback

If computed deposits are missing or empty, fall back to `userPositions` entries with `type === "deposit"`.

### Market totals for caps

`totalDeposits` in market rows uses **`totalDepositsIncludingInterest`** (scaled deposits × deposit index) so cap checks align with on-chain utilization. See issue #246 in code comments.

### Live updates

`usePortfolioVisibleChainLive` attaches intersection observers to visible supply rows and merges fresher on-chain balances without a full page reload.

### APY resolution order (UI)

```text
supplyAPY =
  market.apyCalculation.apy
  ?? market.supplyRate × 100
  ?? deposit.apy
  ?? 0
```

Plus config **`intrinsicApyPercent`** / live hooks where `APYDisplay` adds intrinsic yield.

### APY calculation (`calculateDepositAPY`)

In `src/utils/apyCalculations.ts`:

1. **Utilization** — `totalScaledBorrows / totalScaledDeposits` (0 if no deposits).
2. **Borrow rate** — `(baseBorrowRate / 10000) + (slope / 10000) × utilization`.
3. **Supply rate** — `borrowRate × utilization × (1 − reserveFactor / 10000)`.
4. **APY %** — daily compounding: `((1 + supplyRate/365)^365 − 1) × 100`.

Populated in `lendingService.enhanceAVMMarketInfo` → `market.apyCalculation`.

**Note:** s-tokens force **100% utilization** for **borrow** APY only; deposit APY still uses actual utilization in `calculateDepositAPY`.

**Not the same as PreFi reward APY** — see [APY Estimation Strategy](prefi/APY_ESTIMATION.md) for the pre-launch normalization layer.

---

## Pre-checks and edge cases

| Case | Behavior |
|------|----------|
| **Deposit cap** | UI blocks at ≥95% of `maxTotalDeposits` (`isAtDepositCap` in `lendingCaps.ts`); form validates projected supply |
| **Paused market** | `isMarketPaused` throws in `deposit()` |
| **Pool health** | `shouldBlockDepositForLowEstimatedHealth` blocks deposit if estimated HF after deposit ≤ ~1.01 |
| **Folks underlying → f-asset** | Mint preamble; conservative mint estimate (−100 atomic) |
| **Folks f-asset from wallet** | `depositWalletBasis: "market_token"` — skips Folks mint |
| **Folks two-step** | Step 1: `folks_mint_only`; step 2: supply f-ALGO (optional auto-chain when env flag set) |
| **xALGO ALGO route** | Single group: governance mint + supply (`buildXalgoConsensusMintAndDepositSingleGroup`) |
| **tALGO ALGO route** | Tinyman mint + supply single group |
| **Standalone opt-in** | Separate tx when `requireStandaloneFAssetOptInBeforeDeposit` or `requireStandaloneMarketAsaOptInBeforeDeposit` |
| **ARC200 pre-balance** | Reduces deposit axfer if user already holds market tokens on nt200 |
| **Multi-market same symbol** | Disambiguate with `marketId`, `configSymbol`, `poolId` (`resolveSupplyBorrowToken`) |
| **Cross-network portfolio** | Modal receives explicit `network`; wallet balance cache keys include network + pool |
| **RainbowKit xchain wallet** | Special success handling (may close without congrats screen) |
| **Pool farm LP supply** | `PoolFarmSupplyNotice` — informational copy only |

---

## Pool migration (related, not wallet supply)

When a market moves to a new pool, users with balances on the **old** nToken use **`lendingService.migrate()`** — an atomic **withdraw old pool → approve → deposit new pool** group. This bypasses `SupplyBorrowModal` and Folks adapters.

Config: `TokenConfig.migration { poolId, contractId, nTokenId }`.

See [Pool migration configuration](prefi/POOL_MIGRATION.md).

---

## Multi-network support

| Network | Supply |
|---------|--------|
| **Voi Mainnet** (`voi-mainnet`) | Full `deposit()` path; Voi-specific `foreignApps`; native + ASA + ARC200 standards |
| **Algorand Mainnet** (`algorand-mainnet`) | Full path + Folks adapters + xALGO/tALGO combined groups |
| **EVM** | Not supported — `deposit()` throws |

Wallet compatibility checks in `SupplyBorrowModal` restrict some wallets to specific networks (e.g. Pera/Defly → Algorand).

---

## Key types

```typescript
// SupplyBorrowModal.tsx
interface SupplyBorrowModalProps {
  mode: "deposit" | "borrow";
  asset: string;
  poolId?: string;
  configSymbol?: string;
  marketId?: string;
  network?: string;
  assetData: {
    totalSupply: number;
    supplyAPY: number;
    maxTotalDeposits?: number;
    isSToken?: boolean;
    apyCalculation?: APYCalculationResult;
    // ...
  };
  walletBalance?: number;
  onTransactionSuccess?: () => void;
  availableAssets?: SupplyBorrowAvailableAsset[];
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  depositNotice?: string;
}

// config/index.ts (abbreviated)
interface TokenConfig {
  assetId?: string;
  contractId?: string;
  poolId?: string;
  nTokenId?: string;
  decimals: number;
  tokenStandard: TokenStandard;
  marketOverride?: { displaySymbol; underlyingAssetId; underlyingContractId; /* ... */ };
  migration?: { poolId; contractId; nTokenId };
  isStoken?: boolean;
  adapters?: TokenAdapterConfig[];
  requireStandaloneFAssetOptInBeforeDeposit?: boolean;
  requireStandaloneMarketAsaOptInBeforeDeposit?: boolean;
  intrinsicApyPercent?: number;
  intrinsicApyLiveSource?: string;
}
```

Portfolio deposit row fields after transform: `asset`, `balance`, `value`, `apy`, `poolId`, `network`, `marketId`, `configSymbol`, `scaledDeposits`, `userDepositIndex`, `accruedInterest`.

---

## Related documentation

| Document | Relevance |
|----------|-----------|
| [Portfolio — Borrowed Assets](PORTFOLIO_BORROW_ASSETS.md) | Symmetric borrow implementation; deposit APY cross-reference |
| [Health Factor Calculation](HEALTH_FACTOR_CALCULATION.md) | Collateral from deposits; deposit modal HF guard |
| [Transaction Metadata Integration](TRANSACTION_METADATA.md) | Post-supply metadata POST + refresh |
| [Asset Decimals and Display](ASSET_DECIMALS_AND_DISPLAY.md) | Supplied Assets table decimals and USD values |
| [Portfolio Withdraw Flow – Verification](PORTFOLIO_WITHDRAW_FLOW_VERIFICATION.md) | Symmetric withdraw UX and modal wiring |
| [Pool migration configuration](prefi/POOL_MIGRATION.md) | Atomic old-pool → new-pool flow |
| [PreFi User Guide](prefi/USER_GUIDE_PREFI.md) | Pre-launch deposits (different product) |
| [APY Estimation Strategy](prefi/APY_ESTIMATION.md) | PreFi reward APY display (not contract supply rate) |
| [Voi Mainnet A Market — VOI Supply](VOI_MAINNET_A_MARKET_VOI_SUPPLY.md) | Native VOI on A market (`47139778` / `41877720`) |

---

## Maintenance checklist

When changing supply behavior, verify:

1. **Cap guard** — `isAtDepositCap` still uses the same units as `market.totalDeposits` / `maxTotalDeposits`.
2. **Token resolution** — multi-pool symbols still disambiguate via `poolId` + `marketId` (not display symbol alone).
3. **Transaction metadata** — `finalizeAfterSign` still finds the pool `appl` tx and POSTs with the correct `network` query param.
4. **Portfolio rows** — `transformedDepositsAndBorrows` balance formula unchanged (`scaledDeposits × depositIndex / 1e18`).
5. **APY** — if you change `apyCalculations.ts` or `enhanceAVMMarketInfo`, update this doc and [PORTFOLIO_BORROW_ASSETS.md](PORTFOLIO_BORROW_ASSETS.md).
6. **Folks / xALGO / tALGO routes** — preamble groups still simulate correctly via `ci.custom()`.
7. **Cross-network portfolio** — supply modal receives and uses explicit `network`, not only `getCurrentNetwork()`.
8. **Do not wire new features to `DepositModal.tsx`** — use `SupplyBorrowModal` instead.

---

*Last reviewed against `SupplyBorrowModal.tsx`, `lendingService.deposit()`, and `Portfolio.tsx` supply paths. Update this file when behavior changes.*
