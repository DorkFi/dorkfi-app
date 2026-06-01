import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import type { AlgorandNetwork, NetworkId, TokenConfig } from "@/config";
import {
  getLendingPoolLabel,
  getNetworkConfig,
  getWadSupplyMarketConfigsExcludingPoolCBorrow,
  resolveIntrinsicBorrowApyPercentForTokenConfig,
  resolveIntrinsicSupplyApyPercentForTokenConfig,
} from "@/config";
import algorandService from "@/services/algorandService";
import { ARC200Service } from "@/services/arc200Service";
import type { PoolsLendingGlobalSummary } from "@/hooks/useLiquidityPoolData";
import {
  fetchMarketInfo,
  fetchUserBorrowBalance,
  fetchUserGlobalDataForPool,
} from "@/services/lendingService";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";
import {
  buildLiquidationThresholdSummaryForDeposit,
} from "@/utils/depositModalPoolHealthEstimate";
import {
  getHealthFactorStatusLabel,
  getHealthFactorTextColorClass,
} from "@/utils/healthFactorUx";
import { calculateUserHealthFactor } from "@/utils/userHealth";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import {
  fetchPoolCollateralMarketRowsForDeposit,
  type PoolCollateralMarketRow,
} from "@/utils/poolCollateralMarketRows";
import { getTokenImagePath } from "@/utils/tokenImageUtils";

export const poolsWadBorrowMarketQueryKey = (
  networkId: NetworkId,
  poolId: string,
  contractId: string
) => ["pools-wad-borrow-market", networkId, poolId, contractId] as const;

export const poolsHighestWadSupplyApyQueryKey = (networkId: NetworkId) =>
  ["pools-highest-wad-supply-apy", networkId] as const;

export const poolsWadDepositMarketQueryKey = (
  networkId: NetworkId,
  poolId: string,
  contractId: string
) => ["pools-wad-deposit-market", networkId, poolId, contractId] as const;

export type HighestWadSupplyApy = {
  poolId: string;
  poolLabel: string;
  contractId: string;
  supplyAPY: number;
  marketConfig: TokenConfig;
};

async function fetchHighestWadSupplyApy(
  networkId: NetworkId
): Promise<HighestWadSupplyApy | null> {
  const markets = getWadSupplyMarketConfigsExcludingPoolCBorrow(networkId);
  if (markets.length === 0) return null;

  const rows = await Promise.all(
    markets.map(async (config) => {
      const poolId = String(config.poolId);
      const contractId = String(config.contractId);
      const marketInfo = await fetchMarketInfo(poolId, contractId, networkId);
      if (!marketInfo) return null;

      const baseSupplyApy =
        (typeof marketInfo.apyCalculation?.apy === "number" &&
        !Number.isNaN(marketInfo.apyCalculation.apy)
          ? marketInfo.apyCalculation.apy
          : typeof marketInfo.supplyRate === "number"
            ? marketInfo.supplyRate * 100
            : 0) ?? 0;
      const intrinsicSupplyApy = resolveIntrinsicSupplyApyPercentForTokenConfig(
        networkId,
        config
      );

      return {
        poolId,
        poolLabel: getLendingPoolLabel(networkId, poolId) ?? "?",
        contractId,
        supplyAPY: baseSupplyApy + intrinsicSupplyApy,
        marketConfig: config,
      };
    })
  );

  const valid = rows.filter(
    (row): row is HighestWadSupplyApy => row != null && Number.isFinite(row.supplyAPY)
  );
  if (valid.length === 0) return null;

  return valid.reduce((best, row) =>
    row.supplyAPY > best.supplyAPY ? row : best
  );
}

async function fetchWadBorrowMarketInfo(
  poolId: string,
  contractId: string,
  networkId: NetworkId,
  fresh = false
) {
  return fetchMarketInfo(
    poolId,
    contractId,
    networkId,
    fresh ? "contract" : "api",
    fresh ? "sync_market" : "get_market"
  );
}

interface PoolsWadBorrowSectionProps {
  networkId: NetworkId;
  wadMarket: TokenConfig;
  summary: PoolsLendingGlobalSummary | null;
  canBorrow: boolean;
  onBorrowSuccess?: () => void;
}

async function fetchWadWalletBalance(
  userAddress: string,
  networkId: NetworkId,
  wadConfig: TokenConfig
): Promise<number> {
  const networkConfig = getNetworkConfig(networkId);
  const clients = await algorandService.initializeClientsForReads(
    networkConfig.walletNetworkId as AlgorandNetwork
  );
  const decimals = wadConfig.decimals ?? 6;

  if (wadConfig.tokenStandard === "arc200-exchange") {
    const assetId = parseInt(
      String(wadConfig.assetId ?? wadConfig.underlyingAssetId ?? "").trim(),
      10
    );
    if (!Number.isFinite(assetId) || assetId <= 0) return 0;

    try {
      const accAssetInfo = await clients.algod
        .accountAssetInformation(userAddress, assetId)
        .do();
      const atomic = getAccountAssetHoldingAmountAtomic(accAssetInfo);
      if (atomic == null) return 0;
      return Number(atomic) / 10 ** decimals;
    } catch {
      return 0;
    }
  }

  if (wadConfig.tokenStandard === "arc200") {
    ARC200Service.initialize(clients);
    const contractId = String(
      wadConfig.contractId ?? wadConfig.underlyingContractId ?? ""
    ).trim();
    if (!contractId) return 0;

    const arc200Balance = await ARC200Service.getBalance(userAddress, contractId);
    if (!arc200Balance) return 0;

    return parseFloat(ARC200Service.formatBalance(arc200Balance, decimals));
  }

  return 0;
}

function marketInfoToAssetData(
  marketInfo: NonNullable<Awaited<ReturnType<typeof fetchMarketInfo>>>,
  logoPath: string,
  tokenDecimals: number,
  {
    intrinsicSupplyApyPercent = 0,
    intrinsicBorrowApyPercent = 0,
  }: {
    intrinsicSupplyApyPercent?: number;
    intrinsicBorrowApyPercent?: number;
  } = {}
) {
  const usdPerToken = usdPerTokenFromMarketInfoPrice(
    marketInfo.price,
    tokenDecimals
  );
  const totalSupply = parseFloat(marketInfo.totalDeposits) || 0;
  const totalBorrow = parseFloat(marketInfo.totalBorrows) || 0;
  const supplyAPYBase =
    (typeof marketInfo.apyCalculation?.apy === "number" &&
    !Number.isNaN(marketInfo.apyCalculation.apy)
      ? marketInfo.apyCalculation.apy
      : typeof marketInfo.supplyRate === "number"
        ? marketInfo.supplyRate * 100
        : 0) ?? 0;
  const supplyAPY = supplyAPYBase + intrinsicSupplyApyPercent;
  const borrowAPYBase =
    (typeof marketInfo.borrowApyCalculation?.apy === "number" &&
    !Number.isNaN(marketInfo.borrowApyCalculation.apy)
      ? marketInfo.borrowApyCalculation.apy
      : typeof marketInfo.borrowRateCurrent === "number"
        ? marketInfo.borrowRateCurrent * 100
        : 0) ?? 0;
  const borrowAPY = borrowAPYBase + intrinsicBorrowApyPercent;

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
    maxTotalDeposits: marketInfo.maxTotalDeposits
      ? parseFloat(marketInfo.maxTotalDeposits)
      : undefined,
    maxTotalBorrows: marketInfo.maxTotalBorrows
      ? parseFloat(marketInfo.maxTotalBorrows)
      : undefined,
    borrowApyCalculation: marketInfo.borrowApyCalculation,
    apyParameters: {
      borrowRateBps: Math.round((marketInfo.borrowRate ?? 0) * 10000),
      slopeBps: Math.round((marketInfo.slope ?? 0) * 10000),
      reserveFactorBps: Math.round((marketInfo.reserveFactor ?? 0) * 10000),
    },
  };
}

/** Borrow WAD from the pair market and deposit into the best WAD supply APY (UNIT filter). */
const PoolsWadBorrowSection = ({
  networkId,
  wadMarket,
  summary,
  canBorrow,
  onBorrowSuccess,
}: PoolsWadBorrowSectionProps) => {
  const { activeAccount } = useWallet();
  const queryClient = useQueryClient();
  const { formatCurrency, formatPercent } = useNumberI18n();
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletBalanceUSD, setWalletBalanceUSD] = useState(0);
  const [loadingWalletBalance, setLoadingWalletBalance] = useState(false);
  const [depositPoolCollateralMarkets, setDepositPoolCollateralMarkets] = useState<
    PoolCollateralMarketRow[]
  >([]);
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [userBorrowBalance, setUserBorrowBalance] = useState(0);
  const [poolCollateralMarkets, setPoolCollateralMarkets] = useState<
    PoolCollateralMarketRow[]
  >([]);
  const [loadingUserData, setLoadingUserData] = useState(false);

  const poolId = String(wadMarket.poolId);
  const contractId = String(wadMarket.contractId);
  const poolLabel = getLendingPoolLabel(networkId, poolId);
  const marketQueryKey = poolsWadBorrowMarketQueryKey(
    networkId,
    poolId,
    contractId
  );
  const intrinsicBorrowApy = useMemo(
    () => resolveIntrinsicBorrowApyPercentForTokenConfig(networkId, wadMarket),
    [networkId, wadMarket]
  );

  const marketQuery = useQuery({
    queryKey: marketQueryKey,
    queryFn: () => fetchWadBorrowMarketInfo(poolId, contractId, networkId),
    staleTime: 30_000,
  });

  const highestSupplyQuery = useQuery({
    queryKey: poolsHighestWadSupplyApyQueryKey(networkId),
    queryFn: () => fetchHighestWadSupplyApy(networkId),
    staleTime: 30_000,
  });

  const bestDepositTarget = highestSupplyQuery.data;
  const depositPoolId = bestDepositTarget?.poolId ?? "";
  const depositContractId = bestDepositTarget?.contractId ?? "";
  const depositMarketQueryKey = poolsWadDepositMarketQueryKey(
    networkId,
    depositPoolId,
    depositContractId
  );
  const depositIntrinsicSupplyApy = useMemo(
    () =>
      bestDepositTarget
        ? resolveIntrinsicSupplyApyPercentForTokenConfig(
            networkId,
            bestDepositTarget.marketConfig
          )
        : 0,
    [bestDepositTarget, networkId]
  );

  const depositMarketQuery = useQuery({
    queryKey: depositMarketQueryKey,
    queryFn: () =>
      fetchMarketInfo(depositPoolId, depositContractId, networkId),
    enabled: Boolean(depositPoolId && depositContractId),
    staleTime: 30_000,
  });

  const refreshMarketInfo = useCallback(async () => {
    const fresh = await fetchWadBorrowMarketInfo(
      poolId,
      contractId,
      networkId,
      true
    );
    if (fresh) {
      queryClient.setQueryData(marketQueryKey, fresh);
    }
    return fresh;
  }, [contractId, marketQueryKey, networkId, poolId, queryClient]);

  const refreshDepositMarketInfo = useCallback(async () => {
    if (!depositPoolId || !depositContractId) return null;
    const fresh = await fetchMarketInfo(
      depositPoolId,
      depositContractId,
      networkId,
      "contract",
      "sync_market"
    );
    if (fresh) {
      queryClient.setQueryData(depositMarketQueryKey, fresh);
    }
    return fresh;
  }, [
    depositContractId,
    depositMarketQueryKey,
    depositPoolId,
    networkId,
    queryClient,
  ]);

  const borrowAssetData = useMemo(() => {
    if (!marketQuery.data) return null;
    return marketInfoToAssetData(
      marketQuery.data,
      wadMarket.logoPath ?? getTokenImagePath("WAD"),
      wadMarket.decimals ?? 6,
      { intrinsicBorrowApyPercent: intrinsicBorrowApy }
    );
  }, [intrinsicBorrowApy, marketQuery.data, wadMarket]);

  const depositAssetData = useMemo(() => {
    if (!depositMarketQuery.data || !bestDepositTarget) return null;
    return marketInfoToAssetData(
      depositMarketQuery.data,
      bestDepositTarget.marketConfig.logoPath ?? getTokenImagePath("WAD"),
      bestDepositTarget.marketConfig.decimals ?? 6,
      { intrinsicSupplyApyPercent: depositIntrinsicSupplyApy }
    );
  }, [
    bestDepositTarget,
    depositIntrinsicSupplyApy,
    depositMarketQuery.data,
  ]);

  const loadUserData = useCallback(async () => {
    if (!activeAccount?.address) {
      setUserGlobalData(null);
      setUserBorrowBalance(0);
      setPoolCollateralMarkets([]);
      return;
    }

    setLoadingUserData(true);
    try {
      const [globalData, borrowData, collateralRows] = await Promise.all([
        fetchUserGlobalDataForPool(activeAccount.address, networkId, poolId),
        fetchUserBorrowBalance(
          activeAccount.address,
          poolId,
          contractId,
          networkId
        ),
        fetchPoolCollateralMarketRowsForDeposit(
          activeAccount.address,
          networkId,
          poolId
        ),
      ]);
      setUserGlobalData(globalData);
      setUserBorrowBalance(borrowData?.balance ?? 0);
      setPoolCollateralMarkets(collateralRows);
    } finally {
      setLoadingUserData(false);
    }
  }, [activeAccount?.address, contractId, networkId, poolId]);

  useEffect(() => {
    void loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (borrowOpen) {
      void loadUserData();
    }
  }, [borrowOpen, loadUserData]);

  const loadWalletBalance = useCallback(async () => {
    if (!activeAccount?.address) {
      setWalletBalance(0);
      setWalletBalanceUSD(0);
      return;
    }

    setLoadingWalletBalance(true);
    try {
      const wadConfig = bestDepositTarget?.marketConfig ?? wadMarket;
      const balance = await fetchWadWalletBalance(
        activeAccount.address,
        networkId,
        wadConfig
      );
      setWalletBalance(balance);

      const marketInfo = depositMarketQuery.data;
      if (marketInfo) {
        const usdPerToken = usdPerTokenFromMarketInfoPrice(
          marketInfo.price,
          wadConfig.decimals ?? 6
        );
        setWalletBalanceUSD(balance * usdPerToken);
      } else {
        setWalletBalanceUSD(0);
      }
    } finally {
      setLoadingWalletBalance(false);
    }
  }, [
    activeAccount?.address,
    bestDepositTarget?.marketConfig,
    depositMarketQuery.data,
    networkId,
    wadMarket,
  ]);

  const loadDepositCollateralMarkets = useCallback(async () => {
    if (!activeAccount?.address || !depositPoolId) {
      setDepositPoolCollateralMarkets([]);
      return;
    }

    const rows = await fetchPoolCollateralMarketRowsForDeposit(
      activeAccount.address,
      networkId,
      depositPoolId
    );
    setDepositPoolCollateralMarkets(rows);
  }, [activeAccount?.address, depositPoolId, networkId]);

  useEffect(() => {
    if (!depositOpen) return;
    void loadWalletBalance();
    void loadDepositCollateralMarkets();
  }, [depositOpen, loadDepositCollateralMarkets, loadWalletBalance]);

  const canDeposit =
    Boolean(activeAccount?.address) &&
    Boolean(bestDepositTarget) &&
    Boolean(depositAssetData);

  const collateralUsd = summary?.totalCollateralValue ?? 0;
  const borrowUsd = summary?.totalBorrowValue ?? 0;

  const poolHealthFactor = useMemo(() => {
    if (!activeAccount?.address || !borrowAssetData) return null;

    const collateral =
      userGlobalData?.totalCollateralValue ?? collateralUsd;
    const borrowed = userGlobalData?.totalBorrowValue ?? borrowUsd;

    const ltSummary = buildLiquidationThresholdSummaryForDeposit(
      borrowAssetData.liquidationThreshold,
      poolCollateralMarkets,
      poolId
    );
    const liquidationThreshold =
      ltSummary?.minAfter ?? borrowAssetData.liquidationThreshold;

    const hfRaw = calculateUserHealthFactor(
      collateral,
      borrowed,
      liquidationThreshold,
      "pools-wad-section"
    );
    if (hfRaw == null) return null;
    return Math.min(hfRaw, 3.0);
  }, [
    activeAccount?.address,
    borrowAssetData,
    borrowUsd,
    collateralUsd,
    poolCollateralMarkets,
    poolId,
    userGlobalData,
  ]);

  const healthColorClass = getHealthFactorTextColorClass(poolHealthFactor);
  const healthStatusLabel = getHealthFactorStatusLabel(poolHealthFactor);

  return (
    <>
      <div className="mb-4 rounded-xl border border-whale-gold/30 bg-whale-gold/5 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <img
              src={getTokenImagePath("WAD")}
              alt="WAD"
              className="h-10 w-10 rounded-full border border-border/50 object-contain bg-white"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">WAD lending</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                Borrow WAD from the Pool {poolLabel} market against your UNIT LP
                collateral, then deposit into the best WAD supply APY
                {bestDepositTarget ? ` on Pool ${bestDepositTarget.poolLabel}` : ""}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DorkFiButton
              variant="borrow-outline"
              onClick={() => setBorrowOpen(true)}
              disabled={
                !canBorrow ||
                !borrowAssetData ||
                marketQuery.isLoading ||
                loadingUserData
              }
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" aria-hidden />
              Borrow WAD
            </DorkFiButton>
            <DorkFiButton
              variant="primary"
              onClick={() => setDepositOpen(true)}
              disabled={
                !canDeposit ||
                highestSupplyQuery.isLoading ||
                depositMarketQuery.isLoading
              }
            >
              <ArrowUpToLine className="mr-2 h-4 w-4" aria-hidden />
              Supply WAD
            </DorkFiButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Collateral</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(collateralUsd, "USD", {
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Borrows</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(borrowUsd, "USD", {
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Health</p>
            <p className={`font-semibold tabular-nums ${healthColorClass}`}>
              {!activeAccount?.address
                ? "—"
                : loadingUserData || marketQuery.isLoading
                  ? "—"
                  : poolHealthFactor == null
                    ? "—"
                    : poolHealthFactor.toFixed(2)}
            </p>
            {activeAccount?.address && poolHealthFactor != null ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {healthStatusLabel}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Borrow APY</p>
            <p className="font-semibold tabular-nums">
              {marketQuery.isLoading || !borrowAssetData
                ? "—"
                : formatPercent(borrowAssetData.borrowAPY / 100, {
                    maximumFractionDigits: 2,
                  })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pool {poolLabel}
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Best Deposit APY</p>
            <p className="font-semibold tabular-nums">
              {highestSupplyQuery.isLoading || !highestSupplyQuery.data
                ? "—"
                : formatPercent(highestSupplyQuery.data.supplyAPY / 100, {
                    maximumFractionDigits: 2,
                  })}
            </p>
            {highestSupplyQuery.data ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pool {highestSupplyQuery.data.poolLabel}
              </p>
            ) : null}
          </div>
        </div>

        {!canBorrow ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Supply UNIT LP to the platform on any pool below to borrow WAD.
          </p>
        ) : null}
        {!activeAccount?.address ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Connect your wallet to borrow or deposit WAD.
          </p>
        ) : null}
      </div>

      {borrowOpen && borrowAssetData ? (
        <SupplyBorrowModal
          isOpen={borrowOpen}
          onClose={() => setBorrowOpen(false)}
          asset="WAD"
          poolId={poolId}
          configSymbol="WAD"
          marketId={contractId}
          network={networkId}
          mode="borrow"
          assetData={borrowAssetData}
          userGlobalData={userGlobalData}
          userBorrowBalance={userBorrowBalance}
          isLoadingBorrowGlobalData={loadingUserData}
          poolCollateralMarkets={poolCollateralMarkets}
          onTransactionSuccess={() => {
            void loadUserData();
            void refreshMarketInfo();
            void loadWalletBalance();
            onBorrowSuccess?.();
          }}
        />
      ) : null}

      {depositOpen && depositAssetData && bestDepositTarget ? (
        <SupplyBorrowModal
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          asset="WAD"
          poolId={depositPoolId}
          configSymbol="WAD"
          marketId={depositContractId}
          network={networkId}
          mode="deposit"
          assetData={depositAssetData}
          walletBalance={walletBalance}
          walletBalanceUSD={walletBalanceUSD}
          poolCollateralMarkets={depositPoolCollateralMarkets}
          isLoadingWalletBalance={loadingWalletBalance}
          onRefreshWalletBalance={() => {
            void loadWalletBalance();
          }}
          onDepositRouteChange={() => {
            void loadWalletBalance();
          }}
          onTransactionSuccess={() => {
            void loadWalletBalance();
            void refreshDepositMarketInfo();
            void queryClient.invalidateQueries({
              queryKey: poolsHighestWadSupplyApyQueryKey(networkId),
            });
            onBorrowSuccess?.();
          }}
        />
      ) : null}
    </>
  );
};

export default PoolsWadBorrowSection;
