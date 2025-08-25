
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

import { useMarketData, SortField, SortOrder } from "@/hooks/useMarketData";
import MarketSearchFilters from "@/components/markets/MarketSearchFilters";
import MarketPagination from "@/components/markets/MarketPagination";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import MarketDetailModal from "@/components/MarketDetailModal";
import MarketsHeroSection from "@/components/markets/MarketsHeroSection";
import MarketsTableContent from "@/components/markets/MarketsTableContent";

const MarketsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalSupplyUSD");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [depositModal, setDepositModal] = useState({ isOpen: false, asset: null });
  const [borrowModal, setBorrowModal] = useState({ isOpen: false, asset: null });
  const [detailModal, setDetailModal] = useState({ isOpen: false, asset: null, marketData: null });

  const {
    data: markets,
    totalItems,
    totalPages,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handleSortChange
  } = useMarketData({
    searchTerm,
    sortField,
    sortOrder,
    pageSize: 10
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

  const handleDepositClick = (asset: string) => {
    setDepositModal({ isOpen: true, asset });
  };

  const handleBorrowClick = (asset: string) => {
    setBorrowModal({ isOpen: true, asset });
  };

  const handleCloseDepositModal = () => {
    setDepositModal({ isOpen: false, asset: null });
  };

  const handleCloseBorrowModal = () => {
    setBorrowModal({ isOpen: false, asset: null });
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

  const getAssetData = (asset: string) => {
    const market = markets.find(m => m.asset === asset);
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
              <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">Market Overview</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://docs.dork.fi/markets', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 bg-ocean-teal/5 border-ocean-teal/20 hover:bg-ocean-teal/10 text-ocean-teal"
                aria-label="Learn more about markets (opens in new tab)"
              >
                Learn More
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Informational guidance - matches Liquidations Queue styles */}
            <section aria-label="What you can do here" className="mb-4 hidden md:block">
              <p className="text-sm text-muted-foreground mt-1">What You Can Do Here:</p>
              <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p>• Deposit Assets: Earn interest with interest bearing tokens that grow in value over time.</p>
                <p>• Borrow Against Collateral: Access liquidity without selling your holdings.</p>
                <p>• Track Utilization: See how much of each market is borrowed vs. supplied — a key signal for demand and interest rates.</p>
                <p>• Compare Risk Profiles: Different assets have different Loan-to-Value (LTV) limits and liquidation thresholds.</p>
              </div>
            </section>

            <MarketsTableContent
              markets={markets}
              onRowClick={handleRowClick}
              onInfoClick={handleInfoClick}
              onDepositClick={handleDepositClick}
              onBorrowClick={handleBorrowClick}
            />
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
        {depositModal.isOpen && depositModal.asset && getAssetData(depositModal.asset) && (
          <SupplyBorrowModal
            isOpen={depositModal.isOpen}
            onClose={handleCloseDepositModal}
            asset={depositModal.asset}
            mode="deposit"
            assetData={getAssetData(depositModal.asset)}
          />
        )}

        {/* Borrow Modal */}
        {borrowModal.isOpen && borrowModal.asset && getAssetData(borrowModal.asset) && (
          <SupplyBorrowModal
            isOpen={borrowModal.isOpen}
            onClose={handleCloseBorrowModal}
            asset={borrowModal.asset}
            mode="borrow"
            assetData={getAssetData(borrowModal.asset)}
          />
        )}
      </div>
    </div>
  );
};

export default MarketsTable;
