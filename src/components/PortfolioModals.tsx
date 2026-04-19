/* eslint-disable @typescript-eslint/no-explicit-any -- TODO: type modal state and API responses */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import BorrowModal from "./BorrowModal";
import RepayModal from "./RepayModal";
import SupplyBorrowModal, {
  resolveSupplyBorrowToken,
  type SupplyBorrowAvailableAsset,
} from "./SupplyBorrowModal";
import MintModal from "./MintModal"; // Added MintModal import
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  withdraw,
  repay,
  repayAll,
  fetchUserWalletBalance,
  fetchMarketInfoFromContract,
  getMaxWithdrawableForMarket,
  fetchUserGlobalDataForPool,
} from "@/services/lendingService";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
} from "@/services/folksDepositAdapter";
import {
  getTokenConfig,
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  NetworkId,
  getNetworkConfig,
  getFolksAdapterForPhase,
  getFolksAdaptersForPhase,
  tokenConfigHasNonFolksAdapter,
  tokenConfigHasAdapters,
} from "@/config";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/utils/errorUtils";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { updateTransactionMetadata } from "@/utils/transactionUtils";
import { CONTRACT } from "ulujs";
import {
  APP_SPEC as LendingPoolAppSpec,
  UserData,
} from "@/clients/DorkFiLendingPoolClient";
import { isAlgorandCompatibleNetwork } from "@/config";
import {
  buildPoolCollateralMarketRows,
  liquidationThresholdToPercent,
} from "@/utils/poolCollateralMarketRows";
import { marketRowForPortfolioPosition } from "@/utils/marketRowForPortfolioPosition";
import { portfolioWalletBalanceCacheKey } from "@/utils/portfolioWalletBalanceCacheKey";

/**
 * `buildPoolCollateralMarketRows` yields `liquidationThresholdPercent` as 0–100 (e.g. 85) or rarely
 * as a 0–1 fraction (0.85). `getMaxWithdrawable` needs **bps** (10000 = 100%). Using `min * 100`
 * when the field is already a fraction yields **85 bps** instead of **8500** and zeros HF-safe max.
 */
function poolMinLiquidationThresholdBps(minPercentField: number): bigint {
  if (!Number.isFinite(minPercentField) || minPercentField <= 0) {
    return BigInt(8500);
  }
  if (minPercentField <= 1) {
    return BigInt(Math.round(minPercentField * 10000));
  }
  return BigInt(Math.round(minPercentField * 100));
}

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
  poolId?: string;
  scaledDeposits?: string;
  userDepositIndex?: string;
  marketId?: string;
  configSymbol?: string;
  appId?: string;
}

interface Borrow {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
  interest?: number; // Accrued interest for borrow positions
  marketId?: string;
  configSymbol?: string;
}

interface PortfolioModalsProps {
  depositModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
  };
  withdrawModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    marketId?: string;
    configSymbol?: string;
  };
  borrowModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
    marketRowKey?: string;
  };
  /** When set (≥2 rows), borrow modal shows an asset picker like Withdraw. */
  borrowMarketPickerAssets?: SupplyBorrowAvailableAsset[];
  onSelectBorrowMarket?: (
    asset: string,
    poolId?: string,
    network?: string,
    pick?: { marketId?: string; configSymbol?: string; marketRowKey?: string }
  ) => void;
  repayModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
  };
  deposits: Deposit[];
  borrows: Borrow[];
  walletBalances: Record<string, { balance: number; balanceUSD: number }>;
  marketData: any[];
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
    healthFactorIndex?: number;
  } | null;
  userBorrowBalance?: number;
  onCloseDepositModal: () => void;
  onCloseWithdrawModal: () => void;
  onCloseBorrowModal: () => void;
  onCloseRepayModal: () => void;
  onSelectWithdrawAsset?: (
    asset: string,
    poolId?: string,
    network?: string,
    pick?: { marketId?: string; configSymbol?: string }
  ) => void;
  onSelectDepositAsset?: (asset: string, poolId?: string, network?: string) => void;
  onSelectRepayAsset?: (asset: string, poolId?: string, network?: string) => void;
  onRefreshWalletBalance?: (
    asset: string,
    networkId?: string,
    opts?: { poolId?: string; marketId?: string; configSymbol?: string }
  ) => void;
  onRefreshMarket?: () => void;
  prefetchWithdrawIndicesRef?: React.MutableRefObject<
    | ((
        asset: string,
        poolId?: string,
        marketId?: string,
        networkIdOverride?: string
      ) => Promise<void>)
    | null
  >;
  /** Same Folks mint ratio as supplied table (`network|configSymbol|poolId` → minted f for 1 underlying atomic). */
  folksMintedOneUnderlyingByKey?: Record<string, string>;
}

const PortfolioModals = ({
  depositModal,
  withdrawModal,
  borrowModal,
  borrowMarketPickerAssets,
  onSelectBorrowMarket,
  repayModal,
  deposits,
  borrows,
  walletBalances,
  marketData,
  userGlobalData,
  userBorrowBalance,
  onCloseDepositModal,
  onCloseWithdrawModal,
  onCloseBorrowModal,
  onCloseRepayModal,
  onSelectWithdrawAsset,
  onSelectDepositAsset,
  onSelectRepayAsset,
  onRefreshWalletBalance,
  onRefreshMarket,
  prefetchWithdrawIndicesRef,
  folksMintedOneUnderlyingByKey,
}: PortfolioModalsProps) => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();
  const depositPoolCollateralMarkets = useMemo(
    () =>
      buildPoolCollateralMarketRows(
        deposits,
        marketData,
        depositModal.network,
        depositModal.poolId
      ),
    [deposits, marketData, depositModal.network, depositModal.poolId]
  );

  const withdrawPoolCollateralMarkets = useMemo(
    () =>
      buildPoolCollateralMarketRows(
        deposits,
        marketData,
        withdrawModal.network,
        withdrawModal.poolId
      ),
    [deposits, marketData, withdrawModal.network, withdrawModal.poolId]
  );

  const borrowPoolCollateralMarkets = useMemo(
    () =>
      buildPoolCollateralMarketRows(
        deposits,
        marketData,
        borrowModal.network,
        borrowModal.poolId
      ),
    [deposits, marketData, borrowModal.network, borrowModal.poolId]
  );

  const repayPoolCollateralMarkets = useMemo(
    () =>
      buildPoolCollateralMarketRows(
        deposits,
        marketData,
        repayModal.network,
        repayModal.poolId
      ),
    [deposits, marketData, repayModal.network, repayModal.poolId]
  );

  /** Per-pool USD totals for repay modal est. health (same source as SupplyBorrowModal borrow). */
  const [repayPoolGlobalUserData, setRepayPoolGlobalUserData] = useState<
    | {
        totalCollateralValue: number;
        totalBorrowValue: number;
        lastUpdateTime: number;
      }
    | null
    | undefined
  >(undefined);

  const [userDepositIndexCache, setUserDepositIndexCache] = useState<
    Record<string, string>
  >({});
  const [currentDepositIndexCache, setCurrentDepositIndexCache] = useState<
    Record<string, string>
  >({});
  const [maxWithdrawData, setMaxWithdrawData] = useState<{
    maxWithdrawUnderlying: number;
    maxWithdrawScaled: string;
  } | null>(null);

  /** Folks minted f-asset for 1.0 underlying (atomic), for withdraw UI f↔underlying conversion. */
  const [folksWithdrawMintOneAtomic, setFolksWithdrawMintOneAtomic] = useState<
    string | null
  >(null);

  // Extract fetch indices function to be reusable
  const fetchIndices = useCallback(
    async (
      asset: string,
      poolId?: string,
      marketId?: string,
      networkIdOverride?: string
    ) => {
      const networkId = (networkIdOverride || currentNetwork) as NetworkId;
      try {
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = resolveSupplyBorrowToken(
          tokens,
          asset ?? "",
          poolId,
          undefined,
          marketId ?? ""
        );

        if (!token?.poolId || !token?.underlyingContractId) {
          return;
        }

        const cacheKey = `${asset}-${poolId || "default"}-${marketId || ""}`;
        const networkConfig = getNetworkConfig(networkId);

        if (!isAlgorandCompatibleNetwork(networkId)) {
          return;
        }

        // Always fetch current deposit index from contract (bypass API cache)
        try {
          const marketData = await fetchMarketInfoFromContract(
            token.poolId,
            token.underlyingContractId,
            networkId
          );

          if (marketData?.depositIndex) {
            setCurrentDepositIndexCache((prev) => ({
              ...prev,
              [cacheKey]: marketData.depositIndex.toString(),
            }));
          }
        } catch (error) {
          console.error("Error fetching current deposit index:", error);
        }

        // Always fetch user deposit index from contract if wallet is connected (bypass cache)
        if (activeAccount?.address) {
          try {
            const clients = algorandService.initializeClients(
              networkConfig.walletNetworkId as AlgorandNetwork
            );

            const ci = new CONTRACT(
              Number(token.poolId),
              clients.algod,
              undefined,
              { ...LendingPoolAppSpec.contract, events: [] },
              {
                addr: algosdk.encodeAddress(
                  algosdk.getApplicationAddress(Number(token.poolId)).publicKey
                ),
                sk: new Uint8Array(),
              }
            );

            ci.setFee(2000);
            const userDataR = await ci.get_user(
              activeAccount.address,
              Number(token.underlyingContractId)
            );

            if (userDataR.success) {
              const userData = UserData(userDataR.returnValue);
              const userDepositIndex = userData.depositIndex?.toString();

              if (userDepositIndex) {
                setUserDepositIndexCache((prev) => ({
                  ...prev,
                  [cacheKey]: userDepositIndex,
                }));
              }
            }
          } catch (error) {
            console.error("Error fetching user deposit index:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching indices:", error);
      }
    },
    [currentNetwork, activeAccount?.address]
  );

  // Expose prefetch function via ref
  useEffect(() => {
    if (prefetchWithdrawIndicesRef) {
      prefetchWithdrawIndicesRef.current = fetchIndices;
    }
  }, [prefetchWithdrawIndicesRef, fetchIndices]);

  // Fetch indices when withdraw modal opens (fallback)
  useEffect(() => {
    if (withdrawModal.isOpen && withdrawModal.asset) {
      fetchIndices(
        withdrawModal.asset,
        withdrawModal.poolId,
        withdrawModal.marketId,
        withdrawModal.network || currentNetwork
      );
    }
  }, [
    withdrawModal.isOpen,
    withdrawModal.asset,
    withdrawModal.poolId,
    withdrawModal.marketId,
    withdrawModal.network,
    currentNetwork,
    fetchIndices,
  ]);

  // Fetch max withdrawable (health-factor-safe) when withdraw modal opens
  useEffect(() => {
    if (
      !withdrawModal.isOpen ||
      !withdrawModal.asset ||
      !activeAccount?.address
    ) {
      setMaxWithdrawData(null);
      setFolksWithdrawMintOneAtomic(null);
      return;
    }
    const networkToUse = withdrawModal.network || currentNetwork;
    const tokens = getAllTokensWithDisplayInfo(networkToUse);
    const withdrawalDeposit =
      deposits.find(
        (d) =>
          d.asset === withdrawModal.asset &&
          String(d.poolId ?? "") === String(withdrawModal.poolId ?? "") &&
          (withdrawModal.marketId == null ||
            withdrawModal.marketId === "" ||
            String((d as Deposit).marketId ?? "") ===
              String(withdrawModal.marketId)) &&
          (withdrawModal.configSymbol == null ||
            withdrawModal.configSymbol === "" ||
            String((d as Deposit).configSymbol ?? "") ===
              String(withdrawModal.configSymbol))
      ) ??
      (withdrawModal.poolId
        ? (() => {
            const candidates = deposits.filter(
              (d) =>
                d.asset === withdrawModal.asset &&
                String(d.poolId ?? "") === String(withdrawModal.poolId)
            );
            return (
              (withdrawModal.configSymbol
                ? candidates.find(
                    (d) =>
                      String((d as Deposit).configSymbol ?? "") ===
                      String(withdrawModal.configSymbol)
                  )
                : undefined) ?? candidates[0]
            );
          })()
        : undefined) ??
      deposits.find((d) => d.asset === withdrawModal.asset);
    const token = resolveSupplyBorrowToken(
      tokens,
      withdrawModal.asset ?? "",
      withdrawModal.poolId,
      (withdrawalDeposit as Deposit | undefined)?.configSymbol ??
        withdrawModal.configSymbol,
      withdrawModal.marketId ?? ""
    );
    if (!token?.poolId || !token?.underlyingContractId) {
      setMaxWithdrawData(null);
      setFolksWithdrawMintOneAtomic(null);
      return;
    }
    const cfgSymForAdapter =
      token.configKey ?? token.originalSymbol ?? token.symbol;
    const rawTcForAdapter = getTokenConfig(
      networkToUse as NetworkId,
      cfgSymForAdapter
    );
    const tcForAdapter = Array.isArray(rawTcForAdapter)
      ? rawTcForAdapter.find(
          (c) => String(c.poolId) === String(token.poolId)
        ) ?? rawTcForAdapter[0]
      : rawTcForAdapter;
    if (tokenConfigHasNonFolksAdapter(tcForAdapter)) {
      setMaxWithdrawData(null);
      setFolksWithdrawMintOneAtomic(null);
      return;
    }

    const folksWithdrawSide = tcForAdapter
      ? getFolksAdapterForPhase(tcForAdapter, "withdraw") ??
        getFolksAdapterForPhase(tcForAdapter, "deposit")
      : undefined;

    if (folksWithdrawSide && networkToUse === "algorand-mainnet") {
      let cancelled = false;
      setMaxWithdrawData(null);
      const mintKey = `${networkToUse}|${cfgSymForAdapter}|${String(
        token.poolId ?? ""
      )}`;
      const cachedMint = folksMintedOneUnderlyingByKey?.[mintKey];
      (async () => {
        try {
          let mintedFAsset: bigint | null = null;
          if (cachedMint) {
            try {
              mintedFAsset = BigInt(cachedMint);
            } catch {
              mintedFAsset = null;
            }
          }
          if (mintedFAsset == null || mintedFAsset <= BigInt(0)) {
            const algodNet = getAlgorandNetworkFromNetworkId(networkToUse);
            if (!algodNet) return;
            const clients = algorandService.initializeClients(algodNet);
            const oneUnderlyingAtomic = BigInt(
              new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
            );
            const { mintedFAsset: fetched } =
              await estimateFolksDepositMintedFAssetAmount({
                poolName: folksWithdrawSide.folksParams.pool,
                underlyingAmount: oneUnderlyingAtomic,
                algod: clients.algod,
              });
            mintedFAsset = fetched;
          }
          if (!cancelled && mintedFAsset != null && mintedFAsset > BigInt(0)) {
            setFolksWithdrawMintOneAtomic(mintedFAsset.toString());
          } else if (!cancelled) {
            setFolksWithdrawMintOneAtomic(null);
          }
        } catch (e) {
          console.warn(
            "[PortfolioModals] Folks mint ratio for withdraw modal failed",
            e
          );
          if (!cancelled) setFolksWithdrawMintOneAtomic(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setFolksWithdrawMintOneAtomic(null);
    const minLiquidationThresholdBps =
      withdrawPoolCollateralMarkets.length > 0
        ? poolMinLiquidationThresholdBps(
            Math.min(
              ...withdrawPoolCollateralMarkets.map(
                (r) => r.liquidationThresholdPercent
              )
            )
          )
        : undefined;
    let cancelled = false;
    getMaxWithdrawableForMarket(
      token.poolId,
      token.underlyingContractId,
      activeAccount.address,
      networkToUse,
      token.decimals,
      minLiquidationThresholdBps !== undefined
        ? { minLiquidationThresholdBps }
        : undefined
    ).then(async (data) => {
      if (cancelled || !data) {
        if (!cancelled) setMaxWithdrawData(null);
        return;
      }
      let maxHumanUnderlying = data.maxWithdrawUnderlying;
      if (networkToUse === "algorand-mainnet") {
        const cfgSym =
          token.configKey ?? token.originalSymbol ?? token.symbol;
        const rawTc = getTokenConfig(networkToUse, cfgSym);
        const tc = Array.isArray(rawTc)
          ? rawTc.find((c) => String(c.poolId) === String(token.poolId)) ??
            rawTc[0]
          : rawTc;
        const folksForMax = tc
          ? getFolksAdapterForPhase(tc, "withdraw") ??
            getFolksAdapterForPhase(tc, "deposit")
          : undefined;
        if (folksForMax) {
          const algodNet = getAlgorandNetworkFromNetworkId(networkToUse);
          if (algodNet) {
            try {
              const oneUnderlyingAtomic = BigInt(
                new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
              );
              const mintKey = `${networkToUse}|${cfgSym}|${String(
                token.poolId ?? ""
              )}`;
              const cachedMint = folksMintedOneUnderlyingByKey?.[mintKey];
              let mintedFAsset: bigint | null = null;
              if (cachedMint) {
                try {
                  mintedFAsset = BigInt(cachedMint);
                } catch {
                  mintedFAsset = null;
                }
              }
              if (mintedFAsset == null || mintedFAsset <= BigInt(0)) {
                const clients = algorandService.initializeClients(algodNet);
                const { mintedFAsset: fetched } =
                  await estimateFolksDepositMintedFAssetAmount({
                    poolName: folksForMax.folksParams.pool,
                    underlyingAmount: oneUnderlyingAtomic,
                    algod: clients.algod,
                  });
                mintedFAsset = fetched;
              }
              if (mintedFAsset != null && mintedFAsset > BigInt(0)) {
                maxHumanUnderlying = folksFAssetHumanToUnderlyingHuman(
                  data.maxWithdrawUnderlying,
                  mintedFAsset,
                  token.decimals
                );
              }
            } catch (e) {
              console.warn(
                "[PortfolioModals] Folks f→underlying for HF-safe withdraw max failed",
                e
              );
            }
          }
        }
      }
      if (!cancelled) {
        setMaxWithdrawData({
          maxWithdrawUnderlying: maxHumanUnderlying,
          maxWithdrawScaled: data.maxWithdrawScaled.toString(),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    withdrawModal.isOpen,
    withdrawModal.asset,
    withdrawModal.poolId,
    withdrawModal.marketId,
    withdrawModal.configSymbol,
    withdrawModal.network,
    activeAccount?.address,
    currentNetwork,
    withdrawPoolCollateralMarkets,
    deposits,
    folksMintedOneUnderlyingByKey,
  ]);

  const getMarketStatsForDeposit = (
    asset: string,
    poolId?: string,
    marketId?: string
  ) => {
    const poolStr = poolId != null && poolId !== "" ? String(poolId) : "";
    let market = marketRowForPortfolioPosition(marketData, {
      marketId,
      poolId: poolStr || undefined,
      displaySymbol: asset,
    }) as any;

    if (!market && poolStr) {
      market = marketData.find(
        (m) => m.symbol === asset && String(m.poolId) === poolStr
      );
    }

    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    let deposit;
    if (marketId && poolStr) {
      deposit = deposits.find(
        (d) =>
          String((d as Deposit).marketId ?? "") === String(marketId) &&
          String(d.poolId ?? "") === poolStr
      );
    }
    if (!deposit && poolStr) {
      deposit = deposits.find(
        (d) => d.asset === asset && String(d.poolId ?? "") === poolStr
      );
    }

    if (!deposit) {
      deposit = deposits.find((d) => d.asset === asset);
    }

    // Only access user-specific data if wallet is connected
    // User deposit index comes from user.userData array in API response
    // Each item in user.userData has depositIndex for the matching market (by marketId and appId)
    const hasWallet = !!activeAccount?.address;
    const depositAny = deposit as any;

    // Check cache for indices
    const cacheKey = `${asset}-${poolId || "default"}-${marketId || ""}`;
    const cachedUserDepositIndex = userDepositIndexCache[cacheKey];
    const cachedCurrentDepositIndex = currentDepositIndexCache[cacheKey];

    // The depositIndex from user.userData is already included in the deposit object
    // when it was transformed from user.computed.deposits (which comes from user.userData)
    // This depositIndex is specific to the matching market (matched by marketId and appId)
    const userDepositIndexFromDeposit =
      depositAny?.userDepositIndex?.toString();

    // Calculate tokenPrice properly accounting for token decimals
    // Use the deposit's network so we get the correct token config (e.g. 8 decimals for goBTC on Algorand)
    // and match the Supplied Assets table USD value.
    const depositNetwork = depositAny?.network || currentNetwork;
    let tokenPrice = deposit?.tokenPrice || 1;
    if (market?.price) {
      try {
        // Get token config from the deposit's network (not currentNetwork)
        const tokens = getAllTokensWithDisplayInfo(depositNetwork);
        const token = resolveSupplyBorrowToken(
          tokens,
          asset,
          poolId,
          (depositAny as { configSymbol?: string })?.configSymbol,
          marketId
        );

        const tokenDecimals = token?.decimals ?? 6; // Default to 6 if not found

        // Oracle stores price in 12-decimal scale; convert to human price using token decimals
        const targetAdjustment = 12 - tokenDecimals;
        const divisor = Math.pow(10, targetAdjustment);

        const price = parseFloat(market.price);
        if (price && price > 0) {
          tokenPrice = price / divisor;
        }
      } catch (error) {
        console.error("Error calculating tokenPrice:", error);
        // Fallback: use deposit.tokenPrice if available, else 10^6 divisor
        tokenPrice =
          deposit?.tokenPrice ||
          parseFloat(market.price) / Math.pow(10, 6);
      }
    }

    // Safely resolve APY - avoid NaN when rates are undefined
    const supplyAPYRaw =
      market?.apyCalculation?.apy ??
      (typeof market?.supplyRate === "number" ? market.supplyRate * 100 : null) ??
      deposit?.apy ??
      null;
    const supplyAPY =
      typeof supplyAPYRaw === "number" && Number.isFinite(supplyAPYRaw)
        ? supplyAPYRaw
        : 0;

    const borrowAPYRaw =
      market?.borrowApyCalculation?.apy ??
      (typeof market?.borrowRateCurrent === "number"
        ? market.borrowRateCurrent * 100
        : null) ??
      (typeof market?.borrowRate === "number" ? market.borrowRate * 100 : null) ??
      null;
    const borrowAPY =
      typeof borrowAPYRaw === "number" && Number.isFinite(borrowAPYRaw)
        ? borrowAPYRaw
        : 0;

    const toBps = (v: number) => (v > 0 && v <= 1 ? Math.round(v * 10000) : Math.round(v));
    const apyParameters =
      market &&
      typeof market.borrowRate === "number" &&
      typeof market.slope === "number" &&
      typeof market.reserveFactor === "number"
        ? {
            borrowRateBps: toBps(market.borrowRate),
            slopeBps: toBps(market.slope),
            reserveFactorBps: toBps(market.reserveFactor),
          }
        : undefined;

    return {
      supplyAPY,
      borrowAPY,
      utilization: market?.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market?.collateralFactor
        ? market.collateralFactor * 100
        : 0,
      tokenPrice,
      totalDeposits: market?.totalDeposits
        ? parseFloat(market.totalDeposits)
        : undefined,
      totalBorrows: market?.totalBorrows
        ? parseFloat(market.totalBorrows)
        : undefined,
      apyParameters,
      marketCapacity: market?.maxTotalDeposits
        ? parseFloat(market.maxTotalDeposits)
        : undefined,
      accruedInterest:
        deposit?.accruedInterest !== undefined
          ? deposit.accruedInterest
          : undefined,
      // Use cached current deposit index (from contract) if available, otherwise fall back to market data
      currentDepositIndex:
        cachedCurrentDepositIndex || market?.depositIndex?.toString(),
      // Use cached value first (from contract), then deposit object (from API user.userData)
      // The deposit object's userDepositIndex comes from user.userData for the matching market
      userDepositIndex: hasWallet
        ? cachedUserDepositIndex || userDepositIndexFromDeposit || undefined
        : undefined,
      scaledDeposits:
        hasWallet && depositAny
          ? depositAny.scaledDeposits?.toString() || undefined
          : undefined,
      // lastUpdateTime can be a number (timestamp in seconds) or string (ISO)
      // Check both lastUpdateTime (from contract) and lastUpdated (from MarketInfo)
      lastUpdateTime: market?.lastUpdateTime || market?.lastUpdated,
      liquidationThreshold: market
        ? liquidationThresholdToPercent(
            market.liquidationThreshold ?? market.marketInfo?.liquidationThreshold
          )
        : undefined,
    };
  };

  const getMarketStatsForBorrow = (
    asset: string,
    poolId?: string,
    marketId?: string
  ) => {
    const poolStr = poolId != null && poolId !== "" ? String(poolId) : "";
    let market = marketRowForPortfolioPosition(marketData, {
      marketId,
      poolId: poolStr || undefined,
      displaySymbol: asset,
    }) as any;

    if (!market && poolStr) {
      market = marketData.find(
        (m) => m.symbol === asset && String(m.poolId) === poolStr
      );
    }

    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    let borrow;
    if (marketId && poolStr) {
      borrow = borrows.find(
        (b) =>
          String((b as Borrow).marketId ?? "") === String(marketId) &&
          String(b.poolId ?? "") === poolStr
      );
    }
    if (!borrow && poolStr) {
      borrow = borrows.find(
        (b) => b.asset === asset && String(b.poolId ?? "") === poolStr
      );
    }

    if (!borrow) {
      borrow = borrows.find((b) => b.asset === asset);
    }

    // Calculate health factor from userGlobalData
    // Use healthFactorIndex if available (calculated with individual market collateral factors)
    // Otherwise calculate from totalCollateral and totalBorrowed with 80% collateral factor
    let healthFactor: number | null = null;
    if (userGlobalData) {
      if (userGlobalData.healthFactorIndex !== undefined) {
        // Validate healthFactorIndex is valid
        if (
          userGlobalData.healthFactorIndex > 0 &&
          isFinite(userGlobalData.healthFactorIndex)
        ) {
          healthFactor = userGlobalData.healthFactorIndex;
          // healthFactorIndex is already capped at 3.0 in the calculation
        }
      } else if (userGlobalData.totalBorrowValue > 0) {
        // Fallback: use contract's totalCollateralValue directly
        // The contract's totalCollateralValue is already weighted with actual market collateral factors:
        // totalCollateralValue = sum(depositValue_i * collateralFactor_i)
        // So we can use it directly without applying a fixed 0.8 factor
        const calculated =
          userGlobalData.totalCollateralValue / userGlobalData.totalBorrowValue;

        // Validate calculation result
        if (calculated > 0 && isFinite(calculated)) {
          healthFactor = Math.min(calculated, 3.0); // Cap at 3.0 for display (consistent with Portfolio)
        } else {
          console.warn(
            "Invalid health factor calculation in getMarketStatsForBorrow:",
            {
              totalCollateralValue: userGlobalData.totalCollateralValue,
              totalBorrowValue: userGlobalData.totalBorrowValue,
              calculated,
            }
          );
          healthFactor = null;
        }
      } else if (userGlobalData.totalCollateralValue > 0) {
        // No borrows = excellent health (capped at 3.0)
        healthFactor = 3.0;
      }
    }

    // If both collateral and borrow are 0 or invalid, return null (data not loaded)
    // Only set to null if we haven't already calculated a valid health factor
    if (healthFactor === null && userGlobalData) {
      const hasCollateral = userGlobalData.totalCollateralValue > 0;
      const hasBorrows = userGlobalData.totalBorrowValue > 0;
      if (!hasCollateral && !hasBorrows) {
        // No position data - return null to indicate data not available
        healthFactor = null;
      }
    } else if (!userGlobalData) {
      // No userGlobalData at all - return null
      healthFactor = null;
    }

    // Calculate current LTV (Loan-to-Value ratio)
    const currentLTV =
      userGlobalData && userGlobalData.totalCollateralValue > 0
        ? (userGlobalData.totalBorrowValue /
            userGlobalData.totalCollateralValue) *
          100
        : 0;

    // Calculate liquidation margin
    // Liquidation margin = Liquidation Threshold - Current LTV
    // Use weighted liquidation threshold from borrowed assets, or market's threshold, or default 85%
    const liquidationThreshold = market?.liquidationThreshold
      ? market.liquidationThreshold * 100
      : 85; // Default 85%
    const liquidationMargin = Math.max(0, liquidationThreshold - currentLTV);

    const toBps = (v: number) => (v > 0 && v <= 1 ? Math.round(v * 10000) : Math.round(v));
    const num = (x: unknown): number | undefined =>
      x === undefined || x === null ? undefined : typeof x === "number" ? x : parseFloat(String(x));
    const br = num((market as any)?.borrowRate);
    const sl = num((market as any)?.slope);
    const rf = num((market as any)?.reserveFactor);
    const apyParameters =
      market && br != null && !Number.isNaN(br) && sl != null && !Number.isNaN(sl) && rf != null && !Number.isNaN(rf)
        ? {
            borrowRateBps: toBps(br),
            slopeBps: toBps(sl),
            reserveFactorBps: toBps(rf),
          }
        : undefined;

    const totalDepositsRaw =
      (market as any)?.totalDeposits ?? (market as any)?.total_deposits;
    const totalBorrowsRaw =
      (market as any)?.totalBorrows ?? (market as any)?.total_borrows;

    const parseTotal = (raw: unknown): number | undefined => {
      if (raw == null || raw === "") return undefined;
      const n = typeof raw === "number" ? raw : parseFloat(String(raw));
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    const stats = {
      borrowAPY:
        market?.borrowApyCalculation?.apy ||
        (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0) ||
        borrow?.apy ||
        0,
      liquidationMargin: liquidationMargin,
      healthFactor: healthFactor,
      currentLTV: currentLTV,
      tokenPrice: market?.price
        ? parseFloat(market.price) / Math.pow(10, 6)
        : borrow?.tokenPrice || 1,
      collateralFactor: market?.collateralFactor
        ? market.collateralFactor * 100
        : undefined,
      totalDeposits: parseTotal(totalDepositsRaw),
      totalBorrows: parseTotal(totalBorrowsRaw),
      apyParameters,
      isSToken: market?.isSToken ?? false,
    };

    // Debug logging for health factor calculation
    console.log("[PortfolioModals] getMarketStatsForBorrow Debug:", {
      asset,
      marketFound: !!market,
      borrowFound: !!borrow,
      userGlobalData: userGlobalData
        ? {
            totalCollateralValue: userGlobalData.totalCollateralValue,
            totalBorrowValue: userGlobalData.totalBorrowValue,
            healthFactorIndex: userGlobalData.healthFactorIndex,
          }
        : null,
      marketData: market
        ? {
            liquidationThreshold: market.liquidationThreshold,
            price: market.price,
            borrowRateCurrent: market.borrowRateCurrent,
            borrowApyCalculation: market.borrowApyCalculation,
          }
        : null,
      calculatedStats: stats,
      calculation: {
        healthFactor: {
          source:
            userGlobalData?.healthFactorIndex !== undefined
              ? "userGlobalData.healthFactorIndex"
              : userGlobalData
              ? "calculated from userGlobalData (using actual market collateral factors from contract)"
              : "fallback (0)",
          value: healthFactor,
        },
        currentLTV: {
          source: userGlobalData
            ? "calculated from userGlobalData"
            : "fallback (0)",
          value: currentLTV,
        },
        liquidationMargin: {
          source: market?.liquidationThreshold
            ? `market.liquidationThreshold (${liquidationThreshold}%) - currentLTV (${currentLTV}%)`
            : "fallback calculation",
          value: liquidationMargin,
        },
      },
    });

    return stats;
  };

  const getAssetData = (
    asset: string,
    poolId?: string,
    networkId?: string,
    configSymbol?: string,
    marketId?: string
  ) => {
    const poolStr = poolId != null && poolId !== "" ? String(poolId) : "";

    let market = marketRowForPortfolioPosition(marketData, {
      marketId,
      poolId: poolStr || undefined,
      displaySymbol: asset,
    }) as any;

    if (!market && poolStr) {
      const withPool = marketData.filter(
        (m) => m.symbol === asset && String(m.poolId) === poolStr
      );
      if (configSymbol && withPool.length > 1) {
        market = withPool.find(
          (m) => (m as { configSymbol?: string }).configSymbol === configSymbol
        );
      }
      if (!market) {
        market = withPool[0];
      }
    }

    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    let deposit;
    if (marketId && poolStr) {
      deposit = deposits.find(
        (d) =>
          String((d as Deposit).marketId ?? "") === String(marketId) &&
          String(d.poolId ?? "") === poolStr
      );
    }
    if (!deposit && poolStr) {
      const withPool = deposits.filter(
        (d) => d.asset === asset && String(d.poolId) === poolStr
      );
      if (configSymbol && withPool.length > 1) {
        deposit = withPool.find(
          (d) => (d as { configSymbol?: string }).configSymbol === configSymbol
        );
      }
      if (!deposit) {
        deposit = withPool[0];
      }
    }

    if (!deposit) {
      deposit = deposits.find((d) => d.asset === asset);
    }

    // If no market found but we have deposit data, create minimal asset data from deposit
    // This allows the modal to open even when market data isn't available for cross-network assets
    if (!market && deposit) {
      const tokenPrice = deposit.tokenPrice || 1;
      const depositApy =
        typeof deposit.apy === "number" && Number.isFinite(deposit.apy)
          ? deposit.apy
          : 0;
      return {
        icon: getTokenImagePath(asset),
        totalSupply: 0,
        totalSupplyUSD: 0,
        totalBorrow: 0,
        totalBorrowUSD: 0,
        supplyAPY: depositApy,
        borrowAPY: 0,
        utilization: 0,
        collateralFactor: 80, // Default 80%
        liquidationThreshold: 85, // Default 85% (same scale as collateralFactor)
        liquidity: 0,
        liquidityUSD: 0,
        tokenPrice: tokenPrice,
        walletBalance: 0,
        walletBalanceUSD: 0,
      };
    }

    if (!market) return null;

    const tokenPrice = market.price
      ? parseFloat(market.price) / Math.pow(10, 6)
      : 1;
    const totalSupply = parseFloat(market.totalDeposits) || 0;
    const totalBorrow = parseFloat(market.totalBorrows) || 0;

    // Safely resolve APY - avoid NaN in deposit modal
    const supplyAPYRaw =
      market.apyCalculation?.apy ??
      (typeof market.supplyRate === "number" ? market.supplyRate * 100 : null);
    const supplyAPY =
      typeof supplyAPYRaw === "number" && Number.isFinite(supplyAPYRaw)
        ? supplyAPYRaw
        : 0;
    const borrowAPYRaw =
      market.borrowApyCalculation?.apy ??
      (typeof market.borrowRateCurrent === "number"
        ? market.borrowRateCurrent * 100
        : null);
    const borrowAPY =
      typeof borrowAPYRaw === "number" && Number.isFinite(borrowAPYRaw)
        ? borrowAPYRaw
        : 0;

    // APY parameters for adjusted APY in modal (basis points). Market may have decimals (0-1) or bps.
    const toBps = (v: number) => (v > 0 && v <= 1 ? Math.round(v * 10000) : Math.round(v));
    const apyParameters =
      typeof market.borrowRate === "number" &&
      typeof market.slope === "number" &&
      typeof market.reserveFactor === "number"
        ? {
            borrowRateBps: toBps(market.borrowRate),
            slopeBps: toBps(market.slope),
            reserveFactorBps: toBps(market.reserveFactor),
          }
        : undefined;

    const liqPct = liquidationThresholdToPercent(
      market.liquidationThreshold ?? market.marketInfo?.liquidationThreshold
    );

    return {
      icon: getTokenImagePath(asset),
      totalSupply,
      totalSupplyUSD: totalSupply * tokenPrice,
      supplyAPY,
      totalBorrow,
      totalBorrowUSD: totalBorrow * tokenPrice,
      borrowAPY,
      utilization: market.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market.collateralFactor
        ? market.collateralFactor * 100
        : 0,
      liquidationThreshold: liqPct,
      liquidity: totalSupply - totalBorrow,
      liquidityUSD: (totalSupply - totalBorrow) * tokenPrice,
      maxTotalDeposits: parseFloat(market.maxTotalDeposits) || 0,
      maxTotalBorrows: parseFloat((market as { maxTotalBorrows?: string }).maxTotalBorrows ?? "0") || 0,
      reserveFactor: market.reserveFactor != null ? (market.reserveFactor <= 1 ? market.reserveFactor * 10000 : market.reserveFactor) : undefined,
      apyCalculation: market.apyCalculation,
      borrowApyCalculation: market.borrowApyCalculation,
      apyParameters,
      isSToken: market.isSToken ?? false,
    };
  };

  const handleWithdrawSubmit = async (
    amount: string,
    options?: {
      isMaxWithdraw?: boolean;
      withdrawAllConfirmed?: boolean;
      unsafeHealthFactorOverrideConfirmed?: boolean;
      withdrawAdapterId?: string;
    }
  ) => {
    if (!activeAccount?.address || !withdrawModal.asset) {
      console.error("No active account or asset for withdrawal");
      return;
    }

    try {
      console.log(`Withdrawing ${amount} ${withdrawModal.asset}`);

      // Match deposit by market when symbol + pool collide (e.g. Algo + fALGO).
      const deposit =
        deposits.find(
          (d) =>
            d.asset === withdrawModal.asset &&
            String(d.poolId ?? "") === String(withdrawModal.poolId ?? "") &&
            (withdrawModal.marketId == null ||
              withdrawModal.marketId === "" ||
              String((d as Deposit).marketId ?? "") ===
                String(withdrawModal.marketId)) &&
            (withdrawModal.configSymbol == null ||
              withdrawModal.configSymbol === "" ||
              String((d as Deposit).configSymbol ?? "") ===
                String(withdrawModal.configSymbol))
        ) ??
        (withdrawModal.poolId
          ? (() => {
              const candidates = deposits.filter(
                (d) =>
                  d.asset === withdrawModal.asset &&
                  String(d.poolId ?? "") === String(withdrawModal.poolId)
              );
              return (
                (withdrawModal.configSymbol
                  ? candidates.find(
                      (c) =>
                        String((c as Deposit).configSymbol ?? "") ===
                        String(withdrawModal.configSymbol)
                    )
                  : undefined) ?? candidates[0]
              );
            })()
          : undefined) ??
        deposits.find((d) => d.asset === withdrawModal.asset);

      // Use the deposit's network if available, otherwise fall back to currentNetwork
      const networkToUse =
        withdrawModal.network || (deposit as any)?.network || currentNetwork;

      // Get token configuration using the deposit's network
      const tokens = getAllTokensWithDisplayInfo(networkToUse);
      const token = resolveSupplyBorrowToken(
        tokens,
        withdrawModal.asset ?? "",
        withdrawModal.poolId,
        (deposit as Deposit)?.configSymbol ?? withdrawModal.configSymbol,
        withdrawModal.marketId ?? ""
      );

      if (!token?.poolId || !token.underlyingContractId) {
        throw new Error(
          `Token not found for ${withdrawModal.asset}${
            withdrawModal.poolId ? ` with poolId ${withdrawModal.poolId}` : ""
          } on network ${networkToUse}`
        );
      }

      const configLookupKey =
        token.configKey ?? token.originalSymbol ?? withdrawModal.asset;
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse,
        configLookupKey
      );
      if (!originalTokenConfigRaw) {
        throw new Error(
          `Token config not found for ${withdrawModal.asset} (configLookupKey: ${configLookupKey}) on network ${networkToUse}`
        );
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Token config not found for ${withdrawModal.asset} with poolId ${token.poolId} on network ${networkToUse}`
        );
      }

      console.log("Withdraw parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId,
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount,
        userAddress: activeAccount.address,
        networkId: networkToUse,
      });

      // withdrawAll / maxWithdrawScaled only when the user confirmed in the modal (withdraw-all checkbox).
      const withdrawAll = Boolean(options?.withdrawAllConfirmed);
      const result = await withdraw(
        token.poolId,
        token.underlyingContractId,
        originalTokenConfig.tokenStandard,
        amount,
        activeAccount.address,
        networkToUse,
        {
          withdrawAll,
          maxWithdrawScaled:
            withdrawAll &&
            options?.isMaxWithdraw &&
            maxWithdrawData?.maxWithdrawScaled
              ? BigInt(maxWithdrawData.maxWithdrawScaled)
              : undefined,
          withdrawAdapterId: options?.withdrawAdapterId,
        }
      );

      if (!result.success) {
        if ((result as any).error) {
          const message = (result as any).error.toLowerCase();
          if (message.includes("insufficient liquidity for withdraw")) {
            throw new Error(message);
          }
          throw new Error((result as any).error || "Withdraw failed");
        }
      }

      console.log("Withdraw result:", result);

      // Check if wallet is supported on the network for signing
      if (activeWallet) {
        const walletId = activeWallet.id?.toLowerCase() || "";
        const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const networkId = networkToUse as string;

        // Universal wallets support all AVM networks
        const isUniversalWallet =
          walletId === "lute" ||
          walletId === "kibisis" ||
          walletId === "vera" ||
          walletId === "biatec";

        // VOI-specific wallets only support VOI Mainnet
        const isVOIWallet = false;

        // Algorand-specific wallets only support Algorand Mainnet
        const isAlgorandWallet =
          walletId === "pera" ||
          walletId === "defly" ||
          walletName.includes("pera") ||
          walletName.includes("defly");

        // WalletConnect - check wallet name for specific restrictions
        const isWalletConnect = walletId === "walletconnect";
        let isWalletConnectVOI = false;
        let isWalletConnectAlgorand = false;

        if (isWalletConnect) {
          isWalletConnectVOI =
            walletName.includes("vera") || walletName.includes("biatec");
          isWalletConnectAlgorand =
            walletName.includes("pera") || walletName.includes("defly");
        }

        // Check if wallet supports the network
        const isSupported =
          isUniversalWallet ||
          (isVOIWallet && networkId === "voi-mainnet") ||
          (isAlgorandWallet && networkId === "algorand-mainnet") ||
          (isWalletConnect &&
            ((isWalletConnectVOI && networkId === "voi-mainnet") ||
              (isWalletConnectAlgorand && networkId === "algorand-mainnet") ||
              (!isWalletConnectVOI &&
                !isWalletConnectAlgorand &&
                currentNetwork === "voi-mainnet" &&
                networkId === "voi-mainnet") ||
              (!isWalletConnectVOI && !isWalletConnectAlgorand))) ||
          (!isVOIWallet && !isAlgorandWallet && !isWalletConnect); // Unknown wallet types allow all networks

        if (!isSupported) {
          const networkName =
            networkId === "voi-mainnet" ? "VOI Mainnet" : "Algorand Mainnet";
          throw new Error(
            `Your wallet (${
              activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the transaction`,
        duration: 10000,
      });

      // Sign and send transactions
      const stxns = await signTransactions(
        (result as any).txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the deposit's network (not currentNetwork)
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as any
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${networkToUse}`);
      }
      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      // Decode transactions to find the pool transaction ID
      const decodedStxns = stxns.map((txn: Uint8Array) => {
        return algosdk.decodeSignedTransaction(txn);
      });
      const poolTxnID = decodedStxns
        .reverse()
        .find(
          (txn: any) =>
            txn.txn.type === "appl" &&
            Number(txn.txn.applicationCall.appIndex) === parseInt(token.poolId)
        )
        ?.txn.txID();
      if (poolTxnID) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // Retry until metadata update succeeds
        let metadataUpdated = false;
        let retryCount = 0;
        const maxRetries = 10;
        const apiBaseUrl =
          import.meta.env.VITE_DORKFI_API_URL ||
          "https://dorkfi-api.nautilus.sh";
        const networkParam = networkToUse ? `?network=${networkToUse}` : "";

        while (!metadataUpdated && retryCount < maxRetries) {
          try {
            const response = await fetch(
              `${apiBaseUrl}/transaction-metadata/${poolTxnID}${networkParam}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const result = await response.json();
              console.log(
                "Transaction metadata successfully updated:",
                result.data
              );
              metadataUpdated = true;
            } else {
              const error = await response.json();
              throw new Error(
                error.error || "Failed to update transaction metadata"
              );
            }
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
              console.warn(
                `Metadata update attempt ${retryCount} failed, retrying in ${delay}ms:`,
                error
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              console.error(
                "Failed to update transaction metadata after all retries:",
                error
              );
            }
          }
        }
      }

      console.log("Withdraw transaction confirmed:", res);

      // Refresh wallet balance after successful withdrawal
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(withdrawModal.asset);
      }

      Promise.all([
        dorkfiAPIService.fetchFreshUserData(
          activeAccount.address,
          networkToUse,
          parseInt(token.poolId),
          parseInt(token.underlyingContractId)
        ),
        fetchMarketInfoFromContract(
          token.poolId,
          token.underlyingContractId,
          networkToUse as NetworkId
        ),
        dorkfiAPIService.fetchFreshUserHealth(
          networkToUse,
          parseInt(token.poolId),
          activeAccount.address
        ),
      ])
        .then(() => {
          if (onRefreshMarket) {
            setTimeout(() => {
              onRefreshMarket();
            }, 1000);
          }
        })
        .catch((error) => {
          console.error(
            "Error calling fetchFreshUserData after withdraw:",
            error
          );
        });

      // Close the modal
      onCloseWithdrawModal();
    } catch (error) {
      console.error("Withdraw error:", error);
      const errorMessage = getUserFriendlyError(error);

      // Show error toast to the user
      toast({
        title: "Withdraw Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // Re-throw the error so WithdrawModal can catch it and not show success modal
      throw error;
    }
  };

  // Track if we've already fetched balance for this modal open/asset combination
  const lastFetchedRef = useRef<{ isOpen: boolean; asset: string | null }>({
    isOpen: false,
    asset: null,
  });

  // Fetch wallet balance when repay modal opens
  useEffect(() => {
    if (
      repayModal.isOpen &&
      repayModal.asset &&
      activeAccount?.address &&
      onRefreshWalletBalance &&
      // Only fetch if modal just opened or asset changed
      (!lastFetchedRef.current.isOpen ||
        lastFetchedRef.current.asset !== repayModal.asset)
    ) {
      console.log(
        `[PortfolioModals] Fetching wallet balance for ${repayModal.asset} when repay modal opens`
      );
      onRefreshWalletBalance(repayModal.asset, repayModal.network);
      lastFetchedRef.current = { isOpen: true, asset: repayModal.asset };
    } else if (!repayModal.isOpen) {
      // Reset when modal closes
      lastFetchedRef.current = { isOpen: false, asset: null };
    }
  }, [
    repayModal.isOpen,
    repayModal.asset,
    repayModal.network,
    activeAccount?.address,
    onRefreshWalletBalance,
  ]);

  useEffect(() => {
    const needsPool =
      repayModal.isOpen && repayModal.asset && activeAccount?.address;
    if (!needsPool) {
      setRepayPoolGlobalUserData(undefined);
      return;
    }
    const networkToUse = (repayModal.network || currentNetwork) as NetworkId;
    const tokens = getAllTokensWithDisplayInfo(networkToUse);
    const tok = repayModal.poolId
      ? tokens.find(
          (t) =>
            t.symbol === repayModal.asset &&
            String(t.poolId) === String(repayModal.poolId)
        )
      : tokens.find((t) => t.symbol === repayModal.asset);
    const poolIdStr = repayModal.poolId
      ? String(repayModal.poolId)
      : tok?.poolId != null
        ? String(tok.poolId)
        : null;
    if (!poolIdStr) {
      setRepayPoolGlobalUserData(null);
      return;
    }
    let cancelled = false;
    fetchUserGlobalDataForPool(
      activeAccount.address,
      networkToUse,
      poolIdStr
    )
      .then((data) => {
        if (!cancelled) setRepayPoolGlobalUserData(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setRepayPoolGlobalUserData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    repayModal.isOpen,
    repayModal.asset,
    repayModal.poolId,
    repayModal.network,
    activeAccount?.address,
    currentNetwork,
  ]);

  const handleRepaySubmit = async (amount: string, isRepayAll?: boolean) => {
    if (!activeAccount?.address || !repayModal.asset) {
      console.error("No active account or asset for repayment");
      return;
    }

    try {
      console.log(`Repaying ${amount} ${repayModal.asset}${isRepayAll ? " (repayAll)" : ""}`);

      // Find the borrow to get its network
      const borrow = repayModal.poolId
        ? borrows.find(
            (b) =>
              b.asset === repayModal.asset && b.poolId === repayModal.poolId
          )
        : borrows.find((b) => b.asset === repayModal.asset);

      // Use the borrow's network if available, otherwise fall back to currentNetwork
      const networkToUse =
        repayModal.network || (borrow as any)?.network || currentNetwork;

      // Get token configuration using the borrow's network
      const tokens = getAllTokensWithDisplayInfo(networkToUse);
      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      const token = repayModal.poolId
        ? tokens.find(
            (t) =>
              t.symbol === repayModal.asset && t.poolId === repayModal.poolId
          )
        : tokens.find((t) => t.symbol === repayModal.asset);

      if (!token) {
        throw new Error(
          `Token not found for ${repayModal.asset}${
            repayModal.poolId ? ` with poolId ${repayModal.poolId}` : ""
          } on network ${networkToUse}`
        );
      }

      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token
          ? (token as any).originalSymbol
          : repayModal.asset;
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse,
        originalSymbol
      );
      if (!originalTokenConfigRaw) {
        throw new Error(
          `Token config not found for ${repayModal.asset} (originalSymbol: ${originalSymbol}) on network ${networkToUse}`
        );
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Token config not found for ${repayModal.asset} with poolId ${token.poolId} on network ${networkToUse}`
        );
      }

      console.log("Repay parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId, // Use marketId first like PreFi
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount, // Pass amount as string (not atomic units)
        userAddress: activeAccount.address,
        networkId: networkToUse,
        isRepayAll,
      });

      // Call the appropriate lending service method based on isRepayAll flag
      const result = isRepayAll
        ? await repayAll(
            token.poolId,
            token.underlyingContractId, // Use underlyingContractId
            originalTokenConfig.tokenStandard,
            amount, // Pass amount as string (though repayAll may not use it)
            activeAccount.address,
            networkToUse
          )
        : await repay(
            token.poolId,
            token.underlyingContractId, // Use underlyingContractId
            originalTokenConfig.tokenStandard,
            amount, // Pass amount as string
            activeAccount.address,
            networkToUse
          );

      if (!result.success) {
        throw new Error((result as any).error || "Repay failed");
      }

      console.log("Repay result:", result);

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the transaction`,
        duration: 10000,
      });

      // Sign and send transactions
      const stxns = await signTransactions(
        (result as any).txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the borrow's network (not currentNetwork)
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as any
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${networkToUse}`);
      }
      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();

      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      // Decode transactions to find the pool transaction ID
      const decodedStxns = stxns.map((txn: Uint8Array) => {
        return algosdk.decodeSignedTransaction(txn);
      });
      const poolTxnID = decodedStxns
        .reverse()
        .find(
          (txn: any) =>
            txn.txn.type === "appl" &&
            Number(txn.txn.applicationCall.appIndex) === parseInt(token.poolId)
        )
        ?.txn.txID();
      if (poolTxnID) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // Retry until metadata update succeeds
        let metadataUpdated = false;
        let retryCount = 0;
        const maxRetries = 10;
        const apiBaseUrl =
          import.meta.env.VITE_DORKFI_API_URL ||
          "https://dorkfi-api.nautilus.sh";
        const networkParam = networkToUse ? `?network=${networkToUse}` : "";

        while (!metadataUpdated && retryCount < maxRetries) {
          try {
            const response = await fetch(
              `${apiBaseUrl}/transaction-metadata/${poolTxnID}${networkParam}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const result = await response.json();
              console.log(
                "Transaction metadata successfully updated:",
                result.data
              );
              metadataUpdated = true;
            } else {
              const error = await response.json();
              throw new Error(
                error.error || "Failed to update transaction metadata"
              );
            }
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
              console.warn(
                `Metadata update attempt ${retryCount} failed, retrying in ${delay}ms:`,
                error
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              console.error(
                "Failed to update transaction metadata after all retries:",
                error
              );
            }
          }
        }
      }

      console.log("Repay transaction confirmed:", res);

      // Refresh wallet balance after successful repayment
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(repayModal.asset, networkToUse);
      }

      Promise.all([
        dorkfiAPIService.fetchFreshUserData(
          activeAccount.address,
          networkToUse,
          parseInt(token.poolId),
          parseInt(token.underlyingContractId)
        ),
        dorkfiAPIService.fetchFreshUserHealth(
          networkToUse,
          parseInt(token.poolId),
          activeAccount.address
        ),
      ])
        .then(() => {
          setTimeout(() => {
            onRefreshMarket();
          }, 1000);
        })
        .catch((error) => {
          console.error("Error calling fetchFreshUserData after repay:", error);
        });

      // Return the transaction ID so RepayModal can use it
      return res.txid;
    } catch (error) {
      console.error("Repay error:", error);
      const errorMessage = getUserFriendlyError(error);

      // Show error toast to the user
      toast({
        title: "Repay Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // Re-throw the error so RepayModal can catch it and not show success modal
      throw error;
    }
  };

  return (
    <>
      {depositModal.isOpen &&
        depositModal.asset &&
        getAssetData(
          depositModal.asset,
          depositModal.poolId,
          depositModal.network,
          depositModal.configSymbol,
          depositModal.marketId
        ) && (
          <SupplyBorrowModal
            isOpen={depositModal.isOpen}
            onClose={onCloseDepositModal}
            asset={depositModal.asset}
            poolId={depositModal.poolId}
            configSymbol={depositModal.configSymbol}
            marketId={depositModal.marketId}
            network={depositModal.network}
            mode="deposit"
            availableAssets={
              deposits.length > 0
                ? deposits.map((d) => {
                    const network = (d as { network?: string }).network;
                    const nid = network || currentNetwork;
                    const walletKey = portfolioWalletBalanceCacheKey(nid, {
                      marketId: (d as Deposit).marketId,
                      poolId: d.poolId,
                      configSymbol: (d as Deposit).configSymbol,
                      displaySymbol: d.asset,
                    });
                    const legacyKey = network ? `${network}-${d.asset}` : d.asset;
                    const walletBalanceForAsset =
                      walletBalances[walletKey]?.balance ??
                      walletBalances[legacyKey]?.balance ??
                      walletBalances[d.asset]?.balance ??
                      0;

                    return {
                      asset: d.asset,
                      icon: d.icon,
                      // Show wallet balance available to deposit (token units)
                      value: walletBalanceForAsset,
                      poolId: d.poolId,
                      network,
                    };
                  })
                : undefined
            }
            onSelectAsset={onSelectDepositAsset}
            assetData={getAssetData(
              depositModal.asset,
              depositModal.poolId,
              depositModal.network,
              depositModal.configSymbol,
              depositModal.marketId
            )}
            poolCollateralMarkets={depositPoolCollateralMarkets}
            walletBalance={
              depositModal.network
                ? walletBalances[
                    portfolioWalletBalanceCacheKey(depositModal.network, {
                      marketId: depositModal.marketId,
                      poolId: depositModal.poolId,
                      configSymbol: depositModal.configSymbol,
                      displaySymbol: depositModal.asset,
                    })
                  ]?.balance ||
                  walletBalances[
                    `${depositModal.network}-${depositModal.asset}`
                  ]?.balance ||
                  walletBalances[depositModal.asset]?.balance ||
                  0
                : walletBalances[depositModal.asset]?.balance || 0
            }
            walletBalanceUSD={
              depositModal.network
                ? walletBalances[
                    portfolioWalletBalanceCacheKey(depositModal.network, {
                      marketId: depositModal.marketId,
                      poolId: depositModal.poolId,
                      configSymbol: depositModal.configSymbol,
                      displaySymbol: depositModal.asset,
                    })
                  ]?.balanceUSD ||
                  walletBalances[
                    `${depositModal.network}-${depositModal.asset}`
                  ]?.balanceUSD ||
                  walletBalances[depositModal.asset]?.balanceUSD ||
                  0
                : walletBalances[depositModal.asset]?.balanceUSD || 0
            }
            walletBalanceLastUpdated={
              depositModal.network
                ? walletBalances[
                    portfolioWalletBalanceCacheKey(depositModal.network, {
                      marketId: depositModal.marketId,
                      poolId: depositModal.poolId,
                      configSymbol: depositModal.configSymbol,
                      displaySymbol: depositModal.asset,
                    })
                  ]?.lastUpdated ||
                  walletBalances[
                    `${depositModal.network}-${depositModal.asset}`
                  ]?.lastUpdated ||
                  walletBalances[depositModal.asset]?.lastUpdated
                : walletBalances[depositModal.asset]?.lastUpdated
            }
            onRefreshWalletBalance={
              depositModal.asset && onRefreshWalletBalance
                ? () =>
                    onRefreshWalletBalance(
                      depositModal.asset,
                      depositModal.network,
                      {
                        poolId: depositModal.poolId,
                        marketId: depositModal.marketId,
                        configSymbol: depositModal.configSymbol,
                      }
                    )
                : undefined
            }
            onDepositRouteChange={
              depositModal.asset && onRefreshWalletBalance
                ? () =>
                    onRefreshWalletBalance(
                      depositModal.asset,
                      depositModal.network,
                      {
                        poolId: depositModal.poolId,
                        marketId: depositModal.marketId,
                        configSymbol: depositModal.configSymbol,
                      }
                    )
                : undefined
            }
            onTransactionSuccess={async () => {
              // Refresh wallet balance immediately after successful transaction
              if (depositModal.asset && onRefreshWalletBalance) {
                onRefreshWalletBalance(
                  depositModal.asset,
                  depositModal.network,
                  {
                    poolId: depositModal.poolId,
                    marketId: depositModal.marketId,
                    configSymbol: depositModal.configSymbol,
                  }
                );
              }

              // Call fetchFreshUserData after deposit
              if (activeAccount?.address && depositModal.asset) {
                try {
                  const networkToUse = depositModal.network || currentNetwork;
                  const market = marketRowForPortfolioPosition(marketData, {
                    marketId: depositModal.marketId,
                    poolId: depositModal.poolId,
                    displaySymbol: depositModal.asset,
                  }) as any;

                  const appId =
                    market?.appId || market?.poolId || depositModal.poolId;
                  let marketIdResolved =
                    market?.marketInfo?.marketId ||
                    market?.marketId ||
                    depositModal.marketId;

                  if (!marketIdResolved) {
                    const tokens = getAllTokensWithDisplayInfo(
                      networkToUse as NetworkId
                    );
                    const token = resolveSupplyBorrowToken(
                      tokens,
                      depositModal.asset ?? "",
                      depositModal.poolId,
                      depositModal.configSymbol,
                      depositModal.marketId
                    );
                    marketIdResolved = token?.underlyingContractId;
                  }

                  if (appId && marketIdResolved) {
                    const appIdNum =
                      typeof appId === "string" ? parseInt(appId) : appId;
                    const marketIdNum =
                      typeof marketIdResolved === "string"
                        ? parseInt(marketIdResolved)
                        : marketIdResolved;

                    console.log("Calling fetchFreshUserData after deposit:", {
                      userAddress: activeAccount.address,
                      network: networkToUse,
                      appId: appIdNum,
                      marketId: marketIdNum,
                    });

                    Promise.all([
                      dorkfiAPIService.fetchFreshUserData(
                        activeAccount.address,
                        networkToUse,
                        appIdNum,
                        marketIdNum
                      ),
                      fetchMarketInfoFromContract(
                        String(appIdNum),
                        String(marketIdNum),
                        networkToUse as NetworkId
                      ),
                      dorkfiAPIService.fetchFreshUserHealth(
                        networkToUse,
                        appIdNum,
                        activeAccount.address
                      ),
                    ])
                      .then(() => {
                        onRefreshMarket();
                      })
                      .catch((error) => {
                        console.error(
                          "Error calling fetchFreshUserData after deposit:",
                          error
                        );
                      });
                  } else {
                    console.warn(
                      "Could not find appId or marketId for fetchFreshUserData:",
                      {
                        asset: depositModal.asset,
                        poolId: depositModal.poolId,
                        network: networkToUse,
                        appId,
                        marketId: marketIdResolved,
                      }
                    );
                  }
                } catch (error) {
                  console.error(
                    "Error calling fetchFreshUserData after deposit:",
                    error
                  );
                  // Don't throw - this is a background refresh, shouldn't block the UI
                }

                // Refresh market data after successful deposit
                if (onRefreshMarket) {
                  setTimeout(() => {
                    onRefreshMarket();
                  }, 1000); // Small delay to ensure transaction is fully processed
                }
              }
            }}
          />
        )}

      {withdrawModal.isOpen &&
        withdrawModal.asset &&
        (() => {
          const networkW = (withdrawModal.network || currentNetwork) as NetworkId;
          let deposit: Deposit | undefined;
          if (withdrawModal.marketId && withdrawModal.poolId) {
            deposit = deposits.find(
              (d) =>
                String((d as Deposit).marketId ?? "") ===
                  String(withdrawModal.marketId) &&
                String(d.poolId ?? "") === String(withdrawModal.poolId)
            );
          }
          if (!deposit && withdrawModal.poolId) {
            const candidates = deposits.filter(
              (d) =>
                d.asset === withdrawModal.asset &&
                String(d.poolId ?? "") === String(withdrawModal.poolId)
            );
            deposit =
              (withdrawModal.configSymbol
                ? candidates.find(
                    (d) =>
                      String((d as Deposit).configSymbol ?? "") ===
                      String(withdrawModal.configSymbol)
                  )
                : undefined) ?? candidates[0];
          }
          if (!deposit) {
            deposit = deposits.find((d) => d.asset === withdrawModal.asset);
          }

          const tokens = getAllTokensWithDisplayInfo(networkW);
          const withdrawToken = resolveSupplyBorrowToken(
            tokens,
            withdrawModal.asset ?? "",
            withdrawModal.poolId,
            withdrawModal.configSymbol,
            withdrawModal.marketId
          );
          const cfgSymW =
            withdrawToken.configKey ??
            withdrawToken.originalSymbol ??
            withdrawToken.symbol;
          const rawTcW = getTokenConfig(networkW, cfgSymW);
          const tcWithdraw = Array.isArray(rawTcW)
            ? rawTcW.find(
                (c) => String(c.poolId) === String(withdrawToken.poolId)
              ) ?? rawTcW[0]
            : rawTcW;
          const disableHealthFactorWithdrawSafety =
            tokenConfigHasAdapters(tcWithdraw);

          const folksWithdrawAdapters = tcWithdraw
            ? getFolksAdaptersForPhase(tcWithdraw, "withdraw")
            : [];

          const withdrawAmountIsUnderlying =
            folksWithdrawAdapters.length > 0 &&
            tcWithdraw?.tokenStandard === "network-asa";

          const underlyingDepositAdapter = tcWithdraw
            ? getFolksAdaptersForPhase(tcWithdraw, "deposit").find(
                (a) =>
                  (a.depositWalletBasis ?? "underlying") === "underlying" &&
                  folksWithdrawAdapters.some(
                    (w) => w.folksParams.pool === a.folksParams.pool
                  )
              )
            : undefined;

          let mintBiWithdraw: bigint | null = null;
          if (folksWithdrawMintOneAtomic?.trim()) {
            try {
              const v = BigInt(folksWithdrawMintOneAtomic.trim());
              mintBiWithdraw = v > BigInt(0) ? v : null;
            } catch {
              mintBiWithdraw = null;
            }
          }

          const currentlyDepositedDisplay =
            withdrawAmountIsUnderlying &&
            mintBiWithdraw != null &&
            deposit?.balance != null
              ? folksFAssetHumanToUnderlyingHuman(
                  deposit.balance,
                  mintBiWithdraw,
                  withdrawToken.decimals ?? 6
                )
              : withdrawAmountIsUnderlying
                ? 0
                : deposit?.balance ?? 0;

          const amountSymbolW = withdrawAmountIsUnderlying
            ? String(
                underlyingDepositAdapter?.name ??
                  underlyingDepositAdapter?.label ??
                  "ALGO"
              )
            : undefined;

          const marketPositionSym = withdrawAmountIsUnderlying
            ? withdrawToken.originalSymbol ?? withdrawToken.symbol
            : undefined;

          return (
            <WithdrawModal
              isOpen={withdrawModal.isOpen}
              onClose={onCloseWithdrawModal}
              tokenSymbol={withdrawModal.asset}
              tokenIcon={getTokenImagePath(withdrawModal.asset)}
              availableAssets={deposits.map((d) => ({
                asset: d.asset,
                icon: d.icon,
                value: d.value,
                poolId: d.poolId,
                // @ts-expect-error optional network on deposit
                network: d.network,
                marketId: d.marketId,
                configSymbol: d.configSymbol,
              }))}
              selectedMarketId={withdrawModal.marketId}
              selectedConfigSymbol={withdrawModal.configSymbol}
              onSelectAsset={onSelectWithdrawAsset}
              currentlyDeposited={currentlyDepositedDisplay}
              positionBalanceForIndexStats={
                withdrawAmountIsUnderlying && deposit?.balance != null
                  ? deposit.balance
                  : undefined
              }
              positionMarketTokenHuman={deposit?.balance}
              marketStats={getMarketStatsForDeposit(
                withdrawModal.asset,
                withdrawModal.poolId,
                withdrawModal.marketId
              )}
              maxWithdrawUnderlying={maxWithdrawData?.maxWithdrawUnderlying ?? undefined}
              tokenDecimals={withdrawToken?.decimals ?? 8}
              poolId={withdrawModal.poolId}
              network={withdrawModal.network || currentNetwork}
              poolCollateralMarkets={withdrawPoolCollateralMarkets}
              poolHasNoBorrows={
                !userGlobalData?.totalBorrowValue ||
                userGlobalData.totalBorrowValue === 0
              }
              disableHealthFactorWithdrawSafety={
                disableHealthFactorWithdrawSafety
              }
              withdrawAmountIsUnderlying={withdrawAmountIsUnderlying}
              amountSymbol={amountSymbolW}
              folksMintOneUnderlyingAtomic={
                folksWithdrawMintOneAtomic ?? undefined
              }
              marketPositionSymbol={marketPositionSym}
              folksWithdrawAdapters={folksWithdrawAdapters}
              onSubmit={handleWithdrawSubmit}
              onRefreshBalance={() => {
                // Refresh market data
                if (onRefreshMarket) {
                  onRefreshMarket();
                }
              }}
            />
          );
        })()}

      {borrowModal.isOpen &&
        borrowModal.asset &&
        getAssetData(
          borrowModal.asset,
          borrowModal.poolId,
          borrowModal.network,
          borrowModal.configSymbol,
          borrowModal.marketId
        ) &&
        (borrowModal.asset === "WAD" ? (
          <MintModal
            isOpen={borrowModal.isOpen}
            onClose={onCloseBorrowModal}
            asset={borrowModal.asset}
            poolId={borrowModal.poolId}
            network={borrowModal.network}
            assetData={getAssetData(
              borrowModal.asset,
              borrowModal.poolId,
              borrowModal.network,
              borrowModal.configSymbol,
              borrowModal.marketId
            )}
            userGlobalData={userGlobalData}
            userBorrowBalance={userBorrowBalance || 0}
            onTransactionSuccess={() => {
              if (onRefreshMarket) {
                setTimeout(() => {
                  onRefreshMarket();
                }, 1000);
              }
            }}
          />
        ) : (
          <SupplyBorrowModal
            isOpen={borrowModal.isOpen}
            onClose={onCloseBorrowModal}
            asset={borrowModal.asset}
            poolId={borrowModal.poolId}
            configSymbol={borrowModal.configSymbol}
            marketId={borrowModal.marketId}
            marketRowKey={borrowModal.marketRowKey}
            network={borrowModal.network}
            mode="borrow"
            assetData={getAssetData(
              borrowModal.asset,
              borrowModal.poolId,
              borrowModal.network,
              borrowModal.configSymbol,
              borrowModal.marketId
            )}
            availableAssets={borrowMarketPickerAssets}
            onSelectAsset={onSelectBorrowMarket}
            userGlobalData={userGlobalData}
            userBorrowBalance={userBorrowBalance || 0}
            poolCollateralMarkets={borrowPoolCollateralMarkets}
            onTransactionSuccess={() => {
              if (onRefreshMarket) {
                setTimeout(() => {
                  onRefreshMarket();
                }, 1000);
              }
            }}
          />
        ))}

      {repayModal.isOpen &&
        repayModal.asset &&
        (() => {
          let borrow: Borrow | undefined;
          if (repayModal.marketId && repayModal.poolId) {
            borrow = borrows.find(
              (b) =>
                String((b as Borrow).marketId ?? "") ===
                  String(repayModal.marketId) &&
                String(b.poolId ?? "") === String(repayModal.poolId)
            );
          }
          if (!borrow && repayModal.poolId) {
            borrow = borrows.find(
              (b) =>
                b.asset === repayModal.asset && b.poolId === repayModal.poolId
            );
          }
          if (!borrow) {
            borrow = borrows.find((b) => b.asset === repayModal.asset);
          }

          let market = marketRowForPortfolioPosition(marketData, {
            marketId: repayModal.marketId,
            poolId: repayModal.poolId,
            displaySymbol: repayModal.asset,
          }) as any;

          if (!market) {
            const matchingMarkets = marketData.filter(
              (m) => m.symbol === repayModal.asset
            );
            if (matchingMarkets.length > 1) {
              market = matchingMarkets.reduce((prev, current) => {
                const prevDeposits = parseFloat(prev.totalDeposits || "0");
                const currentDeposits = parseFloat(current.totalDeposits || "0");
                return currentDeposits > prevDeposits ? current : prev;
              });
            } else {
              market = matchingMarkets[0];
            }
          }

          // Get market's lastUpdateTime (from contract, in seconds)
          // Prefer lastUpdateTime from contract over lastUpdated (which is just when we fetched it)
          // formatRelativeTime expects seconds, so we keep it in seconds
          const marketLastUpdateTime = market?.lastUpdateTime
            ? typeof market.lastUpdateTime === "string"
              ? Number(market.lastUpdateTime) // Contract returns seconds as string
              : typeof market.lastUpdateTime === "number"
              ? market.lastUpdateTime < 1e12
                ? market.lastUpdateTime // Already in seconds
                : Math.floor(market.lastUpdateTime / 1000) // Convert milliseconds to seconds
              : undefined
            : market?.lastUpdated
            ? typeof market.lastUpdated === "string"
              ? Math.floor(new Date(market.lastUpdated).getTime() / 1000) // Convert ISO to seconds
              : typeof market.lastUpdated === "number"
              ? market.lastUpdated < 1e12
                ? market.lastUpdated // Already in seconds
                : Math.floor(market.lastUpdated / 1000) // Convert milliseconds to seconds
              : undefined
            : undefined;

          // Get user's last update time (when user last interacted with market)
          // userGlobalData.lastUpdateTime is already in seconds (Unix timestamp)
          const userLastUpdateTime = userGlobalData?.lastUpdateTime
            ? typeof userGlobalData.lastUpdateTime === "number"
              ? userGlobalData.lastUpdateTime < 1e12
                ? userGlobalData.lastUpdateTime // Already in seconds
                : Math.floor(userGlobalData.lastUpdateTime / 1000) // Convert milliseconds to seconds
              : undefined
            : undefined;

          const repayAssetData = getAssetData(
            repayModal.asset,
            repayModal.poolId,
            repayModal.network,
            repayModal.configSymbol,
            repayModal.marketId
          );

          return (
            <RepayModal
              isOpen={repayModal.isOpen}
              onClose={onCloseRepayModal}
              tokenSymbol={repayModal.asset}
              tokenIcon={getTokenImagePath(repayModal.asset)}
              poolId={repayModal.poolId}
              network={
                repayModal.network || (borrow as any)?.network || currentNetwork
              }
              currentBorrow={borrow?.balance || 0}
              accruedInterest={borrow?.interest || 0}
              walletBalance={
                repayModal.network
                  ? walletBalances[
                      portfolioWalletBalanceCacheKey(repayModal.network, {
                        marketId: repayModal.marketId,
                        poolId: repayModal.poolId,
                        configSymbol: repayModal.configSymbol,
                        displaySymbol: repayModal.asset,
                      })
                    ]?.balance ||
                    walletBalances[
                      `${repayModal.network}-${repayModal.asset}`
                    ]?.balance ||
                    walletBalances[repayModal.asset]?.balance ||
                    0
                  : walletBalances[repayModal.asset]?.balance || 0
              }
              marketStats={getMarketStatsForBorrow(
                repayModal.asset,
                repayModal.poolId,
                repayModal.marketId
              )}
              poolGlobalUserData={repayPoolGlobalUserData}
              poolCollateralMarkets={repayPoolCollateralMarkets}
              liquidationThresholdPercent={
                repayAssetData?.liquidationThreshold ?? null
              }
              lastUpdateTime={marketLastUpdateTime}
              userLastUpdateTime={userLastUpdateTime}
              availableAssets={
                borrows.length > 0
                  ? borrows.map((b) => ({
                      asset: b.asset,
                      icon: b.icon,
                      value: b.value,
                      poolId: b.poolId,
                      network: (b as { network?: string }).network,
                    }))
                  : undefined
              }
              onSelectAsset={onSelectRepayAsset}
              onSubmit={handleRepaySubmit}
            />
          );
        })()}
    </>
  );
};

export default PortfolioModals;
