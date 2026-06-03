import type { NetworkId } from "@/config";
import {
  findCuratedLiquidityPairByLpConfigSymbol,
  findCuratedLiquidityPairByLpTokenId,
} from "@/constants/liquidityPools";
import { resolveLiquidityPairDisplay } from "@/services/tinymanLiquidityService";

export type LpTokenPairIcons = {
  asset1Icon: string;
  asset2Icon: string;
};

/** Resolve underlying asset icons for a Tinyman LP lending token. */
export function resolveLpTokenPairIcons(
  networkId: NetworkId,
  options: {
    configSymbol?: string;
    lpTokenId?: number | string;
  }
): LpTokenPairIcons | null {
  const pair =
    (options.configSymbol
      ? findCuratedLiquidityPairByLpConfigSymbol(
          networkId,
          options.configSymbol
        )
      : undefined) ??
    (options.lpTokenId != null
      ? findCuratedLiquidityPairByLpTokenId(networkId, options.lpTokenId)
      : undefined);

  if (!pair) return null;

  const display = resolveLiquidityPairDisplay(pair);
  if (!display.asset1Icon || !display.asset2Icon) return null;

  return {
    asset1Icon: display.asset1Icon,
    asset2Icon: display.asset2Icon,
  };
}

export function isLpConfigSymbol(configSymbol?: string): boolean {
  return !!configSymbol?.startsWith("LP_");
}
