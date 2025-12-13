/**
 * DorkFi API Service
 *
 * This service provides integration with the DorkFi API
 * Documentation: https://dorkfi-api.nautilus.sh/api-docs/
 */

export interface HealthResponse {
  status: string;
  time: string;
}

export interface DetailedHealthResponse extends HealthResponse {
  uptime: number;
}

export interface LendingPoolGlobalState {
  appId: number;
  network: string;
  contractVersion: number;
  deploymentVersion: number;
  owner: string;
  paused: number;
  secondsPerYear: number;
  stokenAppId: number;
  updatable: number;
  upgrader: string;
  [key: string]: any; // Allow additional properties
}

export interface Market {
  appId: number;
  network: string;
  marketId: number;
  paused: number;
  maxTotalDeposits: string;
  maxTotalBorrows: string;
  liquidationBonus: string;
  collateralFactor: string;
  liquidationThreshold: string;
  reserveFactor: string;
  borrowRate: string;
  slope: string;
  totalScaledDeposits: string;
  totalScaledBorrows: string;
  depositIndex: string;
  borrowIndex: string;
  lastUpdateTime: number;
  reserves: string;
  price: string;
  ntokenId: number;
  closeFactor: string;
  [key: string]: any; // Allow additional properties
}

export interface MarketData {
  appId: number;
  network: string;
  marketId: number;
  totalDeposits: string;
  totalBorrows: string;
  utilizationRate: number;
  supplyRate: number;
  borrowRate: number;
  lastUpdated: string;
  [key: string]: any; // Allow additional properties
}

export interface UserHealth {
  userAddress: string;
  network: string;
  appId: number;
  totalCollateralValue: string;
  totalBorrowValue: string;
  healthFactor: number;
  canBorrow: boolean;
  canWithdraw: boolean;
  canRepay: boolean;
  canSupply: boolean;
  [key: string]: any; // Allow additional properties
}

export interface User {
  userAddress: string;
  network: string;
  appId: number;
  totalCollateralValue: string;
  totalBorrowValue: string;
  healthFactor: number;
  lastUpdated: string;
  [key: string]: any; // Allow additional properties
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  network?: string;
  appId?: number;
  error?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
  network?: string;
  appId?: number;
}

class DorkFiAPIService {
  private baseUrl =
    import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";

  /**
   * Health check endpoint
   * @returns Promise<HealthResponse>
   */
  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking DorkFi API health:", error);
      throw error;
    }
  }

  /**
   * Detailed health check with statistics
   * @returns Promise<DetailedHealthResponse>
   */
  async detailedHealthCheck(): Promise<DetailedHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health/detailed`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking DorkFi API detailed health:", error);
      throw error;
    }
  }

  /**
   * Get all lending pool global states
   * @returns Promise<ApiListResponse<LendingPoolGlobalState>>
   */
  async getAllLendingPoolGlobalStates(): Promise<
    ApiListResponse<LendingPoolGlobalState>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/lending-pool/global-state`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching all lending pool global states:", error);
      throw error;
    }
  }

  /**
   * Get all lending pool global states for a network
   * @param network - Network identifier (e.g., "algorand-mainnet", "voi-mainnet")
   * @returns Promise<ApiListResponse<LendingPoolGlobalState>>
   */
  async getLendingPoolGlobalStatesByNetwork(
    network: string
  ): Promise<ApiListResponse<LendingPoolGlobalState>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/lending-pool/global-state/${encodeURIComponent(
          network
        )}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching lending pool global states for network ${network}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get lending pool global state for a specific app ID and network
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @returns Promise<ApiResponse<LendingPoolGlobalState>>
   */
  async getLendingPoolGlobalState(
    network: string,
    appId: number
  ): Promise<ApiResponse<LendingPoolGlobalState>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/lending-pool/global-state/${encodeURIComponent(
          network
        )}/${appId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching lending pool global state for network ${network}, appId ${appId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all markets
   * @returns Promise<ApiListResponse<Market>>
   */
  async getAllMarkets(): Promise<ApiListResponse<Market>> {
    try {
      const response = await fetch(`${this.baseUrl}/markets`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching all markets:", error);
      throw error;
    }
  }

  /**
   * Get all markets for a network
   * @param network - Network identifier
   * @returns Promise<ApiListResponse<Market>>
   */
  async getMarketsByNetwork(network: string): Promise<ApiListResponse<Market>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets/${encodeURIComponent(network)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching markets for network ${network}:`, error);
      throw error;
    }
  }

  /**
   * Get all markets for a specific app ID and network
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @returns Promise<ApiListResponse<Market>>
   */
  async getMarketsByAppId(
    network: string,
    appId: number
  ): Promise<ApiListResponse<Market>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets/${encodeURIComponent(network)}/${appId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching markets for network ${network}, appId ${appId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a specific market
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @param marketId - Market ID
   * @returns Promise<ApiResponse<Market>>
   */
  async getMarket(
    network: string,
    appId: number,
    marketId: number
  ): Promise<ApiResponse<Market>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets/${encodeURIComponent(
          network
        )}/${appId}/${marketId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching market for network ${network}, appId ${appId}, marketId ${marketId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all market data
   * @returns Promise<ApiListResponse<MarketData>>
   */
  async getAllMarketData(): Promise<ApiListResponse<MarketData>> {
    try {
      const response = await fetch(`${this.baseUrl}/market-data`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching all market data:", error);
      throw error;
    }
  }

  /**
   * Get all market data for a network
   * @param network - Network identifier
   * @returns Promise<ApiListResponse<MarketData>>
   */
  async getMarketDataByNetwork(
    network: string
  ): Promise<ApiListResponse<MarketData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/market-data/${encodeURIComponent(network)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching market data for network ${network}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Alias for getMarketDataByNetwork
   * Get all market data for a network
   * @param network - Network identifier
   * @returns Promise<ApiListResponse<MarketData>>
   */
  async getAllMarketDataByNetwork(
    network: string
  ): Promise<ApiListResponse<MarketData>> {
    return this.getMarketDataByNetwork(network);
  }

  /**
   * Get all market data for an app ID and network
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @returns Promise<ApiListResponse<MarketData>>
   */
  async getMarketDataByAppId(
    network: string,
    appId: number
  ): Promise<ApiListResponse<MarketData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/market-data/${encodeURIComponent(network)}/${appId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching market data for network ${network}, appId ${appId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get market data for a specific market
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @param marketId - Market ID
   * @returns Promise<ApiResponse<MarketData>>
   */
  async getMarketData(
    network: string,
    appId: number,
    marketId: number
  ): Promise<ApiResponse<MarketData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/market-data/${encodeURIComponent(
          network
        )}/${appId}/${marketId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching market data for network ${network}, appId ${appId}, marketId ${marketId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get user health for a specific user address
   * @param userAddress - User address
   * @returns Promise<ApiResponse<UserHealth>>
   */
  async getUserHealthByAddress(
    userAddress: string
  ): Promise<ApiResponse<UserHealth>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-health/user/${encodeURIComponent(userAddress)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching user health for address ${userAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all user health data for a network
   * @param network - Network identifier
   * @returns Promise<ApiListResponse<UserHealth>>
   */
  async getUserHealthByNetwork(
    network: string
  ): Promise<ApiListResponse<UserHealth>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-health/${encodeURIComponent(network)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching user health for network ${network}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all user health data for an app ID and network
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @returns Promise<ApiListResponse<UserHealth>>
   */
  async getUserHealthByAppId(
    network: string,
    appId: number
  ): Promise<ApiListResponse<UserHealth>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-health/${encodeURIComponent(network)}/${appId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching user health for network ${network}, appId ${appId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get user health for a specific user address, app ID, and network
   * @param network - Network identifier
   * @param appId - Application ID of the lending pool
   * @param userAddress - User address
   * @returns Promise<ApiResponse<UserHealth>>
   */
  async getUserHealth(
    network: string,
    appId: number,
    userAddress: string
  ): Promise<ApiResponse<UserHealth>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-health/${encodeURIComponent(
          network
        )}/${appId}/${encodeURIComponent(userAddress)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching user health for network ${network}, appId ${appId}, userAddress ${userAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all users
   * @returns Promise<ApiListResponse<User>>
   */
  async getAllUsers(): Promise<ApiListResponse<User>> {
    try {
      const response = await fetch(`${this.baseUrl}/users`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching all users:", error);
      throw error;
    }
  }

  /**
   * Get all users for a network
   * @param network - Network identifier
   * @returns Promise<ApiListResponse<User>>
   */
  async getUsersByNetwork(network: string): Promise<ApiListResponse<User>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/users/network/${encodeURIComponent(network)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching users for network ${network}:`, error);
      throw error;
    }
  }

  /**
   * Get user information for a specific address
   * @param userAddress - User address
   * @returns Promise<ApiResponse<User>>
   */
  async getUser(userAddress: string): Promise<ApiResponse<User>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/users/${encodeURIComponent(userAddress)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching user for address ${userAddress}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const dorkfiAPIService = new DorkFiAPIService();
export default dorkfiAPIService;
