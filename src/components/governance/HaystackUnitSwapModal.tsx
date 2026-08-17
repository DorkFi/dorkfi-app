/**
 * Haystack swap modal locked to receiving UNIT (governance token).
 * From-asset is selectable; To is always UNIT.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@txnlab/use-wallet-react";
import { useToast } from "@/hooks/use-toast";
import {
  getTokenConfig,
  type NetworkId,
} from "@/config";
import { Loader2 } from "lucide-react";
import BigNumber from "bignumber.js";
import {
  fetchHaystackQuote,
  type HaystackQuoteResponse,
} from "@/services/haystackRouterService";
import { executeHaystackSwap } from "@/services/haystackSwapExecute";
import {
  listHaystackPaymentAssets,
  resolveHaystackAsaId,
  type HaystackPaymentAssetOption,
} from "@/utils/haystackAsaIds";
import { isRainbowkitXchainWallet } from "@/wallet/xchainSignUi";

export type HaystackUnitSwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  networkId: NetworkId;
  onSwapSuccess?: (txId: string) => void;
};

const MARKETS_MODAL_SHELL =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-hidden flex flex-col p-0 overscroll-contain";

const FIELD_SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-teal/40 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white";

const FIELD_INPUT_CLASS =
  "h-10 border-gray-200 bg-white/90 text-slate-800 shadow-sm focus-visible:ring-ocean-teal/40 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white";

/** Slippage as percent for Haystack execute (1 = 1%). */
const SLIPPAGE_OPTIONS: { label: string; value: number }[] = [
  { label: "0.5%", value: 0.5 },
  { label: "1%", value: 1 },
  { label: "2%", value: 2 },
];

function resolveUnitToken(networkId: NetworkId) {
  const raw = getTokenConfig(networkId, "UNIT");
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return null;
  const asaId = resolveHaystackAsaId(row);
  if (asaId == null) return null;
  return {
    asaId,
    decimals: row.decimals,
    symbol: row.symbol,
    logoPath: row.logoPath,
  };
}

function haystackChainForNetwork(
  networkId: NetworkId
): "mainnet" | "testnet" | null {
  if (networkId === "algorand-mainnet") return "mainnet";
  if (networkId === "algorand-testnet") return "testnet";
  return null;
}

function formatAtomic(amount: number | string | undefined, decimals: number): string {
  try {
    const bn = new BigNumber(amount ?? "0");
    if (!bn.isFinite() || bn.isNegative()) return "—";
    const v = bn.shiftedBy(-decimals);
    if (v.gte(1e9)) return v.toExponential(4);
    return v.decimalPlaces(Math.min(8, decimals), BigNumber.ROUND_DOWN).toFixed();
  } catch {
    return "—";
  }
}

function formatUsd(usd: number | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd >= 0.01) {
    return `$${usd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${usd.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

const HaystackUnitSwapModal: React.FC<HaystackUnitSwapModalProps> = ({
  isOpen,
  onClose,
  networkId,
  onSwapSuccess,
}) => {
  const chain = haystackChainForNetwork(networkId);
  const unit = useMemo(() => resolveUnitToken(networkId), [networkId]);
  const { activeAccount, activeWallet, transactionSigner } = useWallet();
  const { toast } = useToast();

  const fromAssets = useMemo((): HaystackPaymentAssetOption[] => {
    if (!unit) return [];
    return listHaystackPaymentAssets(networkId, unit.asaId);
  }, [networkId, unit]);

  const defaultFromAsaId = useMemo(() => {
    const algo = fromAssets.find((a) => a.asaId === 0);
    const usdc = fromAssets.find((a) => a.asaId === 31_566_704);
    return algo?.asaId ?? usdc?.asaId ?? fromAssets[0]?.asaId ?? 0;
  }, [fromAssets]);

  const [fromAsaId, setFromAsaId] = useState(0);
  const [amountIn, setAmountIn] = useState("");
  const [slippagePercent, setSlippagePercent] = useState(1);
  const [quote, setQuote] = useState<HaystackQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

  const selectedFrom = useMemo(
    () => fromAssets.find((a) => a.asaId === fromAsaId) ?? null,
    [fromAssets, fromAsaId]
  );

  useEffect(() => {
    if (isOpen) {
      setRainbowkitSignDialogSuppressed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !chain || !unit) return;
    setFromAsaId(defaultFromAsaId);
    setAmountIn("");
    setQuote(null);
    setQuoteError(null);
  }, [isOpen, chain, networkId, unit, defaultFromAsaId]);

  const fetchQuote = useCallback(async () => {
    if (!chain || !unit || selectedFrom == null) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    if (fromAsaId === unit.asaId) {
      setQuote(null);
      setQuoteError("Choose a different payment asset.");
      return;
    }
    const trimmed = amountIn.trim();
    if (!trimmed || trimmed === "." || Number(trimmed) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let atomic: bigint;
    try {
      atomic = BigInt(
        new BigNumber(trimmed)
          .times(new BigNumber(10).pow(selectedFrom.decimals))
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
    } catch {
      setQuoteError("Invalid amount.");
      setQuote(null);
      return;
    }
    if (atomic <= 0n) {
      setQuoteError("Amount must be greater than zero.");
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const q = await fetchHaystackQuote({
        chain,
        type: "fixed-input",
        amount: atomic,
        fromASAID: fromAsaId,
        toASAID: unit.asaId,
        optIn: true,
        disabledProtocols: ["Humble"],
      });
      if (!q.txnPayload) {
        setQuote(null);
        setQuoteError("No executable route for this pair.");
        return;
      }
      setQuote(q);
    } catch (e: unknown) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : "Could not load quote.");
    } finally {
      setQuoteLoading(false);
    }
  }, [chain, unit, selectedFrom, fromAsaId, amountIn]);

  useEffect(() => {
    if (!isOpen || !chain || !unit) return;
    const t = window.setTimeout(() => {
      void fetchQuote();
    }, 450);
    return () => window.clearTimeout(t);
  }, [isOpen, chain, unit, fetchQuote]);

  const estimatedOut = useMemo(() => {
    if (!quote || !unit) return null;
    // fixed-input: `quote` is output in toASAID base units
    return formatAtomic(quote.quote, unit.decimals);
  }, [quote, unit]);

  const handleSwap = async () => {
    if (
      !activeAccount?.address ||
      !transactionSigner ||
      !quote ||
      !unit
    ) {
      toast({
        title: "Cannot swap",
        description: !activeAccount?.address
          ? "Connect an Algorand wallet first."
          : "Missing quote or signing support.",
        variant: "destructive",
      });
      return;
    }

    setSwapLoading(true);
    try {
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Sign swap",
        description: `Approve swapping for UNIT in ${walletName}.`,
        duration: 12_000,
      });
      setRainbowkitSignDialogSuppressed(true);
      const result = await executeHaystackSwap({
        address: activeAccount.address,
        quote,
        slippagePercent,
        transactionSigner,
        activeWallet,
        setRainbowkitSuppressed: setRainbowkitSignDialogSuppressed,
      });
      toast({
        title: "Swap submitted",
        description: `Transaction ${result.txId.slice(0, 10)}… confirmed.`,
      });
      onSwapSuccess?.(result.txId);
      onClose();
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const msg = e instanceof Error ? e.message : "Swap failed.";
      toast({ title: "Swap failed", description: msg, variant: "destructive" });
    } finally {
      setSwapLoading(false);
      setRainbowkitSignDialogSuppressed(false);
    }
  };

  if (!chain || !unit) {
    return (
      <Dialog
        open={isOpen && !rainbowkitSignDialogSuppressed}
        onOpenChange={(o) => !o && onClose()}
      >
        <DialogContent className={MARKETS_MODAL_SHELL}>
          <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-6 pt-10 pb-6 sm:px-8 sm:pb-8">
            <DialogHeader className="space-y-2 text-center sm:text-left pr-8">
              <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                Swap unavailable
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Getting UNIT via Haystack requires Algorand mainnet or testnet
                with a configured UNIT asset. Switch network and try again.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-6 w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent className={MARKETS_MODAL_SHELL}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
            <DialogHeader className="space-y-1 pb-0">
              <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                Get UNIT
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Swap any supported asset for UNIT via the Haystack router.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-4 space-y-5 touch-pan-y">
            <div className="grid gap-2">
              <Label
                htmlFor="haystack-unit-from"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                From
              </Label>
              <select
                id="haystack-unit-from"
                className={FIELD_SELECT_CLASS}
                value={fromAsaId}
                onChange={(e) => setFromAsaId(Number(e.target.value))}
              >
                {fromAssets.map((r) => (
                  <option key={r.asaId} value={r.asaId}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="haystack-unit-amount"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Amount in
              </Label>
              <Input
                id="haystack-unit-amount"
                inputMode="decimal"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                To
              </Label>
              <div
                className={`${FIELD_SELECT_CLASS} items-center opacity-90 cursor-not-allowed`}
                aria-readonly
              >
                <span className="flex items-center gap-2">
                  {unit.logoPath ? (
                    <img
                      src={unit.logoPath}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  ) : null}
                  UNIT
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="haystack-unit-slippage"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Slippage tolerance
              </Label>
              <select
                id="haystack-unit-slippage"
                className={FIELD_SELECT_CLASS}
                value={slippagePercent}
                onChange={(e) => setSlippagePercent(Number(e.target.value))}
              >
                {SLIPPAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/60 px-4 py-4 text-sm shadow-sm space-y-2 text-slate-700 dark:text-slate-200">
              {quoteLoading ? (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Fetching quote…
                </div>
              ) : quote && estimatedOut != null ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Estimated out
                    </span>
                    <span className="font-medium tabular-nums text-slate-800 dark:text-white">
                      {estimatedOut} UNIT
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Value
                    </span>
                    <span className="tabular-nums">
                      {formatUsd(quote.usdIn)} → {formatUsd(quote.usdOut)}
                    </span>
                  </div>
                  {quote.userPriceImpact != null && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-400">
                        Price impact
                      </span>
                      <span className="tabular-nums">
                        {quote.userPriceImpact.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-600 dark:text-slate-400">
                  Enter an amount to see a quote
                  {quoteError ? `: ${quoteError}` : "."}
                </p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 shrink-0">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={swapLoading}
                className="flex-1 border-gray-200 bg-white/90 hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSwap()}
                disabled={
                  swapLoading ||
                  quoteLoading ||
                  !quote ||
                  !activeAccount?.address
                }
                className="flex-1 min-w-0 h-11 font-semibold bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {swapLoading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin dark:border-white/30 dark:border-t-white" />
                    Signing…
                  </div>
                ) : (
                  "Review & swap"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HaystackUnitSwapModal;
