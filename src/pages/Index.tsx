import { useLocation } from "react-router-dom";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Dashboard from "@/components/Dashboard";
import MarketsTable from "@/components/MarketsTable";
import Portfolio from "@/components/Portfolio";
import SwapWidget from "@/components/SwapWidget";
import SwapHeroSection from "@/components/SwapHeroSection";
import CandlestickChart from "@/components/CandlestickChart";
import CanvasBubbles from "@/components/CanvasBubbles";
import PreFi from "@/pages/PreFi";
import { useIsMobile } from "@/hooks/use-mobile";
import LiquidationMonitor from "@/components/liquidation/LiquidationMonitor";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  address: string;
  decimals: number;
  balance?: number;
}

interface IndexProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const Index = ({ activeTab, onTabChange }: IndexProps) => {
  const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(
    null
  );
  const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(
    undefined
  );
  const location = useLocation();
  const isMobile = useIsMobile();

  console.log(
    "Index render - activeTab:",
    activeTab,
    "location:",
    location.pathname
  );

  const handleTokenChange = (
    fromToken: Token | null,
    toToken: Token | null
  ) => {
    setSelectedFromToken(fromToken);
    setSelectedToToken(toToken);
  };

  const handleChartPriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  const renderTabContent = () => {
    console.log("Rendering content for tab:", activeTab);
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onTabChange={onTabChange} />;
      case "markets":
        return <MarketsTable />;
      case "portfolio":
        return <Portfolio />;
      case "liquidations":
        return <LiquidationMonitor accounts={[]} />;
      case "swap":
        return (
          <>
            <SwapHeroSection />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 w-full">
              <div className="md:col-span-7 order-1 md:order-none">
                <CandlestickChart
                  fromToken={selectedFromToken?.symbol || null}
                  toToken={selectedToToken?.symbol || null}
                  onPriceClick={handleChartPriceClick}
                />
              </div>
              <div className="md:col-span-5 mx-auto md:mx-0 order-2 md:order-none">
                <SwapWidget
                  onTokenChange={handleTokenChange}
                  selectedPrice={selectedPrice}
                />
              </div>
            </div>
          </>
        );
      case "prefi":
        return <PreFi />;
      default:
        return <Dashboard onTabChange={onTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />

      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      {/* Advanced Canvas Bubble System - Dark Mode Only */}
      <div className="hidden dark:block">
        <CanvasBubbles />
      </div>

      <Header activeTab={activeTab} onTabChange={onTabChange} />

      <main className="max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 py-4 md:py-8 relative z-10">
        <div className="space-y-4 sm:space-y-6">{renderTabContent()}</div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
