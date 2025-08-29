// Token image mapping utility
export const getTokenImagePath = (symbol: string): string => {
  // Remove 'a' prefix if present (aVOI → VOI, aUSDC → USDC)
  const cleanSymbol = symbol.startsWith('a') ? symbol.slice(1) : symbol;
  
  const tokenImageMap: Record<string, string> = {
    'VOI': '/lovable-uploads/VOI.png',
    'UNIT': '/lovable-uploads/UNIT.png', 
    'USDC': '/lovable-uploads/aUSDC.png',
    'BTC': '/lovable-uploads/WrappedBTC.png',
    'WBTC': '/lovable-uploads/WrappedBTC.png',
    'cbBTC': '/lovable-uploads/cbBTC.png',
    'ETH': '/lovable-uploads/ETH.jpg',
    'ALGO': '/lovable-uploads/Algo.webp'
  };
  
  return tokenImageMap[cleanSymbol] || '/placeholder.svg';
};