# Adding a New Governance Proposal Category

This document describes how to add a new proposal category to the frontend so it appears in the Admin UI, proposal cards, and anywhere categories are resolved from contract IDs.

**Prerequisites:** The governance contract must already support the new category ID (value and ID are defined on-chain). This guide only covers frontend wiring.

---

## 1. Update the type (`src/types/governanceTypes.ts`)

Add the new category to the `ProposalCategory` union. Use a **kebab-case** value (e.g. `"my-category"`); this is the canonical key used everywhere.

```ts
export type ProposalCategory =
  | "general"
  | "interest-rates"
  // ... existing ...
  | "my-category";  // add your new category
```

---

## 2. Update constants (`src/constants/governanceConstants.ts`)

Update **three** objects so the new category is fully wired.

### 2.1 `PROPOSAL_CATEGORY_IDS`

Maps category key → numeric ID used by the contract.

```ts
export const PROPOSAL_CATEGORY_IDS: Record<ProposalCategory, number> = {
  // ... existing ...
  "my-category": 8,  // next unused ID
};
```

### 2.2 `CATEGORY_ID_TO_CATEGORY`

Reverse map: contract ID → category key. Required for decoding proposals from the chain.

```ts
export const CATEGORY_ID_TO_CATEGORY: Record<number, ProposalCategory> = {
  // ... existing ...
  8: "my-category",
};
```

### 2.3 `PROPOSAL_CATEGORY_DISPLAY_NAMES`

Human-readable label for Admin UI and proposal cards.

```ts
export const PROPOSAL_CATEGORY_DISPLAY_NAMES: Record<ProposalCategory, string> = {
  // ... existing ...
  "my-category": "My Category",
};
```

---

## 3. Add badge color (`src/components/governance/ProposalCard.tsx`)

Add an entry to `categoryColors` so the proposal card badge has a distinct style. Use Tailwind classes (e.g. `bg-*-500/10 text-*-600 dark:text-*-400`).

```ts
const categoryColors: Record<string, string> = {
  // ... existing ...
  "my-category": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};
```

If you add a category that is not yet in `categoryColors`, the badge may fall back to a default or show nothing; keeping this object in sync avoids that.

---

## 4. No changes required in these places

- **Admin category dropdown** – Options are built from `PROPOSAL_CATEGORY_DISPLAY_NAMES`, so the new category appears automatically.
- **Proposal detail (Admin)** – Uses `getCategoryFromId` and `PROPOSAL_CATEGORY_DISPLAY_NAMES`, so it will show the new display name once the constants are updated.
- **Governance service** – `createProposalWithCategory` uses `getCategoryId()` from the constants; no change needed there.

---

## 5. Optional: Update user-facing docs

- **`docs/GOVERNANCE_USER_GUIDE.md`** – In the [Proposal Categories](#proposal-categories) section, add a short subsection for the new category (what it’s for, example proposals).
- **Contract / backend** – Ensure the governance contract and any backend or indexer use the same category ID for the new type.

---

## Checklist

- [ ] `ProposalCategory` in `src/types/governanceTypes.ts`
- [ ] `PROPOSAL_CATEGORY_IDS` in `src/constants/governanceConstants.ts`
- [ ] `CATEGORY_ID_TO_CATEGORY` in `src/constants/governanceConstants.ts`
- [ ] `PROPOSAL_CATEGORY_DISPLAY_NAMES` in `src/constants/governanceConstants.ts`
- [ ] `categoryColors` in `src/components/governance/ProposalCard.tsx`
- [ ] Governance contract supports the new category ID (if applicable)
- [ ] Optional: `docs/GOVERNANCE_USER_GUIDE.md` updated

---

## Current categories (reference)

| Value (key)     | ID | Display name        |
|-----------------|----|---------------------|
| interest-rates  | 1  | Interest Rates      |
| collateral-listing | 2 | Collateral Listing  |
| liquidation-settings | 3 | Liquidation Settings |
| treasury        | 4  | Treasury            |
| features        | 5  | Features            |
| governance      | 6  | Governance          |
| infrastructure  | 7  | Infrastructure      |

When adding a new category, use the next unused ID (e.g. 8) unless the contract defines a different one.
