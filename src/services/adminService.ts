/**
 * Admin Service - Functions for reading admin-specific data
 *
 * This service handles fetching administrative data like paused states,
 * system health, and other operator-specific information.
 */

import {
  getCurrentNetworkConfig,
  getContractAddress,
  isCurrentNetworkEVM,
  isCurrentNetworkAVM,
  isCurrentNetworkVOI,
  isCurrentNetworkAlgorand,
} from "@/config";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import { CONTRACT } from "ulujs";
import algorandService, { AlgorandNetwork } from "./algorandService";
import algosdk from "algosdk";

export interface PausedState {
  isPaused: boolean;
  pausedBy?: string;
  pausedAt?: string;
  pauseReason?: string;
  pausedContracts: string[];
  lastUpdated: string;
}

export interface SystemHealth {
  overall: number;
  contracts: {
    lendingPool: boolean;
    priceOracle: boolean;
    liquidationEngine: boolean;
    governance: boolean;
  };
  lastChecked: string;
}

export interface CreateMarketParams {
  tokenId: number;
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  reserveFactor: bigint;
  borrowRate: bigint;
  slope: bigint;
  maxTotalDeposits: bigint;
  maxTotalBorrows: bigint;
  liquidationBonus: bigint;
  closeFactor: bigint;
}

/**
 * Fetches the current paused state from the protocol
 * This would typically read from a smart contract or API endpoint
 */
export const fetchPausedState = async (
  activeAddress?: string
): Promise<PausedState> => {
  try {
    const networkConfig = getCurrentNetworkConfig();
    console.log("Network config:", networkConfig);

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ", // TODO replace with address with tokens
          sk: new Uint8Array(),
        }
      );
      const isPaused = await ci.is_paused();
      console.log("Is paused:", isPaused);
      if (!isPaused.success) {
        throw new Error("Failed to get paused state");
      }
      return {
        isPaused: isPaused.returnValue,
        pausedBy: undefined,
        pausedAt: undefined,
        pauseReason: undefined,
        pausedContracts: [],
        lastUpdated: new Date().toISOString(),
      };
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ", // TODO replace with address with tokens
          sk: new Uint8Array(),
        }
      );

      const pausedResult = await ci.get_paused();
      console.log("Paused result:", pausedResult);

      return {
        isPaused: pausedResult.returnValue === 1,
        pausedBy: undefined,
        pausedAt: undefined,
        pauseReason: undefined,
        pausedContracts: [],
        lastUpdated: new Date().toISOString(),
      };
    } else if (isCurrentNetworkEVM()) {
      // Use ethers.js, ERC-20 tokens, contract calls
      throw new Error("EVM networks are not supported yet");
    }
  } catch (error) {
    console.error("Failed to fetch paused state:", error);
    // Return a safe default state
    return {
      isPaused: false,
      pausedBy: undefined,
      pausedAt: undefined,
      pauseReason: undefined,
      pausedContracts: [],
      lastUpdated: new Date().toISOString(),
    };
  }
};

/**
 * Fetches system health information
 */
export const fetchSystemHealth = async (): Promise<SystemHealth> => {
  try {
    // TODO: Replace with actual health checks
    // This would typically ping various services and contracts

    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      overall: 98.5,
      contracts: {
        lendingPool: true,
        priceOracle: true,
        liquidationEngine: true,
        governance: false, // Governance might be disabled
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch system health:", error);
    return {
      overall: 0,
      contracts: {
        lendingPool: false,
        priceOracle: false,
        liquidationEngine: false,
        governance: false,
      },
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Fetches admin statistics
 */
export const fetchAdminStats = async () => {
  try {
    // TODO: Replace with actual data fetching
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      totalMarkets: 8,
      activeUsers: 1247,
      totalVolume: 2450000,
      pendingOperations: 3,
      lastUpdate: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return {
      totalMarkets: 0,
      activeUsers: 0,
      totalVolume: 0,
      pendingOperations: 0,
      lastUpdate: new Date().toISOString(),
    };
  }
};

/**
 * Simulates pausing/unpausing the protocol
 * In a real implementation, this would make contract calls
 */
export const togglePauseState = async (
  pause: boolean,
  address: string
): Promise<
  { success: true; txns: string[] } | { success: false; error: any }
> => {
  try {
    const networkConfig = getCurrentNetworkConfig();
    const lendingPoolAddress = getContractAddress(
      networkConfig.networkId,
      "lendingPools"
    );

    console.log(`Attempting to ${pause ? "pause" : "unpause"} protocol...`);
    console.log("Lending Pool Address:", lendingPoolAddress);

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: address,
          sk: new Uint8Array(),
        }
      );
      const pauseR = await ci.pause(pause ? 1 : 0);
      if (!pauseR.success) {
        throw new Error("Failed to pause protocol");
      } else {
        return {
          success: true,
          txns: [...pauseR.txns],
        };
      }
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: address,
          sk: new Uint8Array(),
        }
      );
      const pauseR = await ci.pause(pause ? 1 : 0);
      if (!pauseR.success) {
        throw new Error("Failed to pause/unpause protocol");
      } else {
        return {
          success: true,
          txns: [...pauseR.txns],
        };
      }
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error(`Failed to ${pause ? "pause" : "unpause"} protocol:`, error);
    return {
      success: false,
      error: error,
    };
  }
};

/**
 * Gets the pause status for a specific contract
 */
export const getContractPauseStatus = (
  pausedState: PausedState,
  contractName: string
): boolean => {
  return pausedState.pausedContracts.includes(contractName);
};

/**
 * Formats pause duration
 */
export const formatPauseDuration = (pausedAt: string): string => {
  const pausedTime = new Date(pausedAt);
  const now = new Date();
  const diffMs = now.getTime() - pausedTime.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`;
  } else {
    return `${diffMinutes}m`;
  }
};

/**
 * Creates a new market in the lending pool
 * This method handles the creation of new lending markets with specified parameters
 */
export const createMarket = async (
  poolId: number,
  params: CreateMarketParams,
  address: string
): Promise<
  | { success: true; marketId: number; txns: string[] }
  | { success: false; error: any }
> => {
  try {
    const networkConfig = getCurrentNetworkConfig();
    console.log("Creating market with params:", params);
    console.log("Network config:", networkConfig);

    // Validate parameters
    if (params.tokenId <= 0) {
      throw new Error("Token ID must be greater than 0");
    }
    if (params.collateralFactor < 0 || params.collateralFactor > 10000) {
      throw new Error("Collateral factor must be between 0 and 10000");
    }
    if (
      params.liquidationThreshold < 0 ||
      params.liquidationThreshold > 10000
    ) {
      throw new Error("Liquidation threshold must be between 0 and 10000");
    }
    if (params.reserveFactor < 0 || params.reserveFactor > 10000) {
      throw new Error("Reserve factor must be between 0 and 10000");
    }
    if (params.liquidationBonus < 0 || params.liquidationBonus > 10000) {
      throw new Error("Liquidation bonus must be between 0 and 10000");
    }
    if (params.closeFactor < 0 || params.closeFactor > 10000) {
      throw new Error("Close factor must be between 0 and 10000");
    }

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: address,
          sk: new Uint8Array(),
        }
      );

      // First, get the cost of creating a market
      const costResult = await ci.create_market_cost();

      console.log("costResult", { costResult });

      if (!costResult.success) {
        throw new Error("Failed to get market creation cost");
      }

      console.log("Market creation cost:", costResult.returnValue);

      // Create the market with the provided parameters
      ci.setPaymentAmount(costResult.returnValue);
      ci.setFee(8000);
      const createResult = await ci.create_market(
        params.tokenId,
        params.collateralFactor,
        params.liquidationThreshold,
        params.reserveFactor,
        params.borrowRate,
        params.slope,
        params.maxTotalDeposits,
        params.maxTotalBorrows,
        params.liquidationBonus,
        params.closeFactor
      );

      console.log({ createResult });

      if (!createResult.success) {
        throw new Error("Failed to create market");
      }

      console.log("Market created successfully:", createResult.returnValue);

      return {
        success: true,
        marketId: Number(createResult.returnValue),
        txns: [...createResult.txns],
      };
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: address,
          sk: new Uint8Array(),
        }
      );

      // Get the cost of creating a market
      const costResult = await ci.create_market_cost();
      console.log("costResult", { costResult });

      if (!costResult.success) {
        throw new Error("Failed to get market creation cost");
      }

      console.log("Market creation cost:", costResult.returnValue);

      // Create the market with the provided parameters
      ci.setPaymentAmount(costResult.returnValue);
      ci.setFee(8000);
      const createResult = await ci.create_market(
        params.tokenId,
        params.collateralFactor,
        params.liquidationThreshold,
        params.reserveFactor,
        params.borrowRate,
        params.slope,
        params.maxTotalDeposits,
        params.maxTotalBorrows,
        params.liquidationBonus,
        params.closeFactor
      );

      console.log({ createResult });

      if (!createResult.success) {
        throw new Error("Failed to create market");
      }

      console.log("Market created successfully:", createResult.returnValue);

      return {
        success: true,
        marketId: Number(createResult.returnValue),
        txns: [...createResult.txns],
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Failed to create market:", error);
    return {
      success: false,
      error: error,
    };
  }
};

/**
 * Update price for a specific market
 */
export const updateMarketPrice = async (
  poolId: string,
  marketId: string,
  newPrice: string,
  userAddress: string
): Promise<
  { success: false; error: any } | { success: true; txns: string[] }
> => {
  console.log("updateMarketPrice", { poolId, marketId, newPrice, userAddress });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Convert price to proper units (assuming 6 decimals for price)
      const priceInSmallestUnit = BigInt(newPrice);

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      // Create update price transaction
      const updatePriceTx = await ci.set_market_price(
        Number(marketId),
        priceInSmallestUnit
      );

      console.log("updatePriceTx", { updatePriceTx });

      if (!updatePriceTx.success) {
        throw new Error("Failed to create update price transaction");
      }

      return {
        success: true,
        txns: [...updatePriceTx.txns],
      };
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Convert price to proper units (assuming 6 decimals for price)
      const priceInSmallestUnit = BigInt(newPrice);

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const updatePriceTx = await ci.set_market_price(
        Number(marketId),
        priceInSmallestUnit
      );

      if (!updatePriceTx.success) {
        throw new Error("Failed to update market price");
      }

      return {
        success: true,
        txns: [...updatePriceTx.txns],
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error updating market price:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
