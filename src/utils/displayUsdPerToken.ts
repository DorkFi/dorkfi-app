/**
 * Display USD per token: each ASA/market is priced independently.
 * Never copy another wrapper's feed (goBTC ≠ wBTC ≠ fWBTC ≠ BTC).
 */

export const DISPLAY_USD_POLL_MS = 30_000;

/** Tinyman display overlay is Algorand mainnet only (not VOI, not testnet). */
export const DISPLAY_USD_NETWORK_ID = "algorand-mainnet";

export function isDisplayUsdNetwork(
  networkId: string | null | undefined
): boolean {
  return networkId === DISPLAY_USD_NETWORK_ID;
}

export function isPositiveUsd(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Prefer this asset's DEX USD; otherwise this market's own protocol/oracle USD.
 * Does not accept a substitute from a different asset.
 */
export function resolveDisplayUsdPerToken(args: {
  dexUsd?: number | null;
  protocolUsd?: number | null;
}): number {
  if (isPositiveUsd(args.dexUsd)) return args.dexUsd;
  if (isPositiveUsd(args.protocolUsd)) return args.protocolUsd;
  return 0;
}

export function parseAsaIdForDisplay(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function overlayUsdWithDisplayPrice(
  protocolUsdPerToken: number,
  dexUsd: number | undefined | null
): number {
  return resolveDisplayUsdPerToken({
    dexUsd,
    protocolUsd: protocolUsdPerToken,
  });
}

/** Revalue a USD amount when display USD/token differs from protocol USD/token. */
export function scaleUsdAmountWithDisplayPrice(
  protocolUsdAmount: number,
  protocolUsdPerToken: number,
  dexUsd: number | undefined | null
): number {
  if (!Number.isFinite(protocolUsdAmount)) return protocolUsdAmount;
  const next = overlayUsdWithDisplayPrice(protocolUsdPerToken, dexUsd);
  if (!(protocolUsdPerToken > 0) || !(next > 0) || next === protocolUsdPerToken) {
    return protocolUsdAmount;
  }
  return protocolUsdAmount * (next / protocolUsdPerToken);
}
