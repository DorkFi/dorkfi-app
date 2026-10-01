/** Exodus XO Swap V3 asset ids (verified via GET /v3/assets). */
export const XO_ASSET_BASE_USDC = "USDCbasemainnetB5A52617";
export const XO_ASSET_ALGORAND_USDC = "USDCALGO";

/** Pair ids for Direct Swaps (fromAsset_toAsset). */
export const XO_PAIR_BASE_TO_ALGO = `${XO_ASSET_BASE_USDC}_${XO_ASSET_ALGORAND_USDC}`;
export const XO_PAIR_ALGO_TO_BASE = `${XO_ASSET_ALGORAND_USDC}_${XO_ASSET_BASE_USDC}`;

export const XO_SWAP_POLL_MS = 5_000;
export const XO_SWAP_MAX_POLLS = 120; // ~10 minutes

/** Known Exodus minimum for a Base → Algorand USDC move, until a live quote returns its own min. */
export const XO_SWAP_MIN_USDC = 10;

export function formatXoSwapMinUsd(minUsdc: number): string {
  const whole =
    Number.isFinite(minUsdc) && Math.abs(minUsdc - Math.round(minUsdc)) < 1e-6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minUsdc);
}
