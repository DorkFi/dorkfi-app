import type { NetworkId, TokenConfig, TokenStandard } from "@/config";

/**
 * Stable identity for one configured savings (supply) market row.
 */
export type EasySavingsMarketRef = {
  configKey: string;
  poolId: string;
  contractId: string;
  nTokenId: string;
  symbol: string;
  decimals: number;
  tokenStandard: TokenStandard;
  logoPath: string;
};

export type SavingsRoute = {
  networkId: NetworkId;
  poolId: string;
  /** A / B / C / D / E / F from {@link getLendingPoolLabel}. */
  marketLabel: string;
  asset: EasySavingsMarketRef;
  assetToken: TokenConfig;
};

export type ResolveSavingsRouteInput = {
  networkId: NetworkId;
  /** Config map key — e.g. `USDC`, `ALGO`, `LP_TMPOOL2_WAD_USDC`. */
  assetConfigKey: string;
  assetContractId?: string;
  assetPoolId?: string;
  /** Prefer a pool where the user already has deposits. */
  preferredPoolIds?: readonly string[];
};
