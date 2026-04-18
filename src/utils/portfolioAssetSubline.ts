/**
 * Whether to show `configSymbol` under the display asset in portfolio supplied/borrow rows.
 * Folks fALGO uses the same display label as ALGO ("Algo"); the extra "fALGO" line is noise.
 */
export function shouldShowConfigSymbolUnderDisplayAsset(
  displayAsset: string,
  configSymbol: string | undefined | null
): boolean {
  if (configSymbol == null || String(configSymbol).trim() === "") {
    return false;
  }
  const a = String(displayAsset).trim().toLowerCase();
  const c = String(configSymbol).trim().toLowerCase();
  if (a === c) return false;
  if (a === "algo" && c === "falgo") return false;
  return true;
}
