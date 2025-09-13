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
  NetworkId,
  getAllTokensWithDisplayInfo,
  getLendingPools,
  getPreFiParameters,
} from "@/config";
import algorandService, { AlgorandNetwork } from "./algorandService";
import { abi, CONTRACT } from "ulujs";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import { TokenStandard } from "@/pages/PreFi";

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
}

export interface UserPosition {
  userId: string;
  marketId: string;
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
    const networkConfig = getCurrentNetworkConfig();

    if (isCurrentNetworkAlgorandCompatible()) {
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

      const token = getAllTokensWithDisplayInfo(networkId).find(
        (token) => token.underlyingContractId === marketId
      );

      console.log("token", { token });

      const marketR = await ci.get_market(Number(marketId));

      console.log("marketR", { marketR });

      if (!marketR.success) {
        throw new Error("Failed to get market info");
      }

      const market = decodeMarket(marketR.returnValue);

      const utilizationRate =
        market.totalScaledDeposits.toString() == "0"
          ? 0
          : new BigNumber(market.totalScaledBorrows.toString())
              .div(market.totalScaledDeposits.toString())
              .toNumber();

      const supplyRate = new BigNumber(market.borrowRate.toString())
        .multipliedBy(utilizationRate)
        .multipliedBy(10000 - Number(market.reserveFactor.toString()))
        .toNumber();

      const formatPrice = (price: string) => {
        return new BigNumber(price).div(new BigNumber(10).pow(18)).toFixed(12);
      };

      const formatDeposit = (deposit: string) => {
        return new BigNumber(deposit)
          .div(new BigNumber(10).pow(token?.decimals || 0))
          .toFixed(0);
      };

      const totalDeposits = formatDeposit(
        market.totalScaledDeposits.toString()
      );
      const totalBorrows = formatDeposit(market.totalScaledBorrows.toString());

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
      };

      console.log("marketInfo", { marketInfo });

      return marketInfo;
    } else if (isCurrentNetworkEVM()) {
      throw new Error("EVM networks are not supported yet");
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

    if (isCurrentNetworkAlgorandCompatible()) {
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        {
          addr: algosdk.getApplicationAddress(
            Number(networkConfig.contracts.lendingPools[0])
          ),
          sk: new Uint8Array(),
        }
      );

      // Get markets from config
      const tokens = getAllTokensWithDisplayInfo(networkId);
      const lendingPools = getLendingPools(networkId);
      const preFiParams = getPreFiParameters(networkId);

      // Create markets from config tokens
      const markets: MarketInfo[] = tokens.map((token, index) => {
        const marketId = token.underlyingContractId || token.symbol; // Use contract ID as market ID
        const poolId = lendingPools[0] || "1"; // Use first lending pool

        // Determine if this is a PreFi market (VOI token)
        const isPreFiMarket = token.symbol === "VOI" || token.symbol === "Voi";

        // Use PreFi parameters if available and this is a PreFi market
        const collateralFactor =
          isPreFiMarket && preFiParams
            ? preFiParams.collateral_factor / 10000 // Convert from basis points
            : 0.75; // Default value

        const liquidationThreshold =
          isPreFiMarket && preFiParams
            ? preFiParams.liquidation_threshold / 10000
            : 0.8;

        const reserveFactor =
          isPreFiMarket && preFiParams
            ? preFiParams.reserve_factor / 10000
            : 0.1;

        const borrowRate =
          isPreFiMarket && preFiParams
            ? preFiParams.borrow_rate_base / 10000
            : 0.05;

        const slope =
          isPreFiMarket && preFiParams ? preFiParams.slope / 10000 : 0.1;

        const liquidationBonus =
          isPreFiMarket && preFiParams
            ? preFiParams.liquidation_bonus / 10000
            : 0.05;

        const closeFactor =
          isPreFiMarket && preFiParams
            ? preFiParams.close_factor / 10000
            : 0.35;

        // Generate realistic mock data for deposits/borrows
        const baseAmount = Math.pow(10, token.decimals) * 1000000; // 1M tokens
        const totalDeposits = Math.floor(
          baseAmount * (0.3 + Math.random() * 0.7)
        ).toString();
        const totalBorrows = isPreFiMarket
          ? "0"
          : Math.floor(baseAmount * (0.1 + Math.random() * 0.4)).toString();

        const utilizationRate = isPreFiMarket
          ? 0
          : parseFloat(totalBorrows) / parseFloat(totalDeposits);
        const supplyRate = utilizationRate * borrowRate * (1 - reserveFactor);
        const borrowRateCurrent = borrowRate + utilizationRate * slope;

        return {
          networkId,
          poolId,
          marketId,
          tokenId: token.underlyingAssetId || token.symbol,
          tokenContractId: token.underlyingContractId || token.symbol,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          collateralFactor,
          liquidationThreshold,
          reserveFactor,
          borrowRate,
          slope,
          maxTotalDeposits: (baseAmount * 10).toString(), // 10M max
          maxTotalBorrows: isPreFiMarket ? "0" : (baseAmount * 8).toString(), // 8M max for non-PreFi
          liquidationBonus,
          closeFactor,
          totalDeposits,
          totalBorrows,
          utilizationRate,
          supplyRate,
          borrowRateCurrent,
          isActive: true,
          isPaused: false,
          lastUpdated: new Date().toISOString(),
        };
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      return markets;
    } else if (isCurrentNetworkEVM()) {
      // For EVM networks, also use config-based markets
      const tokens = getAllTokensWithDisplayInfo(networkId);
      const lendingPools = getLendingPools(networkId);

      const markets: MarketInfo[] = tokens.map((token, index) => {
        const marketId = token.underlyingContractId || token.symbol; // Use contract ID as market ID
        const poolId = lendingPools[0] || "1";

        // Generate realistic mock data for deposits/borrows
        const baseAmount = Math.pow(10, token.decimals) * 1000000; // 1M tokens
        const totalDeposits = Math.floor(
          baseAmount * (0.3 + Math.random() * 0.7)
        ).toString();
        const totalBorrows = Math.floor(
          baseAmount * (0.1 + Math.random() * 0.4)
        ).toString();

        const utilizationRate =
          parseFloat(totalBorrows) / parseFloat(totalDeposits);
        const borrowRate = 0.05;
        const reserveFactor = 0.1;
        const slope = 0.1;
        const supplyRate = utilizationRate * borrowRate * (1 - reserveFactor);
        const borrowRateCurrent = borrowRate + utilizationRate * slope;

        return {
          networkId,
          poolId,
          marketId,
          tokenId: token.underlyingAssetId || token.symbol,
          tokenContractId: token.underlyingContractId || token.symbol,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          collateralFactor: 0.75,
          liquidationThreshold: 0.8,
          reserveFactor,
          borrowRate,
          slope,
          maxTotalDeposits: (baseAmount * 10).toString(),
          maxTotalBorrows: (baseAmount * 8).toString(),
          liquidationBonus: 0.05,
          closeFactor: 0.35,
          totalDeposits,
          totalBorrows,
          utilizationRate,
          supplyRate,
          borrowRateCurrent,
          isActive: true,
          isPaused: false,
          lastUpdated: new Date().toISOString(),
        };
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

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

    if (isCurrentNetworkAlgorandCompatible()) {
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
      };

      let customTx: any;

      for (const p of [[0, 0]]) {
        const [p1, p2] = p;
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
        ci.setFee(4000);
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
        throw new Error("Withdraw transaction failed");
      }

      return {
        success: true,
        txns: customTx.txns,
      };
    } else if (isCurrentNetworkEVM()) {
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

    if (isCurrentNetworkAlgorandCompatible()) {
      console.log({ networkConfig });
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      1;
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
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ]) {
        const [p1, p2] = p;
        const buildN = [];

        // TODO fund ntoken

        // conditionally deposit to token
        if (tokenStandard == "network") {
          if (p1 > 0) {
            const txnO = (
              await builder.token.createBalanceBox(
                algosdk.getApplicationAddress(Number(poolId))
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
              algosdk.getApplicationAddress(Number(poolId)),
              BigInt(amount)
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
          const txnO = (
            await builder.token.arc200_transfer(
              algosdk.getApplicationAddress(Number(poolId)),
              0
            )
          ).obj;
          buildN.push({
            ...txnO,
            payment: 28504,
            note: new TextEncoder().encode("arc200 transfer"),
          });
        }

        // deposit to lending pool
        {
          const depositCost = 900000;
          const txnO = (
            await builder.lending.deposit(Number(marketId), BigInt(amount))
          ).obj as any;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending deposit"),
            payment: depositCost,
          });
        }

        console.log("buildN", { buildN });

        // Create deposit transaction
        ci.setFee(2000);
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
    } else if (isCurrentNetworkEVM()) {
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
