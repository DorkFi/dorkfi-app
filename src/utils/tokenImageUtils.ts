// Network logo mapping utility
export const getNetworkLogoPath = (networkId: string): string => {
  const networkLogoMap: Record<string, string> = {
    "voi-mainnet": "/lovable-uploads/VOI.png",
    "voi-testnet": "/lovable-uploads/VOI.png",
    "algorand-mainnet": "/lovable-uploads/Algo.webp",
    "algorand-testnet": "/lovable-uploads/Algo.webp",
  };

  return networkLogoMap[networkId] || "/placeholder.svg";
};

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
    aVOI: "/lovable-uploads/aVOI.webp",
    TINY: "/lovable-uploads/TINY.webp",
    FINITE: "/lovable-uploads/FINITE.webp",
    goETH: "/lovable-uploads/goETH.webp",
    wETH: "/lovable-uploads/wETH.webp",
    goBTC: "/lovable-uploads/goBTC.webp",
    wBTC: "/lovable-uploads/wBTCm.png",
    LINK: "/lovable-uploads/LINK.png",
    SOL: "/lovable-uploads/SOL.png",
    AVAX: "/lovable-uploads/wAVAX.png",
    HAY: "/lovable-uploads/HAY.webp",
    COMPX: "/lovable-uploads/COMPX.webp",
    COOP: "/lovable-uploads/COOP.webp",
    MONKO: "/lovable-uploads/MONKO.webp",
    ALPHA: "/lovable-uploads/ALPHA.webp",
    AKTA: "/lovable-uploads/AKITA.webp",
    BALLSACK: "/lovable-uploads/BALLSACK.webp",
    BRO: "/lovable-uploads/BRO.webp",
    PEPE: "/lovable-uploads/PEPE.webp",
    HOG: "/lovable-uploads/HOG.webp",
    NODE: "/lovable-uploads/NODE.png",
    BUIDL: "/lovable-uploads/BUIDL.png",
    NV: "/lovable-uploads/NV.png",
    bVOI: "/lovable-uploads/bVOI.png",
    SHELLY: "https://asset-verification.nautilus.sh/icons/410111.png",
    AMMO: "https://asset-verification.nautilus.sh/icons/798968.png",
    GM: "https://asset-verification.nautilus.sh/icons/300279.png",
    CORN: "https://asset-verification.nautilus.sh/icons/412682.png",
    F: "https://asset-verification.nautilus.sh/icons/302222.png",
    IAT: "https://asset-verification.nautilus.sh/icons/420024.png",
    FV: "https://asset-verification.nautilus.sh/icons/770561.png",
    SCOUT:
      "https://algorand-wallet-mainnet.b-cdn.net/media/asset_verification_requests_logo_png/2022/06/30/f339b006471443f982e3f5bb22dea3ac.png?width=200&quality=70",
    GOLD$:
      "https://algorand-wallet-mainnet.b-cdn.net/media/assets-logo-png/2023/04/10/a5706bc6e41049a385d80468259ce1f4.png?width=200&quality=70",
  };

  // First check for exact match (including prefixed tokens like aUSDC)
  if (tokenImageMap[symbol]) {
    return tokenImageMap[symbol];
  }

  // If no exact match, remove 'a' prefix if present (aVOI → VOI, but aUSDC should already be handled above)
  const cleanSymbol = symbol.startsWith("a") ? symbol.slice(1) : symbol;
  return tokenImageMap[cleanSymbol] || "/placeholder.svg";
};
