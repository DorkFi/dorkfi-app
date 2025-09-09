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

    if (isCurrentNetworkAVM()) {
      // Use Algorand SDK, ASA tokens, app calls
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPool),
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
  | { success: true; txns: string[] }
  | { success: false; error: any }
> => {
  try {
    const networkConfig = getCurrentNetworkConfig();
    const lendingPoolAddress = getContractAddress(
      networkConfig.networkId,
      "lendingPool"
    );

    console.log(`Attempting to ${pause ? "pause" : "unpause"} protocol...`);
    console.log("Lending Pool Address:", lendingPoolAddress);

    if (isCurrentNetworkAVM()) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPool),
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
