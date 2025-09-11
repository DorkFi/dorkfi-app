
import { Token, MimirToken, MIMIR_BASE_URL, TOKEN_MAP } from '@/types/mimirTypes';

export interface TokenBalance {
  contractId: string;
  symbol: string;
  balance: string;
  decimals: number;
}

export class TokenService {
  private static tokenCache: Token[] | null = null;

  static async getBalance(userAddress: string, contractId: string): Promise<TokenBalance | null> {
    try {
      console.log(`Fetching balance for contract ${contractId} and address ${userAddress}`);
      
      // For ARC200 tokens, we need to call the contract's balanceOf method
      // This would typically be done through an Algorand node or indexer
      // For now, we'll simulate this with a mock response
      
      // In a real implementation, you would:
      // 1. Call the ARC200 contract's balanceOf method
      // 2. Parse the response
      // 3. Return the balance in the smallest unit
      
      // Mock implementation for testing
      const mockBalance = Math.floor(Math.random() * 1000000); // Random balance for testing
      
      // Get token info to determine decimals
      const tokens = await this.getTokens();
      const token = tokens.find(t => t.id === contractId);
      
      if (!token) {
        console.warn(`Token with contract ID ${contractId} not found`);
        return null;
      }
      
      const balance: TokenBalance = {
        contractId,
        symbol: token.symbol,
        balance: mockBalance.toString(),
        decimals: token.decimals
      };
      
      console.log(`Balance for ${token.symbol}: ${balance.balance} (${mockBalance / Math.pow(10, token.decimals)} tokens)`);
      
      return balance;
    } catch (error) {
      console.error(`Error fetching balance for contract ${contractId}:`, error);
      return null;
    }
  }

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
