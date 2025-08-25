// Token image mapping utility
export const getTokenImagePath = (symbol: string): string => {
  // Remove 'a' prefix if present (aVOI → VOI, aUSDC → USDC)
  const cleanSymbol = symbol.startsWith('a') ? symbol.slice(1) : symbol;
  
  const tokenImageMap: Record<string, string> = {
    'VOI': '/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png',
    'UNIT': '/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png', 
    'USDC': '/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png',
    'BTC': '/lovable-uploads/f9832a09-b47e-447e-8a73-ea7404c95728.png',
    'ETH': '/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png'
  };
  
  return tokenImageMap[cleanSymbol] || '/placeholder.svg';
};