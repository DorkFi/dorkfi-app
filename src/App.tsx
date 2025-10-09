import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PreFi from "./pages/PreFi";
import Admin from "./pages/Admin";
import GasStation from "./pages/GasStation";
import { NetworkProvider } from "./contexts/NetworkContext";
//import CountdownPage from "./pages/Countdown";
import AuthGuard from "./components/AuthGuard";

const LAUNCH_TIMESTAMP = Date.UTC(2025, 8, 13, 0, 29, 0); // Sep 12, 2025 5:29 PM PDT

// function ConditionalHomePage() {
//   const now = Date.now();
//   const isBeforeLaunch = now < LAUNCH_TIMESTAMP;

//   return isBeforeLaunch ? <CountdownPage /> : <PreFi />;
// }

function App() {
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
              <Route path="/" element={<PreFi />} />
              {/*<Route 
                path="/prefi" 
                element={
                  <AuthGuard>
                    <PreFi />
                  </AuthGuard>
                } 
              />*/}
              <Route 
                path="/admin" 
                element={
                  <AuthGuard>
                    <Admin />
                  </AuthGuard>
                } 
              />
              <Route path="/gas-station" element={<GasStation />} />
              {/*<Route path="/countdown" element={<CountdownPage />} />*/}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
}

export default App;
