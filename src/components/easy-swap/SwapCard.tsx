import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { ArrowDownUp, Check, Loader2 } from "lucide-react";
import BigNumber from "bignumber.js";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getTokenConfig,
  type NetworkId,
  type TokenConfig,
} from "@/config";
import {
  createHaystackRouterClient,
  isHaystackSwapSupported,
} from "@/services/haystackRouter";
import { useHaystackSwapQuote } from "@/hooks/useHaystackQuote";
import { fetchUserWalletBalance } from "@/services/lendingService";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { cn, formatUsdAmount } from "@/lib/utils";
import WalletModal from "@/components/WalletModal";
import { useToast } from "@/hooks/use-toast";

export type SwapAssetOption = {
  configKey: string;
  assetId: number;
  symbol: string;
  decimals: number;
  logoPath: string;
};

const PRESETS = [
  { label: "10%", fraction: 0.1 },
  { label: "25%", fraction: 0.25 },
  { label: "50%", fraction: 0.5 },
  { label: "Max", fraction: 1 },
] as const;

const CURATED_KEYS = [
  "USDC",
  "UNIT",
  "ALGO",
  "tALGO",
  "goBTC",
  "goETH",
] as const;

function resolveAsaId(token: TokenConfig): number | null {
  if (token.isStoken) return null;
  if (
    token.tokenStandard === "network" ||
    token.tokenStandard === "network-asa"
  ) {
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

function firstTokenConfig(
  raw: TokenConfig | TokenConfig[] | null | undefined
): TokenConfig | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function buildSwapAssets(networkId: NetworkId): SwapAssetOption[] {
  const out: SwapAssetOption[] = [];
  const seen = new Set<number>();

  for (const key of CURATED_KEYS) {
    const token = firstTokenConfig(getTokenConfig(networkId, key));
    if (!token) continue;
    const id = resolveAsaId(token);
    if (id == null || seen.has(id)) continue;
    // Prefer native ALGO (asset 0) over fALGO-style rows
    if (key === "ALGO" && token.symbol === "fALGO") continue;
    seen.add(id);
    out.push({
      configKey: key,
      assetId: id,
      symbol: token.marketOverride?.displaySymbol ?? token.symbol,
      decimals: token.decimals,
      logoPath:
        token.logoPath || getTokenImagePath(token.symbol) || "/placeholder.svg",
    });
  }
  return out;
}

function AssetPicker({
  label,
  asset,
  options,
  onChange,
  amount,
  onAmountChange,
  amountReadOnly,
  balance,
  showPresets,
  onPreset,
}: {
  label: string;
  asset: SwapAssetOption;
  options: SwapAssetOption[];
  onChange: (assetId: number) => void;
  amount: string;
  onAmountChange?: (v: string) => void;
  amountReadOnly?: boolean;
  balance: number | null;
  showPresets?: boolean;
  onPreset?: (fraction: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <input
            inputMode="decimal"
            value={amount}
            readOnly={amountReadOnly}
            onChange={(e) =>
              onAmountChange?.(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="0.0"
            className={cn(
              "min-w-0 flex-1 bg-transparent text-3xl font-semibold outline-none placeholder:text-muted-foreground/40",
              amountReadOnly && "text-muted-foreground"
            )}
          />
          <div className="relative shrink-0">
            <select
              value={asset.assetId}
              onChange={(e) => onChange(Number(e.target.value))}
              className="appearance-none rounded-full border border-border bg-card pl-10 pr-8 py-2 text-sm font-semibold shadow-sm outline-none focus:ring-2 focus:ring-ocean-teal/40"
              aria-label={`${label} asset`}
            >
              {options.map((o) => (
                <option key={o.assetId} value={o.assetId}>
                  {o.symbol}
                </option>
              ))}
            </select>
            <img
              src={asset.logoPath}
              alt=""
              className="pointer-events-none absolute left-2 top-1/2 size-6 -translate-y-1/2 rounded-full"
            />
            <Check className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ocean-teal" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div />
          <p className="text-xs text-muted-foreground tabular-nums">
            Balance:{" "}
            {balance != null
              ? balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
              : "0.0000"}
          </p>
        </div>
        {showPresets && onPreset ? (
          <div className="mt-3 flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onPreset(p.fraction)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceChip({
  asset,
  usdPrice,
  changePct,
}: {
  asset: SwapAssetOption;
  usdPrice: number | null;
  changePct: number | null;
}) {
  const up = changePct == null || changePct >= 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <img src={asset.logoPath} alt="" className="size-8 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{asset.symbol}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {usdPrice != null ? formatUsdAmount(usdPrice) : "—"}
        </p>
      </div>
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          up ? "text-emerald-500" : "text-red-500"
        )}
      >
        {changePct != null
          ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
          : "—"}
      </span>
    </div>
  );
}

/**
 * Simple Haystack-powered swap card — From / To, quote, connect + execute.
 */
const SwapCard = () => {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const { activeAccount, transactionSigner } = useWallet();
  const { toast } = useToast();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [amountIn, setAmountIn] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [slippage] = useState(1);

  const assets = useMemo(() => buildSwapAssets(networkId), [networkId]);
  const supported = isHaystackSwapSupported(networkId);

  const defaultFrom =
    assets.find((a) => a.symbol === "USDC") ?? assets[0] ?? null;
  const defaultTo =
    assets.find((a) => a.symbol === "UNIT") ??
    assets.find((a) => a.assetId !== defaultFrom?.assetId) ??
    null;

  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);

  const fromAsset =
    assets.find((a) => a.assetId === (fromId ?? defaultFrom?.assetId)) ??
    defaultFrom;
  const toAsset =
    assets.find((a) => a.assetId === (toId ?? defaultTo?.assetId)) ??
    defaultTo;

  const balanceQuery = useQuery({
    queryKey: [
      "swapBalance",
      networkId,
      activeAccount?.address,
      fromAsset?.configKey,
    ],
    enabled: Boolean(activeAccount?.address && fromAsset),
    staleTime: 30_000,
    queryFn: async () => {
      if (!activeAccount?.address || !fromAsset) return null;
      return fetchUserWalletBalance(
        activeAccount.address,
        fromAsset.configKey,
        networkId
      );
    },
  });

  const balance = balanceQuery.data ?? null;

  const quote = useHaystackSwapQuote({
    networkId,
    fromAssetId: fromAsset?.assetId ?? 0,
    toAssetId: toAsset?.assetId ?? 0,
    amount: amountIn,
    fromDecimals: fromAsset?.decimals ?? 6,
    toDecimals: toAsset?.decimals ?? 6,
    enabled: supported && Boolean(fromAsset && toAsset),
  });

  /** Spot-ish USD prices from a 1-unit USDC-normalized quote when available. */
  const fromUsd =
    quote.usdIn != null && parseFloat(amountIn) > 0
      ? quote.usdIn / parseFloat(amountIn)
      : fromAsset?.symbol === "USDC"
        ? 1
        : null;
  const toUsd =
    quote.usdOut != null &&
    quote.amountOutHuman != null &&
    parseFloat(quote.amountOutHuman) > 0
      ? quote.usdOut / parseFloat(quote.amountOutHuman)
      : toAsset?.symbol === "USDC"
        ? 1
        : null;

  const flip = () => {
    if (!fromAsset || !toAsset) return;
    setFromId(toAsset.assetId);
    setToId(fromAsset.assetId);
    setAmountIn(quote.amountOutHuman ?? "");
  };

  const applyPreset = (fraction: number) => {
    if (balance == null || balance <= 0 || !fromAsset) return;
    const v = new BigNumber(balance).times(fraction);
    setAmountIn(
      v.decimalPlaces(Math.min(fromAsset.decimals, 6), BigNumber.ROUND_DOWN).toFixed()
    );
  };

  const cta = (() => {
    if (!supported) return { label: "Swap unavailable on this network", disabled: true };
    if (!activeAccount) return { label: "Connect Wallet to Swap", disabled: false };
    if (!amountIn || parseFloat(amountIn) <= 0)
      return { label: "Enter an amount", disabled: true };
    if (balance != null && parseFloat(amountIn) > balance + 1e-12)
      return { label: "Insufficient Balance", disabled: true };
    if (quote.isLoading) return { label: "Fetching quote…", disabled: true };
    if (quote.error) return { label: "Quote unavailable", disabled: true };
    if (!quote.quote) return { label: "Enter an amount", disabled: true };
    if (swapping) return { label: "Swapping…", disabled: true };
    return { label: "Swap", disabled: false };
  })();

  const onCta = async () => {
    if (!activeAccount) {
      setWalletModalOpen(true);
      return;
    }
    if (cta.disabled || !quote.quote || !fromAsset || !toAsset) return;
    if (!transactionSigner) {
      toast({
        title: "Wallet cannot sign",
        description: "Reconnect your wallet and try again.",
        variant: "destructive",
      });
      return;
    }

    setSwapping(true);
    try {
      const client = createHaystackRouterClient(networkId);
      if (!client) throw new Error("Haystack Router unavailable");
      const swap = await client.newSwap({
        quote: quote.quote,
        address: activeAccount.address,
        signer: transactionSigner,
        slippage,
      });
      const result = await swap.execute();
      toast({
        title: "Swap submitted",
        description: `Confirmed in round ${result.confirmedRound.toString()}`,
      });
      setAmountIn("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      toast({ title: "Swap failed", description: msg, variant: "destructive" });
    } finally {
      setSwapping(false);
    }
  };

  return (
    <section className="w-full max-w-md mx-auto space-y-4">
      <div className="rounded-[28px] border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-1">
        {!supported ? (
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
            Haystack Router swaps are available on Algorand Mainnet. Switch
            network to continue.
          </p>
        ) : null}

        {fromAsset ? (
          <AssetPicker
            label="From"
            asset={fromAsset}
            options={assets}
            onChange={(id) => {
              setFromId(id);
              if (id === toAsset?.assetId && toAsset) {
                setToId(fromAsset.assetId);
              }
            }}
            amount={amountIn}
            onAmountChange={setAmountIn}
            balance={balance}
            showPresets
            onPreset={applyPreset}
          />
        ) : null}

        <div className="flex justify-end -my-1 relative z-10 pr-1">
          <button
            type="button"
            onClick={flip}
            aria-label="Flip assets"
            className="rounded-full border border-border bg-card p-2.5 shadow-sm hover:bg-muted transition-colors"
          >
            <ArrowDownUp className="size-4" />
          </button>
        </div>

        {toAsset ? (
          <AssetPicker
            label="To"
            asset={toAsset}
            options={assets}
            onChange={(id) => {
              setToId(id);
              if (id === fromAsset?.assetId && fromAsset) {
                setFromId(toAsset.assetId);
              }
            }}
            amount={quote.amountOutHuman ?? ""}
            amountReadOnly
            balance={null}
          />
        ) : null}

        <button
          type="button"
          disabled={cta.disabled && Boolean(activeAccount)}
          onClick={onCta}
          className={cn(
            "mt-4 w-full rounded-2xl py-4 text-base font-semibold transition-opacity",
            "bg-whale-gold text-zinc-950 hover:opacity-90",
            cta.disabled && activeAccount && "opacity-50 cursor-not-allowed"
          )}
        >
          {swapping || quote.isLoading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 className="size-4 animate-spin" />
              {cta.label}
            </span>
          ) : (
            cta.label
          )}
        </button>

        <div className="mt-4 rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground">
          {!amountIn || parseFloat(amountIn) <= 0 ? (
            "Enter an amount to see quote details"
          ) : quote.isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Fetching Haystack route…
            </span>
          ) : quote.error ? (
            <span className="text-destructive">{quote.error}</span>
          ) : quote.quote ? (
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt>You receive</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {quote.amountOutHuman} {toAsset?.symbol}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>USD value</dt>
                <dd className="tabular-nums">
                  {quote.usdOut != null ? formatUsdAmount(quote.usdOut) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Price impact</dt>
                <dd className="tabular-nums">
                  {quote.priceImpact != null
                    ? `${quote.priceImpact.toFixed(2)}%`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <dt>Router</dt>
                <dd>Haystack</dd>
              </div>
            </dl>
          ) : (
            "Enter an amount to see quote details"
          )}
        </div>
      </div>

      {fromAsset && toAsset ? (
        <div className="grid grid-cols-2 gap-3">
          <PriceChip asset={fromAsset} usdPrice={fromUsd} changePct={0} />
          <PriceChip
            asset={toAsset}
            usdPrice={toUsd}
            changePct={
              quote.priceImpact != null ? -Math.abs(quote.priceImpact) : null
            }
          />
        </div>
      ) : null}

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </section>
  );
};

export default SwapCard;
