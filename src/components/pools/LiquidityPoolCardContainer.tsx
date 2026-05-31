import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  resolveLiquidityPoolLendingMarket,
  poolHasTinymanFarm,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import {
  useInvalidateLiquidityPools,
  useLiquidityPoolPosition,
  useLiquidityPoolSnapshot,
} from "@/hooks/useLiquidityPoolData";
import { fetchUserDepositBalance } from "@/services/lendingService";
import { isFeatureEnabled } from "@/config";
import PoolPairCard from "./PoolPairCard";
import PoolLiquidityModal, { type PoolLiquidityMode } from "./PoolLiquidityModal";
import PoolLendingModals from "./PoolLendingModals";

interface LiquidityPoolCardContainerProps {
  pair: LiquidityPoolPairConfig;
}

const LiquidityPoolCardContainer = ({ pair }: LiquidityPoolCardContainerProps) => {
  const { activeAccount } = useWallet();
  const { data: snapshot, isLoading, refetch } = useLiquidityPoolSnapshot(pair);
  const { data: position, refetch: refetchPosition } = useLiquidityPoolPosition(
    pair,
    activeAccount?.address
  );
  const invalidatePools = useInvalidateLiquidityPools([pair]);
  const showDepositWithdraw = isFeatureEnabled("enablePoolDepositWithdraw");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<PoolLiquidityMode>("deposit");
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [lendingWithdrawOpen, setLendingWithdrawOpen] = useState(false);
  const [suppliedBalance, setSuppliedBalance] = useState(0);

  const lendingMarket = useMemo(
    () => resolveLiquidityPoolLendingMarket(pair.networkId, pair),
    [pair]
  );

  const walletLpBalanceHuman = useMemo(() => {
    if (!position?.poolTokenBalance) return 0;
    return Number(position.poolTokenBalance) / 1e6;
  }, [position?.poolTokenBalance]);

  useEffect(() => {
    if (!lendingMarket || !activeAccount?.address) {
      setSuppliedBalance(0);
      return;
    }

    let cancelled = false;
    void fetchUserDepositBalance(
      activeAccount.address,
      lendingMarket.poolId,
      lendingMarket.marketId,
      pair.networkId
    ).then((balance) => {
      if (!cancelled) {
        setSuppliedBalance(balance ?? 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeAccount?.address,
    lendingMarket,
    pair.networkId,
    supplyOpen,
    lendingWithdrawOpen,
    modalOpen,
  ]);

  const openModal = (mode: PoolLiquidityMode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const refreshAfterLending = () => {
    invalidatePools();
    void refetch();
    void refetchPosition();
  };

  return (
    <>
      <PoolPairCard
        pair={pair}
        snapshot={snapshot}
        position={position}
        loading={isLoading}
        onDeposit={() => openModal("deposit")}
        onWithdraw={() => openModal("withdraw")}
        showDepositWithdraw={showDepositWithdraw}
        lendingMarket={lendingMarket}
        onSupply={() => setSupplyOpen(true)}
        onLendingWithdraw={() => setLendingWithdrawOpen(true)}
        lendingSupplyDisabled={walletLpBalanceHuman <= 0}
        lendingWithdrawDisabled={suppliedBalance <= 0}
      />
      {showDepositWithdraw && snapshot ? (
        <PoolLiquidityModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          mode={modalMode}
          pair={pair}
          snapshot={snapshot}
          onSuccess={() => {
            invalidatePools();
            void refetch();
            void refetchPosition();
          }}
        />
      ) : null}
      {lendingMarket ? (
        <PoolLendingModals
          lendingMarket={lendingMarket}
          supplyOpen={supplyOpen}
          withdrawOpen={lendingWithdrawOpen}
          onCloseSupply={() => setSupplyOpen(false)}
          onCloseWithdraw={() => setLendingWithdrawOpen(false)}
          onSuccess={refreshAfterLending}
          initialWalletLpBalance={walletLpBalanceHuman}
          lpAssetId={pair.lpTokenId}
          hasFarm={poolHasTinymanFarm(pair)}
        />
      ) : null}
    </>
  );
};

export default LiquidityPoolCardContainer;
