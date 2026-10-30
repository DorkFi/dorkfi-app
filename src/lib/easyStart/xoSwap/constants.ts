/** Exodus XO Swap V3 asset ids (verified via GET /v3/assets). */
export const XO_ASSET_BASE_USDC = "USDCbasemainnetB5A52617";
export const XO_ASSET_ALGORAND_USDC = "USDCALGO";

/** Pair ids for Direct Swaps (fromAsset_toAsset). */
export const XO_PAIR_BASE_TO_ALGO = `${XO_ASSET_BASE_USDC}_${XO_ASSET_ALGORAND_USDC}`;
export const XO_PAIR_ALGO_TO_BASE = `${XO_ASSET_ALGORAND_USDC}_${XO_ASSET_BASE_USDC}`;

export const XO_SWAP_POLL_MS = 5_000;
export const XO_SWAP_MAX_POLLS = 120; // ~10 minutes
