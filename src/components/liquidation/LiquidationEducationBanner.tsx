import React from 'react';
import { Info, ExternalLink } from 'lucide-react';
import DorkFiCard from '@/components/ui/DorkFiCard';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { H3, Body } from '@/components/ui/Typography';

export default function LiquidationEducationBanner() {
  return (
    <DorkFiCard className="bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-slate-900/80 dark:to-slate-800/80 border-blue-200/50 dark:border-ocean-teal/20">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start md:items-center">
        {/* Content Section */}
        <div className="md:col-span-9 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <H3 className="text-lg font-semibold text-slate-800 dark:text-white">
              What is Liquidation?
            </H3>
            <Info className="h-4 w-4 text-ocean-teal/70" />
          </div>
          
          {/* Body Text */}
          <div className="space-y-2">
            <Body className="text-slate-700 dark:text-slate-300">
              Borrowers who fail to maintain enough collateral are at risk of liquidation.
            </Body>
            <Body className="text-slate-700 dark:text-slate-300">
              Liquidators repay part of their debt and receive discounted collateral as a reward.
            </Body>
            <Body className="text-slate-700 dark:text-slate-300">
              Stay sharp — snipe bad debt and earn yield while helping keep the system healthy.
            </Body>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="md:col-span-3 flex justify-start md:justify-end">
          <DorkFiButton
            variant="primary"
            className="flex items-center gap-2 px-6"
            onClick={() => window.open('https://docs.dork.fi/liquidations', '_blank', 'noopener,noreferrer')}
            aria-label="Learn more about liquidations (opens in new tab)"
          >
            Learn More
            <ExternalLink className="h-3 w-3" />
          </DorkFiButton>
        </div>
      </div>
    </DorkFiCard>
  );
}