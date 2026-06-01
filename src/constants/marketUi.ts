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

/** Default red borrow APY badge (main markets). */
export const BORROW_APY_BADGE_DEFAULT =
  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";

/** S-token borrow APY badge when no intrinsic borrow uplift. */
export const BORROW_APY_BADGE_STOKEN =
  "bg-gradient-to-r from-red-100 to-pink-100 text-red-800 dark:from-red-900 dark:to-pink-900 dark:text-red-200 border border-red-300 dark:border-red-600";

/**
 * Borrow APY badge: same silver gradient as deposit intrinsic when
 * `intrinsicBorrowApyPercent` is set and positive; otherwise `fallbackClassName`
 * ({@link BORROW_APY_BADGE_DEFAULT} or {@link BORROW_APY_BADGE_STOKEN}).
 */
export function borrowApyBadgeClassName(
  intrinsicBorrowApyPercent: number | null | undefined,
  fallbackClassName: string
): string {
  if (
    typeof intrinsicBorrowApyPercent === "number" &&
    Number.isFinite(intrinsicBorrowApyPercent) &&
    intrinsicBorrowApyPercent > 0
  ) {
    return DEPOSIT_APY_BADGE_INTRINSIC;
  }
  return fallbackClassName;
}

/** Background classes for A/B/C/D pool letter badges (markets table, portfolio, lists). */
export function marketPoolBadgeBgClassName(
  label: string | null | undefined
): string {
  if (label === "A") return "bg-blue-500 dark:bg-blue-600";
  if (label === "B") return "bg-purple-500 dark:bg-purple-600";
  if (label === "C") return "bg-teal-500 dark:bg-teal-600";
  if (label === "D") return "bg-amber-500 dark:bg-amber-600";
  return "bg-slate-500 dark:bg-slate-600";
}
