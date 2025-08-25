
import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import LiquidationMarkets from "./pages/LiquidationMarkets";
import PreFi from "./pages/PreFi";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const location = useLocation();

  // Sync tab state with current route
  useEffect(() => {
    if (location.pathname === '/liquidation-markets') {
      setActiveTab('liquidations');
    } else if (location.pathname === '/prefi') {
      setActiveTab('prefi');
    } else if (location.pathname === '/') {
      // Only set to dashboard if we're not already on a specific tab
      if (activeTab === 'liquidations' || activeTab === 'prefi') {
        setActiveTab('dashboard');
      }
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Index activeTab={activeTab} onTabChange={setActiveTab} />} />
      <Route path="/liquidation-markets" element={<LiquidationMarkets activeTab={activeTab} onTabChange={setActiveTab} />} />
      <Route path="/prefi" element={<PreFi />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
