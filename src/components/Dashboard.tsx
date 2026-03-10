import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import NFTMintModal from "./NFTMintModal";
import DashboardHero from "./DashboardHero";
import PortfolioStatsGrid from "./PortfolioStatsGrid";
import MarketOverviewCard from "./MarketOverviewCard";
import UserHealthChart from "./UserHealthChart";
import { useUserAssets, type UserAsset } from "@/hooks/useUserAssets";
import {
  fetchUserGlobalData,
  fetchAllMarkets,
  type MarketInfo,
} from "@/services/lendingService";
import { CONTRACT } from "ulujs";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import algorandService from "@/services/algorandService";
import { getNetworkConfig } from "@/config";
import algosdk from "algosdk";

interface DashboardProps {
  onTabChange?: (value: string) => void;
}

const Dashboard = ({ onTabChange }: DashboardProps) => {
  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  // Real user data state
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [marketData, setMarketData] = useState<MarketInfo[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Use the useUserAssets hook for detailed asset data
  const userAssets = useUserAssets(activeAccount?.address || "");

  // Calculate net APY from user assets
  const calculateNetAPY = (assets: UserAsset[]) => {
    if (!assets || assets.length === 0) return 0;

    let totalDepositValue = 0;
    let totalBorrowValue = 0;
    let weightedDepositAPY = 0;
    let weightedBorrowAPY = 0;

    assets.forEach((asset) => {
      totalDepositValue += asset.depositValueUSD || 0;
      totalBorrowValue += asset.borrowValueUSD || 0;

      if (asset.depositValueUSD > 0 && asset.apy) {
        weightedDepositAPY += asset.depositValueUSD * asset.apy;
      }

      if (asset.borrowValueUSD > 0 && asset.borrowApy) {
        weightedBorrowAPY += asset.borrowValueUSD * asset.borrowApy;
      }
    });

    if (totalDepositValue === 0 && totalBorrowValue === 0) return 0;

    const avgDepositAPY =
      totalDepositValue > 0 ? weightedDepositAPY / totalDepositValue : 0;
    const avgBorrowAPY =
      totalBorrowValue > 0 ? weightedBorrowAPY / totalBorrowValue : 0;

    // Net APY = (deposit APY * deposit value - borrow APY * borrow value) / net worth
    const netWorth = totalDepositValue - totalBorrowValue;
    if (netWorth <= 0) return 0;

    return (
      (avgDepositAPY * totalDepositValue - avgBorrowAPY * totalBorrowValue) /
      netWorth
    );
  };

  // Calculate derived stats from real data
  const userStats = {
    totalDeposits: userGlobalData?.totalCollateralValue || 0,
    totalBorrows: userGlobalData?.totalBorrowValue || 0,
    healthFactor:
      userGlobalData?.totalBorrowValue > 0
        ? userGlobalData.totalCollateralValue / userGlobalData.totalBorrowValue
        : 0,
    netWorth:
      (userGlobalData?.totalCollateralValue || 0) -
      (userGlobalData?.totalBorrowValue || 0),
    netAPY: calculateNetAPY(userAssets.assets),
  };

  // Calculate market stats from real market data
  const marketStats = {
    totalValueLocked: marketData.reduce((sum, market) => {
      const deposits = parseFloat(market.totalDeposits || "0");
      const price = parseFloat(market.price || "0");
      // Convert price from scaled format (divide by 10^6 as done in PreFi)
      const scaledPrice = price / Math.pow(10, 6);
      return sum + deposits * scaledPrice;
    }, 0),
    totalBorrowed: marketData.reduce((sum, market) => {
      const borrows = parseFloat(market.totalBorrows || "0");
      const price = parseFloat(market.price || "0");
      // Convert price from scaled format (divide by 10^6 as done in PreFi)
      const scaledPrice = price / Math.pow(10, 6);
      return sum + borrows * scaledPrice;
    }, 0),
    availableLiquidity: marketData.reduce((sum, market) => {
      const deposits = parseFloat(market.totalDeposits || "0");
      const borrows = parseFloat(market.totalBorrows || "0");
      const price = parseFloat(market.price || "0");
      // Convert price from scaled format (divide by 10^6 as done in PreFi)
      const scaledPrice = price / Math.pow(10, 6);
      return sum + (deposits - borrows) * scaledPrice;
    }, 0),
    activeUsers: activeUsersCount,
  };

  const [nftMintModalOpen, setNFTMintModalOpen] = useState(false);
  // In real app, these would be from user/session
  const mintedSupply = 1274;

  // Function to fetch unique active users from blockchain events
  const fetchActiveUsersCount = useCallback(async () => {
    try {
      const networkConfig = getNetworkConfig(currentNetwork);

      if (!networkConfig) {
        console.warn("No network config found");
        return 0;
      }

      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as string
      );

      // Get the first lending pool contract
      const poolId = networkConfig.contracts.lendingPools[0];

      console.log("🔍 Debug - Using network:", currentNetwork);
      console.log("🔍 Debug - Network config:", networkConfig);
      console.log("🔍 Debug - Pool ID:", poolId);
      console.log("🔍 Debug - Clients:", clients);

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        clients.indexer,
        {
          ...LendingPoolAppSpec.contract,
          events: [
            {
              name: "UserHealth",
              args: [
                {
                  type: "address",
                  name: "user_id",
                },
                {
                  type: "uint256",
                  name: "health_factor",
                },
                {
                  type: "uint256",
                  name: "total_collateral_value",
                },
                {
                  type: "uint256",
                  name: "total_borrow_value",
                },
              ],
            },
          ],
        },
        {
          addr: algosdk.getApplicationAddress(Number(poolId)),
          sk: new Uint8Array(),
        }
      );

      // Get the latest round to fetch recent events
      const status = await clients.algod.status().do();
      const lastRound = status["last-round"];

      // Decode UserHealth events exactly like LiquidationMarkets
      interface UserHealthEventRecord {
        timestamp: number;
        round: number;
        user_id: string;
        total_collateral_value: number;
        total_borrow_value: number;
      }
      const decodeHealthFactor = (event: unknown[]): UserHealthEventRecord => ({
        timestamp: Number(event[2]),
        round: Number(event[1]),
        user_id: String(event[3]),
        total_collateral_value: Number(event[5]),
        total_borrow_value: Number(event[6]),
      });

      type EventGroup = { name: string; events?: unknown[] };
      // Fetch events from the last 2M rounds (similar to LiquidationMarkets)
      const events = (await ci.getEvents({
        minRound: Math.max(0, lastRound - 2e6),
      })) as EventGroup[];

      console.log("🔍 Debug - All events fetched:", events);
      console.log(
        "🔍 Debug - Event names:",
        events.map((e) => e.name)
      );
      console.log("🔍 Debug - Last round:", lastRound);
      console.log("🔍 Debug - Min round:", Math.max(0, lastRound - 2e6));

      const allUserHealthEvents =
        events
          .find((event) => event.name === "UserHealth")
          ?.events?.map((e) => decodeHealthFactor(e as unknown[])) ?? [];

      console.log(
        "🔍 Debug - UserHealth events found:",
        allUserHealthEvents.length
      );
      console.log(
        "🔍 Debug - Raw UserHealth events:",
        events.find((e) => e.name === "UserHealth")
      );

      // Reduce to latest health factor by userId (same logic as LiquidationMarkets)
      const userHealthEvents = allUserHealthEvents.reduce((latest, current) => {
        const existing = latest.get(current.user_id);
        if (!existing || current.timestamp > existing.timestamp) {
          latest.set(current.user_id, current);
        }
        return latest;
      }, new Map<string, UserHealthEventRecord>());

      const uniqueUsersCount = userHealthEvents.size;
      console.log(`🔍 Debug - Found ${uniqueUsersCount} unique active users`);
      console.log("🔍 Debug - User IDs:", Array.from(userHealthEvents.keys()));

      // If no UserHealth events found, try alternative approach
      if (uniqueUsersCount === 0) {
        console.log(
          "🔍 Debug - No UserHealth events found, trying alternative approach..."
        );

        // Try to get all events and look for any user-related events
        const allEvents = events.flatMap(
          (eventGroup) => eventGroup.events || []
        );
        console.log("🔍 Debug - Total events found:", allEvents.length);

        // Look for any events that might contain user IDs
        const userEvents = allEvents.filter(
          (event: unknown): event is unknown[] =>
            Array.isArray(event) &&
            event.length > 0 &&
            typeof event[0] === "string" &&
            (event[0] as string).length > 20
        );
        console.log("🔍 Debug - Potential user events:", userEvents.length);

        if (userEvents.length > 0) {
          const uniqueUsers = new Set(userEvents.map((event) => event[0] as string));
          console.log(
            `🔍 Debug - Alternative method found ${uniqueUsers.size} unique users`
          );
          return uniqueUsers.size;
        }

        // Try fetching from a smaller range (last 100k rounds)
        console.log("🔍 Debug - Trying smaller range (last 100k rounds)...");
        try {
          const recentEvents = (await ci.getEvents({
            minRound: Math.max(0, lastRound - 100000),
          })) as EventGroup[];

          console.log("🔍 Debug - Recent events:", recentEvents);
          const recentUserHealthEvents =
            recentEvents
              .find((event) => event.name === "UserHealth")
              ?.events?.map((e) => decodeHealthFactor(e as unknown[])) ?? [];

          if (recentUserHealthEvents.length > 0) {
            const recentUserHealthMap = recentUserHealthEvents.reduce(
              (latest, current) => {
                const existing = latest.get(current.user_id);
                if (!existing || current.timestamp > existing.timestamp) {
                  latest.set(current.user_id, current);
                }
                return latest;
              },
              new Map<string, UserHealthEventRecord>()
            );

            console.log(
              `🔍 Debug - Recent events found ${recentUserHealthMap.size} unique users`
            );
            return recentUserHealthMap.size;
          }
        } catch (error) {
          console.error("🔍 Debug - Error fetching recent events:", error);
        }
      }

      return uniqueUsersCount;
    } catch (error) {
      console.error("Error fetching active users count:", error);
      return 0;
    }
  }, [currentNetwork]);

  // Fetch user global data and market data when wallet connects
  useEffect(() => {
    const fetchData = async () => {
      if (!activeAccount?.address || !currentNetwork) {
        setUserGlobalData(null);
        setMarketData([]);
        setActiveUsersCount(0);
        return;
      }

      setIsLoadingData(true);
      setDataError(null);

      try {
        console.log(
          "Fetching dashboard data for:",
          activeAccount.address,
          "on network:",
          currentNetwork
        );

        // Fetch global data, markets, and active users count
        const [globalData, markets, usersCount] = await Promise.all([
          fetchUserGlobalData(activeAccount.address, currentNetwork),
          fetchAllMarkets(currentNetwork),
          fetchActiveUsersCount(),
        ]);

        if (globalData) {
          console.log("User global data fetched:", globalData);
          setUserGlobalData(globalData);
        } else {
          console.log("No user global data found");
          setUserGlobalData(null);
        }

        if (markets) {
          console.log("Market data fetched:", markets);
          setMarketData(markets);
        } else {
          console.log("No market data found");
          setMarketData([]);
        }

        console.log("Active users count fetched:", usersCount);
        setActiveUsersCount(usersCount);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setDataError(
          error instanceof Error ? error.message : "Failed to fetch data"
        );
        setUserGlobalData(null);
        setMarketData([]);
        setActiveUsersCount(0);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [activeAccount?.address, currentNetwork, fetchActiveUsersCount]);

  // Mock mint handler
  const handleMint = () => {
    if (!activeAccount?.address) {
      // Open wallet connection modal or redirect to wallet connection
      console.log("Wallet not connected, please connect wallet first");
      return;
    } else {
      // Redirect to mint page (internal route)
      window.location.href = "/mint";
    }
  };

  // Mock learn more handler
  const handleLearnMore = () => {
    window.open("https://docs.dorkfi.app/nft", "_blank");
  };

  // Handler for Explore Markets button
  const handleExploreMarkets = () => {
    if (onTabChange) {
      onTabChange("markets");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal for NFT mint */}
      <NFTMintModal
        open={nftMintModalOpen}
        onOpenChange={setNFTMintModalOpen}
        walletConnected={!!activeAccount?.address}
        mintedSupply={mintedSupply}
        onMint={handleMint}
        onLearnMore={handleLearnMore}
      />
      <DashboardHero
        nftMintModalOpen={nftMintModalOpen}
        setNFTMintModalOpen={setNFTMintModalOpen}
        mockWalletConnected={!!activeAccount?.address}
        mintedSupply={mintedSupply}
        onMint={handleMint}
        onLearnMore={handleLearnMore}
        onExploreMarkets={handleExploreMarkets}
      />

      <PortfolioStatsGrid userStats={userStats} />

      <MarketOverviewCard
        marketStats={marketStats}
        isLoading={isLoadingData}
        error={dataError}
      />
    </div>
  );
};

export default Dashboard;
