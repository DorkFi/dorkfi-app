# Algorand A Market — ALGO Bonus Interest

How **bonus supply APR** works for native **ALGO** on Algorand mainnet **A (Prime)** market: config flags, the excess liquidity gate, rewards API resolution, and how the UI adds the bonus into displayed deposit APY.

When this doc and config disagree, **trust** `src/config/index.ts` and `src/constants/algorandAMarketRewards.ts`.

Related: [Pool & market topology](POOL_TOPOLOGY.md), [APY Estimation Strategy](../prefi/APY_ESTIMATION.md) (PreFi display ranges — separate from live lending bonus APR), [Proposal: block rewards → borrow demand](../proposals/BLOCK_REWARDS_BORROW_DEMAND.md) (stake-safe PoL successor to airdrop / bonus APR).

## TL;DR

- Native **ALGO** on Algorand **A Prime** (`pool` `3333688282`, `contract` `3207744109`) has `hasRewards: true`.
- UI shows bonus APR only when available liquidity (supply − borrow) is **≥ 30k ALGO** (Dork Algorand DORK effective-stake / block-reward floor).
- Bonus % comes from the rewards app’s `/api/reward-apr-stats` (`targetAprAdjustedToSupplyPercent`).
- Displayed deposit APY = protocol supply APY + intrinsic (if any) + bonus.

---

## What it is

Deposit APY in Markets / Portfolio can include three additive pieces:

| Component | Source | ALGO @ A market |
|-----------|--------|-----------------|
| **Protocol supply APY** | On-chain utilization / interest model | Always (when market data loads) |
| **Intrinsic APY** | Token config / live staking sources | Not on the native ALGO A row (used by fALGO, tALGO, xALGO, etc.) |
| **Bonus rewards APR** | External rewards program (`targetAprAdjustedToSupplyPercent`) | Yes — gated (see below) |

The bonus line is labeled in the APY tooltip as **“Bonus rewards (target / supply)”**. Config and code call this the DorkFi **rewards program** (`hasRewards`), not PreFi VOI emissions.

---

## Identifiers (live)

| Field | Value |
|-------|--------|
| Network | `algorand-mainnet` |
| Pool (A Prime) | `3333688282` (`algorandProdAMarket`) |
| ALGO market contract | `3207744109` |
| Config flag | `algorandProdTokens.ALGO[0].hasRewards: true` |
| Rewards registry key | `algorand-mainnet:3333688282:3207744109` → instance `fa00f0044fc97455` |

Registry: `REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY` in `src/config/index.ts`.  
Resolved origin → `GET {origin}/api/reward-apr-stats` (`fetchRewardAprStats`).

---

## Excess gate (validator / stake requirement)

Algorand A market rewards stay **hidden in the UI** until available ALGO liquidity is high enough for **Dork Algorand DORK** effective stake (ALGO block-reward eligibility):

```
excess = max(0, totalSupply − totalBorrow)   // human ALGO units
show rewards ⇔ excess ≥ 30_000
```

Constants and helpers live in `src/constants/algorandAMarketRewards.ts`:

- `ALGORAND_A_MARKET_POOL_ID` — only this pool on `algorand-mainnet` is gated
- `ALGORAND_A_REWARDS_MIN_EXCESS_ALGO` — `30_000` (aligned with effective stake **> 30k ALGO** for Dork Algorand DORK block rewards)
- `effectiveHasRewards(...)` — applies the gate; other `hasRewards` markets are unchanged
- Tracking issue: [DorkFi/dorkfi-app#667](https://github.com/DorkFi/dorkfi-app/issues/667)

**Effective `hasRewards`** is what Markets filters, badges, CTAs, and bonus APR lookups use — not the raw config bit alone.

See also the proposal to redirect those block rewards into borrow demand: [Block rewards → borrow demand](../proposals/BLOCK_REWARDS_BORROW_DEMAND.md).

---

## Display flow

1. Token row has `hasRewards: true` and a resolvable rewards public base URL (row override → instance id → registry).
2. `effectiveHasRewards` passes (A market + excess ≥ 30k ALGO, or non-A rewards row).
3. `useRewardsAprBonusMap` fetches `/api/reward-apr-stats` (24h cache) and maps origin → `targetAprAdjustedToSupplyPercent`.
4. `getRewardsBonusSupplyAprPercent` / market card wiring pass that value as `bonusRewardsAprPercent` into `APYDisplay`.
5. Displayed APY = protocol supply APY + intrinsic (if any) + bonus.

Markets can also filter to reward markets only (`rewardMarketsOnly` in `useOnDemandMarketData`), which uses the same effective flag.

---

## Key code paths

| Concern | Location |
|---------|----------|
| Excess gate | `src/constants/algorandAMarketRewards.ts` |
| Unit tests for gate | `src/constants/__tests__/algorandAMarketRewards.test.ts` |
| `hasRewards` + registry | `src/config/index.ts` (`TokenConfig.hasRewards`, `REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY`, `getRewardsProgramPublicBaseUrl`) |
| Effective flag on market rows | `src/hooks/useOnDemandMarketData.ts` (`resolveMarketRewardsFields`) |
| Bonus APR fetch / lookup | `src/hooks/useRewardsAprBonusMap.ts`, `src/services/rewardAprStatsService.ts` |
| APY composition + tooltip | `src/components/APYDisplay.tsx` |
| Markets / Portfolio wiring | `MarketsTable`, `MarketCardView`, `MarketsDesktopTable`, `Portfolio` |

---

## Not the same as

- **PreFi APY estimates** in `docs/prefi/APY_ESTIMATION.md` (normalized VOI-reward display ranges for the pre-launch program).
- **Intrinsic APY** on liquid-staking / Folks-wrapped ALGO rows (`intrinsicApyPercent` / live sources) — additive yield from the underlying product, not the A-market bonus program.
- **ALGO on B market** — same `contractId` may appear on pool B, but the A-market row is the one with `hasRewards: true` and the A-pool excess gate.

---

## How to update this document

1. Change pool / contract / `hasRewards` / registry in `src/config/index.ts`.
2. Change the excess threshold or gate logic in `src/constants/algorandAMarketRewards.ts` (and tests).
3. Update the tables above to match.
4. If the rewards API field name or path changes, update `rewardAprStatsService` and this doc’s display-flow section.
