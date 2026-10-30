/** Aramid chain ids used by the bridge note and Base lock call. */
export const ARAMID_CHAIN = {
  base: 8453,
  algorand: 416001,
  voi: 416101,
} as const;

export type AramidChainId =
  (typeof ARAMID_CHAIN)[keyof typeof ARAMID_CHAIN];

export type AramidChainKey = keyof typeof ARAMID_CHAIN;

export const ARAMID_CHAIN_LABEL: Record<AramidChainId, string> = {
  [ARAMID_CHAIN.base]: "Base",
  [ARAMID_CHAIN.algorand]: "Algorand",
  [ARAMID_CHAIN.voi]: "Voi",
};

export const NATIVE_ETH_TOKEN =
  "0x0000000000000000000000000000000000000000";

export type AramidFeeAlternative = {
  validFrom: number;
  validUntil: number;
  minimumAmount: string;
  maximumAmount: string;
  sourceConst: number;
  sourcePercent: number;
  destinationConst: number;
  destinationPercent: number;
  ifPremiumTokenUsed: boolean;
};

export type AramidMapping = {
  sourceChain: number;
  sourceToken: string;
  sourceName?: string;
  sourceSymbol?: string;
  sourceDecimals: number;
  sourceType?: string;
  destinationChain: number;
  destinationToken: string;
  destinationName?: string;
  destinationSymbol?: string;
  destinationDecimals: number;
  destinationType?: string;
  feeAlternatives: AramidFeeAlternative[];
};

export type AramidToken = {
  tokenId: string;
  name?: string;
  symbol?: string;
  decimals: number;
  chainId: number;
  type?: string;
  isPremium?: boolean;
};

export type AramidChainConfig = {
  chainId: number;
  name?: string;
  type?: string;
  address: string;
  tokens?: Record<string, AramidToken>;
};

export type AramidPublicConfig = {
  addresses?: { claims?: string };
  chains: Record<string, AramidChainConfig>;
  chains2tokens: Record<
    string,
    Record<string, Record<string, Record<string, AramidMapping>>>
  >;
};

export type AramidRoute = {
  sourceChain: AramidChainId;
  destinationChain: AramidChainId;
  sourceToken: string;
  destinationToken: string;
  sourceSymbol: string;
  destinationSymbol: string;
  sourceName: string;
  destinationName: string;
  sourceDecimals: number;
  destinationDecimals: number;
  sourcePremium: boolean;
  fee: AramidFeeAlternative;
  bridgeAddress: string;
};

export type AramidAmounts = {
  /** Gross amount debited on the source chain, base units. */
  totalAmount: string;
  feeAmount: string;
  /** Net amount locked after the fee, source base units. */
  sourceAmount: string;
  /** Amount the destination release should pay, destination base units. */
  destinationAmount: string;
};

export type AramidClaimData = {
  maxClaimRound: number | string;
  sourceTransactionId: string;
  sourceChainData: {
    chainId: number;
    tokenId: string;
    amount: string;
    addressId: string;
  };
  destinationChainData: {
    chainId: number;
    tokenId: string;
    amount: string;
    addressId: string;
  };
  note?: string;
  signatures: string[];
};
