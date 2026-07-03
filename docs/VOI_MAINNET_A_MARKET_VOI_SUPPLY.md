# Voi Mainnet — A Market — VOI Supply (Developer Guide)

Market-specific implementation reference for **supplying native VOI** into the **A market** on **Voi Mainnet**. This is the canonical native-collateral deposit path: no Folks mint, no ASA opt-in, no xALGO/tALGO preambles.

**General supply architecture:** [Lending Supply](LENDING_SUPPLY.md)  
**Old-pool balances:** [Pool migration configuration](prefi/POOL_MIGRATION.md)

---

## Market identity

| Field | Value | Notes |
|-------|-------|-------|
| **Network ID** | `voi-mainnet` | App config key |
| **Wallet network** | `voimain` | Passed to use-wallet / algorandService |
| **Market label** | **A** | `getMarketLabel("voi-mainnet", "47139778")` → `"A"` (index 0 in `prodLendingPools`) |
| **Lending pool app** | `47139778` | `prodAMarket` — `deposit()` `poolId` |
| **Market contract** | `41877720` | `contractId` — `deposit()` `marketId` |
| **nToken app** | `47139789` | Holds deposited VOI as ARC200 market tokens; resolved at runtime from market info |
| **Config symbol** | `VOI` | `getTokenConfig("voi-mainnet", "VOI")` |
| **UI display** | **Voi** | `marketOverride.displaySymbol` / `displayName` |
| **Asset** | Native VOI | `assetId: "0"` |
| **Token standard** | `network` | Native payment into nt200, not ASA axfer |
| **Decimals** | `6` | 1 VOI = 1_000_000 micro-units |

VOI exists **only on the A market** (`47139778`). The B market (`47139781`) hosts other assets (e.g. WAD s-token); there is no separate VOI row on B.

### Related protocol apps (Voi Mainnet prod)

From `voiMainnetConfig.contracts` in `src/config/index.ts`:

| Role | App ID |
|------|--------|
| Price oracle | `47138069` |
| Market controller | `47138067` |
| App storage (foreign app on deposit) | `47138065` |
| sToken | `47138068` |
| Governance | `48472636` |

The deposit txn group passes **`foreignApps: [47138065]`** on `lending.deposit` when `networkId === "voi-mainnet"`.

### RPC / explorer

| Service | URL |
|---------|-----|
| Algod | `https://mainnet-api.voi.dork.fi:443` |
| Indexer | `https://mainnet-idx.voi.nodely.dev` |
| Explorer | `https://block.voi.network` |

---

## Config reference

Production token entry in `prodTokens.VOI` (`src/config/index.ts`):

```typescript
VOI: {
  assetId: "0",
  poolId: "47139778",        // A market (current)
  contractId: "41877720",    // market contract
  nTokenId: "47139789",      // current nToken (config default; runtime from market info)
  migration: {
    poolId: "41760711",      // PreFi / legacy A pool
    contractId: "41877720",
    nTokenId: "42125195",    // legacy nToken
  },
  decimals: 6,
  name: "VOI",
  symbol: "VOI",
  tokenStandard: "network",
  marketOverride: {
    displayName: "Voi",
    displaySymbol: "Voi",
    isSmartContract: true,
  },
},
```

**No `adapters`** — supply is a single-route native deposit. Folks, xALGO consensus, and tALGO Tinyman paths do not apply.

---

## End-to-end supply flow

```text
User on Voi Mainnet + connected wallet
  → Markets / Portfolio: Deposit on VOI row (pool 47139778)
  → SupplyBorrowModal (mode="deposit")
       asset: "VOI" | "Voi"
       poolId: "47139778"
       marketId: "41877720"
       network: "voi-mainnet"
  → Wallet balance: native spendable VOI (account amount − minBalance)
  → lendingService.deposit(
       "47139778", "41877720", "network", amountAtomic, userAddress, "voi-mainnet"
     )
  → Sign → confirm → POST /transaction-metadata/{poolApplTxId}?network=voi-mainnet
  → fetchFreshUserData(addr, "voi-mainnet", 47139778, 41877720)
  → Supplied Assets row appears / updates
```

### Modal open parameters

When tracing bugs, confirm the parent passes:

| Prop | Expected value |
|------|----------------|
| `mode` | `"deposit"` |
| `poolId` | `"47139778"` |
| `marketId` / resolved market | `"41877720"` |
| `network` | `"voi-mainnet"` |
| `configSymbol` | `"VOI"` (when disambiguating from display `"Voi"`) |

Portfolio: `handleDepositClick("VOI" | "Voi", "47139778", "voi-mainnet", "VOI", "41877720")`.

### Pre-checks (this market)

| Check | Where | Notes |
|-------|-------|-------|
| Deposit cap | `isAtDepositCap(totalDeposits, maxTotalDeposits)` | Blocks at ≥95% of on-chain cap |
| Paused market | `isMarketPaused` in `deposit()` | Throws before build |
| Wallet balance | `tokenStandardUsesNativeWalletBalance("network")` | Algod `accountInformation`; spendable = amount − minBalance |
| Pool health (if user has borrows) | `shouldBlockDepositForLowEstimatedHealth` | Rare for pure supply; relevant if same pool has borrows |
| Folks / opt-in | N/A | No adapters or standalone opt-in flags on VOI |

---

## Transaction group (`lendingService.deposit`)

For `tokenStandard === "network"`, the builder assembles a **`ci.custom()`** group on pool **`47139778`**. Typical legs (exact set depends on simulation permutation):

1. **Optional MBR** — `token.createBalanceBox` (~28,500 microVOI) if user has no nt200 balance box.
2. **nt200 deposit** — `token.deposit(amount)` with **`payment: amount`** (native VOI sent into nToken **`47139789`**).
3. **ARC200 approve** — `token.arc200_approve(poolAddress, amount × 1.1)` so the pool can pull market tokens.
4. **Lending deposit** — `lending.deposit(41877720, amount)` on pool **`47139778`** with:
   - `foreignApps: [47138065]`
   - `payment`: `100_000` or `900_000` microVOI (fee/MBR variant tried by simulation loop)

The service tries **8 payment-flag permutations** until `ci.custom()` simulates successfully. Failures with `tried to spend` usually mean insufficient spendable VOI for amount + fees + MBR.

**Amount units:** UI human VOI → `amount × 10^6` atomic string passed to `deposit()`.

**Not used for this market:** Folks mint, xALGO governance mint, tALGO Tinyman mint, ASA axfer, `arc200-exchange` redeem.

---

## Wallet balance

Native VOI balance for the supply modal:

```typescript
// Portfolio.tsx / usePortfolioData.ts
const accountInfo = await algod.accountInformation(address).do();
const balance = spendableAlgoHumanFromAccount(accountInfo); // (amount - minBalance) / 1e6
```

Implemented in `src/utils/algorandWalletBalance.ts`. The UI shows **spendable** balance above protocol min-balance; it does **not** subtract an extra fee buffer (by design — see file comment).

Clients must be initialized for **`voimain`** (`algorandService.initializeClientsForReads("voimain")` or transaction clients on the modal's target network).

---

## Supplied position display

After confirmation, the Portfolio **Supplied Assets** row comes from the API, not the wallet.

### Match keys

`Portfolio.transformedDepositsAndBorrows` resolves each deposit with:

- `network` = `"voi-mainnet"`
- `marketId` / `underlyingContractId` = `"41877720"`
- `appId` / `poolId` = `"47139778"`
- Token config: `getAllTokensWithDisplayInfo("voi-mainnet")` where `underlyingContractId === "41877720"` and `poolId === "47139778"`

Do **not** match on display symbol `"Voi"` alone — other markets can share display names.

### Balance formula

```text
suppliedBalance = (scaledDeposits × depositIndex) / 1e18 / 10^6
```

- `scaledDeposits`, `userDepositIndex` — from `user.computed.deposits[]`
- `depositIndex` — from enriched market row for pool `47139778` + market `41877720`

### Supply APY

From matched market row:

```text
apy = market.apyCalculation.apy ?? market.supplyRate × 100
```

Computed in `calculateDepositAPY` (`src/utils/apyCalculations.ts`) from on-chain utilization and reserve factor. VOI has **no** `intrinsicApyPercent` in config.

### Post-tx refresh

```typescript
POST /transaction-metadata/{poolApplTxId}?network=voi-mainnet

dorkfiAPIService.fetchFreshUserData(
  userAddress,
  "voi-mainnet",
  47139778,
  41877720
);
fetchMarketInfoFromContract("47139778", "41877720", "voi-mainnet");
fetchFreshUserHealth("voi-mainnet", 47139778, userAddress);
```

Pool app call tx id: last `appl` to app **`47139778`** in the signed group (`SupplyBorrowModal.finalizeAfterSign`).

---

## Legacy pool migration (not fresh supply)

Users who deposited during **PreFi** may still hold **legacy nToken `42125195`** on old pool **`41760711`**. They should **migrate**, not supply again into the old pool.

| | Legacy (PreFi) | Current (prod A) |
|--|----------------|------------------|
| Pool | `41760711` | `47139778` |
| Market | `41877720` | `41877720` |
| nToken | `42125195` | `47139789` |

Migration: `lendingService.migrate()` — atomic withdraw old + deposit new. UI shows a **Migrate** button when legacy ARC200 balance &gt; 0. See [Pool migration configuration](prefi/POOL_MIGRATION.md).

Fresh wallet VOI supply always targets **`47139778`**.

---

## Wallet compatibility

`SupplyBorrowModal` enforces network ↔ wallet pairing. For Voi Mainnet supply:

- User should be on **VOI Network** in the app switcher (`isCurrentNetworkVOI()`).
- Cross-network Portfolio passes `network: "voi-mainnet"` explicitly on the modal.
- WalletConnect / xChain paths have special-case handling in `finalizeAfterSign` (see [Lending Supply](LENDING_SUPPLY.md)).

---

## Debugging checklist

When VOI A-market supply fails or displays wrong data, verify in order:

1. **IDs** — Modal and `deposit()` use `poolId=47139778`, `marketId=41877720`, `networkId=voi-mainnet`, `tokenStandard=network`.
2. **Config lookup** — `getTokenConfig("voi-mainnet", "VOI")` returns the prod entry above (not PreFi `41760711` pool unless migration UI).
3. **Market row** — Markets API / `fetchMarketInfoFromContract("47139778", "41877720", "voi-mainnet")` returns `depositIndex`, `maxTotalDeposits`, not paused.
4. **Spendable balance** — Algod account on **voimain**; user has VOI for amount + group fees/MBR.
5. **Simulation** — `ci.custom()` error in console; try smaller amount if `tried to spend`.
6. **Metadata** — POST succeeded for pool tx on `voi-mainnet`; if not, portfolio may lag until indexer catches up.
7. **Position match** — API deposit item has `appId`/`poolId` `47139778` and `marketId` `41877720`; token resolver finds config row.
8. **Migration vs supply** — User with only legacy nToken on `42125195` needs **Migrate**, not a new wallet supply into `41760711`.

---

## Code map (this market only)

| Step | File | What to search |
|------|------|----------------|
| Config IDs | `src/config/index.ts` | `prodAMarket`, `prodTokens.VOI` |
| Market label A | `src/config/index.ts` | `getMarketLabel`, `prodLendingPools` |
| Open modal | `src/components/Portfolio.tsx` | `handleDepositClick` |
| Build tx | `src/services/lendingService.ts` | `export const deposit`, `tokenStandard == "network"`, `foreignApps.push(47138065)` |
| Sign / metadata | `src/components/SupplyBorrowModal.tsx` | `handleBuildTransaction`, `finalizeAfterSign` |
| Wallet balance | `src/components/Portfolio.tsx`, `src/utils/algorandWalletBalance.ts` | `spendableAlgoHumanFromAccount` |
| Supplied row | `src/components/Portfolio.tsx` | `transformedDepositsAndBorrows` |
| Migrate legacy | `src/services/lendingService.ts` | `export const migrate` |
| Cap guard | `src/constants/lendingCaps.ts` | `isAtDepositCap` |

---

## Related documentation

| Document | Relevance |
|----------|-----------|
| [Lending Supply](LENDING_SUPPLY.md) | Generic supply flow, edge cases, types |
| [Pool migration configuration](prefi/POOL_MIGRATION.md) | Legacy `41760711` → `47139778` |
| [Health Factor Calculation](HEALTH_FACTOR_CALCULATION.md) | Collateral from VOI deposits |
| [Transaction Metadata Integration](TRANSACTION_METADATA.md) | Post-supply refresh |
| [Asset Decimals and Display](ASSET_DECIMALS_AND_DISPLAY.md) | 6-decimal VOI formatting in portfolio |

---

*Last reviewed against `prodTokens.VOI` and `lendingService.deposit()` network-token path on Voi Mainnet. Update when pool or market app IDs change.*
