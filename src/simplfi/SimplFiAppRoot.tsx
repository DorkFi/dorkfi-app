import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { PrivySessionProvider } from "@/contexts/PrivySessionProvider";
import { EasyStartModalsProvider } from "@/contexts/EasyStartModalsContext";
import { LocaleSettingsProvider } from "@/contexts/LocaleSettingsContext";
import { ProductFlavorProvider } from "@/contexts/ProductFlavorContext";
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

type SimplFiAppRootProps = {
  children: ReactNode;
};

/**
 * Shared provider stack for SimplFi (and similar thin UIs).
 * Lives in @dorkfi/app so wallet/network/query deps resolve here.
 * Mirrors main DorkFi ordering so Easy Start + XO USDC bridge modals work.
 */
export function SimplFiAppRoot({ children }: SimplFiAppRootProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="simplfi-theme"
        disableTransitionOnChange
      >
        <ProductFlavorProvider consumerCopy>
          <PrivySessionProvider>
            <NetworkProvider>
              <LocaleSettingsProvider>
                <EasyStartModalsProvider>
                  <TooltipProvider delayDuration={300} skipDelayDuration={100}>
                    <Toaster />
                    <Sonner />
                    {children}
                  </TooltipProvider>
                </EasyStartModalsProvider>
              </LocaleSettingsProvider>
            </NetworkProvider>
          </PrivySessionProvider>
        </ProductFlavorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Optional helper if a thin app wants tab state without re-implementing it. */
export function useSimplFiTabState(initial = "savings") {
  return useState(initial);
}
