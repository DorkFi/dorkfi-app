import { NetworkId } from '@/config';

export interface CachedNetworkData {
  data: any;
  timestamp: number;
  networkId: NetworkId;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
}

class NetworkDataCache {
  private cache = new Map<string, CachedNetworkData>();
  private config: CacheConfig;

  constructor(config: CacheConfig = { ttl: 30000, maxSize: 100 }) {
    this.config = config;
  }

  set(key: string, data: any, networkId: NetworkId): void {
    // Clean expired entries before adding new ones
    this.cleanExpired();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      networkId,
    });
  }

  get(key: string): CachedNetworkData | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  getByNetwork(networkId: NetworkId): CachedNetworkData[] {
    const results: CachedNetworkData[] = [];
    
    for (const [key, cached] of this.cache.entries()) {
      if (cached.networkId === networkId) {
        // Check if expired
        if (Date.now() - cached.timestamp <= this.config.ttl) {
          results.push(cached);
        } else {
          this.cache.delete(key);
        }
      }
    }

    return results;
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    // Check if expired
    if (Date.now() - cached.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearByNetwork(networkId: NetworkId): void {
    for (const [key, cached] of this.cache.entries()) {
      if (cached.networkId === networkId) {
        this.cache.delete(key);
      }
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
    };
  }
}

// Global cache instance
export const networkDataCache = new NetworkDataCache({
  ttl: 30000, // 30 seconds
  maxSize: 200, // Maximum 200 cached items
});

// Cache key generators
export const generateCacheKey = {
  marketInfo: (poolId: string, marketId: string, networkId: NetworkId) => 
    `market-info-${networkId}-${poolId}-${marketId}`,
  
  marketPrices: (networkId: NetworkId) => 
    `market-prices-${networkId}`,
  
  totalDeposits: (networkId: NetworkId) => 
    `total-deposits-${networkId}`,
  
  totalLockedValue: (networkId: NetworkId) => 
    `total-locked-value-${networkId}`,
  
  combinedTLV: () => 
    'combined-total-locked-value',
};

export default networkDataCache;
