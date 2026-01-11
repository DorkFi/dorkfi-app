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
  getAlgorandNetworkFromNetworkId,
  NetworkId,
  getAllTokensWithDisplayInfo,
  getTokenConfig,
  getLendingPools,
  getPreFiParameters,
  TokenConfig,
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
import dorkfiAPIService from "./dorkfiAPIService";

export interface MarketData {
  appId: string;
  network: string;
  marketId: string;
  paused: boolean;
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
  lastUpdateTime: string;
  reserves: string;
  price: string;
  ntokenId: string;
  closeFactor: string;
  lastUpdated: number;
}

export const decodeMarketData = (market: any[]): MarketData => {
  return {
    appId: market[0].toString(),
    network: market[1].toString(),
    marketId: market[2].toString(),
    paused: market[0] as boolean,
    maxTotalDeposits: market[1].toString(),
    maxTotalBorrows: market[2].toString(),
    liquidationBonus: market[3].toString(),
    collateralFactor: market[4].toString(),
    liquidationThreshold: market[5].toString(),
    reserveFactor: market[6].toString(),
    borrowRate: market[7].toString(),
    slope: market[8].toString(),
    totalScaledDeposits: market[9].toString(),
    totalScaledBorrows: market[10].toString(),
    depositIndex: market[11].toString(),
    borrowIndex: market[12].toString(),
    lastUpdateTime: market[13].toString(),
    reserves: market[14].toString(),
    price: market[15].toString(),
    ntokenId: market[16].toString(),
    closeFactor: market[17].toString(),
    lastUpdated: Date.now(),
  };
};

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

/**
 * Raw market data as returned from the contract (tuple format)
 * Index 0: paused (boolean)
 * Indices 1-17: BigInt values for market parameters
 */
export type RawMarket = [
  boolean, // [0] paused
  bigint, // [1] maxTotalDeposits
  bigint, // [2] maxTotalBorrows
  bigint, // [3] liquidationBonus
  bigint, // [4] collateralFactor
  bigint, // [5] liquidationThreshold
  bigint, // [6] reserveFactor
  bigint, // [7] borrowRate
  bigint, // [8] slope
  bigint, // [9] totalScaledDeposits
  bigint, // [10] totalScaledBorrows
  bigint, // [11] depositIndex
  bigint, // [12] borrowIndex
  bigint, // [13] lastUpdateTime
  bigint, // [14] reserves
  bigint, // [15] price
  bigint, // [16] ntokenId
  bigint // [17] closeFactor
];

export const decodeMarket = (market: RawMarket): Market => {
  return {
    paused: market[0],
    maxTotalDeposits: market[1],
    maxTotalBorrows: market[2],
    liquidationBonus: market[3],
    collateralFactor: market[4],
    liquidationThreshold: market[5],
    reserveFactor: market[6],
    borrowRate: market[7],
    slope: market[8],
    totalScaledDeposits: market[9],
    totalScaledBorrows: market[10],
    depositIndex: market[11],
    borrowIndex: market[12],
    lastUpdateTime: market[13],
    reserves: market[14],
    price: market[15],
    ntokenId: market[16],
    closeFactor: market[17],
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

export const enhanceAVMMarketInfo = (
  market: any,
  token?: TokenConfig
): MarketInfo => {
  console.log("enhanceAVMMarketInfo", { market, token });

  const poolId = market.poolId || market.appId;
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
    // Default to 6 decimals (standard for VOI and most Algorand tokens) instead of 0
    // Using 0 would cause values to appear 1,000,000x larger than they should be
    const decimals = token?.decimals ?? 6;
    return new BigNumber(deposit)
      .div(new BigNumber(10).pow(decimals))
      .toFixed(4);
  };

  const totalDeposits = formatDeposit(market.totalScaledDeposits.toString());

  const totalBorrows = formatDeposit(market.totalScaledBorrows.toString());

  // For b market (poolId 47139781), use 2% (200 basis points) as base borrow rate
  // Otherwise use the borrow rate from the contract
  const baseBorrowRateBps =
    poolId === "47139781"
      ? 200 // 2% = 200 basis points for b market
      : parseFloat(market.borrowRate.toString());

  // Calculate APY using the new utility function
  const apyCalculation = calculateDepositAPY(
    {
      borrowRate: baseBorrowRateBps,
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
      borrowRate: baseBorrowRateBps,
      slope: parseFloat(market.slope.toString()),
      reserveFactor: parseFloat(market.reserveFactor.toString()),
    },
    {
      totalScaledDeposits: market.totalScaledDeposits.toString(),
      totalScaledBorrows: market.totalScaledBorrows.toString(),
      lastUpdateTime: Number(market.lastUpdateTime),
    },
    token?.isStoken || false
  );

  const marketInfo: MarketInfo = {
    networkId: market.network,
    poolId: String(poolId),
    marketId: String(market.marketId),
    tokenId: market.ntokenId.toString(),
    tokenContractId: market.ntokenId.toString(),
    name: token?.name || "",
    symbol: token?.symbol || "",
    decimals: token?.decimals ?? 6,
    collateralFactor: parseFloat(market.collateralFactor.toString()) / 10000,
    liquidationThreshold:
      parseFloat(market.liquidationThreshold.toString()) / 10000,
    reserveFactor: parseFloat(market.reserveFactor.toString()) / 10000,
    borrowRate: parseFloat(market.borrowRate.toString()) / 10000,
    slope: parseFloat(market.slope.toString()) / 10000,
    maxTotalDeposits: BigNumber(market.maxTotalDeposits.toString())
      .div(10 ** (token?.decimals ?? 6))
      .toFixed(0),
    maxTotalBorrows: BigNumber(market.maxTotalBorrows.toString())
      .div(10 ** (token?.decimals ?? 6))
      .toFixed(0),
    liquidationBonus: parseFloat(market.liquidationBonus.toString()) / 10000,
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
};

export const fetchMarketInfoFromContract = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<MarketData> => {
  console.log("fetchMarketInfoFromContract", { poolId, marketId, networkId });
  try {
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
          addr: algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          ),
          sk: new Uint8Array(),
        }
      );
      ci.setFee(5000);
      const marketR = await ci.sync_market(Number(marketId));
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
      return {
        ...decodeMarketData(marketR.returnValue),
        appId: poolId,
        marketId,
        network: networkId,
        lastUpdated: Date.now(),
      };
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
 * Fetch market information for a specific market
 */
export const fetchMarketInfo = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId,
  source: "contract" | "api" = "api"
): Promise<MarketInfo | null> => {
  console.log("fetchMarketInfo", { poolId, marketId, networkId });
  try {
    if (!poolId || !marketId || !networkId || !source) {
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
      let marketData: MarketData | null = null;
      if (source === "contract") {
        marketData = await fetchMarketInfoFromContract(
          poolId,
          marketId,
          networkId
        );
      } else if (source === "api") {
        const getMarketResponse = await dorkfiAPIService.getMarketData(
          networkId,
          Number(poolId),
          Number(marketId)
        );
        if (!getMarketResponse?.success || !getMarketResponse?.data) {
          marketData = await fetchMarketInfoFromContract(
            poolId,
            marketId,
            networkId
          );
        } else {
          // Convert API Market to local MarketData format
          const apiMarket = getMarketResponse.data;
          console.log({ apiMarket });
          marketData = apiMarket as unknown as MarketData;
        }
      }

      console.log(
        "=============== [fetchMarketInfo] marketData ===============",
        { marketData }
      );

      // const clients = await algorandService.initializeClientsForReads(
      //   networkConfig.walletNetworkId as AlgorandNetwork
      // );

      // const ci = new CONTRACT(
      //   Number(poolId),
      //   clients.algod,
      //   undefined,
      //   { ...LendingPoolAppSpec.contract, events: [] },
      //   {
      //     addr: algosdk.encodeAddress(
      //       algosdk.getApplicationAddress(Number(poolId)).publicKey
      //     ),
      //     sk: new Uint8Array(),
      //   }
      // );

      const token = getAllTokensWithDisplayInfo(networkId).find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("fetchMarketInfo token", { token });

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
      // For tokens with multiple markets (array), find the one matching the poolId
      const tokenConfigRaw = networkConfig.tokens[token.symbol];
      console.log("fetchMarketInfo tokenConfigRaw", { tokenConfigRaw, token });
      let tokenConfig: TokenConfig | undefined;
      if (Array.isArray(tokenConfigRaw)) {
        // Find the token config that matches the poolId
        tokenConfig =
          tokenConfigRaw.find((config) => config.poolId === poolId) ||
          tokenConfigRaw[0];
      }
      console.log("fetchMarketInfo tokenConfig", { tokenConfig });

      // const marketR = await ci.get_market(Number(marketId));

      // console.log("marketR", { marketR });

      // if (!marketR.success) {
      //   console.error(`Contract call failed for market ${marketId}:`, marketR);
      //   throw new Error(`Failed to get market info for market ${marketId}`);
      // }

      // if (!marketR.returnValue || !Array.isArray(marketR.returnValue)) {
      //   console.error(
      //     `Invalid market data structure for market ${marketId}:`,
      //     marketR.returnValue
      //   );
      //   throw new Error(`Invalid market data structure for market ${marketId}`);
      // }

      // // Debug: Log raw market data to verify field order
      // console.log("Raw market data:", marketR.returnValue);
      // console.log("Field count:", marketR.returnValue.length);

      // if (marketR.returnValue.length < 18) {
      //   console.error(
      //     `Insufficient market data fields for market ${marketId}. Expected 18, got ${marketR.returnValue.length}`
      //   );
      //   throw new Error(
      //     `Insufficient market data fields for market ${marketId}`
      //   );
      // }

      // const market = decodeMarket(marketR.returnValue);

      const market = marketData as MarketData;

      // Debug: Log decoded market data
      // console.log("Decoded market data:", {
      //   depositIndex: market.depositIndex.toString(),
      //   borrowIndex: market.borrowIndex.toString(),
      //   maxTotalDeposits: market.maxTotalDeposits.toString(),
      //   maxTotalBorrows: market.maxTotalBorrows.toString(),
      // });

      const utilizationRate =
        market.totalScaledDeposits == "0"
          ? 0
          : new BigNumber(market.totalScaledBorrows)
              .div(market.totalScaledDeposits)
              .toNumber();

      const supplyRate = new BigNumber(market.borrowRate)
        .multipliedBy(utilizationRate)
        .multipliedBy(10000 - Number(market.reserveFactor))
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

      const totalDeposits = formatDeposit(market.totalScaledDeposits);

      const totalBorrows = formatDeposit(market.totalScaledBorrows);

      // For b market (poolId 47139781), use 2% (200 basis points) as base borrow rate
      // Otherwise use the borrow rate from the contract
      const baseBorrowRateBps =
        poolId === "47139781"
          ? 200 // 2% = 200 basis points for b market
          : parseFloat(market.borrowRate);

      // Calculate APY using the new utility function
      const apyCalculation = calculateDepositAPY(
        {
          borrowRate: baseBorrowRateBps,
          slope: parseFloat(market.slope),
          reserveFactor: parseFloat(market.reserveFactor),
        },
        {
          totalScaledDeposits: market.totalScaledDeposits,
          totalScaledBorrows: market.totalScaledBorrows,
          lastUpdateTime: Number(market.lastUpdateTime),
        }
      );

      // Calculate borrow APY using the new utility function
      const borrowApyCalculation = calculateBorrowAPY(
        {
          borrowRate: baseBorrowRateBps,
          slope: parseFloat(market.slope),
          reserveFactor: parseFloat(market.reserveFactor),
        },
        {
          totalScaledDeposits: market.totalScaledDeposits,
          totalScaledBorrows: market.totalScaledBorrows,
          lastUpdateTime: Number(market.lastUpdateTime),
        },
        tokenConfig?.isStoken || false // Pass isSToken flag
      );

      const marketInfo: MarketInfo = {
        networkId: networkId,
        poolId: poolId,
        marketId: marketId,
        tokenId: market.ntokenId,
        tokenContractId: market.ntokenId,
        name: token?.name || "",
        symbol: token?.symbol || "",
        decimals: token?.decimals || 0,
        collateralFactor: parseFloat(market.collateralFactor) / 10000,
        liquidationThreshold: parseFloat(market.liquidationThreshold) / 10000,
        reserveFactor: parseFloat(market.reserveFactor) / 10000,
        borrowRate: parseFloat(market.borrowRate) / 10000,
        slope: parseFloat(market.slope) / 10000,
        maxTotalDeposits: BigNumber(market.maxTotalDeposits)
          .div(10 ** token?.decimals || 0)
          .toFixed(0),
        maxTotalBorrows: BigNumber(market.maxTotalBorrows)
          .div(10 ** token?.decimals || 0)
          .toFixed(0),
        liquidationBonus: parseFloat(market.liquidationBonus) / 10000,
        closeFactor: parseFloat(market.closeFactor) / 10000,
        totalDeposits,
        totalBorrows,
        utilizationRate,
        supplyRate,
        borrowRateCurrent: parseFloat(market.borrowRate) / 10000,
        price: formatPrice(market.price),
        isActive: true,
        isPaused: market.paused,
        ntokenId: market.ntokenId,
        lastUpdated: new Date().toISOString(),
        // Current market indices (for accurate position calculations)
        depositIndex: market.depositIndex,
        borrowIndex: market.borrowIndex,
        apyCalculation,
        borrowApyCalculation,
      };

      console.log("fetchMarketInfo marketInfo", { marketInfo, marketData });

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

          const marketInfo = await fetchMarketInfo(poolId, marketId, networkId); // uses API by default

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

        // Get current market data to access borrow index - fetch fresh from contract
        // to ensure we have the latest borrow index for accurate interest calculations
        const marketInfo = await fetchMarketInfo(
          poolId,
          marketId,
          networkId,
          "contract"
        );
        if (!marketInfo) {
          console.warn(`Failed to get market info for market ${marketId}`);
          return null;
        }

        // Convert scaled borrows to actual token amount using borrow index scaling
        // Formula from docs: underlying_amount = (scaled_borrows * current_borrow_index) / SCALE
        const scaledBorrows = userData.scaledBorrows.toString();
        const userBorrowIndex = userData.borrowIndex.toString(); // User's stored borrow index (when they borrowed)
        const currentBorrowIndex = marketInfo.borrowIndex; // Current market borrow index (includes accrued interest) - fresh from contract
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

    // Get the actual token config to access all properties
    const tokenConfigRaw = getTokenConfig(networkId, tokenSymbol);
    const tokenConfig = Array.isArray(tokenConfigRaw)
      ? tokenConfigRaw[0]
      : tokenConfigRaw;

    if (!tokenConfig) {
      console.warn(`Token config not found for symbol ${tokenSymbol}`);
      return null;
    }

    console.log(`Token found for ${tokenSymbol}:`, {
      symbol: token.symbol,
      contractId: tokenConfig.contractId,
      underlyingContractId: token.underlyingContractId,
      tokenStandard: tokenConfig.tokenStandard,
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

      if (tokenConfig.tokenStandard === "network") {
        // For network tokens (like VOI), get balance from account info
        const accountInfo = await clients.algod
          .accountInformation(userAddress)
          .do();
        balance = BigInt(accountInfo.amount);
      } else if (tokenConfig.tokenStandard === "asa") {
        // For ASA tokens, get balance from account asset information
        const accountAssetInfo = await clients.algod
          .accountAssetInformation(userAddress, Number(tokenConfig.assetId))
          .do();
        console.log("accountAssetInfo", accountAssetInfo);
        balance = BigInt(accountAssetInfo?.amount || 0);
      } else if (
        tokenConfig.tokenStandard === "arc200" &&
        (tokenConfig.contractId || token.underlyingContractId)
      ) {
        // For ARC200 tokens, get balance from ARC200Service
        // Use underlyingContractId if available, otherwise fallback to contractId
        const contractId = token.underlyingContractId || tokenConfig.contractId;
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
        console.warn(
          `Unsupported token standard: ${tokenConfig.tokenStandard}`
        );
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
    const networkConfig = getNetworkConfig(networkId);

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

      const formattedAmount = new BigNumber(amountInSmallestUnit)
        .dividedBy(10 ** token.decimals)
        .toFixed(token.decimals);

      // Get market info
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }

      // Calculate accrued interest for logging/validation
      let accruedInterest: number | undefined;
      let userScaledDeposits: bigint | null = null;
      try {
        const appAddress = algosdk.getApplicationAddress(Number(poolId));
        const tempCi = new CONTRACT(
          Number(poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr:
              typeof appAddress === "string"
                ? appAddress
                : appAddress.toString(),
            sk: new Uint8Array(),
          }
        );
        tempCi.setFee(2000);
        const userDataR = await tempCi.get_user(userAddress, Number(marketId));

        if (userDataR.success) {
          const userData = UserData(userDataR.returnValue);
          const scaledDeposits = userData.scaledDeposits?.toString();
          const userDepositIndex = userData.depositIndex?.toString();
          const currentDepositIndex = marketInfo.depositIndex;

          // Store user's scaled deposits for later use in withdraw validation
          if (scaledDeposits) {
            userScaledDeposits = BigInt(scaledDeposits);
          }

          if (scaledDeposits && userDepositIndex && currentDepositIndex) {
            const SCALE = BigInt(1e18);
            const scaledDepositsBigInt = BigInt(scaledDeposits);
            const currentIndexBigInt = BigInt(currentDepositIndex);
            const userIndexBigInt = BigInt(userDepositIndex);

            // Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE
            const currentDepositValueRaw =
              (scaledDepositsBigInt * currentIndexBigInt) / SCALE;

            // Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE
            const originalDepositRaw =
              (scaledDepositsBigInt * userIndexBigInt) / SCALE;

            // Convert to human-readable format
            const currentDepositValue =
              Number(currentDepositValueRaw) / Math.pow(10, token.decimals);
            const originalDeposit =
              Number(originalDepositRaw) / Math.pow(10, token.decimals);

            // Accrued Interest = Current Deposit Value - Original Deposit Amount
            accruedInterest = currentDepositValue - originalDeposit;

            console.log("Accrued interest calculation:", {
              scaledDeposits,
              userDepositIndex,
              currentDepositIndex,
              currentDepositValue,
              originalDeposit,
              accruedInterest,
            });
          }
        }
      } catch (error) {
        console.warn(
          "Failed to calculate accrued interest in withdraw handler:",
          error
        );
        // Don't throw - this is just for logging
      }
      accruedInterest = Math.max(accruedInterest, 0);
      accruedInterest = 0; // disables accrued interest withdraw for now

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
        ...(tokenStandard === "arc200-exchange"
          ? {
              arc200Exchange: new CONTRACT(
                Number(token.underlyingContractId),
                clients.algod,
                undefined,
                {
                  name: "arc200Exchange",
                  desc: "arc200Exchange",
                  methods: [
                    // arc200_swapBack(uint64)void
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
            }
          : {}),
      };

      console.log("builder", { builder });

      let customTx: any;

      const buildN = [];

      // sync user market for price_change
      // if (accruedInterest !== undefined && accruedInterest > 0) {
      //   const txnO = (
      //     await builder.lending.sync_user_market_for_price_change(
      //       userAddress,
      //       Number(marketId)
      //     )
      //   ).obj;
      //   buildN.push({
      //     ...txnO,
      //     note: new TextEncoder().encode(`lending sync_market ${marketId}`),
      //     payment: 1e5,
      //   });
      // }

      // Withdraw from lending pool
      {
        const SCALE = BigInt(1e18);
        const currentDepositIndex = BigInt(marketInfo.depositIndex);

        const smallAccumulatedInterest = new BigNumber(accruedInterest)
          .multipliedBy(10 ** token.decimals)
          .toFixed(0);
        console.log("smallAccumulatedInterest", { smallAccumulatedInterest });
        const withdrawAmount =
          BigInt(amountInSmallestUnit) + BigInt(smallAccumulatedInterest);

        // Convert actual withdraw amount to scaled deposits
        // Formula: scaledAmount = (actualAmount * SCALE) / currentDepositIndex
        let scaledWithdrawAmount =
          (withdrawAmount * SCALE) / currentDepositIndex;

        // Safety check: if calculated scaled amount exceeds user's actual scaled deposits,
        // use the user's actual scaled deposits instead
        if (
          userScaledDeposits !== null &&
          scaledWithdrawAmount > userScaledDeposits
        ) {
          console.warn(
            "Calculated scaled withdraw amount exceeds user's scaled deposits. Capping to user's scaled deposits.",
            {
              calculatedScaledAmount: scaledWithdrawAmount.toString(),
              userScaledDeposits: userScaledDeposits.toString(),
            }
          );
          scaledWithdrawAmount = userScaledDeposits;
        }

        console.log("Withdraw amount conversion:", {
          actualAmount: withdrawAmount.toString(),
          currentDepositIndex: currentDepositIndex.toString(),
          scaledAmount: scaledWithdrawAmount.toString(),
          userScaledDeposits: userScaledDeposits?.toString() || "not available",
        });

        const formattedAccumulatedInterest = new BigNumber(
          accruedInterest
        ).toFixed(token.decimals);
        const formattedWithdrawAmount = new BigNumber(withdrawAmount)
          .dividedBy(10 ** token.decimals)
          .toFixed(token.decimals);
        const txnO = (
          await builder.lending.withdraw(Number(marketId), scaledWithdrawAmount)
        ).obj as any;
        const note =
          accruedInterest !== undefined && accruedInterest > 0
            ? `lending withdraw ${formattedWithdrawAmount} (includes interest: ${formattedAccumulatedInterest})`
            : `lending withdraw ${formattedWithdrawAmount}`;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode(note),
          payment: 1e5 + 1,
          foreignApps: [46505155], // TODO use value from config
        });
      }

      // cond a token withdraw
      if (tokenStandard == "network" || tokenStandard == "asa") {
        const smallAccumulatedInterest = new BigNumber(accruedInterest)
          .multipliedBy(10 ** token.decimals)
          .toFixed(0);
        const withdrawAmount =
          BigInt(amountInSmallestUnit) + BigInt(smallAccumulatedInterest);
        const formmatedWithdrawAmount = new BigNumber(withdrawAmount)
          .dividedBy(10 ** token.decimals)
          .toFixed(token.decimals);
        const txnO = (await builder.token.withdraw(withdrawAmount)).obj;
        const note = `atoken withdraw ${formmatedWithdrawAmount}`;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode(note),
        });
      } else if (tokenStandard == "arc200-exchange") {
        const txnO = (
          await builder.arc200Exchange.arc200_swapBack(
            BigInt(amountInSmallestUnit)
          )
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

      // Create withdraw transaction
      ci.setFee(20000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      if (networkConfig.networkId === "algorand-mainnet") {
        ci.setBeaconId(3209233839); // TODO move this to ulujs
      }

      customTx = await ci.custom();

      console.log("customTx", { customTx });

      // Log withdrawal details including accrued interest if calculated
      if (accruedInterest !== undefined) {
        console.log("Withdrawal details:", {
          withdrawAmount: amount,
          accruedInterest,
          originalDeposit: parseFloat(amount) - accruedInterest,
          currentDepositValue: parseFloat(amount),
        });
      }

      if (!customTx.success) {
        if (customTx.error.match(/tried to spend/)) {
          throw new Error(customTx.error);
        } else if (
          customTx.error.match(
            /transaction [A-Z0-9]+: logic eval error: assert failed pc=[0-9]+. Details: app=[0-9]+, pc=[0-9]+, opcodes=frame_dig 4; b>=; assert; label191:/
          )
        ) {
          throw new Error("Insufficient liquidity for withdraw");
        }
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
  console.log("=== DEPOSIT DEBUG START ===");
  console.log("deposit called with:", {
    poolId,
    marketId,
    tokenStandard,
    amount,
    userAddress,
    networkId,
  });

  try {
    // Use the networkId parameter, not the current network
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig, networkId });
      // Convert networkId to AlgorandNetwork format
      const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);

      if (!algorandNetwork) {
        throw new Error(
          `Network ${networkId} is not an Algorand-compatible network`
        );
      }

      const clients = algorandService.initializeClients(algorandNetwork);
      // Get token information
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log("=== TOKEN LOOKUP DEBUG ===");
      console.log("Total tokens available:", allTokens.length);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          poolId: t.poolId,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Searching for token with:", {
        marketId,
        poolId,
        tokenStandard,
      });

      // First try to find by both poolId and marketId (for multi-market tokens)
      // If poolId is provided, prefer matching both poolId and underlyingContractId
      let token = poolId
        ? allTokens.find(
            (token) =>
              token.underlyingContractId === marketId && token.poolId === poolId
          )
        : null;

      console.log("First search (with poolId):", token ? "FOUND" : "NOT FOUND");
      if (token) {
        console.log("Matched token details:", {
          symbol: token.symbol,
          poolId: token.poolId,
          underlyingContractId: token.underlyingContractId,
          originalContractId: token.originalContractId,
        });
      }

      // Fall back to finding by marketId only if no match found with poolId
      if (!token) {
        console.log("Falling back to marketId-only search...");
        token = allTokens.find(
          (token) => token.underlyingContractId === marketId
        );
        console.log("Fallback search result:", token ? "FOUND" : "NOT FOUND");
        if (token) {
          console.log(
            "WARNING: Found token by marketId only, may not match poolId!"
          );
          console.log("Matched token details:", {
            symbol: token.symbol,
            poolId: token.poolId,
            underlyingContractId: token.underlyingContractId,
            originalContractId: token.originalContractId,
          });
          console.log(
            "Expected poolId:",
            poolId,
            "Found poolId:",
            token.poolId
          );
        }
      }

      console.log("=== FINAL TOKEN SELECTED ===");
      console.log("Token found:", token);

      if (!token) {
        console.error("=== TOKEN NOT FOUND ERROR ===");
        console.error(
          "Token not found for marketId:",
          marketId,
          "poolId:",
          poolId
        );
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        console.error(
          "Available poolIds:",
          allTokens.map((t) => t.poolId)
        );
        throw new Error("Token not found");
      }

      // Convert amount to proper units (considering decimals)
      const bigAmount = BigInt(amount);
      console.log("=== AMOUNT CONVERSION ===");
      console.log("Input amount (string):", amount);
      console.log("Converted amount (BigInt):", bigAmount.toString());

      console.log("bigAmount", { bigAmount });

      // Check if market is paused
      const marketPaused = await isMarketPaused(poolId, marketId, networkId);
      if (marketPaused) {
        throw new Error("Market is paused");
      }

      // Get market info to check limits
      console.log("=== FETCHING MARKET INFO ===");
      console.log("Market info request:", {
        poolId,
        marketId,
        networkId,
      });
      const marketInfo = await fetchMarketInfo(poolId, marketId, networkId);
      if (!marketInfo) {
        console.error("Failed to fetch market info for:", {
          poolId,
          marketId,
          networkId,
        });
        throw new Error("Failed to fetch market info");
      }
      console.log("Market info retrieved:", {
        ntokenId: marketInfo.ntokenId,
        totalDeposits: marketInfo.totalDeposits?.toString(),
        maxTotalDeposits: marketInfo.maxTotalDeposits?.toString(),
      });

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

      console.log("=== BUILDING CONTRACTS ===");
      console.log("Contract addresses:", {
        poolId: Number(poolId),
        underlyingContractId: Number(token.underlyingContractId),
        ntokenId: Number(marketInfo.ntokenId),
        userAddress,
      });

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
      };
      console.log("Contracts initialized successfully");

      let customTx: any;

      for (const p of [
        [0, 0, 0], // no payments for any
        [0, 1, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 0, 1],
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 1],
      ]) {
        const [p1, p2, p3] = p;

        const buildN = [];

        // TODO fund ntoken

        // conditionally deposit to token
        if (tokenStandard == "network") {
          // ------------------------------------------------------------
          // TODO move this to setup market workflow
          // ------------------------------------------------------------
          // {
          //   const txnO = (
          //     await builder.token.createBalanceBox(
          //       algosdk.encodeAddress(
          //         algosdk.getApplicationAddress(Number(poolId)).publicKey
          //       )
          //     )
          //   ).obj;
          //   console.log("createBalanceBox", { txnO });
          //   buildN.push({
          //     ...txnO,
          //     payment: 28500,
          //     note: new TextEncoder().encode("nt200 createBalanceBox"),
          //   });
          // }
          // ------------------------------------------------------------
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28500,
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
          const aamt = BigInt(amount);
          const xaid = Number(token.underlyingAssetId);
          const payment = p1 > 0 ? 28501 : 0;
          const axfer = { payment, aamt, xaid };
          const txnO = (await builder.token.deposit(BigInt(amount))).obj;
          buildN.push({
            ...txnO,
            ...axfer,
            note: new TextEncoder().encode("nt200 deposit"),
          });
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
            payment: p2 > 0 ? 28502 : 0,
            note: new TextEncoder().encode("arc200 approve"),
          });
        }

        // ------------------------------------------------------------
        // TODO move this to setup market workflow
        // REM ensures that the pool can hold a balance prior to first
        //     first deposit
        // ------------------------------------------------------------
        // {
        //   const receiver = algosdk.encodeAddress(
        //     algosdk.getApplicationAddress(Number(poolId)).publicKey
        //   );
        //   const txnO = (await builder.token.arc200_transfer(receiver, 0)).obj;
        //   buildN.push({
        //     ...txnO,
        //     payment: 28504,
        //     note: new TextEncoder().encode(`arc200 transfer`),
        //   });
        // }
        // ------------------------------------------------------------

        // deposit to lending pool
        {
          // ------------------------------------------------------------
          // TODO fetch from config
          // ------------------------------------------------------------
          const foreignApps = [];
          if (networkConfig.networkId === "voi-mainnet") {
            foreignApps.push(47138065);
          }
          if (networkConfig.networkId === "algorand-mainnet") {
            foreignApps.push(3333688254);
          }
          // ------------------------------------------------------------
          const payment = p3 > 0 ? 9e5 : 1e5;
          console.log("=== CREATING DEPOSIT TRANSACTION ===");
          console.log("Deposit transaction params:", {
            marketId: Number(marketId),
            amount: BigInt(amount).toString(),
            poolId: Number(poolId),
            payment,
            foreignApps,
          });
          const txnO = (
            await builder.lending.deposit(Number(marketId), BigInt(amount))
          ).obj as any;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending deposit"),
            payment,
            foreignApps,
          });
          console.log("Deposit transaction added to buildN");
        }

        console.log("=== TRANSACTION BUILD ===");
        console.log("buildN transactions count:", buildN.length);
        console.log(
          "buildN details:",
          buildN.map((txn, idx) => ({
            index: idx,
            type: txn.type,
            note: txn.note ? new TextDecoder().decode(txn.note) : undefined,
            payment: txn.payment,
          }))
        );

        // Create deposit transaction
        ci.setFee(20000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }

        console.log("=== CALLING ci.custom() ===");
        customTx = await ci.custom();

        console.log("=== CUSTOM TX RESULT ===");
        console.log("customTx success:", customTx.success);
        if (customTx.success) {
          console.log("Transaction count:", customTx.txns?.length || 0);
        } else {
          console.error("customTx error:", customTx);
        }

        if (customTx.success) {
          break;
        }
      }

      if (!customTx.success) {
        if (customTx.error.match(/tried to spend/)) {
          throw new Error(customTx.error);
        }
        throw new Error("Deposit transaction failed");
      }

      console.log("=== DEPOSIT SUCCESS ===");
      console.log("Deposit transaction created successfully");
      console.log(
        "Returning transaction array with",
        customTx.txns.length,
        "transactions"
      );
      console.log("=== DEPOSIT DEBUG END ===");

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
    console.error("=== DEPOSIT ERROR ===");
    console.error("Error depositing:", error);
    console.error("Error details:", {
      poolId,
      marketId,
      tokenStandard,
      amount,
      userAddress,
      networkId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    console.error("=== DEPOSIT DEBUG END (ERROR) ===");
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

      // // Get old market info
      // const oldMarketInfo = await fetchMarketInfo(
      //   oldPoolId,
      //   oldContractId,
      //   networkId
      // );
      // if (!oldMarketInfo) {
      //   throw new Error("Failed to fetch old market info");
      // }

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
          let approvalAmount = bigAmount;
          // if node use higher approval amount
          if (networkId === "voi-mainnet" && oldContractId === "410811") {
            approvalAmount = BigInt(Number.MAX_SAFE_INTEGER);
          }
          const txnO = (
            await builder.oldToken.arc200_approve(
              algosdk.encodeAddress(
                algosdk.getApplicationAddress(Number(newPoolId)).publicKey
              ),
              //bigAmount
              Number.MAX_SAFE_INTEGER
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
            payment: p2 > 0 ? 9e5 : 1e5,
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
    const networkConfig = getNetworkConfig(networkId);

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

      // Check if user is opted into the asset (for ASA and arc200-exchange tokens)
      // Note: If not opted in, the transaction will include an opt-in automatically
      let optIn = {};
      if (tokenStandard === "asa" || tokenStandard === "arc200-exchange") {
        if (token.underlyingAssetId) {
          try {
            const accountAssetInfo = await clients.algod
              .accountAssetInformation(
                userAddress,
                Number(token.underlyingAssetId)
              )
              .do();
            console.log(
              `User is opted into asset ${token.underlyingAssetId} (${token.symbol})`
            );
          } catch (error: any) {
            // If the error indicates the user is not opted in, log a warning
            // The transaction will handle the opt-in automatically
            if (
              error?.response?.status === 404 ||
              error?.response?.status === 400 ||
              error?.message?.includes("not found") ||
              error?.message?.includes("not opted") ||
              error?.message?.includes("does not exist")
            ) {
              console.warn(
                `User is not opted into asset ${token.underlyingAssetId} (${token.symbol}). Opt-in will be included in the transaction.`
              );
              optIn = {
                xaid: Number(token.underlyingAssetId),
                snd: userAddress,
                arcv: userAddress,
              };
            } else {
              // Re-throw unexpected errors
              console.error("Error checking asset opt-in status:", error);
              throw error;
            }
          }
        }
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
      // p2 - payment to approve spending of token
      for (const p of [
        [0, 0], // no balance box, no approve
        [1, 0], // balance box, no approve
        [1, 1], // balance box, approve
        [0, 1], // no balance box, approve
      ]) {
        const [p1, p2] = p;
        const buildN = [];

        // cond create balance box user if needed and network token
        if (tokenStandard == "network" || tokenStandard == "asa") {
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
          const borrowCost = p2 > 0 ? 9e5 : 1e5;
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
            ...optIn,
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
            ...optIn,
            note: new TextEncoder().encode("arc200_swapBack"),
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
        if (customTx.error.match(/tried to spend/)) {
          throw new Error(customTx.error);
        } else if (
          customTx.error.match(
            /logic eval error: assert failed pc=.*opcodes=b[/]; b<=; assert/
          )
        ) {
          throw new Error("insufficient collateral for borrow");
        }
        throw new Error("Borrow transaction failed");
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
    const networkConfig = getNetworkConfig(networkId);

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

      console.log({ tokenStandard });

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
          // create balance box for user
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
          // {
          //   const addr = algosdk.encodeAddress(
          //     algosdk.getApplicationAddress(Number(poolId)).publicKey
          //   );
          //   const txnO = (await builder.token.createBalanceBox(addr)).obj;
          //   buildN.push({
          //     ...txnO,
          //     payment: 28500,
          //     note: new TextEncoder().encode(
          //       `nt200 createBalanceBox arc200 ${symbol} token for pool ${addr}`
          //     ),
          //   });
          // }
          // create balance box for user
          if (p1 > 0) {
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
            payment: p2 > 0 ? 28502 : 0,
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

/**
 * Repay borrowed tokens on behalf of another user
 */
export const repayOnBehalf = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  beneficiaryAddress: string,
  networkId: NetworkId
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("repayOnBehalf", {
    poolId,
    marketId,
    amount,
    userAddress,
    beneficiaryAddress,
    networkId,
  });

  try {
    const networkConfig = getNetworkConfig(networkId);

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
        beneficiaryAddress,
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

      console.log("repayOnBehalf parameters:", {
        poolId: Number(poolId),
        marketId: Number(marketId),
        amount: bigAmount,
        userAddress,
        beneficiaryAddress,
        tokenStandard,
      });

      console.log({ tokenStandard });

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
          // create balance box for user
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode("nt200 createBalanceBox"),
              description: "nt200 createBalanceBox",
            });
          }
          // user withdraws from nt200 token
          {
            const txnO = (await builder.token.deposit(bigAmount)).obj;
            buildN.push({
              ...txnO,
              note: new TextEncoder().encode("nt200 deposit"),
              payment: bigAmount,
              description: "nt200 deposit",
            });
          }
        } else if (tokenStandard === "asa") {
          // create balance box for pool
          // {
          //   const addr = algosdk.encodeAddress(
          //     algosdk.getApplicationAddress(Number(poolId)).publicKey
          //   );
          //   const txnO = (await builder.token.createBalanceBox(addr)).obj;
          //   buildN.push({
          //     ...txnO,
          //     payment: 28500,
          //     note: new TextEncoder().encode(
          //       `nt200 createBalanceBox arc200 ${symbol} token for pool ${addr}`
          //     ),
          //   });
          // }
          // create balance box for user
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            buildN.push({
              ...txnO,
              payment: 28501,
              note: new TextEncoder().encode(
                `nt200 createBalanceBox arc200 ${symbol} token for ${userAddress}`
              ),
              description: "nt200 createBalanceBox",
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
              description: "nt200 deposit",
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
            description: "arc200_redeem",
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
            payment: p2 > 0 ? 28502 : 0,
            description: "arc200 approve",
          });
        }
        // repay on behalf of beneficiary to lending pool
        {
          console.log("repay_on_behalf", {
            marketId,
            bigAmount,
            beneficiaryAddress,
          });
          const txnO = (
            await builder.lending.repay_on_behalf(
              Number(marketId),
              bigAmount,
              beneficiaryAddress
            )
          ).obj as any;
          buildN.push({
            ...txnO,
            payment: 2e5,
            note: new TextEncoder().encode("lending repayOnBehalf"),
            description: "lending repayOnBehalf",
          });
        }
        console.log("buildN", { buildN });
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
      console.log("customR", { customR });
      if (!customR.success) {
        throw new Error("Failed to create repayOnBehalf transaction");
      }
      return {
        success: true,
        txns: customR.txns,
      };
    } else {
      throw new Error("EVM networks not yet supported");
    }
  } catch (error) {
    console.error("RepayOnBehalf error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "RepayOnBehalf failed",
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
      const originalTokenConfigRaw = getTokenConfig(networkId, token.symbol);
      if (!originalTokenConfigRaw) {
        throw new Error(`Token config not found for ${token.symbol}`);
      }

      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

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
