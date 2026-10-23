import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  poolHasTinymanFarm,
  resolvePoolsPageLendingMarket,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import {
  useInvalidateLiquidityPools,
  useLiquidityPoolPosition,
  useLiquidityPoolSnapshot,
} from "@/hooks/useLiquidityPoolData";
import { fetchUserDepositBalance } from "@/services/lendingService";
import { isFeatureEnabled } from "@/config";
import { pairLpAtomicToHuman } from "@/services/mythLiquidityService";
import PoolPairCard from "./PoolPairCard";
import PoolLiquidityModal, { type PoolLiquidityMode } from "./PoolLiquidityModal";
import PoolLendingModals from "./PoolLendingModals";

interface LiquidityPoolCardContainerProps {
  pair: LiquidityPoolPairConfig;
  onLendingSuccess?: () => void;
}

const LiquidityPoolCardContainer = ({
  pair,
  onLendingSuccess,
}: LiquidityPoolCardContainerProps) => {
  const { activeAccount } = useWallet();
  const { data: snapshot, isLoading, refetch } = useLiquidityPoolSnapshot(pair);
  const { data: position, refetch: refetchPosition } = useLiquidityPoolPosition(
    pair,
    activeAccount?.address
  );
  const invalidatePools = useInvalidateLiquidityPools([pair]);
  const showDepositWithdraw =
    isFeatureEnabled("enablePoolDepositWithdraw") && pair.platform === "tinyman";
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<PoolLiquidityMode>("deposit");
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [lendingWithdrawOpen, setLendingWithdrawOpen] = useState(false);
  const [suppliedBalance, setSuppliedBalance] = useState(0);

  const lendingMarket = useMemo(() => {
    const listed = resolvePoolsPageLendingMarket(pair.networkId, pair);
    // Flag is UI-only. Tokens are not registered unless it is on, so Supply
    // cannot point at a Myth market while lending looks "off".
    if (
      pair.platform === "myth" &&
      !isFeatureEnabled("enableMythPoolLending")
    ) {
      return null;
    }
    return listed;
  }, [pair]);

  const walletLpBalanceHuman = useMemo(() => {
    const primary = position?.poolTokenBalance ?? 0n;
    const alternate = position?.alternatePoolTokenBalance ?? 0n;
    return pairLpAtomicToHuman(pair, primary + alternate);
  }, [pair, position?.alternatePoolTokenBalance, position?.poolTokenBalance]);

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
    onLendingSuccess?.();
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
        onSupply={() => {
          if (lendingMarket) {
            setSupplyOpen(true);
          }
        }}
        onLendingWithdraw={() => {
          if (lendingMarket) {
            setLendingWithdrawOpen(true);
          }
        }}
        lendingSupplyDisabled={walletLpBalanceHuman <= 0 || !lendingMarket}
        lendingWithdrawDisabled={suppliedBalance <= 0}
        suppliedLpBalance={suppliedBalance}
      />
      {showDepositWithdraw && snapshot ? (
        <PoolLiquidityModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          mode={modalMode}
          pair={pair}
          snapshot={snapshot}
          suppliedLpBalance={suppliedBalance}
          onSuccess={() => {
            invalidatePools();
            void refetch();
            void refetchPosition();
          }}
        />
      ) : null}
      {lendingMarket ? (
        <PoolLendingModals
          pair={pair}
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
