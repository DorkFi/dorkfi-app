import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowDownToLine,
  ArrowLeftRight,
  Repeat,
} from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useEasyStartModals } from "@/contexts/easyStartModals";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { cn } from "@/lib/utils";
import {
  fetchAlgorandAlgoTotal,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";
import { useTokenPrice } from "@/hooks/useTokenPrice";

/** Re-export for callers that imported the constant from this module. */
export { BASE_MAINNET_USDC } from "@/lib/easyStart/baseBalances";

/** Algorand ALGO from a bank buy, plus Base USDC, for Privy Easy Start. */
export function EasyStartFundingStrip() {
  const privy = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { openDeposit, openWithdraw, openSwap, openBridge } =
    useEasyStartModals();
  const { formatNumber, formatCurrency } = useNumberI18n();
  const { price: algoUsd } = useTokenPrice("ALGO", "algorand-mainnet");

  const evmAddress = privy.evmAddress as Address | null;
  const algoAddress = privy.algorandAddress;
  const [addressCopied, setAddressCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  const copyAddress = async () => {
    const value = algoAddress ?? evmAddress;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) return;
    }
    setAddressCopied(true);
    if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setAddressCopied(false), 2000);
  };

  const {
    data: baseUsdc,
    isLoading: baseLoading,
    isFetching: baseFetching,
    isError: baseError,
    refetch: refetchBase,
  } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: Boolean(evmAddress),
    refetchInterval: 15_000,
    retry: 2,
  });

  const {
    data: algoTotal,
    isLoading: algoLoading,
    isFetching: algoFetching,
    isError: algoError,
    refetch: refetchAlgo,
  } = useQuery({
    queryKey: ["easy-start-algo-total", algoAddress],
    queryFn: () => fetchAlgorandAlgoTotal(algoAddress!),
    enabled: Boolean(algoAddress),
    refetchInterval: 15_000,
    retry: 2,
  });

  const baseNum =
    baseUsdc && !baseLoading && !baseError
      ? Number.parseFloat(baseUsdc.formatted)
      : null;
  const algoNum =
    algoTotal && !algoLoading && !algoError
      ? Number.parseFloat(algoTotal.formatted)
      : null;
  const hasAlgo = algoNum !== null && !Number.isNaN(algoNum) && algoNum > 0;
  const hasBase =
    baseNum !== null && !Number.isNaN(baseNum) && baseNum > 0.01;
  const algoValue =
    hasAlgo && algoUsd > 0 ? algoNum! * algoUsd : null;
  const isLoading = algoAddress
    ? algoLoading && !algoTotal
    : privy.algorandAddressLoading || baseLoading;
  const isError = algoAddress ? algoError : baseError;
  const isFetching = algoFetching || baseFetching;

  if (!privy.authenticated || !evmAddress) return null;

  return (
    <DorkFiCard className="border-ocean-teal/30 bg-ocean-teal/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ocean-teal">
            Easy Start
          </p>
          <p className="text-sm text-muted-foreground">
            {hasAlgo
              ? "ALGO is in your Algorand account. Swap it to USDC when you want to earn."
              : "A bank deposit buys ALGO into your Algorand account."}
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
                  {formatNumber(algoNum ?? 0, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  <span className="text-lg font-semibold text-muted-foreground">
                    ALGO
                  </span>
                </>
              )}
            </span>
            {algoValue !== null && !isError ? (
              <span className="text-sm text-muted-foreground">
                ≈{" "}
                {formatCurrency(algoValue, "USD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                on Algorand
              </span>
            ) : algoNum !== null && !isError ? (
              <span className="text-sm text-muted-foreground">on Algorand</span>
            ) : null}
          </div>
          {hasBase ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(baseNum ?? 0, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDC on Base
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void copyAddress()}
            className="inline-flex max-w-full items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            aria-label={
              addressCopied
                ? "Address copied"
                : algoAddress
                  ? "Copy Algorand address"
                  : "Copy address"
            }
          >
            <span className="truncate">
              {algoAddress
                ? `${algoAddress.slice(0, 6)}…${algoAddress.slice(-4)}`
                : `${evmAddress.slice(0, 8)}…${evmAddress.slice(-6)}`}
            </span>
            {addressCopied ? (
              <>
                <Check className="h-3 w-3 shrink-0 text-ocean-teal" />
                <span className="font-sans text-[11px] text-ocean-teal">
                  Copied
                </span>
              </>
            ) : (
              <Copy className="h-3 w-3 shrink-0" />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            disabled={!evmAddress || isFetching}
            onClick={() => {
              void refetchAlgo();
              void refetchBase();
            }}
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
              {consumerCopy ? "Add money" : "Deposit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openSwap}
            >
              <Repeat className="mr-2 h-4 w-4" />
              Swap
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openWithdraw}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              {consumerCopy ? "Cash out" : "Withdraw"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-ocean-teal/40"
              onClick={openBridge}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Move USDC
            </Button>
          </div>
        </div>
      </div>
    </DorkFiCard>
  );
}
