import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatLiquidityFeeLabel,
  getPactPoolUrl,
  LIQUIDITY_PLATFORM_LABELS,
  type LiquidityPoolLendingMarket,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import { resolveLiquidityAssetMeta } from "@/services/tinymanLiquidityService";
import {
  pactAppIdFromPair,
  type PactTierSnapshot,
} from "@/services/pactLiquidityService";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { ArrowDownToLine, ArrowUpFromLine, Droplets, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export interface PactFeeTierRow {
  pair: LiquidityPoolPairConfig;
  snapshot?: PactTierSnapshot | null;
  loading?: boolean;
  lendingMarket?: LiquidityPoolLendingMarket | null;
  walletLpBalance?: number;
  suppliedLpBalance?: number;
}

interface PactFeeTierCardProps {
  tiers: PactFeeTierRow[];
  onSupply: (pair: LiquidityPoolPairConfig) => void;
  onWithdraw: (pair: LiquidityPoolPairConfig) => void;
}

function PoolAssetIcon({
  symbol,
  logoPath,
}: {
  symbol: string;
  logoPath?: string;
}) {
  if (logoPath) {
    return (
      <img
        src={logoPath}
        alt={symbol}
        className="h-8 w-8 rounded-full border border-border/50 object-contain bg-white"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-muted text-[10px] font-semibold">
      {symbol.slice(0, 3)}
    </div>
  );
}

/** Highest-TVL tier for this card’s shared `Add on {platform}` link. */
function pactAddLiquidityUrl(tiers: PactFeeTierRow[]): string | null {
  let best: { tvl: number; appId: number } | null = null;
  for (const tier of tiers) {
    const appId = pactAppIdFromPair(tier.pair);
    if (appId == null) continue;
    const tvl = tier.snapshot?.tvlUsd ?? 0;
    if (!best || tvl > best.tvl) {
      best = { tvl, appId };
    }
  }
  if (best) return getPactPoolUrl(best.appId);
  const fallback = pactAppIdFromPair(tiers[0]?.pair);
  return fallback != null ? getPactPoolUrl(fallback) : null;
}

const PactFeeTierCard = ({ tiers, onSupply, onWithdraw }: PactFeeTierCardProps) => {
  const { formatPercent, formatCurrency } = useNumberI18n();
  const first = tiers[0]?.pair;
  if (!first) return null;

  const asset1 =
    tiers.find((tier) => tier.snapshot)?.snapshot?.asset1 ??
    resolveLiquidityAssetMeta(first.networkId, first.asset1Id);
  const asset2 =
    tiers.find((tier) => tier.snapshot)?.snapshot?.asset2 ??
    resolveLiquidityAssetMeta(first.networkId, first.asset2Id);
  const label = first.label ?? `${asset1.symbol} / ${asset2.symbol}`;
  const platformLabel = LIQUIDITY_PLATFORM_LABELS.pact;
  const addOnPactUrl = pactAddLiquidityUrl(tiers);

  return (
    <DorkFiCard className="flex flex-col gap-3 p-5 transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <PoolAssetIcon symbol={asset1.symbol} logoPath={asset1.logoPath} />
            <PoolAssetIcon symbol={asset2.symbol} logoPath={asset2.logoPath} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink-blue dark:text-white">{label}</h3>
            <p className="text-xs text-muted-foreground">{platformLabel} liquidity pool</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">
          <Droplets className="mr-1 h-3 w-3" aria-hidden />
          LP
        </Badge>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {tiers.map((tier, index) => {
          const feeBps = tier.snapshot?.feeBps ?? tier.pair.feeBps ?? 0;
          const feeLabel = formatLiquidityFeeLabel(feeBps);
          const listed = tier.lendingMarket != null;
          const supplyDisabled = listed && (tier.walletLpBalance ?? 0) <= 0;
          const withdrawDisabled = !listed || (tier.suppliedLpBalance ?? 0) <= 0;
          const apr = tier.snapshot?.aprPercent ?? null;

          return (
            <div
              key={tier.pair.id}
              className={index > 0 ? "border-t border-border/60 pt-2" : undefined}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground">{feeLabel} fee</p>
                {tier.loading ? (
                  <Skeleton className="h-5 w-14" />
                ) : apr != null ? (
                  <Badge className="border-ocean-teal/30 bg-ocean-teal/15 text-ocean-teal hover:bg-ocean-teal/20">
                    {formatPercent(apr / 100, { maximumFractionDigits: 2 })} APR
                  </Badge>
                ) : null}
                {!tier.loading && tier.snapshot?.tvlUsd != null ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(tier.snapshot.tvlUsd, "USD", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    TVL
                  </span>
                ) : null}
              </div>

              {tier.loading ? (
                <div className="mb-2 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : tier.snapshot ? (
                <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{asset1.symbol} in pool</p>
                    <p className="font-medium tabular-nums">{tier.snapshot.asset1ReserveHuman}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{asset2.symbol} in pool</p>
                    <p className="font-medium tabular-nums">{tier.snapshot.asset2ReserveHuman}</p>
                  </div>
                  {(tier.walletLpBalance ?? 0) > 0 || (tier.suppliedLpBalance ?? 0) > 0 ? (
                    <p className="col-span-2 text-xs text-muted-foreground tabular-nums">
                      {(tier.walletLpBalance ?? 0) > 0
                        ? `${tier.walletLpBalance?.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })} LP in wallet`
                        : null}
                      {(tier.walletLpBalance ?? 0) > 0 &&
                      (tier.suppliedLpBalance ?? 0) > 0
                        ? " · "
                        : null}
                      {(tier.suppliedLpBalance ?? 0) > 0
                        ? `${tier.suppliedLpBalance?.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })} LP supplied`
                        : null}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mb-2 text-xs text-muted-foreground">
                  Pool data unavailable for the {feeLabel} tier.
                </p>
              )}

              <div className="flex gap-2">
                <DorkFiButton
                  variant="secondary"
                  className="flex-1"
                  disabled={supplyDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!listed) {
                      toast(
                        `${feeLabel} Pact LP lending is not enabled yet. Supply will deposit LP ASA ${tier.pair.lpTokenId} once that market is listed. Withdrawing later returns the same LP, including fees earned while it was supplied.`
                      );
                      return;
                    }
                    onSupply(tier.pair);
                  }}
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden />
                  Supply
                </DorkFiButton>
                <DorkFiButton
                  variant="borrow-outline"
                  className="flex-1"
                  disabled={withdrawDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onWithdraw(tier.pair);
                  }}
                >
                  <ArrowUpFromLine className="mr-2 h-4 w-4" aria-hidden />
                  Withdraw
                </DorkFiButton>
              </div>
            </div>
          );
        })}
        {addOnPactUrl ? (
          <DorkFiButton
            variant="secondary"
            type="button"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              window.open(addOnPactUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Add on {platformLabel}
          </DorkFiButton>
        ) : null}
      </div>
    </DorkFiCard>
  );
};

export default PactFeeTierCard;
