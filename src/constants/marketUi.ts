/** Deposit APY badge when the market has a rewards program (`hasRewards`). */
export const DEPOSIT_APY_BADGE_REWARDS =
  "border border-amber-500/50 bg-amber-400 text-black shadow-sm dark:border-amber-400/60 dark:bg-amber-400 dark:text-black";

/** Deposit APY badge when the token has configured intrinsic APY (`intrinsicApyPercent`). */
export const DEPOSIT_APY_BADGE_INTRINSIC =
  "border border-zinc-200/90 bg-gradient-to-b from-zinc-50 via-gray-50 to-zinc-100 text-black shadow-sm dark:border-zinc-300/70 dark:from-zinc-200 dark:via-zinc-100 dark:to-zinc-200 dark:text-black";

/** Default green deposit APY badge. */
export const DEPOSIT_APY_BADGE_DEFAULT =
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";

/** Pick deposit APY badge class: rewards (gold), then intrinsic (silver), else default (green). */
export function depositApyBadgeClassName(
  hasRewards: boolean | undefined,
  intrinsicSupplyApyPercent: number | null | undefined
): string {
  if (hasRewards) return DEPOSIT_APY_BADGE_REWARDS;
  if (
    typeof intrinsicSupplyApyPercent === "number" &&
    Number.isFinite(intrinsicSupplyApyPercent) &&
    intrinsicSupplyApyPercent > 0
  ) {
    return DEPOSIT_APY_BADGE_INTRINSIC;
  }
  return DEPOSIT_APY_BADGE_DEFAULT;
}

/** True when the deposit APY badge is the silver intrinsic style (not rewards gold). */
export function isIntrinsicDepositApyBadge(
  hasRewards: boolean | undefined,
  intrinsicSupplyApyPercent: number | null | undefined
): boolean {
  if (hasRewards) return false;
  return (
    typeof intrinsicSupplyApyPercent === "number" &&
    Number.isFinite(intrinsicSupplyApyPercent) &&
    intrinsicSupplyApyPercent > 0
  );
}
