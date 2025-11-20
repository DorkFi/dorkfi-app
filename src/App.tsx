import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Admin from "./pages/Admin";
import GasStation from "./pages/GasStation";
import LiquidationMarkets from "./pages/LiquidationMarkets";
import { NetworkProvider } from "./contexts/NetworkContext";
import Index from "./pages/Index";
import { isFeatureEnabled } from "./config";
import CountdownPage from "./pages/Countdown";
import MarketsTable from "./components/MarketsTable";
import Dashboard from "./components/Dashboard";

//const LAUNCH_TIMESTAMP = Date.UTC(2025, 10, 21, 2, 0, 0); // Nov 20, 2025 6:00 PM PST (Nov 21, 2025 2:00 AM UTC)
const LAUNCH_TIMESTAMP = Date.now();

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
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <NetworkProvider>
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
              <Route path="/admin" element={<Admin />} />
              {isFeatureEnabled("enableGasStation") && (
                <Route path="/gas-station" element={<GasStation />} />
              )}
              {/*<Route path="/countdown" element={<CountdownPage />} />*/}
              {isFeatureEnabled("enableLiquidations") && (
                <Route
                  path="/liquidation-markets"
                  element={
                    <LiquidationMarkets
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  }
                />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
}

export default App;
