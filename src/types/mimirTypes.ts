
export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PriceDataPoint {
  timestamp: string;
  price: number;
}

export interface OHLCDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MimirToken {
  name: string;
  symbol: string;
  creator: string;
  deleted: number;
  tokenId: string | null;
  decimals: number;
  imageUrl: string | null;
  verified: number;
  mintRound: number;
  contractId: number;
  globalState: Array<{
    key: string;
    value: string;
  }>;
  totalSupply: string;
}

export interface MimirPriceResponse {
  timestamp: string;
  price: number;
}

export interface MimirOHLCResponse {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TokenPair {
  from: string;
  to: string;
  label: string;
  popular?: boolean;
}

export const MIMIR_BASE_URL = 'https://voi-mainnet-mimirapi.nftnavigator.xyz';

export const TOKEN_MAP: Record<string, string> = {
  'VOI': 'VOI',
  'UNIT': 'UNIT', 
  'USDC': 'aUSDC',
  'BTC': 'WBTC',
  'ETH': 'WETH',
  'ALGO': 'ALGO',
  'POW': 'POW',
  'cbBTC': 'cbBTC',
  'USDT': 'USDT',
  'DAI': 'DAI'
};
