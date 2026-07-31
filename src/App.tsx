import { lazy, Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NetworkProvider } from "./contexts/NetworkContext";
import { LocaleSettingsProvider } from "./contexts/LocaleSettingsContext";
import Index from "./pages/Index";
import { isFeatureEnabled } from "./config";
import CountdownPage from "./pages/Countdown";
//const LAUNCH_TIMESTAMP = Date.UTC(2025, 10, 21, 2, 0, 0); // Nov 20, 2025 6:00 PM PST (Nov 21, 2025 2:00 AM UTC)
const LAUNCH_TIMESTAMP = Date.now();

const Admin = lazy(() => import("./pages/Admin"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Governance = lazy(() => import("./pages/Governance"));
const PoolsPage = lazy(() => import("./pages/Pools"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
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
      <NetworkProvider>
        <LocaleSettingsProvider>
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
              <Route
                path="/admin"
                element={
                  <Suspense fallback={null}>
                    <Admin />
                  </Suspense>
                }
              />
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
                  <Suspense fallback={null}>
                    <Analytics
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  </Suspense>
                }
              />
              {isFeatureEnabled("enableGovernance") && (
                <Route
                  path="/governance"
                  element={
                    <Suspense fallback={null}>
                      <Governance />
                    </Suspense>
                  }
                />
              )}
              {isFeatureEnabled("enablePools") && (
                <Route
                  path="/pools"
                  element={
                    <Suspense fallback={null}>
                      <PoolsPage
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                      />
                    </Suspense>
                  }
                />
              )}
              <Route
                path="/portfolio"
                element={
                  <Suspense fallback={null}>
                    <PortfolioPage />
                  </Suspense>
                }
              />
              <Route
                path="/portfolio/:address"
                element={
                  <Suspense fallback={null}>
                    <PortfolioPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </LocaleSettingsProvider>
      </NetworkProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
