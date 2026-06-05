/**
 * Lending Service
 *
 * This service handles interactions with the lending protocol,
 * including fetching market information, user positions, and protocol statistics.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  getMarketsTableVisibleTokensWithDisplayInfo,
  getTokenConfig,
  resolveTokenConfigFromDisplayToken,
  tokenConfigLookupKeyFromDisplayToken,
  getLendingPools,
  getPreFiParameters,
  TokenConfig,
  getEnabledNetworks,
  TokenStandard,
  tokenStandardUsesNt200Arc200Balance,
  tokenStandardUsesAsaStyleNt200Txns,
  tokenStandardUsesNativeWalletBalance,
  tokenStandardIsFolksAsaBridge,
  getFolksAdapterForPhase,
  getTokenAdaptersForPhase,
  tokenConfigHasAdapters,
  resolveDepositFolksAdapter,
  resolveWithdrawFolksAdapter,
  resolveBorrowFolksAdapter,
  resolveRepayFolksAdapter,
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
import { withRpcReadCache } from "@/utils/rpcReadCache";
import { calcDepositReturn } from "@folks-finance/algorand-sdk";
import {
  calculateDepositAPY,
  calculateBorrowAPY,
  APYCalculationResult,
} from "@/utils/apyCalculations";
import {
  calculateUserHealthFactor,
  DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL,
} from "@/utils/userHealth";
import dorkfiAPIService from "./dorkfiAPIService";
import {
  buildFolksDepositMintTxns,
  buildFolksWithdrawFromPoolTxns,
  estimateFolksDepositMintedFAssetAmount,
  folksMintTxnsToArccjsExtraTxns,
} from "./folksDepositAdapter";
import {
  MainnetConsensusConfig,
  buildGovernanceXalgoMintUnsignedWithOptionalOptIn,
  minXalgoOutImmediateMintFloor,
  buildXalgoBurnTxns,
  fetchXalgoMainnetConsensusState,
  minAlgoOutBurnFloor,
} from "./xalgoConsensusAdapter";
import {
  MAINNET_TALGO_ASA_ID,
  buildTalgoMintUnsignedWithOptionalOptIn,
  fetchMinTalgoOutMintFloorFromChain,
} from "./tinymanTalgoAdapter";

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
  /** Raw on-chain oracle price (stringified integer, e.g. WAD scale). */
  priceRaw?: string;
  /** Reserves in underlying token units (human-readable). */
  reservesAmount?: string;
  /** Market `lastUpdateTime` from chain as ISO 8601. */
  chainLastUpdateIso?: string;
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
  maxTotalDeposits: bigint;
  maxTotalBorrows: bigint;
  liquidationBonus: bigint;
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  reserveFactor: bigint;
  borrowRate: bigint;
  slope: bigint;
  totalScaledDeposits: bigint;
  totalScaledBorrows: bigint;
  depositIndex: bigint;
  borrowIndex: bigint;
  lastUpdateTime: bigint;
  reserves: bigint;
  price: bigint;
  ntokenId: bigint;
  closeFactor: bigint;
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
  scaledDeposits: bigint;
  scaledBorrows: bigint;
  depositIndex: bigint;
  borrowIndex: bigint;
  lastUpdateTime: bigint;
  lastPrice: bigint;
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

/** SCALE used by contract for index math (1e18). */
const DEPOSIT_SCALE = new BigNumber(1e18);

/**
 * Market total supply including accrued interest, for deposit cap validation.
 * Formula: (totalScaledDeposits * depositIndex) / SCALE / 10^decimals.
 * Use this so cap checks match contract semantics (principal + interest).
 */
function totalDepositsIncludingInterest(
  totalScaledDeposits: string,
  depositIndex: string,
  decimals: number
): string {
  return new BigNumber(totalScaledDeposits)
    .times(depositIndex)
    .div(DEPOSIT_SCALE)
    .div(new BigNumber(10).pow(decimals))
    .toFixed(4);
}

/**
 * Market total borrows including accrued interest, for borrow cap validation.
 * Formula: (totalScaledBorrows * borrowIndex) / SCALE / 10^decimals.
 * Use this so cap checks match contract semantics (principal + interest). See issue #248.
 */
function totalBorrowsIncludingInterest(
  totalScaledBorrows: string,
  borrowIndex: string,
  decimals: number
): string {
  return new BigNumber(totalScaledBorrows)
    .times(borrowIndex)
    .div(DEPOSIT_SCALE)
    .div(new BigNumber(10).pow(decimals))
    .toFixed(4);
}

export const enhanceAVMMarketInfo = (
  market: any,
  token?: TokenConfig
): MarketInfo => {
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

  const decimals = token?.decimals ?? 6;
  // Include accrued interest so deposit cap validation matches contract (see issue #246)
  const totalDeposits = totalDepositsIncludingInterest(
    market.totalScaledDeposits.toString(),
    market.depositIndex.toString(),
    decimals
  );

  // Include accrued interest so borrow cap validation matches contract (see issue #248)
  const totalBorrows = totalBorrowsIncludingInterest(
    market.totalScaledBorrows.toString(),
    market.borrowIndex.toString(),
    decimals
  );

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
    decimals,
    collateralFactor: parseFloat(market.collateralFactor.toString()) / 10000,
    liquidationThreshold:
      parseFloat(market.liquidationThreshold.toString()) / 10000,
    reserveFactor: parseFloat(market.reserveFactor.toString()) / 10000,
    borrowRate: parseFloat(market.borrowRate.toString()) / 10000,
    slope: parseFloat(market.slope.toString()) / 10000,
    maxTotalDeposits: BigNumber(market.maxTotalDeposits.toString())
      .div(10 ** decimals)
      .toFixed(0),
    maxTotalBorrows: BigNumber(market.maxTotalBorrows.toString())
      .div(10 ** decimals)
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

/** Which on-chain read to use for market state in {@link fetchMarketInfoFromContract}. */
export type FetchMarketInfoContractMethod = "sync_market" | "get_market";

export const fetchMarketInfoFromContract = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId,
  method: FetchMarketInfoContractMethod = "get_market"
): Promise<MarketData> => {
  console.log("fetchMarketInfoFromContract", {
    poolId,
    marketId,
    networkId,
    method,
  });
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
      const marketR =
        method === "sync_market"
          ? await ci.sync_market(Number(marketId))
          : await ci.get_market(Number(marketId));
      if (!marketR.success) {
        console.log("marketR", { marketR, method });
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
 * Fetch market information for a specific market.
 * @param contractReadMethod — When reading from chain (`source === "contract"` or API fallback), which ABI method to use. Use `"sync_market"` for index-based accrued interest / position math; `"get_market"` is lighter (default).
 */
export const fetchMarketInfo = async (
  poolId: string,
  marketId: string,
  networkId: NetworkId,
  source: "contract" | "api" = "api",
  contractReadMethod: FetchMarketInfoContractMethod = "get_market"
): Promise<MarketInfo | null> => {
  console.log("fetchMarketInfo", {
    poolId,
    marketId,
    networkId,
    source,
    contractReadMethod,
  });
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
          networkId,
          contractReadMethod
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
            networkId,
            contractReadMethod
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

      // Find token matching both marketId and poolId to handle tokens with multiple markets (e.g., WAD)
      // First try to match by both poolId and underlyingContractId for accuracy
      let token = getAllTokensWithDisplayInfo(networkId).find(
        (token) =>
          token.underlyingContractId === marketId &&
          String(token.poolId) === String(poolId)
      );

      // Fallback to matching by marketId only if no match found (for backward compatibility)
      if (!token) {
        token = getAllTokensWithDisplayInfo(networkId).find(
          (token) => token.underlyingContractId === marketId
        );
      }

      console.log("fetchMarketInfo token", { token, poolId, marketId });

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

      // Config map is keyed by `tokens` object keys (e.g. `fALGO`), not display `symbol` (`Algo`).
      const tokenConfigKey =
        (token as { configKey?: string }).configKey ??
        token.originalSymbol ??
        token.symbol;
      const tokenConfigRaw = networkConfig.tokens[tokenConfigKey];
      console.log("fetchMarketInfo tokenConfigRaw", { tokenConfigRaw, token });
      let tokenConfig: TokenConfig | undefined;
      if (Array.isArray(tokenConfigRaw)) {
        const poolStr = String(poolId);
        const marketStr = String(marketId).trim();
        tokenConfig =
          (marketStr !== ""
            ? tokenConfigRaw.find(
                (config) =>
                  String(config.poolId) === poolStr &&
                  String(config.contractId ?? "").trim() === marketStr
              )
            : undefined) ??
          tokenConfigRaw.find((config) => String(config.poolId) === poolStr) ??
          tokenConfigRaw[0];
      } else {
        tokenConfig = tokenConfigRaw;
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

      const tokenDecimals = token?.decimals ?? 6;
      const formatDeposit = (deposit: string) => {
        return new BigNumber(deposit)
          .div(new BigNumber(10).pow(tokenDecimals))
          .toFixed(4);
      };
      // Include accrued interest so deposit cap validation matches contract (see issue #246)
      const totalDeposits = totalDepositsIncludingInterest(
        market.totalScaledDeposits.toString(),
        market.depositIndex.toString(),
        tokenDecimals
      );

      // Include accrued interest so borrow cap validation matches contract (see issue #248)
      const totalBorrows = totalBorrowsIncludingInterest(
        market.totalScaledBorrows.toString(),
        market.borrowIndex.toString(),
        tokenDecimals
      );

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
        priceRaw: String(market.price),
        reservesAmount: new BigNumber(market.reserves.toString())
          .dividedBy(new BigNumber(10).pow(tokenDecimals))
          .toFixed(2),
        chainLastUpdateIso: (() => {
          const t = Number(market.lastUpdateTime);
          if (!Number.isFinite(t) || t <= 0) return "";
          const ms = t < 1e12 ? t * 1000 : t;
          return new Date(ms).toISOString();
        })(),
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

export type UserPositionMarketKey = {
  networkId: NetworkId;
  poolId: string;
  marketId: string;
};

/**
 * Collect unique pool/market pairs from API-shaped user position rows (e.g. `user.computed.deposits` / `borrows`).
 */
export function collectPositionMarketKeys(
  items: Record<string, unknown>[] | undefined | null
): UserPositionMarketKey[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const out: UserPositionMarketKey[] = [];
  for (const item of items) {
    const networkId = item.network as NetworkId | undefined;
    const poolId = String(item.appId ?? item.poolId ?? "");
    const marketId = String(
      item.marketId ?? item.underlyingContractId ?? ""
    );
    if (!networkId || !poolId || !marketId) continue;
    const key = `${networkId}|${poolId}|${marketId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ networkId, poolId, marketId });
  }
  return out;
}

/**
 * POST `/market-data/{network}/{appId}/{marketId}` so the API refreshes its chain snapshot.
 * Use before `fetchAllMarkets` when you want the GET path to reflect the latest on-chain state.
 */
export async function postRefreshMarketDataSnapshot(
  networkId: NetworkId,
  poolId: string,
  marketId: string
): Promise<boolean> {
  try {
    const res = await dorkfiAPIService.fetchFreshMarketData(
      networkId,
      Number(poolId),
      Number(marketId)
    );
    return !!res?.success;
  } catch (error) {
    console.error("[postRefreshMarketDataSnapshot]", {
      networkId,
      poolId,
      marketId,
      error,
    });
    return false;
  }
}

/**
 * Fresh market snapshot via POST `/market-data/{network}/{appId}/{marketId}`
 * (backend re-reads chain). Pairs with GET-backed `fetchMarketInfo` / `fetchAllMarkets`.
 */
export async function fetchFreshMarketInfo(
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<MarketInfo | null> {
  if (!isAlgorandCompatibleNetwork(networkId)) {
    return null;
  }
  try {
    const response = await dorkfiAPIService.fetchFreshMarketData(
      networkId,
      Number(poolId),
      Number(marketId)
    );
    if (!response?.success || !response?.data) {
      console.warn("[fetchFreshMarketInfo] POST failed or empty", {
        poolId,
        marketId,
        networkId,
        response,
      });
      return null;
    }
    const apiMarket = response.data as unknown as MarketData;

    const token =
      getAllTokensWithDisplayInfo(networkId).find(
        (t) =>
          String(t.underlyingContractId) === String(marketId) &&
          String(t.poolId) === String(poolId)
      ) ||
      getAllTokensWithDisplayInfo(networkId).find(
        (t) => String(t.underlyingContractId) === String(marketId)
      );
    if (!token) {
      console.warn("[fetchFreshMarketInfo] no token config", {
        poolId,
        marketId,
        networkId,
      });
      return null;
    }

    const networkConfig = getNetworkConfig(networkId);
    const tokenConfigKey =
      (token as { configKey?: string }).configKey ??
      token.originalSymbol ??
      token.symbol;
    const tokenConfigRaw = networkConfig.tokens[tokenConfigKey];
    let tokenConfig: TokenConfig | undefined;
    if (Array.isArray(tokenConfigRaw)) {
      tokenConfig =
        tokenConfigRaw.find((c) => String(c.poolId) === String(poolId)) ??
        tokenConfigRaw[0];
    } else {
      tokenConfig = tokenConfigRaw;
    }

    const decimals = token.decimals ?? 6;
    const merged = {
      ...apiMarket,
      network: networkId,
      poolId: String(poolId),
      appId: String(poolId),
      marketId: String(marketId),
    };

    const info = enhanceAVMMarketInfo(merged, tokenConfig);
    const priceStr = String(apiMarket.price ?? "0");
    const reserves = String(apiMarket.reserves ?? "0");
    const lastUp = Number(apiMarket.lastUpdateTime ?? 0);

    return {
      ...info,
      priceRaw: priceStr,
      reservesAmount: new BigNumber(reserves)
        .dividedBy(new BigNumber(10).pow(decimals))
        .toFixed(2),
      chainLastUpdateIso: (() => {
        if (!Number.isFinite(lastUp) || lastUp <= 0) return "";
        const ms = lastUp < 1e12 ? lastUp * 1000 : lastUp;
        return new Date(ms).toISOString();
      })(),
    };
  } catch (error) {
    console.error("[fetchFreshMarketInfo]", error);
    return null;
  }
}

/**
 * Fetch all markets information
 */
export const fetchAllMarkets = async (
  networkId: NetworkId,
  options?: { excludeMarketsTableHidden?: boolean }
): Promise<MarketInfo[]> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      // Get markets from config
      const tokens = options?.excludeMarketsTableHidden
        ? getMarketsTableVisibleTokensWithDisplayInfo(networkId)
        : getAllTokensWithDisplayInfo(networkId);

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

          const marketInfo = await fetchMarketInfo(poolId, marketId, networkId); // fetch from api

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
 * @param _marketData Reserved for future per-position LT; health uses default liquidation threshold (Portfolio refines LT from user deposits).
 */
export const fetchUserGlobalData = async (
  userAddress: string,
  networkId: NetworkId,
  _marketData?: MarketInfo[]
): Promise<{
  totalCollateralValue: number;
  totalBorrowValue: number;
  lastUpdateTime: number;
  healthFactorIndex?: number;
} | null> => {
  return withRpcReadCache(
    `userGlobal:${networkId}:${userAddress}`,
    () => fetchUserGlobalDataUncached(userAddress, networkId)
  );
};

const fetchUserGlobalDataUncached = async (
  userAddress: string,
  networkId: NetworkId
): Promise<{
  totalCollateralValue: number;
  totalBorrowValue: number;
  lastUpdateTime: number;
  healthFactorIndex?: number;
} | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      let totalCollateralValueUSD = 0;
      let totalBorrowValueUSD = 0;
      let lastUpdateTime = 0;

      const lendingPools = (networkConfig.contracts?.lendingPools ?? [])
        .map((poolId) => Number(poolId))
        .filter((poolIdNum) => Number.isFinite(poolIdNum) && poolIdNum > 0);

      const poolResults = await Promise.all(
        lendingPools.map(async (poolIdNum) => {
          try {
            const ci = new CONTRACT(
              poolIdNum,
              clients.algod,
              undefined,
              { ...LendingPoolAppSpec.contract, events: [] },
              {
                addr: algosdk.encodeAddress(
                  algosdk.getApplicationAddress(poolIdNum).publicKey
                ),
                sk: new Uint8Array(),
              }
            );
            ci.setFee(2000);
            const globalUserR = await ci.get_global_user(userAddress);
            if (!globalUserR.success) return null;
            const globalUser = GlobalUserData(globalUserR.returnValue);
            return {
              poolCollateralValueUSD: new BigNumber(
                globalUser.totalCollateralValue.toString()
              )
                .div(1e12)
                .toNumber(),
              poolBorrowValueUSD: new BigNumber(
                globalUser.totalBorrowValue.toString()
              )
                .div(1e12)
                .toNumber(),
              lastUpdateTime: Number(globalUser.lastUpdateTime),
            };
          } catch (poolError) {
            console.warn(
              `fetchUserGlobalData: pool ${poolIdNum} read failed:`,
              poolError
            );
            return null;
          }
        })
      );

      for (const row of poolResults) {
        if (!row) continue;
        totalCollateralValueUSD += row.poolCollateralValueUSD;
        totalBorrowValueUSD += row.poolBorrowValueUSD;
        lastUpdateTime = Math.max(lastUpdateTime, row.lastUpdateTime);
      }

      // Same ratio as on-chain _calculate_user_health(collateral, borrow, liquidation_threshold);
      // here we only have pooled totals, so we use a default LT when user deposit breakdown is unavailable.
      let healthFactorIndex: number | undefined;
      try {
        if (totalBorrowValueUSD === 0 && totalCollateralValueUSD > 0) {
          healthFactorIndex = 3.0;
          console.log(
            `[HealthFactorIndex] No borrows - excellent health (capped at 3.0): ${healthFactorIndex}`
          );
        } else if (totalCollateralValueUSD === 0 && totalBorrowValueUSD > 0) {
          healthFactorIndex = 0;
          console.log(
            `[HealthFactorIndex] No collateral but has borrows: ${healthFactorIndex}`
          );
        } else if (totalBorrowValueUSD > 0 && totalCollateralValueUSD > 0) {
          const hfRaw = calculateUserHealthFactor(
            totalCollateralValueUSD,
            totalBorrowValueUSD,
            DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL,
            "fetchUserGlobalData"
          );
          if (hfRaw != null) {
            healthFactorIndex = Math.min(hfRaw, 3.0);
          }

          console.log(`[HealthFactorIndex] Calculation:`, {
            totalCollateralValueUSD,
            totalBorrowValueUSD,
            liquidationThreshold: DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL,
            healthFactorIndex,
            formula: `(${totalCollateralValueUSD.toFixed(2)} × ${DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL}) / ${totalBorrowValueUSD.toFixed(2)}`,
            note: "Matches contract (collateral × liquidation_threshold) / borrow; default LT without per-user markets. Portfolio refines LT from deposits. Capped at 3.0 for display.",
          });
        }
      } catch (hfError) {
        console.warn(
          "fetchUserGlobalData: health factor display calc failed (totals still returned):",
          hfError
        );
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
 * Fetch user global data for a single pool (for borrowing power in that pool).
 * Use this when computing max borrow for a specific pool so borrowing power is based on collateral in that pool only.
 */
export const fetchUserGlobalDataForPool = async (
  userAddress: string,
  networkId: NetworkId,
  poolId: string | number
): Promise<{
  totalCollateralValue: number;
  totalBorrowValue: number;
  lastUpdateTime: number;
} | null> => {
  return withRpcReadCache(
    `userGlobalPool:${networkId}:${poolId}:${userAddress}`,
    () => fetchUserGlobalDataForPoolUncached(userAddress, networkId, poolId)
  );
};

const fetchUserGlobalDataForPoolUncached = async (
  userAddress: string,
  networkId: NetworkId,
  poolId: string | number
): Promise<{
  totalCollateralValue: number;
  totalBorrowValue: number;
  lastUpdateTime: number;
} | null> => {
  try {
    const networkConfig = getNetworkConfig(networkId);

    if (!isAlgorandCompatibleNetwork(networkId)) {
      return null;
    }

    const clients = await algorandService.initializeClientsForReads(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    const poolIdNum = Number(poolId);
    const ci = new CONTRACT(
      poolIdNum,
      clients.algod,
      undefined,
      { ...LendingPoolAppSpec.contract, events: [] },
      {
        addr: algosdk.encodeAddress(algosdk.getApplicationAddress(poolIdNum).publicKey),
        sk: new Uint8Array(),
      }
    );

    ci.setFee(2000);
    const globalUserR = await ci.get_global_user(userAddress);
    if (!globalUserR.success) {
      console.warn(`Failed to get global user data for pool ${poolId}`);
      return null;
    }

    const globalUser = GlobalUserData(globalUserR.returnValue);
    const totalCollateralValueUSD = new BigNumber(
      globalUser.totalCollateralValue.toString()
    )
      .div(1e12)
      .toNumber();
    const totalBorrowValueUSD = new BigNumber(
      globalUser.totalBorrowValue.toString()
    )
      .div(1e12)
      .toNumber();

    return {
      totalCollateralValue: totalCollateralValueUSD,
      totalBorrowValue: totalBorrowValueUSD,
      lastUpdateTime: Number(globalUser.lastUpdateTime),
    };
  } catch (error) {
    console.error("Error fetching user global data for pool:", error);
    return null;
  }
};

/**
 * Per-pool and per-market user snapshot read directly from lending pool contracts
 * (no indexer/API). Use when `VITE_USER_DATA_SOURCE` is `chain` or as an API fallback.
 */
export type ChainUserDataRow = {
  network: string;
  marketId: string;
  underlyingContractId: string;
  appId: string;
  poolId: string;
  scaledDeposits: string;
  scaledBorrows: string;
  depositIndex: string;
  borrowIndex: string;
};

export type ChainGlobalUserRow = {
  network: string;
  totalCollateralValue: string;
  totalBorrowValue: string;
  poolId: string;
};

/**
 * Per-pool `get_global_user` for all enabled networks (~few RPC calls).
 * Use for portfolio health factor; avoids scanning every market via {@link fetchUserDataFromChain}.
 */
export const fetchGlobalUserRowsFromChain = async (
  userAddress: string
): Promise<ChainGlobalUserRow[]> => {
  const tasks: Array<Promise<ChainGlobalUserRow | null>> = [];

  for (const networkId of getEnabledNetworks()) {
    if (!isAlgorandCompatibleNetwork(networkId)) continue;

    const networkConfig = getNetworkConfig(networkId);
    const clientsPromise = algorandService.initializeClientsForReads(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    for (const poolId of networkConfig.contracts.lendingPools) {
      tasks.push(
        (async () => {
          try {
            const clients = await clientsPromise;
            const poolIdNum = Number(poolId);
            const ci = new CONTRACT(
              poolIdNum,
              clients.algod,
              undefined,
              { ...LendingPoolAppSpec.contract, events: [] },
              {
                addr: algosdk.encodeAddress(
                  algosdk.getApplicationAddress(poolIdNum).publicKey
                ),
                sk: new Uint8Array(),
              }
            );
            ci.setFee(2000);
            const globalUserR = await ci.get_global_user(userAddress);
            if (!globalUserR.success) return null;
            const globalUser = GlobalUserData(globalUserR.returnValue);
            return {
              network: networkId,
              poolId: String(poolId),
              totalCollateralValue: globalUser.totalCollateralValue.toString(),
              totalBorrowValue: globalUser.totalBorrowValue.toString(),
            };
          } catch (e) {
            console.warn(
              `[fetchGlobalUserRowsFromChain] pool ${poolId} on ${networkId}:`,
              e
            );
            return null;
          }
        })()
      );
    }
  }

  const settled = await Promise.all(tasks);
  return settled.filter((r): r is ChainGlobalUserRow => r != null);
};

/**
 * Fetch global user rows and per-market user rows from chain for all enabled networks.
 * Mirrors the shape expected by Portfolio when building `user.computed` from API data.
 */
export const fetchUserDataFromChain = async (
  userAddress: string
): Promise<{
  globalUserData: ChainGlobalUserRow[];
  userData: ChainUserDataRow[];
} | null> => {
  const globalUserData: ChainGlobalUserRow[] = [];
  const userData: ChainUserDataRow[] = [];

  try {
    const networks = getEnabledNetworks();

    for (const networkId of networks) {
      if (!isAlgorandCompatibleNetwork(networkId)) {
        continue;
      }

      const networkConfig = getNetworkConfig(networkId);
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      for (const poolId of networkConfig.contracts.lendingPools) {
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
        ci.setFee(2000);

        const globalUserR = await ci.get_global_user(userAddress);
        if (globalUserR.success) {
          const globalUser = GlobalUserData(globalUserR.returnValue);
          globalUserData.push({
            network: networkId,
            poolId: String(poolId),
            totalCollateralValue: globalUser.totalCollateralValue.toString(),
            totalBorrowValue: globalUser.totalBorrowValue.toString(),
          });
        } else {
          console.warn(
            `[fetchUserDataFromChain] get_global_user failed for pool ${poolId} on ${networkId}`
          );
        }
      }

      const tokens = getAllTokensWithDisplayInfo(networkId);
      for (const token of tokens) {
        if (!token.underlyingContractId || !token.poolId) {
          continue;
        }

        const ci = new CONTRACT(
          Number(token.poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: algosdk.encodeAddress(
              algosdk.getApplicationAddress(Number(token.poolId)).publicKey
            ),
            sk: new Uint8Array(),
          }
        );
        ci.setFee(2000);

        const userDataR = await ci.get_user(
          userAddress,
          Number(token.underlyingContractId)
        );
        if (!userDataR.success) {
          continue;
        }

        const ud = UserData(userDataR.returnValue);
        const sd = ud.scaledDeposits ?? 0n;
        const sb = ud.scaledBorrows ?? 0n;
        if (sd === 0n && sb === 0n) {
          continue;
        }

        userData.push({
          network: networkId,
          marketId: String(token.underlyingContractId),
          underlyingContractId: String(token.underlyingContractId),
          appId: String(token.poolId),
          poolId: String(token.poolId),
          scaledDeposits: sd.toString(),
          scaledBorrows: sb.toString(),
          depositIndex: (ud.depositIndex ?? 0n).toString(),
          borrowIndex: (ud.borrowIndex ?? 0n).toString(),
        });
      }
    }

    if (globalUserData.length === 0 && userData.length === 0) {
      return { globalUserData: [], userData: [] };
    }

    return { globalUserData, userData };
  } catch (error) {
    console.error("[fetchUserDataFromChain] Error:", error);
    return null;
  }
};

/** Debt split from scaled borrows and borrow indices (matches pool accounting). */
export type BorrowDebtFromIndices = {
  /** Underlying at user's last borrow-index snapshot: scaled × I_user ÷ SCALE */
  principalAtUserIndex: number;
  /**
   * Portion of debt from index growth since that snapshot: scaled × (I_market − I_user) ÷ SCALE.
   * Same increment the contract uses before folding into scaled borrows on sync.
   */
  indexIncrementAccrued: number;
  /** Total owed: scaled × I_market ÷ SCALE (= principal + increment when indices are consistent). */
  totalDebt: number;
};

const BORROW_INDEX_SCALE = BigInt(1e18);

/**
 * Underlying borrow amount from scaled borrows and borrow indices.
 * Total is computed once from I_market; increment uses (I_market − I_user) so the split stays
 * consistent with interest resolution and UI “accrued” lines.
 */
export function borrowDebtFromScaledAndIndices(
  scaledBorrows: string,
  userBorrowIndex: string,
  marketBorrowIndex: string,
  decimals: number
): BorrowDebtFromIndices {
  const dec = Math.pow(10, decimals);
  const sb = BigInt(scaledBorrows || "0");
  const im = BigInt(marketBorrowIndex || "0");
  const iu = BigInt(userBorrowIndex || "0");

  if (sb === 0n) {
    return {
      principalAtUserIndex: 0,
      indexIncrementAccrued: 0,
      totalDebt: 0,
    };
  }

  const totalRaw = (sb * im) / BORROW_INDEX_SCALE;

  // Align with contract: if user's stored borrow index is 0, treat snapshot as market index (no split).
  if (iu === 0n && im > 0n) {
    const total = Number(totalRaw) / dec;
    return {
      principalAtUserIndex: total,
      indexIncrementAccrued: 0,
      totalDebt: total,
    };
  }

  if (iu > im) {
    const total = Number(totalRaw) / dec;
    return {
      principalAtUserIndex: total,
      indexIncrementAccrued: 0,
      totalDebt: total,
    };
  }

  const principalRaw = (sb * iu) / BORROW_INDEX_SCALE;
  const incrementRaw = (sb * (im - iu)) / BORROW_INDEX_SCALE;

  return {
    principalAtUserIndex: Number(principalRaw) / dec,
    indexIncrementAccrued: Number(incrementRaw) / dec,
    totalDebt: Number(totalRaw) / dec,
  };
}

/**
 * Compute implied total debt from API scaled borrows × chain market borrow index (debug).
 */
export function impliedDebtFromScaledAndMarketIndex(
  scaledBorrows: string,
  marketBorrowIndex: string,
  decimals: number
): number {
  return borrowDebtFromScaledAndIndices(
    scaledBorrows,
    marketBorrowIndex,
    marketBorrowIndex,
    decimals
  ).totalDebt;
}

/**
 * Compute UI "accrued interest" delta from API user row + chain market borrow index.
 */
export function impliedAccruedFromApiUserAndMarketIndex(
  scaledBorrows: string,
  userBorrowIndex: string,
  marketBorrowIndex: string,
  decimals: number
): number {
  return borrowDebtFromScaledAndIndices(
    scaledBorrows,
    userBorrowIndex,
    marketBorrowIndex,
    decimals
  ).indexIncrementAccrued;
}

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
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const poolIdNum = Number(poolId);
      const ci = new CONTRACT(
        poolIdNum,
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: algosdk.encodeAddress(
            algosdk.getApplicationAddress(poolIdNum).publicKey
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

        // Get token info to convert scaled borrows to actual amount
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find(
          (t) =>
            t.underlyingContractId === marketId &&
            String(t.poolId ?? "") === String(poolId)
        );

        if (!token) {
          console.warn(`Token not found for market ${marketId} pool ${poolId}`);
          return null;
        }

        // Check if scaledBorrows exists and is valid
        if (!userData.scaledBorrows) {
          console.log(
            `No borrows found for user ${userAddress} in market ${marketId}`
          );
          return { balance: 0, interest: 0 }; // Return 0 instead of null for no borrows
        }

        // Market index (sync_market) + readonly get_user_borrow_amount in parallel:
        // total debt matches the contract's (scaled_borrows * market.borrow_index) // SCALE.
        const [marketInfo, borrowAmountR] = await Promise.all([
          fetchMarketInfo(
            poolId,
            marketId,
            networkId,
            "contract",
            "sync_market"
          ),
          ci.get_user_borrow_amount(userAddress, Number(marketId)),
        ]);
        if (!marketInfo) {
          console.warn(`Failed to get market info for market ${marketId}`);
          return null;
        }

        // Convert scaled borrows to actual token amount using borrow index scaling.
        // You cannot get *current* total debt from userBorrowIndex alone: that field is the
        // market borrow index at the user's last sync. Accrual since then requires the
        // *current* market borrow index (sync_market / get_market). Algebraically,
        // debt at user index (last sync) = scaled × userBorrowIndex / SCALE; current debt =
        // scaled × currentBorrowIndex / SCALE; accrued = current − debt_at_user_index.
        // Formula from docs: underlying_amount = (scaled_borrows * current_borrow_index) / SCALE
        // Preferred: balance from get_user_borrow_amount (matches contract exactly).
        const scaledBorrows = userData.scaledBorrows.toString();
        const userBorrowIndex = userData.borrowIndex.toString(); // Market borrow index at user's last interaction (snapshot)
        const currentBorrowIndex = marketInfo.borrowIndex; // Current market borrow index — required for "now" debt

        console.log({
          userBorrowIndex,
          currentBorrowIndex,
        });

        const { totalDebt, indexIncrementAccrued, principalAtUserIndex } =
          borrowDebtFromScaledAndIndices(
            scaledBorrows,
            userBorrowIndex,
            currentBorrowIndex,
            token.decimals
          );

        const dec = Math.pow(10, token.decimals);
        let balance = totalDebt;
        if (
          borrowAmountR.success &&
          borrowAmountR.returnValue !== undefined &&
          borrowAmountR.returnValue !== null
        ) {
          const raw = BigInt(String(borrowAmountR.returnValue as bigint));
          balance = Number(raw) / dec;
        }

        console.log(`User borrow balance for ${token.symbol}:`, {
          scaledBorrows: scaledBorrows.toString(),
          userBorrowIndex: userBorrowIndex.toString(),
          currentBorrowIndex: currentBorrowIndex.toString(),
          principalAtUserIndex,
          indexIncrementAccrued,
          totalDebt,
          balanceFromReadonly: balance,
          tokenDecimals: token.decimals,
        });

        return {
          balance,
          interest: indexIncrementAccrued,
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

/** On-chain snapshot for admin/debug; same formulas as {@link fetchUserBorrowBalance}. */
export type BorrowPositionChainDebug = {
  poolId: string;
  marketId: string;
  networkId: NetworkId;
  tokenSymbol: string;
  decimals: number;
  scaledBorrows: string;
  scaledDeposits: string;
  userBorrowIndex: string;
  userDepositIndex: string;
  /** From `sync_market` (accrue path; used for debt math). */
  marketBorrowIndex: string;
  marketDepositIndex: string;
  /** From `get_market` (storage read; may differ from `sync_market` on indices until accrual). */
  getMarketBorrowIndex: string;
  getMarketDepositIndex: string;
  getMarketChainLastUpdateIso: string;
  syncMarketChainLastUpdateIso: string;
  /** `true` when get_market and sync_market return the same deposit/borrow indices. */
  getSyncMarketIndexMatch: boolean;
  userLastUpdateTime: string;
  /** `scaledBorrows × I_market ÷ SCALE` with `I_market` from `sync_market`. */
  totalDebtFromSyncMarket: number;
  /** Same formula with `I_market` from `get_market` (storage; may differ from sync). */
  totalDebtFromGetMarket: number;
  accruedInterestFromSyncMarket: number;
  accruedInterestFromGetMarket: number;
  actualBorrowsRaw: string;
  interestRaw: string;
};

/**
 * Read `get_user` + market state from contracts and compute total debt / index-delta interest.
 * Fetches both `sync_market` and `get_market` for comparison; **debt math** uses
 * `sync_market` indices (same as {@link fetchUserBorrowBalance}).
 * Use this as the source of truth when comparing Portfolio/API display issues.
 */
export async function fetchBorrowPositionChainDebug(
  userAddress: string,
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<
  { ok: true; data: BorrowPositionChainDebug } | { ok: false; error: string }
> {
  try {
    if (!isAlgorandCompatibleNetwork(networkId)) {
      return { ok: false, error: "Only Algorand-compatible networks are supported." };
    }

    const networkConfig = getNetworkConfig(networkId);
    const clients = await algorandService.initializeClientsForReads(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    const poolIdNum = Number(poolId);
    const ci = new CONTRACT(
      poolIdNum,
      clients.algod,
      undefined,
      { ...LendingPoolAppSpec.contract, events: [] },
      {
        addr: algosdk.encodeAddress(
          algosdk.getApplicationAddress(poolIdNum).publicKey
        ),
        sk: new Uint8Array(),
      }
    );
    ci.setFee(2000);

    const userDataR = await ci.get_user(userAddress, Number(marketId));
    if (!userDataR.success) {
      return {
        ok: false,
        error: `get_user failed for pool ${poolId} market ${marketId}`,
      };
    }

    const userData = UserData(userDataR.returnValue);
    const tokens = getAllTokensWithDisplayInfo(networkId);
    const token =
      tokens.find(
        (t) =>
          t.underlyingContractId === marketId &&
          String(t.poolId) === String(poolId)
      ) || tokens.find((t) => t.underlyingContractId === marketId);

    if (!token) {
      return {
        ok: false,
        error: `No token config for market ${marketId} (pool ${poolId})`,
      };
    }

    const [marketInfoSync, marketInfoGet, borrowAmountR] = await Promise.all([
      fetchMarketInfo(
        poolId,
        marketId,
        networkId,
        "contract",
        "sync_market"
      ),
      fetchMarketInfo(
        poolId,
        marketId,
        networkId,
        "contract",
        "get_market"
      ),
      ci.get_user_borrow_amount(userAddress, Number(marketId)),
    ]);
    if (!marketInfoSync) {
      return {
        ok: false,
        error: "fetchMarketInfo (contract, sync_market) failed",
      };
    }
    if (!marketInfoGet) {
      return {
        ok: false,
        error: "fetchMarketInfo (contract, get_market) failed",
      };
    }

    const getSyncMarketIndexMatch =
      String(marketInfoGet.borrowIndex) === String(marketInfoSync.borrowIndex) &&
      String(marketInfoGet.depositIndex) === String(marketInfoSync.depositIndex);

    const scaledBorrows = userData.scaledBorrows.toString();
    const scaledDeposits = userData.scaledDeposits.toString();
    const userBorrowIndex = userData.borrowIndex.toString();
    const userDepositIndex = userData.depositIndex.toString();
    const currentBorrowIndex = marketInfoSync.borrowIndex;
    const marketDepositIndex = marketInfoSync.depositIndex;
    const decimals = token.decimals;

    const debtSync = borrowDebtFromScaledAndIndices(
      scaledBorrows,
      userBorrowIndex,
      String(currentBorrowIndex),
      decimals
    );
    const debtGet = borrowDebtFromScaledAndIndices(
      scaledBorrows,
      userBorrowIndex,
      String(marketInfoGet.borrowIndex),
      decimals
    );
    const SCALE = BORROW_INDEX_SCALE;
    const sb = BigInt(scaledBorrows);
    const im = BigInt(String(currentBorrowIndex));
    const iu = BigInt(userBorrowIndex);
    let actualBorrowsRaw =
      sb === 0n ? 0n : (sb * im) / SCALE;
    if (
      borrowAmountR.success &&
      borrowAmountR.returnValue !== undefined &&
      borrowAmountR.returnValue !== null
    ) {
      actualBorrowsRaw = BigInt(String(borrowAmountR.returnValue as bigint));
    }
    const interestRaw =
      sb === 0n || im < iu || iu === 0n
        ? 0n
        : (sb * (im - iu)) / SCALE;

    return {
      ok: true,
      data: {
        poolId: String(poolId),
        marketId: String(marketId),
        networkId,
        tokenSymbol: token.symbol,
        decimals,
        scaledBorrows,
        scaledDeposits,
        userBorrowIndex,
        userDepositIndex,
        marketBorrowIndex: String(currentBorrowIndex),
        marketDepositIndex: String(marketDepositIndex),
        getMarketBorrowIndex: String(marketInfoGet.borrowIndex),
        getMarketDepositIndex: String(marketInfoGet.depositIndex),
        getMarketChainLastUpdateIso: marketInfoGet.chainLastUpdateIso ?? "",
        syncMarketChainLastUpdateIso: marketInfoSync.chainLastUpdateIso ?? "",
        getSyncMarketIndexMatch,
        userLastUpdateTime: userData.lastUpdateTime.toString(),
        totalDebtFromSyncMarket: debtSync.totalDebt,
        totalDebtFromGetMarket: debtGet.totalDebt,
        accruedInterestFromSyncMarket: debtSync.indexIncrementAccrued,
        accruedInterestFromGetMarket: debtGet.indexIncrementAccrued,
        actualBorrowsRaw: actualBorrowsRaw.toString(),
        interestRaw: interestRaw.toString(),
      },
    };
  } catch (error) {
    console.error("fetchBorrowPositionChainDebug:", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "fetchBorrowPositionChainDebug failed",
    };
  }
}

/** Latest indexer row for this user/pool/market (POST refresh). */
export type BorrowPositionApiSnapshot = {
  scaledBorrows: string;
  scaledDeposits: string;
  borrowIndex: string;
  depositIndex: string;
};

export async function fetchBorrowPositionApiSnapshot(
  userAddress: string,
  poolId: string,
  marketId: string,
  networkId: NetworkId
): Promise<
  | { ok: true; data: BorrowPositionApiSnapshot }
  | { ok: false; error: string }
> {
  try {
    const res = await dorkfiAPIService.fetchFreshUserData(
      userAddress,
      networkId,
      parseInt(String(poolId), 10),
      parseInt(String(marketId), 10)
    );
    if (!res.success || !res.data) {
      return {
        ok: false,
        error:
          (res as { error?: string }).error ||
          "fetchFreshUserData returned no data",
      };
    }
    const ud = res.data;
    return {
      ok: true,
      data: {
        scaledBorrows: String(ud.scaledBorrows ?? ""),
        scaledDeposits: String(ud.scaledDeposits ?? ""),
        borrowIndex: String(ud.borrowIndex ?? ""),
        depositIndex: String(ud.depositIndex ?? ""),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "fetchBorrowPositionApiSnapshot failed",
    };
  }
}

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

      // Get user's position data from the lending pool contract
      ci.setFee(2000);
      const userDataR = await ci.get_user(userAddress, Number(marketId));
      console.log(`get_user response for market ${marketId}:`, userDataR);

      if (userDataR.success) {
        const userData = UserData(userDataR.returnValue);
        console.log(`User data for market ${marketId}:`, userData);

        // Get token info to convert scaled deposits to actual amount
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find(
          (t) =>
            t.underlyingContractId === marketId &&
            String(t.poolId ?? "") === String(poolId)
        );

        if (!token) {
          console.warn(`Token not found for market ${marketId} pool ${poolId}`);
          return null;
        }

        // Check if scaledDeposits exists and is valid
        if (!userData.scaledDeposits) {
          console.log(
            `No deposits found for user ${userAddress} in market ${marketId}`
          );
          return 0; // Return 0 instead of null for no deposits
        }

        // Get current market data to access deposit index (sync_market = accrued supply index)
        const marketInfo = await fetchMarketInfo(
          poolId,
          marketId,
          networkId,
          "contract",
          "sync_market"
        );
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
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Import ARC200Service dynamically to avoid circular dependencies
      const { ARC200Service } = await import("@/services/arc200Service");
      ARC200Service.initialize(clients);

      let balance = 0n;

      if (tokenStandardUsesNativeWalletBalance(tokenConfig.tokenStandard)) {
        // For network tokens (like VOI), get balance from account info
        const accountInfo = await clients.algod
          .accountInformation(userAddress)
          .do();
        balance = (x => x >= BigInt(0) ? x : BigInt(0))(BigInt(accountInfo.amount) - BigInt(accountInfo.minBalance) - BigInt(1e6));
      } else if (
        tokenConfig.tokenStandard === "asa" ||
        tokenConfig.tokenStandard === "asa-asa"
      ) {
        // For ASA tokens, get balance from account asset information
        const accountAssetInfo = await clients.algod
          .accountAssetInformation(userAddress, Number(tokenConfig.assetId))
          .do();
        balance = BigInt(accountAssetInfo?.amount || 0)
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

const SCALE = 10n ** 18n;
const BPS = 10000n;

/**
 * Minimum implied health factor after a max-withdraw (off-chain UI cap).
 * Max withdraw = min(deposit, amount that leaves HF at or above this value), not 1.0.
 */
export const MAX_WITHDRAW_HEALTH_FACTOR_TARGET = 1.1;

const MAX_WITHDRAW_HF_NUM = 110n; // 1.10 × 100 — pairs with MAX_WITHDRAW_HF_DEN for integer math
const MAX_WITHDRAW_HF_DEN = 100n;

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/**
 * Compute max withdrawable amount from user, market, and global user state.
 * Minimum remaining collateral uses **liquidation threshold** (basis points, 10000 = 100%),
 * matching {@link calculateUserHealthFactor} / Portfolio HF — not collateral factor, so
 * “MAX” does not imply an est. HF below 1.0 when LT is the binding constraint.
 * Optional {@link GetMaxWithdrawableOptions.minLiquidationThresholdBps} should be the pool
 * minimum LT (strictest) when the user has multiple collaterals in the pool.
 * All inputs/outputs in contract units (BigInt).
 */
export type GetMaxWithdrawableOptions = {
  /** Pool min liquidation threshold in bps (e.g. 8500 = 85%). Tightens max when &lt; this market’s LT. */
  minLiquidationThresholdBps?: bigint;
};

export function getMaxWithdrawable(
  user: { scaled_deposits: bigint },
  market: {
    deposit_index: bigint;
    price: bigint;
    /**
     * Divisor bps for min remaining collateral (typically min(CF, LT) or pool min LT).
     * Same numeric scale as on-chain market bps (10000 = 100%).
     */
    liquidation_threshold_bps: bigint;
  },
  globalUser: {
    total_collateral_value: bigint;
    total_borrow_value: bigint;
  }
): { maxWithdrawScaled: bigint; maxWithdrawUnderlying: bigint } {
  const userScaledDeposits = user.scaled_deposits;
  const depositIndex = market.deposit_index;
  const price = market.price;
  const ltBps = market.liquidation_threshold_bps;
  const totalCollateralValue = globalUser.total_collateral_value;
  const totalBorrowValue = globalUser.total_borrow_value;

  const userUnderlying = (userScaledDeposits * depositIndex) / SCALE;

  if (totalBorrowValue === 0n) {
    return {
      maxWithdrawScaled: userScaledDeposits,
      maxWithdrawUnderlying: userUnderlying,
    };
  }

  if (ltBps <= 0n) {
    return {
      maxWithdrawScaled: 0n,
      maxWithdrawUnderlying: 0n,
    };
  }

  // ceil(borrow × BPS × 1.10 / ltBps) — aligns with HF = (C × LT) / B when LT is in same bps form
  const minRemainingCollateral =
    (totalBorrowValue * BPS * MAX_WITHDRAW_HF_NUM +
      ltBps * MAX_WITHDRAW_HF_DEN -
      1n) /
    (ltBps * MAX_WITHDRAW_HF_DEN);
  const maxWithdrawValue =
    totalCollateralValue > minRemainingCollateral
      ? totalCollateralValue - minRemainingCollateral
      : 0n;

  const cappedValue =
    maxWithdrawValue > totalCollateralValue
      ? totalCollateralValue
      : maxWithdrawValue;

  const maxWithdrawUnderlying =
    price > 0n ? (cappedValue * SCALE) / price : 0n;
  const maxWithdrawScaled =
    depositIndex > 0n ? (maxWithdrawUnderlying * SCALE) / depositIndex : 0n;

  const finalScaled =
    maxWithdrawScaled > userScaledDeposits ? userScaledDeposits : maxWithdrawScaled;
  const finalUnderlying = (finalScaled * depositIndex) / SCALE;

  return {
    maxWithdrawScaled: finalScaled,
    maxWithdrawUnderlying: finalUnderlying,
  };
}

/**
 * Fetch user, market, and global user from contract and compute max withdrawable.
 * Returns human-readable underlying amount and scaled amount for contract call.
 */
export const getMaxWithdrawableForMarket = async (
  poolId: string,
  marketId: string,
  userAddress: string,
  networkId: NetworkId,
  tokenDecimals: number,
  options?: GetMaxWithdrawableOptions
): Promise<{ maxWithdrawUnderlying: number; maxWithdrawScaled: bigint } | null> => {
  const optionsKey = options?.minLiquidationThresholdBps?.toString() ?? "";
  return withRpcReadCache(
    `maxWithdraw:${networkId}:${poolId}:${marketId}:${userAddress}:${tokenDecimals}:${optionsKey}`,
    () =>
      getMaxWithdrawableForMarketUncached(
        poolId,
        marketId,
        userAddress,
        networkId,
        tokenDecimals,
        options
      ),
    15_000
  );
};

const getMaxWithdrawableForMarketUncached = async (
  poolId: string,
  marketId: string,
  userAddress: string,
  networkId: NetworkId,
  tokenDecimals: number,
  options?: GetMaxWithdrawableOptions
): Promise<{ maxWithdrawUnderlying: number; maxWithdrawScaled: bigint } | null> => {
  try {
    if (!isAlgorandCompatibleNetwork(networkId)) return null;
    const networkConfig = getNetworkConfig(networkId);
    const clients = await algorandService.initializeClientsForReads(
      networkConfig.walletNetworkId as AlgorandNetwork
    );
    const appAddress = algosdk.getApplicationAddress(Number(poolId));
    const ci = new CONTRACT(
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
    ci.setFee(5000);
    const [userDataR, marketR, globalUserR] = await Promise.all([
      ci.get_user(userAddress, Number(marketId)),
      ci.get_market(Number(marketId)),
      ci.get_global_user(userAddress),
    ]);
    if (!userDataR.success || !marketR.success || !globalUserR.success) return null;
    const userData = UserData(userDataR.returnValue);
    const m = decodeMarket(marketR.returnValue as RawMarket);
    const globalData = GlobalUserData(globalUserR.returnValue);
    const thisLt = m.liquidationThreshold;
    const thisCf = m.collateralFactor;
    /** Stricter bps = larger min collateral required = lower max withdraw. */
    let divisorBps: bigint;
    if (
      options?.minLiquidationThresholdBps != null &&
      options.minLiquidationThresholdBps > 0n
    ) {
      divisorBps = minBigInt(options.minLiquidationThresholdBps, thisLt);
    } else if (thisCf > 0n && thisLt > 0n) {
      divisorBps = minBigInt(thisCf, thisLt);
    } else {
      divisorBps = thisLt > 0n ? thisLt : thisCf;
    }
    const result = getMaxWithdrawable(
      { scaled_deposits: BigInt(userData.scaledDeposits?.toString() ?? "0") },
      {
        deposit_index: m.depositIndex,
        price: m.price,
        liquidation_threshold_bps: divisorBps,
      },
      {
        total_collateral_value: globalData.totalCollateralValue,
        total_borrow_value: globalData.totalBorrowValue,
      }
    );
    // Human amount: floor to token precision (cap 8) so HF-safe max matches Deposited Balance line
    const raw =
      Number(result.maxWithdrawUnderlying) / Math.pow(10, tokenDecimals);
    const displayD = Math.min(Math.max(0, tokenDecimals), 8);
    const factor = 10 ** displayD;
    const maxWithdrawUnderlying =
      Math.floor(raw * factor + Number.EPSILON) / factor;
    return {
      maxWithdrawUnderlying,
      maxWithdrawScaled: result.maxWithdrawScaled,
    };
  } catch (error) {
    console.error("getMaxWithdrawableForMarket error:", error);
    return null;
  }
};

/**
 * Withdraw tokens from a lending market
 * @param options.withdrawAll - When true (withdraw all / max): use full nToken balance or options.maxWithdrawScaled if provided
 * @param options.maxWithdrawScaled - When set with withdrawAll, use this scaled amount for the contract call (health-factor-safe max)
 * @param options.withdrawAdapterId - Folks withdraw-phase adapter id (see {@link resolveWithdrawFolksAdapter}); omit for first withdraw adapter.
 * @param options.xalgoConsensusWithdrawAppendBurn - When true on mainnet Governance xALGO: after nt200
 * `withdraw`, append governance `burn` so the wallet receives native ALGO (same atomic group).
 * @param options.folksTwoStep - `lending_to_wallet`: nt200 + f-ASA to wallet only (see `VITE_FOLKS_ALGO_WITHDRAW_TWO_STEP`).
 *   `folks_redeem_only`: standalone Folks redeem using `folksRedeemFAssetAtomic` (step 2).
 */
export const withdraw = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId,
  options?: {
    withdrawAll?: boolean;
    maxWithdrawScaled?: bigint;
    withdrawAdapterId?: string;
    xalgoConsensusWithdrawAppendBurn?: boolean;
    /** Split Folks ALGO withdraw: step 1 omits Folks redeem; step 2 passes `folks_redeem_only` + atomic f-amount. */
    folksTwoStep?: "lending_to_wallet" | "folks_redeem_only";
    /** Step 2: f-ASA amount (smallest units) to redeem after step 1 left f-ALGO in the wallet. */
    folksRedeemFAssetAtomic?: string;
  }
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | {
    success: true;
    txns: string[];
    withdrawMeta?:
    | {
      folksTwoStep: "lending_to_wallet";
      fAssetToRedeemAtomic: string;
    }
    | { folksTwoStep: "folks_redeem_only" };
  }
> => {
  console.log("withdraw", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
    tokenStandard,
    xalgoConsensusWithdrawAppendBurn:
      options?.xalgoConsensusWithdrawAppendBurn,
    folksTwoStep: options?.folksTwoStep,
  });

  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get token information (same pool + market — avoids wrong row when symbols collide)
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      const token =
        allTokens.find(
          (t) =>
            String(t.underlyingContractId) === String(marketId) &&
            String(t.poolId) === String(poolId)
        ) ?? allTokens.find((t) => String(t.underlyingContractId) === String(marketId));

      if (!token) {
        throw new Error("Token not found");
      }

      console.log("withdraw:token", { token });

      const tokenConfigForWithdraw = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );

      const folksWithdrawAdapter = resolveWithdrawFolksAdapter(
        tokenConfigForWithdraw ?? {},
        options?.withdrawAdapterId
      );

      const withdrawReceiveIsMarketToken =
        folksWithdrawAdapter != null &&
        folksWithdrawAdapter.withdrawReceiveBasis === "market_token";

      /** Append Folks pool redeem (f-ASA → native) after nt200 withdraw when user receives underlying. */
      const folksWithdrawUsesFolksRedeem =
        folksWithdrawAdapter != null &&
        !withdrawReceiveIsMarketToken &&
        networkConfig.networkId === "algorand-mainnet" &&
        tokenStandardUsesAsaStyleNt200Txns(tokenStandard);

      if (
        options?.withdrawAdapterId != null &&
        String(options.withdrawAdapterId).trim() !== "" &&
        options?.xalgoConsensusWithdrawAppendBurn === true
      ) {
        throw new Error(
          "Governance xALGO withdraw+burn cannot be combined with a Folks withdraw adapter id."
        );
      }

      if (options?.folksTwoStep === "folks_redeem_only") {
        if (options?.xalgoConsensusWithdrawAppendBurn) {
          throw new Error(
            "Governance xALGO withdraw+burn cannot be combined with Folks redeem-only step."
          );
        }
        const atomicRaw = options?.folksRedeemFAssetAtomic;
        if (
          atomicRaw == null ||
          String(atomicRaw).trim() === "" ||
          !/^\d+$/.test(String(atomicRaw).trim())
        ) {
          throw new Error(
            "Folks redeem step requires a numeric f-asset amount from withdraw step 1."
          );
        }
        const fAmt = BigInt(String(atomicRaw).trim());
        if (fAmt <= BigInt(0)) {
          return {
            success: false,
            error: "Folks redeem amount must be positive.",
          };
        }
        if (!folksWithdrawUsesFolksRedeem || folksWithdrawAdapter == null) {
          throw new Error(
            "Folks redeem step is only available for the mainnet Folks ALGO → underlying withdraw route."
          );
        }
        /**
         * Same conservative haircut as deposit f-asset → nt200 (estimate vs on-chain).
         */
        const fAssetForRedeem =
          fAmt > BigInt(100) ? fAmt - BigInt(100) : fAmt;
        const folksRedeemTxns = await buildFolksWithdrawFromPoolTxns({
          poolName: folksWithdrawAdapter.folksParams.pool,
          userAddress,
          fAssetAmount: fAssetForRedeem,
          algod: clients.algod,
        });
        if (folksRedeemTxns.length === 0) {
          throw new Error("Folks redeem built no transactions.");
        }
        const txnsB64 = folksRedeemTxns.map((t) =>
          Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString("base64")
        );
        return {
          success: true,
          txns: txnsB64,
          withdrawMeta: { folksTwoStep: "folks_redeem_only" },
        };
      }

      if (options?.folksTwoStep === "lending_to_wallet") {
        if (options?.xalgoConsensusWithdrawAppendBurn) {
          throw new Error(
            "Governance xALGO withdraw+burn cannot be combined with two-step Folks withdraw."
          );
        }
        if (!folksWithdrawUsesFolksRedeem || folksWithdrawAdapter == null) {
          throw new Error(
            "Two-step withdraw requires the mainnet Folks ALGO route (receive f-ALGO, then redeem)."
          );
        }
      }

      // Convert amount to proper units (considering decimals)
      const amountInSmallestUnit = BigInt(
        new BigNumber(amount).multipliedBy(10 ** token.decimals).toFixed(0)
      );

      console.log("withdraw:amountInSmallestUnit", { amountInSmallestUnit });

      // Get market info (sync_market for index-based accrued supply interest math)
      const marketInfo = await fetchMarketInfo(
        poolId,
        marketId,
        networkId,
        "contract",
        "sync_market"
      );
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }
      console.log("withdraw:marketInfo", { marketInfo });

      // Calculate accrued interest for logging/validation
      let accruedInterest: number | undefined;
      let userScaledDeposits: bigint | null = null;
      let userDepositIndex: string | undefined;
      let currentDepositIndex: string | bigint | undefined;
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
          console.log("withdraw:userData", { userData });
          const scaledDeposits = userData.scaledDeposits?.toString();
          userDepositIndex = userData.depositIndex?.toString();
          currentDepositIndex = marketInfo.depositIndex;

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

            console.log("withdraw:accrued interest calculation:", {
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

      // User amount is in smallest **underlying** units (matches Withdraw modal), except Folks
      // `network-asa` where that means native/ASA underlying (e.g. ALGO) and pool math uses f-asset.
      // Do not scale by userDepositIndex/currentDepositIndex — that broke partial-withdraw simulation / HF safety.
      let adjustedAmount = amountInSmallestUnit;

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
        Number(token.underlyingContractId),
        clients.algod,
        undefined,
        abi.nt200,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const ciNToken = new CONTRACT(
        Number(marketInfo.ntokenId),
        clients.algod,
        undefined,
        abi.nt200,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      const ciPool = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      let token_balance = BigInt(0);
      {
        const token_balanceR = await ciToken.arc200_balanceOf(userAddress);
        console.log("withdraw:token_balanceR (user)", { token_balanceR });
        token_balance = BigInt(token_balanceR.returnValue);
      }

      let ntoken_balance = BigInt(0);
      {
        const ntoken_balanceR = await ciNToken.arc200_balanceOf(userAddress);
        console.log("withdraw:ntoken_balanceR (user)", { ntoken_balanceR });
        ntoken_balance = BigInt(ntoken_balanceR.returnValue);
      }

      let folksDepositInterestIndex: bigint | null = null;
      if (folksWithdrawUsesFolksRedeem && folksWithdrawAdapter != null) {
        const { depositInterestIndex } =
          await estimateFolksDepositMintedFAssetAmount({
            poolName: folksWithdrawAdapter.folksParams.pool,
            underlyingAmount: BigInt(1),
            algod: clients.algod,
          });
        folksDepositInterestIndex = depositInterestIndex;
      }



      // Withdraw all: use maxWithdrawScaled (health-factor-safe) when provided, else full nToken balance
      let underlying_amount = BigInt(0);
      const maxWithdrawAmount =
        options?.withdrawAll && options?.maxWithdrawScaled !== undefined
          ? options.maxWithdrawScaled
          : ntoken_balance;
      if (options?.withdrawAll && maxWithdrawAmount > BigInt(0)) {
        console.log("withdraw:withdrawAll - using amount", {
          maxWithdrawAmount: maxWithdrawAmount.toString(),
          source: options?.maxWithdrawScaled !== undefined ? "maxWithdrawScaled" : "ntoken_balance",
        });
        adjustedAmount = maxWithdrawAmount
        ciPool.setFee(20000);
        ciPool.setPaymentAmount(1e5);
        const underlyingR = await ciPool.withdraw(Number(marketId), maxWithdrawAmount);
        const rawReturn = underlyingR?.returnValue ?? (underlyingR as any)?.return ?? (underlyingR as any)?.value;
        if (rawReturn !== undefined && rawReturn !== null) {
          underlying_amount = BigInt(rawReturn);
        } else {
          console.warn("withdraw:withdrawAll - contract did not return underlying amount", { underlyingR });
          throw new Error(
            "Withdraw all failed: contract did not return underlying amount. Try withdrawing a specific amount instead."
          );
        }
      } else {

        {
          const arc200_balanceR = await ciToken.arc200_balanceOf(
            algosdk.encodeAddress(
              algosdk.getApplicationAddress(Number(poolId)).publicKey
            )
          );
          console.log("withdraw:arc200_balanceR (pool)", { arc200_balanceR });
        }

        // Optimized search to find the ntoken amount that gives us the EXACT desired underlying amount
        // If user already has tokens, we can withdraw less from the pool
        const requestedUnderlyingAmount = BigInt(amountInSmallestUnit);
        const requestedPoolReturnUnits =
          folksWithdrawUsesFolksRedeem &&
            folksDepositInterestIndex != null &&
            folksDepositInterestIndex > BigInt(0)
            ? calcDepositReturn(
              requestedUnderlyingAmount,
              folksDepositInterestIndex
            )
            : requestedUnderlyingAmount;

        console.log({ requestedPoolReturnUnits })

        const targetUnderlyingAmount =
          token_balance > BigInt(0) &&
            requestedPoolReturnUnits > token_balance
            ? requestedPoolReturnUnits - token_balance
            : requestedPoolReturnUnits;

        if (
          folksWithdrawUsesFolksRedeem &&
          targetUnderlyingAmount === BigInt(0) &&
          requestedUnderlyingAmount > BigInt(0)
        ) {
          throw new Error(
            "Withdraw amount is already covered by your f-asset on the token app; try a larger amount or use Max."
          );
        }

        if (folksWithdrawUsesFolksRedeem) {
          adjustedAmount =
            targetUnderlyingAmount > ntoken_balance
              ? ntoken_balance
              : targetUnderlyingAmount > BigInt(0)
                ? targetUnderlyingAmount
                : ntoken_balance;
        } else {
          adjustedAmount = amountInSmallestUnit;
        }

        if (
          token_balance > BigInt(0) &&
          targetUnderlyingAmount < requestedPoolReturnUnits
        ) {
          console.log(
            "withdraw:adjusted target underlying amount based on user token balance",
            {
              requestedPoolReturnUnits: requestedPoolReturnUnits.toString(),
              userTokenBalance: token_balance.toString(),
              adjustedTargetUnderlyingAmount: targetUnderlyingAmount.toString(),
              note: "User already has tokens, so we need to withdraw less from pool",
            }
          );
        }
        let bestNTokenAmount = adjustedAmount;
        let bestUnderlyingAmount = BigInt(0);
        let exactMatchNToken: bigint | null = null;

        // Track best approximations below and above target separately
        let bestBelowNToken: bigint | null = null;
        let bestBelowUnderlying: bigint | null = null;
        let bestBelowDiff: bigint | null = null;
        let bestAboveNToken: bigint | null = null;
        let bestAboveUnderlying: bigint | null = null;
        let bestAboveDiff: bigint | null = null;

        const maxIterations = 20; // Increased to ensure we find exact match
        const tolerance = BigInt(0); // Must be exact - no tolerance

        // First, check if we need to adjust at all
        ciPool.setFee(20000);
        ciPool.setPaymentAmount(1e5);
        const initialUnderlyingR = await ciPool.withdraw(
          Number(marketId),
          adjustedAmount
        );

        console.log("withdraw:initialUnderlyingR", { initialUnderlyingR });

        underlying_amount = BigInt(initialUnderlyingR.returnValue);
        bestUnderlyingAmount = underlying_amount;

        console.log("withdraw:initial calculation", {
          adjustedAmount: adjustedAmount.toString(),
          underlying_amount: underlying_amount.toString(),
          targetUnderlyingAmount: targetUnderlyingAmount.toString(),
          isExact: underlying_amount === targetUnderlyingAmount,
        });

        // If we already have exact match, use it
        if (underlying_amount === targetUnderlyingAmount) {
          console.log("withdraw:exact match on initial calculation");
          exactMatchNToken = adjustedAmount;
        } else {
          // Track initial value as best below or above
          if (underlying_amount < targetUnderlyingAmount) {
            bestBelowNToken = adjustedAmount;
            bestBelowUnderlying = underlying_amount;
            bestBelowDiff = targetUnderlyingAmount - underlying_amount;
          } else if (underlying_amount > targetUnderlyingAmount) {
            bestAboveNToken = adjustedAmount;
            bestAboveUnderlying = underlying_amount;
            bestAboveDiff = underlying_amount - targetUnderlyingAmount;
          }
        }

        if (exactMatchNToken === null) {
          // Use ratio-based interpolation for faster convergence
          let currentNToken = adjustedAmount;
          let currentUnderlying = underlying_amount;
          let minNTokenAmount = BigInt(0);
          let maxNTokenAmount = adjustedAmount * BigInt(3); // Wider initial bound

          // Phase 1: Large steps using ratio interpolation (first 3-4 iterations)
          for (
            let iteration = 4;
            iteration < Math.min(4, maxIterations);
            iteration++
          ) {
            // Calculate ratio to estimate next step
            const ratio = new BigNumber(currentUnderlying.toString()).dividedBy(
              targetUnderlyingAmount.toString()
            );

            // Use interpolation: newNToken = currentNToken * (targetUnderlying / currentUnderlying)
            // This gives us a better estimate than binary search
            const estimatedNToken = BigInt(
              new BigNumber(currentNToken.toString())
                .multipliedBy(targetUnderlyingAmount.toString())
                .dividedBy(currentUnderlying.toString())
                .toFixed(0)
            );

            // Clamp to reasonable bounds
            const testNTokenAmount =
              estimatedNToken < minNTokenAmount
                ? minNTokenAmount
                : estimatedNToken > maxNTokenAmount
                  ? maxNTokenAmount
                  : estimatedNToken;

            console.log("withdraw:interpolation step", {
              iteration,
              currentNToken: currentNToken.toString(),
              currentUnderlying: currentUnderlying.toString(),
              ratio: ratio.toString(),
              estimatedNToken: estimatedNToken.toString(),
              testNTokenAmount: testNTokenAmount.toString(),
            });

            ciPool.setFee(20000);
            ciPool.setPaymentAmount(1e5);
            const underlying_amountR = await ciPool.withdraw(
              Number(marketId),
              testNTokenAmount
            );
            if (!underlying_amountR.success) {
              continue;
            }
            const newUnderlyingAmount = BigInt(underlying_amountR.returnValue);

            // Check for exact match first
            if (newUnderlyingAmount === targetUnderlyingAmount) {
              exactMatchNToken = testNTokenAmount;
              bestNTokenAmount = testNTokenAmount;
              bestUnderlyingAmount = newUnderlyingAmount;
              underlying_amount = newUnderlyingAmount;
              console.log("withdraw:found EXACT match (interpolation)");
              break;
            }

            // Track best below and above target separately
            if (newUnderlyingAmount < targetUnderlyingAmount) {
              // Below target - track best below
              const currentDiff = targetUnderlyingAmount - newUnderlyingAmount;
              if (bestBelowDiff === null || currentDiff < bestBelowDiff) {
                bestBelowNToken = testNTokenAmount;
                bestBelowUnderlying = newUnderlyingAmount;
                bestBelowDiff = currentDiff;
              }
            } else if (newUnderlyingAmount > targetUnderlyingAmount) {
              // Above target - track best above
              const currentDiff = newUnderlyingAmount - targetUnderlyingAmount;
              if (bestAboveDiff === null || currentDiff < bestAboveDiff) {
                bestAboveNToken = testNTokenAmount;
                bestAboveUnderlying = newUnderlyingAmount;
                bestAboveDiff = currentDiff;
              }
            }

            // Also update overall best for backward compatibility
            const isCurrentAboveOrEqual =
              newUnderlyingAmount >= targetUnderlyingAmount;
            const isBestAboveOrEqual =
              bestUnderlyingAmount >= targetUnderlyingAmount;

            let shouldUpdate = false;

            if (isCurrentAboveOrEqual && !isBestAboveOrEqual) {
              // Current is >= target, best is below - prefer current
              shouldUpdate = true;
            } else if (!isCurrentAboveOrEqual && isBestAboveOrEqual) {
              // Current is below, best is >= target - keep best
              shouldUpdate = false;
            } else {
              // Both are same side of target - choose closer one
              const currentDiff = isCurrentAboveOrEqual
                ? newUnderlyingAmount - targetUnderlyingAmount
                : targetUnderlyingAmount - newUnderlyingAmount;
              const bestDiff = isBestAboveOrEqual
                ? bestUnderlyingAmount - targetUnderlyingAmount
                : targetUnderlyingAmount - bestUnderlyingAmount;

              shouldUpdate = currentDiff < bestDiff;
            }

            if (shouldUpdate) {
              bestNTokenAmount = testNTokenAmount;
              bestUnderlyingAmount = newUnderlyingAmount;
              underlying_amount = newUnderlyingAmount;
            }

            // Update bounds based on result
            if (newUnderlyingAmount < targetUnderlyingAmount) {
              // Need more ntoken
              minNTokenAmount =
                testNTokenAmount > minNTokenAmount
                  ? testNTokenAmount
                  : minNTokenAmount;
              if (maxNTokenAmount < testNTokenAmount * BigInt(2)) {
                maxNTokenAmount = testNTokenAmount * BigInt(2); // Expand upper bound if needed
              }
            } else {
              // Too much underlying, need less ntoken
              maxNTokenAmount =
                testNTokenAmount < maxNTokenAmount
                  ? testNTokenAmount
                  : maxNTokenAmount;
            }

            currentNToken = testNTokenAmount;
            currentUnderlying = newUnderlyingAmount;

            // If we're very close, switch to binary search for final refinement
            const currentDiff =
              newUnderlyingAmount >= targetUnderlyingAmount
                ? newUnderlyingAmount - targetUnderlyingAmount
                : targetUnderlyingAmount - newUnderlyingAmount;
            const relativeError = new BigNumber(currentDiff.toString())
              .dividedBy(targetUnderlyingAmount.toString())
              .toNumber();
            if (relativeError < 0.01) {
              // Within 1% - switch to binary search
              console.log(
                "withdraw:switching to binary search for final refinement"
              );
              break;
            }
          }

          // Phase 2: Binary search for final refinement (remaining iterations)
          for (let iteration = 0; iteration < maxIterations; iteration++) {
            // If we found exact match, stop searching
            if (exactMatchNToken !== null) {
              break;
            }

            const testNTokenAmount = BigInt(
              new BigNumber(minNTokenAmount.toString())
                .plus(maxNTokenAmount.toString())
                .dividedBy(2)
                .toFixed(0)
            );

            // Skip if bounds are too close, but check adjacent values for exact match
            if (maxNTokenAmount - minNTokenAmount <= BigInt(2)) {
              // Check remaining values in the range for exact match
              for (
                let checkAmount = minNTokenAmount;
                checkAmount <= maxNTokenAmount;
                checkAmount++
              ) {
                if (exactMatchNToken !== null) break;

                ciPool.setFee(20000);
                ciPool.setPaymentAmount(1e5);
                const checkR = await ciPool.withdraw(
                  Number(marketId),
                  checkAmount
                );
                if (!checkR.success) {
                  continue;
                }
                const checkUnderlying = BigInt(checkR.returnValue);

                if (checkUnderlying === targetUnderlyingAmount) {
                  exactMatchNToken = checkAmount;
                  bestNTokenAmount = checkAmount;
                  bestUnderlyingAmount = checkUnderlying;
                  underlying_amount = checkUnderlying;
                  console.log("withdraw:found EXACT match in final sweep", {
                    nTokenAmount: checkAmount.toString(),
                    underlyingAmount: checkUnderlying.toString(),
                  });
                  break;
                }

                // Track best below and above target separately
                if (checkUnderlying < targetUnderlyingAmount) {
                  // Below target - track best below
                  const currentDiff = targetUnderlyingAmount - checkUnderlying;
                  if (bestBelowDiff === null || currentDiff < bestBelowDiff) {
                    bestBelowNToken = checkAmount;
                    bestBelowUnderlying = checkUnderlying;
                    bestBelowDiff = currentDiff;
                  }
                } else if (checkUnderlying > targetUnderlyingAmount) {
                  // Above target - track best above
                  const currentDiff = checkUnderlying - targetUnderlyingAmount;
                  if (bestAboveDiff === null || currentDiff < bestAboveDiff) {
                    bestAboveNToken = checkAmount;
                    bestAboveUnderlying = checkUnderlying;
                    bestAboveDiff = currentDiff;
                  }
                }

                // Also update overall best for backward compatibility
                const isCheckAboveOrEqual =
                  checkUnderlying >= targetUnderlyingAmount;
                const isBestAboveOrEqual =
                  bestUnderlyingAmount >= targetUnderlyingAmount;

                let shouldUpdate = false;

                if (isCheckAboveOrEqual && !isBestAboveOrEqual) {
                  // Check is >= target, best is below - prefer check
                  shouldUpdate = true;
                } else if (!isCheckAboveOrEqual && isBestAboveOrEqual) {
                  // Check is below, best is >= target - keep best
                  shouldUpdate = false;
                } else {
                  // Both are same side of target - choose closer one
                  const checkDiff = isCheckAboveOrEqual
                    ? checkUnderlying - targetUnderlyingAmount
                    : targetUnderlyingAmount - checkUnderlying;
                  const bestDiff = isBestAboveOrEqual
                    ? bestUnderlyingAmount - targetUnderlyingAmount
                    : targetUnderlyingAmount - bestUnderlyingAmount;

                  shouldUpdate = checkDiff < bestDiff;
                }

                if (shouldUpdate) {
                  bestNTokenAmount = checkAmount;
                  bestUnderlyingAmount = checkUnderlying;
                  underlying_amount = checkUnderlying;
                }
              }
              break;
            }

            console.log("withdraw:binary search refinement", {
              iteration,
              testNTokenAmount: testNTokenAmount.toString(),
              minNTokenAmount: minNTokenAmount.toString(),
              maxNTokenAmount: maxNTokenAmount.toString(),
            });

            ciPool.setFee(20000);
            ciPool.setPaymentAmount(1e5);
            const underlying_amountR = await ciPool.withdraw(
              Number(marketId),
              testNTokenAmount
            );
            if (!underlying_amountR.success) {
              console.warn("withdraw:binary search probe failed", {
                marketId,
                testNTokenAmount: testNTokenAmount.toString(),
              });
              continue;
            }
            const newUnderlyingAmount = BigInt(underlying_amountR.returnValue);

            // Check for exact match first
            if (newUnderlyingAmount === targetUnderlyingAmount) {
              exactMatchNToken = testNTokenAmount;
              bestNTokenAmount = testNTokenAmount;
              bestUnderlyingAmount = newUnderlyingAmount;
              underlying_amount = newUnderlyingAmount;
              console.log("withdraw:found EXACT match (binary search)");
              break;
            }

            // Track best below and above target separately
            if (newUnderlyingAmount < targetUnderlyingAmount) {
              // Below target - track best below
              const currentDiff = targetUnderlyingAmount - newUnderlyingAmount;
              if (bestBelowDiff === null || currentDiff < bestBelowDiff) {
                bestBelowNToken = testNTokenAmount;
                bestBelowUnderlying = newUnderlyingAmount;
                bestBelowDiff = currentDiff;
              }
            } else if (newUnderlyingAmount > targetUnderlyingAmount) {
              // Above target - track best above
              const currentDiff = newUnderlyingAmount - targetUnderlyingAmount;
              if (bestAboveDiff === null || currentDiff < bestAboveDiff) {
                bestAboveNToken = testNTokenAmount;
                bestAboveUnderlying = newUnderlyingAmount;
                bestAboveDiff = currentDiff;
              }
            }

            // Also update overall best for backward compatibility
            const isCurrentAboveOrEqual =
              newUnderlyingAmount >= targetUnderlyingAmount;
            const isBestAboveOrEqual =
              bestUnderlyingAmount >= targetUnderlyingAmount;

            let shouldUpdate = false;

            if (isCurrentAboveOrEqual && !isBestAboveOrEqual) {
              // Current is >= target, best is below - prefer current
              shouldUpdate = true;
            } else if (!isCurrentAboveOrEqual && isBestAboveOrEqual) {
              // Current is below, best is >= target - keep best
              shouldUpdate = false;
            } else {
              // Both are same side of target - choose closer one
              const currentDiff = isCurrentAboveOrEqual
                ? newUnderlyingAmount - targetUnderlyingAmount
                : targetUnderlyingAmount - newUnderlyingAmount;
              const bestDiff = isBestAboveOrEqual
                ? bestUnderlyingAmount - targetUnderlyingAmount
                : targetUnderlyingAmount - bestUnderlyingAmount;

              shouldUpdate = currentDiff < bestDiff;
            }

            if (shouldUpdate) {
              bestNTokenAmount = testNTokenAmount;
              bestUnderlyingAmount = newUnderlyingAmount;
              underlying_amount = newUnderlyingAmount;
            }

            // Adjust search bounds
            if (newUnderlyingAmount < targetUnderlyingAmount) {
              minNTokenAmount = testNTokenAmount + BigInt(1);
            } else {
              maxNTokenAmount = testNTokenAmount - BigInt(1);
            }

            // Check if bounds have converged
            if (minNTokenAmount >= maxNTokenAmount) {
              // Check the final value for exact match
              const finalAmount = minNTokenAmount;
              ciPool.setFee(20000);
              ciPool.setPaymentAmount(1e5);
              const finalR = await ciPool.withdraw(Number(marketId), finalAmount);
              const finalUnderlying = BigInt(finalR.returnValue);

              if (finalUnderlying === targetUnderlyingAmount) {
                exactMatchNToken = finalAmount;
                bestNTokenAmount = finalAmount;
                bestUnderlyingAmount = finalUnderlying;
                underlying_amount = finalUnderlying;
                console.log("withdraw:found EXACT match at convergence point");
              } else {
                // Update best if final value is better (prefer >= target)
                const isFinalAboveOrEqual =
                  finalUnderlying >= targetUnderlyingAmount;
                const isBestAboveOrEqual =
                  bestUnderlyingAmount >= targetUnderlyingAmount;

                let shouldUpdate = false;

                if (isFinalAboveOrEqual && !isBestAboveOrEqual) {
                  // Final is >= target, best is below - prefer final
                  shouldUpdate = true;
                } else if (!isFinalAboveOrEqual && isBestAboveOrEqual) {
                  // Final is below, best is >= target - keep best
                  shouldUpdate = false;
                } else {
                  // Both are same side - choose closer
                  const finalDiff = isFinalAboveOrEqual
                    ? finalUnderlying - targetUnderlyingAmount
                    : targetUnderlyingAmount - finalUnderlying;
                  const bestDiff = isBestAboveOrEqual
                    ? bestUnderlyingAmount - targetUnderlyingAmount
                    : targetUnderlyingAmount - bestUnderlyingAmount;

                  shouldUpdate = finalDiff < bestDiff;
                }

                if (shouldUpdate) {
                  bestNTokenAmount = finalAmount;
                  bestUnderlyingAmount = finalUnderlying;
                  underlying_amount = finalUnderlying;
                }
              }
              console.log("withdraw:search bounds converged");
              break;
            }
          }

          // Use exact match if found, otherwise use best approximation
          if (exactMatchNToken !== null) {
            adjustedAmount = exactMatchNToken;
            // Verify exact match one more time
            ciPool.setFee(20000);
            ciPool.setPaymentAmount(1e5);
            const verifyR = await ciPool.withdraw(
              Number(marketId),
              adjustedAmount
            );
            underlying_amount = BigInt(verifyR.returnValue);
            console.log("withdraw:verified exact match", {
              adjustedAmount: adjustedAmount.toString(),
              underlying_amount: underlying_amount.toString(),
              targetUnderlyingAmount: targetUnderlyingAmount.toString(),
              isExact: underlying_amount === targetUnderlyingAmount,
            });
          } else {
            // First, ensure we have best below target
            if (
              bestBelowNToken === null &&
              underlying_amount < targetUnderlyingAmount
            ) {
              bestBelowNToken = bestNTokenAmount;
              bestBelowUnderlying = bestUnderlyingAmount;
              bestBelowDiff = targetUnderlyingAmount - bestUnderlyingAmount;
            }

            // Now search for best above target if we don't have it
            if (bestAboveNToken === null && bestBelowNToken !== null) {
              console.log(
                "withdraw:searching for best approximation above target",
                {
                  bestBelowNToken: bestBelowNToken.toString(),
                  bestBelowUnderlying: bestBelowUnderlying?.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                }
              );

              // Start from best below and increment to find best above
              let testAmount = bestBelowNToken + BigInt(1);
              const maxAboveSearchAttempts = 100;
              let aboveSearchAttempts = 0;

              while (aboveSearchAttempts < maxAboveSearchAttempts) {
                ciPool.setFee(20000);
                ciPool.setPaymentAmount(1e5);
                const aboveR = await ciPool.withdraw(
                  Number(marketId),
                  testAmount
                );
                if (!aboveR.success) {
                  throw new Error("Withdraw failed: try again with lower amount");
                }
                const testUnderlying = BigInt(aboveR.returnValue);

                // Check for exact match
                if (testUnderlying === targetUnderlyingAmount) {
                  exactMatchNToken = testAmount;
                  bestAboveNToken = testAmount;
                  bestAboveUnderlying = testUnderlying;
                  bestAboveDiff = BigInt(0);
                  console.log(
                    "withdraw:found EXACT match while searching above target"
                  );
                  break;
                }

                // If above target, track it
                if (testUnderlying > targetUnderlyingAmount) {
                  const testDiff = testUnderlying - targetUnderlyingAmount;
                  if (bestAboveDiff === null || testDiff < bestAboveDiff) {
                    bestAboveNToken = testAmount;
                    bestAboveUnderlying = testUnderlying;
                    bestAboveDiff = testDiff;
                  } else {
                    // Getting further from target, stop
                    break;
                  }
                } else {
                  // Still below target, continue incrementing
                  testAmount = testAmount + BigInt(1);
                }

                aboveSearchAttempts++;
              }
            }

            // Compare best below and best above, choose closest (prefer above if equal)
            if (bestBelowNToken !== null && bestAboveNToken !== null) {
              const belowDiff = bestBelowDiff!;
              const aboveDiff = bestAboveDiff!;

              if (aboveDiff <= belowDiff) {
                // Above is closer or equal - prefer above
                adjustedAmount = bestAboveNToken;
                underlying_amount = bestAboveUnderlying!;
                console.log("withdraw:chose best above target", {
                  adjustedAmount: adjustedAmount.toString(),
                  underlying_amount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  difference: aboveDiff.toString(),
                });
              } else {
                // Below is closer, but we still prefer above if it exists
                // So use above but log that below was closer
                adjustedAmount = bestAboveNToken;
                underlying_amount = bestAboveUnderlying!;
                console.log(
                  "withdraw:chose best above target (below was closer but prefer above)",
                  {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                    aboveDifference: aboveDiff.toString(),
                    belowDifference: belowDiff.toString(),
                  }
                );
              }
            } else if (bestAboveNToken !== null) {
              // Only have above
              adjustedAmount = bestAboveNToken;
              underlying_amount = bestAboveUnderlying!;
              console.log("withdraw:using best above target (no below found)", {
                adjustedAmount: adjustedAmount.toString(),
                underlying_amount: underlying_amount.toString(),
              });
            } else if (bestBelowNToken !== null) {
              // Only have below - increment to get above
              adjustedAmount = bestBelowNToken;
              underlying_amount = bestBelowUnderlying!;

              console.log(
                "withdraw:only have below target, incrementing to get above",
                {
                  initialAdjustedAmount: adjustedAmount.toString(),
                  initialUnderlyingAmount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                }
              );

              const maxIncrementAttempts = 100; // Safety limit
              let incrementAttempts = 0;

              while (
                underlying_amount < targetUnderlyingAmount &&
                incrementAttempts < maxIncrementAttempts
              ) {
                adjustedAmount = adjustedAmount + BigInt(1);
                incrementAttempts++;

                ciPool.setFee(20000);
                ciPool.setPaymentAmount(1e5);
                const incrementR = await ciPool.withdraw(
                  Number(marketId),
                  adjustedAmount
                );
                underlying_amount = BigInt(incrementR.returnValue);

                // Check for exact match
                if (underlying_amount === targetUnderlyingAmount) {
                  exactMatchNToken = adjustedAmount;
                  console.log("withdraw:found EXACT match while incrementing", {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    attempts: incrementAttempts,
                  });
                  break;
                }
              }

              if (incrementAttempts >= maxIncrementAttempts) {
                console.error(
                  "withdraw:reached max increment attempts, may not be above target",
                  {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  }
                );
              } else {
                console.log("withdraw:incremented to above target", {
                  finalAdjustedAmount: adjustedAmount.toString(),
                  finalUnderlyingAmount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  attempts: incrementAttempts,
                  isAboveTarget: underlying_amount >= targetUnderlyingAmount,
                });
              }
            } else {
              // Fallback to original best
              adjustedAmount = bestNTokenAmount;
              underlying_amount = bestUnderlyingAmount;
            }

            // If we still don't have exact match and we're above target, refine
            if (
              underlying_amount > targetUnderlyingAmount &&
              exactMatchNToken === null
            ) {
              console.log(
                "withdraw:best approximation below target, incrementing ntoken amount",
                {
                  initialAdjustedAmount: adjustedAmount.toString(),
                  initialUnderlyingAmount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                }
              );

              const maxIncrementAttempts = 100; // Safety limit
              let incrementAttempts = 0;

              while (
                underlying_amount < targetUnderlyingAmount &&
                incrementAttempts < maxIncrementAttempts
              ) {
                adjustedAmount = adjustedAmount + BigInt(1);
                incrementAttempts++;

                ciPool.setFee(20000);
                ciPool.setPaymentAmount(1e5);
                const incrementR = await ciPool.withdraw(
                  Number(marketId),
                  adjustedAmount
                );
                underlying_amount = BigInt(incrementR.returnValue);

                // Check for exact match
                if (underlying_amount === targetUnderlyingAmount) {
                  exactMatchNToken = adjustedAmount;
                  console.log("withdraw:found EXACT match while incrementing", {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    attempts: incrementAttempts,
                  });
                  break;
                }
              }

              if (incrementAttempts >= maxIncrementAttempts) {
                console.error(
                  "withdraw:reached max increment attempts, may not be above target",
                  {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  }
                );
              } else {
                console.log("withdraw:incremented to above target", {
                  finalAdjustedAmount: adjustedAmount.toString(),
                  finalUnderlyingAmount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  attempts: incrementAttempts,
                  isAboveTarget: underlying_amount >= targetUnderlyingAmount,
                });
              }
            }

            // Refinement: If we're above target, try to get closer by decrementing
            if (
              underlying_amount > targetUnderlyingAmount &&
              exactMatchNToken === null
            ) {
              console.log("withdraw:refining to get closer to target", {
                currentAdjustedAmount: adjustedAmount.toString(),
                currentUnderlyingAmount: underlying_amount.toString(),
                targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                currentDifference: (
                  underlying_amount - targetUnderlyingAmount
                ).toString(),
              });

              let bestRefinedAmount = adjustedAmount;
              let bestRefinedUnderlying = underlying_amount;
              let bestRefinedDiff = underlying_amount - targetUnderlyingAmount;
              const maxRefinementAttempts = 50; // Safety limit
              let refinementAttempts = 0;

              // Try decrementing to find the closest value to target
              while (refinementAttempts < maxRefinementAttempts) {
                const testAmount = bestRefinedAmount - BigInt(1);

                // Don't go below the best approximation we found earlier
                if (testAmount < bestNTokenAmount) {
                  break;
                }

                ciPool.setFee(20000);
                ciPool.setPaymentAmount(1e5);
                const refineR = await ciPool.withdraw(
                  Number(marketId),
                  testAmount
                );
                const testUnderlying = BigInt(refineR.returnValue);

                // Check for exact match
                if (testUnderlying === targetUnderlyingAmount) {
                  exactMatchNToken = testAmount;
                  adjustedAmount = testAmount;
                  underlying_amount = testUnderlying;
                  console.log("withdraw:found EXACT match during refinement", {
                    adjustedAmount: adjustedAmount.toString(),
                    underlying_amount: underlying_amount.toString(),
                    attempts: refinementAttempts + 1,
                  });
                  break;
                }

                // If still above target, check if it's closer
                if (testUnderlying >= targetUnderlyingAmount) {
                  const testDiff = testUnderlying - targetUnderlyingAmount;
                  if (testDiff < bestRefinedDiff) {
                    bestRefinedAmount = testAmount;
                    bestRefinedUnderlying = testUnderlying;
                    bestRefinedDiff = testDiff;
                  } else {
                    // Getting further from target, stop
                    break;
                  }
                } else {
                  // Went below target, use previous best
                  break;
                }

                refinementAttempts++;
              }

              // Use the best refined value
              if (exactMatchNToken === null) {
                adjustedAmount = bestRefinedAmount;
                underlying_amount = bestRefinedUnderlying;
                console.log("withdraw:refinement complete", {
                  refinedAdjustedAmount: adjustedAmount.toString(),
                  refinedUnderlyingAmount: underlying_amount.toString(),
                  targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                  finalDifference: (
                    underlying_amount - targetUnderlyingAmount
                  ).toString(),
                  attempts: refinementAttempts,
                  isExact: underlying_amount === targetUnderlyingAmount,
                });
              }
            }

            console.warn(
              "withdraw:no exact match found, using best approximation",
              {
                adjustedAmount: adjustedAmount.toString(),
                underlying_amount: underlying_amount.toString(),
                targetUnderlyingAmount: targetUnderlyingAmount.toString(),
                difference: (underlying_amount > targetUnderlyingAmount
                  ? underlying_amount - targetUnderlyingAmount
                  : targetUnderlyingAmount - underlying_amount
                ).toString(),
                isAboveTarget: underlying_amount >= targetUnderlyingAmount,
              }
            );
          }
        }
      }

      console.log("withdraw:adjustedAmount", {
        adjustedAmount,
        underlying_amount,
      });

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

      const buildN = [];

      // Withdraw from lending pool
      let withdrawSim: any = BigInt(0);
      {
        const withdrawAmount = adjustedAmount;
        const formattedWithdrawAmount = new BigNumber(withdrawAmount)
          .dividedBy(10 ** token.decimals)
          .toFixed(token.decimals);
        const formattedUnderlyingAmount = new BigNumber(underlying_amount)
          .dividedBy(10 ** token.decimals)
          .toFixed(token.decimals);
        const txnO = (
          await builder.lending.withdraw(Number(marketId), withdrawAmount)
        ).obj as any;
        const withdrawR = await ciPool.withdraw(Number(marketId), withdrawAmount);
        if (!withdrawR.success) {
          throw new Error("Failed to withdraw from lending pool");
        }
        withdrawSim = withdrawR.returnValue;
        const note = `lending withdraw ${formattedWithdrawAmount} n${token.symbol} (underlying: ${formattedUnderlyingAmount} ${token.symbol})`;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode(note),
          payment: 1e5,
          foreignApps: [46505155], // TODO use value from config
          desc: note,
        });
      }

      // cond a token withdraw - use underlying_amount (actual amount received from pool)
      if (
        tokenStandard == "network" ||
        tokenStandardUsesAsaStyleNt200Txns(tokenStandard)
      ) {
        const formmatedWithdrawAmount = new BigNumber(withdrawSim.toString())
          .dividedBy(10 ** token.decimals)
          .toFixed(token.decimals);
        const txnO = (await builder.token.withdraw(withdrawSim)).obj;
        const note = `atoken withdraw ${formmatedWithdrawAmount}`;
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode(note),
          desc: note,
        });


        if (
          folksWithdrawUsesFolksRedeem &&
          folksWithdrawAdapter != null &&
          withdrawSim > 0n &&
          options?.folksTwoStep !== "lending_to_wallet"
        ) {
          /** Same ~100 base-unit slack as deposit mint / `folks_redeem_only` (sim vs wallet). */
          const fAssetForRedeem =
            withdrawSim > 100n ? withdrawSim - 100n : withdrawSim;
          const buildFolksWithdrawFromPoolTxnsParams = {
            poolName: folksWithdrawAdapter.folksParams.pool,
            userAddress,
            fAssetAmount: fAssetForRedeem,
            algod: clients.algod,
          }
          console.log("buildFolksWithdrawFromPoolTxnsParams", { buildFolksWithdrawFromPoolTxnsParams });
          const folksRedeemTxns = await buildFolksWithdrawFromPoolTxns(
            buildFolksWithdrawFromPoolTxnsParams
          );
          if (folksRedeemTxns.length > 0) {
            buildN.push(...folksMintTxnsToArccjsExtraTxns(folksRedeemTxns));
          }
        }

        if (
          networkConfig.networkId === "algorand-mainnet" &&
          options?.xalgoConsensusWithdrawAppendBurn === true &&
          withdrawSim > 0n
        ) {
          if (folksWithdrawUsesFolksRedeem) {
            throw new Error(
              "Governance xALGO withdraw+burn cannot be combined with Folks redeem on withdraw."
            );
          }
          const underlyingId = Number(
            String(token.underlyingAssetId ?? "").trim()
          );
          if (
            underlyingId !== MainnetConsensusConfig.xAlgoId ||
            token.symbol !== "xALGO"
          ) {
            throw new Error(
              "xalgoConsensusWithdrawAppendBurn is only valid for the mainnet Governance xALGO market."
            );
          }
          const consensusState = await fetchXalgoMainnetConsensusState(
            clients.algod
          );
          const minAlgo = minAlgoOutBurnFloor(
            consensusState,
            withdrawSim,
            150n
          );
          if (minAlgo <= 0n) {
            throw new Error(
              "Burn output would be zero at current rates; amount is too small."
            );
          }
          const spBurn = await clients.algod.getTransactionParams().do();
          const { txns: burnUnsigned } = await buildXalgoBurnTxns({
            algod: clients.algod,
            senderAddr: userAddress,
            receiverAddr: userAddress,
            xalgoAmount: withdrawSim,
            minAlgoReceived: minAlgo,
            suggestedParams: spBurn,
          });
          if (burnUnsigned.length > 0) {
            buildN.push(...folksMintTxnsToArccjsExtraTxns(burnUnsigned));
          }
        }
      } else if (tokenStandard == "arc200-exchange") {
        const txnO = (
          await builder.arc200Exchange.arc200_swapBack(
            withdrawSim
          )
        ).obj;
        const note = "arc200_swapBack";
        buildN.push({
          ...txnO,
          note: new TextEncoder().encode(note),
          xaid: Number(token.underlyingAssetId),
          snd: userAddress,
          arcv: userAddress,
          desc: note,
        });
      }

      console.log("withdraw:buildN", { buildN });

      // Create withdraw transaction
      ci.setFee(20000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      if (networkConfig.networkId === "algorand-mainnet") {
        ci.setBeaconId(3209233839); // TODO move this to ulujs
      }

      const customTx = await ci.custom();

      console.log("withdraw:customTx", { customTx });

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

      if (options?.folksTwoStep === "lending_to_wallet") {
        return {
          success: true,
          txns: customTx.txns,
          withdrawMeta: {
            folksTwoStep: "lending_to_wallet",
            fAssetToRedeemAtomic: underlying_amount.toString(),
          },
        };
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
  networkId: NetworkId,
  options?: {
    depositAdapterId?: string;
    /**
     * When set on Algorand mainnet xALGO consensus+supply, prepend governance `immediate_mint`
     * into `buildN` (same arccjs path as Folks f-asset mint) so `ci.custom()` simulation sees minted xALGO before nt200 axfer.
     */
    xalgoConsensusMintAlgoMicros?: bigint;
    /**
     * When set on Algorand mainnet tALGO Tinyman mint+supply, prepend Tinyman `mint`
     * into `buildN` (same arccjs path as Folks f-asset / xALGO mint preamble).
     */
    tinymanTalgoMintAlgoMicros?: bigint;
    /** Return only the Folks mint transaction group; user supplies f-ALGO in a follow-up (see `VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP`). */
    folksTwoStep?: "folks_mint_only";
  }
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | {
    success: true;
    txns: string[];
    depositMeta?: { folksTwoStep: "folks_mint_only" };
  }
> => {
  console.log("=== DEPOSIT DEBUG START ===");
  console.log("deposit called with:", {
    poolId,
    marketId,
    tokenStandard,
    amount,
    userAddress,
    networkId,
    depositAdapterId: options?.depositAdapterId,
    xalgoConsensusMintAlgoMicros: options?.xalgoConsensusMintAlgoMicros?.toString(),
    tinymanTalgoMintAlgoMicros: options?.tinymanTalgoMintAlgoMicros?.toString(),
    folksTwoStep: options?.folksTwoStep,
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

      const clients = await algorandService.initializeClientsForReads(
        algorandNetwork
      );
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

      const tokenConfigForDeposit = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );
      const tokenConfigLookupSymbol =
        tokenConfigLookupKeyFromDisplayToken(token);

      const folksForDeposit = resolveDepositFolksAdapter(
        tokenConfigForDeposit ?? {},
        options?.depositAdapterId
      );
      const depositPhaseAdapters = tokenConfigForDeposit
        ? getTokenAdaptersForPhase(tokenConfigForDeposit, "deposit")
        : [];

      /**
       * `arc200_balanceOf` is f-ASA on nt200. For Folks `network-asa` / `asa-asa`, `bigAmount` is underlying
       * (ALGO / xALGO / USDC …) except when the user chose deposit-from-f-wallet (`market_token`).
       * Only compare / subtract when both sides are f-ASA (e.g. fUSDC supply from wallet), never for
       * ALGO→xALGO consensus mint+supply or underlying xALGO→fxALGO mint.
       */
      const applyArc200DepositBalanceAdjustment =
        tokenStandardUsesNt200Arc200Balance(tokenStandard) &&
        (!tokenStandardIsFolksAsaBridge(tokenStandard) ||
          folksForDeposit?.depositWalletBasis === "market_token");

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

      const ciToken = new CONTRACT(
        Number(token.underlyingContractId),
        clients.algod,
        undefined,
        abi.nt200,
        {
          addr: userAddress,
          sk: new Uint8Array(),
        }
      );

      // Get user's token balance for network, asa, network-asa, or arc200-exchange standards
      let token_balance = BigInt(0);
      let adjustedDepositAmount = bigAmount;

      if (tokenStandardUsesNt200Arc200Balance(tokenStandard)) {
        const token_balanceR = await ciToken.arc200_balanceOf(userAddress);
        console.log("deposit:token_balanceR (user)", { token_balanceR });
        token_balance = BigInt(token_balanceR.returnValue);

        if (applyArc200DepositBalanceAdjustment) {
          if (token_balance > BigInt(0) && bigAmount > token_balance) {
            adjustedDepositAmount = bigAmount - token_balance;
            console.log(
              "deposit:adjusted deposit amount based on user token balance",
              {
                requestedAmount: bigAmount.toString(),
                userTokenBalance: token_balance.toString(),
                adjustedDepositAmount: adjustedDepositAmount.toString(),
                note: "User already has tokens, so we need to deposit less",
              }
            );
          } else if (token_balance >= bigAmount) {
            adjustedDepositAmount = BigInt(0);
            console.log(
              "deposit:user has sufficient token balance, no deposit needed",
              {
                requestedAmount: bigAmount.toString(),
                userTokenBalance: token_balance.toString(),
              }
            );
          }
        }
      }

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

      // `token.symbol` is often the display symbol when marketOverride exists (e.g. "Algo").
      // `configKey` / `originalSymbol` is the canonical `tokens` map key (e.g. "fALGO") for getTokenConfig + adapter.
      // `tokenConfigForDeposit`, `folksForDeposit`, and `depositPhaseAdapters` are resolved earlier (before nt200 balance adjustment).

      if (tokenStandardIsFolksAsaBridge(tokenStandard) && !folksForDeposit) {
        throw new Error(
          "tokenStandard network-asa / asa-asa requires a Folks adapter for deposit (adapter / adapters with deposit phase)."
        );
      }

      /** ASA index (`xaid`) for nt200 `deposit` axfer — f-ASA for Folks `network-asa`, else display `underlyingAssetId`. */
      let nt200DepositAxferAssetId =
        token.underlyingAssetId != null &&
          String(token.underlyingAssetId).trim() !== ""
          ? Number(token.underlyingAssetId)
          : NaN;

      const normalizeFolksUnderlyingAssetId = (
        raw: string | undefined | null
      ): string => {
        const s = String(raw ?? "").trim();
        if (s === "" || s === "-") return "0";
        return s;
      };

      let folksMintTxns: algosdk.Transaction[] | null = null;
      if (depositPhaseAdapters.length > 0) {
        for (const a of depositPhaseAdapters) {
          if (a.type !== "folks") {
            throw new Error(`Unsupported deposit adapter type: ${a.type}`);
          }
        }
        if (!folksForDeposit) {
          throw new Error(
            "Deposit adapters are configured but none apply to the deposit phase (check phases)."
          );
        }
        if (networkConfig.networkId !== "algorand-mainnet") {
          throw new Error(
            "Folks deposit adapter is only supported on Algorand mainnet"
          );
        }
        const fp = folksForDeposit.folksParams;
        const cfgAssetStr = String(tokenConfigForDeposit.assetId ?? "").trim();
        const fpFAssetStr = String(fp.fAssetId ?? "").trim();
        const fpUnderlyingNorm = normalizeFolksUnderlyingAssetId(fp.assetId);
        const cfgAsUnderlyingNorm = normalizeFolksUnderlyingAssetId(
          cfgAssetStr !== "" ? cfgAssetStr : undefined
        );
        const fAssetMatchesMarket =
          fpFAssetStr !== "" && cfgAssetStr !== "" && cfgAssetStr === fpFAssetStr;
        const underlyingMatches =
          cfgAsUnderlyingNorm !== "" &&
          cfgAsUnderlyingNorm === fpUnderlyingNorm;
        if (!fAssetMatchesMarket && !underlyingMatches) {
          throw new Error(
            `Folks deposit adapter pool does not match this token row (config assetId ${String(tokenConfigForDeposit.assetId)} vs pool underlying ${fp.assetId} / fAsset ${fp.fAssetId})`
          );
        }
        if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
          const fAsa = Number(fp.fAssetId);
          if (!Number.isFinite(fAsa) || fAsa <= 0) {
            throw new Error(
              "Folks deposit adapter (ASA): invalid folksParams.fAssetId for nt200 axfer"
            );
          }
          nt200DepositAxferAssetId = fAsa;
        }
        const skipFolksMint =
          folksForDeposit.depositWalletBasis === "market_token";
        if (adjustedDepositAmount > BigInt(0) && !skipFolksMint) {
          folksMintTxns = await buildFolksDepositMintTxns({
            poolName: fp.pool,
            userAddress,
            amount: adjustedDepositAmount,
            algod: clients.algod,
          });
        } else if (skipFolksMint) {
          console.log(
            "folksMintTxns skipped: market_token deposit (f-ASA from wallet, no Folks mint)",
            { bigAmount: bigAmount.toString(), token_balance: token_balance.toString() }
          );
        } else {
          console.log(
            "folksMintTxns skipped: adjustedDepositAmount is 0 (nt200 ARC200 balance already covers requested deposit)",
            { bigAmount: bigAmount.toString(), token_balance: token_balance.toString() }
          );
        }
      } else if (tokenStandardIsFolksAsaBridge(tokenStandard)) {
        console.warn(
          "folksMintTxns skipped: no adapter on resolved token config row",
          { tokenConfigLookupSymbol, displaySymbol: token.symbol }
        );
      }

      console.log("folksMintTxns", {
        folksMintTxns,
        tokenConfigLookupSymbol,
        hasAdapter: tokenConfigHasAdapters(tokenConfigForDeposit),
        adjustedDepositAmount: adjustedDepositAmount.toString(),
        networkId: networkConfig.networkId,
      });

      if (options?.folksTwoStep === "folks_mint_only") {
        if (options.xalgoConsensusMintAlgoMicros != null || options.tinymanTalgoMintAlgoMicros != null) {
          throw new Error("Two-step Folks mint cannot be combined with consensus or Tinyman mint preambles.");
        }
        if (!folksMintTxns || folksMintTxns.length === 0) {
          throw new Error(
            "Two-step deposit (Folks mint only) needs a positive ALGO amount and the Folks “Deposit ALGO” route."
          );
        }
        const txnsB64 = folksMintTxns.map((t) =>
          Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString("base64")
        );
        return {
          success: true,
          txns: txnsB64,
          depositMeta: { folksTwoStep: "folks_mint_only" },
        };
      }

      /** Units of the nt200 / ARC200 market token (e.g. fALGO) to move after Folks mint. */
      let depositIntoNt200Amount = adjustedDepositAmount;
      /** Folks-estimated f-asset minted for this deposit (0 when no Folks mint). */
      let mintedFAssetForArc200 = BigInt(0);
      if (folksMintTxns && folksMintTxns.length > 0 && folksForDeposit) {
        const fp = folksForDeposit.folksParams;
        const { mintedFAsset, depositInterestIndex } =
          await estimateFolksDepositMintedFAssetAmount({
            poolName: fp.pool,
            underlyingAmount: adjustedDepositAmount,
            algod: clients.algod,
          });
        /**
         * SDK / client f-asset mint *estimates* (see `calcDepositReturn`, `retrievePoolInfo`) can
         * overshoot what `pool.deposit` actually credits (index timing, on-chain floor vs client
         * math). That must be adjusted to a *conservative* f-amount before nt200 axfer, or Algod
         * fails (e.g. "underflow on subtracting … from sender amount" when the axfer requests
         * more f-ASA than the wallet just received). The haircut below implements that; keep tiny
         * deposits viable (no subtract that would drive the minted leg to 0 at small size).
         */
        // TODO: fix in Folks SDK
        const mintedFAssetForLending =
          mintedFAsset > 100n ? mintedFAsset - 100n : mintedFAsset;
        depositIntoNt200Amount = mintedFAssetForLending;
        mintedFAssetForArc200 = mintedFAssetForLending;
        console.log("folksMint: underlying → f-asset (nt200 deposit units)", {
          underlyingForFolks: adjustedDepositAmount.toString(),
          mintedFAsset: mintedFAsset.toString(),
          mintedFAssetForLending: mintedFAssetForLending.toString(),
          depositInterestIndex: depositInterestIndex.toString(),
        });
      }

      const useMintedFAssetForArc200ApproveAndLending =
        folksMintTxns &&
        folksMintTxns.length > 0 &&
        folksForDeposit != null;
      /** Total ARC200 units the pool should pull (f-asset); Folks path must match minted f-asset + balance already on nt200. */
      const arc200ApproveAndLendingAmount = useMintedFAssetForArc200ApproveAndLending
        ? token_balance + mintedFAssetForArc200
        : bigAmount;

      /** ARC200 / nt200 leg label (not display `symbol`, which may show underlying as "Algo"). */
      const nt200DepositNoteSymbol =
        token.originalSymbol === "fALGO" ? "fAlgo" : token.originalSymbol;

      let consensusMintArccjsExtras: Record<string, unknown>[] | null = null;
      let tinymanTalgoMintArccjsExtras: Record<string, unknown>[] | null = null;
      const xalgoMintMicros = options?.xalgoConsensusMintAlgoMicros;
      const talgoMintMicros = options?.tinymanTalgoMintAlgoMicros;
      if (
        xalgoMintMicros != null &&
        xalgoMintMicros > 0n &&
        talgoMintMicros != null &&
        talgoMintMicros > 0n
      ) {
        throw new Error(
          "Cannot combine Governance xALGO mint and Tinyman tALGO mint in one deposit."
        );
      }
      if (
        networkConfig.networkId === "algorand-mainnet" &&
        xalgoMintMicros != null &&
        xalgoMintMicros > 0n
      ) {
        if (folksMintTxns != null && folksMintTxns.length > 0) {
          throw new Error(
            "Governance xALGO mint preamble cannot be combined with Folks mint transactions in one deposit."
          );
        }
        const underlyingId = Number(String(token.underlyingAssetId ?? "").trim());
        if (
          underlyingId !== MainnetConsensusConfig.xAlgoId ||
          token.symbol !== "xALGO"
        ) {
          throw new Error(
            "xalgoConsensusMintAlgoMicros is only valid for the mainnet Governance xALGO market."
          );
        }
        const algoMicro = xalgoMintMicros;
        const spMint = await clients.algod.getTransactionParams().do();
        const { unsigned: mintUnsigned, consensusState } =
          await buildGovernanceXalgoMintUnsignedWithOptionalOptIn({
            algod: clients.algod,
            senderAddr: userAddress,
            receiverAddr: userAddress,
            algoMicroAlgos: algoMicro,
            suggestedParams: spMint,
          });
        const minAtomic = minXalgoOutImmediateMintFloor(
          consensusState,
          algoMicro,
          150n
        );
        if (minAtomic !== bigAmount) {
          throw new Error(
            `Governance mint min xALGO (${minAtomic.toString()}) must equal deposit amount (${bigAmount.toString()}). Refresh quote and retry.`
          );
        }
        consensusMintArccjsExtras = folksMintTxnsToArccjsExtraTxns(mintUnsigned);
      }
      if (
        networkConfig.networkId === "algorand-mainnet" &&
        talgoMintMicros != null &&
        talgoMintMicros > 0n
      ) {
        if (folksMintTxns != null && folksMintTxns.length > 0) {
          throw new Error(
            "Tinyman tALGO mint preamble cannot be combined with Folks mint transactions in one deposit."
          );
        }
        const underlyingId = Number(String(token.underlyingAssetId ?? "").trim());
        if (underlyingId !== MAINNET_TALGO_ASA_ID || token.symbol !== "tALGO") {
          throw new Error(
            "tinymanTalgoMintAlgoMicros is only valid for the mainnet Tinyman tALGO market."
          );
        }
        const algoMicro = talgoMintMicros;
        const spMint = await clients.algod.getTransactionParams().do();
        const { unsigned: mintUnsigned } =
          await buildTalgoMintUnsignedWithOptionalOptIn({
            algod: clients.algod,
            senderAddr: userAddress,
            algoMicroAlgos: algoMicro,
            suggestedParams: spMint,
          });
        const minAtomic = await fetchMinTalgoOutMintFloorFromChain(
          clients.algod,
          algoMicro,
          150n
        );
        if (minAtomic !== bigAmount) {
          throw new Error(
            `Tinyman mint min tALGO (${minAtomic.toString()}) must equal deposit amount (${bigAmount.toString()}). Refresh quote and retry.`
          );
        }
        tinymanTalgoMintArccjsExtras = folksMintTxnsToArccjsExtraTxns(mintUnsigned);
      }

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

        // `buildN`: pool `custom()` extras — governance xALGO mint, Tinyman tALGO mint, then Folks mint,
        // nt200 deposit / approve, lending deposit (same arccjs simulation path as fALGO preamble).
        const buildN = [];

        if (consensusMintArccjsExtras && consensusMintArccjsExtras.length > 0) {
          buildN.push(...consensusMintArccjsExtras);
        }
        if (tinymanTalgoMintArccjsExtras && tinymanTalgoMintArccjsExtras.length > 0) {
          buildN.push(...tinymanTalgoMintArccjsExtras);
        }

        if (folksMintTxns && folksMintTxns.length > 0) {
          buildN.push(...folksMintTxnsToArccjsExtraTxns(folksMintTxns));
        }

        const runNt200DepositAndLendingPath = true;
        if (runNt200DepositAndLendingPath) {
          // TODO fund ntoken

          // conditionally deposit to token
          // Skip deposit if adjusted amount is 0 (user already has enough tokens)
          if (adjustedDepositAmount > BigInt(0)) {
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
              {
                const txnO = (await builder.token.deposit(depositIntoNt200Amount))
                  .obj;
                const formattedDepositAmount = new BigNumber(
                  depositIntoNt200Amount
                )
                  .dividedBy(10 ** token.decimals)
                  .toFixed(token.decimals);
                const note = new TextEncoder().encode(
                  `nt200 deposit ${formattedDepositAmount} ${nt200DepositNoteSymbol}`
                );
                buildN.push({
                  ...txnO,
                  payment: depositIntoNt200Amount,
                  note,
                });
              }
            } else if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
              const aamt = depositIntoNt200Amount;
              if (!Number.isFinite(nt200DepositAxferAssetId)) {
                throw new Error(
                  "nt200 ASA deposit: missing axfer asset id (set underlyingAssetId or use Folks adapter with fAssetId)"
                );
              }
              const xaid = nt200DepositAxferAssetId;
              const payment = p1 > 0 ? 28501 : 0;
              const axfer = { payment, aamt, xaid };
              const formattedDepositAmount = new BigNumber(depositIntoNt200Amount)
                .dividedBy(10 ** token.decimals)
                .toFixed(token.decimals);
              const note = new TextEncoder().encode(
                `nt200 deposit ${formattedDepositAmount} ${nt200DepositNoteSymbol}`
              );
              const txnO = (await builder.token.deposit(depositIntoNt200Amount))
                .obj;
              buildN.push({
                ...txnO,
                ...axfer,
                note,
              });
            } else if (tokenStandard == "arc200-exchange") {
              const axfer = {
                aamt: depositIntoNt200Amount,
                xaid: Number(token.underlyingAssetId),
              };
              const formattedDepositAmount = new BigNumber(depositIntoNt200Amount)
                .dividedBy(10 ** token.decimals)
                .toFixed(token.decimals);
              const note = new TextEncoder().encode(
                `arc200_redeem ${formattedDepositAmount} ${nt200DepositNoteSymbol}`
              );
              const txnO = (
                await builder.arc200Exchange.arc200_redeem(depositIntoNt200Amount)
              ).obj;
              buildN.push({
                ...txnO,
                ...axfer,
                note,
              });
            }
          } else {
            console.log(
              "deposit:skipping token deposit, user already has sufficient balance",
              {
                requestedAmount: bigAmount.toString(),
                userTokenBalance: token_balance.toString(),
              }
            );
          }

          // approve spending of token
          // Buffer on total ARC200 pull; when Folks mints, base on minted f-asset (+ existing nt200 balance), not `amount` (may be underlying units).
          {
            const approvalAmount = BigInt(
              new BigNumber(arc200ApproveAndLendingAmount.toString())
                .multipliedBy(1.1)
                .toFixed(0)
            ); // TODO only increase for NODE
            const txnO = (
              await builder.token.arc200_approve(
                algosdk.encodeAddress(
                  algosdk.getApplicationAddress(Number(poolId)).publicKey
                ),
                approvalAmount
              )
            ).obj;
            const formattedApprovalAmount = new BigNumber(approvalAmount)
              .dividedBy(10 ** token.decimals)
              .toFixed(token.decimals);
            const note = new TextEncoder().encode(
              `arc200 approve ${formattedApprovalAmount} ${nt200DepositNoteSymbol}`
            );
            buildN.push({
              ...txnO,
              payment: p2 > 0 ? 28502 : 0,
              note,
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
              amount: arc200ApproveAndLendingAmount.toString(),
              poolId: Number(poolId),
              payment,
              foreignApps,
            });
            const formattedAmount = new BigNumber(arc200ApproveAndLendingAmount)
              .dividedBy(10 ** token.decimals)
              .toFixed(token.decimals);
            const note = new TextEncoder().encode(
              `lending deposit ${formattedAmount} ${nt200DepositNoteSymbol}`
            );
            const txnO = (
              await builder.lending.deposit(
                Number(marketId),
                arc200ApproveAndLendingAmount
              )
            ).obj as any;
            buildN.push({
              ...txnO,
              note,
              payment,
              foreignApps,
            });
            console.log("Deposit transaction added to buildN");
          }
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
      const clients = await algorandService.initializeClientsForReads(
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
  networkId: NetworkId,
  options?: {
    borrowAdapterId?: string;
    /**
     * When true on Algorand mainnet Governance xALGO: after nt200 withdraw, append governance
     * `burn` so the wallet receives native ALGO (same atomic group as `borrow` + `withdraw`).
     */
    xalgoConsensusBorrowAppendBurn?: boolean;
  }
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("borrow", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
    borrowAdapterId: options?.borrowAdapterId,
    xalgoConsensusBorrowAppendBurn: options?.xalgoConsensusBorrowAppendBurn,
  });

  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = await algorandService.initializeClientsForReads(
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
      console.log("Looking for marketId:", marketId, "poolId:", poolId);

      const token = resolveDisplayTokenForPoolMarket(networkId, poolId, marketId);

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
      if (
        tokenStandardUsesAsaStyleNt200Txns(tokenStandard) ||
        tokenStandard === "arc200-exchange"
      ) {
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

      const tokenConfigForBorrow = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );

      const folksBorrowAdapter = resolveBorrowFolksAdapter(
        tokenConfigForBorrow ?? {},
        options?.borrowAdapterId
      );
      const borrowUsesFolksRedeem =
        folksBorrowAdapter != null &&
        folksBorrowAdapter.borrowReceiveBasis === "underlying" &&
        networkConfig.networkId === "algorand-mainnet" &&
        tokenStandardUsesAsaStyleNt200Txns(tokenStandard);

      if (
        options?.borrowAdapterId &&
        String(options.borrowAdapterId).trim() !== "" &&
        options?.xalgoConsensusBorrowAppendBurn === true
      ) {
        throw new Error(
          "Governance xALGO borrow+burn cannot be combined with a Folks borrow adapter id."
        );
      }

      let folksBorrowExtraTxns: Record<string, unknown>[] = [];
      if (borrowUsesFolksRedeem && folksBorrowAdapter) {
        const amt = BigInt(amount);
        if (amt > BigInt(0)) {
          const folksRedeemTxns = await buildFolksWithdrawFromPoolTxns({
            poolName: folksBorrowAdapter.folksParams.pool,
            userAddress,
            fAssetAmount: amt,
            algod: clients.algod,
          });
          if (folksRedeemTxns.length > 0) {
            folksBorrowExtraTxns =
              folksMintTxnsToArccjsExtraTxns(folksRedeemTxns);
          }
        }
      }

      let consensusBurnBorrowArccjsExtras: Record<string, unknown>[] | null =
        null;
      if (
        networkConfig.networkId === "algorand-mainnet" &&
        options?.xalgoConsensusBorrowAppendBurn === true &&
        bigAmount > BigInt(0)
      ) {
        if (folksBorrowExtraTxns.length > 0) {
          throw new Error(
            "Governance xALGO borrow+burn cannot be combined with Folks redeem borrow transactions."
          );
        }
        const underlyingId = Number(
          String(token.underlyingAssetId ?? "").trim()
        );
        if (
          underlyingId !== MainnetConsensusConfig.xAlgoId ||
          token.symbol !== "xALGO"
        ) {
          throw new Error(
            "xalgoConsensusBorrowAppendBurn is only valid for the mainnet Governance xALGO market."
          );
        }
        const consensusState = await fetchXalgoMainnetConsensusState(
          clients.algod
        );
        const minAlgo = minAlgoOutBurnFloor(consensusState, bigAmount, 150n);
        if (minAlgo <= 0n) {
          throw new Error("Burn output would be zero at current rates; amount is too small.");
        }
        const spBurn = await clients.algod.getTransactionParams().do();
        const { txns: burnUnsigned } = await buildXalgoBurnTxns({
          algod: clients.algod,
          senderAddr: userAddress,
          receiverAddr: userAddress,
          xalgoAmount: bigAmount,
          minAlgoReceived: minAlgo,
          suggestedParams: spBurn,
        });
        consensusBurnBorrowArccjsExtras =
          folksMintTxnsToArccjsExtraTxns(burnUnsigned);
      }

      ciLending.setFee(5000);

      // const calculate_user_debt_interestR =
      //   await ciLending.calculate_user_debt_interest(
      //     userAddress,
      //     Number(marketId)
      //   );
      // console.log("calculate_user_debt_interestR", {
      //   calculate_user_debt_interestR,
      // });
      // const calculate_user_debt_interest =
      //   calculate_user_debt_interestR.returnValue;
      // console.log("calculate_user_debt_interest", {
      //   calculate_user_debt_interest,
      // });

      // const sync_marketR = await ciLending.sync_market(Number(marketId));
      // console.log("sync_marketR", { sync_marketR });

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
        if (
          tokenStandard == "network" ||
          tokenStandardUsesAsaStyleNt200Txns(tokenStandard)
        ) {
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
        else if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
          const txnO = (await builder.token.withdraw(BigInt(amount))).obj;
          buildN.push({
            ...txnO,
            ...optIn,
            note: new TextEncoder().encode("nt200 withdraw"),
          });
          if (folksBorrowExtraTxns.length > 0) {
            buildN.push(...folksBorrowExtraTxns);
          }
          if (
            consensusBurnBorrowArccjsExtras &&
            consensusBurnBorrowArccjsExtras.length > 0
          ) {
            buildN.push(...consensusBurnBorrowArccjsExtras);
          }
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
 * Resolve a `getAllTokensWithDisplayInfo` row for lending ops.
 * Same market contract id can exist on multiple pools (e.g. fALGO on A vs D); match pool first.
 */
function resolveDisplayTokenForPoolMarket(
  networkId: NetworkId,
  poolId: string,
  marketId: string
): ReturnType<typeof getAllTokensWithDisplayInfo>[number] | undefined {
  const allTokens = getAllTokensWithDisplayInfo(networkId);
  const byPool = allTokens.find(
    (t) =>
      String(t.underlyingContractId ?? "") === String(marketId) &&
      String(t.poolId ?? "") === String(poolId)
  );
  if (byPool) return byPool;
  return allTokens.find(
    (t) => String(t.underlyingContractId ?? "") === String(marketId)
  );
}

/**
 * Repay borrowed tokens to a lending market
 */
export const repay = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId,
  options?: {
    repayAdapterId?: string;
    /**
     * When set on mainnet Governance xALGO: prepend governance `immediate_mint` (ALGO → xALGO) into
     * `buildN` so the user repays with native ALGO in one atomic group (same arccjs path as deposit).
     */
    xalgoConsensusRepayAlgoMicros?: bigint;
  }
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("repay", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
    repayAdapterId: options?.repayAdapterId,
    xalgoConsensusRepayAlgoMicros:
      options?.xalgoConsensusRepayAlgoMicros?.toString(),
  });

  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const arc200Service = ARC200Service.initialize(clients);
      console.log("arc200Service", { arc200Service });
      const balance = await ARC200Service.getBalance(userAddress, marketId);
      console.log("balance", { balance });
      const tokenInfo = await ARC200Service.getTokenInfo(marketId);
      console.log("tokenInfo", { tokenInfo });

      const allTokens = getAllTokensWithDisplayInfo(networkId);
      console.log(
        "All available tokens:",
        allTokens.map((t) => ({
          symbol: t.symbol,
          poolId: t.poolId,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId, "poolId:", poolId);

      const token = resolveDisplayTokenForPoolMarket(networkId, poolId, marketId);

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      const tokenConfigForRepay = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );

      const repayPhaseAdapters = tokenConfigForRepay
        ? getTokenAdaptersForPhase(tokenConfigForRepay, "repay")
        : [];
      const folksForRepay = resolveRepayFolksAdapter(
        tokenConfigForRepay ?? {},
        options?.repayAdapterId
      );

      if (
        tokenStandardIsFolksAsaBridge(tokenStandard) &&
        repayPhaseAdapters.length > 0 &&
        !folksForRepay
      ) {
        throw new Error(
          "tokenStandard network-asa / asa-asa requires a Folks repay adapter when repay-phase adapters are configured."
        );
      }

      /** ASA index for nt200 `deposit` axfer before repay. */
      let nt200RepayAxferXaid =
        token.underlyingAssetId != null &&
          String(token.underlyingAssetId).trim() !== ""
          ? Number(token.underlyingAssetId)
          : NaN;

      let consensusRepayMintExtras: Record<string, unknown>[] | null = null;
      let repayArc200Units: bigint;
      const xalgoRepayMicro = options?.xalgoConsensusRepayAlgoMicros;
      if (xalgoRepayMicro != null && xalgoRepayMicro > 0n) {
        if (
          options?.repayAdapterId != null &&
          String(options.repayAdapterId).trim() !== ""
        ) {
          throw new Error(
            "Do not pass repayAdapterId together with xalgoConsensusRepayAlgoMicros."
          );
        }
        if (repayPhaseAdapters.length > 0) {
          throw new Error(
            "Governance xALGO ALGO repay cannot be combined with Folks repay adapters on this token row."
          );
        }
        if (networkId !== "algorand-mainnet") {
          throw new Error(
            "Governance xALGO consensus repay is only available on Algorand mainnet."
          );
        }
        const underlyingId = Number(String(token.underlyingAssetId ?? "").trim());
        if (
          underlyingId !== MainnetConsensusConfig.xAlgoId ||
          token.symbol !== "xALGO"
        ) {
          throw new Error(
            "xalgoConsensusRepayAlgoMicros is only valid for the mainnet Governance xALGO market."
          );
        }
        const spMint = await clients.algod.getTransactionParams().do();
        const { unsigned: mintUnsigned, consensusState } =
          await buildGovernanceXalgoMintUnsignedWithOptionalOptIn({
            algod: clients.algod,
            senderAddr: userAddress,
            receiverAddr: userAddress,
            algoMicroAlgos: xalgoRepayMicro,
            suggestedParams: spMint,
          });
        repayArc200Units = minXalgoOutImmediateMintFloor(
          consensusState,
          xalgoRepayMicro,
          150n
        );
        consensusRepayMintExtras = folksMintTxnsToArccjsExtraTxns(mintUnsigned);
      } else {
        repayArc200Units = BigInt(
          new BigNumber(amount).multipliedBy(10 ** token.decimals).toFixed(0)
        );
      }

      let folksMintTxns: algosdk.Transaction[] | null = null;

      const normalizeFolksUnderlyingAssetId = (
        raw: string | undefined | null
      ): string => {
        const s = String(raw ?? "").trim();
        if (s === "" || s === "-") return "0";
        return s;
      };

      if (repayPhaseAdapters.length > 0 && folksForRepay) {
        if (consensusRepayMintExtras != null && consensusRepayMintExtras.length > 0) {
          throw new Error(
            "Governance xALGO mint preamble cannot be combined with Folks mint repay in one group."
          );
        }
        for (const a of repayPhaseAdapters) {
          if (a.type !== "folks") {
            throw new Error(`Unsupported repay adapter type: ${a.type}`);
          }
        }
        if (networkConfig.networkId !== "algorand-mainnet") {
          throw new Error(
            "Folks repay adapter is only supported on Algorand mainnet"
          );
        }
        const fp = folksForRepay.folksParams;
        if (!tokenConfigForRepay) {
          throw new Error("Token config missing for Folks repay");
        }
        const cfgAssetStr = String(tokenConfigForRepay.assetId ?? "").trim();
        const fpFAssetStr = String(fp.fAssetId ?? "").trim();
        const fpUnderlyingNorm = normalizeFolksUnderlyingAssetId(fp.assetId);
        const cfgAsUnderlyingNorm = normalizeFolksUnderlyingAssetId(
          cfgAssetStr !== "" ? cfgAssetStr : undefined
        );
        const fAssetMatchesMarket =
          fpFAssetStr !== "" && cfgAssetStr !== "" && cfgAssetStr === fpFAssetStr;
        const underlyingMatches =
          cfgAsUnderlyingNorm !== "" &&
          cfgAsUnderlyingNorm === fpUnderlyingNorm;
        if (!fAssetMatchesMarket && !underlyingMatches) {
          throw new Error(
            `Folks repay adapter pool does not match this token row (config assetId ${String(tokenConfigForRepay.assetId)} vs pool underlying ${fp.assetId} / fAsset ${fp.fAssetId})`
          );
        }
        if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
          const fAsa = Number(fp.fAssetId);
          if (!Number.isFinite(fAsa) || fAsa <= 0) {
            throw new Error(
              "Folks repay adapter (ASA): invalid folksParams.fAssetId for nt200 axfer"
            );
          }
          nt200RepayAxferXaid = fAsa;
        }
        const skipFolksMint =
          folksForRepay.repayWalletBasis === "market_token";
        if (!skipFolksMint) {
          const underlyingAtomic = BigInt(
            new BigNumber(amount).multipliedBy(10 ** token.decimals).toFixed(0)
          );
          if (underlyingAtomic <= BigInt(0)) {
            throw new Error("Repay amount must be positive");
          }
          folksMintTxns = await buildFolksDepositMintTxns({
            poolName: fp.pool,
            userAddress,
            amount: underlyingAtomic,
            algod: clients.algod,
          });
          const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
            poolName: fp.pool,
            underlyingAmount: underlyingAtomic,
            algod: clients.algod,
          });
          repayArc200Units = mintedFAsset;
        }
      }

      const symbol = token.symbol;

      // Repay is allowed even when market is paused (users should be able to repay debt)

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
        amount: repayArc200Units,
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

        if (consensusRepayMintExtras && consensusRepayMintExtras.length > 0) {
          buildN.push(...consensusRepayMintExtras);
        }

        if (folksMintTxns && folksMintTxns.length > 0) {
          buildN.push(...folksMintTxnsToArccjsExtraTxns(folksMintTxns));
        }

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
            const txnO = (await builder.token.deposit(repayArc200Units)).obj;
            buildN.push({
              ...txnO,
              note: new TextEncoder().encode("nt200 deposit"),
              payment: repayArc200Units,
            });
          }
        } else if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
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
            const txnO = (await builder.token.deposit(repayArc200Units)).obj;
            const axfer = {
              aamt: repayArc200Units,
              xaid: nt200RepayAxferXaid,
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
            aamt: repayArc200Units,
            xaid: Number(token.underlyingAssetId),
          };
          const txnO = (
            await builder.arc200Exchange.arc200_redeem(repayArc200Units)
          ).obj;
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
          const txnO = (
            await builder.token.arc200_approve(addr, repayArc200Units)
          ).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode(
              `arc200 approve ${symbol} token spending to pool (${addr}) for user (${userAddress})`
            ),
            payment: p2 > 0 ? 28502 : 0,
          });
        }
        // sync user market for price change
        // {
        //   const txnO = (
        //     await builder.lending.sync_user_market_for_price_change(userAddress, Number(marketId))
        //   ).obj as any;
        //   buildN.push({
        //     ...txnO,
        //     payment: 1e5 + 0,
        //     note: new TextEncoder().encode("lending sync_user_market_for_price_change"),
        //   });
        // }
        // repay tp lending pool
        {
          const txnO = (
            await builder.lending.repay(Number(marketId), repayArc200Units)
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
      const clients = await algorandService.initializeClientsForReads(
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
          poolId: t.poolId,
          underlyingContractId: t.underlyingContractId,
          originalContractId: t.originalContractId,
        }))
      );
      console.log("Looking for marketId:", marketId, "poolId:", poolId);

      const token = resolveDisplayTokenForPoolMarket(networkId, poolId, marketId);

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

      // Repay is allowed even when market is paused (users should be able to repay debt)

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
        } else if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
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


/**
 * Repay borrowed tokens to a lending market
 */
export const repayAll = async (
  poolId: string,
  marketId: string,
  tokenStandard: TokenStandard,
  amount: string,
  userAddress: string,
  networkId: NetworkId,
  options?: { repayAdapterId?: string }
): Promise<
  | { success: boolean; txId?: string; error?: string }
  | { success: true; txns: string[] }
> => {
  console.log("repayAll", {
    poolId,
    marketId,
    amount,
    userAddress,
    networkId,
    repayAdapterId: options?.repayAdapterId,
  });

  try {
    const networkConfig = getNetworkConfig(networkId);

    if (isAlgorandCompatibleNetwork(networkId)) {
      console.log({ networkConfig });
      const clients = await algorandService.initializeClientsForReads(
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
      console.log("Looking for marketId:", marketId, "poolId:", poolId);

      const token = resolveDisplayTokenForPoolMarket(networkId, poolId, marketId);

      console.log("Token found:", token);

      if (!token) {
        console.error("Token not found for marketId:", marketId);
        console.error(
          "Available underlyingContractIds:",
          allTokens.map((t) => t.underlyingContractId)
        );
        throw new Error("Token not found");
      }

      const tokenConfigForRepay = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );

      const repayPhaseAdapters = tokenConfigForRepay
        ? getTokenAdaptersForPhase(tokenConfigForRepay, "repay")
        : [];
      const folksForRepay = resolveRepayFolksAdapter(
        tokenConfigForRepay ?? {},
        options?.repayAdapterId
      );

      if (
        tokenStandardIsFolksAsaBridge(tokenStandard) &&
        repayPhaseAdapters.length > 0 &&
        !folksForRepay
      ) {
        throw new Error(
          "tokenStandard network-asa / asa-asa requires a Folks repay adapter when repay-phase adapters are configured."
        );
      }

      /** ASA index for nt200 `deposit` axfer before repay_all. */
      let nt200RepayAxferXaid =
        token.underlyingAssetId != null &&
          String(token.underlyingAssetId).trim() !== ""
          ? Number(token.underlyingAssetId)
          : NaN;

      // TODO use calculated value based on interest per minute
      const bigAmountSurplus = BigInt(
        new BigNumber(amount)
          .multipliedBy(10 ** token.decimals)
          .multipliedBy(0.01)
          .plus(1)
          .toFixed(0)
      );

      let repayArc200Units = BigInt(
        new BigNumber(amount)
          .multipliedBy(10 ** token.decimals)
          .plus(bigAmountSurplus)
          .toFixed(0)
      );

      let folksMintTxns: algosdk.Transaction[] | null = null;

      const normalizeFolksUnderlyingAssetIdRa = (
        raw: string | undefined | null
      ): string => {
        const s = String(raw ?? "").trim();
        if (s === "" || s === "-") return "0";
        return s;
      };

      if (repayPhaseAdapters.length > 0 && folksForRepay) {
        for (const a of repayPhaseAdapters) {
          if (a.type !== "folks") {
            throw new Error(`Unsupported repay adapter type: ${a.type}`);
          }
        }
        if (networkConfig.networkId !== "algorand-mainnet") {
          throw new Error(
            "Folks repay adapter is only supported on Algorand mainnet"
          );
        }
        const fp = folksForRepay.folksParams;
        if (!tokenConfigForRepay) {
          throw new Error("Token config missing for Folks repayAll");
        }
        const cfgAssetStr = String(tokenConfigForRepay.assetId ?? "").trim();
        const fpFAssetStr = String(fp.fAssetId ?? "").trim();
        const fpUnderlyingNorm = normalizeFolksUnderlyingAssetIdRa(fp.assetId);
        const cfgAsUnderlyingNorm = normalizeFolksUnderlyingAssetIdRa(
          cfgAssetStr !== "" ? cfgAssetStr : undefined
        );
        const fAssetMatchesMarket =
          fpFAssetStr !== "" && cfgAssetStr !== "" && cfgAssetStr === fpFAssetStr;
        const underlyingMatches =
          cfgAsUnderlyingNorm !== "" &&
          cfgAsUnderlyingNorm === fpUnderlyingNorm;
        if (!fAssetMatchesMarket && !underlyingMatches) {
          throw new Error(
            `Folks repay adapter pool does not match this token row (config assetId ${String(tokenConfigForRepay.assetId)} vs pool underlying ${fp.assetId} / fAsset ${fp.fAssetId})`
          );
        }
        if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
          const fAsa = Number(fp.fAssetId);
          if (!Number.isFinite(fAsa) || fAsa <= 0) {
            throw new Error(
              "Folks repay adapter (ASA): invalid folksParams.fAssetId for nt200 axfer"
            );
          }
          nt200RepayAxferXaid = fAsa;
        }
        const skipFolksMint =
          folksForRepay.repayWalletBasis === "market_token";
        if (!skipFolksMint) {
          const underlyingAtomic = BigInt(
            new BigNumber(amount).multipliedBy(10 ** token.decimals).toFixed(0)
          );
          if (underlyingAtomic <= BigInt(0)) {
            throw new Error("Repay amount must be positive");
          }
          folksMintTxns = await buildFolksDepositMintTxns({
            poolName: fp.pool,
            userAddress,
            amount: underlyingAtomic,
            algod: clients.algod,
          });
          const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
            poolName: fp.pool,
            underlyingAmount: underlyingAtomic,
            algod: clients.algod,
          });
          const surplusF = (mintedFAsset * 1n) / 100n + 1n;
          repayArc200Units = mintedFAsset + surplusF;
        }
      }

      const symbol = token.symbol;

      // Repay is allowed even when market is paused (users should be able to repay debt)

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

      console.log("repayAll parameters:", {
        poolId: Number(poolId),
        marketId: Number(marketId),
        amount: repayArc200Units,
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

        if (folksMintTxns && folksMintTxns.length > 0) {
          buildN.push(...folksMintTxnsToArccjsExtraTxns(folksMintTxns));
        }

        if (tokenStandard == "network") {
          // create balance box for pool
          // create balance box for user
          if (p1 > 0) {
            const txnO = (await builder.token.createBalanceBox(userAddress))
              .obj;
            const description = "nt200 createBalanceBox";
            buildN.push({
              ...txnO,
              payment: 28500,
              note: new TextEncoder().encode(description),
              description
            });
          }
          // user withdraws from nt200 token
          {
            const txnO = (await builder.token.deposit(repayArc200Units)).obj;
            const description = "nt200 deposit";
            buildN.push({
              ...txnO,
              note: new TextEncoder().encode(description),
              description,
              payment: repayArc200Units,
            });
          }
        } else if (tokenStandardUsesAsaStyleNt200Txns(tokenStandard)) {
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
            const description = `nt200 createBalanceBox arc200 ${symbol} token for ${userAddress}`;
            buildN.push({
              ...txnO,
              payment: 28501,
              note: new TextEncoder().encode(
                description
              ),
              description,
            });
          }
          // deposit to arc200
          {
            const txnO = (await builder.token.deposit(repayArc200Units)).obj;
            const axfer = {
              aamt: repayArc200Units,
              xaid: nt200RepayAxferXaid,
            };
            const description = `nt200 deposit ${symbol} token for user (${userAddress})`;
            buildN.push({
              ...txnO,
              ...axfer,
              note: new TextEncoder().encode(
                description
              ),
              description,
            });
          }
        } else if (tokenStandard == "arc200-exchange") {
          const axfer = {
            aamt: repayArc200Units,
            xaid: Number(token.underlyingAssetId),
          };
          const txnO = (
            await builder.arc200Exchange.arc200_redeem(repayArc200Units)
          ).obj;
          const description = "arc200_redeem";
          buildN.push({
            ...txnO,
            ...axfer,
            note: new TextEncoder().encode(description),
            description,
          });
        }
        // all payment to pool are arc200 payments trough approval
        // approve spending of token (non stoken only)
        // TODO check if this is needed
        {
          const addr = algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          );
          const txnO = (
            await builder.token.arc200_approve(addr, repayArc200Units)
          ).obj;
          const description = `arc200 approve ${symbol} token spending to pool (${addr}) for user (${userAddress})`;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode(
              description
            ),
            payment: p2 > 0 ? 28502 : 0,
            description,
          });
        }
        // repay tp lending pool
        {
          const txnO = (
            await builder.lending.repay_all(Number(marketId))
          ).obj as any;
          const description = "lending repay_all";
          buildN.push({
            ...txnO,
            payment: 1e5,
            note: new TextEncoder().encode(description),
            description,
          });
        }
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);
        ci.setFee(1e5);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839); // TODO move this to ulujs
        }
        customR = await ci.custom();
        console.log("repayAll customR", { customR, buildN });
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
      console.log("Looking for marketId:", marketId, "poolId:", poolId);

      const token = resolveDisplayTokenForPoolMarket(
        networkId,
        poolId,
        marketId
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

      const originalTokenConfig = resolveTokenConfigFromDisplayToken(
        networkId,
        token
      );
      if (!originalTokenConfig) {
        throw new Error(
          `Token config not found for ${tokenConfigLookupKeyFromDisplayToken(token)}`
        );
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

export const liquidateCrossMarket = async (
  poolId: string,
  debtToken: TokenConfig,
  collateralToken: TokenConfig,
  debtAmount: string,
  minCollateralAmount: string,
  userAddress: string,
  liquidatorAddress: string,
  networkId: NetworkId,
  clients: any,
  signTransactions: any
) => {
  console.log("liquidateCrossMarket", { poolId, debtToken, collateralToken, debtAmount, minCollateralAmount, userAddress, networkId });

  try {
    const networkConfig = getNetworkConfig(networkId);
    if (isAlgorandCompatibleNetwork(networkId)) {
      const clients = await algorandService.initializeClientsForReads(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const builder = {
        lending: new CONTRACT(
          Number(poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          { addr: liquidatorAddress, sk: new Uint8Array() },
          true,
          false,
          true
        ),
        debtToken: new CONTRACT(
          Number(debtToken.contractId),
          clients.algod,
          undefined,
          abi.nt200,
          { addr: liquidatorAddress, sk: new Uint8Array() },
          true,
          false,
          true
        ),
        collateralToken: new CONTRACT(
          Number(collateralToken.contractId),
          clients.algod,
          undefined,
          abi.nt200,
          { addr: liquidatorAddress, sk: new Uint8Array() },
          true,
          false,
          true
        ),
        debtArc200Exchange: new CONTRACT(
          Number(debtToken.contractId),
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
            addr: liquidatorAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      const buildN = [];

      const debtAmountBi = BigInt(new BigNumber(debtAmount).multipliedBy(10 ** debtToken.decimals).toFixed(0))

      console.log({
        debtToken,
        debtAmountBi,
        collateralToken,
      })
      // TODO handle deposit for network
      // TODO handle deposit for asa
      // cond deposit if arc200-exchange 
      if (debtToken.tokenStandard === "arc200-exchange") {
        {
          const txnO = (
            await builder.debtArc200Exchange.arc200_redeem(debtAmountBi)
          ).obj;
          const axfer = {
            aamt: debtAmountBi,
            xaid: Number(debtToken.assetId),
          };
          const description = `arc200_redeem ${debtToken.symbol} ${debtAmount}`;
          const note = new TextEncoder().encode(
            description
          );
          buildN.push({ ...txnO, ...axfer, note, description });
        }
      }

      // arc200 approve
      {
        const txnO = (
          await builder.debtToken.arc200_approve(
            algosdk.getApplicationAddress(Number(poolId)),
            debtAmountBi
          )
        ).obj;
        const note = new TextEncoder().encode(
          `arc200_approve ${debtToken.symbol} ${debtAmount}
          } spending to ${algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          )}`
        );
        buildN.push({ ...txnO, note });
      }

      // Liquidate cross market
      // @arc4.abimethod
      // def liquidate_cross_market(
      //     self,
      //     debt_market_id: arc4.UInt64,
      //     collateral_market_id: arc4.UInt64,
      //     user: arc4.Address,
      //     debt_amount: arc4.UInt256,
      //     min_collateral_received: arc4.UInt256,
      // ) -> arc4.UInt256:
      {
        const minCollateralReceived = 0; // TODO calc min collateral received
        const txnO = (
          await builder.lending.liquidate_cross_market(
            Number(debtToken.contractId),
            Number(collateralToken.contractId),
            userAddress,
            debtAmountBi,
            minCollateralReceived,
          )
        ).obj;
        const note = new TextEncoder().encode(
          `liquidate_cross_market ${debtToken.symbol} ${debtAmount}
          to ${collateralToken.symbol}`
        );
        const payment = 2e6;
        buildN.push({ ...txnO, note, payment, description: "liquidate_cross_market" });
      }

      console.log("buildN", buildN);

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        abi.custom,
        { addr: liquidatorAddress, sk: new Uint8Array() }
      );

      ci.setFee(1e5);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);

      if (networkId === "algorand-mainnet") {
        ci.setBeaconId(3209233839);
      }

      const customR = await ci.custom();

      console.log("liquidateCrossMarket customR", { customR });

      if (!customR.success) {
        throw new Error("Failed to create liquidate cross market transaction");
      }

      return {
        success: true,
        txns: customR.txns,
      };

    }
  } catch (error) {
    console.error("Liquidate cross market error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Liquidate cross market failed" };
  }
};