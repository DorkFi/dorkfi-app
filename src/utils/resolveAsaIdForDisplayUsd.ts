import {
  asTokenConfig,
  getAllTokensWithDisplayInfo,
  getTokenConfig,
  type NetworkId,
} from "@/config";
import {
  isDisplayUsdNetwork,
  parseAsaIdForDisplay,
} from "@/utils/displayUsdPerToken";

export function collectAlgorandMainnetDisplayAsaIds(): number[] {
  const ids = new Set<number>();
  for (const token of getAllTokensWithDisplayInfo("algorand-mainnet")) {
    const id = parseAsaIdForDisplay(token.underlyingAssetId);
    if (id != null) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Algorand mainnet ASA id for this market only (matched by pool + market contract).
 * Returns null on VOI / other networks so Tinyman ALGO (ASA 0) cannot reprice them.
 */
export function resolveAsaIdForDisplayUsd(args: {
  networkId: string | null | undefined;
  poolId?: string | null;
  marketId?: string | null;
  configKey?: string | null;
  originalSymbol?: string | null;
  displaySymbol?: string | null;
}): number | null {
  const networkId = args.networkId as NetworkId | undefined;
  if (!isDisplayUsdNetwork(networkId)) return null;

  const poolStr =
    args.poolId != null && String(args.poolId).trim() !== ""
      ? String(args.poolId).trim()
      : "";
  const marketStr =
    args.marketId != null && String(args.marketId).trim() !== ""
      ? String(args.marketId).trim()
      : "";

  try {
    const tokens = getAllTokensWithDisplayInfo(networkId);
    const match = tokens.find((t) => {
      if (poolStr && String(t.poolId ?? "") !== poolStr) return false;
      if (marketStr) {
        return String(t.underlyingContractId ?? "") === marketStr;
      }
      const key = args.configKey ?? args.originalSymbol ?? args.displaySymbol;
      if (!key) return false;
      return (
        t.configKey === key ||
        t.originalSymbol === key ||
        t.symbol === key
      );
    });
    const fromDisplay = parseAsaIdForDisplay(match?.underlyingAssetId);
    if (fromDisplay != null) return fromDisplay;
  } catch {
    // unknown network in tests
  }

  const lookupKeys = [
    args.configKey,
    args.originalSymbol,
    args.displaySymbol,
  ].filter((k): k is string => !!k && k.trim() !== "");

  for (const key of lookupKeys) {
    try {
      const raw = getTokenConfig(networkId, key);
      if (!raw) continue;
      if (Array.isArray(raw)) {
        const byMarket =
          marketStr !== ""
            ? raw.find((c) => String(c.contractId ?? "").trim() === marketStr)
            : undefined;
        const row = byMarket ?? asTokenConfig(raw, poolStr || undefined);
        const id = parseAsaIdForDisplay(row?.assetId);
        if (id != null) return id;
      } else {
        const id = parseAsaIdForDisplay(raw.assetId);
        if (id != null) return id;
      }
    } catch {
      continue;
    }
  }

  return null;
}
