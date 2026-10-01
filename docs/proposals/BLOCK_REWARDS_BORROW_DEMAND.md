# Proposal: Block Rewards → Borrow Demand → Competitive Supply APR

**Status:** Proposal (not implemented) — revised after mechanism review  
**Scope:** Algorand mainnet A (Prime) ALGO market rewards mechanism  
**Related:** [Algorand A market ALGO bonus interest](../development/ALGORAND_A_MARKET_BONUS_INTEREST.md) (current airdrop / bonus APR overlay)

## TL;DR

Shift ALGO A-market incentives **away from supplier airdrops / bonus APR overlays** and **toward protocol-owned borrow demand** funded by **Algorand ALGO block rewards** earned by **Dork Algorand DORK** when **effective stake** (`supply − borrow`) stays **above 30k ALGO plus an explicit safety buffer**.

The **manager of DORK** (with **DorkLabs**, offline ops initially) funds **one active** designated subsidy account (e.g. **`stg 01 40`** — name + **40%** LTV). Capital remains **owned by DorkFi Protocol**.

**Core loop (rate-targeted):** block-reward ALGO → USDC (**allowlisted venues**) → **native USDC** collateral (highest CF) → **borrow ALGO A** only within a **stake-safe borrow budget**, **LTV**, borrow cap, and **net-carry ≥ 0** → optionally deposit borrowed ALGO at **Folks Finance ALGO (A or D via adapter)** for carry / relative-rate pressure (**not required** to hit the DorkFi APR target).

**Target (provisional):** lift **protocol supply APR** (interest model, no bonus overlay) from **~1.45% → ~2.15%** on ALGO A, without confusing **strategy-manufactured** utilization with **non-strategy** borrower demand.

**Hard constraint:** borrowing ALGO **reduces** effective stake. Strategy size is capped so eligibility for block rewards is never sacrificed for headline APR.

---

## Definition: block rewards

In this proposal, **block rewards** means only:

- **Asset:** native **ALGO**
- **Network:** Algorand consensus / block production rewards
- **Earner:** **Dork Algorand DORK** (DorkFi’s Algorand participation / staking identity)
- **Eligibility:** rewards accrue when **effective stake** is **over 30k ALGO**

They are **not** a generic protocol revenue bucket, VOI emissions, PreFi rewards, or the current supplier airdrop / `hasRewards` bonus APR overlay.

**Effective stake** (same as market excess / UI excess):

```
E = effective stake = supply − borrow
```

(human ALGO; floored at 0 in UI helpers). Block rewards require **E > 30k**. Ops must also keep a **Buffer** so the strategy never drives E to the knife-edge:

```
E_min = 30_000 + Buffer_ALGO
BorrowBudget = max(0, E − E_min)   // = max(0, S − B − 30_000 − Buffer_ALGO)
```

**Buffer_ALGO** is an offline ops parameter (to be set with live supply/borrow volatility; not fixed in this draft). No borrow expansion if `BorrowBudget` is exhausted.

---

## Terminology (precision)

| Term | Meaning in this proposal |
|------|---------------------------|
| **Protocol supply APR** | ALGO A supply APR from the **interest model** only (no `hasRewards` / bonus overlay) |
| **Target APR** | Provisional **~2.15%** protocol supply APR (from baseline **~1.45%**). Needs peer-rate + curve-inversion rationale before scale |
| **Strategy borrow** | ALGO debt held by the active subsidy account |
| **Non-strategy borrow** | All other ALGO A borrows |
| **StrategyBorrowShare** | `B_strategy / B_total` — measures how much of utilization is manufactured |
| **Net carry** | Expected NAV drift of the strategy after yields, borrow cost, swap amortization, and risk adders (see [Quantitative framework](#quantitative-framework)) |

Do **not** call protocol supply APR “organic” when utilization is largely strategy-driven.

---

## Current baseline

Snapshot motivating this proposal (update when figures change):

| Metric | Value |
|--------|--------|
| **Protocol supply APR** (ALGO A) | **~1.45%** |
| **Target protocol supply APR** | **~2.15%** provisional (**+0.70 pp**); justify vs peers before scale |
| **Effective stake E** | **< 30k ALGO** (`supply − borrow`) |
| **Dork Algorand DORK block-reward eligibility** | **Ineligible** (funding stream offline) |
| **Implication** | Must **restore E ≥ E_min** and observe block-reward income **before** piloting the borrow loop |

Primary outcome: raise **protocol supply APR** toward Target APR via **controlled** borrow demand, while keeping **E ≥ E_min** and tracking **StrategyBorrowShare**.

---

## Ownership & distribution

| Role | Responsibility |
|------|----------------|
| **Dork Algorand DORK** | Earns Algorand ALGO block rewards when **E > 30k** |
| **Manager of DORK** | Takes the block-reward amount; operates **1+** subsidy accounts; designates **exactly one active**; enforces borrow budget / kill switches (with DorkLabs) |
| **Subsidy account(s)** | Each has **name + LTV limit** (e.g. **`stg 01 40`**). One strategy per account. Inactive accounts idle until switched active |
| **Active subsidy account** | Sole account receiving new block-reward funding and executing the strategy. **Managed by DORK manager + DorkLabs**. Active status **recorded internally** |
| **DorkFi Protocol** | **Owns** all strategy balances (USDC collateral, Folks deposits, ALGO debt)—operators are not beneficial owners |
| **Application surface** | **ALGO A only** for competitive subsidy. **No expansion planned** |

```
Dork Algorand DORK earns ALGO block rewards (E > 30k)
        ↓
Manager of DORK funds the one active subsidy account
        ↓
Active account runs rate-targeted strategy under BorrowBudget + NetCarry
        ↓
Funds remain owned by DorkFi Protocol throughout
```

**Authority (offline ops initially):** who may fund accounts, rotate active designation, change LTV/Buffer/Target APR, approve swap venues / Folks adapter, and halt the strategy must be written in an ops runbook. Prefer **venue allowlists** over unrestricted “any DEX.” On-chain UNIT governance may take over parameters later; day-one changes are offline.

**Ownership note:** Operational control does not transfer beneficial ownership away from the protocol.

---

## Problem with the current model

Today, ALGO @ A Prime can show an additive **bonus rewards APR** (rewards program + `/api/reward-apr-stats`), gated on ≥ 30k ALGO excess. See the [bonus interest doc](../development/ALGORAND_A_MARKET_BONUS_INTEREST.md).

**Immediate state:** protocol **supply APR ≈ 1.45%**, **E < 30k**, DORK **ineligible** for block rewards.

| Issue | Why it matters |
|-------|----------------|
| **Low protocol supply APR (~1.45%)** | Below provisional **2.15%** target |
| **E below 30k → no block rewards** | Funding for this proposal is offline |
| **Airdrop UX / synthetic competitiveness** | Second yield layer; rate depends on emissions, not clearing |
| **Supplier subsidies ≠ borrow demand** | Do not by themselves raise utilization |

Cleaner loop once **E ≥ E_min**: use block rewards to fund **controlled borrow demand** (and optional Folks recycle), not to paint supplier APR off-curve—**without** driving E back under 30k.

---

## Proposal

**Replace supplier airdrops with a rate-targeted, stake-safe, protocol-owned borrow strategy** funded by Dork Algorand DORK ALGO block rewards.

### Intended causal chain

```
ALGO block rewards (only while E ≥ E_min = 30k + Buffer)
        ↓
Manager funds active account (e.g. stg 01 40)
        ↓
ALGO→USDC (allowlisted venue) → native USDC collateral
        ↓
Borrow ALGO A up to min(ΔB for Target APR, BorrowBudget, LTV, cap)
        while NetCarry ≥ 0
        ↓
Optional: deposit ALGO at Folks (A/D via adapter) under exposure caps
        ↓
DorkFi protocol supply APR ↑ toward ~2.15%
Optional: Folks supply APR pressure / carry
        ↓
Report protocol supply APR AND StrategyBorrowShare separately
```

### Design principles

1. **One yield story for suppliers** — Displayed supply APY is **protocol interest** (plus true intrinsic yields on other assets), not airdrop bonus APR.
2. **Buy utilization, not painted APR** — Deploy protocol capital on the borrow side.
3. **Protocol owns the capital** — Operators are not owners.
4. **One active named account** — e.g. **`stg 01 40`**; status internal; offline ops initially.
5. **Stake-safe sizing** — Never expand borrows that would push **E &lt; E_min**.
6. **Rate-targeted** — Size borrows from curve inversion toward Target APR, not “borrow whenever gates pass.”
7. **Full economic gate** — Expand only if **NetCarry ≥ 0** (not USDC supply vs ALGO borrow alone).
8. **Folks leg optional** — Not required to hit DorkFi Target APR; capped exposure.
9. **ALGO A only** — No competitive-subsidy expansion planned.
10. **Honest metrics** — Do not treat strategy-driven utilization as organic demand.
11. **Sunset airdrops deliberately** — Disable `hasRewards` only after Target APR **and** StrategyBorrowShare gates (see [Migration](#migration-sketch)).

---

## Strategy

### Rules

| Rule | Detail |
|------|--------|
| **One account ↔ one strategy** | Designation = **name + LTV limit** (e.g. **`stg 01 40`**) |
| **One active** | Only the active account receives new rewards / expands |
| **Operators** | DORK manager + DorkLabs; **offline ops** initially |
| **Market scope** | DorkFi competitive pressure: **ALGO A only**. Folks = optional external leg |
| **Primary outcome** | Protocol supply APR → provisional **~2.15%** under stake + carry constraints |
| **Secondary outcome** | Carry / optional Folks supply-rate pressure |

### Active strategy: stake-safe collateral loop (+ optional Folks)

**Intent:** (1) Raise DorkFi ALGO A utilization / **protocol supply APR** toward Target APR via protocol-owned borrows. (2) Optionally place borrowed ALGO on Folks for **net carry** and relative competitiveness. Folks deposits do **not** create DorkFi utilization.

#### Steps

1. **Precondition** — Confirm **E ≥ E_min**, block-reward income observed (or seeded capital explicitly approved), and active account is **`stg 01 40`** (or successor).
2. **Swap** — ALGO → USDC on an **allowlisted** venue (best execution within the allowlist that cycle).
3. **Collateralize** — Deposit USDC into the **native USDC market** (highest CF).
4. **Compute size** — See [Borrow sizing](#borrow-sizing-rate-targeted).
5. **Borrow ALGO A** — If all [gates](#gates) pass, borrow up to the computed size (chunked).
6. **Optional Folks deposit** — If Folks leg enabled and under NAV cap, deposit borrowed ALGO into Folks ALGO **A or D** via **adapter**. Default selection for **carry:** higher Folks supply rate. If compression is the goal instead, select by estimated rate sensitivity (ops policy)—do not assume “higher rate” maximizes compression.
7. **Stop / kill** — See [Stop conditions](#stop-conditions--kill-switches).

```
Block-reward ALGO (E ≥ E_min)
        ↓
Swap ALGO → USDC (allowlisted venue)
        ↓
USDC → native USDC market collateral (highest CF)
        ↓
Borrow ALGO A up to ΔB_allowed (rate target ∩ stake budget ∩ LTV ∩ cap)
        only if NetCarry ≥ 0
        ↓
Optional: Folks ALGO A/D via adapter (exposure-capped)
        ↓
Protocol supply APR → Target; track StrategyBorrowShare
```

#### Designated account list

| Designation | Name | LTV limit | Status | Notes |
|-------------|------|-----------|--------|-------|
| **`stg 01 40`** | `stg 01` | **40%** | First / initial active candidate | Managed by DORK manager and DorkLabs |

#### Collateral form (step 3)

| Field | Value |
|-------|--------|
| **Asset** | **USDC** |
| **Market** | **Native USDC market** |
| **Rationale** | **Highest CF** among USDC collateral options |

#### Folks venue (optional step 6)

| Field | Value |
|-------|--------|
| **Protocol** | **Folks Finance** |
| **Asset** | **ALGO** |
| **Market** | **A or D** |
| **Required for Target APR?** | **No** |
| **Selection (carry policy)** | Prefer **higher supply rate** at deposit time |
| **Integration** | Via **adapter**; **NAV / exposure caps** required |
| **Security** | Adapter + Folks risk reviewed before enabling |

#### Borrow sizing (rate-targeted)

Live inputs (required before scale): ALGO A `S`, `B`, interest curve `r_s(u)`, `r_b(u)`, borrow cap, USDC CF/oracles, account LTV, `Buffer_ALGO`.

```
u = B / S
Find u* such that r_s(u*) = TargetAPR          // curve inversion; live data
ΔB_target = u* · S − B
ΔB_allowed = min(
  ΔB_target,
  BorrowBudget,                 // S − B − 30_000 − Buffer_ALGO
  BorrowCap − B,
  LTV_capacity                  // max ALGO debt at LTV ≤ account limit
)
```

If `ΔB_allowed < ΔB_target`, **Target APR is infeasible** without growing supply or relaxing Buffer/LTV (riskier). **Do not force**—raise S, wait, or accept a lower interim target.

#### Gates

| Gate | Effect if false |
|------|-----------------|
| **E ≥ E_min** / **BorrowBudget &gt; 0** | Do not expand borrow |
| ALGO A **not** at borrow cap | Do not borrow |
| Account **LTV ≤ designated limit** (e.g. 40%) | Do not borrow further |
| **NetCarry ≥ 0** (projected) | Do not expand; incomplete “ALGO borrow &lt; USDC supply” alone is **not** sufficient |
| Folks leg (if used) within **exposure cap** | Skip or reduce Folks deposit |

#### Stop conditions / kill switches

Stop expanding (and consider unwind) if any of:

- Protocol supply APR ≥ Target APR
- `BorrowBudget` below minimum chunk
- NetCarry &lt; 0 (or NAV drawdown beyond ops limit)
- LTV / health-factor breach risk
- Oracle deviation / adapter fault / liquidity stress
- Manual kill by DORK manager / DorkLabs

#### Historical alternatives (not active design)

Rebate / points / generic PoL without Folks were considered as catalog ideas. They are **out of the active design surface** for this proposal (they reintroduce airdrop-style or less controlled paths). Document elsewhere if revisited.

---

## Quantitative framework

All starred (*) items need **live** protocol/market data.

| Symbol | Meaning |
|--------|---------|
| `S`, `B` | ALGO A supply, borrow * |
| `u = B/S` | Utilization |
| `r_s(u)`, `r_b(u)` | Protocol supply / borrow APR from curve * |
| `r_s_USDC` | Native USDC A supply APR * |
| `r_s_Folks` | Folks ALGO A or D supply APR * |
| `E = S − B` | Effective stake |
| `Buffer_ALGO` | Safety buffer above 30k (ops) |
| `c_swap` | ALGO→USDC cost fraction * |
| `B_strat` | Strategy ALGO debt |
| `C_USDC` | Strategy USDC collateral (value) * |

**Net carry (conceptual, per period):**

```
NetCarry ≈ B_strat · (r_s_Folks − r_b_ALGO) + C_USDC · r_s_USDC
           − SwapAmort − Ops/Gas − ExpectedLiqCost − RiskAdders
```

Expand only if projected **NetCarry ≥ 0**. Mark-to-market **NAV** (USDC coll + Folks ALGO − ALGO debt − accrued) must be ledgered; block rewards converted ALGO→USDC change asset mix—they are not free P&amp;L.

**Cost efficiency:**

```
Cost per +0.10 pp protocol supply APR ≈ (NAV consumed or subsidy deployed)
                                        / (10 · Δ protocol_supply_APR_pp)
```

**Target APR rationale (required before scale):** attach peer snapshot (e.g. Folks ALGO supply APR), desired gap, and computed `u*`. Until then **2.15% remains provisional**.

---

## Success metrics

| Metric | Intent |
|--------|--------|
| **Protocol supply APR** | Sustain **≥ Target APR** (~2.15% provisional) without bonus overlay |
| **StrategyBorrowShare** | `B_strategy / B_total` — keep manufactured share visible; sunset gate uses ShareMax (TBD live) |
| **Non-strategy borrow** | Track genuine external demand separately |
| **Effective stake E** | Maintain **E ≥ E_min** continuously while strategy runs |
| **NetCarry / NAV** | Strategy not structurally losing money |
| **LTV / borrow-cap** | Respect `stg 01 40` (40%) and market caps |
| **Folks exposure** (if enabled) | Within NAV caps; optional compression vs baseline |
| **User clarity** | Single primary supply APY (protocol); no bonus line once sunset |
| **Program cost** | Cost per +0.10 pp APR vs prior airdrop cost |
| **Custody hygiene** | Attributable funding; one internal active designation; allowlisted venues |

---

## Migration sketch

1. **Measure baseline** — Protocol supply APR (~1.45%), `S`/`B`/`E`, peer rates, bonus UI state, StrategyBorrowShare (=0).
2. **Restore eligibility** — Bring **E ≥ E_min**; choose Buffer; **observe** block-reward income (or document seed capital). **Do not pilot borrows while ineligible.**
3. **Model** — Invert curve for `u*` / `ΔB_target`; compute `ΔB_allowed`; estimate NetCarry; justify or revise Target APR.
4. **Ops hardening** — Runbook: authorities, venue allowlist, Folks caps, kill switches, NAV ledger.
5. **Pilot** — Fund **`stg 01 40`**; run stake-safe rate-targeted loop; Folks leg off or tightly capped; keep `hasRewards` until gates pass.
6. **UI** — Prefer protocol supply APR as primary; demote bonus while pilot runs.
7. **Sunset `hasRewards`** — Only if Target APR sustained for agreed window **and** StrategyBorrowShare ≤ ShareMax **and** E ≥ E_min.
8. **Rollback** — Re-enable bonus UI / pause strategy if APR collapses after unwind, NetCarry persistently &lt; 0, or StrategyBorrowShare → ~1 with no non-strategy demand.
9. **Frontend cleanup** — After sunset: bonus fetch/badges unused for ALGO A ([bonus interest doc](../development/ALGORAND_A_MARKET_BONUS_INTEREST.md)).

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Borrowing lowers E / kills block rewards** | **BorrowBudget**; E_min = 30k + Buffer; never expand through the floor |
| **Manufactured APR looks like organic demand** | Track StrategyBorrowShare; sunset gates; honest labeling |
| **Incomplete carry → silent NAV loss** | NetCarry + NAV ledger; not USDC-vs-ALGO alone |
| Liquidation (USDC coll / ALGO debt) | LTV ≤ 40% on `stg 01 40`; health-factor monitoring; pause |
| Folks / adapter / SC risk | Optional leg; exposure caps; security review; exit plan |
| Swap slippage / venue risk | **Allowlist**; size limits; best execution within list |
| Target infeasible under stake budget | Accept lower target or grow S; do not punch Buffer/LTV |
| Oracle / rate volatility | Kill on deviation; recompute sizing each cycle |
| Custody / key misuse | Dual control (manager + DorkLabs); logs; spend caps |
| Users expect airdrops | Comms + migration window; rollback path |
| Frontend still markets bonus | Feature-flag off after sunset gates |

---

## Open questions (implementation parameters)

These are **ops/modeling** parameters, not open product scope:

1. Exact **Buffer_ALGO** and **ShareMax** (need live volatility / borrow mix).
2. Formal **Target APR** rationale vs peer snapshot + `u*`.
3. Folks **NAV cap** and whether compression vs carry is the A/D selection objective.
4. Swap **venue allowlist**.
5. When to move which parameters from offline ops to UNIT governance.

---

## Out of scope

- PreFi VOI emissions ([APY Estimation](../prefi/APY_ESTIMATION.md))
- Intrinsic APY on fALGO / tALGO / xALGO
- Non–A-market `hasRewards` programs
- Competitive subsidy beyond **ALGO A** (none planned)
- Non-Algorand / non-ALGO reward streams
- User-facing borrow rebates / points as the active path

---

## Recommendation

Pursue a **stake-safe, rate-targeted, protocol-owned borrow strategy** funded by **Dork Algorand DORK** ALGO block rewards (**E ≥ 30k + Buffer**): active account **`stg 01 40`**, **ALGO→USDC (allowlisted)→native USDC collateral→borrow ALGO A under BorrowBudget + NetCarry**, with **optional capped Folks** recycle. Measure **protocol supply APR** and **StrategyBorrowShare** separately. Treat **~2.15%** as provisional until curve inversion and peer rationale are attached. Sunset `hasRewards` only after APR + share + stake gates; keep rollback. Capital remains **DorkFi Protocol–owned**; day-one control is **offline ops** (DORK manager + DorkLabs).
