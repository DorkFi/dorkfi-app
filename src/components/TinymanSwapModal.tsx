/**
 * Tinyman swap router UI — quotes and unsigned groups via
 * {@link https://github.com/tinymanorg/tinyman-js-sdk/blob/main/src/swap/router/swap-router.ts tinyman-js-sdk swap-router}.
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
  getAllTokens,
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
  type TokenConfig,
} from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import {
  generateSwapRouterTxns,
  getSwapRoute,
  tinymanJSSDKConfig,
  SwapQuoteError,
  SwapType,
  type SupportedNetwork,
  type SwapRouterResponse,
} from "@tinymanorg/tinyman-js-sdk";
import { ArrowDownUp, Loader2 } from "lucide-react";

export type TinymanSwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Must be an Algorand network supported by Tinyman swap router (mainnet / testnet). */
  networkId: NetworkId;
  onSwapSuccess?: (txId: string) => void;
  /**
   * When the modal opens, pick a route *into* native ALGO (e.g. USDC → ALGO on mainnet)
   * so users can top up fee currency. Falls back to the default pair if no suitable asset in.
   */
  initialReceiveAlgo?: boolean;
};

type SwapAssetRow = {
  tinymanAssetId: number;
  label: string;
  decimals: number;
};

function tinymanSupportedNetwork(networkId: NetworkId): SupportedNetwork | null {
  if (networkId === "algorand-mainnet") return "mainnet";
  if (networkId === "algorand-testnet") return "testnet";
  return null;
}

function resolveTinymanAssetId(token: TokenConfig): number | null {
  if (token.isStoken) return null;
  if (token.tokenStandard === "network" || token.tokenStandard === "network-asa") {
    const raw = token.assetId ?? "0";
    if (!/^\d+$/.test(raw)) return null;
    return Number(raw);
  }
  if (token.tokenStandard === "asa" || token.tokenStandard === "asa-asa") {
    if (!token.assetId || !/^\d+$/.test(token.assetId)) return null;
    return Number(token.assetId);
  }
  return null;
}

function buildSwapAssetRows(networkId: NetworkId): SwapAssetRow[] {
  const tokens = getAllTokens(networkId);
  const seen = new Set<number>();
  const rows: SwapAssetRow[] = [];
  for (const t of tokens) {
    const id = resolveTinymanAssetId(t);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    const sym = t.marketOverride?.displaySymbol ?? t.symbol;
    rows.push({
      tinymanAssetId: id,
      label: `${sym} (${id === 0 ? "ALGO" : id})`,
      decimals: t.decimals,
    });
  }
  rows.sort((a, b) => {
    if (a.tinymanAssetId === 0) return -1;
    if (b.tinymanAssetId === 0) return 1;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

function formatAtomic(amount: string, decimals: number): string {
  try {
    const bn = new BigNumber(amount || "0");
    if (!bn.isFinite() || bn.isNegative()) return "—";
    const v = bn.shiftedBy(-decimals);
    if (v.gte(1e9)) return v.toExponential(4);
    return v.decimalPlaces(8, BigNumber.ROUND_DOWN).toFixed();
  } catch {
    return "—";
  }
}

const SLIPPAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "0.1%", value: "0.001" },
  { label: "0.5%", value: "0.005" },
  { label: "1%", value: "0.01" },
  { label: "2%", value: "0.02" },
];

/** Matches {@link WithdrawModal} / {@link SupplyBorrowModal} shell. */
const MARKETS_MODAL_SHELL =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-hidden flex flex-col p-0 overscroll-contain";

const FIELD_SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-teal/40 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white";

const FIELD_INPUT_CLASS =
  "h-10 border-gray-200 bg-white/90 text-slate-800 shadow-sm focus-visible:ring-ocean-teal/40 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white";

const TinymanSwapModal: React.FC<TinymanSwapModalProps> = ({
  isOpen,
  onClose,
  networkId,
  onSwapSuccess,
  initialReceiveAlgo = false,
}) => {
  const tinymanNet = tinymanSupportedNetwork(networkId);
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { toast } = useToast();

  const assetRows = useMemo(
    () => (tinymanNet ? buildSwapAssetRows(networkId) : []),
    [networkId, tinymanNet]
  );

  const defaultPair = useMemo(() => {
    const algo = assetRows.find((r) => r.tinymanAssetId === 0);
    const usdc = assetRows.find((r) => r.tinymanAssetId === 31_566_704);
    const firstNonAlgo = assetRows.find((r) => r.tinymanAssetId !== 0);
    return {
      assetInId: algo?.tinymanAssetId ?? assetRows[0]?.tinymanAssetId ?? 0,
      assetOutId:
        usdc?.tinymanAssetId ??
        firstNonAlgo?.tinymanAssetId ??
        assetRows[1]?.tinymanAssetId ??
        0,
    };
  }, [assetRows]);

  /** Asset to swap from when topping up ALGO (USDC on mainnet when present, else first non-ALGO). */
  const gasUpAssetInId = useMemo(() => {
    const usdc = assetRows.find((r) => r.tinymanAssetId === 31_566_704);
    const firstNonAlgo = assetRows.find((r) => r.tinymanAssetId !== 0);
    const id = usdc?.tinymanAssetId ?? firstNonAlgo?.tinymanAssetId ?? null;
    return id != null && id !== 0 ? id : null;
  }, [assetRows]);

  const [assetInId, setAssetInId] = useState(0);
  const [assetOutId, setAssetOutId] = useState(0);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.01");
  const [route, setRoute] = useState<SwapRouterResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);

  useEffect(() => {
    tinymanJSSDKConfig.setClientName("DorkFi-PreFi");
  }, []);

  useEffect(() => {
    if (!isOpen || !tinymanNet) return;
    if (initialReceiveAlgo && gasUpAssetInId != null) {
      setAssetInId(gasUpAssetInId);
      setAssetOutId(0);
    } else {
      setAssetInId(defaultPair.assetInId);
      setAssetOutId(defaultPair.assetOutId);
    }
    setAmountIn("");
    setRoute(null);
    setQuoteError(null);
  }, [
    isOpen,
    tinymanNet,
    networkId,
    defaultPair.assetInId,
    defaultPair.assetOutId,
    initialReceiveAlgo,
    gasUpAssetInId,
  ]);

  const decimalsIn = useMemo(
    () => assetRows.find((r) => r.tinymanAssetId === assetInId)?.decimals ?? 6,
    [assetRows, assetInId]
  );
  const decimalsOut = useMemo(
    () => assetRows.find((r) => r.tinymanAssetId === assetOutId)?.decimals ?? 6,
    [assetRows, assetOutId]
  );

  const fetchQuote = useCallback(async () => {
    if (!tinymanNet || assetInId === assetOutId) {
      setRoute(null);
      setQuoteError("Choose two different assets.");
      return;
    }
    const trimmed = amountIn.trim();
    if (!trimmed || trimmed === "." || Number(trimmed) <= 0) {
      setRoute(null);
      setQuoteError(null);
      return;
    }
    let atomic: bigint;
    try {
      atomic = BigInt(
        new BigNumber(trimmed).times(new BigNumber(10).pow(decimalsIn)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0)
      );
    } catch {
      setQuoteError("Invalid amount.");
      setRoute(null);
      return;
    }
    if (atomic <= 0n) {
      setQuoteError("Amount must be greater than zero.");
      setRoute(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const r = await getSwapRoute({
        amount: atomic,
        assetInID: assetInId,
        assetOutID: assetOutId,
        swapType: SwapType.FixedInput,
        network: tinymanNet,
        slippage,
      });
      setRoute(r);
    } catch (e: unknown) {
      setRoute(null);
      if (e instanceof SwapQuoteError) {
        setQuoteError(e.message);
      } else if (e instanceof Error) {
        setQuoteError(e.message);
      } else {
        setQuoteError("Could not load quote.");
      }
    } finally {
      setQuoteLoading(false);
    }
  }, [tinymanNet, assetInId, assetOutId, amountIn, decimalsIn, slippage]);

  useEffect(() => {
    if (!isOpen || !tinymanNet) return;
    const t = window.setTimeout(() => {
      void fetchQuote();
    }, 450);
    return () => window.clearTimeout(t);
  }, [isOpen, tinymanNet, fetchQuote]);

  const flipAssets = () => {
    const a = assetInId;
    setAssetInId(assetOutId);
    setAssetOutId(a);
    setRoute(null);
  };

  const handleSwap = async () => {
    if (!tinymanNet || !activeAccount?.address || !route || !signTransactions) {
      toast({
        title: "Cannot swap",
        description: !activeAccount?.address
          ? "Connect an Algorand wallet first."
          : "Missing quote or signing support.",
        variant: "destructive",
      });
      return;
    }
    const algodNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algodNetwork) {
      toast({
        title: "Network error",
        description: "This network is not Algorand-compatible.",
        variant: "destructive",
      });
      return;
    }
    setSwapLoading(true);
    try {
      const { algod } = await algorandService.initializeClientsForTransactions(algodNetwork);
      const signerTxns = await generateSwapRouterTxns({
        client: algod,
        initiatorAddr: activeAccount.address,
        route,
      });
      if (signerTxns.length === 0) {
        throw new Error("No transactions returned for this route.");
      }
      const unsigned = signerTxns.map(({ txn }) =>
        Uint8Array.from(algosdk.encodeUnsignedTransaction(txn))
      );
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Sign swap",
        description: `Approve the swap in ${walletName}.`,
        duration: 12_000,
      });
      const signed = await signTransactions(unsigned);
      const res = await algod.sendRawTransaction(signed).do();
      await waitForConfirmation(algod, res.txid, 4);
      toast({
        title: "Swap submitted",
        description: `Transaction ${res.txid.slice(0, 10)}… confirmed.`,
      });
      onSwapSuccess?.(res.txid);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Swap failed.";
      toast({ title: "Swap failed", description: msg, variant: "destructive" });
    } finally {
      setSwapLoading(false);
    }
  };

  if (!tinymanNet) {
    return (
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className={MARKETS_MODAL_SHELL}>
          <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-6 pt-10 pb-6 sm:px-8 sm:pb-8">
            <DialogHeader className="space-y-2 text-center sm:text-left pr-8">
              <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                Swap unavailable
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {
                  "Swaps use Tinyman's router on Algorand mainnet or testnet only. Switch network and try again."
                }
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={onClose} className="mt-6 w-full sm:w-auto">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={MARKETS_MODAL_SHELL}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
            <DialogHeader className="space-y-1 pb-0">
              <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                Swap
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {
                  "Exchange assets using Tinyman's swap router on this network."
                }
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-4 space-y-5 touch-pan-y">
            <div className="grid gap-2">
              <Label
                htmlFor="tinyman-asset-in"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                From
              </Label>
              <select
                id="tinyman-asset-in"
                className={FIELD_SELECT_CLASS}
                value={assetInId}
                onChange={(e) => setAssetInId(Number(e.target.value))}
              >
                {assetRows.map((r) => (
                  <option key={r.tinymanAssetId} value={r.tinymanAssetId}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center py-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={flipAssets}
                aria-label="Flip assets"
                className="border-gray-200 bg-white/80 hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:hover:bg-slate-800"
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="tinyman-asset-out"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                To
              </Label>
              <select
                id="tinyman-asset-out"
                className={FIELD_SELECT_CLASS}
                value={assetOutId}
                onChange={(e) => setAssetOutId(Number(e.target.value))}
              >
                {assetRows.map((r) => (
                  <option key={r.tinymanAssetId} value={r.tinymanAssetId}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="tinyman-amount"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Amount in
              </Label>
              <Input
                id="tinyman-amount"
                inputMode="decimal"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="tinyman-slippage"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Slippage tolerance
              </Label>
              <select
                id="tinyman-slippage"
                className={FIELD_SELECT_CLASS}
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
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
              ) : route ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Estimated out</span>
                    <span className="font-medium tabular-nums text-slate-800 dark:text-white">
                      {formatAtomic(route.output_amount, decimalsOut)}{" "}
                      {assetRows.find((r) => r.tinymanAssetId === assetOutId)?.label.split(" ")[0] ?? ""}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Price impact</span>
                    <span className="tabular-nums">{route.price_impact}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Router fee (µALGO)</span>
                    <span>{route.transaction_fee}</span>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 dark:text-slate-400">
                  Enter an amount to see a quote{quoteError ? `: ${quoteError}` : "."}
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
                  !route ||
                  assetInId === assetOutId ||
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

export default TinymanSwapModal;
