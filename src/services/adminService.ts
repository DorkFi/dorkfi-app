/**
 * Admin Service - Functions for reading admin-specific data
 *
 * This service handles fetching administrative data like paused states,
 * system health, and other operator-specific information.
 */

import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  getContractAddress,
  isCurrentNetworkEVM,
  isCurrentNetworkAVM,
  isCurrentNetworkVOI,
  isCurrentNetworkAlgorand,
  NetworkId,
  getAllTokens,
} from "@/config";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import { APP_SPEC as MarketControllerAppSpec } from "@/clients/MarketControllerClient";
import { APP_SPEC as LendingPoolStorageAppSpec } from "@/clients/LendingPoolStorageClient";
import { APP_SPEC as STokenAppSpec } from "@/clients/STokenClient";
import { abi, CONTRACT } from "ulujs";
import algorandService, { AlgorandNetwork } from "./algorandService";
import algosdk, { TransactionSigner } from "algosdk";

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
 * Fetches the paused state for a specific lending pool
 * @param poolId The lending pool contract ID
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<PausedState> The paused state for the pool
 */
export const fetchPoolPausedState = async (
  poolId: string,
  networkId?: string
): Promise<PausedState> => {
  try {
    const networkConfig = networkId
      ? getNetworkConfig(networkId as any)
      : getCurrentNetworkConfig();

    if (isCurrentNetworkVOI() || isCurrentNetworkAlgorand()) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ", // TODO replace with address with tokens
          sk: new Uint8Array(),
        }
      );
      const isPaused = await ci.is_paused();
      if (!isPaused.success) {
        throw new Error("Failed to get paused state");
      }
      // Convert return value to boolean (handles both boolean and number 0/1)
      const pausedValue = isPaused.returnValue;
      const isPausedBool =
        typeof pausedValue === "boolean"
          ? pausedValue
          : Boolean(Number(pausedValue));

      return {
        isPaused: isPausedBool,
        pausedBy: undefined,
        pausedAt: undefined,
        pauseReason: undefined,
        pausedContracts: [],
        lastUpdated: new Date().toISOString(),
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    }
  } catch (error) {
    console.error(`Failed to fetch paused state for pool ${poolId}:`, error);
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
  // Fallback
  return {
    isPaused: false,
    pausedBy: undefined,
    pausedAt: undefined,
    pauseReason: undefined,
    pausedContracts: [],
    lastUpdated: new Date().toISOString(),
  };
};

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
      // Convert return value to boolean (handles both boolean and number 0/1)
      const pausedValue = isPaused.returnValue;
      const isPausedBool =
        typeof pausedValue === "boolean"
          ? pausedValue
          : Boolean(Number(pausedValue));

      return {
        isPaused: isPausedBool,
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
      const isPaused = await ci.is_paused();
      console.log("Is paused:", isPaused);
      if (!isPaused.success) {
        throw new Error("Failed to get paused state");
      }
      // Convert return value to boolean (handles both boolean and number 0/1)
      const pausedValue = isPaused.returnValue;
      const isPausedBool =
        typeof pausedValue === "boolean"
          ? pausedValue
          : Boolean(Number(pausedValue));

      return {
        isPaused: isPausedBool,
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
 * @param pause Whether to pause (true) or unpause (false)
 * @param address The address of the account making the call
 * @param poolId Optional pool ID. If not provided, uses the first pool from config
 */
export const togglePauseState = async (
  pause: boolean,
  address: string,
  poolId?: string
): Promise<
  { success: true; txns: string[] } | { success: false; error: any }
> => {
  try {
    const networkConfig = getCurrentNetworkConfig();
    // Use provided poolId or fallback to first pool
    const targetPoolId = poolId || networkConfig.contracts.lendingPools[0];

    console.log(`Attempting to ${pause ? "pause" : "unpause"} protocol...`);
    console.log("Lending Pool ID:", targetPoolId);

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const ci = new CONTRACT(
        Number(targetPoolId),
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
        Number(targetPoolId),
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

      const market = await ci.get_market(params.tokenId);
      console.log("market", { market });

      // First, get the cost of creating a market
      //const costResult = await ci.create_market_cost();
      //console.log("costResult", { costResult });

      // if (!costResult.success) {
      //   throw new Error("Failed to get market creation cost");
      // }

      // console.log("Market creation cost:", costResult.returnValue);

      // Create the market with the provided parameters
      ci.setPaymentAmount(2000000);
      ci.setFee(8000);

      console.log({
        createMarketParams: params,
      });
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

      // Create the market with the provided parameters
      ci.setPaymentAmount(2000000);
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

      console.log({
        set_market_price: {
          poolId,
          marketId,
          priceInSmallestUnit,
        },
      });
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

/**
 * Pause or unpause a specific market
 * @param poolId Lending pool contract ID
 * @param tokenId Market token ID (underlying contract ID)
 * @param pause true to pause, false to unpause
 * @param userAddress Signer address
 */
export const toggleMarketPause = async (
  poolId: string,
  tokenId: string,
  pause: boolean,
  userAddress: string
): Promise<
  { success: false; error: any } | { success: true; txns: string[] }
> => {
  console.log("toggleMarketPause", { poolId, tokenId, pause, userAddress });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isCurrentNetworkVOI()) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

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

      const pauseMarketTx = await ci.pause_market(
        Number(tokenId),
        pause ? 1 : 0
      );

      if (!pauseMarketTx.success) {
        throw new Error("Failed to create pause market transaction");
      }

      return {
        success: true,
        txns: [...pauseMarketTx.txns],
      };
    } else if (isCurrentNetworkAlgorand()) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

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

      const pauseMarketTx = await ci.pause_market(
        Number(tokenId),
        pause ? 1 : 0
      );

      if (!pauseMarketTx.success) {
        throw new Error("Failed to pause/unpause market");
      }

      return {
        success: true,
        txns: [...pauseMarketTx.txns],
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error toggling market pause:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Update max total deposits for a specific market
 */
export const updateMarketMaxDeposits = async (
  poolId: string,
  marketId: string,
  newMaxDeposits: string,
  userAddress: string
): Promise<
  { success: false; error: any } | { success: true; txns: string[] }
> => {
  console.log("updateMarketMaxDeposits", {
    poolId,
    marketId,
    newMaxDeposits,
    userAddress,
  });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get MarketController contract address
      const marketControllerAddress = getContractAddress(
        networkConfig.networkId,
        "marketController"
      );

      if (
        !marketControllerAddress ||
        typeof marketControllerAddress !== "string"
      ) {
        throw new Error("MarketController contract address not found");
      }

      // Convert max deposits to proper units (assuming 6 decimals for the value)
      const maxDepositsInSmallestUnit = BigInt(newMaxDeposits);

      console.log("marketControllerAddress", { marketControllerAddress });

      // Use MarketController contract instead of lending pool contract
      const ci = new CONTRACT(
        Number(marketControllerAddress),
        clients.algod,
        undefined,
        { ...MarketControllerAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      console.log({
        set_market_max_total_deposits: {
          poolId,
          marketId,
          maxDepositsInSmallestUnit,
        },
      });

      ci.setFee(10000);
      const updateMaxDepositsTx = await ci.set_market_max_total_deposits(
        BigInt(poolId),
        BigInt(marketId),
        maxDepositsInSmallestUnit
      );

      console.log("updateMaxDepositsTx", { updateMaxDepositsTx });

      if (!updateMaxDepositsTx.success) {
        throw new Error("Failed to create update max deposits transaction");
      }

      return {
        success: true,
        txns: [...updateMaxDepositsTx.txns],
      };
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get MarketController contract address
      const marketControllerAddress = getContractAddress(
        networkConfig.networkId,
        "marketController"
      );

      if (
        !marketControllerAddress ||
        typeof marketControllerAddress !== "string"
      ) {
        throw new Error("MarketController contract address not found");
      }

      // Convert max deposits to proper units
      const maxDepositsInSmallestUnit = BigInt(newMaxDeposits);

      // Use MarketController contract instead of lending pool contract
      const ci = new CONTRACT(
        Number(marketControllerAddress),
        clients.algod,
        undefined,
        { ...MarketControllerAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      ci.setFee(10000);
      const updateMaxDepositsTx = await ci.set_market_max_total_deposits(
        BigInt(poolId),
        BigInt(marketId),
        maxDepositsInSmallestUnit
      );

      console.log("updateMaxDepositsTx", { updateMaxDepositsTx });

      if (!updateMaxDepositsTx.success) {
        throw new Error("Failed to update market max deposits");
      }

      return {
        success: true,
        txns: [...updateMaxDepositsTx.txns],
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error updating market max deposits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Update max total borrows for a specific market
 */
export interface UpdateMarketMaxBorrowsParams {
  poolId: string;
  marketId: string;
  newMaxBorrows: string;
  userAddress: string;
  signer?: TransactionSigner;
}
export const updateMarketMaxBorrows = async (
  options: UpdateMarketMaxBorrowsParams
): Promise<
  { success: false; error: any } | { success: true; txns: string[] }
> => {
  console.log("updateMarketMaxBorrows", options);

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isCurrentNetworkVOI()) {
      // Use VOI-specific service for VOI networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get MarketController contract address
      const marketControllerAddress = getContractAddress(
        networkConfig.networkId,
        "marketController"
      );

      if (
        !marketControllerAddress ||
        typeof marketControllerAddress !== "string"
      ) {
        throw new Error("MarketController contract address not found");
      }

      // Convert max borrows to proper units (assuming 6 decimals for the value)
      const maxBorrowsInSmallestUnit = BigInt(options.newMaxBorrows);

      // Use MarketController contract instead of lending pool contract
      const ci = new CONTRACT(
        Number(marketControllerAddress),
        clients.algod,
        undefined,
        { ...MarketControllerAppSpec.contract, events: [] },
        {
          addr: options.userAddress,
          sk: new Uint8Array(),
        }
      );

      ci.setFee(20000);
      const updateMaxBorrowsTx = await ci.set_market_max_total_borrows(
        BigInt(options.poolId),
        BigInt(options.marketId),
        maxBorrowsInSmallestUnit
      );

      console.log("updateMaxBorrowsTx", { updateMaxBorrowsTx });

      if (!updateMaxBorrowsTx.success) {
        throw new Error("Failed to update market max borrows");
      }

      return {
        success: true,
        txns: [...updateMaxBorrowsTx.txns],
      };
    } else if (isCurrentNetworkAlgorand()) {
      // Use Algorand-specific service for Algorand networks
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get MarketController contract address
      const marketControllerAddress = getContractAddress(
        networkConfig.networkId,
        "marketController"
      );

      if (
        !marketControllerAddress ||
        typeof marketControllerAddress !== "string"
      ) {
        throw new Error("MarketController contract address not found");
      }

      // Convert max borrows to proper units
      const maxBorrowsInSmallestUnit = BigInt(options.newMaxBorrows);

      // Use MarketController contract instead of lending pool contract
      const ci = new CONTRACT(
        Number(marketControllerAddress),
        clients.algod,
        undefined,
        { ...MarketControllerAppSpec.contract, events: [] },
        {
          addr: options.userAddress,
          sk: new Uint8Array(),
        }
      );

      ci.setFee(3000);
      const updateMaxBorrowsTx = await ci.set_market_max_total_borrows(
        BigInt(options.poolId),
        BigInt(options.marketId),
        maxBorrowsInSmallestUnit
      );

      console.log("updateMaxBorrowsTx", { updateMaxBorrowsTx });

      if (!updateMaxBorrowsTx.success) {
        throw new Error("Failed to update market max borrows");
      }

      return {
        success: true,
        txns: [...updateMaxBorrowsTx.txns],
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error updating market max borrows:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Calculate the maximum borrow amount for a user in a specific market
 *
 * @param poolId The lending pool ID
 * @param userId The user address
 * @param marketId The market ID
 * @param storageContractAppId The LendingPoolStorage contract app ID (optional, defaults to poolId if not provided)
 * @returns The maximum borrow amount as a bigint, or null if the call fails
 */
export const calculateMaxBorrowAmount = async (
  poolId: number | string,
  userId: string,
  marketId: number | string,
  storageContractAppId?: number | string
): Promise<bigint | null> => {
  try {
    const networkConfig = getCurrentNetworkConfig();

    if (!isCurrentNetworkVOI() && !isCurrentNetworkAlgorand()) {
      throw new Error(
        "This method is only supported on VOI and Algorand networks"
      );
    }

    const clients = algorandService.initializeClients(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    // Use provided storage contract app ID or default to poolId
    const storageAppId = storageContractAppId
      ? Number(storageContractAppId)
      : Number(poolId);

    // Initialize the LendingPoolStorageClient
    const storageClient = new CONTRACT(
      Number(storageAppId),
      clients.algod,
      undefined,
      { ...LendingPoolStorageAppSpec.contract, events: [] },
      {
        addr: userId,
        sk: new Uint8Array(),
      }
    );

    // Call the calculate_max_borrow_amount method
    storageClient.setFee(10000);
    const result = await storageClient.calculate_max_borrow_amount(
      Number(poolId),
      userId,
      Number(marketId)
    );

    if (result.success) {
      return result.returnValue as bigint;
    }

    console.log("calculateMaxBorrowAmount result", { result });

    return BigInt(0);
  } catch (error) {
    console.error("Error calculating max borrow amount:", error);
    return null;
  }
};

/**
 * Withdraw reserves from a lending market
 * @param poolId The lending pool contract ID
 * @param marketId The market ID to withdraw reserves from
 * @param amount The amount to withdraw (in smallest unit, already accounting for decimals)
 * @param userAddress The address of the user performing the withdrawal
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise with success status and transaction IDs or error
 */
export const withdrawReserves = async (
  poolId: string,
  marketId: string,
  amount: bigint,
  userAddress: string,
  networkId?: NetworkId
): Promise<
  { success: false; error: any } | { success: true; txns: string[] }
> => {
  console.log("withdrawReserves", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
  });

  try {
    const networkConfig = networkId
      ? getNetworkConfig(networkId)
      : getCurrentNetworkConfig();

    if (networkConfig.networkType === "avm") {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const tokens = getAllTokens(networkConfig.networkId);

      const token = tokens.find((t) => t.contractId === marketId);

      if (!token) {
        throw new Error("Token not found");
      }

      let isOptedIn = false;

      if (token.tokenStandard === "asa") {
        try {
          await clients.algod
            .accountAssetInformation(userAddress, Number(token.assetId))
            .do();
        } catch (error) {
          isOptedIn = false;
        }
      }

      // Create contract instance for the lending pool
      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        abi.custom,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const ciToken = new CONTRACT(
        Number(marketId),
        clients.algod,
        undefined,
        abi.nt200,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const arc200_balanceR = await ciToken.arc200_balanceOf(userAddress);

      if (!arc200_balanceR.success) {
        throw new Error("Failed to get ARC200 balance");
      }

      const arc200_balance = arc200_balanceR.returnValue;

      console.log("arc200_balance", { arc200_balance });

      const builder = {
        lending: new CONTRACT(
          Number(poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        token: new CONTRACT(
          Number(marketId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        arc200Exchange: new CONTRACT(
          Number(token.contractId),
          clients.algod,
          undefined,
          { ...STokenAppSpec.contract, events: [] },
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      const optin = isOptedIn
        ? {}
        : {
            xaid: Number(token.assetId),
            snd: userAddress,
            arcv: userAddress,
          };

      const buildN = [];

      let result: any;

      // {
      //   const txnO = (await builder.token.createBalanceBox(userAddress))
      //     .obj as any;
      //   const note = new TextEncoder().encode(
      //     `token createBalanceBox ${token.symbol} for ${userAddress}`
      //   );
      //   buildN.push({
      //     ...txnO,
      //     ...optin,
      //     payment: 28500,
      //     note,
      //   });
      // }

      {
        const txnO = (
          await builder.lending.withdraw_reserves(BigInt(marketId), amount)
        ).obj as any;
        const note = new TextEncoder().encode(
          `lending withdraw_reserves ${Number(amount) / 10 ** token.decimals} ${
            token.symbol
          }`
        );
        buildN.push({
          ...txnO,
          payment: 1e5,
          note,
        });
      }

      if (token.tokenStandard === "network" || token.tokenStandard === "asa") {
        const txnO = (await builder.token.withdraw(amount)).obj as any;
        const note = new TextEncoder().encode(
          `token withdraw ${Number(amount) / 10 ** token.decimals} ${
            token.symbol
          }`
        );
        buildN.push({
          ...txnO,
          note,
        });
      }

      if (token.tokenStandard === "arc200-exchange") {
        const swapBackAmount = amount + arc200_balance;
        const txnO = (
          await builder.arc200Exchange.arc200_swapBack(swapBackAmount)
        ).obj as any;
        const note = new TextEncoder().encode(
          `arc200_swapBack ${Number(swapBackAmount) / 10 ** token.decimals} ${
            token.symbol
          }`
        );
        buildN.push({
          ...txnO,
          note,
        });
      }

      // Set transaction fee
      ci.setFee(10000);

      // Call withdraw_reserves method
      ci.setExtraTxns(buildN);
      ci.setEnableGroupResourceSharing(true);
      if (networkConfig.networkId === "algorand-mainnet") {
        ci.setBeaconId(3209233839); // TODO move this to ulujs
      }
      result = await ci.custom();

      console.log("withdrawReserves result", { result });

      if (!result.success) {
        throw new Error(result.error || "Failed to withdraw reserves");
      }

      return {
        success: true,
        txns: result.txns,
      };
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error withdrawing reserves:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
