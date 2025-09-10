
import { Token, MimirToken, MIMIR_BASE_URL, TOKEN_MAP } from '@/types/mimirTypes';

export class TokenService {
  private static tokenCache: Token[] | null = null;

  static async getTokens(): Promise<Token[]> {
    if (this.tokenCache) {
      return this.tokenCache;
    }

    try {
      console.log('Fetching tokens from:', `${MIMIR_BASE_URL}/arc200/tokens`);
      const response = await fetch(`${MIMIR_BASE_URL}/arc200/tokens`);
      
      if (!response.ok) {
        console.warn(`Mimir API returned ${response.status}: ${response.statusText}`);
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }
      
      const data: { tokens: MimirToken[] } = await response.json();
      console.log('Received tokens from API:', data.tokens.length, 'tokens');
      
      this.tokenCache = data.tokens
        .filter(token => token.deleted === 0) // Only include non-deleted tokens
        .map(token => ({
          id: token.contractId.toString(),
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals
        }));
      
      return this.tokenCache;
    } catch (error) {
      console.error('Error fetching tokens from Mimir API:', error);
      console.log('Falling back to hardcoded tokens');
      
      // Return expanded fallback tokens if API fails
      return [
        { id: 'VOI', symbol: 'VOI', name: 'Voi Network', decimals: 6 },
        { id: 'UNIT', symbol: 'UNIT', name: 'Unit Protocol', decimals: 6 },
        { id: 'aUSDC', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { id: 'WBTC', symbol: 'BTC', name: 'Wrapped Bitcoin', decimals: 8 },
        { id: 'WETH', symbol: 'ETH', name: 'Wrapped Ethereum', decimals: 18 },
        { id: 'ALGO', symbol: 'ALGO', name: 'Algorand', decimals: 6 },
        { id: 'POW', symbol: 'POW', name: 'POW Token', decimals: 6 },
        { id: 'cbBTC', symbol: 'cbBTC', name: 'Coinbase Bitcoin', decimals: 8 },
        { id: 'USDT', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
        { id: 'DAI', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 }
      ];
    }
  }
}
