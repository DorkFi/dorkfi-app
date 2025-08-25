
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { mockLiquidationData } from '@/utils/liquidationUtils';
import EnhancedAccountDetailModal from '@/components/liquidation/EnhancedAccountDetailModal';
import Header from '@/components/Header';
import LiquidationHeroSection from '@/components/liquidation/LiquidationHeroSection';
import LiquidityRiskOverview from '@/components/liquidation/LiquidityRiskOverview';

import ScrollTransitionCue from '@/components/liquidation/ScrollTransitionCue';
import LiquidationQueueTable from '@/components/liquidation/LiquidationQueueTable';
import LiquidationPagination from '@/components/liquidation/LiquidationPagination';
import HorizontalSummaryCards from '@/components/liquidation/HorizontalSummaryCards';
import CanvasBubbles from '@/components/CanvasBubbles';

const ITEMS_PER_PAGE = 10;

interface LiquidationMarketsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export default function LiquidationMarkets({ activeTab, onTabChange }: LiquidationMarketsProps) {
  const [accounts, setAccounts] = useState<LiquidationAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LiquidationAccount | null>(null);
  const [initialStep, setInitialStep] = useState<'overview' | 'step1'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  
  const isMobile = useIsMobile();

  // Mock data fetching
  useEffect(() => {
    setAccounts(mockLiquidationData);
  }, []);

  // Calculate stats for the layout
  const totalLiquidated24h = 2450000;
  const atRiskWallets = accounts.filter(acc => acc.healthFactor <= 1.1).length;
  const activeLiquidationEvents = 47;

  // Pagination for table
  const totalPages = Math.ceil(accounts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAccounts = accounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleAccountClick = (account: LiquidationAccount) => {
    setSelectedAccount(account);
    setInitialStep('overview');
  };

  const handleLiquidateNow = (account: LiquidationAccount) => {
    setSelectedAccount(account);
    setInitialStep('step1');
  };

  const closeModal = () => {
    setSelectedAccount(null);
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      
      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      {/* Advanced Canvas Bubble System - Dark Mode Only */}
      <div className="hidden dark:block">
        <CanvasBubbles />
      </div>

      <Header activeTab={activeTab} onTabChange={onTabChange} />
      
      <main className="max-w-[1400px] mx-auto px-4 py-6 md:py-8 relative z-10">
        <div className="space-y-6">
          {/* Hero Section */}
          <LiquidationHeroSection />

          {/* New Charts Section */}
          <LiquidityRiskOverview />

          {/* Summary Cards */}
          <HorizontalSummaryCards
            totalLiquidated24h={totalLiquidated24h}
            atRiskWallets={atRiskWallets}
            activeLiquidationEvents={activeLiquidationEvents}
          />

          {/* Scroll Transition Cue */}
          <ScrollTransitionCue />

          {/* Liquidation Queue Table */}
          <div className="space-y-6">
            <LiquidationQueueTable 
              accounts={paginatedAccounts}
              onAccountClick={handleAccountClick}
              onLiquidateNow={handleLiquidateNow}
            />

            {/* Pagination */}
            <LiquidationPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isMobile={isMobile}
            />
          </div>


          {/* Account Detail Modal */}
            {selectedAccount && (
              <EnhancedAccountDetailModal
                account={selectedAccount}
                isOpen={!!selectedAccount}
                onClose={closeModal}
                isMobile={isMobile}
                initialStep={initialStep}
              />
            )}
        </div>
      </main>
    </div>
  );
}
