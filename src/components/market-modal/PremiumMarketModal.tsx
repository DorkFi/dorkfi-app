import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getAllTokensWithDisplayInfo, getMarketLabel, type NetworkId } from '@/config';
import { useMimirTokenPrice24h } from '@/hooks/useMimirTokenPrice24h';
import { MarketData, UserPosition, UserPositionLoadState } from './types';
import { MarketHeader } from './MarketHeader';
import { UserPositionBar } from './UserPositionBar';
import { MarketOverview } from './MarketOverview';
import { PrimaryActionButtons } from './PrimaryActionButtons';
import { HealthFactorSimulator } from './HealthFactorSimulator';
import { EarningsCalculator } from './EarningsCalculator';
import { CollateralRiskPanel } from './CollateralRiskPanel';
import { MarketModalFooter } from './MarketModalFooter';
import { UtilizationRatePanel } from './UtilizationRatePanel';
import { MarketDetailStatsSection } from './MarketDetailStatsSection';

const SECTION =
  'rounded-lg border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4 min-w-0 w-full max-w-full overflow-x-hidden';

function poolIdFromRawMarket(raw: Record<string, unknown> | null | undefined): string | undefined {
  if (!raw) return undefined;
  const direct = raw.poolId;
  if (direct != null && String(direct) !== '') return String(direct);
  const mi = raw.marketInfo as { poolId?: string } | undefined;
  if (mi?.poolId != null && String(mi.poolId) !== '') return String(mi.poolId);
  return undefined;
}

export interface PremiumMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  chainId?: 'voi' | 'algorand';
  /** Original on-demand market row (pool id, caps, risk params). */
  rawMarket?: Record<string, unknown> | null;
  networkId?: string | null;
  marketData: MarketData;
  userPosition?: UserPosition;
  userPositionLoadState?: UserPositionLoadState;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onBorrow?: () => void;
  onRepay?: () => void;
}

export const PremiumMarketModal = ({
  isOpen,
  onClose,
  asset,
  chainId = 'voi',
  rawMarket,
  networkId,
  marketData,
  userPosition,
  userPositionLoadState = 'idle',
  onDeposit,
  onWithdraw,
  onBorrow,
  onRepay,
}: PremiumMarketModalProps) => {
  const marketLabel = useMemo(() => {
    const poolId = poolIdFromRawMarket(rawMarket ?? null);
    if (!networkId || !poolId) return null;
    return getMarketLabel(networkId, poolId);
  }, [rawMarket, networkId]);

  const {
    priceChange24h: mimirChange24h,
    priceHistory: mimirHistory,
  } = useMimirTokenPrice24h(marketData.symbol, isOpen);

  const headerMarketData = useMemo((): MarketData => {
    const mergedHistory =
      mimirHistory.length > 0 ? mimirHistory : (marketData.priceHistory ?? []);
    return {
      ...marketData,
      priceChange24h: mimirChange24h,
      priceHistory: mergedHistory,
    };
  }, [marketData, mimirChange24h, mimirHistory]);

  const explorerIds = useMemo(() => {
    if (!networkId) {
      return { poolAppId: undefined as string | undefined, underlyingAssetId: undefined as string | undefined };
    }
    const poolId = poolIdFromRawMarket(rawMarket ?? null);
    const tokens = getAllTokensWithDisplayInfo(networkId as NetworkId);
    const t = tokens.find(
      (x) =>
        x.symbol === asset &&
        (poolId == null || String(x.poolId) === String(poolId))
    );
    if (!t?.poolId) {
      return {
        poolAppId: poolId != null && String(poolId) !== '' ? String(poolId) : undefined,
        underlyingAssetId: undefined as string | undefined,
      };
    }
    const aid =
      'underlyingAssetId' in t && t.underlyingAssetId != null && String(t.underlyingAssetId) !== ''
        ? String(t.underlyingAssetId)
        : undefined;
    return { poolAppId: String(t.poolId), underlyingAssetId: aid };
  }, [networkId, rawMarket, asset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full min-w-0 min-h-0 max-h-[min(90dvh,90vh)] flex flex-col overflow-hidden px-0 py-0 dorkfi-dark-bg-modal rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all">
        <DialogTitle className="sr-only">{marketData.symbol} Market Details</DialogTitle>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl">
          <div className="flex flex-col gap-3 sm:gap-4 px-3 pb-4 pt-10 pr-11 sm:px-4 sm:pt-4 sm:pr-10 min-w-0 w-full max-w-full box-border">

            <MarketHeader
              marketData={headerMarketData}
              chainId={chainId}
              marketLabel={marketLabel}
            />
            <UserPositionBar
              userPosition={userPosition}
              loadState={userPositionLoadState}
            />

            <section className={SECTION}>
              <MarketOverview marketData={marketData} />
            </section>

            <section className={SECTION}>
              <UtilizationRatePanel utilization={marketData.utilization ?? 0} />
            </section>

            <section className={SECTION}>
              <PrimaryActionButtons
                onDeposit={onDeposit}
                onWithdraw={onWithdraw}
                onBorrow={onBorrow}
                onRepay={onRepay}
                asset={asset}
                userPosition={userPosition}
                marketData={marketData}
              />
            </section>

            <section className={SECTION}>
              <HealthFactorSimulator userPosition={userPosition} marketData={marketData} />
            </section>

            <section className={SECTION}>
              <EarningsCalculator userPosition={userPosition} marketData={marketData} />
            </section>

            <section className={SECTION}>
              <CollateralRiskPanel marketData={marketData} />
            </section>

            {rawMarket && networkId && (
              <section className={SECTION}>
                <MarketDetailStatsSection
                  rawMarket={rawMarket}
                  networkId={networkId}
                />
              </section>
            )}

            <MarketModalFooter
              asset={asset}
              networkId={networkId}
              poolAppId={explorerIds.poolAppId}
              underlyingAssetId={explorerIds.underlyingAssetId}
            />

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
