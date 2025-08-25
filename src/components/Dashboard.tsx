
import React, { useState } from "react";
import NFTMintModal from "./NFTMintModal";
import DashboardHero from "./DashboardHero";
import PortfolioStatsGrid from "./PortfolioStatsGrid";
import MarketOverviewCard from "./MarketOverviewCard";

interface DashboardProps {
  onTabChange?: (value: string) => void;
}

const Dashboard = ({ onTabChange }: DashboardProps) => {
  // Mock data - in real app this would come from smart contract
  const userStats = {
    totalDeposits: 15420.50,
    totalBorrows: 8250.25,
    healthFactor: 2.45,
    netWorth: 7170.25,
    netAPY: 8.45
  };

  const marketStats = {
    totalValueLocked: 2500000,
    totalBorrowed: 1200000,
    availableLiquidity: 1300000,
    activeUsers: 1247
  };

  const [nftMintModalOpen, setNFTMintModalOpen] = useState(false);
  const [mockWalletConnected, setMockWalletConnected] = useState(false);
  // In real app, these would be from user/session
  const mintedSupply = 1274;

  // Mock mint handler
  const handleMint = () => {
    if (!mockWalletConnected) {
      setMockWalletConnected(true);
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
        walletConnected={mockWalletConnected}
        mintedSupply={mintedSupply}
        onMint={handleMint}
        onLearnMore={handleLearnMore}
      />

      <DashboardHero
        nftMintModalOpen={nftMintModalOpen}
        setNFTMintModalOpen={setNFTMintModalOpen}
        mockWalletConnected={mockWalletConnected}
        mintedSupply={mintedSupply}
        onMint={handleMint}
        onLearnMore={handleLearnMore}
        onExploreMarkets={handleExploreMarkets}
      />

      <PortfolioStatsGrid userStats={userStats} />

      <MarketOverviewCard marketStats={marketStats} />
    </div>
  );
};

export default Dashboard;
