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
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";
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

  return (
    <DorkFiCard className="flex h-full flex-col gap-4 p-5 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <PoolAssetIcon symbol={asset1.symbol} logoPath={asset1.logoPath} />
            <PoolAssetIcon symbol={asset2.symbol} logoPath={asset2.logoPath} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink-blue dark:text-white">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {platformLabel} liquidity pool · Pool E
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">
          Two fee tiers
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {tiers.map((tier) => {
          const feeBps = tier.snapshot?.feeBps ?? tier.pair.feeBps ?? 0;
          const feeLabel = formatLiquidityFeeLabel(feeBps);
          const appId = pactAppIdFromPair(tier.pair);
          const listed = tier.lendingMarket != null;
          const supplyDisabled = listed && (tier.walletLpBalance ?? 0) <= 0;
          const withdrawDisabled = !listed || (tier.suppliedLpBalance ?? 0) <= 0;
          const apr = tier.snapshot?.aprPercent ?? null;

          return (
            <div
              key={tier.pair.id}
              className="rounded-lg border border-border/70 bg-background/40 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{feeLabel} fee</p>
                {tier.loading ? (
                  <Skeleton className="h-5 w-16" />
                ) : apr != null ? (
                  <Badge className="border-ocean-teal/30 bg-ocean-teal/15 text-ocean-teal hover:bg-ocean-teal/20">
                    {formatPercent(apr / 100, { maximumFractionDigits: 2 })} APR
                  </Badge>
                ) : null}
              </div>

              {tier.loading ? (
                <Skeleton className="mb-3 h-10 w-full" />
              ) : tier.snapshot ? (
                <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{asset1.symbol} in pool</p>
                    <p className="font-medium tabular-nums">{tier.snapshot.asset1ReserveHuman}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{asset2.symbol} in pool</p>
                    <p className="font-medium tabular-nums">{tier.snapshot.asset2ReserveHuman}</p>
                  </div>
                  {tier.snapshot.tvlUsd != null ? (
                    <p className="col-span-2 text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(tier.snapshot.tvlUsd, "USD", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      TVL
                      {(tier.walletLpBalance ?? 0) > 0
                        ? ` · ${tier.walletLpBalance?.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })} LP in wallet`
                        : ""}
                      {(tier.suppliedLpBalance ?? 0) > 0
                        ? ` · ${tier.suppliedLpBalance?.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })} LP in Pool E`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mb-3 text-sm text-muted-foreground">
                  Pact data is unavailable for the {feeLabel} tier.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <DorkFiButton
                  variant="secondary"
                  className="flex-1"
                  disabled={supplyDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!listed) {
                      toast(
                        `${feeLabel} Pact LP is not listed on Pool E yet. Supply will deposit LP ASA ${tier.pair.lpTokenId} once that market exists. Withdrawing later returns the same LP, including fees earned while it was supplied.`
                      );
                      return;
                    }
                    onSupply(tier.pair);
                  }}
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden />
                  Supply {feeLabel}
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
              {appId != null ? (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center text-xs font-medium text-ocean-teal hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.open(getPactPoolUrl(appId), "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="mr-1 h-3 w-3" aria-hidden />
                  Add {feeLabel} on {platformLabel}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Each fee tier is its own Pool E collateral market. Supplied LP stays in the Pact pool,
        so trading fees keep accruing. Withdraw returns that same LP ASA.
      </p>
    </DorkFiCard>
  );
};

export default PactFeeTierCard;
