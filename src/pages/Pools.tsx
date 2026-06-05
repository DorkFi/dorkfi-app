import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, RefreshCw } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { H1, Body } from "@/components/ui/Typography";
import LiquidityPoolCardContainer from "@/components/pools/LiquidityPoolCardContainer";
import PoolsLendingGlobalSummary from "@/components/pools/PoolsLendingGlobalSummary";
import PoolsWadBorrowSection from "@/components/pools/PoolsWadBorrowSection";
import PoolsTokenFilter from "@/components/pools/PoolsTokenFilter";
import {
  countPoolsByBaseTokenFilter,
  getCuratedLiquidityPoolsForNetwork,
  getPoolBaseTokenFilterAssetId,
  poolMatchesBaseTokenFilter,
  POOL_BASE_TOKEN_FILTERS,
  resolvePoolCWadMarket,
  resolvePoolEWadMarket,
  resolvePoolFWadMarket,
  resolveUnitLendingPoolIdsForFilter,
  resolveUsdcLendingPoolIdsForFilter,
  resolveWadLendingPoolIdsForFilter,
  type PoolBaseTokenFilterId,
} from "@/constants/liquidityPools";
import {
  useInvalidateLiquidityPools,
  useLiquidityPoolsOrderedByApr,
  usePoolsLendingGlobalSummary,
} from "@/hooks/useLiquidityPoolData";
import { useNetwork } from "@/contexts/NetworkContext";
import { tinymanNetworkFromNetworkId } from "@/services/tinymanLiquidityService";
import type { NetworkId } from "@/config";

interface PoolsPageProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const PoolsPage = ({ activeTab, onTabChange }: PoolsPageProps) => {
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();
  const queryClient = useQueryClient();
  const [tokenFilter, setTokenFilter] = useState<PoolBaseTokenFilterId>("all");
  const pairs = useMemo(
    () => getCuratedLiquidityPoolsForNetwork(currentNetwork),
    [currentNetwork]
  );
  const filterCounts = useMemo(() => countPoolsByBaseTokenFilter(pairs), [pairs]);
  const filteredPairs = useMemo(() => {
    const filterAssetId = getPoolBaseTokenFilterAssetId(tokenFilter);
    return pairs.filter((pair) => poolMatchesBaseTokenFilter(pair, filterAssetId));
  }, [pairs, tokenFilter]);
  const orderedPairs = useLiquidityPoolsOrderedByApr(filteredPairs);
  const invalidatePools = useInvalidateLiquidityPools(pairs);
  const tinymanSupported = tinymanNetworkFromNetworkId(currentNetwork) != null;
  const filterSymbol =
    POOL_BASE_TOKEN_FILTERS.find((f) => f.id === tokenFilter)?.symbol ??
    tokenFilter.toUpperCase();
  const lendingPoolIds = useMemo(() => {
    const networkId = currentNetwork as NetworkId;
    if (tokenFilter === "unit") {
      return resolveUnitLendingPoolIdsForFilter(networkId, filteredPairs);
    }
    if (tokenFilter === "wad") {
      return resolveWadLendingPoolIdsForFilter(networkId, filteredPairs);
    }
    if (tokenFilter === "usdc") {
      return resolveUsdcLendingPoolIdsForFilter(networkId, filteredPairs);
    }
    return [];
  }, [currentNetwork, filteredPairs, tokenFilter]);
  const showLendingGlobalSummary = lendingPoolIds.length > 0;
  const poolsWadBorrowMarket = useMemo(() => {
    const networkId = currentNetwork as NetworkId;
    if (tokenFilter === "unit") return resolvePoolCWadMarket(networkId);
    if (tokenFilter === "wad") return resolvePoolEWadMarket(networkId);
    if (tokenFilter === "usdc") return resolvePoolFWadMarket(networkId);
    return null;
  }, [currentNetwork, tokenFilter]);
  const wadBorrowCollateralLabel =
    tokenFilter === "wad"
      ? "WAD LP"
      : tokenFilter === "usdc"
        ? "USDC LP"
        : "UNIT LP";
  const { summary, poolIds, isLoading: lendingGlobalLoading } =
    usePoolsLendingGlobalSummary(
      currentNetwork as NetworkId,
      lendingPoolIds,
      activeAccount?.address,
      showLendingGlobalSummary
    );
  const canBorrowWad = (summary?.totalCollateralValue ?? 0) > 0;
  const showWadBorrowSection =
    (tokenFilter === "unit" ||
      tokenFilter === "wad" ||
      tokenFilter === "usdc") &&
    poolsWadBorrowMarket != null &&
    Boolean(activeAccount?.address);

  const invalidateLendingSummary = () => {
    const networkId = currentNetwork as NetworkId;
    for (const poolId of lendingPoolIds) {
      void queryClient.invalidateQueries({
        queryKey: ["pools-lending-global", networkId, poolId, activeAccount?.address],
      });
    }
  };

  useEffect(() => {
    setTokenFilter("all");
  }, [currentNetwork]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header activeTab={activeTab} onTabChange={onTabChange} />

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 py-6 md:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-ocean-teal">
              <Droplets className="h-6 w-6" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Liquidity
              </span>
            </div>
            <H1>Liquidity Pools</H1>
            <Body className="max-w-2xl text-muted-foreground">
              Deposit into curated pairs to earn trading fees.
              Withdraw your available LP tokens any time.
            </Body>
          </div>
          <DorkFiButton
            variant="secondary"
            onClick={invalidatePools}
            disabled={!tinymanSupported || pairs.length === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh
          </DorkFiButton>
        </div>

        {!tinymanSupported ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Liquidity pools are available on Algorand mainnet and testnet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Switch your network to Algorand to view and manage pool positions.
            </p>
          </div>
        ) : pairs.length === 0 ? (
          <div className="rounded-xl border px-4 py-6 text-center text-muted-foreground">
            No curated pools are configured for this network yet.
          </div>
        ) : (
          <>
            <PoolsTokenFilter
              value={tokenFilter}
              onChange={setTokenFilter}
              counts={filterCounts}
              className="mb-4"
            />
            {showLendingGlobalSummary ? (
              <PoolsLendingGlobalSummary
                filterSymbol={filterSymbol}
                networkId={currentNetwork as NetworkId}
                summary={summary}
                poolIds={poolIds}
                isLoading={lendingGlobalLoading}
                walletConnected={Boolean(activeAccount?.address)}
              />
            ) : null}
            {showWadBorrowSection && poolsWadBorrowMarket ? (
              <PoolsWadBorrowSection
                networkId={currentNetwork as NetworkId}
                wadMarket={poolsWadBorrowMarket}
                collateralLabel={wadBorrowCollateralLabel}
                summary={summary}
                canBorrow={canBorrowWad}
                onBorrowSuccess={invalidateLendingSummary}
              />
            ) : null}
            {orderedPairs.length === 0 ? (
              <div className="rounded-xl border px-4 py-6 text-center text-muted-foreground">
                No pools match this token filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orderedPairs.map((pair) => (
                  <LiquidityPoolCardContainer
                    key={pair.id}
                    pair={pair}
                    onLendingSuccess={invalidateLendingSummary}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PoolsPage;
