import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  resolvePoolsPageLendingMarket,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import { fetchUserDepositBalance } from "@/services/lendingService";
import {
  fetchPactTierSnapshot,
  type PactTierSnapshot,
} from "@/services/pactLiquidityService";
import { fetchAlgorandAssetBalance } from "@/services/tinymanLiquidityService";
import PactFeeTierCard from "./PactFeeTierCard";
import PoolLendingModals from "./PoolLendingModals";

interface PactFeeTierCardContainerProps {
  pairs: LiquidityPoolPairConfig[];
  onLendingSuccess?: () => void;
}

const PactFeeTierCardContainer = ({
  pairs,
  onLendingSuccess,
}: PactFeeTierCardContainerProps) => {
  const { activeAccount } = useWallet();
  const address = activeAccount?.address;
  const [activePairId, setActivePairId] = useState<string | null>(pairs[0]?.id ?? null);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const snapshotQueries = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: ["pact-tier-snapshot", pair.id, pair.networkId],
      queryFn: () => fetchPactTierSnapshot(pair),
      staleTime: 30_000,
    })),
  });

  const balanceQueries = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: ["algorand-asset-balance", pair.networkId, address, pair.lpTokenId],
      queryFn: () => fetchAlgorandAssetBalance(pair.networkId, address!, pair.lpTokenId),
      enabled: Boolean(address),
      staleTime: 20_000,
    })),
  });

  const markets = useMemo(
    () => pairs.map((pair) => resolvePoolsPageLendingMarket(pair.networkId, pair)),
    [pairs]
  );

  const suppliedQueries = useQueries({
    queries: pairs.map((pair, index) => {
      const market = markets[index];
      return {
        queryKey: [
          "pool-pair-supplied-balance",
          pair.networkId,
          pair.id,
          market?.marketId,
          address,
        ],
        queryFn: () =>
          fetchUserDepositBalance(address!, market!.poolId, market!.marketId, pair.networkId),
        enabled: Boolean(address && market),
        staleTime: 20_000,
      };
    }),
  });

  const tiers = pairs.map((pair, index) => ({
    pair,
    snapshot: snapshotQueries[index]?.data as PactTierSnapshot | null | undefined,
    loading: snapshotQueries[index]?.isLoading ?? false,
    lendingMarket: markets[index],
    walletLpBalance: Number(balanceQueries[index]?.data ?? 0n) / 1e6,
    suppliedLpBalance: suppliedQueries[index]?.data ?? 0,
  }));

  const activeIndex = Math.max(
    0,
    pairs.findIndex((pair) => pair.id === activePairId)
  );
  const activePair = pairs[activeIndex];
  const activeMarket = markets[activeIndex];

  const openSupply = (pair: LiquidityPoolPairConfig) => {
    setActivePairId(pair.id);
    setSupplyOpen(true);
  };
  const openWithdraw = (pair: LiquidityPoolPairConfig) => {
    setActivePairId(pair.id);
    setWithdrawOpen(true);
  };

  return (
    <>
      <PactFeeTierCard tiers={tiers} onSupply={openSupply} onWithdraw={openWithdraw} />
      {activePair && activeMarket ? (
        <PoolLendingModals
          pair={activePair}
          lendingMarket={activeMarket}
          supplyOpen={supplyOpen}
          withdrawOpen={withdrawOpen}
          onCloseSupply={() => setSupplyOpen(false)}
          onCloseWithdraw={() => setWithdrawOpen(false)}
          onSuccess={onLendingSuccess}
          initialWalletLpBalance={tiers[activeIndex]?.walletLpBalance ?? 0}
          lpAssetId={activePair.lpTokenId}
        />
      ) : null}
    </>
  );
};

export default PactFeeTierCardContainer;
