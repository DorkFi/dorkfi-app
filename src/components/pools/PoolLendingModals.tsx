import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import WithdrawModal, {
  type WithdrawModalSubmitResult,
  type WithdrawPhasedSignPayload,
  type WithdrawSubmitOptions,
} from "@/components/WithdrawModal";
import {
  POOL_FARM_SUPPLY_NOTICE,
  type LiquidityPoolLendingMarket,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import { resolveLiquidityPairDisplay } from "@/services/tinymanLiquidityService";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAlgorandNetworkFromNetworkId,
  getTokenConfig,
  type NetworkId,
} from "@/config";
import { marketRowCacheKey } from "@/hooks/useOnDemandMarketData";
import {
  fetchMarketInfo,
  fetchUserDepositBalance,
  fetchUserGlobalDataForPool,
  getMaxWithdrawableForMarket,
  withdraw,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";
import {
  fetchPoolCollateralMarketRowsForDeposit,
  type PoolCollateralMarketRow,
} from "@/utils/poolCollateralMarketRows";
import { waitForConfirmation } from "algosdk";

function poolMinLiquidationThresholdBps(minPercentField: number): bigint {
  if (!Number.isFinite(minPercentField) || minPercentField <= 0) {
    return BigInt(8500);
  }
  if (minPercentField <= 1) {
    return BigInt(Math.round(minPercentField * 10000));
  }
  return BigInt(Math.round(minPercentField * 100));
}

type PoolLendingModalsProps = {
  pair: LiquidityPoolPairConfig;
  lendingMarket: LiquidityPoolLendingMarket;
  supplyOpen: boolean;
  withdrawOpen: boolean;
  onCloseSupply: () => void;
  onCloseWithdraw: () => void;
  onSuccess?: () => void;
  /** Wallet LP balance (human units) — refreshed when supply modal opens. */
  initialWalletLpBalance?: number;
  lpAssetId: number;
  hasFarm?: boolean;
};

type LendingMarketStats = {
  icon: string;
  totalSupply: number;
  totalSupplyUSD: number;
  supplyAPY: number;
  totalBorrow: number;
  totalBorrowUSD: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  liquidationThreshold?: number;
  liquidity: number;
  liquidityUSD: number;
  /** USD per 1 human token (oracle-adjusted). */
  tokenPrice: number;
  apyParameters?: {
    borrowRateBps: number;
    slopeBps: number;
    reserveFactorBps: number;
  };
};

function marketInfoToAssetData(
  marketInfo: NonNullable<Awaited<ReturnType<typeof fetchMarketInfo>>>,
  logoPath: string,
  tokenDecimals: number
): LendingMarketStats {
  const usdPerToken = usdPerTokenFromMarketInfoPrice(
    marketInfo.price,
    tokenDecimals
  );
  const totalSupply = parseFloat(marketInfo.totalDeposits) || 0;
  const totalBorrow = parseFloat(marketInfo.totalBorrows) || 0;
  const supplyAPY =
    (typeof marketInfo.apyCalculation?.apy === "number" &&
    !Number.isNaN(marketInfo.apyCalculation.apy)
      ? marketInfo.apyCalculation.apy
      : typeof marketInfo.supplyRate === "number"
        ? marketInfo.supplyRate * 100
        : 0) ?? 0;
  const borrowAPY =
    (typeof marketInfo.borrowApyCalculation?.apy === "number" &&
    !Number.isNaN(marketInfo.borrowApyCalculation.apy)
      ? marketInfo.borrowApyCalculation.apy
      : typeof marketInfo.borrowRateCurrent === "number"
        ? marketInfo.borrowRateCurrent * 100
        : 0) ?? 0;
  return {
    icon: logoPath,
    totalSupply,
    totalSupplyUSD: totalSupply * usdPerToken,
    supplyAPY,
    totalBorrow,
    totalBorrowUSD: totalBorrow * usdPerToken,
    borrowAPY,
    utilization: (marketInfo.utilizationRate ?? 0) * 100,
    collateralFactor: (marketInfo.collateralFactor ?? 0) * 100,
    liquidationThreshold: (marketInfo.liquidationThreshold ?? 0) * 100,
    liquidity: Math.max(0, totalSupply - totalBorrow),
    liquidityUSD: Math.max(0, totalSupply - totalBorrow) * usdPerToken,
    tokenPrice: usdPerToken,
    apyParameters: {
      borrowRateBps: Math.round((marketInfo.borrowRate ?? 0) * 10000),
      slopeBps: Math.round((marketInfo.slope ?? 0) * 10000),
      reserveFactorBps: Math.round((marketInfo.reserveFactor ?? 0) * 10000),
    },
  };
}

const PoolLendingModals = ({
  pair,
  lendingMarket,
  supplyOpen,
  withdrawOpen,
  onCloseSupply,
  onCloseWithdraw,
  onSuccess,
  initialWalletLpBalance = 0,
  lpAssetId,
  hasFarm = false,
}: PoolLendingModalsProps) => {
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();
  const networkId = currentNetwork as NetworkId;

  const pairDisplay = useMemo(() => resolveLiquidityPairDisplay(pair), [pair]);
  const assetPairIcons = useMemo(() => {
    if (!pairDisplay.asset1Icon || !pairDisplay.asset2Icon) return undefined;
    return {
      asset1Icon: pairDisplay.asset1Icon,
      asset2Icon: pairDisplay.asset2Icon,
    };
  }, [pairDisplay.asset1Icon, pairDisplay.asset2Icon]);

  const [assetData, setAssetData] = useState<LendingMarketStats | null>(null);
  const [walletBalance, setWalletBalance] = useState(initialWalletLpBalance);
  const [suppliedBalance, setSuppliedBalance] = useState(0);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [maxWithdrawUnderlying, setMaxWithdrawUnderlying] = useState<
    number | undefined
  >(undefined);
  const [maxWithdrawScaled, setMaxWithdrawScaled] = useState<
    string | undefined
  >(undefined);
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [poolCollateralMarkets, setPoolCollateralMarkets] = useState<
    PoolCollateralMarketRow[]
  >([]);

  const marketRowKey = useMemo(
    () =>
      marketRowCacheKey({
        originalSymbol: lendingMarket.displaySymbol,
        symbol: lendingMarket.displaySymbol,
        poolId: lendingMarket.poolId,
        underlyingContractId: lendingMarket.marketId,
      }),
    [lendingMarket]
  );

  const refreshBalances = useCallback(async () => {
    if (!activeAccount?.address) {
      setWalletBalance(0);
      setSuppliedBalance(0);
      return;
    }

    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (algorandNetwork) {
      try {
        const { algod } = algorandService.initializeClients(algorandNetwork);
        const holding = await algod
          .accountAssetInformation(activeAccount.address, lpAssetId)
          .do();
        const raw = getAccountAssetHoldingAmountAtomic(holding);
        const human =
          raw != null ? Number(raw) / 10 ** lendingMarket.decimals : 0;
        setWalletBalance(human);
      } catch {
        setWalletBalance(0);
      }
    }

    const deposited = await fetchUserDepositBalance(
      activeAccount.address,
      lendingMarket.poolId,
      lendingMarket.marketId,
      networkId
    );
    setSuppliedBalance(deposited ?? 0);
  }, [
    activeAccount?.address,
    lendingMarket.decimals,
    lendingMarket.marketId,
    lendingMarket.poolId,
    lpAssetId,
    networkId,
  ]);

  const loadMarketData = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const marketInfo = await fetchMarketInfo(
        lendingMarket.poolId,
        lendingMarket.marketId,
        networkId
      );
      if (marketInfo) {
        setAssetData(
          marketInfoToAssetData(
            marketInfo,
            lendingMarket.logoPath,
            lendingMarket.decimals
          )
        );
      }
    } finally {
      setLoadingMarket(false);
    }
  }, [lendingMarket, networkId]);

  useEffect(() => {
    if (!supplyOpen && !withdrawOpen) return;
    void loadMarketData();
    void refreshBalances();
  }, [supplyOpen, withdrawOpen, loadMarketData, refreshBalances]);

  useEffect(() => {
    if (supplyOpen) {
      setWalletBalance(initialWalletLpBalance);
    }
  }, [supplyOpen, initialWalletLpBalance]);

  useEffect(() => {
    if (!withdrawOpen || !activeAccount?.address) {
      setMaxWithdrawUnderlying(undefined);
      setMaxWithdrawScaled(undefined);
      setUserGlobalData(null);
      setPoolCollateralMarkets([]);
      return;
    }

    let cancelled = false;
    const poolId = lendingMarket.poolId;
    const marketId = lendingMarket.marketId;

    void (async () => {
      const [globalData, collateralRows] = await Promise.all([
        fetchUserGlobalDataForPool(activeAccount.address, networkId, poolId),
        fetchPoolCollateralMarketRowsForDeposit(
          activeAccount.address,
          networkId,
          poolId
        ),
      ]);
      if (cancelled) return;
      setUserGlobalData(globalData);
      setPoolCollateralMarkets(collateralRows);

      const minLiquidationThresholdBps =
        collateralRows.length > 0
          ? poolMinLiquidationThresholdBps(
              Math.min(
                ...collateralRows.map((row) => row.liquidationThresholdPercent)
              )
            )
          : undefined;

      const maxData = await getMaxWithdrawableForMarket(
        poolId,
        marketId,
        activeAccount.address,
        networkId,
        lendingMarket.decimals,
        minLiquidationThresholdBps !== undefined
          ? { minLiquidationThresholdBps }
          : undefined
      );
      if (cancelled) return;
      if (!maxData) {
        setMaxWithdrawUnderlying(undefined);
        setMaxWithdrawScaled(undefined);
        return;
      }
      setMaxWithdrawUnderlying(maxData.maxWithdrawUnderlying);
      setMaxWithdrawScaled(maxData.maxWithdrawScaled.toString());
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAccount?.address,
    lendingMarket.decimals,
    lendingMarket.marketId,
    lendingMarket.poolId,
    networkId,
    withdrawOpen,
  ]);

  const tokenConfig = useMemo(() => {
    const raw = getTokenConfig(networkId, lendingMarket.configSymbol);
    return Array.isArray(raw) ? raw[0] : raw;
  }, [lendingMarket.configSymbol, networkId]);

  const buildWithdrawUnsigned = useCallback(
    async (
      amount: string,
      options?: WithdrawSubmitOptions
    ): Promise<WithdrawPhasedSignPayload> => {
      if (!activeAccount?.address) {
        throw new Error("Connect your wallet to withdraw.");
      }
      if (!tokenConfig) {
        throw new Error(
          `Token config not found for ${lendingMarket.configSymbol} on ${networkId}.`
        );
      }

      const withdrawAllConfirmed = Boolean(options?.withdrawAllConfirmed);
      const result = await withdraw(
        lendingMarket.poolId,
        lendingMarket.marketId,
        tokenConfig.tokenStandard,
        amount,
        activeAccount.address,
        networkId,
        {
          withdrawAll: withdrawAllConfirmed,
          maxWithdrawScaled:
            withdrawAllConfirmed &&
            options?.isMaxWithdraw &&
            maxWithdrawScaled
              ? BigInt(maxWithdrawScaled)
              : undefined,
        }
      );

      if (!result.success || !("txns" in result) || !result.txns?.length) {
        throw new Error(
          "error" in result && result.error
            ? String(result.error)
            : "Withdraw failed"
        );
      }

      return {
        txnsB64: result.txns,
        poolAppId: lendingMarket.poolId,
        marketContractId: lendingMarket.marketId,
        underlyingAssetId: lendingMarket.assetId,
        networkId,
        txSignPreviewVariant: "lending",
        assetDisplaySymbol: pairDisplay.label,
        amountHuman: amount,
      };
    },
    [
      activeAccount?.address,
      lendingMarket,
      maxWithdrawScaled,
      networkId,
      pairDisplay.label,
      tokenConfig,
    ]
  );

  const finalizeWithdrawSigned = useCallback(
    async (
      stxns: Uint8Array[],
      built: WithdrawPhasedSignPayload
    ): Promise<WithdrawModalSubmitResult> => {
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        built.networkId as NetworkId
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${built.networkId}`);
      }
      const clients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);
      void refreshBalances();
      return { txId: res.txid };
    },
    [refreshBalances]
  );

  const withdrawPhased = useMemo(
    () => ({
      buildUnsignedGroup: buildWithdrawUnsigned,
      finalizeSignedGroup: finalizeWithdrawSigned,
    }),
    [buildWithdrawUnsigned, finalizeWithdrawSigned]
  );

  const emptyAssetData: LendingMarketStats = useMemo(
    () => ({
      icon: lendingMarket.logoPath,
      totalSupply: 0,
      totalSupplyUSD: 0,
      supplyAPY: 0,
      totalBorrow: 0,
      totalBorrowUSD: 0,
      borrowAPY: 0,
      utilization: 0,
      collateralFactor: 0,
      liquidity: 0,
      liquidityUSD: 0,
      tokenPrice: 0,
    }),
    [lendingMarket.logoPath]
  );

  const resolvedAssetData = assetData ?? emptyAssetData;
  const tokenPrice = resolvedAssetData.tokenPrice;

  return (
    <>
      {supplyOpen ? (
        <SupplyBorrowModal
          isOpen={supplyOpen}
          onClose={onCloseSupply}
          asset={pairDisplay.label}
          poolId={lendingMarket.poolId}
          configSymbol={lendingMarket.configSymbol}
          marketId={lendingMarket.marketId}
          marketRowKey={marketRowKey}
          network={networkId}
          mode="deposit"
          assetData={resolvedAssetData}
          assetPairIcons={assetPairIcons}
          walletBalance={walletBalance}
          walletBalanceUSD={walletBalance * tokenPrice}
          isLoadingWalletBalance={loadingMarket}
          onRefreshWalletBalance={() => {
            void refreshBalances();
          }}
          onTransactionSuccess={() => {
            onSuccess?.();
            void refreshBalances();
          }}
          depositNotice={hasFarm ? POOL_FARM_SUPPLY_NOTICE : undefined}
        />
      ) : null}

      {withdrawOpen ? (
        <WithdrawModal
          isOpen={withdrawOpen}
          onClose={onCloseWithdraw}
          tokenSymbol={pairDisplay.label}
          tokenIcon={lendingMarket.logoPath}
          tokenPairIcons={assetPairIcons}
          tokenDisplayName={lendingMarket.displayName}
          tokenDecimals={lendingMarket.decimals}
          currentlyDeposited={suppliedBalance}
          poolId={lendingMarket.poolId}
          network={networkId}
          selectedMarketId={lendingMarket.marketId}
          selectedConfigSymbol={lendingMarket.configSymbol}
          maxWithdrawUnderlying={maxWithdrawUnderlying}
          poolCollateralMarkets={poolCollateralMarkets}
          poolHasNoBorrows={
            !userGlobalData?.totalBorrowValue ||
            userGlobalData.totalBorrowValue === 0
          }
          marketStats={{
            supplyAPY: resolvedAssetData.supplyAPY,
            borrowAPY: resolvedAssetData.borrowAPY,
            utilization: resolvedAssetData.utilization,
            collateralFactor: resolvedAssetData.collateralFactor,
            liquidationThreshold: resolvedAssetData.liquidationThreshold,
            tokenPrice,
            totalDeposits: resolvedAssetData.totalSupply,
            totalBorrows: resolvedAssetData.totalBorrow,
            apyParameters: resolvedAssetData.apyParameters,
          }}
          withdrawPhased={withdrawPhased}
          onTransactionSuccess={() => {
            onSuccess?.();
            void refreshBalances();
          }}
          onRefreshBalance={() => {
            void refreshBalances();
          }}
        />
      ) : null}
    </>
  );
};

export default PoolLendingModals;
