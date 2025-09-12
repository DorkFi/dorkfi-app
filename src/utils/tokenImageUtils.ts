// Token image mapping utility
export const getTokenImagePath = (symbol: string): string => {
  const tokenImageMap: Record<string, string> = {
    VOI: "/lovable-uploads/VOI.png",
    UNIT: "/lovable-uploads/UNIT.png",
    USDC: "/lovable-uploads/USDC.webp",
    BTC: "/lovable-uploads/WrappedBTC.png",
    WBTC: "/lovable-uploads/WrappedBTC.png",
    cbBTC: "/lovable-uploads/cbBTC.png",
    ETH: "/lovable-uploads/ETH.jpg",
    ALGO: "/lovable-uploads/Algo.webp",
    POW: "/lovable-uploads/POW.png",
    aUSDC: "/lovable-uploads/aUSDC.png",
    aETH: "/lovable-uploads/aETH.png",
    aALGO: "/lovable-uploads/aALGO.png",
  };

  // First check for exact match (including prefixed tokens like aUSDC)
  if (tokenImageMap[symbol]) {
    return tokenImageMap[symbol];
  }

  // If no exact match, remove 'a' prefix if present (aVOI → VOI, but aUSDC should already be handled above)
  const cleanSymbol = symbol.startsWith("a") ? symbol.slice(1) : symbol;
  return tokenImageMap[cleanSymbol] || "/placeholder.svg";
};
