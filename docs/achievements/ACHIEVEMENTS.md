# Achievements

## Overview

Achievements recognize contributions on DorkFi (PreFi participation, investments, beta testing, competitions, governance, and more). In the PreFi frontend they appear on the **Portfolio** page as a preview: users can see which badges they qualify for and at which tier (**gold**, **silver**, or **bronze**).

Achievements are **per wallet**. Only the **highest tier earned per category** is shown when multiple tier entries exist for the same family.

The app is in **preview** mode: badges are displayed in the UI, but on-chain soulbound NFT distribution is described as coming later (“Achievements will appear on your profile after distribution”).

## Table of contents

1. [Where users see achievements](#where-users-see-achievements)
2. [Achievement families](#achievement-families)
3. [Tiers](#tiers)
4. [Wallet data (`dorkfi-achievements.json`)](#wallet-data-dorkfi-achievementsjson)
5. [TYPE → catalog mapping](#type--catalog-mapping)
6. [Updating who has achievements](#updating-who-has-achievements)
7. [Badge images](#badge-images)
8. [Portfolio vs full catalog](#portfolio-vs-full-catalog)
9. [Developer reference](#developer-reference)
10. [Tests](#tests)

## Where users see achievements

On **Portfolio → Portfolio Health**:

1. Health factor / position overview card  
2. **Achievements** compact row (earned count, e.g. `3/5`) — tap to open the modal  
3. NFT holder rewards (claim) sections, when applicable  

The achievements block sits **above** NFT holder rewards claim UI.

The modal lists each visible family with earned tier artwork or a locked bronze silhouette, plus a **Learn more** link (external docs URL in code; see `ACHIEVEMENT_DOCS_URL` in `achievementsCatalog.ts`).

## Achievement families

Display metadata (titles, descriptions, tier labels) lives in `src/data/achievementsCatalog.ts`. Families and typical unlock criteria:

| Catalog id | Title | JSON `TYPE` | Notes |
|------------|-------|-------------|--------|
| `prefi-degen` | Day One PreFi Degen | `day-one` | PreFi launch participation (time-based tiers) |
| `dork-labs-investor` | Dork Labs Investor | `investor` | Investment in Dork Labs Inc. |
| `dork-fighter` | Dork Fighter | `fighter` | Dork Rxelms character donations |
| `bug-beta-grinder` | Bug and Beta Grinder | `bug-beta` | Beta / bug bounty contribution |
| `hula-looper` | Hula Looper | `hula-loop` | Limited edition; Teach Me How to DeFi competition |
| `vote-first` | First Vote | `vote-first` | First governance vote (**hidden in portfolio UI** for now) |

Tier labels (e.g. “First 6.9 hours” for PreFi gold) are defined per family in the catalog, not in the JSON file.

## Tiers

- **Values:** `gold`, `silver`, `bronze` (JSON field `LEVEL`, case-insensitive).  
- **Order:** gold is best, then silver, then bronze (`ACHIEVEMENT_TIER_ORDER` in the catalog).  
- **One badge per family:** If the JSON lists multiple entries for the same `TYPE`, the loader keeps only the best tier (`entriesToUserAchievements` in `userAchievements.ts`).

## Wallet data (`dorkfi-achievements.json`)

**Path:** `public/achievements/dorkfi-achievements.json`  
**Served at:** `/achievements/dorkfi-achievements.json`

### Schema

Top-level object: keys are **Algorand addresses** (uppercase, 58 characters). Values are arrays of entries:

```json
{
  "F7MDLV3KL6OE7EZDG5HCIWDS2NEYKAOJWUTIFUCETGOLKXXRJ2VQW7WJAE": [
    { "LEVEL": "gold", "TYPE": "day-one" },
    { "LEVEL": "gold", "TYPE": "bug-beta" },
    { "LEVEL": "gold", "TYPE": "vote-first" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `LEVEL` | Yes | Tier: `gold`, `silver`, or `bronze` |
| `TYPE` | Yes | Backend slug; see [TYPE → catalog mapping](#type--catalog-mapping) |

Addresses in the file should match how wallets are normalized in the app: **trimmed and uppercased** (`normalizeAchievementAddress`).

Unknown `TYPE` values or invalid `LEVEL` values are **skipped** (no error surfaced to the user; that entry is ignored).

### Loading behavior

- Fetched once per page load via `fetch` and cached in memory (`loadDorkfiAchievementsByAddress`).  
- React Query key: `["user-achievements", address]` (`useUserAchievements`), 5-minute stale time.  
- Wallets not in the JSON receive an empty earned set (all families show as locked in the modal).

## TYPE → catalog mapping

Defined in `DORKFI_ACHIEVEMENT_TYPE_TO_FAMILY` (`src/data/userAchievements.ts`):

| JSON `TYPE` | Catalog `AchievementFamilyId` |
|-------------|-------------------------------|
| `day-one` | `prefi-degen` |
| `investor` | `dork-labs-investor` |
| `fighter` | `dork-fighter` |
| `bug-beta` | `bug-beta-grinder` |
| `hula-loop` | `hula-looper` |
| `vote-first` | `vote-first` |

When adding a new achievement family:

1. Add the family to `achievementsCatalog.ts` (id, copy, tier labels).  
2. Add PNGs under `public/achievements/<family-id>/` (see [Badge images](#badge-images)).  
3. Extend `DORKFI_ACHIEVEMENT_TYPE_TO_FAMILY` with the new `TYPE` slug.  
4. Include wallets in `dorkfi-achievements.json` using that `TYPE`.  
5. If it should appear on Portfolio, ensure it is not filtered out of `PORTFOLIO_ACHIEVEMENT_FAMILIES`.

## Updating who has achievements

1. Edit `public/achievements/dorkfi-achievements.json` (add/update/remove address keys or entries).  
2. Deploy the frontend build so the static file is published.  
3. Users may need a refresh; cached JSON persists until reload (in-memory singleton on the client).

No redeploy is required for catalog **copy** changes in `achievementsCatalog.ts` beyond the normal app release. Data-only updates can ship by updating the JSON asset on deploy.

**Do not** commit private keys or unrelated secrets in this file; it should only contain public addresses and achievement metadata.

## Badge images

Expected paths (see `tierImage()` in the catalog):

```text
public/achievements/<family-id>/gold.png
public/achievements/<family-id>/silver.png
public/achievements/<family-id>/bronze.png
```

Served as `/achievements/<family-id>/<tier>.png`.

Locked (unearned) cards use the family’s **bronze** image as a silhouette in the UI.

Other static assets:

- `public/achievements/whale-icon-mask.png` — whale icon mask used in portfolio achievement chrome.

## Portfolio vs full catalog

- **`ACHIEVEMENT_FAMILIES`** — full list used for catalog metadata and TYPE mapping.  
- **`PORTFOLIO_ACHIEVEMENT_FAMILIES`** — subset shown in Portfolio UI and counted in `X/5` (currently **excludes `vote-first`** until product is ready to ship).

Earned `vote-first` data may still exist in JSON and in `UserAchievements` after load; it is simply not rendered in the portfolio modal or compact trigger.

To enable **First Vote** in Portfolio, remove the filter in `PORTFOLIO_ACHIEVEMENT_FAMILIES` in `achievementsCatalog.ts` (or stop excluding `vote-first`).

## Developer reference

| Piece | Location |
|-------|----------|
| Family definitions | `src/data/achievementsCatalog.ts` |
| JSON load + parse | `src/data/userAchievements.ts` |
| React Query hook | `src/hooks/useUserAchievements.ts` |
| Display helpers | `src/utils/achievementsDisplay.ts` |
| Compact row + modal | `src/components/portfolio/AchievementsCompactTrigger.tsx`, `AchievementsModal.tsx` |
| Badge component | `src/components/portfolio/AchievementBadge.tsx` |
| Portfolio placement | `src/components/Portfolio.tsx` (block below health card, above rewards) |

**Removed:** `src/data/mockUserAchievements.ts` (dev presets). All environments use the JSON file.

**Future options** (not implemented): live API or indexer instead of static JSON; on-chain reads; publishing user-facing copy at `https://docs.dork.fi/achievements`.

## Tests

- `src/data/__tests__/userAchievements.test.ts` — address normalization, TYPE/LEVEL mapping, best-tier selection.  
- `src/utils/__tests__/achievementsDisplay.test.ts` — locked vs earned display, earn count helper.

Run:

```bash
npm run test -- src/data/__tests__/userAchievements.test.ts src/utils/__tests__/achievementsDisplay.test.ts
```
