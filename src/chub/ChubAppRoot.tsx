import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { LocaleSettingsProvider } from "@/contexts/LocaleSettingsContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type ChubAppRootProps = {
  children: ReactNode;
};

/**
 * Shared provider stack for Chub (and similar thin UIs).
 * Lives in @dorkfi/app so wallet/network/query deps resolve here.
 */
export function ChubAppRoot({ children }: ChubAppRootProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="simplfi-theme"
        disableTransitionOnChange
      >
        <NetworkProvider>
          <LocaleSettingsProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={100}>
              <Toaster />
              <Sonner />
              {children}
            </TooltipProvider>
          </LocaleSettingsProvider>
        </NetworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Optional helper if a thin app wants tab state without re-implementing it. */
export function useChubTabState(initial = "savings") {
  return useState(initial);
}
