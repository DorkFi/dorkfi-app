import {
  ARAMID_CHAIN,
  type AramidChainId,
  type AramidFeeAlternative,
  type AramidMapping,
  type AramidPublicConfig,
  type AramidRoute,
} from "@/lib/aramid/types";

const SUPPORTED = new Set<number>([
  ARAMID_CHAIN.base,
  ARAMID_CHAIN.algorand,
  ARAMID_CHAIN.voi,
]);

export function isAramidChainId(value: number): value is AramidChainId {
  return SUPPORTED.has(value);
}

export function isAvmChain(chainId: AramidChainId): boolean {
  return chainId === ARAMID_CHAIN.algorand || chainId === ARAMID_CHAIN.voi;
}

function pickFee(
  mapping: AramidMapping,
  premium: boolean
): AramidFeeAlternative | null {
  const alts = mapping.feeAlternatives ?? [];
  const matched = alts.find(
    (fee) =>
      fee.ifPremiumTokenUsed === premium &&
      fee.validFrom <= fee.validUntil
  );
  return matched ?? alts.find((fee) => fee.ifPremiumTokenUsed === premium) ?? null;
}

export function listAramidRoutes(
  config: AramidPublicConfig,
  sourceChain: AramidChainId,
  destinationChain: AramidChainId
): AramidRoute[] {
  if (sourceChain === destinationChain) return [];
  const bridgeAddress = config.chains[String(sourceChain)]?.address;
  if (!bridgeAddress) return [];
  const byDest = config.chains2tokens?.[String(sourceChain)]?.[
    String(destinationChain)
  ];
  if (!byDest) return [];

  const routes: AramidRoute[] = [];
  for (const [sourceToken, destinations] of Object.entries(byDest)) {
    const token =
      config.chains[String(sourceChain)]?.tokens?.[sourceToken];
    const premium = Boolean(token?.isPremium);
    for (const mapping of Object.values(destinations)) {
      const fee = pickFee(mapping, premium);
      if (!fee) continue;
      routes.push({
        sourceChain,
        destinationChain,
        sourceToken: mapping.sourceToken || sourceToken,
        destinationToken: mapping.destinationToken,
        sourceSymbol:
          mapping.sourceSymbol || token?.symbol || mapping.sourceName || "Asset",
        destinationSymbol:
          mapping.destinationSymbol || mapping.destinationName || "Asset",
        sourceName:
          mapping.sourceName || token?.name || mapping.sourceSymbol || "Asset",
        destinationName:
          mapping.destinationName || mapping.destinationSymbol || "Asset",
        sourceDecimals: mapping.sourceDecimals,
        destinationDecimals: mapping.destinationDecimals,
        sourcePremium: premium,
        fee,
        bridgeAddress,
      });
    }
  }

  const preferred = ["USDC", "aUSDC", "ETH", "aETH", "ALGO", "aALGO", "VOI", "aVOI", "cbBTC", "WBTC"];
  const wrapped = (name: string) => (/^aramid\b/i.test(name) ? 1 : 0);
  routes.sort((a, b) => {
    const ai = preferred.indexOf(a.sourceSymbol);
    const bi = preferred.indexOf(b.sourceSymbol);
    const ar = ai === -1 ? 100 : ai;
    const br = bi === -1 ? 100 : bi;
    if (ar !== br) return ar - br;
    const wrap =
      wrapped(a.sourceName) - wrapped(b.sourceName) ||
      wrapped(a.destinationName) - wrapped(b.destinationName);
    if (wrap !== 0) return wrap;
    return a.sourceName.localeCompare(b.sourceName);
  });
  return routes;
}

export function routeKey(route: AramidRoute): string {
  return `${route.sourceChain}:${route.sourceToken}:${route.destinationChain}:${route.destinationToken}`;
}
