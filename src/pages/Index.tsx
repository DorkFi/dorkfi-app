import { useLocation } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwapHeroSection from "@/components/SwapHeroSection";
import { useIsMobile } from "@/hooks/use-mobile";
import { isFeatureEnabled } from "@/config";
import { cn } from "@/lib/utils";
import { LazyRouteFallback } from "@/components/LazySuspenseFallback";

const MarketsTable = lazy(() => import("@/components/MarketsTable"));
const Dashboard = lazy(() => import("@/components/Dashboard"));
const Portfolio = lazy(() => import("@/components/Portfolio"));
const SwapWidget = lazy(() => import("@/components/SwapWidget"));
const CandlestickChart = lazy(() => import("@/components/CandlestickChart"));
const PreFi = lazy(() => import("@/pages/PreFi"));
const LiquidationMonitor = lazy(
  () => import("@/components/liquidation/LiquidationMonitor")
);

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
  const isMarketsTab = activeTab === "markets";

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
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <Dashboard onTabChange={onTabChange} />
          </Suspense>
        );
      case "markets":
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <MarketsTable />
          </Suspense>
        );
      case "portfolio":
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <Portfolio />
          </Suspense>
        );
      case "liquidations":
        if (isFeatureEnabled("enableLiquidations")) {
          return (
            <Suspense fallback={<LazyRouteFallback />}>
              <LiquidationMonitor accounts={[]} />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <Dashboard onTabChange={onTabChange} />
          </Suspense>
        );
      case "swap":
        return (
          <Suspense fallback={<LazyRouteFallback />}>
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
          </Suspense>
        );
      case "prefi":
        if (isFeatureEnabled("enablePreFi")) {
          return (
            <Suspense fallback={<LazyRouteFallback />}>
              <PreFi />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <Dashboard onTabChange={onTabChange} />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<LazyRouteFallback />}>
            <Dashboard onTabChange={onTabChange} />
          </Suspense>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />

      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header activeTab={activeTab} onTabChange={onTabChange} />

      <main
        className={cn(
          "max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 relative z-10",
          isMarketsTab ? "pt-2 pb-4 md:pt-3 md:pb-6" : "py-4 md:py-8"
        )}
      >
        <div
          className={cn(
            isMarketsTab ? "space-y-2 sm:space-y-3" : "space-y-4 sm:space-y-6"
          )}
        >
          {renderTabContent()}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
