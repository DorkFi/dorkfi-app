// Token image mapping utility
export const getTokenImagePath = (symbol: string): string => {
  // Remove 'a' prefix if present (aVOI → VOI, aUSDC → USDC)
  const cleanSymbol = symbol.startsWith('a') ? symbol.slice(1) : symbol;
  
  const tokenImageMap: Record<string, string> = {
    'VOI': '/lovable-uploads/VOI.png',
    'UNIT': '/lovable-uploads/UNIT.png', 
    'USDC': '/lovable-uploads/aUSDC.png',
    'BTC': '/lovable-uploads/f9832a09-b47e-447e-8a73-ea7404c95728.png',
    'WBTC': '/lovable-uploads/WBTC.jpg',
    'ETH': '/lovable-uploads/ETH.jpg',
    'ALGO': '/lovable-uploads/Algo.webp'
  };
  
  return tokenImageMap[cleanSymbol] || '/placeholder.svg';
};