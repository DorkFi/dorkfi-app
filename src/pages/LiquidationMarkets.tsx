import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiquidationAccount } from "@/hooks/useLiquidationData";
import { mockLiquidationData } from "@/utils/liquidationUtils";
import EnhancedAccountDetailModal from "@/components/liquidation/EnhancedAccountDetailModal";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LiquidationHeroSection from "@/components/liquidation/LiquidationHeroSection";

import LiquidationQueueTable from "@/components/liquidation/LiquidationQueueTable";
import LiquidationPagination from "@/components/liquidation/LiquidationPagination";
import HorizontalSummaryCards from "@/components/liquidation/HorizontalSummaryCards";
import CanvasBubbles from "@/components/CanvasBubbles";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { getCurrentNetworkConfig } from "@/config";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import { CONTRACT } from "ulujs";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import { RefreshCw } from "lucide-react";

const ITEMS_PER_PAGE = 10;

interface UserHealthEvent {
  timestamp: number;
  round: number;
  user_id: string;
  health_factor: number;
  total_collateral_value: number;
  total_borrow_value: number;
}

interface LiquidationMarketsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export default function LiquidationMarkets({
  activeTab,
  onTabChange,
}: LiquidationMarketsProps) {
  const [accounts, setAccounts] = useState<LiquidationAccount[]>([]);
  const [selectedAccount, setSelectedAccount] =
    useState<LiquidationAccount | null>(null);
  const [initialStep, setInitialStep] = useState<"overview" | "step1">(
    "overview"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const isMobile = useIsMobile();

  // Function to transform health factor events into LiquidationAccount objects
  const transformHealthFactorToAccount = (
    healthEvent: UserHealthEvent
  ): LiquidationAccount => {
    // Values are already converted from micro-units in decodeHealthFactor
    const totalCollateralValue = healthEvent.total_collateral_value;
    const totalBorrowValue = healthEvent.total_borrow_value;
    
    // Calculate health factor based on actual collateral and borrow values
    const healthFactor = calculateHealthFactor(totalCollateralValue, totalBorrowValue);

    let riskLevel: "liquidatable" | "danger" | "moderate" | "safe";

    if (healthFactor <= 0.5) {
      riskLevel = "liquidatable";
    } else if (healthFactor <= 1.0) {
      riskLevel = "danger"; // critical
    } else if (healthFactor <= 1.2) {
      riskLevel = "danger"; // caution
    } else if (healthFactor <= 1.5) {
      riskLevel = "moderate";
    } else {
      riskLevel = "safe";
    }

    // Calculate LTV (Loan-to-Value) ratio
    const ltv =
      totalCollateralValue > 0
        ? (totalBorrowValue / totalCollateralValue) * 100
        : 0;

    return {
      id: healthEvent.user_id,
      walletAddress: healthEvent.user_id,
      healthFactor: healthFactor,
      liquidationMargin: Math.max(0, (healthFactor - 1) * 100), // Convert to percentage
      totalSupplied: totalCollateralValue,
      totalBorrowed: totalBorrowValue,
      ltv: ltv,
      riskLevel,
      collateralAssets: [], // Individual asset breakdown would need additional data
      borrowedAssets: [], // Individual asset breakdown would need additional data
      lastUpdated: healthEvent.timestamp.toString(), // Store Unix timestamp as string
    };
  };

  // Calculate health factor based on actual collateral and borrow values
  // Note: This is a simplified calculation for the main table
  // The detailed modal uses weighted collateral factors per asset
  const calculateHealthFactor = (totalCollateralValue: number, totalBorrowValue: number): number => {
    if (totalBorrowValue === 0) {
      // If no borrows, health factor is infinite (set to max safe value)
      return 3.0;
    }
    
    if (totalCollateralValue === 0) {
      // If no collateral but has borrows, health factor is 0
      return 0;
    }
    
    // Health factor = (collateralValue * collateralFactor) / totalBorrowed
    // Using 80% collateral factor (0.8) as standard for main table
    // Individual asset collateral factors are used in the detailed modal
    const collateralFactor = 0.8;
    const healthFactor = (totalCollateralValue * collateralFactor) / totalBorrowValue;
    
    // Cap at 3.0 for display purposes
    return Math.min(healthFactor, 3.0);
  };

  // Function to fetch liquidation data
  const fetchLiquidationData = async () => {
    const decodeHealthFactor = (event: any[]) => {
      return {
        timestamp: Number(event[2]),
        round: Number(event[1]),
        user_id: String(event[3]),
        // Health factor will be calculated based on actual collateral and borrow values
        health_factor: 0, // Placeholder, will be calculated
        total_collateral_value: new BigNumber(event[5])
          .div(new BigNumber(10).pow(12))
          .toNumber(),
        total_borrow_value: new BigNumber(event[6])
          .div(new BigNumber(10).pow(12))
          .toNumber(),
      } as UserHealthEvent;
    };
    const networkConfig = getCurrentNetworkConfig();
    const clients = algorandService.initializeClients(
      networkConfig.walletNetworkId as AlgorandNetwork
    );
    const ci = new CONTRACT(
      Number(networkConfig.contracts.lendingPools[0]),
      clients.algod,
      clients.indexer,
      {
        ...LendingPoolAppSpec.contract,
        events: [
          {
            name: "UserHealth",
            args: [
              {
                type: "address",
                name: "user_id",
              },
              {
                type: "uint256",
                name: "health_factor",
              },
              {
                type: "uint256",
                name: "total_collateral_value",
              },
              {
                type: "uint256",
                name: "total_borrow_value",
              },
            ],
          },
        ],
      },
      {
        addr: algosdk.getApplicationAddress(
          Number(networkConfig.contracts.lendingPools[0])
        ),
        sk: new Uint8Array(),
      }
    );
    const status = await clients.algod.status().do();
    const lastRound = status["last-round"];
    const events: any = await ci.getEvents({
      minRound: Math.max(0, lastRound - 2e6),
    });
    const allUserHealthEvents =
      events
        .find((event: any) => event.name === "UserHealth")
        ?.events?.map(decodeHealthFactor) ?? [];

    // Reduce to latest health factor by userId
    const userHealthEvents = allUserHealthEvents.reduce((latest, current) => {
      const existing = latest.get(current.user_id);
      if (!existing || current.timestamp > existing.timestamp) {
        latest.set(current.user_id, current);
      }
      return latest;
    }, new Map<string, UserHealthEvent>());

    const latestHealthFactors = Array.from(userHealthEvents.values());
    console.log("latestHealthFactors", latestHealthFactors);

    // Transform health factor events into LiquidationAccount objects
    const transformedAccounts = latestHealthFactors.map(
      transformHealthFactorToAccount
    );

    // Sort by health factor (most at risk first)
    transformedAccounts.sort((a, b) => a.healthFactor - b.healthFactor);

    setAccounts(transformedAccounts);
  };

  // Sync function to refresh data
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetchLiquidationData();
    } catch (error) {
      console.error("Error syncing liquidation data:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchLiquidationData();
      } catch (error) {
        console.error("Error loading liquidation data:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Calculate stats for the layout
  const totalLiquidated24h = 2450000; // This would need to be calculated from liquidation events
  const atRiskWallets = accounts.filter(
    (acc) => acc.healthFactor <= 1.2
  ).length;
  const activeLiquidationEvents = accounts.filter(
    (acc) => acc.riskLevel === "liquidatable"
  ).length;
  const totalActiveWallets = accounts.length; // Total unique wallets with health factor data

  // Pagination for table
  const totalPages = Math.ceil(accounts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAccounts = accounts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handleAccountClick = (account: LiquidationAccount) => {
    setSelectedAccount(account);
    setInitialStep("overview");
  };

  const handleLiquidateNow = (account: LiquidationAccount) => {
    setSelectedAccount(account);
    setInitialStep("step1");
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

          {/* Summary Cards */}
          <HorizontalSummaryCards
            totalLiquidated24h={totalLiquidated24h}
            atRiskWallets={atRiskWallets}
            activeLiquidationEvents={totalActiveWallets}
          />

          {/* Liquidation Queue Table */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    Loading liquidation data...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Sync Button */}
                <div className="flex justify-end mb-4">
                  <DorkFiButton
                    variant="secondary"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Data'}
                  </DorkFiButton>
                </div>

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
              </>
            )}
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

      <Footer />
    </div>
  );
}
