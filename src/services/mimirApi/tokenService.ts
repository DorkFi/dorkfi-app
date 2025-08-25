
import { Token, MimirToken, MIMIR_BASE_URL, TOKEN_MAP } from '@/types/mimirTypes';

export class TokenService {
  private static tokenCache: Token[] | null = null;

  static async getTokens(): Promise<Token[]> {
    if (this.tokenCache) {
      return this.tokenCache;
    }

    try {
      const response = await fetch(`${MIMIR_BASE_URL}/tokens`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }
      
      const data: MimirToken[] = await response.json();
      
      this.tokenCache = data.map(token => ({
        id: token.contractId || TOKEN_MAP[token.symbol] || token.symbol,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals
      }));
      
      return this.tokenCache;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return fallback tokens if API fails
      return [
        { id: 'VOI', symbol: 'VOI', name: 'Voi Network', decimals: 6 },
        { id: 'UNIT', symbol: 'UNIT', name: 'Unit Protocol', decimals: 6 },
        { id: 'aUSDC', symbol: 'USDC', name: 'USD Coin', decimals: 6 }
      ];
    }
  }
}
