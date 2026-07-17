import { lazy, Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Governance from "./pages/Governance";
import { NetworkProvider } from "./contexts/NetworkContext";
import { PrivySessionProvider } from "./contexts/PrivySessionProvider";
import { EasyStartModalsProvider } from "./contexts/EasyStartModalsContext";
import { LocaleSettingsProvider } from "./contexts/LocaleSettingsContext";
import Index from "./pages/Index";
import { isFeatureEnabled } from "./config";
import CountdownPage from "./pages/Countdown";
import Dashboard from "./components/Dashboard";
import Portfolio from "./components/Portfolio";
import PoolsPage from "./pages/Pools";
import PortfolioPage from "./pages/PortfolioPage";
//const LAUNCH_TIMESTAMP = Date.UTC(2025, 10, 21, 2, 0, 0); // Nov 20, 2025 6:00 PM PST (Nov 21, 2025 2:00 AM UTC)
const LAUNCH_TIMESTAMP = Date.now();

const GasStationPage = lazy(() => import("./pages/GasStation"));
const LiquidationMarketsPage = lazy(() => import("./pages/LiquidationMarkets"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface ConditionalHomePageProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}
function ConditionalHomePage({
  activeTab,
  onTabChange,
}: ConditionalHomePageProps) {
  const now = Date.now();
  const isBeforeLaunch = now < LAUNCH_TIMESTAMP;

  return isBeforeLaunch ? (
    <CountdownPage />
  ) : (
    <Index activeTab={activeTab} onTabChange={onTabChange} />
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("markets");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <PrivySessionProvider>
      <NetworkProvider>
      {/* Locale outside Easy Start modals so deposit/withdraw sheets can use useNumberI18n */}
      <LocaleSettingsProvider>
      <EasyStartModalsProvider>
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <ConditionalHomePage
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                }
              />
              <Route
                path="/market"
                element={
                  <ConditionalHomePage
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                }
              />
              <Route path="/admin" element={<Admin />} />
              {isFeatureEnabled("enableGasStation") && (
                <Route
                  path="/gas-station"
                  element={
                    <Suspense fallback={null}>
                      <GasStationPage />
                    </Suspense>
                  }
                />
              )}
              {/*<Route path="/countdown" element={<CountdownPage />} />*/}
              {isFeatureEnabled("enableLiquidations") && (
                <Route
                  path="/liquidation-markets"
                  element={
                    <Suspense fallback={null}>
                      <LiquidationMarketsPage
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                      />
                    </Suspense>
                  }
                />
              )}
              <Route
                path="/analytics"
                element={
                  <Analytics
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                }
              />
              {isFeatureEnabled("enableGovernance") && (
                <Route
                  path="/governance"
                  element={<Governance />}
                />
              )}
              {isFeatureEnabled("enablePools") && (
                <Route
                  path="/pools"
                  element={
                    <PoolsPage
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  }
                />
              )}
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/portfolio/:address" element={<PortfolioPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </EasyStartModalsProvider>
      </LocaleSettingsProvider>
      </NetworkProvider>
      </PrivySessionProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
