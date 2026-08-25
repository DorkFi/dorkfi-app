import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { EasyStartModalsProvider } from "@/contexts/EasyStartModalsContext";
import { LocaleSettingsProvider } from "@/contexts/LocaleSettingsContext";
import { ProductFlavorProvider } from "@/contexts/ProductFlavorContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import {
  DEFAULT_PRIVY_EASY_START_STATE,
  PrivyEasyStartContext,
} from "@/contexts/privyEasyStartContext";
import { isFeatureEnabled } from "@/config";
import { getPrivyAppId, resolvePrivyOnboardingEnabled } from "@/utils/privyOrigin";

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

type PrivyGate = ComponentType<{ children: ReactNode }>;

/**
 * Shared provider stack for SimplFi (and similar thin UIs).
 * Lives in @dorkfi/app so wallet/network/query deps resolve here.
 * Mirrors main DorkFi ordering so Easy Start + XO USDC bridge modals work.
 *
 * Privy is loaded after first paint — a static import of @privy-io/react-auth
 * kept #root on "Loading SimplFi…".
 */
export function SimplFiAppRoot({ children }: SimplFiAppRootProps) {
  const [PrivyGate, setPrivyGate] = useState<PrivyGate | null>(null);

  const bootPrivyValue = useMemo(() => {
    const enabled = resolvePrivyOnboardingEnabled(
      isFeatureEnabled("enablePrivyOnboarding")
    );
    const configured = getPrivyAppId().length > 0;
    return {
      ...DEFAULT_PRIVY_EASY_START_STATE,
      enabled,
      configured,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("@/contexts/PrivySessionProvider").then((mod) => {
      if (!cancelled) setPrivyGate(() => mod.PrivySessionProvider);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const inner = (
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
  );

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
          {PrivyGate ? (
            <PrivyGate>{inner}</PrivyGate>
          ) : (
            <PrivyEasyStartContext.Provider value={bootPrivyValue}>
              {inner}
            </PrivyEasyStartContext.Provider>
          )}
        </ProductFlavorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Optional helper if a thin app wants tab state without re-implementing it. */
export function useSimplFiTabState(initial = "savings") {
  return useState(initial);
}
