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

export interface UserData {
  scaledDeposits: string;
  scaledBorrows: string;
  depositIndex: string;
  borrowIndex: string;
  lastUpdateTime: number;
  lastPrice: string;
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
   * Fetch fresh market data from blockchain
   * Fetches fresh market data directly from the blockchain for a specific network, app ID, and market ID.
   * Bypasses the store and returns the fresh data.
   * @param network - Network identifier (e.g., algorand-mainnet, voi-mainnet)
   * @param appId - Application ID of the lending pool
   * @param marketId - Market ID
   * @returns Promise<ApiResponse<MarketData>>
   */
  async fetchFreshMarketData(
    network: string,
    appId: number,
    marketId: number
  ): Promise<ApiResponse<MarketData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/market-data/${encodeURIComponent(
          network
        )}/${appId}/${marketId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        if (response.status === 400 || response.status === 404 || response.status === 500) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching fresh market data for network ${network}, appId ${appId}, marketId ${marketId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all user health records across networks.
   */
  async getAllUserHealth(): Promise<ApiListResponse<UserHealth>> {
    try {
      const response = await fetch(`${this.baseUrl}/user-health`);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.data)) {
          return {
            success: data.success !== false,
            count: data.count ?? data.data.length,
            data: data.data,
            network: data.network,
            appId: data.appId,
          };
        }
      }
    } catch {
      // Fall through to per-network fetches.
    }

    try {
      const [algorand, voi] = await Promise.all([
        this.getUserHealthByNetwork("algorand-mainnet"),
        this.getUserHealthByNetwork("voi-mainnet"),
      ]);
      const data = [
        ...(algorand.success ? algorand.data ?? [] : []),
        ...(voi.success ? voi.data ?? [] : []),
      ];
      return {
        success: algorand.success || voi.success,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error("Error fetching all user health records:", error);
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
   * Fetch fresh user health data from blockchain
   * Fetches fresh user health data directly from the blockchain for a specific network, app ID, and user address.
   * Bypasses the store and returns the fresh data.
   * @param network - Network identifier (e.g., algorand-mainnet, voi-mainnet)
   * @param appId - Application ID of the lending pool
   * @param userAddress - User address
   * @returns Promise<ApiResponse<UserHealth>>
   */
  async fetchFreshUserHealth(
    network: string,
    appId: number,
    userAddress: string
  ): Promise<ApiResponse<UserHealth>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-health/${encodeURIComponent(
          network
        )}/${appId}/${encodeURIComponent(userAddress)}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        if (response.status === 400 || response.status === 404 || response.status === 500) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching fresh user health for network ${network}, appId ${appId}, userAddress ${userAddress}:`,
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

  /**
   * Update user profile (notify API that profile has been updated)
   * @param userAddress - User address
   * @returns Promise<ApiResponse<any>>
   */
  async updateUserProfile(userAddress: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: userAddress,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 400 || response.status === 404 || response.status === 500) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error updating user profile for address ${userAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Set a user's profile avatar (e.g. a bridged Dork NFT on Algorand). Lets users pick a PFP
   * without an enVoi (.voi) name by storing the choice against their address.
   *
   * Field names match the API profile schema: `avatar` is the image URL and `avatarDorkfi` is the
   * canonical `arc72:<contract>:<token>` value.
   * @param userAddress - User address
   * @param avatar - Avatar selection: canonical `avatarValue` (`arc72:<contract>:<token>`), image URL, and network
   * @returns Promise<ApiResponse<any>>
   */
  async setUserAvatar(
    userAddress: string,
    avatar: { avatarValue: string; imageUrl: string; network: string }
  ): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/user-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: userAddress,
          avatar: avatar.imageUrl,
          avatarDorkfi: avatar.avatarValue,
          network: avatar.network,
        }),
      });

      if (!response.ok) {
        if (
          response.status === 400 ||
          response.status === 404 ||
          response.status === 500
        ) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error setting user avatar for address ${userAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a user's cached profile avatar image URL by address.
   * Reads `GET /user-profile/{address}` which returns `data.avatar` (or null when not cached).
   * @param userAddress - User address
   * @returns Promise<ApiResponse<{ avatar: string | null }>>
   */
  async getUserAvatar(
    userAddress: string
  ): Promise<ApiResponse<{ avatar: string | null }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-profile/${encodeURIComponent(userAddress)}`
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
        `Error fetching user avatar for address ${userAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch fresh user data and update store
   * Fetches fresh user data from the blockchain for a specific user, network, app ID, and market ID, then updates the store
   * @param userAddress - User address
   * @param network - Network identifier (e.g., algorand-mainnet, voi-mainnet)
   * @param appId - Application ID of the lending pool
   * @param marketId - Market ID
   * @returns Promise<ApiResponse<UserData>>
   */
  async fetchFreshUserData(
    userAddress: string,
    network: string,
    appId: number,
    marketId: number
  ): Promise<ApiResponse<UserData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/user-data/user/${encodeURIComponent(
          userAddress
        )}/${encodeURIComponent(network)}/${appId}/${marketId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        if (response.status === 400 || response.status === 404 || response.status === 500) {
          const errorData = await response.json();
          return errorData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Error fetching fresh user data for userAddress ${userAddress}, network ${network}, appId ${appId}, marketId ${marketId}:`,
        error
      );
      throw error;
    }
  }

  // ==================== Analytics Endpoints ====================

  /**
   * Get current TVL (Total Value Locked)
   * @returns Promise<ApiResponse<{ totalTVL: number }>>
   */
  async getTVL(): Promise<ApiResponse<{ totalTVL: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/tvl`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching TVL:", error);
      throw error;
    }
  }

  /**
   * Get TVL growth data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param period - Period (day, week, month)
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number; dataPoints: Array<{ timestamp: number; value: number; network?: string }> }>>
   */
  async getTVLGrowth(
    startTime?: number,
    endTime?: number,
    period: string = "day",
    network?: string
  ): Promise<
    ApiResponse<{
      growth24h?: number;
      growth7d?: number;
      growth30d?: number;
      dataPoints: Array<{
        timestamp: number;
        value: number;
        network?: string;
      }>;
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/tvl-growth?period=${period}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching TVL growth:", error);
      throw error;
    }
  }

  /**
   * Get total borrowed amount
   * @returns Promise<ApiResponse<{ totalBorrowed: number }>>
   */
  async getTotalBorrowed(): Promise<ApiResponse<{ totalBorrowed: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/borrowed`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching total borrowed:", error);
      throw error;
    }
  }

  /**
   * Get borrowed growth percentages
   * @returns Promise<ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number }>>
   */
  async getBorrowedGrowth(): Promise<
    ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/borrowed-growth`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching borrowed growth:", error);
      throw error;
    }
  }

  /**
   * Get WAD circulation
   * @returns Promise<ApiResponse<{ totalWadCirculation: string }>>
   */
  async getWADCirculation(): Promise<
    ApiResponse<{ totalWadCirculation: string }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/wad-circulation`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching WAD circulation:", error);
      throw error;
    }
  }

  /**
   * Get WAD supply growth data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param period - Period (day, week, month)
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number; dataPoints: Array<{ timestamp: number; value: number; network?: string }> }>>
   */
  async getWADSupplyGrowth(
    startTime?: number,
    endTime?: number,
    period: string = "day",
    network?: string
  ): Promise<
    ApiResponse<{
      growth24h?: number;
      growth7d?: number;
      growth30d?: number;
      dataPoints: Array<{
        timestamp: number;
        value: number;
        network?: string;
      }>;
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/wad-supply-growth?period=${period}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching WAD supply growth:", error);
      throw error;
    }
  }

  /**
   * Get active wallets count
   * @returns Promise<ApiResponse<{ totalActiveWallets: number }>>
   */
  async getActiveWallets(): Promise<
    ApiResponse<{ totalActiveWallets: number }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/active-wallets`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching active wallets:", error);
      throw error;
    }
  }

  /**
   * Get active wallets growth percentages
   * @returns Promise<ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number }>>
   */
  async getActiveWalletsGrowth(): Promise<
    ApiResponse<{ growth24h?: number; growth7d?: number; growth30d?: number }>
  > {
    try {
      const response = await fetch(
        `${this.baseUrl}/analytics/active-wallets-growth`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching active wallets growth:", error);
      throw error;
    }
  }

  /**
   * Get deposits data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param limit - Maximum number of results
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ deposits: Array<{ timestamp: number; round: number; amount?: string; depositValueUSD: string; network?: string }>; summary: { totalDepositValueUSD: string } }>>
   */
  async getDeposits(
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    network?: string
  ): Promise<
    ApiResponse<{
      deposits: Array<{
        timestamp: number;
        round: number;
        amount?: string;
        depositValueUSD: string;
        network?: string;
      }>;
      summary: { totalDepositValueUSD: string };
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/deposits?limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching deposits:", error);
      throw error;
    }
  }

  /**
   * Get withdrawals data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param limit - Maximum number of results
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ withdrawals: Array<{ timestamp: number; round: number; amount?: string; withdrawValueUSD?: string; withdrawalValueUSD?: string; network?: string }>; summary: { totalWithdrawValueUSD?: string; totalWithdrawalValueUSD?: string } }>>
   */
  async getWithdrawals(
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    network?: string
  ): Promise<
    ApiResponse<{
      withdrawals: Array<{
        timestamp: number;
        round: number;
        amount?: string;
        marketId?: string;
        appId?: number | string;
        withdrawValueUSD?: string;
        withdrawalValueUSD?: string;
        network?: string;
      }>;
      summary: {
        totalWithdrawValueUSD?: string;
        totalWithdrawalValueUSD?: string;
      };
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/withdrawals?limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      throw error;
    }
  }

  /**
   * Get health factor distribution
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ distribution: Array<{ range: string; count: number }> }>>
   */
  async getHealthFactorDistribution(
    network?: string
  ): Promise<
    ApiResponse<{
      distribution: Array<{ range: string; count: number }>;
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/health-factor-distribution`;
      if (network) url += `?network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching health factor distribution:", error);
      throw error;
    }
  }

  /**
   * Get borrows data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param limit - Maximum number of results
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ borrows: Array<{ timestamp: number; round: number; borrowValueUSD: string; network?: string }>; summary: { totalBorrowValueUSD: string } }>>
   */
  async getBorrows(
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    network?: string
  ): Promise<
    ApiResponse<{
      borrows: Array<{
        timestamp: number;
        round: number;
        amount?: string;
        borrowValueUSD: string;
        network?: string;
      }>;
      summary: { totalBorrowValueUSD: string };
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/borrows?limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching borrows:", error);
      throw error;
    }
  }

  /**
   * Get repays data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param limit - Maximum number of results
   * @param network - Optional network filter
   * @returns Promise<ApiResponse<{ repays: Array<{ timestamp: number; round: number; repayValueUSD: string; network?: string }>; summary: { totalRepayValueUSD: string } }>>
   */
  async getRepays(
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    network?: string
  ): Promise<
    ApiResponse<{
      repays: Array<{
        timestamp: number;
        round: number;
        amount?: string;
        repayValueUSD: string;
        network?: string;
      }>;
      summary: { totalRepayValueUSD: string };
    }>
  > {
    try {
      let url = `${this.baseUrl}/analytics/repays?limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching repays:", error);
      throw error;
    }
  }

  /**
   * Get user activity data
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @param type - Activity type (deposit, withdraw, borrow, repay)
   * @param limit - Maximum number of results
   * @param network - Optional network filter
   * @param appId - Optional app ID filter
   * @param userAddress - Optional user address filter
   * @returns Promise<ApiResponse<{ activities: Array<any> }>>
   */
  async getUserActivity(
    startTime?: number,
    endTime?: number,
    type?: string,
    limit: number = 10000,
    network?: string,
    appId?: number,
    userAddress?: string
  ): Promise<ApiResponse<{ activities: Array<any> }>> {
    try {
      let url = `${this.baseUrl}/analytics/user-activity?limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;
      if (type) url += `&type=${encodeURIComponent(type)}`;
      if (network) url += `&network=${encodeURIComponent(network)}`;
      if (appId) url += `&appId=${appId}`;
      if (userAddress) url += `&userAddress=${encodeURIComponent(userAddress)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching user activity:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const dorkfiAPIService = new DorkFiAPIService();
export default dorkfiAPIService;
