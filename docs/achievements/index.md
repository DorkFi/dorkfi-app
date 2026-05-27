# Achievements documentation

Guides for **DorkFi achievements** in this repository: what they are in the app, how wallet data is loaded, and how to update catalogs and distribution data. Add new achievement-specific docs here.

| Document | Summary |
|----------|---------|
| [Achievements guide](ACHIEVEMENTS.md) | User-facing overview, achievement families and tiers, JSON data format, TYPE mapping, portfolio UI, images, and developer maintenance. |

Related code:

- Catalog and copy: `src/data/achievementsCatalog.ts`
- JSON loader and mapping: `src/data/userAchievements.ts`
- Wallet data: `public/achievements/dorkfi-achievements.json`
- Portfolio UI: `src/components/portfolio/AchievementsCompactTrigger.tsx`, `AchievementsModal.tsx`
- Hook: `src/hooks/useUserAchievements.ts`
