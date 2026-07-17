import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowDownToLine,
  ArrowLeftRight,
} from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useEasyStartModals } from "@/contexts/easyStartModals";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { cn } from "@/lib/utils";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";

/** Re-export for callers that imported the constant from this module. */
export { BASE_MAINNET_USDC } from "@/lib/easyStart/baseBalances";

/** Base USDC staging balance + Deposit / Withdraw / Allbridge CTAs for Privy Easy Start. */
export function EasyStartFundingStrip() {
  const privy = usePrivyEasyStart();
  const { openDeposit, openWithdraw, openBridge } = useEasyStartModals();
  const { formatNumber, formatCurrency } = useNumberI18n();

  const evmAddress = privy.evmAddress as Address | null;

  const {
    data: baseUsdc,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: Boolean(evmAddress),
    refetchInterval: 15_000,
  });

  const balanceNum =
    baseUsdc && !isLoading && !isError
      ? Number.parseFloat(baseUsdc.formatted)
      : null;
  const hasBalance =
    balanceNum !== null && !Number.isNaN(balanceNum) && balanceNum > 0;

  if (!privy.authenticated || !evmAddress) return null;

  return (
    <DorkFiCard className="border-ocean-teal/30 bg-ocean-teal/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ocean-teal">
            Easy Start
          </p>
          <p className="text-sm text-muted-foreground">
            {hasBalance
              ? "You have USDC ready to finish depositing to Algorand."
              : "Deposit with a card — we’ll move USDC to Algorand for you."}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
            <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-white">
              {isLoading ? (
                <span className="inline-flex items-center gap-2 text-base font-medium text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </span>
              ) : isError ? (
                <span className="text-base font-medium text-destructive">
                  Couldn’t load balance
                </span>
              ) : (
                <>
                  {formatNumber(balanceNum ?? 0, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  <span className="text-lg font-semibold text-muted-foreground">
                    USDC
                  </span>
                </>
              )}
            </span>
            {balanceNum !== null && !isError ? (
              <span className="text-sm text-muted-foreground">
                ≈{" "}
                {formatCurrency(balanceNum, "USD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                staging
              </span>
            ) : null}
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {evmAddress.slice(0, 8)}…{evmAddress.slice(-6)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            disabled={!evmAddress || isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              className="bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              onClick={openDeposit}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Deposit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openWithdraw}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openBridge}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Bridge with Allbridge
            </Button>
          </div>
        </div>
      </div>
    </DorkFiCard>
  );
}
