# Proposal: Increase $ALGO A Base Borrow Rate

**Status:** Proposal (not implemented)  
**Scope:** Algorand mainnet A (Prime) ALGO market — base borrow rate only  
**Category:** Interest Rates

## Summary

This proposal recommends increasing the $ALGO A base borrow rate from **0.50%** to **2.45%**, while keeping the existing **8.00%** utilization slope and other market parameters unchanged.

The objective is to increase the supply-side yield available to $ALGO A suppliers while maintaining the existing utilization-based rate curve and keeping the resulting borrow rate below the **5.85%** target ceiling at the current market utilization.

The $ALGO A market has also reached its current borrow cap and is therefore not eligible for additional borrowing or block rewards at this time. This proposal does not increase the borrow cap or otherwise expand borrowing capacity.

---

## Current Market

| Parameter | Current |
|-----------|---------|
| Asset | $ALGO A |
| Collateral Factor | 80% |
| Base Borrow Rate | 0.50% |
| Borrow Rate Slope | 8.00% |
| Utilization | ~42.4% |
| Borrow APR | ~3.96% |
| Supply APR | ~1.45% |
| Supplied | 45,053.238 ALGO |
| Borrowed | 19,474.261 ALGO |
| Borrow Cap | Reached |
| Block Rewards | Currently not eligible |

### Borrow Cap Status

The $ALGO A borrow cap is currently reached. As a result, additional borrowing is constrained and the market is currently not eligible for block rewards.

The proposed change does not modify the borrow cap.

---

## Proposed Change

Change only the base borrow rate:

| Parameter | Current | Proposed |
|-----------|---------|----------|
| Base Borrow Rate | 0.50% | 2.45% |
| Borrow Rate Slope | 8.00% | 8.00% |
| Collateral Factor | 80% | 80% |
| Borrow Cap | Reached | Unchanged |
| Other Parameters | Unchanged | Unchanged |

---

## Expected Impact

At approximately 42.4% utilization, the proposed rate curve would produce:

```
2.45% + (8.00% × 42.4%) ≈ 5.84%
```

This keeps the borrow APR just below the 5.85% target ceiling.

Based on the current relationship between borrow and supply rates, the corresponding supply APR is estimated to increase from approximately **1.45%** to **~2.14%**.

| Metric | Current | Proposed |
|--------|---------|----------|
| Borrow APR | ~3.96% | ~5.84% |
| Supply APR | ~1.45% | ~2.14% |
| Base Borrow Rate | 0.50% | 2.45% |
| Borrow Rate Slope | 8.00% | 8.00% |
| Utilization | ~42.4% | ~42.4%\* |

\*Illustrative calculation assuming utilization remains at the current level.

---

## Rationale

The proposed change increases the baseline cost of borrowing $ALGO A without modifying the utilization slope, collateral factor, or borrow cap.

The market is currently at its borrow cap and is not eligible for block rewards. The proposal therefore does not seek to increase borrowing capacity. Instead, it adjusts the market's rate economics while retaining the existing risk parameters.

The change is intended to:

1. **Increase supplier yield** — The higher base borrow rate increases the interest earned by $ALGO A suppliers at the current utilization level.
2. **Maintain the existing utilization slope** — The 8.00% slope remains unchanged, preserving the market's existing sensitivity to utilization.
3. **Preserve collateral parameters** — The collateral factor remains at 80%, so the proposal does not change the amount of borrowing supported by $ALGO A collateral.
4. **Maintain the existing borrow cap** — The borrow cap remains unchanged. The proposal does not expand the amount of $ALGO A that can be borrowed.
5. **Remain below the borrow-rate ceiling** — At approximately 42.4% utilization, the proposed parameters produce an estimated borrow APR of approximately 5.84%, remaining below the 5.85% target ceiling.

---

## Market Impact

The proposed change shifts the entire borrow-rate curve upward by **1.95 percentage points** while leaving the slope unchanged.

| Utilization | Current Borrow APR | Proposed Borrow APR |
|-------------|--------------------|---------------------|
| 0% | 0.50% | 2.45% |
| 25% | 2.50% | 4.45% |
| 42.4% | ~3.89% | ~5.84% |
| 50% | 4.50% | 6.45% |
| 75% | 6.50% | 8.45% |
| 100% | 8.50% | 10.45% |

The proposal therefore has its largest effect at lower and moderate utilization levels. At higher utilization, the unchanged 8.00% slope continues to determine the incremental increase in borrowing costs.

---

## Block Rewards and Borrow Cap

The $ALGO A market is currently at its borrow cap and is not eligible for block rewards.

This proposal does not request an increase to the borrow cap.

The proposed rate adjustment can therefore be evaluated independently of any expansion of borrowing capacity. If the borrow cap or block-reward eligibility is changed in the future, those changes can be evaluated separately based on the market's utilization, liquidity, and risk profile.

---

## Risk Considerations

The primary effect of this change is an increase in the cost of borrowing $ALGO A.

Because the borrow cap is currently reached, the immediate objective of this proposal is not to facilitate additional borrowing. Rather, the adjustment is intended to improve supply-side yield and adjust market incentives while the existing borrowing constraint remains in place.

The proposal does not change:

- Collateral factor
- Liquidation parameters
- Utilization slope
- Borrow cap
- Collateral requirements
- Other $ALGO A market parameters

Borrowers should therefore expect higher interest costs following implementation.

The higher borrowing cost may also affect utilization as borrowers respond to the changed economics. A reduction in borrowing could lower utilization and consequently reduce the realized borrow and supply rates from the values shown above.

---

## Monitoring

Following implementation, the following metrics should be monitored:

- $ALGO A utilization
- Total $ALGO A supplied
- Total $ALGO A borrowed
- Borrow APR
- Supply APR
- Available liquidity
- Borrower activity
- Liquidation activity
- Borrow-cap utilization
- Block-reward eligibility

Particular attention should be paid to changes in utilization following the rate adjustment. If utilization changes materially, the resulting borrow and supply APRs should be reassessed using the updated utilization.

---

## Implementation

Update the $ALGO A market's base borrow rate:

**0.50% → 2.45%**

No other $ALGO A market parameters are proposed to change.

---

## Requested Action

Approve the increase of the $ALGO A base borrow rate from **0.50%** to **2.45%**, with all other $ALGO A market parameters remaining unchanged.

---

## Governance Platform Post

Use the following when creating the on-platform proposal. Limits: **title ≤ 32 characters**, **description ≤ 512 characters**.

### Instructions

1. Open Governance Admin → **Create proposal**.
2. Select category **Interest Rates**.
3. Paste the **Title** and **Description** below exactly (character counts verified).
4. Link or attach this document (`docs/proposals/INCREASE_ALGO_A_BASE_BORROW_RATE.md`) in discussion channels as the full proposal body — the on-chain description is a summary only.
5. Set voting window and submit; after activation, share the proposal link with UNIT holders.

### Title (29 / 32)

```
Raise ALGO A Base Borrow Rate
```

### Description (449 / 512)

```
Increase $ALGO A base borrow rate from 0.50% to 2.45%. Borrow rate slope stays 8.00%; collateral factor (80%) and borrow cap unchanged. At ~42.4% utilization, estimated borrow APR rises to ~5.84% (below the 5.85% ceiling) and supply APR from ~1.45% to ~2.14%. Market borrow cap is currently reached; this proposal does not expand borrowing capacity or change other $ALGO A parameters. Full details: docs/proposals/INCREASE_ALGO_A_BASE_BORROW_RATE.md
```
