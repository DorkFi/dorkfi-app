import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDexAddLiquidityUrl,
  getDexFarmingProgramUrl,
  LIQUIDITY_PLATFORM_LABELS,
  poolHasTinymanFarm,
  type LiquidityPoolLendingMarket,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import {
  formatLiquidityAtomic,
  resolveLiquidityAssetMeta,
  type LiquidityPoolSnapshot,
  type LiquidityPoolUserPosition,
} from "@/services/tinymanLiquidityService";
import { cn } from "@/lib/utils";
import { Droplets, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PoolFarmSupplyNotice from "./PoolFarmSupplyNotice";

interface PoolPairCardProps {
  pair: LiquidityPoolPairConfig;
  snapshot?: LiquidityPoolSnapshot | null;
  position?: LiquidityPoolUserPosition | null;
  loading?: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  showDepositWithdraw?: boolean;
  lendingMarket?: LiquidityPoolLendingMarket | null;
  onSupply?: () => void;
  onLendingWithdraw?: () => void;
  lendingSupplyDisabled?: boolean;
  lendingWithdrawDisabled?: boolean;
  /** Human-unit LP supplied in the platform lending market (from deposit balance). */
  suppliedLpBalance?: number;
}

function PoolAssetIcon({
  assetId,
  symbol,
  logoPath,
}: {
  assetId: number;
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

const PoolPairCard = ({
  pair,
  snapshot,
  position,
  loading = false,
  onDeposit,
  onWithdraw,
  showDepositWithdraw = false,
  lendingMarket,
  onSupply,
  onLendingWithdraw,
  lendingSupplyDisabled = true,
  lendingWithdrawDisabled = true,
  suppliedLpBalance = 0,
}: PoolPairCardProps) => {
  const { formatPercent, formatCurrency } = useNumberI18n();
  const asset1 = snapshot?.asset1 ?? resolveLiquidityAssetMeta(pair.networkId, pair.asset1Id);
  const asset2 = snapshot?.asset2 ?? resolveLiquidityAssetMeta(pair.networkId, pair.asset2Id);
  const label = pair.label ?? `${asset1.symbol} / ${asset2.symbol}`;
  const farms = pair.farms ?? [];
  const hasFarm = poolHasTinymanFarm(pair);
  const hasPosition = Boolean(
    position &&
      (position.poolTokenBalance > 0n ||
        position.farmLpBalance > 0n ||
        suppliedLpBalance > 0)
  );
  const apr = snapshot?.apr;
  const displayApr = apr?.totalAprPercent ?? apr?.feeAprPercent ?? null;
  const platformLabel = LIQUIDITY_PLATFORM_LABELS[pair.platform];
  const dexLink = useMemo(() => {
    if (!pair.poolAddr) return null;

    const farmId = farms[0];
    if (farmId != null) {
      const farmUrl = getDexFarmingProgramUrl(pair.platform, pair.poolAddr, farmId);
      if (!farmUrl) return null;
      return {
        url: farmUrl,
        label: `Farm on ${platformLabel}`,
        isFarm: true,
      };
    }

    const addUrl = getDexAddLiquidityUrl(pair.platform, pair.poolAddr);
    if (!addUrl) return null;
    return {
      url: addUrl,
      label: `Add on ${platformLabel}`,
      isFarm: false,
    };
  }, [farms, pair.platform, pair.poolAddr, platformLabel]);

  return (
    <DorkFiCard className="flex flex-col gap-4 p-5 transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <PoolAssetIcon
              assetId={asset1.assetId}
              symbol={asset1.symbol}
              logoPath={asset1.logoPath}
            />
            <PoolAssetIcon
              assetId={asset2.assetId}
              symbol={asset2.symbol}
              logoPath={asset2.logoPath}
            />
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

      {displayApr != null ? (
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="border-ocean-teal/30 bg-ocean-teal/15 text-ocean-teal hover:bg-ocean-teal/20">
                {formatPercent(displayApr / 100, { maximumFractionDigits: 2 })} APR
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {apr?.totalAprPercent != null && apr?.feeAprPercent != null ? (
                <>
                  Total APR includes swap fees (
                  {formatPercent(apr.feeAprPercent / 100, {
                    maximumFractionDigits: 2,
                  })}
                  ) plus active Tinyman staking rewards. Sourced from Tinyman analytics.
                </>
              ) : (
                <>Estimated APR from Tinyman analytics (fees and rewards).</>
              )}
            </TooltipContent>
          </Tooltip>
          {apr?.liquidityUsd != null ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(apr.liquidityUsd, "USD", { maximumFractionDigits: 0 })} TVL
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-1 h-[5.75rem] w-full rounded-lg" />
        </div>
      ) : snapshot ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{asset1.symbol} in pool</p>
            <p className="font-medium tabular-nums">{snapshot.asset1ReserveHuman}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{asset2.symbol} in pool</p>
            <p className="font-medium tabular-nums">{snapshot.asset2ReserveHuman}</p>
          </div>
          <div className="col-span-2 min-h-[5.75rem]">
            {hasPosition && position ? (
              <div className="rounded-lg border border-ocean-teal/20 bg-ocean-teal/5 px-3 py-2 space-y-1">
                <p className="text-xs text-muted-foreground">Your position</p>
                <p className="font-medium tabular-nums text-sm">
                  {formatLiquidityAtomic(position.poolTokenBalance, 6)} LP in wallet
                </p>
                {suppliedLpBalance > 0 ? (
                  <p className="font-medium tabular-nums text-sm">
                    {suppliedLpBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    LP in platform
                  </p>
                ) : null}
                {position.poolTokenBalance > 0n ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {position.poolSharePercent.toFixed(4)}% pool share (wallet LP)
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pool data unavailable. Confirm the pair uses underlying ASA ids (not the LP
          token id) and that the Tinyman v2 pool is bootstrapped.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {dexLink ? (
          <DorkFiButton
            variant="secondary"
            type="button"
            className={cn(
              "w-full",
              dexLink.isFarm &&
                "border-amber-500/40 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
            )}
            onClick={(e) => {
              e.stopPropagation();
              window.open(dexLink.url, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {dexLink.label}
          </DorkFiButton>
        ) : null}
        {lendingMarket ? (
          <>
            {hasFarm ? <PoolFarmSupplyNotice /> : null}
            <div className="flex gap-2">
            <DorkFiButton
              variant="secondary"
              className="flex-1"
              disabled={lendingSupplyDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onSupply?.();
              }}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden />
              Supply
            </DorkFiButton>
            <DorkFiButton
              variant="borrow-outline"
              className="flex-1"
              disabled={lendingWithdrawDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onLendingWithdraw?.();
              }}
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" aria-hidden />
              Withdraw
            </DorkFiButton>
          </div>
          </>
        ) : null}
        {showDepositWithdraw ? (
        <div className="flex gap-2">
        <DorkFiButton
          variant="secondary"
          className="flex-1"
          disabled={!snapshot}
          onClick={(e) => {
            e.stopPropagation();
            onDeposit();
          }}
        >
          <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden />
          Deposit
        </DorkFiButton>
        <DorkFiButton
          variant="borrow-outline"
          className="flex-1"
          disabled={!snapshot || !hasPosition}
          onClick={(e) => {
            e.stopPropagation();
            onWithdraw();
          }}
        >
          <ArrowUpFromLine className="mr-2 h-4 w-4" aria-hidden />
          Withdraw
        </DorkFiButton>
        </div>
        ) : null}
      </div>
    </DorkFiCard>
  );
};

export default PoolPairCard;
