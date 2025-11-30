/**
 * Lending Service
 *
 * This service handles interactions with the lending protocol,
 * including fetching market information, user positions, and protocol statistics.
 */

import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  isCurrentNetworkAlgorandCompatible,
  isCurrentNetworkEVM,
  isAlgorandCompatibleNetwork,
  isEVMNetwork,
  NetworkId,
  getAllTokensWithDisplayInfo,
  getTokenConfig,
  getLendingPools,
  getPreFiParameters,
} from "@/config";
import algorandService, { AlgorandNetwork } from "./algorandService";
import { ARC200Service } from "./arc200Service";
import { abi, CONTRACT } from "ulujs";
import {
  APP_SPEC as LendingPoolAppSpec,
  UserData,
  GlobalUserData,
} from "@/clients/DorkFiLendingPoolClient";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import { TokenStandard } from "@/config";
import {
  calculateDepositAPY,
  calculateBorrowAPY,
  APYCalculationResult,
} from "@/utils/apyCalculations";

export interface MarketInfo {
  networkId: NetworkId;
  poolId: string;
  marketId: string;
  tokenId: string;
  tokenContractId: string;
  ntokenId: string;
  name: string;
  symbol: string;
  decimals: number;
  collateralFactor: number;
  liquidationThreshold: number;
  reserveFactor: number;
  borrowRate: number;
  slope: number;
  maxTotalDeposits: string;
  maxTotalBorrows: string;
  liquidationBonus: number;
  closeFactor: number;
  totalDeposits: string;
  totalBorrows: string;
  utilizationRate: number;
  supplyRate: number;
  borrowRateCurrent: number;
  price: string;
  isActive: boolean;
  isPaused: boolean;
  lastUpdated: string;
  // Current market indices (for accurate position calculations)
  depositIndex: string;
  borrowIndex: string;
  // APY calculation results
  apyCalculation?: APYCalculationResult;
  borrowApyCalculation?: APYCalculationResult;
}

export interface UserPosition {
  userId: string;
  marketId: string;
  poolId?: string;
  contractId?: string;
  nTokenId?: string;
  supplyBalance: string;
  borrowBalance: string;
  collateralValue: string;
  borrowValue: string;
  healthFactor: number;
  canBorrow: boolean;
  canSupply: boolean;
  canWithdraw: boolean;
  canRepay: boolean;
}

export interface ProtocolStats {
  totalMarkets: number;
  activeMarkets: number;
  totalSupplyValue: string;
  totalBorrowValue: string;
  totalUsers: number;
  utilizationRate: number;
  totalReserves: string;
  lastUpdated: string;
}

export interface Market {
  paused: boolean;
  maxTotalDeposits: BigInt;
  maxTotalBorrows: BigInt;
  liquidationBonus: BigInt;
  collateralFactor: BigInt;
  liquidationThreshold: BigInt;
  reserveFactor: BigInt;
  borrowRate: BigInt;
  slope: BigInt;
  totalScaledDeposits: BigInt;
  totalScaledBorrows: BigInt;
  depositIndex: BigInt;
  borrowIndex: BigInt;
  lastUpdateTime: BigInt;
  reserves: BigInt;
  price: BigInt;
  ntokenId: BigInt;
  closeFactor: BigInt;
}

export const decodeMarket = (market: any[]): Market => {
  return {
    paused: market[0] as boolean,
    maxTotalDeposits: market[1] as BigInt,
    maxTotalBorrows: market[2] as BigInt,
    liquidationBonus: market[3] as BigInt,
    collateralFactor: market[4] as BigInt,
    liquidationThreshold: market[5] as BigInt,
    reserveFactor: market[6] as BigInt,
    borrowRate: market[7] as BigInt,
    slope: market[8] as BigInt,
    totalScaledDeposits: market[9] as BigInt,
    totalScaledBorrows: market[10] as BigInt,
    depositIndex: market[11] as BigInt,
    borrowIndex: market[12] as BigInt,
    lastUpdateTime: market[13] as BigInt,
    reserves: market[14] as BigInt,
    price: market[15] as BigInt,
    ntokenId: market[16] as BigInt,
    closeFactor: market[17] as BigInt,
  } as Market;
};

interface User {
  scaledDeposits: BigInt;
  scaledBorrows: BigInt;
  depositIndex: BigInt;
  borrowIndex: BigInt;
  lastUpdateTime: BigInt;
  lastPrice: BigInt;
}

export const decodeUser = (user: any[]) => {
  return {
    scaledDeposits: user[0],
    scaledBorrows: user[1],
    depositIndex: user[2],
    borrowIndex: user[3],
    lastUpdateTime: user[4],
    lastPrice: user[5],
  } as User;
};

/**
 * Fetch market information for a specific market
 */
export const fetchMarketInfo = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<MarketInfo | null> => {
  console.log("fetchMarketInfo", { poolId, marketId, networkId });
  try {
    // Validate input parameters
    if (!poolId || !marketId || !networkId) {
      throw new Error(
        "Missing required parameters: poolId, marketId, or networkId"
      );
    }

    if (isNaN(Number(poolId))) {
      throw new Error(`Invalid poolId: ${poolId}. Must be a number.`);
    }

    if (isNaN(Number(marketId))) {
      throw new Error(`Invalid marketId: ${marketId}. Must be a number.`);
    }

    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: algosdk.getApplicationAddress(Number(poolId)),
          sk: new Uint8Array(),
        }
      );

      const token = getAllTokensWithDisplayInfo(networkId).find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("token", { token });

      if (!token) {
        console.error(
          `Token not found for marketId ${marketId} on network ${networkId}`
        );
        throw new Error(`Token not found for marketId ${marketId}`);
      }

      if (!token.underlyingContractId) {
        console.error(`Token ${token.symbol} missing underlyingContractId`);
        throw new Error(`Token ${token.symbol} missing underlyingContractId`);
      }

      // Get the original token config to access isStoken property
      const tokenConfig = networkConfig.tokens[token.symbol];
      const isSToken = tokenConfig?.isStoken || false;

      const marketR = await ci.get_market(Number(marketId));

      console.log("marketR", { marketR });

      if (!marketR.success) {
        console.error(`Contract call failed for market ${marketId}:`, marketR);
        throw new Error(`Failed to get market info for market ${marketId}`);
      }

      if (!marketR.returnValue || !Array.isArray(marketR.returnValue)) {
        console.error(
          `Invalid market data structure for market ${marketId}:`,
          marketR.returnValue
        );
        throw new Error(`Invalid market data structure for market ${marketId}`);
      }

      // Debug: Log raw market data to verify field order
      console.log("Raw market data:", marketR.returnValue);
      console.log("Field count:", marketR.returnValue.length);

      if (marketR.returnValue.length < 18) {
        console.error(
          `Insufficient market data fields for market ${marketId}. Expected 18, got ${marketR.returnValue.length}`
        );
        throw new Error(
          `Insufficient market data fields for market ${marketId}`
        );
      }

      const market = decodeMarket(marketR.returnValue);

      // Debug: Log decoded market data
      console.log("Decoded market data:", {
        depositIndex: market.depositIndex.toString(),
        borrowIndex: market.borrowIndex.toString(),
        maxTotalDeposits: market.maxTotalDeposits.toString(),
        maxTotalBorrows: market.maxTotalBorrows.toString(),
      });

      const utilizationRate =
        market.totalScaledDeposits.toString() == "0"
          ? 0
          : new BigNumber(market.totalScaledBorrows.toString())
              .div(market.totalScaledDeposits.toString())
              .toNumber();

      const supplyRate = new BigNumber(market.borrowRate.toString())
        .multipliedBy(utilizationRate)
        .multipliedBy(10000 - Number(market.reserveFactor.toString()))
        .dividedBy(10000)
        .toNumber();

      const formatPrice = (price: string) => {
        return new BigNumber(price).div(new BigNumber(10).pow(18)).toFixed(12);
      };

      const formatDeposit = (deposit: string) => {
        return new BigNumber(deposit)
          .div(new BigNumber(10).pow(token?.decimals || 0))
          .toFixed(4);
      };

      const totalDeposits = formatDeposit(
        market.totalScaledDeposits.toString()
      );

      const totalBorrows = formatDeposit(market.totalScaledBorrows.toString());

      // Calculate APY using the new utility function
      const apyCalculation = calculateDepositAPY(
        {
          borrowRate: parseFloat(market.borrowRate.toString()),
          slope: parseFloat(market.slope.toString()),
          reserveFactor: parseFloat(market.reserveFactor.toString()),
        },
        {
          totalScaledDeposits: market.totalScaledDeposits.toString(),
          totalScaledBorrows: market.totalScaledBorrows.toString(),
          lastUpdateTime: Number(market.lastUpdateTime),
        }
      );

      // Calculate borrow APY using the new utility function
      const borrowApyCalculation = calculateBorrowAPY(
        {
          borrowRate: parseFloat(market.borrowRate.toString()),
          slope: parseFloat(market.slope.toString()),
          reserveFactor: parseFloat(market.reserveFactor.toString()),
        },
        {
          totalScaledDeposits: market.totalScaledDeposits.toString(),
          totalScaledBorrows: market.totalScaledBorrows.toString(),
          lastUpdateTime: Number(market.lastUpdateTime),
        },
        isSToken // Pass isSToken flag
      );

      const marketInfo: MarketInfo = {
        networkId: networkId,
        poolId: poolId,
        marketId: marketId,
        tokenId: market.ntokenId.toString(),
        tokenContractId: market.ntokenId.toString(),
        name: token?.name || "",
        symbol: token?.symbol || "",
        decimals: token?.decimals || 0,
        collateralFactor:
          parseFloat(market.collateralFactor.toString()) / 10000,
        liquidationThreshold:
          parseFloat(market.liquidationThreshold.toString()) / 10000,
        reserveFactor: parseFloat(market.reserveFactor.toString()) / 10000,
        borrowRate: parseFloat(market.borrowRate.toString()) / 10000,
        slope: parseFloat(market.slope.toString()) / 10000,
        maxTotalDeposits: BigNumber(market.maxTotalDeposits.toString())
          .div(10 ** token?.decimals || 0)
          .toFixed(0),
        maxTotalBorrows: BigNumber(market.maxTotalBorrows.toString())
          .div(10 ** token?.decimals || 0)
          .toFixed(0),
        liquidationBonus:
          parseFloat(market.liquidationBonus.toString()) / 10000,
        closeFactor: parseFloat(market.closeFactor.toString()) / 10000,
        totalDeposits,
        totalBorrows,
        utilizationRate,
        supplyRate,
        borrowRateCurrent: parseFloat(market.borrowRate.toString()) / 10000,
        price: formatPrice(market.price.toString()),
        isActive: true,
        isPaused: market.paused,
        ntokenId: market.ntokenId.toString(),
        lastUpdated: new Date().toISOString(),
        // Current market indices (for accurate position calculations)
        depositIndex: market.depositIndex.toString(),
        borrowIndex: market.borrowIndex.toString(),
        apyCalculation,
        borrowApyCalculation,
      };

      console.log("marketInfo", { marketInfo });

      return marketInfo;
    } else if (isEVMNetwork(networkId)) {
      // For EVM networks, we need to implement contract interaction
      // For now, return null to indicate no market data available
      console.warn(
        `EVM network ${networkId} not yet supported for market data fetching`
      );
      return null;
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error fetching market info:", error);
    return null;
  }
};

/**
 * Fetch all markets information
 */
export const fetchAllMarkets = async (
  networkId: NetworkId
): Promise<MarketInfo[]> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      // Get markets from config
      const tokens = getAllTokensWithDisplayInfo(networkId);

      console.log("Fetching real market data for", tokens.length, "tokens");

      // Fetch real market data for each token
      const markets: MarketInfo[] = [];

      for (const token of tokens) {
        try {
          // Use the token's own poolId from config, not the first lending pool
          const poolId = token.poolId;
          
          if (!poolId) {
            console.warn(
              `No pool ID configured for token ${token.symbol}, skipping`
            );
            continue;
          }

          const marketId = token.underlyingContractId || token.symbol;

          console.log(
            `Fetching market data for ${token.symbol} (marketId: ${marketId}, poolId: ${poolId})`
          );

          const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);

          if (marketInfo) {
            console.log(
              `Successfully fetched market data for ${token.symbol}:`,
              {
                price: marketInfo.price,
                totalDeposits: marketInfo.totalDeposits,
                totalBorrows: marketInfo.totalBorrows,
                utilizationRate: marketInfo.utilizationRate,
              }
            );
            markets.push(marketInfo);
          } else {
            console.warn(`No market data found for ${token.symbol}, skipping`);
          }
        } catch (error) {
          console.error(
            `Error fetching market data for ${token.symbol}:`,
            error
          );
          // Continue with other tokens even if one fails
        }
      }

      console.log(`Successfully fetched ${markets.length} markets`);
      return markets;
    } else if (isEVMNetwork(networkId)) {
      // For EVM networks, fetch real market data
      const tokens = getAllTokensWithDisplayInfo(networkId);

      console.log("Fetching real EVM market data for", tokens.length, "tokens");

      // Fetch real market data for each token
      const markets: MarketInfo[] = [];

      for (const token of tokens) {
        try {
          // Use the token's own poolId from config, not the first lending pool
          const poolId = token.poolId;
          
          if (!poolId) {
            console.warn(
              `No pool ID configured for token ${token.symbol}, skipping`
            );
            continue;
          }

          const marketId = token.underlyingContractId || token.symbol;

          console.log(
            `Fetching EVM market data for ${token.symbol} (marketId: ${marketId}, poolId: ${poolId})`
          );

          const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);

          if (marketInfo) {
            console.log(
              `Successfully fetched EVM market data for ${token.symbol}:`,
              {
                price: marketInfo.price,
                totalDeposits: marketInfo.totalDeposits,
                totalBorrows: marketInfo.totalBorrows,
                utilizationRate: marketInfo.utilizationRate,
              }
            );
            markets.push(marketInfo);
          } else {
            console.warn(
              `No EVM market data found for ${token.symbol}, skipping`
            );
          }
        } catch (error) {
          console.error(
            `Error fetching EVM market data for ${token.symbol}:`,
            error
          );
          // Continue with other tokens even if one fails
        }
      }

      console.log(`Successfully fetched ${markets.length} EVM markets`);
      return markets;
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error fetching all markets:", error);
    return [];
  }
};

/**
 * Fetch user global data (total collateral and borrow values)
 * @param marketData Optional market data array to calculate healthFactorIndex with individual market collateral factors
 */
export const fetchUserGlobalData = async (
  userAddress: string,
  networkId: NetworkId,
  marketData?: MarketInfo[]
): Promise<{
  totalCollateralValue: number;
  totalBorrowValue: number;
  lastUpdateTime: number;
  healthFactorIndex?: number;
} | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Initialize aggregate values
      let totalCollateralValueUSD = 0;
      let totalBorrowValueUSD = 0;
      let lastUpdateTime = 0;

      for (const poolId of networkConfig.contracts.lendingPools) {
        const ci = new CONTRACT(
          Number(poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: algosdk.getApplicationAddress(Number(poolId)),
            sk: new Uint8Array(),
          }
        );

        const globalUserR = await ci.get_global_user(userAddress);
        if (globalUserR.success) {
          const globalUser = GlobalUserData(globalUserR.returnValue);
          console.log(`Global user data for pool ${poolId}:`, globalUser);

          // Contract stores totalCollateralValue with scaling: (deposit_amount * price) // SCALE
          // Where SCALE = 1e18, so we need to divide by 1e18 to get USD value
          const poolCollateralValueUSD = new BigNumber(
            globalUser.totalCollateralValue.toString()
          )
            .div(1e12) // Correct scaling factor for collateral value
            .toNumber();
          const poolBorrowValueUSD = new BigNumber(
            globalUser.totalBorrowValue.toString()
          )
            .div(1e12) // Correct scaling factor for borrow value
            .toNumber();

          console.log(`Pool ${poolId} values:`, {
            collateralValueUSD: poolCollateralValueUSD,
            borrowValueUSD: poolBorrowValueUSD,
          });

          // Aggregate values from all pools
          totalCollateralValueUSD += poolCollateralValueUSD;
          totalBorrowValueUSD += poolBorrowValueUSD;
          // Use the latest update time from all pools
          lastUpdateTime = Math.max(
            lastUpdateTime,
            Number(globalUser.lastUpdateTime)
          );
        } else {
          console.warn(`Failed to get global user data for pool ${poolId}`);
        }
      }

      // Calculate healthFactorIndex if marketData is provided
      let healthFactorIndex: number | undefined;
      const STANDARD_COLLATERAL_FACTOR = 0.8; // 80% baseline

      if (totalBorrowValueUSD === 0 && totalCollateralValueUSD > 0) {
        // No borrows = excellent health (capped at 3.0 for display)
        healthFactorIndex = 3.0;
        console.log(
          `[HealthFactorIndex] No borrows - excellent health (capped at 3.0): ${healthFactorIndex}`
        );
      } else if (totalCollateralValueUSD === 0 && totalBorrowValueUSD > 0) {
        // No collateral but has borrows = 0 health
        healthFactorIndex = 0;
        console.log(
          `[HealthFactorIndex] No collateral but has borrows: ${healthFactorIndex}`
        );
      } else if (totalBorrowValueUSD > 0 && totalCollateralValueUSD > 0) {
        // Calculate healthFactorIndex normalized to 80% collateral factor baseline
        //
        // The contract's totalCollateralValue is already weighted: sum(depositValue_i * collateralFactor_i)
        // To normalize to 80% baseline, we want: sum(depositValue_i * 0.8)
        //
        // Since we don't have individual positions, we'll use the contract's value directly.
        // If the average collateral factor is close to 80% (which is common), this is already close to normalized.
        //
        // healthFactorIndex = totalCollateralValue / totalBorrowValue
        // This gives the actual health factor with current market collateral factors.
        // For most cases where average CF ≈ 80%, this is effectively normalized to 80% baseline.

        healthFactorIndex = totalCollateralValueUSD / totalBorrowValueUSD;

        // Cap at 3.0 for display purposes (consistent with Portfolio page)
        healthFactorIndex = Math.min(healthFactorIndex, 3.0);

        console.log(`[HealthFactorIndex] Calculation:`, {
          totalCollateralValueUSD,
          totalBorrowValueUSD,
          healthFactorIndex,
          formula: `(${totalCollateralValueUSD.toFixed(
            2
          )} / ${totalBorrowValueUSD.toFixed(2)}) = ${healthFactorIndex.toFixed(
            4
          )}`,
          note: "Using contract's weighted collateral value. If average CF ≈ 80%, this is effectively normalized to 80% baseline. Capped at 3.0 for display.",
        });
      }

      return {
        totalCollateralValue: totalCollateralValueUSD,
        totalBorrowValue: totalBorrowValueUSD,
        lastUpdateTime: lastUpdateTime,
        ...(healthFactorIndex !== undefined && { healthFactorIndex }),
      };
    } else if (isEVMNetwork(networkId)) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error fetching user global data:", error);
    return null;
  }
};

/**
 * Fetch user borrow balance for a specific market
 * This gets the user's scaled borrows from the lending pool contract
 * Returns both the current borrow balance and accrued interest
 */
export const fetchUserBorrowBalance = async (
  userAddress: string,
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<{ balance: number; interest: number } | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: algosdk.getApplicationAddress(Number(poolId)),
          sk: new Uint8Array(),
        }
      );

      // Get user's position data from the lending pool contract
      ci.setFee(2000);
      const userDataR = await ci.get_user(userAddress, Number(marketId));
      console.log(`get_user response for market ${marketId}:`, userDataR);

      if (userDataR.success) {
        const userData = UserData(userDataR.returnValue);
        console.log(`User data for market ${marketId}:`, userData);

        // Get token info to convert scaled borrows to actual amount
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find((t) => t.underlyingContractId === marketId);

        if (!token) {
          console.warn(`Token not found for market ${marketId}`);
          return null;
        }

        // Check if scaledBorrows exists and is valid
        if (!userData.scaledBorrows) {
          console.log(
            `No borrows found for user ${userAddress} in market ${marketId}`
          );
          return { balance: 0, interest: 0 }; // Return 0 instead of null for no borrows
        }

        // Get current market data to access borrow index
        const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
        if (!marketInfo) {
          console.warn(`Failed to get market info for market ${marketId}`);
          return null;
        }

        // Convert scaled borrows to actual token amount using borrow index scaling
        // Formula from docs: underlying_amount = (scaled_borrows * current_borrow_index) / SCALE
        const scaledBorrows = userData.scaledBorrows.toString();
        const userBorrowIndex = userData.borrowIndex.toString(); // User's stored borrow index (when they borrowed)
        const currentBorrowIndex = marketInfo.borrowIndex; // Current market borrow index (includes accrued interest)
        const SCALE = BigInt(1e18);

        console.log({
          userBorrowIndex,
          currentBorrowIndex,
        });

        // Calculate actual borrows using current borrow index (includes accrued interest):
        // underlying_amount = (scaled_borrows * current_borrow_index) / SCALE
        const actualBorrowsRaw =
          BigInt(scaledBorrows) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(currentBorrowIndex)) / SCALE;

        // Calculate original borrow amount using user's stored borrow index (without accrued interest):
        // original_amount = (scaled_borrows * user_borrow_index) / SCALE
        const originalBorrowsRaw =
          BigInt(scaledBorrows) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(userBorrowIndex)) / SCALE;

        // Convert to human-readable format by accounting for token decimals
        const actualBorrowAmount =
          Number(actualBorrowsRaw) / Math.pow(10, token.decimals);
        const originalBorrowAmount =
          Number(originalBorrowsRaw) / Math.pow(10, token.decimals);

        // Calculate accrued interest as the difference
        const accruedInterest = actualBorrowAmount - originalBorrowAmount;

        console.log(`User borrow balance for ${token.symbol}:`, {
          scaledBorrows: scaledBorrows.toString(),
          userBorrowIndex: userBorrowIndex.toString(),
          currentBorrowIndex: currentBorrowIndex.toString(),
          actualBorrowsRaw: actualBorrowsRaw.toString(),
          originalBorrowsRaw: originalBorrowsRaw.toString(),
          actualBorrowAmount,
          originalBorrowAmount,
          accruedInterest,
          tokenDecimals: token.decimals,
          formula: `(${scaledBorrows} * ${currentBorrowIndex}) / ${SCALE.toString()} = ${actualBorrowsRaw.toString()}`,
        });

        return {
          balance: actualBorrowAmount,
          interest: accruedInterest,
        };
      } else {
        console.warn(
          `Failed to get user data for market ${marketId}:`,
          userDataR
        );
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching user borrow balance:", error);
    return null;
  }
};

/**
 * Fetch user deposit balance for a specific market
 * This gets the user's scaled deposits from the lending pool contract
 */
export const fetchUserDepositBalance = async (
  userAddress: string,
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<number | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          ),
          sk: new Uint8Array(),
        }
      );

      // Get user's position data from the lending pool contract
      ci.setFee(2000);
      const userDataR = await ci.get_user(userAddress, Number(marketId));
      console.log(`get_user response for market ${marketId}:`, userDataR);

      if (userDataR.success) {
        const userData = UserData(userDataR.returnValue);
        console.log(`User data for market ${marketId}:`, userData);

        // Get token info to convert scaled deposits to actual amount
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find((t) => t.underlyingContractId === marketId);

        if (!token) {
          console.warn(`Token not found for market ${marketId}`);
          return null;
        }

        // Check if scaledDeposits exists and is valid
        if (!userData.scaledDeposits) {
          console.log(
            `No deposits found for user ${userAddress} in market ${marketId}`
          );
          return 0; // Return 0 instead of null for no deposits
        }

        // Get current market data to access deposit index
        const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
        if (!marketInfo) {
          console.warn(`Failed to get market info for market ${marketId}`);
          return null;
        }

        // Convert scaled deposits to actual token amount using deposit index scaling
        const scaledDeposits = userData.scaledDeposits.toString();
        const userDepositIndex = userData.depositIndex.toString();
        const currentDepositIndex = marketInfo.depositIndex;

        // Calculate actual deposits using the formula:
        // actual_deposits = (scaled_deposits * current_deposit_index) / SCALE
        const actualDepositsRaw =
          BigInt(scaledDeposits) === 0n
            ? 0n
            : (BigInt(scaledDeposits) * BigInt(currentDepositIndex)) /
              BigInt(1e18);

        // Convert to human-readable format by accounting for token decimals
        const actualDepositAmount =
          Number(actualDepositsRaw) / Math.pow(10, token.decimals);

        console.log(`User deposit balance for ${token.symbol}:`, {
          scaledDeposits: scaledDeposits.toString(),
          userDepositIndex: userDepositIndex.toString(),
          currentDepositIndex: currentDepositIndex.toString(),
          actualDepositsRaw: actualDepositsRaw.toString(),
          actualDepositAmount,
          tokenDecimals: token.decimals,
        });

        return actualDepositAmount;
      } else {
        console.warn(
          `Failed to get user data for market ${marketId}:`,
          userDataR
        );
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching user deposit balance:", error);
    return null;
  }
};

/**
 * Fetch user wallet balance for a specific token
 * This gets the user's actual wallet balance from the blockchain
 */
export const fetchUserWalletBalance = async (
  userAddress: string,
  tokenSymbol: string,
  networkId: NetworkId
): Promise<number | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);
    const tokens = getAllTokensWithDisplayInfo(networkId);
    const token = tokens.find((t) => t.symbol === tokenSymbol);

    if (!token) {
      console.warn(`Token not found for symbol ${tokenSymbol}`);
      return null;
    }

    console.log(`Token found for ${tokenSymbol}:`, {
      symbol: token.symbol,
      contractId: token.contractId,
      underlyingContractId: token.underlyingContractId,
      tokenStandard: token.tokenStandard,
      decimals: token.decimals,
    });

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Import ARC200Service dynamically to avoid circular dependencies
      const { ARC200Service } = await import("@/services/arc200Service");
      ARC200Service.initialize(clients);

      let balance = 0n;

      if (token.tokenStandard === "network") {
        // For network tokens (like VOI), get balance from account info
        const accountInfo = await clients.algod
          .accountInformation(userAddress)
          .do();
        balance = BigInt(accountInfo.amount);
      } else if (token.tokenStandard === "asa") {
        // For ASA tokens, get balance from account asset information
        const accountAssetInfo = await clients.algod
          .accountAssetInformation(userAddress, Number(token.assetId))
          .do();
        console.log("accountAssetInfo", accountAssetInfo);
        balance = BigInt(accountAssetInfo?.asset?.amount);
      } else if (
        token.tokenStandard === "arc200" &&
        (token.contractId || token.underlyingContractId)
      ) {
        // For ARC200 tokens, get balance from ARC200Service
        // Use underlyingContractId if available, otherwise fallback to contractId
        const contractId = token.underlyingContractId || token.contractId;
        console.log(
          `Fetching ARC200 balance for ${tokenSymbol} with contractId: ${contractId}`
        );
        const tokenBalance = await ARC200Service.getBalance(
          userAddress,
          contractId
        );
        console.log(`ARC200 balance result for ${tokenSymbol}:`, tokenBalance);
        balance = tokenBalance ? BigInt(tokenBalance) : 0n;
      } else {
        console.warn(`Unsupported token standard: ${token.tokenStandard}`);
        return null;
      }

      // Convert from base units to token units
      const actualBalance = new BigNumber(balance.toString())
        .dividedBy(new BigNumber(10).pow(token.decimals))
        .toNumber();

      console.log(`User wallet balance for ${tokenSymbol}:`, {
        balance: balance.toString(),
        actualBalance,
        tokenDecimals: token.decimals,
      });

      return actualBalance;
    }

    return null;
  } catch (error) {
    console.error("Error fetching user wallet balance:", error);
    return null;
  }
};

/**
 * Fetch user position for a specific market
 */
export const fetchUserPosition = async (
  userId: string,
  marketId: string,
  networkId: NetworkId
): Promise<UserPosition | null> => {
  try {
    const networkConfig = getCurrentNetworkConfig();

    // TODO: Replace with actual API call to lending protocol
    const mockPosition: UserPosition = {
      userId,
      marketId,
      supplyBalance: "10000000000", // 10K tokens
      borrowBalance: "5000000000", // 5K tokens
      collateralValue: "10000",
      borrowValue: "5000",
      healthFactor: 2.0,
      canBorrow: true,
      canSupply: true,
      canWithdraw: true,
      canRepay: true,
    };

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    return mockPosition;
  } catch (error) {
    console.error("Error fetching user position:", error);
    return null;
  }
};

/**
 * Fetch protocol statistics
 */
export const fetchProtocolStats = async (
  networkId: NetworkId
): Promise<ProtocolStats | null> => {
  try {
    const networkConfig = getCurrentNetworkConfig();

    // TODO: Replace with actual API call to lending protocol
    const mockStats: ProtocolStats = {
      totalMarkets: 15,
      activeMarkets: 12,
      totalSupplyValue: "50000000",
      totalBorrowValue: "20000000",
      totalUsers: 1250,
      utilizationRate: 0.4,
      totalReserves: "5000000",
      lastUpdated: new Date().toISOString(),
    };

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    return mockStats;
  } catch (error) {
    console.error("Error fetching protocol stats:", error);
    return null;
  }
};

/**
 * Fetch market utilization rate
 */
export const fetchMarketUtilization = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<number> => {
  try {
    const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
    return marketInfo?.utilizationRate || 0;
  } catch (error) {
    console.error("Error fetching market utilization:", error);
    return 0;
  }
};

/**
 * Fetch market supply and borrow rates
 */
export const fetchMarketRates = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<{ supplyRate: number; borrowRate: number } | null> => {
  try {
    const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
    if (!marketInfo) return null;

    return {
      supplyRate: marketInfo.supplyRate,
      borrowRate: marketInfo.borrowRateCurrent,
    };
  } catch (error) {
    console.error("Error fetching market rates:", error);
    return null;
  }
};

/**
 * Check if market is paused
 */
export const isMarketPaused = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<boolean> => {
  try {
    const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
    return marketInfo?.isPaused || false;
  } catch (error) {
    console.error("Error checking market pause status:", error);
    return false;
  }
};

/**
 * Fetch market health metrics
 */
export const fetchMarketHealth = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<{
  utilizationRate: number;
  supplyRate: number;
  borrowRate: number;
  isHealthy: boolean;
  riskLevel: "low" | "medium" | "high";
} | null> => {
  try {
    const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
    if (!marketInfo) return null;

    const utilizationRate = marketInfo.utilizationRate;
    let riskLevel: "low" | "medium" | "high" = "low";

    if (utilizationRate > 0.8) {
      riskLevel = "high";
    } else if (utilizationRate > 0.6) {
      riskLevel = "medium";
    }

    const isHealthy = utilizationRate < 0.9 && !marketInfo.isPaused;

    return {
      utilizationRate,
      supplyRate: marketInfo.supplyRate,
      borrowRate: marketInfo.borrowRateCurrent,
      isHealthy,
      riskLevel,
    };
  } catch (error) {
    console.error("Error fetching market health:", error);
    return null;
  }
};

/**
 * Withdraw tokens from a lending market
 */
export const withdraw = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("withdraw", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
    tokenStandard,
  });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      const token = allTokens.find(
        (token) => token.underlyingContractId === marketId
      );

      if (!token) {
        throw new Error("Token not found");
      }

      // Convert amount to proper units (considering decimals)
      const amountInSmallestUnit = new BigNumber(amount)
        .multipliedBy(10 ** token.decimals)
        .toFixed(0);

      // Get market info
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }

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

      const contractIds = {
        lending: Number(poolId),
        token: Number(token.underlyingContractId),
        ntoken: Number(marketInfo.ntokenId),
      };

      console.log("contractIds", { contractIds });

      const builder = {
        lending: new CONTRACT(
          contractIds.lending,
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
          contractIds.token,
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
        ntoken: new CONTRACT(
          contractIds.ntoken,
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
      };

      console.log("builder", { builder });

      let customTx: any;

      const buildN = [];

      // Withdraw from lending pool
      {
        const txnO = (
          await builder.lending.withdraw(
            Number(marketId),
            BigInt(amountInSmallestUnit)
          )
        ).obj as any;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode("lending withdraw"),
          payment: 1e5,
          foreignApps: [46505155], // TODO use value from config
        });
      }

      // cond a token withdraw
      if (tokenStandard != "arc200") {
        const txnO = (
          await builder.token.withdraw(BigInt(amountInSmallestUnit))
        ).obj;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode("atoken withdraw"),
        });
      }

      console.log("buildN", { buildN });

      // Create withdraw transaction
      ci.setFee(20000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      if (networkConfig.networkId === "algorand-mainnet") {
        ci.setBeaconId(3209233839); // TODO move this to ulujs
      }

      customTx = await ci.custom();

      console.log("customTx", { customTx });

      if (!customTx.success) {
        throw new Error("Withdraw transaction failed");
      }

      return {
        success: true,
        txns: customTx.txns,
      };
    } else if (isEVMNetwork(networkId)) {
      // TODO: Implement EVM withdraw
      return {
        success: true,
        txId: `TXN_${Math.random().toString(36).substring(2, 15)}`,
      };
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error withdrawing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Withdraw failed",
    };
  }
};

/**
 * Deposit tokens into a lending market
 */
export const deposit = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("deposit", { poolId, marketId, amount, userAddress, networkId });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId);

      const token = allTokens.find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      // Convert amount to proper units (considering decimals)
      const bigAmount = BigInt(amount);

      console.log("bigAmount", { bigAmount });

      // Check if market is paused
      const marketPaused = await isMarketPaused(poolId, marketId, networkId);
      if (marketPaused) {
        throw new Error("Market is paused");
      }

      // Get market info to check limits
      console.log({
        fetchMarketInfo: {
          poolId,
          marketId,
          networkId,
        },
      });
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }

      // Check if deposit would exceed max total deposits
      const currentTotalDeposits = new BigNumber(marketInfo.totalDeposits);
      const maxTotalDeposits = new BigNumber(marketInfo.maxTotalDeposits);
      const depositAmount = new BigNumber(amount);

      // TODO: Uncomment this
      // if (
      //   currentTotalDeposits.plus(bigAmount).isGreaterThan(maxTotalDeposits)
      // ) {
      //   throw new Error("Deposit would exceed maximum total deposits");
      // }

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

      const ciLending = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      ciLending.setFee(5000);
      ciLending.setPaymentAmount(1e5);

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
          Number(token.underlyingContractId),
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
        ntoken: new CONTRACT(
          Number(marketInfo.ntokenId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: userAddress,
            sk: new Uint8Array(),
          }
        ),
      };

      let customTx: any;

      for (const p of [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ]) {
        const [p1, p2, p3] = p;

        const buildN = [];

        // TODO fund ntoken

        // conditionally deposit to token
        if (tokenStandard == "network") {
          if (p1 > 0) {
            const txnO = (
              await builder.token.createBalanceBox(
                algosdk.encodeAddress(
                  algosdk.getApplicationAddress(Number(poolId)).publicKey
                )
              )
            ).obj;
            console.log("createBalanceBox", { txnO });
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode("nt200 createBalanceBox"),
            });
          }
          if (p2 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28501,
              note: new TextEncoder().encode("nt200 createBalanceBox"),
            });
          }
          {
            const txnO = (await builder.token.deposit(BigInt(amount))).obj;
            buildN.push({
              ...txnO,
              payment: BigInt(amount),
              note: new TextEncoder().encode("nt200 deposit"),
            });
          }
        } else if (tokenStandard == "asa") {
          const payment = 28502;
          const aamt = BigInt(amount);
          const xaid = Number(token.underlyingAssetId);
          const axfer = { payment, aamt, xaid };
          console.log("axfer", { axfer });
          const txnO = (await builder.token.deposit(BigInt(amount))).obj;
          buildN.push({
            ...txnO,
            ...axfer,
            note: new TextEncoder().encode("nt200 deposit"),
          });
        }

        // approve spending of token
        {
          const txnO = (
            await builder.token.arc200_approve(
              algosdk.encodeAddress(
                algosdk.getApplicationAddress(Number(poolId)).publicKey
              ),
              BigInt(new BigNumber(amount).multipliedBy(1.1).toFixed(0)) // TODO only increase for NODE
            )
          ).obj;
          buildN.push({
            ...txnO,
            payment: 28503,
            note: new TextEncoder().encode("arc200 approve"),
          });
        }

        // arc200 transfer
        {
          const receiver = algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          );
          const txnO = (await builder.token.arc200_transfer(receiver, 0)).obj;
          buildN.push({
            ...txnO,
            payment: 28504,
            note: new TextEncoder().encode(`arc200 transfer`),
          });
        }

        // deposit to lending pool
        {
          // TODO fetch from config
          const foreignApps = [];
          if (networkConfig.networkId === "voi-mainnet") {
            foreignApps.push(47138065);
          }
          if (networkConfig.networkId === "algorand-mainnet") {
            foreignApps.push(3333688254);
          }
          const depositCost = p3 > 0 ? 0 : 900000;
          const txnO = (
            await builder.lending.deposit(Number(marketId), BigInt(amount))
          ).obj as any;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending deposit"),
            payment: depositCost,
            foreignApps,
          });
        }

        console.log("buildN", { buildN });

        // Create deposit transaction
        ci.setFee(20000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }

        customTx = await ci.custom();

        console.log("customTx", { customTx });

        if (customTx.success) {
          break;
        }
      }

      console.log("customTx", { customTx });

      if (!customTx.success) {
        throw new Error("Failed to create deposit transaction");
      }

      return {
        success: true,
        txns: [...customTx.txns],
      };
    } else if (isEVMNetwork(networkId)) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error depositing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Migrate tokens from old pool to new pool
 * Combines withdraw from old pool and deposit to new pool in a single transaction group
 */
export const migrate = async (
  oldPoolId: string,
  oldContractId: string,
  oldNTokenId: string,
  newPoolId: string,
  newContractId: string,
  tokenStandard: TokenStandard,
  amount: string, // Amount in human-readable format
  userAddress: string,
  networkId: NetworkId,
  assetId?: string // Asset ID for network/ASA tokens
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("migrate", {
    oldPoolId,
    oldContractId,
    oldNTokenId,
    newPoolId,
    newContractId,
    amount,
    userAddress,
    networkId,
    tokenStandard,
  });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get token information for decimals
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      const token = allTokens.find(
        (token) => token.underlyingContractId === newContractId
      );

      if (!token) {
        throw new Error("Token not found for new contract");
      }

      // Convert amount to proper units (considering decimals)
      const amountInSmallestUnit = new BigNumber(amount)
        .multipliedBy(10 ** token.decimals)
        .toFixed(0);
      const bigAmount = BigInt(amountInSmallestUnit);

      console.log({
        amountInSmallestUnit,
        bigAmount,
        amount,
        token,
      });

      // Get old market info
      const oldMarketInfo = await fetchMarketInfo(
        oldPoolId,
        oldContractId,
        networkId
      );
      if (!oldMarketInfo) {
        throw new Error("Failed to fetch old market info");
      }

      // Get new market info
      const newMarketInfo = await fetchMarketInfo(
        newPoolId,
        newContractId,
        networkId
      );
      if (!newMarketInfo) {
        throw new Error("Failed to fetch new market info");
      }

      // Check if new market is paused
      const marketPaused = await isMarketPaused(
        newPoolId,
        newContractId,
        networkId
      );
      if (marketPaused) {
        throw new Error("New market is paused");
      }

      // Create contract instances
      const ci = new CONTRACT(
        Number(oldNTokenId),
        clients.algod,
        undefined,
        abi.custom,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const builder = {
        oldNToken: new CONTRACT(
          Number(oldNTokenId),
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
        oldToken: new CONTRACT(
          Number(oldContractId),
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
        newToken: new CONTRACT(
          Number(newContractId),
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
        oldLendingPool: new CONTRACT(
          Number(oldPoolId),
          clients.algod,
          undefined,
          {
            ...LendingPoolAppSpec.contract,
            events: [],
            methods: [
              // withdraw(uint64 market_id, uint256 amount) void
              {
                name: "withdraw",
                args: [
                  {
                    type: "uint64",
                    name: "market_id",
                  },
                  {
                    type: "uint256",
                    name: "amount",
                  },
                ],
                readonly: false,
                returns: {
                  type: "void",
                },
              },
              // get_market(uint64 token_id) (bool,uint256,uint256,uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,uint256,uint64,uint256,uint256,uint64,uint64)
              {
                name: "get_market",
                args: [
                  {
                    type: "uint64",
                    name: "token_id",
                  },
                ],
                readonly: true,
                returns: {
                  type: "(bool,uint256,uint256,uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,uint256,uint64,uint256,uint256,uint64,uint64)",
                },
              },
            ],
          },
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        newLendingPool: new CONTRACT(
          Number(newPoolId),
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
      };

      let customR: any;

      // Try different combinations of balance box creation
      for (const p of [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]) {
        const [p1, p2] = p;
        const buildN = [];

        // Step 1: Withdraw from old lending pool
        {
          const txnO = (
            await builder.oldLendingPool.withdraw(
              Number(newContractId),
              bigAmount
            )
          ).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending withdraw"),
          });
        }
        // at this point we have an arc200 token in any case no need to withdraw
        // to underlying token
        //
        // the user should already have all the arc200 balances setup

        // Step 2: Approve new token for lending pool
        {
          const txnO = (
            await builder.oldToken.arc200_approve(
              algosdk.encodeAddress(
                algosdk.getApplicationAddress(Number(newPoolId)).publicKey
              ),
              bigAmount
            )
          ).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("nt200 approve"),
            payment: p1 > 0 ? 28100 : 0,
          });
        }

        // Step 5: Conditionally create balance box for pool
        // {
        //   const txnO = (
        //     await builder.oldToken.createBalanceBox(
        //       algosdk.encodeAddress(
        //         algosdk.getApplicationAddress(Number(newPoolId)).publicKey
        //       )
        //     )
        //   ).obj;
        //   buildN.push({
        //     ...txnO,
        //     payment: 28500,
        //     note: new TextEncoder().encode("nt200 createBalanceBox"),
        //   });
        // }

        // Step 6: Deposit to new lending pool
        {
          const foreignApps = [];
          if (networkConfig.networkId === "voi-mainnet") {
            foreignApps.push(47138065);
          }
          if (networkConfig.networkId === "algorand-mainnet") {
            foreignApps.push(3333688254);
          }
          const txnO = (
            await builder.newLendingPool.deposit(
              Number(newContractId),
              bigAmount
            )
          ).obj as any;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending deposit"),
            payment: p2 > 0 ? 900000 : 0,
            foreignApps,
          });
        }

        console.log("buildN", { buildN });

        // Create migration transaction
        ci.setFee(9000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }

        customR = await ci.custom();
        console.log({ customR });

        if (customR.success) {
          break;
        }
      }

      if (!customR.success) {
        throw new Error("Failed to create migrate transaction");
      }

      return {
        success: true,
        txns: customR.txns,
      };
    } else if (isEVMNetwork(networkId)) {
      // TODO: Implement EVM migrate
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error migrating:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Migration failed",
    };
  }
};

/**
 * Borrow tokens from a lending market
 */
export const borrow = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("borrow", { poolId, marketId, amount, userAddress, networkId });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId);

      const token = allTokens.find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      // Convert amount to proper units (considering decimals)
      const bigAmount = BigInt(amount);

      // Check if market is paused
      const marketPaused = await isMarketPaused(poolId, marketId, networkId);
      if (marketPaused) {
        throw new Error("Market is paused");
      }

      // Get market info and user global data to check borrowing capacity
      console.log({
        fetchMarketInfo: {
          poolId,
          marketId,
          networkId,
        },
      });
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }

      console.log("marketInfo", { marketInfo });

      // Get user global data to check borrowing capacity
      const userGlobalData = await fetchUserGlobalData(userAddress, networkId);
      if (!userGlobalData) {
        throw new Error("Failed to fetch user global data");
      }

      console.log("userGlobalData", { userGlobalData });

      const borrowAmount = new BigNumber(amount);

      // Check if borrow would exceed available liquidity in the market
      const currentTotalDeposits = new BigNumber(marketInfo.totalDeposits);
      const currentTotalBorrows = new BigNumber(marketInfo.totalBorrows);
      const availableLiquidity =
        currentTotalDeposits.minus(currentTotalBorrows);

      if (borrowAmount.isGreaterThan(availableLiquidity)) {
        //throw new Error("Insufficient liquidity available for borrowing");
      }

      // Check if borrow would exceed max total borrows for the market
      const maxTotalBorrows = new BigNumber(marketInfo.maxTotalBorrows);
      if (
        currentTotalBorrows.plus(borrowAmount).isGreaterThan(maxTotalBorrows)
      ) {
        //throw new Error("Borrow would exceed maximum total borrows");
      }

      // Collateral-based validation removed

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
      const ciLending = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: userAddress, sk: new Uint8Array() }
      );

      ciLending.setFee(5000);
      ciLending.setPaymentAmount(1e5);
      const fetch_price_feedR = await ciLending.fetch_price_feed(
        Number(marketId)
      );
      console.log("fetch_price_feedR", { fetch_price_feedR });
      const doFetchPriceFeed = fetch_price_feedR.success;

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
          Number(token.underlyingContractId),
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
        ntoken: new CONTRACT(
          Number(marketInfo.ntokenId),
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
          Number(token.underlyingContractId),
          clients.algod,
          undefined,
          {
            name: "arc200Exchange",
            desc: "arc200Exchange",
            methods: [
              // arc200_swapBack(uint64 amount)
              {
                name: "arc200_swapBack",
                args: [{ name: "amount", type: "uint64" }],
                returns: { type: "void" },
              },
            ],
            events: [],
          },
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      ciLending.setFee(5000);
      const calculate_user_debt_interestR =
        await ciLending.calculate_user_debt_interest(
          userAddress,
          Number(marketId)
        );
      console.log("calculate_user_debt_interestR", {
        calculate_user_debt_interestR,
      });
      const calculate_user_debt_interest =
        calculate_user_debt_interestR.returnValue;
      console.log("calculate_user_debt_interest", {
        calculate_user_debt_interest,
      });

      const sync_marketR = await ciLending.sync_market(Number(marketId));
      console.log("sync_marketR", { sync_marketR });

      let customTx: any;

      // p1 - create balance box user
      // p2 -
      // p3 -
      for (const p of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]) {
        const [p1, p2] = p;
        const buildN = [];

        // cond create balance box user if needed and network token
        if (tokenStandard == "network") {
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode("nt200 createBalanceBox"),
            });
          }
        }

        // Borrow from lending pool
        {
          // TODO fetch from config
          const foreignApps = [];
          if (networkConfig.networkId === "voi-mainnet") {
            foreignApps.push(47138065);
          }
          if (networkConfig.networkId === "algorand-mainnet") {
            foreignApps.push(3333688254);
          }
          const borrowCost = p2 > 0 ? 900000 : 0;
          const txnO = (
            await builder.lending.borrow(Number(marketId), BigInt(amount))
          ).obj as any;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending borrow"),
            payment: borrowCost,
            foreignApps,
          });
        }

        // user withdraws from nt200 token
        if (tokenStandard == "network") {
          {
            const txnO = (await builder.token.withdraw(BigInt(amount))).obj;
            buildN.push({
              ...txnO,
              note: new TextEncoder().encode("nt200 withdraw"),
            });
          }
        }
        // user withdraws from nnt200 token
        else if (tokenStandard == "asa") {
          const txnO = (await builder.token.withdraw(BigInt(amount))).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("nt200 withdraw"),
          });
        }
        // user withdraws from arc200-exchange
        else if (tokenStandard == "arc200-exchange") {
          const txnO = (
            await builder.arc200Exchange.arc200_swapBack(BigInt(amount))
          ).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("arc200_swapBack"),
            xaid: Number(token.underlyingAssetId),
            snd: userAddress,
            arcv: userAddress,
          });
        }

        console.log("buildN", { buildN });

        // Create borrow transaction
        ci.setFee(20000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }

        customTx = await ci.custom();

        console.log("customTx", { customTx });

        if (customTx.success) {
          break;
        }
      }

      console.log("customTx", { customTx });

      if (!customTx.success) {
        throw new Error("Failed to create borrow transaction");
      }

      return {
        success: true,
        txns: [...customTx.txns],
      };
    } else if (isEVMNetwork(networkId)) {
      throw new Error("EVM networks are not supported yet");
    } else {
      throw new Error("Unsupported network");
    }
  } catch (error) {
    console.error("Error borrowing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Repay borrowed tokens to a lending market
 */
export const repay = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("repay", { poolId, marketId, amount, userAddress, networkId });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const arc200Service = ARC200Service.initialize(clients);
      console.log("arc200Service", { arc200Service });
      const balance = await ARC200Service.getBalance(userAddress, marketId);
      console.log("balance", { balance });
      const tokenInfo = await ARC200Service.getTokenInfo(marketId);
      console.log("tokenInfo", { tokenInfo });

      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId);

      const token = allTokens.find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      // Convert amount to proper units (considering decimals)
      const bigAmount = BigInt(
        new BigNumber(amount).multipliedBy(10 ** token.decimals).toFixed(0)
      );

      const symbol = token.symbol;

      // Check if market is paused
      const marketPaused = await isMarketPaused(poolId, marketId, networkId);
      if (marketPaused) {
        throw new Error("Market is paused");
      }

      // Get market info
      console.log({
        fetchMarketInfo: {
          poolId,
          marketId,
          networkId,
        },
      });
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }
      console.log("marketInfo", { marketInfo });
      const userPosition = await fetchUserPosition(
        userAddress,
        marketId,
        networkId
      );
      console.log("userPosition", { userPosition });

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

      const contractIds = {
        lending: Number(poolId),
        token: Number(token.underlyingContractId),
        ntoken: Number(marketInfo.ntokenId),
      };

      console.log("contractIds", { contractIds });

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
          Number(token.underlyingContractId),
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
          Number(token.underlyingContractId),
          clients.algod,
          undefined,
          {
            name: "arc200Exchange",
            desc: "arc200Exchange",
            methods: [
              // arc200_redeem(uint64)void
              {
                name: "arc200_redeem",
                args: [{ name: "amount", type: "uint64" }],
                returns: { type: "void" },
              },
            ],
            events: [],
          },
          {
            addr: userAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        ntoken: new CONTRACT(
          Number(marketInfo.ntokenId),
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
      };

      console.log("repay parameters:", {
        poolId: Number(poolId),
        marketId: Number(marketId),
        amount: bigAmount,
        userAddress,
        tokenStandard,
      });

      let customR: any;
      for (const [p1, p2] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const buildN = [];

        if (tokenStandard == "network") {
          // create balance box for pool
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode("nt200 createBalanceBox"),
            });
          }
          // user withdraws from nt200 token
          {
            const txnO = (await builder.token.deposit(bigAmount)).obj;
            buildN.push({
              ...txnO,
              note: new TextEncoder().encode("nt200 deposit"),
              payment: bigAmount,
            });
          }
        } else if (tokenStandard === "asa") {
          // create balance box for pool
          if (p1 > 0) {
            const addr = algosdk.encodeAddress(
              algosdk.getApplicationAddress(Number(poolId)).publicKey
            );
            const txnO = (await builder.token.createBalanceBox(addr)).obj;
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode(
                `nt200 createBalanceBox arc200 ${symbol} token for pool ${addr}`
              ),
            });
          }
          // create balance box for user
          if (p2 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28501,
              note: new TextEncoder().encode(
                `nt200 createBalanceBox arc200 ${symbol} token for ${userAddress}`
              ),
            });
          }
          // deposit to arc200
          {
            const txnO = (await builder.token.deposit(bigAmount)).obj;
            const axfer = {
              aamt: bigAmount,
              xaid: Number(token.underlyingAssetId),
            };
            buildN.push({
              ...txnO,
              ...axfer,
              note: new TextEncoder().encode(
                `nt200 deposit ${symbol} token for user (${userAddress})`
              ),
            });
          }
        } else if (tokenStandard == "arc200-exchange") {
          const axfer = {
            aamt: bigAmount,
            xaid: Number(token.underlyingAssetId),
          };
          const txnO = (await builder.arc200Exchange.arc200_redeem(bigAmount))
            .obj;
          buildN.push({
            ...txnO,
            ...axfer,
            note: new TextEncoder().encode("arc200_redeem"),
          });
        }
        // all payment to pool are arc200 payments trough approval
        // approve spending of token (non stoken only)
        // TODO check if this is needed
        {
          const addr = algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          );
          const txnO = (await builder.token.arc200_approve(addr, bigAmount))
            .obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode(
              `arc200 approve ${symbol} token spending to pool (${addr}) for user (${userAddress})`
            ),
          });
        }
        // repay tp lending pool
        {
          const txnO = (
            await builder.lending.repay(Number(marketId), bigAmount)
          ).obj as any;
          buildN.push({
            ...txnO,
            payment: 1e5,
            note: new TextEncoder().encode("lending repay"),
          });
        }
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        ci.setFee(1e5);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }
        customR = await ci.custom();
        console.log("customR", { customR });
        if (customR.success) {
          break;
        }
      }
      if (!customR.success) {
        throw new Error("Failed to create repay transaction");
      }
      return {
        success: true,
        txns: customR.txns,
      };
    } else {
      throw new Error("EVM networks not yet supported");
    }
  } catch (error) {
    console.error("Repay error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Repay failed",
    };
  }
};

export const mint = async (
  userAddress: string,
  poolId: string,
  marketId: string,
  amount: string,
  networkId: NetworkId,
  clients: any,
  signTransactions: any
): Promise<{ success: boolean; txId?: string; error?: string }> => {
  console.log("mint", { poolId, marketId, amount, userAddress, networkId });

  try {
    const networkConfig = getCurrentNetworkConfig();

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });

      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId);

      const token = allTokens.find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      // Get the original token config to access tokenStandard
      const originalTokenConfig = getTokenConfig(networkId, token.symbol);
      if (!originalTokenConfig) {
        throw new Error(`Token config not found for ${token.symbol}`);
      }

      console.log("Original token config:", originalTokenConfig);

      // For now, we'll use the same logic as borrow but call it "mint"
      // In a real implementation, this would call a different contract method
      const result = await borrow(
        poolId,
        marketId,
        originalTokenConfig.tokenStandard,
        amount,
        userAddress,
        networkId
      );

      if (result.success) {
        return {
          success: true,
          txId: "txId" in result ? result.txId : undefined,
        };
      } else {
        return {
          success: false,
          error: result.error || "Minting failed",
        };
      }
    } else {
      throw new Error("Unsupported network for minting");
    }
  } catch (error: any) {
    console.error("Minting error:", error);
    return {
      success: false,
      error: error.message || "An error occurred during minting",
    };
  }
};
