import { useQuery } from "@tanstack/react-query";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { base } from "viem/chains";
import {
  ArrowRightLeft,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useEasyStartModals } from "@/contexts/EasyStartModalsContext";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { cn } from "@/lib/utils";

/** Circle USDC on Base mainnet (MoonPay / Privy fundWallet destination). */
export const BASE_MAINNET_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const erc20BalanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
});

async function fetchBaseUsdcBalance(address: Address): Promise<{
  formatted: string;
  value: bigint;
}> {
  const [raw, decimals] = await Promise.all([
    basePublicClient.readContract({
      address: BASE_MAINNET_USDC,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf",
      args: [address],
    }),
    basePublicClient.readContract({
      address: BASE_MAINNET_USDC,
      abi: erc20BalanceOfAbi,
      functionName: "decimals",
    }),
  ]);
  return {
    value: raw,
    formatted: formatUnits(raw, decimals),
  };
}

/** Base USDC balance + fund/bridge CTAs for Privy Easy Start on Portfolio. */
export function EasyStartFundingStrip() {
  const privy = usePrivyEasyStart();
  const { openDeposit, openBridge } = useEasyStartModals();
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
            Easy Start · staging funds
          </p>
          <p className="text-sm text-muted-foreground">
            MoonPay deposits land as USDC on{" "}
            <span className="font-medium text-foreground">Base</span>. Bridge to
            Algorand before supplying on DorkFi.
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
                on Base
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openDeposit}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Add USDC
            </Button>
            <Button
              type="button"
              className="bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              onClick={openBridge}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              {hasBalance ? "Move to Algorand" : "Open bridge"}
            </Button>
          </div>
        </div>
      </div>
    </DorkFiCard>
  );
}
