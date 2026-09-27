/**
 * Algorand A market (Prime) pool app id — rewards visibility is gated by validator excess.
 * @see https://github.com/DorkFi/dorkfi-app/issues/667
 */
export const ALGORAND_A_MARKET_POOL_ID = "3333688282";

/**
 * Minimum available ALGO (supply − borrow) required to show Algorand A market rewards.
 * Matches the on-chain validator stake requirement.
 */
export const ALGORAND_A_REWARDS_MIN_EXCESS_ALGO = 30_000;

/** Available liquidity (excess) in human token units: max(0, supply − borrow). */
export function marketExcess(
  totalSupply: number,
  totalBorrow: number
): number {
  const supply = Number(totalSupply);
  const borrow = Number(totalBorrow);
  if (!Number.isFinite(supply) || !Number.isFinite(borrow)) return 0;
  return Math.max(0, supply - borrow);
}

/** True for Algorand mainnet A (Prime) pool rewards rows. */
export function isAlgorandAMarketRewardsSubject(
  networkId: string | null | undefined,
  poolId: string | number | null | undefined
): boolean {
  if (networkId == null || poolId == null) return false;
  return (
    String(networkId).toLowerCase() === "algorand-mainnet" &&
    String(poolId) === ALGORAND_A_MARKET_POOL_ID
  );
}

/**
 * Effective `hasRewards` for UI: Algorand A market rewards stay hidden until excess
 * reaches {@link ALGORAND_A_REWARDS_MIN_EXCESS_ALGO}. Other markets are unchanged.
 */
export function effectiveHasRewards(options: {
  hasRewards: boolean | undefined;
  networkId: string | null | undefined;
  poolId: string | number | null | undefined;
  totalSupply?: number;
  totalBorrow?: number;
}): boolean {
  if (options.hasRewards !== true) return false;
  if (!isAlgorandAMarketRewardsSubject(options.networkId, options.poolId)) {
    return true;
  }
  const excess = marketExcess(
    options.totalSupply ?? 0,
    options.totalBorrow ?? 0
  );
  return excess >= ALGORAND_A_REWARDS_MIN_EXCESS_ALGO;
}
