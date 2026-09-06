/**
 * Resolve a display token row for supply/borrow/withdraw/repay flows.
 * Kept outside SupplyBorrowModal so hover prefetch and Markets can import it
 * without pulling the full modal + signing stack into the critical path.
 */

export type SupplyBorrowTokenRow = {
  symbol: string;
  poolId?: string;
  configKey?: string;
  originalSymbol?: string;
  underlyingContractId?: string;
  /** Config `contractId` when it differs from `underlyingContractId` (display ASA). */
  originalContractId?: string;
  decimals?: number;
};

/**
 * `getAllTokensWithDisplayInfo` sets `configKey` to the `tokens` map key (e.g. `USDC` for every
 * `tokens.USDC[]` row). Prefer `originalSymbol` (`fiUSDC`, `fUSDC`) so getTokenConfig hits
 * the correct row or standalone key.
 */
export function supplyBorrowTokenConfigLookupKey(
  tok: SupplyBorrowTokenRow | null | undefined,
  fallbackAsset: string
): string {
  if (!tok) return fallbackAsset;
  const orig = String(tok.originalSymbol ?? "").trim();
  if (orig !== "") return orig;
  const ck = String(tok.configKey ?? "").trim();
  if (ck !== "") return ck;
  return fallbackAsset;
}

/** When display `asset` + `poolId` match multiple config rows (e.g. Algo vs fALGO), pass the tokens map key from the market row (`configSymbol`). */
export function resolveSupplyBorrowToken<T extends SupplyBorrowTokenRow>(
  tokens: T[],
  asset: string,
  poolId: string | undefined,
  configSymbol: string | undefined,
  marketId?: string | null
): T | undefined {
  const poolOk = (t: T) =>
    poolId == null || poolId === "" || String(t.poolId) === String(poolId);

  // Prefer market contract + pool first (e.g. legacy vs V2 wBTC share `wBTC` + pool id).
  if (marketId != null && marketId !== "" && poolId != null && poolId !== "") {
    const byContract = tokens.find(
      (t) =>
        String(t.underlyingContractId ?? "") === String(marketId) &&
        String(t.poolId ?? "") === String(poolId)
    );
    if (byContract) return byContract;
    const byOriginal = tokens.find(
      (t) =>
        String(t.originalContractId ?? "") === String(marketId) &&
        String(t.poolId ?? "") === String(poolId)
    );
    if (byOriginal) return byOriginal;
  }

  if (configSymbol) {
    const keyHits = tokens.filter(
      (t) =>
        poolOk(t) &&
        (t.configKey === configSymbol ||
          t.originalSymbol === configSymbol ||
          t.symbol === configSymbol)
    );
    if (keyHits.length === 1) return keyHits[0];
    if (keyHits.length > 1 && marketId != null && String(marketId) !== "") {
      const mid = String(marketId);
      const byMid = keyHits.find(
        (t) =>
          String(t.underlyingContractId ?? "") === mid ||
          String(t.originalContractId ?? "") === mid
      );
      if (byMid) return byMid;
    }
    if (keyHits.length > 0) return keyHits[0];
  }

  if (poolId != null && poolId !== "") {
    const poolHits = tokens.filter((t) => t.symbol === asset && poolOk(t));
    if (poolHits.length <= 1) return poolHits[0];
    if (marketId != null && String(marketId) !== "") {
      const mid = String(marketId);
      const byMid = poolHits.find(
        (t) => String(t.underlyingContractId ?? "") === mid
      );
      if (byMid) return byMid;
      const byOrig = poolHits.find(
        (t) => String(t.originalContractId ?? "") === mid
      );
      if (byOrig) return byOrig;
    }
    return poolHits[0];
  }
  return tokens.find((t) => t.symbol === asset);
}
