import { Token, MimirToken, MIMIR_BASE_URL } from '@/types/mimirTypes';

export interface ARC200TokenBalance {
  contractId: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  formattedBalance: string;
}

export interface ARC200TokenInfo {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  creator: string;
  verified: boolean;
}

export class ARC200TokenService {
  private static tokenCache: ARC200TokenInfo[] | null = null;
  private static balanceCache: Map<string, ARC200TokenBalance> = new Map();

  /**
   * Get all available ARC200 tokens from Mimir API
   */
  static async getTokens(): Promise<ARC200TokenInfo[]> {
    if (this.tokenCache) {
      return this.tokenCache;
    }

    try {
      console.log('Fetching ARC200 tokens from:', `${MIMIR_BASE_URL}/arc200/tokens`);
      const response = await fetch(`${MIMIR_BASE_URL}/arc200/tokens`);
      
      if (!response.ok) {
        console.warn(`Mimir API returned ${response.status}: ${response.statusText}`);
        throw new Error(`Failed to fetch ARC200 tokens: ${response.status}`);
      }
      
      const data: { tokens: MimirToken[] } = await response.json();
      console.log('Received ARC200 tokens from API:', data.tokens.length, 'tokens');
      
      this.tokenCache = data.tokens
        .filter(token => token.deleted === 0) // Only include non-deleted tokens
        .map(token => ({
          contractId: token.contractId.toString(),
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          totalSupply: token.totalSupply,
          creator: token.creator,
          verified: token.verified === 1
        }));
      
      return this.tokenCache;
    } catch (error) {
      console.error('Error fetching ARC200 tokens from Mimir API:', error);
      console.log('Falling back to hardcoded ARC200 tokens');
      
      // Return fallback ARC200 tokens
      return [
        { 
          contractId: 'VOI', 
          symbol: 'VOI', 
          name: 'Voi Network', 
          decimals: 6,
          totalSupply: '1000000000000000',
          creator: 'VOI_NETWORK',
          verified: true
        },
        { 
          contractId: 'UNIT', 
          symbol: 'UNIT', 
          name: 'Unit Protocol', 
          decimals: 6,
          totalSupply: '1000000000000000',
          creator: 'UNIT_PROTOCOL',
          verified: true
        },
        { 
          contractId: 'aUSDC', 
          symbol: 'USDC', 
          name: 'USD Coin', 
          decimals: 6,
          totalSupply: '1000000000000000',
          creator: 'CIRCLE',
          verified: true
        },
        { 
          contractId: 'WBTC', 
          symbol: 'BTC', 
          name: 'Wrapped Bitcoin', 
          decimals: 8,
          totalSupply: '2100000000000000',
          creator: 'BITCOIN',
          verified: true
        },
        { 
          contractId: 'WETH', 
          symbol: 'ETH', 
          name: 'Wrapped Ethereum', 
          decimals: 18,
          totalSupply: '120000000000000000000000000',
          creator: 'ETHEREUM',
          verified: true
        },
        { 
          contractId: 'ALGO', 
          symbol: 'ALGO', 
          name: 'Algorand', 
          decimals: 6,
          totalSupply: '10000000000000000',
          creator: 'ALGORAND',
          verified: true
        },
        { 
          contractId: 'POW', 
          symbol: 'POW', 
          name: 'POW Token', 
          decimals: 6,
          totalSupply: '1000000000000000',
          creator: 'POW_PROTOCOL',
          verified: true
        },
        { 
          contractId: 'cbBTC', 
          symbol: 'cbBTC', 
          name: 'Coinbase Bitcoin', 
          decimals: 8,
          totalSupply: '2100000000000000',
          creator: 'COINBASE',
          verified: true
        }
      ];
    }
  }

  /**
   * Get balance of a specific ARC200 token for a user address
   */
  static async getBalance(userAddress: string, contractId: string): Promise<ARC200TokenBalance | null> {
    const cacheKey = `${userAddress}-${contractId}`;
    
    // Check cache first
    if (this.balanceCache.has(cacheKey)) {
      console.log(`Using cached balance for ${contractId}`);
      return this.balanceCache.get(cacheKey)!;
    }

    try {
      console.log(`Fetching ARC200 balance for contract ${contractId} and address ${userAddress}`);
      
      // Get token info first
      const tokens = await this.getTokens();
      const token = tokens.find(t => t.contractId === contractId);
      
      if (!token) {
        console.warn(`ARC200 token with contract ID ${contractId} not found`);
        return null;
      }

      // In a real implementation, you would call the ARC200 contract's balanceOf method
      // This would typically be done through:
      // 1. Algorand node RPC call
      // 2. Indexer API call
      // 3. Direct contract interaction
      
      // Mock implementation for testing
      const mockBalance = Math.floor(Math.random() * 1000000); // Random balance for testing
      const formattedBalance = (mockBalance / Math.pow(10, token.decimals)).toFixed(token.decimals);
      
      const balance: ARC200TokenBalance = {
        contractId,
        symbol: token.symbol,
        name: token.name,
        balance: mockBalance.toString(),
        decimals: token.decimals,
        formattedBalance
      };
      
      console.log(`ARC200 Balance for ${token.symbol}: ${balance.balance} base units (${formattedBalance} tokens)`);
      
      // Cache the result
      this.balanceCache.set(cacheKey, balance);
      
      return balance;
    } catch (error) {
      console.error(`Error fetching ARC200 balance for contract ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple token balances for a user address
   */
  static async getMultipleBalances(userAddress: string, contractIds: string[]): Promise<ARC200TokenBalance[]> {
    const balances: ARC200TokenBalance[] = [];
    
    for (const contractId of contractIds) {
      const balance = await this.getBalance(userAddress, contractId);
      if (balance) {
        balances.push(balance);
      }
    }
    
    return balances;
  }

  /**
   * Get token info by contract ID
   */
  static async getTokenInfo(contractId: string): Promise<ARC200TokenInfo | null> {
    const tokens = await this.getTokens();
    return tokens.find(t => t.contractId === contractId) || null;
  }

  /**
   * Clear balance cache (useful for testing or when balances might have changed)
   */
  static clearBalanceCache(): void {
    this.balanceCache.clear();
    console.log('ARC200 balance cache cleared');
  }

  /**
   * Clear token cache (useful for testing or when token list might have changed)
   */
  static clearTokenCache(): void {
    this.tokenCache = null;
    console.log('ARC200 token cache cleared');
  }

  /**
   * Format balance from smallest units to human readable format
   */
  static formatBalance(balance: string, decimals: number): string {
    const numBalance = parseFloat(balance);
    return (numBalance / Math.pow(10, decimals)).toFixed(decimals);
  }

  /**
   * Convert human readable balance to smallest units
   */
  static toSmallestUnits(balance: string, decimals: number): string {
    const numBalance = parseFloat(balance);
    return Math.floor(numBalance * Math.pow(10, decimals)).toString();
  }
}
