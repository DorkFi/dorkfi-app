/**
 * Envoi API Service
 * Provides integration with the enVoi Naming Service API
 * Documentation: https://api.envoi.sh/
 */

export interface EnvoiNameResponse {
  name: string;
  address: string;
  tokenId: string;
  owner: string;
  metadata?: {
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

export interface EnvoiAddressResponse {
  address?: string;
  addr?: string;
  wallet?: string;
  owner?: string;
  name?: string;
  tokenId?: string;
}

export interface EnvoiTokenResponse {
  tokenId: string;
  name: string;
  owner: string;
  address: string;
  metadata?: {
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

export interface EnvoiSearchResponse {
  results: Array<{
    name: string;
    address: string;
    tokenId: string;
  }>;
  total: number;
}

class EnvoiService {
  private baseUrl = 'https://api.envoi.sh';

  /**
   * Resolve a VOI address to its associated name
   * @param address - The VOI address to resolve
   * @returns Promise<EnvoiNameResponse | null>
   */
  async resolveName(address: string): Promise<EnvoiNameResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/name/${address}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No name found for this address
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error resolving name from Envoi API:', error);
      return null;
    }
  }

  /**
   * Resolve a VOI name to its associated address
   * @param name - The VOI name to resolve (e.g., "en.voi")
   * @returns Promise<EnvoiAddressResponse | null>
   */
  async resolveAddress(name: string): Promise<EnvoiAddressResponse | null> {
    try {
      console.log('🔗 Envoi Service: Resolving address for name:', name);
      const url = `${this.baseUrl}/api/address/${name}`;
      console.log('🌐 Envoi Service: Making request to:', url);
      
      const response = await fetch(url);
      console.log('📡 Envoi Service: Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('❌ Envoi Service: No address found for name:', name);
          return null; // No address found for this name
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Envoi Service: Address data received:', data);
      console.log('🔍 Envoi Service: Data keys:', Object.keys(data));
      console.log('🔍 Envoi Service: Data type:', typeof data);
      
      // Handle different response formats
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        // API returns { results: [{ address, name, ... }] }
        const result = data.results[0];
        console.log('🔍 Envoi Service: Using first result:', result);
        return result;
      } else if (data.address) {
        // API returns { address, name, ... } directly
        console.log('🔍 Envoi Service: Using direct response');
        return data;
      } else {
        console.log('❌ Envoi Service: Unexpected response format');
        return null;
      }
    } catch (error) {
      console.error('❌ Envoi Service: Error resolving address:', error);
      return null;
    }
  }

  /**
   * Get token information by token ID
   * @param tokenId - The token ID to fetch information for
   * @returns Promise<EnvoiTokenResponse | null>
   */
  async getTokenInfo(tokenId: string): Promise<EnvoiTokenResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/token/${tokenId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Token not found
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching token info from Envoi API:', error);
      return null;
    }
  }

  /**
   * Search for VOI names matching a pattern
   * @param pattern - The search pattern
   * @returns Promise<EnvoiSearchResponse | null>
   */
  async searchNames(pattern: string): Promise<EnvoiSearchResponse | null> {
    try {
      console.log('🔍 Envoi Service: Searching names for pattern:', pattern);
      const url = `${this.baseUrl}/api/search?pattern=${encodeURIComponent(pattern)}`;
      console.log('🌐 Envoi Service: Making search request to:', url);
      
      const response = await fetch(url);
      console.log('📡 Envoi Service: Search response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Envoi Service: Search results received:', data);
      return data;
    } catch (error) {
      console.error('❌ Envoi Service: Error searching names:', error);
      return null;
    }
  }

  /**
   * Check if an address has an associated VOI name
   * @param address - The address to check
   * @returns Promise<boolean>
   */
  async hasName(address: string): Promise<boolean> {
    const nameData = await this.resolveName(address);
    return nameData !== null;
  }

  /**
   * Get user-friendly display name for an address
   * @param address - The address to get display name for
   * @returns Promise<string> - Returns the VOI name if available, otherwise the address
   */
  async getDisplayName(address: string): Promise<string> {
    const nameData = await this.resolveName(address);
    return nameData?.name || address;
  }

  /**
   * Validate if a string is a valid VOI name format
   * @param name - The name to validate
   * @returns boolean
   */
  isValidNameFormat(name: string): boolean {
    // VOI names typically follow the pattern: [subdomain.]domain
    // For example: en.voi, test.voi, etc.
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/;
    return nameRegex.test(name);
  }

  /**
   * Validate if a string is a valid Algorand address format
   * @param address - The address to validate
   * @returns boolean
   */
  isValidAddressFormat(address: string): boolean {
    // Algorand addresses are 58 characters long and use base32 encoding
    const addressRegex = /^[A-Z2-7]{58}$/;
    return addressRegex.test(address);
  }
}

// Export a singleton instance
export const envoiService = new EnvoiService();
export default envoiService;
