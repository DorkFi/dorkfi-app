import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarketData, UserPosition } from './types';
import { MarketHeader } from './MarketHeader';
import { UserPositionBar } from './UserPositionBar';
import { MarketOverview } from './MarketOverview';
import { PrimaryActionButtons } from './PrimaryActionButtons';
import { HealthFactorSimulator } from './HealthFactorSimulator';
import { EarningsCalculator } from './EarningsCalculator';
import { CollateralRiskPanel } from './CollateralRiskPanel';
import { MarketModalFooter } from './MarketModalFooter';
import { UtilizationRatePanel } from './UtilizationRatePanel';

export interface PremiumMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  chainId?: 'voi' | 'algorand';
  marketData: MarketData;
  userPosition?: UserPosition;
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
  marketData,
  userPosition,
  onDeposit,
  onWithdraw,
  onBorrow,
  onRepay,
}: PremiumMarketModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full px-0 py-0 bg-gradient-to-br from-[#111e2f] via-[#101729] to-[#111624] shadow-2xl border border-blue-50/10 rounded-2xl">
        <DialogTitle className="sr-only">{marketData.symbol} Market Details</DialogTitle>
        <ScrollArea className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <div className="flex flex-col gap-4 px-4">

            <MarketHeader marketData={marketData} chainId={chainId} />
            <UserPositionBar userPosition={userPosition} />

            {/* Market Overview */}
            <section className="bg-[#111b32] rounded-lg p-4 mb-0">
              <MarketOverview marketData={marketData} />
            </section>

            {/* Utilization */}
            <section className="bg-[#111b32] rounded-lg p-4 mt-0 mb-0">
              <UtilizationRatePanel utilization={marketData.utilization ?? 0} />
            </section>

            {/* Primary Actions */}
            <section className="bg-[#111b32] rounded-lg p-4 mt-0 mb-0">
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

            {/* Simulators */}
            <section className="bg-[#111b32] rounded-lg p-4 mt-0 mb-0">
              <HealthFactorSimulator userPosition={userPosition} marketData={marketData} />
            </section>

            <section className="bg-[#111b32] rounded-lg p-4 mt-0 mb-0">
              <EarningsCalculator userPosition={userPosition} marketData={marketData} />
            </section>

            {/* Collateral & Risk */}
            <section className="bg-[#111b32] rounded-lg p-4 mt-0 mb-0">
              <CollateralRiskPanel userPosition={userPosition} marketData={marketData} />
            </section>

            {/* Footer */}
            <MarketModalFooter asset={asset} />

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
