import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { getAllTokensWithDisplayInfo, getTokenConfig } from "@/config";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

import {
  useOnDemandMarketData,
  SortField,
  SortOrder,
} from "@/hooks/useOnDemandMarketData";
import MarketSearchFilters from "@/components/markets/MarketSearchFilters";
import MarketPagination from "@/components/markets/MarketPagination";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import WithdrawModal from "@/components/WithdrawModal";
import MarketDetailModal from "@/components/MarketDetailModal";
import MintModal from "@/components/MintModal";
import MarketsHeroSection from "@/components/markets/MarketsHeroSection";
import MarketsTableContent from "@/components/markets/MarketsTableContent";
import {
  fetchUserGlobalData,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
} from "@/services/lendingService";

const MarketsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalSupplyUSD");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [depositModal, setDepositModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [withdrawModal, setWithdrawModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [borrowModal, setBorrowModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [mintModal, setMintModal] = useState({ isOpen: false, asset: null });
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    asset: null,
    marketData: null,
  });
  const [walletBalances, setWalletBalances] = useState<
    Record<string, { balance: number; balanceUSD: number }>
  >({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [userBorrowBalance, setUserBorrowBalance] = useState<number>(0);
  const [userDepositBalance, setUserDepositBalance] = useState<number>(0);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(false);

  // Mock user deposits - in real app, this would come from user's wallet/backend
  const [userDeposits] = useState<Record<string, number>>({});

  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  const {
    data: markets,
    totalItems,
    totalPages,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handleSortChange,
    loadMarketData,
    loadMarketDataWithBypass,
    loadVisibleMarkets,
    loadAllMarkets,
    isLoading,
    marketsData,
  } = useOnDemandMarketData({
    searchTerm,
    sortField,
    sortOrder,
    pageSize: 10,
    autoLoad: true,
  });

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    handleSearchChange(value);
  };

  const handleSortFieldChange = (field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
    handleSortChange(field, order);
  };

  const handleDepositClick = async (asset: string) => {
    setIsLoadingBalance(true);

    try {
      // Fetch wallet balance before opening modal
      await fetchWalletBalance(asset);

      // Fetch user's existing deposit balance for this asset
      if (activeAccount?.address) {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const depositBalance = await fetchUserDepositBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserDepositBalance(depositBalance || 0);
        } else {
          setUserDepositBalance(0);
        }
      } else {
        setUserDepositBalance(0);
      }

      // Open modal after balance is fetched
      setDepositModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching wallet balance for deposit:", error);
      // Still open modal even if balance fetch fails
      setDepositModal({ isOpen: true, asset });
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleWithdrawClick = (asset: string) => {
    setWithdrawModal({ isOpen: true, asset });
  };

  const handleBorrowClick = async (asset: string) => {
    setIsLoadingGlobalData(true);

    try {
      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } else {
        // Not connected, set empty data
        setUserGlobalData(null);
        setUserBorrowBalance(0);
      }

      // Open modal regardless of connection status
      setBorrowModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching user data for borrow:", error);
      // Still open modal even if data fetch fails
      setBorrowModal({ isOpen: true, asset });
    } finally {
      setIsLoadingGlobalData(false);
    }
  };

  const handleMintClick = async (asset: string) => {
    setIsLoadingGlobalData(true);

    try {
      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } else {
        // Not connected, set empty data
        setUserGlobalData(null);
        setUserBorrowBalance(0);
      }

      // Open modal regardless of connection status
      setMintModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching user data for mint:", error);
      // Still open modal even if data fetch fails
      setMintModal({ isOpen: true, asset });
    } finally {
      setIsLoadingGlobalData(false);
    }
  };

  const handleCloseDepositModal = () => {
    const asset = depositModal.asset;
    setDepositModal({ isOpen: false, asset: null });

    // Refresh market data and wallet balance after deposit
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh wallet balance to show updated amount after deposit
      refreshWalletBalance(asset);
    }
  };

  const handleCloseWithdrawModal = () => {
    setWithdrawModal({ isOpen: false, asset: null });
  };

  const handleCloseBorrowModal = () => {
    const asset = borrowModal.asset;
    setBorrowModal({ isOpen: false, asset: null });

    // Refresh market data and user global data after borrow
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  // Fetch user data when wallet connects while borrow modal is open
  useEffect(() => {
    if (borrowModal.isOpen && borrowModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(activeAccount.address, currentNetwork);
          setUserGlobalData(globalData);
          
          const tokens = getAllTokensWithDisplayInfo(currentNetwork);
          const token = tokens.find((t) => t.symbol === borrowModal.asset);
          
          if (token && token.poolId && token.underlyingContractId) {
            const borrowData = await fetchUserBorrowBalance(
              activeAccount.address,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            );
            setUserBorrowBalance(borrowData?.balance || 0);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      
      fetchData();
    }
  }, [activeAccount?.address, borrowModal.isOpen, borrowModal.asset, currentNetwork]);

  // Fetch user data when wallet connects while mint modal is open
  useEffect(() => {
    if (mintModal.isOpen && mintModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(activeAccount.address, currentNetwork);
          setUserGlobalData(globalData);
          
          const tokens = getAllTokensWithDisplayInfo(currentNetwork);
          const token = tokens.find((t) => t.symbol === mintModal.asset);
          
          if (token && token.poolId && token.underlyingContractId) {
            const borrowData = await fetchUserBorrowBalance(
              activeAccount.address,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            );
            setUserBorrowBalance(borrowData?.balance || 0);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      
      fetchData();
    }
  }, [activeAccount?.address, mintModal.isOpen, mintModal.asset, currentNetwork]);

  const handleCloseMintModal = () => {
    const asset = mintModal.asset;
    setMintModal({ isOpen: false, asset: null });

    // Refresh market data and user global data after mint
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  const handleRowClick = (market: any) => {
    setDetailModal({ isOpen: true, asset: market.asset, marketData: market });
  };

  const handleInfoClick = (e: React.MouseEvent, market: any) => {
    e.stopPropagation();
    setDetailModal({ isOpen: true, asset: market.asset, marketData: market });
  };

  const handleCloseDetailModal = () => {
    setDetailModal({ isOpen: false, asset: null, marketData: null });
  };

  // Load all markets when component mounts
  useEffect(() => {
    loadAllMarkets();
  }, [loadAllMarkets]);

  // Clear wallet balance cache and user global data when wallet address changes
  useEffect(() => {
    setWalletBalances({});
    setUserGlobalData(null);
  }, [activeAccount?.address]);

  // Handle refresh button click
  const handleRefresh = () => {
    loadAllMarkets();
  };

  // Refresh wallet balance for a specific asset (clears cache and refetches)
  const refreshWalletBalance = async (asset: string) => {
    // Clear the cached balance for this asset
    setWalletBalances((prev) => {
      const newBalances = { ...prev };
      delete newBalances[asset];
      return newBalances;
    });

    // Fetch fresh balance
    await fetchWalletBalance(asset);
  };

  // Refresh user global data (clears cache and refetches)
  const refreshUserGlobalData = async () => {
    if (!activeAccount?.address) return;

    try {
      const globalData = await fetchUserGlobalData(
        activeAccount.address,
        currentNetwork
      );
      setUserGlobalData(globalData);
    } catch (error) {
      console.error("Error refreshing user global data:", error);
    }
  };

  // Fetch wallet balance for a specific asset
  const fetchWalletBalance = async (asset: string) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Check if we already have this balance cached
    if (walletBalances[asset]) {
      return walletBalances[asset];
    }

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);

      if (!token) {
        console.error(`Token ${asset} not found in network config`);
        return { balance: 0, balanceUSD: 0 };
      }

      // Get the original token config to access tokenStandard
      const originalTokenConfig = getTokenConfig(currentNetwork, asset);
      if (!originalTokenConfig) {
        console.error(`Original token config not found for ${asset}`);
        return { balance: 0, balanceUSD: 0 };
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      let balance = 0;

      // Handle different token standards
      if (
        originalTokenConfig.tokenStandard === "arc200" &&
        token.underlyingContractId
      ) {
        // Fetch ARC200 token balance
        console.log(
          `Fetching ARC200 balance for ${asset} (contract: ${token.underlyingContractId})`
        );
        const arc200Balance = await ARC200Service.getBalance(
          activeAccount.address,
          token.underlyingContractId
        );

        if (arc200Balance) {
          // Convert from smallest units to human readable format
          balance = parseFloat(
            ARC200Service.formatBalance(
              arc200Balance,
              originalTokenConfig.decimals
            )
          );
          console.log(`ARC200 balance for ${asset}: ${balance}`);
        } else {
          console.log(`No ARC200 balance found for ${asset}`);
          balance = 0;
        }
      } else if (originalTokenConfig.tokenStandard === "network") {
        // For network tokens (like VOI), fetch native balance
        console.log(`Fetching network token balance for ${asset}`);
        try {
          const clients = await algorandService.getCurrentClientsForReads();
          const accountInfo = await clients.algod
            .accountInformation(activeAccount.address)
            .do();
          // Convert from micro-units to units (divide by 1,000,000)
          balance = accountInfo.amount / 1_000_000;
          console.log(`Network token balance for ${asset}: ${balance}`);
        } catch (error) {
          console.error(
            `Error fetching network token balance for ${asset}:`,
            error
          );
          balance = 0;
        }
      } else if (
        originalTokenConfig.tokenStandard === "asa" &&
        token.underlyingAssetId
      ) {
        // For ASA tokens, fetch asset balance
        console.log(
          `Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`
        );
        try {
          const clients = await algorandService.getCurrentClientsForReads();
          const accountInfo = await clients.algod
            .accountInformation(activeAccount.address)
            .do();

          // Find the asset in the account's assets
          const assetId = parseInt(token.underlyingAssetId);
          const assetHolding = accountInfo.assets?.find(
            (asset: any) => asset["asset-id"] === assetId
          );

          if (assetHolding) {
            // Convert from smallest units to human readable format
            balance =
              assetHolding.amount / Math.pow(10, originalTokenConfig.decimals);
            console.log(`ASA balance for ${asset}: ${balance}`);
          } else {
            console.log(`No ASA balance found for ${asset}`);
            balance = 0;
          }
        } catch (error) {
          console.error(`Error fetching ASA balance for ${asset}:`, error);
          balance = 0;
        }
      } else {
        console.log(
          `Unsupported token standard for ${asset}: ${originalTokenConfig.tokenStandard}`
        );
        balance = 0;
      }

      // Calculate USD value
      const market = markets.find((m) => m.asset === asset);
      const tokenPrice = market ? ((market.totalSupplyUSD / market.totalSupply) || 1) / 10 ** 6 : 1;
      const balanceUSD = balance * tokenPrice;

      console.log({
        balance,
        tokenPrice,
        balanceUSD,
      })

      const balanceData = {
        balance,
        balanceUSD,
      };

      setWalletBalances((prev) => ({
        ...prev,
        [asset]: balanceData,
      }));

      console.log(`Final balance data for ${asset}:`, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  const getAssetData = (asset: string) => {
    const market = markets.find((m) => m.asset === asset);
    if (!market) return null;

    return {
      icon: market.icon,
      totalSupply: market.totalSupply,
      totalSupplyUSD: market.totalSupplyUSD,
      supplyAPY: market.supplyAPY,
      totalBorrow: market.totalBorrow,
      totalBorrowUSD: market.totalBorrowUSD,
      borrowAPY: market.borrowAPY,
      utilization: market.utilization,
      collateralFactor: market.collateralFactor,
      liquidity: market.totalSupply - market.totalBorrow,
      liquidityUSD: market.totalSupplyUSD - market.totalBorrowUSD,
      reserveFactor: market.reserveFactor,
      apyCalculation: market.apyCalculation,
      maxTotalDeposits: market.supplyCap,
      isSToken: market.isSToken,
    };
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4">
      <div className="space-y-4">
        {/* Hero Section */}
        <MarketsHeroSection />

        {/* Search and Filters */}
        <MarketSearchFilters
          searchTerm={searchTerm}
          onSearchChange={handleSearchTermChange}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleSortFieldChange}
        />

        {/* Markets Table */}
        <Card className="card-hover bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 shadow-md border border-gray-200/50 dark:border-ocean-teal/20">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                Market Overview
                {isLoading && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Loading...)
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600 dark:bg-blue-950 dark:border-blue-800 dark:hover:bg-blue-900 dark:text-blue-400"
                  aria-label="Refresh market data"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      "https://docs.dork.fi",
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  className="flex items-center gap-2 bg-ocean-teal/5 border-ocean-teal/20 hover:bg-ocean-teal/10 text-ocean-teal"
                  aria-label="Learn more about markets (opens in new tab)"
                >
                  Learn More
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Informational guidance - matches Liquidations Queue styles */}
            <section
              aria-label="What you can do here"
              className="mb-4 hidden md:block"
            >
              <p className="text-sm text-muted-foreground mt-1">
                What You Can Do Here:
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  • Deposit Assets: Earn interest with interest bearing tokens
                  that grow in value over time.
                </p>
                <p>
                  • Borrow Against Collateral: Access liquidity without selling
                  your holdings.
                </p>
                <p>
                  • Track Utilization: See how much of each market is borrowed
                  vs. supplied — a key signal for demand and interest rates.
                </p>
                <p>
                  • Compare Risk Profiles: Different assets have different
                  Loan-to-Value (LTV) limits and liquidation thresholds.
                </p>
              </div>
            </section>

            {markets.length === 0 && !isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No markets found. Try adjusting your search criteria.
                </p>
              </div>
            ) : (
              <MarketsTableContent
                markets={markets}
                onRowClick={handleRowClick}
                onInfoClick={handleInfoClick}
                onDepositClick={handleDepositClick}
                onWithdrawClick={handleWithdrawClick}
                onBorrowClick={handleBorrowClick}
                onMintClick={handleMintClick}
                isLoadingBalance={isLoadingBalance}
              />
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <MarketPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
        />

        {/* Market Detail Modal */}
        {detailModal.isOpen && detailModal.asset && detailModal.marketData && (
          <MarketDetailModal
            isOpen={detailModal.isOpen}
            onClose={handleCloseDetailModal}
            asset={detailModal.asset}
            marketData={detailModal.marketData}
          />
        )}

        {/* Deposit Modal */}
        {depositModal.isOpen &&
          depositModal.asset &&
          getAssetData(depositModal.asset) && (
            <SupplyBorrowModal
              isOpen={depositModal.isOpen}
              onClose={handleCloseDepositModal}
              asset={depositModal.asset}
              mode="deposit"
              assetData={getAssetData(depositModal.asset)}
              walletBalance={walletBalances[depositModal.asset]?.balance || 0}
              walletBalanceUSD={
                walletBalances[depositModal.asset]?.balanceUSD || 0
              }
              userDepositBalance={userDepositBalance}
              onTransactionSuccess={() => {
                // Refresh wallet balance immediately after successful transaction
                if (depositModal.asset) {
                  refreshWalletBalance(depositModal.asset);
                }
              }}
            />
          )}

        {/* Withdraw Modal */}
        {withdrawModal.isOpen &&
          withdrawModal.asset &&
          getAssetData(withdrawModal.asset) && (
            <WithdrawModal
              isOpen={withdrawModal.isOpen}
              onClose={handleCloseWithdrawModal}
              tokenSymbol={withdrawModal.asset}
              tokenIcon={getAssetData(withdrawModal.asset).icon}
              currentlyDeposited={1000}
              marketStats={{
                supplyAPY: getAssetData(withdrawModal.asset).supplyAPY,
                utilization: getAssetData(withdrawModal.asset).utilization,
                collateralFactor: getAssetData(withdrawModal.asset)
                  .collateralFactor,
                tokenPrice: 1.0,
              }}
            />
          )}

        {/* Borrow Modal */}
        {borrowModal.isOpen &&
          borrowModal.asset &&
          getAssetData(borrowModal.asset) && (
            <SupplyBorrowModal
              isOpen={borrowModal.isOpen}
              onClose={handleCloseBorrowModal}
              asset={borrowModal.asset}
              mode="borrow"
              assetData={getAssetData(borrowModal.asset)}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              onTransactionSuccess={() => {
                // Refresh market data after successful borrow
                if (borrowModal.asset) {
                  loadMarketDataWithBypass(borrowModal.asset.toLowerCase());
                }
              }}
            />
          )}

        {/* Mint Modal */}
        {mintModal.isOpen &&
          mintModal.asset &&
          getAssetData(mintModal.asset) && (
            <MintModal
              isOpen={mintModal.isOpen}
              onClose={handleCloseMintModal}
              asset={mintModal.asset}
              assetData={getAssetData(mintModal.asset)}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              onTransactionSuccess={() => {
                // Refresh market data after successful mint
                if (mintModal.asset) {
                  loadMarketDataWithBypass(mintModal.asset.toLowerCase());
                }
              }}
            />
          )}
      </div>
    </div>
  );
};

export default MarketsTable;
