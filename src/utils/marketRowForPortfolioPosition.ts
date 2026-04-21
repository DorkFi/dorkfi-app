/**
 * Match a `fetchAllMarkets` / `marketData` row to a portfolio position. The same pool can host
 * multiple markets (e.g. ALGO vs fALGO) that share display symbol "Algo" — prefer `marketId`.
 */
export function marketRowForPortfolioPosition(
  rows: unknown[],
  pos: {
    marketId?: string | null;
    poolId?: string | null;
    /** Legacy fallback when `marketId` is missing on the position */
    displaySymbol?: string | null;
  }
): Record<string, unknown> | undefined {
  if (!Array.isArray(rows)) return undefined;
  const mid = pos.marketId != null ? String(pos.marketId) : "";
  const pid = pos.poolId != null ? String(pos.poolId) : "";
  if (mid !== "" && pid !== "") {
    const hit = rows.find((raw) => {
      const m = raw as {
        marketId?: string | number;
        poolId?: string | number;
        appId?: string | number;
      };
      return (
        String(m.marketId ?? "") === mid &&
        String(m.poolId ?? m.appId ?? "") === pid
      );
    });
    if (hit) return hit as Record<string, unknown>;
  }
  const sym = pos.displaySymbol ?? "";
  if (sym !== "" && pid !== "") {
    const hit = rows.find((raw) => {
      const m = raw as { symbol?: string; poolId?: string | number };
      return m.symbol === sym && String(m.poolId ?? "") === pid;
    });
    if (hit) return hit as Record<string, unknown>;
  }
  return undefined;
}
