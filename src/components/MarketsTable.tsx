import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownUp,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Fuel,
  CircleArrowUp,
} from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAllTokensWithDisplayInfo,
  getFolksAdaptersForPhase,
  getTokenConfig,
  resolveTokenConfigFromDisplayToken,
  resolveTokenForMarketPosition,
  getAlgorandNetworkFromNetworkId,
  tokenStandardUsesNativeWalletBalance,
} from "@/config";
import { marketContractIdFromRowCacheKey } from "@/hooks/useOnDemandMarketData";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

import {
  useOnDemandMarketData,
  marketRowCacheKey,
  SortField,
  SortOrder,
  type MarketFilter,
} from "@/hooks/useOnDemandMarketData";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import MarketSearchFilters from "@/components/markets/MarketSearchFilters";
import MarketsPageGuidance from "@/components/markets/MarketsPageGuidance";
import MarketPagination from "@/components/markets/MarketPagination";
import MarketsHeroSection from "@/components/markets/MarketsHeroSection";
import MarketsTableContent from "@/components/markets/MarketsTableContent";

const SupplyBorrowModal = lazy(() => import("@/components/SupplyBorrowModal"));
const WithdrawModal = lazy(() => import("@/components/WithdrawModal"));
const PremiumMarketModal = lazy(() =>
  import("@/components/market-modal/PremiumMarketModal").then((m) => ({
    default: m.PremiumMarketModal,
  }))
);
const MintModal = lazy(() => import("@/components/MintModal"));
const TinymanSwapModal = lazy(() => import("@/components/TinymanSwapModal"));
import {
  fetchUserGlobalData,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  fetchGlobalUserRowsFromChain,
  getMaxWithdrawableForMarket,
  migrate,
  deposit,
  fetchMarketInfo,
  isMarketPaused,
} from "@/services/lendingService";
import { withRpcReadCache } from "@/utils/rpcReadCache";
import { computePortfolioDisplayHealthFactor } from "@/utils/portfolioDisplayHealthFactor";
import type {
  UserPosition as MarketDetailUserPosition,
  UserPositionLoadState,
} from "@/components/market-modal/types";
import { normalizeWadUsdPerToken, roundUsdToCents, cn } from "@/lib/utils";
import { spendableAlgoHumanFromAccount } from "@/utils/algorandWalletBalance";
import {
  getCachedAccountInformation,
  getCachedAsaHoldingAtomic,
  invalidateWalletBalanceRpc,
} from "@/utils/walletBalanceRpc";
import { useToast } from "@/hooks/use-toast";
import { isAtDepositCap, isAtBorrowCap } from "@/constants/lendingCaps";
import algosdk, { waitForConfirmation } from "algosdk";
import { abi, CONTRACT } from "ulujs";
import {
  getCurrentNetworkConfig,
  isAlgorandCompatibleNetwork,
  isCurrentNetworkVOI,
  isCurrentNetworkAlgorand,
  getNetworkConfig,
  getEnabledNetworks,
  type NetworkId,
} from "@/config";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import BigNumber from "bignumber.js";
import { updateTransactionMetadata } from "@/utils/transactionUtils";
import {
  fetchPoolCollateralMarketRowsForDeposit,
  type PoolCollateralMarketRow,
} from "@/utils/poolCollateralMarketRows";
import { getNetworkLogoPath } from "@/utils/tokenImageUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { useRewardsAprBonusMap } from "@/hooks/useRewardsAprBonusMap";
import {
  XchainUsdcBridgeControls,
  shouldShowXchainUsdcBridgeControls,
} from "@/components/xchain/XchainUsdcBridgeControls";
import {
  createDebouncedPrefetch,
  warmMarketDetailUserPositionRpc,
  warmBorrowModalMaxAndPool,
  poolIdFromMarketRow,
  marketRowKeyFromMarket,
  type MarketActionTokenParams,
} from "@/utils/modalPrefetch";
import { buildMarketHoverHandlers } from "@/utils/modalHoverHandlers";
import { resolveUsdPerTokenFromMarketInfo } from "@/utils/assetDecimals";

const MAX_CLAIMS_PER_TX = 3;

/** Token decimals for oracle USD math — match `getAssetData` (config wins over stale API rows). */
function resolveMarketRowTokenDecimals(
  md: Record<string, unknown>,
  networkId?: NetworkId
): number {
  if (networkId) {
    const asset = String(md.asset ?? md.symbol ?? "");
    const poolId =
      md.poolId != null && String(md.poolId) !== ""
        ? String(md.poolId)
        : undefined;
    const configSymbol =
      typeof md.configSymbol === "string" ? md.configSymbol : undefined;
    const rowKey = (md as { _sortKey?: string })._sortKey;
    const mi = md.marketInfo as { marketId?: string | number } | undefined;
    const marketContractId =
      (rowKey ? marketContractIdFromRowCacheKey(rowKey) : undefined) ??
      (mi?.marketId != null && String(mi.marketId).trim() !== ""
        ? String(mi.marketId)
        : undefined);

    const token = resolveTokenForMarketPosition(networkId, {
      asset,
      poolId,
      configSymbol,
      marketContractId,
    });
    const fromConfig = Number(token?.decimals);
    if (Number.isFinite(fromConfig) && fromConfig > 0) {
      return fromConfig;
    }
  }

  const mi = md.marketInfo as { decimals?: number } | undefined;
  const fromMi = Number(mi?.decimals);
  if (Number.isFinite(fromMi) && fromMi > 0) {
    return fromMi;
  }

  return 6;
}

/** Map on-demand market row → PremiumMarketModal `MarketData` (USD fields in whole dollars like the markets table). */
function normalizeMarketData(
  md: Record<string, unknown>,
  networkId?: NetworkId
) {
  const totalSupplyUSD = Number(md.totalSupplyUSD ?? 0);
  const totalBorrowUSD = Number(md.totalBorrowUSD ?? 0);
  const supplyUsdWhole = Math.max(0, Math.round(totalSupplyUSD / 1_000_000));
  const borrowUsdWhole = Math.max(0, Math.round(totalBorrowUSD / 1_000_000));
  const availableUsdWhole = Math.max(0, supplyUsdWhole - borrowUsdWhole);

  const mi = md.marketInfo as Record<string, unknown> | undefined;
  const supplyTokensHuman = Number(md.totalSupply ?? 0);
  const assetSym = String(md.asset ?? md.symbol ?? "").toUpperCase();
  const isWad = assetSym === "WAD";

  const tokenDecimals = resolveMarketRowTokenDecimals(md, networkId);

  let price = 0;
  if (isWad) {
    // WAD-only: oracle is often micro-USD per token; TVL from hook is micro-USD.
    const oracleStr =
      mi?.price != null ? String(mi.price).replace(/,/g, "").trim() : "";
    const oracleUsd =
      oracleStr !== "" ? Number.parseFloat(oracleStr) : Number.NaN;
    if (Number.isFinite(oracleUsd) && oracleUsd > 0) {
      price = normalizeWadUsdPerToken(oracleUsd);
    }
  } else if (mi?.price != null) {
    price = resolveUsdPerTokenFromMarketInfo(
      {
        price: String(mi.price),
        oracleUsdPerToken:
          typeof mi.oracleUsdPerToken === "number"
            ? mi.oracleUsdPerToken
            : undefined,
      },
      tokenDecimals
    );
  }

  // Fallback: TVL-implied price when oracle field is missing.
  if (!(price > 0 && Number.isFinite(price))) {
    if (
      supplyTokensHuman > 0 &&
      Number.isFinite(totalSupplyUSD) &&
      totalSupplyUSD > 0
    ) {
      price = totalSupplyUSD / 1_000_000 / supplyTokensHuman;
    }
  }

  const utilization = Number(md.utilization ?? 0);

  const parseRateFraction = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return v > 1 ? v / 10000 : v;
    }
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number.parseFloat(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n > 1 ? n / 10000 : n;
    }
    return undefined;
  };
  const borrowRateFrac =
    parseRateFraction(mi?.borrowRate) ?? parseRateFraction(md.borrowRate);
  const slopeFrac =
    parseRateFraction(mi?.slope) ?? parseRateFraction(md.slope);

  const baseSupplyApy = Number(md.supplyAPY ?? 0);
  const rewardsBonus =
    typeof md.rewardsBonusSupplyAprPercent === "number" &&
    !Number.isNaN(md.rewardsBonusSupplyAprPercent)
      ? md.rewardsBonusSupplyAprPercent
      : 0;
  const intrinsicBonus =
    typeof md.intrinsicSupplyApyPercent === "number" &&
    !Number.isNaN(md.intrinsicSupplyApyPercent)
      ? md.intrinsicSupplyApyPercent
      : 0;
  const intrinsicBorrowBonus =
    typeof md.intrinsicBorrowApyPercent === "number" &&
    !Number.isNaN(md.intrinsicBorrowApyPercent)
      ? md.intrinsicBorrowApyPercent
      : 0;

  return {
    icon: String(md.icon ?? ""),
    name: String(md.asset ?? md.name ?? "Unknown"),
    symbol: String(md.asset ?? md.symbol ?? "???"),
    price,
    priceChange24h: Number(md.priceChange24h ?? 0),
    priceHistory:
      (md.priceHistory as { time: number; price: number }[]) ?? [],
    totalSupply: supplyUsdWhole,
    totalBorrow: borrowUsdWhole,
    availableLiquidity: availableUsdWhole,
    utilization,
    supplyAPY: baseSupplyApy + rewardsBonus + intrinsicBonus,
    borrowAPY: Number(md.borrowAPY ?? 0) + intrinsicBorrowBonus,
    ...(borrowRateFrac !== undefined ? { borrowRate: borrowRateFrac } : {}),
    ...(slopeFrac !== undefined ? { slope: slopeFrac } : {}),
    maxLTV: Number(md.maxLTV ?? md.collateralFactor ?? 0),
    liquidationThreshold: Number(md.liquidationThreshold ?? 0),
    liquidationBonus: Number(
      md.liquidationPenalty ?? md.liquidationBonus ?? 0
    ),
    reserveFactor: Number(md.reserveFactor ?? 0),
    supplyCap: Number(md.supplyCap ?? 0),
    borrowCap: Number(md.borrowCap ?? 0),
    oracleStatus:
      md.oracleStatus === "stale"
        ? ("stale" as const)
        : ("live" as const),
    auditProvider: String(md.auditProvider ?? "N/A"),
  };
}

function poolIdFromMarketRow(market: Record<string, unknown>): string | undefined {
  const direct = market.poolId;
  if (direct != null && String(direct) !== "") return String(direct);
  const mi = market.marketInfo as { poolId?: string } | undefined;
  if (mi?.poolId != null && String(mi.poolId) !== "") return String(mi.poolId);
  return undefined;
}

/** Matches `useOnDemandMarketData` cache keys (canonical symbol + optional pool id). */
function marketKeyForOnDemandLoad(
  poolId: string | undefined,
  configSymbol: string | undefined,
  displayAssetFallback: string
): string {
  return marketRowCacheKey({
    originalSymbol: configSymbol,
    symbol: displayAssetFallback,
    poolId,
  });
}

/** Find the current row on the markets page; prefer `_sortKey` when display asset + pool collide. */
function findMarketRowOnPage(
  pageMarkets: Record<string, unknown>[],
  asset: string,
  poolId?: string,
  marketRowKey?: string
): Record<string, unknown> | null {
  if (marketRowKey) {
    const byKey = pageMarkets.find(
      (m) => (m as { _sortKey?: string })._sortKey === marketRowKey
    );
    if (byKey) return byKey;
  }
  if (poolId != null && poolId !== "") {
    const found = pageMarkets.find(
      (m) =>
        String(m.asset) === asset &&
        String((m.poolId as string | undefined) ?? "") === String(poolId)
    );
    return found ?? null;
  }
  const found = pageMarkets.find((m) => String(m.asset) === asset);
  return found ?? null;
}

/** Prefer full `marketsData` cache (all rows); fall back to current page. */
function findMarketRow(
  marketsData: Record<string, Record<string, unknown>>,
  pageMarkets: Record<string, unknown>[],
  asset: string,
  poolId?: string,
  marketRowKey?: string
): Record<string, unknown> | null {
  if (marketRowKey && marketsData[marketRowKey]) {
    return { ...marketsData[marketRowKey], _sortKey: marketRowKey };
  }
  return findMarketRowOnPage(pageMarkets, asset, poolId, marketRowKey);
}

function networkIdToChainId(
  networkId: string
): "voi" | "algorand" {
  return networkId.toLowerCase().includes("algorand") ? "algorand" : "voi";
}

/** Wallet cache key: same display `asset` can map to multiple pools (e.g. Algo vs fAlgo). */
function marketsTableWalletBalanceCacheKey(
  asset: string,
  poolId?: string,
  marketRowKey?: string
): string {
  return `${asset}|p=${poolId ?? ""}|rk=${marketRowKey ?? ""}`;
}

const WALLET_BALANCES_SESSION_TTL_MS = 60_000;

function marketsWalletBalancesSessionKey(
  networkId: string,
  address: string
): string {
  return `dorkfi:walletBalances:${networkId}:${address}`;
}

function readMarketsWalletBalancesSession(
  networkId: string,
  address: string
): Record<string, { balance: number; balanceUSD: number }> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(
      marketsWalletBalancesSessionKey(networkId, address)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: Record<string, { balance: number; balanceUSD: number }>;
    };
    if (
      !parsed?.savedAt ||
      !parsed.data ||
      Date.now() - parsed.savedAt > WALLET_BALANCES_SESSION_TTL_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMarketsWalletBalancesSession(
  networkId: string,
  address: string,
  data: Record<string, { balance: number; balanceUSD: number }>
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      marketsWalletBalancesSessionKey(networkId, address),
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Toolbar gas-style meter: fill hits 100% at this many spendable ALGO. */
const MARKETS_TOOLBAR_ALGO_METER_CAP = 10;

function marketsToolbarAlgoMeterFillPercent(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.min(100, (balance / MARKETS_TOOLBAR_ALGO_METER_CAP) * 100);
}

function marketsToolbarAlgoMeterBarClass(balance: number): string {
  if (!Number.isFinite(balance) || balance < 1) return "bg-red-500";
  if (balance <= 5) return "bg-yellow-500 dark:bg-yellow-400";
  if (balance < MARKETS_TOOLBAR_ALGO_METER_CAP) return "bg-emerald-500";
  return "bg-green-500";
}

function marketsToolbarSpendableAlgoIsMeterGreen(balance: number | null): boolean {
  return (
    balance != null &&
    Number.isFinite(balance) &&
    balance >= MARKETS_TOOLBAR_ALGO_METER_CAP
  );
}

const MarketsTable = () => {
  const { formatPercent, formatNumber } = useNumberI18n();
  const isMobile = useIsMobile();
  const marketsListRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("default");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [newMarketsOnly, setNewMarketsOnly] = useState(false);
  const [rewardMarketsOnly, setRewardMarketsOnly] = useState(false);
  const [multiPoolOnly, setMultiPoolOnly] = useState(false);
  const [walletToolbarOpen, setWalletToolbarOpen] = useState(false);
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    /** `useOnDemandMarketData` row key (`_sortKey`); disambiguates same display asset + pool. */
    marketRowKey?: string;
    /** Config `tokens` key from the row (e.g. `fALGO`); passed to SupplyBorrowModal for token resolution. */
    configSymbol?: string;
    /** nt200 market contract id (disambiguates e.g. legacy vs V2 wBTC). */
    marketId?: string;
  }>({
    isOpen: false,
    asset: null,
    poolId: undefined,
    marketRowKey: undefined,
    configSymbol: undefined,
    marketId: undefined,
  });
  const [withdrawModal, setWithdrawModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [borrowModal, setBorrowModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    marketRowKey?: string;
    configSymbol?: string;
  }>({
    isOpen: false,
    asset: null,
    poolId: undefined,
    marketRowKey: undefined,
    configSymbol: undefined,
  });
  const [mintModal, setMintModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    marketRowKey?: string;
  }>({ isOpen: false, asset: null, poolId: undefined, marketRowKey: undefined });
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    marketData: Record<string, unknown> | null;
    marketRowKey?: string;
  }>({
    isOpen: false,
    asset: null,
    poolId: undefined,
    marketData: null,
    marketRowKey: undefined,
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
  /** Same-pool supplied markets + LT for deposit modal (from chain; not paginated table). */
  const [depositPoolCollateralMarkets, setDepositPoolCollateralMarkets] =
    useState<PoolCollateralMarketRow[]>([]);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(false);
  /** Live position for PremiumMarketModal (on-chain + pool caps). */
  const [detailModalUserPosition, setDetailModalUserPosition] =
    useState<MarketDetailUserPosition | null>(null);
  const [detailModalUserPositionLoad, setDetailModalUserPositionLoad] =
    useState<UserPositionLoadState>("idle");

  // Mock user deposits - in real app, this would come from user's wallet/backend
  const [userDeposits] = useState<Record<string, number>>({});
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimConfirmed, setClaimConfirmed] = useState(false);
  const [claimableRewards, setClaimableRewards] = useState<
    Record<string, { amount: number; formatted: string }>
  >({});
  const [isCountingRewards, setIsCountingRewards] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState<{
    formatted: string;
    symbol: string;
    wasDeposited?: boolean; // Track if it was deposited directly
    rewardNames?: string[]; // Track reward names for sharing
  } | null>(null);
  const [shareButtonClicked, setShareButtonClicked] = useState(false);
  const [isTinymanSwapModalOpen, setIsTinymanSwapModalOpen] = useState(false);
  /** Open Tinyman with assets biased toward receiving ALGO (fee top-up). */
  const [tinymanSwapOpenForGasUp, setTinymanSwapOpenForGasUp] =
    useState(false);
  /** Spendable ALGO (human) for markets toolbar meter; `null` when not applicable. */
  const [marketsToolbarSpendableAlgo, setMarketsToolbarSpendableAlgo] =
    useState<number | null>(null);
  const [marketsToolbarSpendableAlgoLoading, setMarketsToolbarSpendableAlgoLoading] =
    useState(false);
  const [marketsToolbarAlgoRefreshNonce, setMarketsToolbarAlgoRefreshNonce] =
    useState(0);

  const { activeAccount, signTransactions, activeWallet } = useWallet();

  const { currentNetwork, switchNetwork } = useNetwork();

  const enabledNetworks = getEnabledNetworks();
  const showMarketsLiquidityToolbar =
    currentNetwork === "algorand-mainnet" ||
    currentNetwork === "algorand-testnet";
  /** Tighter spendable-ALGO strip when Xchain bridge controls share the row. */
  const marketsToolbarSpendableExtraTight =
    showMarketsLiquidityToolbar &&
    shouldShowXchainUsdcBridgeControls(currentNetwork, activeWallet?.id);
  const { toast } = useToast();

  useEffect(() => {
    if (!showMarketsLiquidityToolbar) {
      setMarketsToolbarSpendableAlgo(null);
      setMarketsToolbarSpendableAlgoLoading(false);
      return;
    }
    if (!activeAccount?.address) {
      setMarketsToolbarSpendableAlgo(null);
      setMarketsToolbarSpendableAlgoLoading(false);
      return;
    }
    let cancelled = false;
    setMarketsToolbarSpendableAlgoLoading(true);
    void (async () => {
      try {
        const algorandNetwork = getAlgorandNetworkFromNetworkId(
          currentNetwork as NetworkId
        );
        if (!algorandNetwork) {
          if (!cancelled) {
            setMarketsToolbarSpendableAlgo(null);
            setMarketsToolbarSpendableAlgoLoading(false);
          }
          return;
        }
        await algorandService.initializeClientsForReads(algorandNetwork);
        const accountInfo = await algorandService
          .getAlgodClient()
          .accountInformation(activeAccount.address)
          .do();
        if (!cancelled) {
          setMarketsToolbarSpendableAlgo(
            spendableAlgoHumanFromAccount(accountInfo)
          );
        }
      } catch (e) {
        console.error("[MarketsTable] toolbar spendable ALGO:", e);
        if (!cancelled) setMarketsToolbarSpendableAlgo(0);
      } finally {
        if (!cancelled) setMarketsToolbarSpendableAlgoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    showMarketsLiquidityToolbar,
    activeAccount?.address,
    currentNetwork,
    marketsToolbarAlgoRefreshNonce,
  ]);

  // Helper function to get clients for reads using the active network
  const getSyncedClientsForReads = async () => {
    const algorandNetwork = getAlgorandNetworkFromNetworkId(
      currentNetwork as NetworkId
    );
    if (!algorandNetwork) {
      throw new Error(
        `Network ${currentNetwork} is not an Algorand-compatible network`
      );
    }
    // Directly initialize clients for the active network
    return await algorandService.initializeClientsForReads(algorandNetwork);
  };

  // Helper function to get clients for transactions using the active network
  const getSyncedClientsForTransactions = async () => {
    const algorandNetwork = getAlgorandNetworkFromNetworkId(
      currentNetwork as NetworkId
    );
    if (!algorandNetwork) {
      throw new Error(
        `Network ${currentNetwork} is not an Algorand-compatible network`
      );
    }
    // Directly initialize clients for the active network
    return await algorandService.initializeClientsForTransactions(
      algorandNetwork
    );
  };

  const rewards = [
    {
      id: 1,
      name: "Prefi Incentive",
      description: "5M VOI DorkFi Prefi Incentive",
      reward: 5_000_000,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "PORY6TDWT5B7YIJY36NSMY3DKIIH4TAEY35NUFCQRT7QMU66NUSZHLP6VA",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 2,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 4_038_386,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "57IUOX6D3JAAM3GSPVJPM4CTTOVUYWWWLHOIBGOS275ZC3Q4BUPA4M5R4U",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 3,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "7PVC6COR4DKNETI2KGSKBPNBN75SBRRRNO24ICWMM3P44MSNJ7EOANXCBY",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 4,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "46D6WQTKMO2TBMHE4VF45IGDLXMDG5DLTWIGVOEFSEKHSOLGDAF3GWURGI",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 5,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "UKFZDMWV6Q4PXBOO3LSIAFOGTV735JZNRUI6GGDTJQ57KHXBIISWIAHJBY",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 6,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "FN6OCDI4D55OK4JUZ7YAHISNBZWVEWDN6SOV23XAHYOTWPUE5OFCJQEVPE",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    }, {
      id: 7,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "KUIS6IWPPJZ2Z64LBN2SITONOBJUY2D4RRSELH7CHIG2J6DWSUEHBFVWN4",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 8,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "NF7COSO5C6EJBRX4XO5C3JUKAYOLIV4T33HXKNFFJWY24MCX3FWEFKQZRM",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 9,
      name: "Phase 1 Incentive",
      description: "DorkFi Phase 1 Incentive",
      reward: 807_677,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "YP3V5B2CBWIELNGGDKEH246QGJHWYKGPNXQC24OCDGD2KWCJYCJ3KTSMOU",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 10,
      name: "Phase 2 Incentive",
      description: "DorkFi Phase 2 Incentive (Biweekly)",
      reward: 948718,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "D3WNOHGGYDEPKD5D3GIADWD4TXWWMTLDNMHDXEHU5F6N6RH5ZJ3ZHBQTZQ",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 11,
      name: "Phase 2 Incentive",
      description: "DorkFi Phase 2 Incentive (Biweekly)",
      reward: 948718,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "XDVFQTDT4CLSWIXEC5JFSCLDZXVCGKXWXLGI3XODEYDSGH5GJJWOU4D4UI",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 12,
      name: "Phase 2 Incentive",
      description: "DorkFi Phase 2 Incentive (Biweekly)",
      reward: 948718,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "45I46TXYXDTP2CYTRVQNTIYMP6CVYHSA2B3PDXBN5A3K6GRIG2RWBUUTXU",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    {
      id: 13,
      name: "Phase 2 Incentive",
      description: "DorkFi Phase 2 Incentive (Biweekly)",
      reward: 1897436,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "PWSTH6HCRSBDVGSWWIVPIVZCFR7QGKD2F4SQ7JREFJQWSC4DFT2EAUFUDA",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
          assetId: "2320775407",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
  ];

  const {
    data: marketsPage,
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
    isLoadingVisible,
    marketsData,
    wadMintMarket,
    newMarketsCount,
    rewardMarketsCount,
    multiPoolMarketsCount,
    hasDMarketTab,
  } = useOnDemandMarketData({
    searchTerm,
    sortField,
    sortOrder,
    pageSize: 10,
    autoLoad: true,
    marketFilter,
    newMarketsOnly,
    rewardMarketsOnly,
    multiPoolOnly,
  });

  const handleMarketFilterChange = useCallback(
    (value: MarketFilter) => {
      setMarketFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  useEffect(() => {
    marketsListRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [marketFilter]);

  const rewardsAprByBaseUrl = useRewardsAprBonusMap([currentNetwork]);

  const applyRewardsBonus = useCallback(
    (m: (typeof marketsPage)[0]) => ({
      ...m,
      rewardsBonusSupplyAprPercent:
        m.hasRewards && m.rewardsPublicBaseUrlResolved
          ? rewardsAprByBaseUrl[m.rewardsPublicBaseUrlResolved] ?? null
          : undefined,
    }),
    [rewardsAprByBaseUrl]
  );

  const markets = useMemo(() => {
    return marketsPage.map(applyRewardsBonus);
  }, [marketsPage, applyRewardsBonus]);

  const wadMintMarketDisplay = useMemo(() => {
    if (!wadMintMarket) return null;
    return applyRewardsBonus(wadMintMarket);
  }, [wadMintMarket, applyRewardsBonus]);

  const marketsForLookup = useMemo(() => {
    if (!wadMintMarketDisplay) return markets;
    const wadKey = (wadMintMarketDisplay as { _sortKey?: string })._sortKey;
    if (
      markets.some(
        (m) => (m as { _sortKey?: string })._sortKey === wadKey
      )
    ) {
      return markets;
    }
    return [wadMintMarketDisplay, ...markets];
  }, [markets, wadMintMarketDisplay]);

  /** Resolve config token row when display `asset` + `poolId` match multiple markets (e.g. Algo vs fALGO). */
  const configSymbolFromMarketRowKey = useCallback(
    (marketRowKey: string | undefined) => {
      if (!marketRowKey) return undefined;
      const row = marketsForLookup.find(
        (m) => (m as { _sortKey?: string })._sortKey === marketRowKey
      );
      const cs = row?.configSymbol;
      return typeof cs === "string" ? cs : undefined;
    },
    [marketsForLookup]
  );

  const marketContractIdFromMarketRowKey = useCallback(
    (marketRowKey: string | undefined) => {
      if (!marketRowKey) return undefined;
      const row = marketsForLookup.find(
        (m) => (m as { _sortKey?: string })._sortKey === marketRowKey
      );
      const fromInfo = row?.marketInfo?.marketId;
      if (fromInfo != null && String(fromInfo).trim() !== "") {
        return String(fromInfo).trim();
      }
      return marketContractIdFromRowCacheKey(marketRowKey);
    },
    [marketsForLookup]
  );

  const resolveTokenForDisplayedAsset = useCallback(
    (
      asset: string,
      poolId: string | undefined,
      marketRowKey: string | undefined
    ) => {
      const configSymbol = marketRowKey
        ? configSymbolFromMarketRowKey(marketRowKey)
        : undefined;
      return resolveTokenForMarketPosition(currentNetwork, {
        asset,
        poolId,
        configSymbol,
        marketContractId: marketContractIdFromMarketRowKey(marketRowKey),
      });
    },
    [
      currentNetwork,
      configSymbolFromMarketRowKey,
      marketContractIdFromMarketRowKey,
    ]
  );

  const borrowModalAvailableAssets = useMemo(() => {
    type Row = (typeof markets)[number] & {
      _sortKey?: string;
      configSymbol?: string;
      marketInfo?: { marketId?: string | number };
    };
    return markets.map((raw) => {
      const m = raw as Row;
      const rowKey = m._sortKey;
      const mid =
        m.marketInfo?.marketId != null
          ? String(m.marketInfo.marketId)
          : undefined;
      return {
        asset: m.asset,
        icon: typeof m.icon === "string" ? m.icon : "",
        value:
          typeof m.borrowAPY === "number" && !Number.isNaN(m.borrowAPY)
            ? m.borrowAPY
            : undefined,
        poolId: m.poolId != null ? String(m.poolId) : undefined,
        network: currentNetwork,
        configSymbol:
          typeof m.configSymbol === "string" ? m.configSymbol : undefined,
        marketId: mid,
        marketRowKey: rowKey,
      };
    });
  }, [markets, currentNetwork]);

  const borrowModalMarketId = useMemo(() => {
    if (!borrowModal.marketRowKey) return undefined;
    const row = markets.find(
      (m) => (m as { _sortKey?: string })._sortKey === borrowModal.marketRowKey
    ) as { marketInfo?: { marketId?: string | number } } | undefined;
    return row?.marketInfo?.marketId != null
      ? String(row.marketInfo.marketId)
      : undefined;
  }, [markets, borrowModal.marketRowKey]);

  const handleSelectBorrowMarket = useCallback(
    (
      nextAsset: string,
      nextPoolId?: string,
      _nextNetwork?: string,
      pick?: {
        marketId?: string;
        configSymbol?: string;
        marketRowKey?: string;
      }
    ) => {
      const rowKey = pick?.marketRowKey;
      setBorrowModal((prev) => ({
        ...prev,
        isOpen: true,
        asset: nextAsset,
        poolId: nextPoolId,
        marketRowKey: rowKey,
        configSymbol:
          pick?.configSymbol ??
          (rowKey ? configSymbolFromMarketRowKey(rowKey) : undefined) ??
          prev.configSymbol,
      }));
    },
    [configSymbolFromMarketRowKey]
  );

  useEffect(() => {
    setNewMarketsOnly(false);
    setRewardMarketsOnly(false);
    setMultiPoolOnly(false);
  }, [currentNetwork]);

  useEffect(() => {
    if (newMarketsCount === 0) setNewMarketsOnly(false);
  }, [newMarketsCount]);

  useEffect(() => {
    if (rewardMarketsCount === 0) setRewardMarketsOnly(false);
  }, [rewardMarketsCount]);

  useEffect(() => {
    if (multiPoolMarketsCount === 0) setMultiPoolOnly(false);
  }, [multiPoolMarketsCount]);

  useEffect(() => {
    if (!hasDMarketTab && marketFilter === "D") {
      setMarketFilter("all");
      setCurrentPage(1);
    }
  }, [hasDMarketTab, marketFilter]);

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    handleSearchChange(value);
  };

  const handleSortFieldChange = (field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
    handleSortChange(field, order);
  };

  const hasActiveFilters = useMemo(
    () =>
      searchTerm.trim() !== "" ||
      newMarketsOnly ||
      rewardMarketsOnly ||
      multiPoolOnly ||
      marketFilter !== "all" ||
      sortField !== "default" ||
      sortOrder !== "desc",
    [
      searchTerm,
      newMarketsOnly,
      rewardMarketsOnly,
      multiPoolOnly,
      marketFilter,
      sortField,
      sortOrder,
    ]
  );

  const clearAllMarketFilters = useCallback(() => {
    handleSearchTermChange("");
    setNewMarketsOnly(false);
    setRewardMarketsOnly(false);
    setMultiPoolOnly(false);
    setMarketFilter("all");
    setCurrentPage(1);
    handleSortFieldChange("default", "desc");
  }, [setCurrentPage]);

  const handleDepositClick = async (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    // Don't open modal if market is at or over deposit cap (95% threshold)
    const assetData = getAssetData(asset, poolId, marketRowKey);
    if (assetData) {
      const totalSupply = Number(assetData.totalSupply ?? 0);
      const maxTotalDeposits = Number(assetData.maxTotalDeposits ?? 0);
      if (isAtDepositCap(totalSupply, maxTotalDeposits)) {
        toast({
          title: "Deposit cap reached",
          description: "This market has reached its deposit cap. Deposits are not available.",
          variant: "destructive",
        });
        return;
      }
    }

    const configSymbol = configSymbolFromMarketRowKey(marketRowKey);
    const marketRow =
      marketRowKey != null
        ? markets.find(
            (m) => (m as { _sortKey?: string })._sortKey === marketRowKey
          )
        : undefined;
    const marketId =
      marketContractIdFromMarketRowKey(marketRowKey) ??
      (marketRow?.marketInfo?.marketId != null
        ? String(marketRow.marketInfo.marketId)
        : undefined) ??
      resolveTokenForDisplayedAsset(asset, poolId, marketRowKey)
        ?.underlyingContractId;
    setDepositModal({
      isOpen: true,
      asset,
      poolId,
      marketRowKey,
      configSymbol,
      marketId:
        marketId != null && String(marketId).trim() !== ""
          ? String(marketId).trim()
          : undefined,
    });

    const balanceCacheKey = marketsTableWalletBalanceCacheKey(
      asset,
      poolId,
      marketRowKey
    );
    const hasCachedBalance = walletBalances[balanceCacheKey] !== undefined;
    // Only show loading if we have nothing to paint yet.
    if (!hasCachedBalance) {
      setIsLoadingBalance(true);
    }

    void (async () => {
      try {
        await fetchWalletBalance(asset, poolId, marketRowKey);
      } catch (error) {
        console.error("Error fetching wallet balance for deposit:", error);
      } finally {
        setIsLoadingBalance(false);
      }
    })();

    // Collateral rows are independent of the wallet-balance spinner.
    if (activeAccount?.address && poolId != null && poolId !== "") {
      void (async () => {
        try {
          const poolCollateralRows =
            await fetchPoolCollateralMarketRowsForDeposit(
              activeAccount.address,
              currentNetwork as NetworkId,
              poolId
            );
          setDepositPoolCollateralMarkets(poolCollateralRows);
        } catch (e) {
          console.error(
            "Error loading pool collateral markets for deposit:",
            e
          );
        }
      })();
    }
  };

  const handleWithdrawClick = (asset: string) => {
    setWithdrawModal({ isOpen: true, asset });
  };

  const handleBorrowClick = async (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    // Don't open modal if market is at or over borrow cap (95% threshold)
    const assetData = getAssetData(asset, poolId, marketRowKey);
    if (assetData) {
      const totalBorrow = Number(assetData.totalBorrow ?? 0);
      const maxTotalBorrows = Number(assetData.maxTotalBorrows ?? 0);
      if (isAtBorrowCap(totalBorrow, maxTotalBorrows)) {
        toast({
          title: "Borrow cap reached",
          description:
            "This market has reached its borrow cap. Borrowing is not available.",
          variant: "destructive",
        });
        return;
      }
    }

    const configSymbol = configSymbolFromMarketRowKey(marketRowKey);
    setBorrowModal({
      isOpen: true,
      asset,
      poolId,
      marketRowKey,
      configSymbol,
    });

    setIsLoadingGlobalData(true);
    void (async () => {
      try {
        if (activeAccount?.address) {
          warmBorrowModalMaxAndPool({
            userAddress: activeAccount.address,
            networkId: currentNetwork as NetworkId,
            asset,
            poolId,
            configSymbol,
            marketId: marketContractIdFromRowCacheKey(marketRowKey),
            marketRowKey,
          });

          const token = resolveTokenForDisplayedAsset(
            asset,
            poolId,
            marketRowKey
          );

          const [globalData, borrowData, poolCollateralRows] =
            await Promise.all([
              fetchUserGlobalData(activeAccount.address, currentNetwork),
              token && token.poolId && token.underlyingContractId
                ? fetchUserBorrowBalance(
                    activeAccount.address,
                    token.poolId,
                    token.underlyingContractId,
                    currentNetwork
                  )
                : Promise.resolve(null),
              poolId != null && poolId !== ""
                ? fetchPoolCollateralMarketRowsForDeposit(
                    activeAccount.address,
                    currentNetwork as NetworkId,
                    poolId
                  ).catch((e) => {
                    console.error(
                      "Error loading pool collateral markets for borrow:",
                      e
                    );
                    return null;
                  })
                : Promise.resolve(null),
            ]);

          setUserGlobalData(globalData);
          setUserBorrowBalance(borrowData?.balance || 0);
          if (poolCollateralRows) {
            setDepositPoolCollateralMarkets(poolCollateralRows);
          }
        } else {
          setUserGlobalData(null);
          setUserBorrowBalance(0);
        }
      } catch (error) {
        console.error("Error fetching user data for borrow:", error);
      } finally {
        setIsLoadingGlobalData(false);
      }
    })();
  };

  const handleMintClick = async (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    setMintModal({ isOpen: true, asset, poolId, marketRowKey });

    setIsLoadingGlobalData(true);
    void (async () => {
      try {
        if (activeAccount?.address) {
          const globalData = await fetchUserGlobalData(
            activeAccount.address,
            currentNetwork
          );
          setUserGlobalData(globalData);

          const token = resolveTokenForDisplayedAsset(
            asset,
            poolId,
            marketRowKey
          );

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
          setUserGlobalData(null);
          setUserBorrowBalance(0);
        }
      } catch (error) {
        console.error("Error fetching user data for mint:", error);
      } finally {
        setIsLoadingGlobalData(false);
      }
    })();
  };

  const handleMigrateClick = async (asset: string) => {
    if (!activeAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to migrate tokens",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get token configuration
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);

      if (!token) {
        throw new Error(`Token not found for ${asset}`);
      }

      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as { originalSymbol?: string }).originalSymbol : asset;
      const tokenConfig = getTokenConfig(currentNetwork, originalSymbol);

      if (!tokenConfig) {
        throw new Error(`Token config not found for ${asset}`);
      }

      if (!tokenConfig.migration) {
        throw new Error(`No migration config found for ${asset}`);
      }

      // Get the migration balance (already formatted)
      const clients = await getSyncedClientsForReads();
      ARC200Service.initialize(clients);

      const migrationBalance = await ARC200Service.getBalance(
        activeAccount.address,
        tokenConfig.migration.nTokenId
      );

      if (!migrationBalance || BigInt(migrationBalance) === 0n) {
        throw new Error("No balance to migrate");
      }

      // Format balance for withdraw/deposit (convert from base units to human readable)
      const formattedBalance = ARC200Service.formatBalance(
        migrationBalance,
        tokenConfig.decimals
      );

      toast({
        title: "Starting Migration",
        description: `Migrating ${formattedBalance} ${asset}...`,
      });

      // Call migrate function which combines withdraw and deposit
      const migrateResult = await migrate(
        tokenConfig.migration.poolId, // Old pool ID
        tokenConfig.migration.contractId, // Old contract ID
        tokenConfig.migration.nTokenId, // Old nToken ID
        token.poolId!, // New pool ID
        token.underlyingContractId!, // New contract ID
        tokenConfig.tokenStandard,
        formattedBalance, // Amount in human readable format
        activeAccount.address,
        currentNetwork,
        tokenConfig.assetId // Asset ID for network/ASA tokens
      );

      if (!migrateResult.success) {
        throw new Error((migrateResult as { error?: string }).error || "Migration failed");
      }

      // Sign and send migration transaction
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Migration Transaction",
        description: `Please open ${walletName} and sign the migration transaction`,
        duration: 10000,
      });

      let migrateTxns: Uint8Array[];
      if ("txns" in migrateResult && migrateResult.txns) {
        migrateTxns = migrateResult.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        );
      } else if ("txId" in migrateResult && migrateResult.txId) {
        migrateTxns = [
          Uint8Array.from(atob(migrateResult.txId), (c) => c.charCodeAt(0)),
        ];
      } else {
        throw new Error("No transaction data in migrate result");
      }

      const signedMigrateTxns = await signTransactions(migrateTxns);
      const algorandClients = await getSyncedClientsForTransactions();
      const migrateRes = await algorandClients.algod
        .sendRawTransaction(signedMigrateTxns)
        .do();
      await waitForConfirmation(algorandClients.algod, migrateRes.txid, 4);

      toast({
        title: "Migration Successful",
        description: `Successfully migrated ${formattedBalance} ${asset} to new pool`,
      });

      // Wait a bit for the blockchain state to update, then refresh
      setTimeout(() => {
        loadMarketDataWithBypass(
          marketRowCacheKey({
            originalSymbol,
            symbol: token.symbol,
            poolId: token.poolId,
          })
        );
        refreshWalletBalance(asset, token.poolId, undefined);
      }, 2000);
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        title: "Migration Failed",
        description:
          error instanceof Error ? error.message : "Migration failed",
        variant: "destructive",
      });
    }
  };

  const handleCloseDepositModal = () => {
    const asset = depositModal.asset;
    const poolId = depositModal.poolId;
    const rowKey = depositModal.marketRowKey;
    setDepositModal({
      isOpen: false,
      asset: null,
      poolId: undefined,
      marketRowKey: undefined,
      configSymbol: undefined,
      marketId: undefined,
    });
    setDepositPoolCollateralMarkets([]);

    // Refresh market data and wallet balance after deposit
    if (asset) {
      loadMarketDataWithBypass(
        rowKey ??
          marketKeyForOnDemandLoad(poolId, undefined, asset)
      );
      // Refresh wallet balance to show updated amount after deposit
      void refreshWalletBalance(asset, poolId, rowKey);
    }
  };

  const handleCloseWithdrawModal = () => {
    setWithdrawModal({ isOpen: false, asset: null });
  };

  const handleCloseBorrowModal = () => {
    const asset = borrowModal.asset;
    const poolId = borrowModal.poolId;
    const rowKey = borrowModal.marketRowKey;
    setBorrowModal({
      isOpen: false,
      asset: null,
      poolId: undefined,
      marketRowKey: undefined,
      configSymbol: undefined,
    });

    // Refresh market data and user global data after borrow
    if (asset) {
      loadMarketDataWithBypass(
        rowKey ??
          marketKeyForOnDemandLoad(poolId, undefined, asset)
      );
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  // Fetch user data when wallet connects while borrow modal is open (or when switching asset in-modal)
  useEffect(() => {
    if (borrowModal.isOpen && borrowModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(
            activeAccount.address,
            currentNetwork
          );
          setUserGlobalData(globalData);

          const token = resolveTokenForDisplayedAsset(
            borrowModal.asset,
            borrowModal.poolId,
            borrowModal.marketRowKey
          );

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

          let poolCollateralRows: PoolCollateralMarketRow[] = [];
          if (
            borrowModal.poolId != null &&
            borrowModal.poolId !== ""
          ) {
            try {
              poolCollateralRows =
                await fetchPoolCollateralMarketRowsForDeposit(
                  activeAccount.address,
                  currentNetwork as NetworkId,
                  borrowModal.poolId
                );
            } catch (e) {
              console.error(
                "Error loading pool collateral markets for borrow:",
                e
              );
            }
          }
          setDepositPoolCollateralMarkets(poolCollateralRows);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };

      fetchData();
    }
  }, [
    activeAccount?.address,
    borrowModal.isOpen,
    borrowModal.asset,
    borrowModal.poolId,
    borrowModal.marketRowKey,
    borrowModal.configSymbol,
    currentNetwork,
    resolveTokenForDisplayedAsset,
  ]);

  // Fetch user data when wallet connects while mint modal is open
  useEffect(() => {
    if (mintModal.isOpen && mintModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(
            activeAccount.address,
            currentNetwork
          );
          setUserGlobalData(globalData);

          const token = resolveTokenForDisplayedAsset(
            mintModal.asset,
            mintModal.poolId,
            mintModal.marketRowKey
          );

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
  }, [
    activeAccount?.address,
    mintModal.isOpen,
    mintModal.asset,
    mintModal.poolId,
    mintModal.marketRowKey,
    currentNetwork,
    resolveTokenForDisplayedAsset,
  ]);

  const handleCloseMintModal = () => {
    const asset = mintModal.asset;
    const poolId = mintModal.poolId;
    const rowKey = mintModal.marketRowKey;
    setMintModal({
      isOpen: false,
      asset: null,
      poolId: undefined,
      marketRowKey: undefined,
    });

    // Refresh market data and user global data after mint
    if (asset) {
      loadMarketDataWithBypass(
        rowKey ??
          marketKeyForOnDemandLoad(poolId, undefined, asset)
      );
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  const openMarketDetailModal = (market: Record<string, unknown>) => {
    const asset = typeof market.asset === "string" ? market.asset : null;
    if (!asset) return;
    const poolId = poolIdFromMarketRow(market);
    const configSymbol =
      typeof (market as { configSymbol?: string }).configSymbol === "string"
        ? (market as { configSymbol?: string }).configSymbol
        : undefined;
    const rowKey = (market as { _sortKey?: string })._sortKey;
    setDetailModal({
      isOpen: true,
      asset,
      poolId,
      marketData: market,
      marketRowKey: rowKey,
    });
    // Fresh on-chain read for modal (fetchMarketInfo(..., "contract") via useOnDemandMarketData).
    void loadMarketDataWithBypass(
      rowKey ?? marketKeyForOnDemandLoad(poolId, configSymbol, asset)
    );
    if (activeAccount?.address) {
      const addr = activeAccount.address;
      void fetchUserGlobalData(addr, currentNetwork).then((data) => {
        if (data) setUserGlobalData(data);
      });
      void withRpcReadCache(
        `globalUserRows:${addr}`,
        () => fetchGlobalUserRowsFromChain(addr),
        30_000
      );
    }
  };

  const handleRowClick = (market: Record<string, unknown>) => {
    openMarketDetailModal(market);
  };

  const handleInfoClick = (e: React.MouseEvent, market: Record<string, unknown>) => {
    e.stopPropagation();
    openMarketDetailModal(market);
  };

  const handleCloseDetailModal = () => {
    setDetailModal({
      isOpen: false,
      asset: null,
      poolId: undefined,
      marketData: null,
      marketRowKey: undefined,
    });
  };

  // When the detail modal is open, replace the snapshot row with the refreshed row from
  // `loadMarketDataWithBypass` (chain-sourced marketInfo) once it lands in `markets`.
  // Key off `lastFetched` only — `markets` is remapped often (rewards APR) with new object refs.
  const detailModalRowLastFetched = useMemo(() => {
    if (!detailModal.isOpen || !detailModal.asset) return undefined;
    const fresh = findMarketRow(
      marketsData as Record<string, Record<string, unknown>>,
      marketsForLookup as Record<string, unknown>[],
      detailModal.asset,
      detailModal.poolId,
      detailModal.marketRowKey
    );
    return (fresh as { lastFetched?: number } | undefined)?.lastFetched;
  }, [
    marketsData,
    marketsForLookup,
    detailModal.isOpen,
    detailModal.asset,
    detailModal.poolId,
    detailModal.marketRowKey,
  ]);

  useEffect(() => {
    if (!detailModal.isOpen || !detailModal.asset) return;
    if (detailModalRowLastFetched === undefined) return;
    const fresh = findMarketRow(
      marketsData as Record<string, Record<string, unknown>>,
      marketsForLookup as Record<string, unknown>[],
      detailModal.asset,
      detailModal.poolId,
      detailModal.marketRowKey
    );
    if (!fresh) return;
    setDetailModal((prev) => {
      if (!prev.isOpen || !prev.marketData) return prev;
      const prevLast = (prev.marketData as { lastFetched?: number }).lastFetched;
      if (
        prevLast !== undefined &&
        detailModalRowLastFetched <= prevLast
      ) {
        return prev;
      }
      return { ...prev, marketData: fresh };
    });
  }, [
    detailModalRowLastFetched,
    detailModal.isOpen,
    detailModal.asset,
    detailModal.poolId,
    detailModal.marketRowKey,
    marketsData,
    marketsForLookup,
  ]);

  // Market rows hydrate via useOnDemandMarketData (bulk API + gap-fill).

  // Restore / clear wallet balance cache when wallet or network changes
  useEffect(() => {
    setUserGlobalData(null);
    setClaimableRewards({});
    setClaimedAmount(null);
    if (!activeAccount?.address) {
      setWalletBalances({});
      return;
    }
    const cached = readMarketsWalletBalancesSession(
      currentNetwork,
      activeAccount.address
    );
    setWalletBalances(cached ?? {});
  }, [activeAccount?.address, currentNetwork]);

  // Check for rewards using arc200_approval method simulation
  useEffect(() => {
    const countRewards = async () => {
      if (!activeAccount?.address) {
        return;
      }

      // Prevent multiple simultaneous checks
      if (isCountingRewards) {
        return;
      }

      setIsCountingRewards(true);

      try {
        const clients = await getSyncedClientsForReads();
        console.log({ clients });
        ARC200Service.initialize(clients);

        const rewardsData: Record<
          string,
          { amount: number; formatted: string }
        > = {};

        for (const reward of rewards) {
          try {
            // Get the contract ID for the current network
            const networkKey = currentNetwork as keyof typeof reward.networks;
            const networkReward = reward.networks[networkKey];

            if (!networkReward?.contractId) {
              console.log(
                `No contract ID found for reward ${reward.id} on network ${currentNetwork}`
              );
              continue;
            }

            const contractId = networkReward.contractId;

            // Check balance of reward token in airdrop account using ARC200Service
            let claimableBalance = 0n;
            try {
              const balance = await ARC200Service.getAllowance(
                reward.airdropAccount,
                activeAccount.address,
                contractId
              );
              console.log("balance/allowance", balance);
              claimableBalance = balance ? BigInt(balance) : 0n;
            } catch (error) {
              console.error(
                `Error fetching balance for reward ${reward.id}:`,
                error
              );
              continue;
            }

            // Count rewards if there's a claimable balance
            if (claimableBalance > 0n) {
              const formattedAmount = ARC200Service.formatBalance(
                claimableBalance.toString(),
                reward.decimals
              );

              rewardsData[reward.id.toString()] = {
                amount: Number(claimableBalance),
                formatted: formattedAmount,
              };

              console.log(
                `Reward ${reward.id} is claimable: ${formattedAmount} ${reward.symbol}`
              );
            }
          } catch (error) {
            console.error(`Error checking reward ${reward.id}:`, error);
          }
        }

        setClaimableRewards(rewardsData);
      } catch (error) {
        console.error("Error counting rewards:", error);
      } finally {
        setIsCountingRewards(false);
      }
    };

    countRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.address, currentNetwork]);

  // Check if there are any claimable rewards
  const hasClaimableRewards = Object.values(claimableRewards).some(
    (reward) => reward.amount > 0
  );

  // Calculate total claimable rewards (sum of all amounts)
  const totalClaimableAmount = Object.values(claimableRewards).reduce(
    (sum, reward) => sum + reward.amount,
    0
  );

  // Get reward symbol and decimals (assuming all rewards use the same symbol)
  const rewardSymbol = rewards.length > 0 ? rewards[0].symbol : "VOI";
  const rewardDecimals = rewards.length > 0 ? rewards[0].decimals : 6;

  // Format total claimable amount
  const formattedTotalClaimable =
    totalClaimableAmount > 0
      ? ARC200Service.formatBalance(
        totalClaimableAmount.toString(),
        rewardDecimals
      )
      : "0";

  // For display/claim: limit to first 4 (matches MAX_CLAIMS_PER_TX)
  const claimableRewardsThisBatch = Object.entries(claimableRewards).slice(
    0,
    MAX_CLAIMS_PER_TX
  );
  const totalClaimableThisBatch = claimableRewardsThisBatch.reduce(
    (sum, [, r]) => sum + r.amount,
    0
  );
  const formattedTotalThisBatch =
    totalClaimableThisBatch > 0
      ? ARC200Service.formatBalance(
        totalClaimableThisBatch.toString(),
        rewardDecimals
      )
      : "0";
  const hasMoreRewardsToClaim =
    Object.keys(claimableRewards).length > MAX_CLAIMS_PER_TX;

  // Get VOI token confiag to find poolId for deposit
  const getVOITokenConfig = () => {
    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      console.log("=== Tokens Debug ===", { tokens });
      return tokens.find(
        (t) => t.symbol === "Voi" || t.symbol === "aVoi" || t.symbol === "aVOI"
      );
    } catch (error) {
      console.error("Error in getVOITokenConfig:", error);
      return undefined;
    }
  };

  const voiToken = getVOITokenConfig();

  console.log("=== VOI Token Debug ===", { voiToken, currentNetwork });

  // Handle claim VOI rewards
  const handleClaimVoi = async () => {
    if (!activeAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      });
      return;
    }

    if (!hasClaimableRewards || totalClaimableAmount === 0) {
      toast({
        title: "No Rewards Available",
        description: "You don't have any rewards to claim",
        variant: "destructive",
      });
      return;
    }

    if (isClaiming) {
      return; // Prevent multiple simultaneous claims
    }

    setIsClaiming(true);

    try {
      const clients = await getSyncedClientsForReads();
      ARC200Service.initialize(clients);

      const allTxns: Uint8Array[] = [];

      // Process each claimable reward (limit to 4 at once)
      let ci: InstanceType<typeof CONTRACT> | undefined;
      const buildN: Record<string, unknown>[] = [];
      let paymentAmount = 28500;
      for (const [rewardId, rewardData] of Object.entries(claimableRewards).slice(0, MAX_CLAIMS_PER_TX)) {
        if (rewardData.amount <= 0) continue;

        const reward = rewards.find((r) => r.id.toString() === rewardId);
        if (!reward) continue;

        // Get the contract ID for the current network
        const networkKey = currentNetwork as keyof typeof reward.networks;
        const networkReward = reward.networks[networkKey];

        if (!networkReward?.contractId) {
          console.log(
            `No contract ID found for reward ${reward.id} on network ${currentNetwork}`
          );
          continue;
        }

        const contractId = networkReward.contractId;

        try {
          // Create CONTRACT instance for the reward token

          if (!ci) {
            ci = new CONTRACT(
              Number(contractId),
              clients.algod,
              undefined,
              abi.custom,
              {
                addr: activeAccount.address,
                sk: new Uint8Array(),
              }
            );
          }
          const ciTok = new CONTRACT(
            Number(contractId),
            clients.algod,
            undefined,
            abi.nt200,
            {
              addr: activeAccount.address,
              sk: new Uint8Array(),
            }
          );
          const builder = {
            token: new CONTRACT(
              Number(contractId),
              clients.algod,
              undefined,
              abi.nt200,
              {
                addr: activeAccount.address,
                sk: new Uint8Array(),
              },
              true,
              false,
              true
            ),
          };
          // check allowance
          const arc200_allowanceR = await ciTok.arc200_allowance(
            reward.airdropAccount,
            activeAccount.address
          );
          if (!arc200_allowanceR.success) {
            throw new Error(
              arc200_allowanceR.error || `Failed to claim reward ${reward.id}`
            );
          }
          const allowance = arc200_allowanceR.returnValue;
          if (allowance == BigInt(0)) {
            continue;
          }

          // Call arc200_transferFrom to transfer from airdrop account to user with optin
          {
            console.log("arc200_transferFrom", {
              from: reward.airdropAccount,
              to: activeAccount.address,
              allowance: allowance.toString(),
            });

            const txnO = (
              await builder.token.arc200_transferFrom(
                reward.airdropAccount,
                activeAccount.address,
                allowance
              )
            ).obj;
            buildN.push({
              ...txnO,
              payment: paymentAmount++,
              note: Uint8Array.from(
                Buffer.from(
                  `dorkfi claim reward ${reward.id} transfer (amount: ${rewardData.formatted} ${reward.symbol})`
                )
              ),
            });
            // withdraw if token standard is network or asa
            if (
              tokenStandardUsesNativeWalletBalance(reward.tokenStandard) ||
              reward.tokenStandard === "asa"
            ) {
              // TODO: cond optin for asa
              const txnW = (await builder.token.withdraw(allowance)).obj;
              const optinW = voiToken.underlyingAssetId
                ? {
                  xaid: Number(voiToken.underlyingAssetId),
                  snd: activeAccount.address,
                  arcv: activeAccount.address,
                }
                : {};
              buildN.push({
                ...txnW,
                ...optinW,
                note: Uint8Array.from(
                  Buffer.from(
                    `dorkfi claim reward ${reward.id} withdraw (amount: ${rewardData.formatted} ${reward.symbol})`
                  )
                ),
              });
            }
          }
        } catch (error) {
          console.error(`Error claiming reward ${reward.id}:`, error);
          toast({
            title: "Claim Error",
            description: `Failed to claim ${reward.name}: ${error instanceof Error ? error.message : "Unknown error"
              }`,
            variant: "destructive",
          });
          // Continue with other rewards even if one fails
        }
      }

      console.log({ buildN });

      if (!ci) throw new Error("No claimable rewards to process");
      ci.setFee(2000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      if (currentNetwork === "algorand-mainnet") {
        ci.setBeaconId(3209233839);
      }
      const customR = await ci.custom();

      console.log({ customR });

      if (!customR.success) {
        throw new Error(customR.error || "Failed to claim rewards");
      }

      const stxns = customR.txns.map((txn: string) =>
        Uint8Array.from(Buffer.from(txn, "base64"))
      );

      // Sign all transactions
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Claim Transaction",
        description: `Please open ${walletName} and sign the claim transaction`,
        duration: 10000,
      });

      const signedTxns = await signTransactions(stxns);
      const algorandClients = await getSyncedClientsForTransactions();

      // Send all transactions
      const res = await algorandClients.algod
        .sendRawTransaction(signedTxns)
        .do();

      // TODO: fix this
      // Wait for all confirmations
      //await algosdk.waitForConfirmation(algorandClients.algod, res.txid, 4);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get reward names before clearing
      const rewardNames = Object.keys(claimableRewards)
        .map((rewardId) => {
          const rewardInfo = rewards.find((r) => r.id.toString() === rewardId);
          return rewardInfo?.name;
        })
        .filter(Boolean) as string[];

      // Store the claimed amount before clearing rewards (for success message)
      const claimedData = {
        formatted: formattedTotalThisBatch,
        symbol: rewardSymbol,
        rewardNames, // Store reward names for sharing
      };
      setClaimedAmount(claimedData);

      toast({
        title: "Claim Successful",
        description: `Successfully claimed ${formattedTotalThisBatch} ${rewardSymbol}`,
      });

      // Clear claimable rewards - the useEffect will refresh them automatically
      setClaimableRewards({});

      // Show success confirmation
      setClaimConfirmed(true);
    } catch (error) {
      console.error("Claim error:", error);
      toast({
        title: "Claim Failed",
        description:
          error instanceof Error ? error.message : "Failed to claim rewards",
        variant: "destructive",
      });
      setClaimConfirmed(false);
      setClaimedAmount(null);
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle direct deposit to market (claims rewards and deposits in one transaction group)
  const handleDirectDepositToMarket = async () => {
    if (!activeAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deposit rewards",
        variant: "destructive",
      });
      return;
    }

    if (!voiToken || !voiToken.poolId || !voiToken.underlyingContractId) {
      toast({
        title: "Token Configuration Error",
        description: "VOI token configuration not found",
        variant: "destructive",
      });
      return;
    }

    if (!hasClaimableRewards || totalClaimableAmount === 0) {
      toast({
        title: "No Rewards Available",
        description: "You don't have any rewards to deposit",
        variant: "destructive",
      });
      return;
    }

    if (isClaiming) {
      return; // Prevent multiple simultaneous operations
    }

    setIsClaiming(true);

    try {
      const clients = await getSyncedClientsForReads();
      ARC200Service.initialize(clients);

      // Get token config for deposit
      const tokenConfigRaw = getTokenConfig(
        currentNetwork,
        voiToken.symbol === "aVOI" ? "aVOI" : "VOI"
      );

      if (!tokenConfigRaw) {
        throw new Error("Token configuration not found for deposit");
      }

      const tokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw[0]
        : tokenConfigRaw;

      if (
        !tokenConfig ||
        Array.isArray(tokenConfig) ||
        !tokenConfig.tokenStandard
      ) {
        throw new Error("Token configuration invalid for deposit");
      }

      // Convert claimable amount to atomic units for deposit (use batch total since we only claim first 3)
      const depositAmount = totalClaimableThisBatch.toString();
      const bigAmount = BigInt(depositAmount);

      // Check if market is paused
      const marketPaused = await isMarketPaused(
        voiToken.poolId,
        voiToken.underlyingContractId,
        currentNetwork
      );
      if (marketPaused) {
        throw new Error("Market is paused");
      }

      // Get market info
      const marketInfo = await fetchMarketInfo(
        voiToken.poolId,
        voiToken.underlyingContractId,
        currentNetwork
      );
      if (!marketInfo) {
        throw new Error("Failed to fetch market info");
      }

      // Get network config
      const networkConfig = getCurrentNetworkConfig();

      // Build claim transactions first
      const claimBuildN: Record<string, unknown>[] = [];
      let counter = 0;

      // Build claim transactions for each reward (limit to 4 at once)
      for (const [rewardId, rewardData] of Object.entries(claimableRewards).slice(0, MAX_CLAIMS_PER_TX)) {
        if (rewardData.amount <= 0) continue;

        const reward = rewards.find((r) => r.id.toString() === rewardId);
        if (!reward) continue;

        const networkKey = currentNetwork as keyof typeof reward.networks;
        const networkReward = reward.networks[networkKey];

        if (!networkReward?.contractId) {
          console.log(
            `No contract ID found for reward ${reward.id} on network ${currentNetwork}`
          );
          continue;
        }

        const contractId = networkReward.contractId;

        try {
          const ciTok = new CONTRACT(
            Number(contractId),
            clients.algod,
            undefined,
            abi.nt200,
            {
              addr: activeAccount.address,
              sk: new Uint8Array(),
            }
          );

          const rewardBuilder = {
            token: new CONTRACT(
              Number(contractId),
              clients.algod,
              undefined,
              abi.nt200,
              {
                addr: activeAccount.address,
                sk: new Uint8Array(),
              },
              true,
              false,
              true
            ),
          };

          const arc200_allowanceR = await ciTok.arc200_allowance(
            reward.airdropAccount,
            activeAccount.address
          );
          if (!arc200_allowanceR.success) {
            throw new Error(
              arc200_allowanceR.error || `Failed to claim reward ${reward.id}`
            );
          }
          const allowance = arc200_allowanceR.returnValue;
          if (allowance == BigInt(0)) {
            continue;
          }
          // Add claim transfer transaction
          const txnO = (
            await rewardBuilder.token.arc200_transferFrom(
              reward.airdropAccount,
              activeAccount.address,
              allowance
            )
          ).obj;
          claimBuildN.push({
            ...txnO,
            payment: 28500 + counter++,
            note: Uint8Array.from(
              Buffer.from(
                `dorkfi claim reward ${reward.id} transfer (amount: ${rewardData.formatted} ${reward.symbol})`
              )
            ),
          });
        } catch (error) {
          console.error(`Error claiming reward ${reward.id}:`, error);
          toast({
            title: "Claim Error",
            description: `Failed to claim ${reward.name}: ${error instanceof Error ? error.message : "Unknown error"
              }`,
            variant: "destructive",
          });
        }
      }

      // Now build deposit transactions and add to same buildN array
      // Create deposit builder contracts
      const depositBuilder = {
        lending: new CONTRACT(
          Number(voiToken.poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: activeAccount.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        token: new CONTRACT(
          Number(voiToken.underlyingContractId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: activeAccount.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        ntoken: new CONTRACT(
          Number(marketInfo.ntokenId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: activeAccount.address,
            sk: new Uint8Array(),
          }
        ),
        arc200Exchange: new CONTRACT(
          Number(voiToken.underlyingContractId),
          clients.algod,
          undefined,
          {
            name: "arc200Exchange",
            desc: "arc200Exchange",
            methods: [
              {
                name: "arc200_redeem",
                args: [{ name: "amount", type: "uint64" }],
                returns: { type: "void" },
              },
            ],
            events: [],
          },
          {
            addr: activeAccount.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      // Try different payment combinations (same logic as deposit function)
      let customTx: { success: boolean; txns?: string[] } = { success: false };
      for (const p of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const buildN = [...claimBuildN];
        const [p1, p2] = p;
        const depositBuildN = [...buildN]; // Start with claim transactions

        // Approve spending of token
        {
          const txnO = (
            await depositBuilder.token.arc200_approve(
              algosdk.encodeAddress(
                algosdk.getApplicationAddress(Number(voiToken.poolId)).publicKey
              ),
              BigInt(new BigNumber(depositAmount).multipliedBy(1.1).toFixed(0))
            )
          ).obj;
          depositBuildN.push({
            ...txnO,
            payment: p1 > 0 ? 28500 + counter++ : 0,
            note: new TextEncoder().encode("arc200 approve"),
          });
        }

        // Deposit to lending pool
        {
          const foreignApps = [];
          if (networkConfig.networkId === "voi-mainnet") {
            foreignApps.push(47138065);
          }
          if (networkConfig.networkId === "algorand-mainnet") {
            foreignApps.push(3333688254);
          }
          const payment = p2 > 0 ? 9e5 : 1e5;
          const txnO = (
            await depositBuilder.lending.deposit(
              Number(voiToken.underlyingContractId),
              bigAmount
            )
          ).obj as Record<string, unknown>;
          depositBuildN.push({
            ...txnO,
            note: new TextEncoder().encode("lending deposit"),
            payment,
            foreignApps,
          });
        }

        // Create combined transaction group using poolId CONTRACT
        const ci = new CONTRACT(
          Number(voiToken.poolId),
          clients.algod,
          undefined,
          abi.custom,
          {
            addr: activeAccount.address,
            sk: new Uint8Array(),
          }
        );

        ci.setFee(20000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(depositBuildN);
        if (networkConfig.networkId === "algorand-mainnet") {
          ci.setBeaconId(3209233839);
        }

        customTx = await ci.custom();

        if (customTx.success) {
          break;
        }
      }

      if (!customTx.success) {
        throw new Error(
          "Failed to create combined claim and deposit transaction"
        );
      }

      // Sign and send combined transaction group
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the claim and deposit transaction`,
        duration: 10000,
      });

      const allTxns = customTx.txns.map((txn: string) =>
        Uint8Array.from(Buffer.from(txn, "base64"))
      );

      const signedTxns = await signTransactions(allTxns);
      const algorandClients = await getSyncedClientsForTransactions();

      // Send all transactions
      const res = await algorandClients.algod
        .sendRawTransaction(signedTxns)
        .do();

      // Wait for confirmation
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      // Decode transactions to find the pool transaction ID
      const decodedStxns = signedTxns.map((txn: Uint8Array) => {
        return algosdk.decodeSignedTransaction(txn);
      });
      type DecodedAppTxn = { txn: { type: string; applicationCall?: { appIndex: number }; txID(): string } };
      const poolTxn = decodedStxns
        .reverse()
        .find(
          (txn): txn is DecodedAppTxn =>
            (txn as DecodedAppTxn).txn?.type === "appl" &&
            typeof (txn as DecodedAppTxn).txn?.applicationCall?.appIndex === "number" &&
            Number((txn as DecodedAppTxn).txn.applicationCall!.appIndex) === parseInt(voiToken.poolId || "")
        );
      const poolTxnID = poolTxn?.txn?.txID?.();
      if (poolTxnID) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // Retry until metadata update succeeds
        let metadataUpdated = false;
        let retryCount = 0;
        const maxRetries = 10;
        const apiBaseUrl =
          import.meta.env.VITE_DORKFI_API_URL ||
          "https://dorkfi-api.nautilus.sh";
        const networkParam = currentNetwork ? `?network=${currentNetwork}` : "";

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

      // Get reward names before clearing
      const rewardNames = Object.keys(claimableRewards)
        .map((rewardId) => {
          const rewardInfo = rewards.find((r) => r.id.toString() === rewardId);
          return rewardInfo?.name;
        })
        .filter(Boolean) as string[];

      // Store the claimed and deposited amount (for success message)
      const claimedData = {
        formatted: formattedTotalThisBatch,
        symbol: rewardSymbol,
        wasDeposited: true, // Mark that this was deposited directly
        rewardNames, // Store reward names for sharing
      };
      setClaimedAmount(claimedData);

      toast({
        title: "Success!",
        description: `Successfully claimed and deposited ${formattedTotalThisBatch} ${rewardSymbol} into the market`,
      });

      // Clear claimable rewards - the useEffect will refresh them automatically
      setClaimableRewards({});

      // Show success confirmation modal
      setClaimConfirmed(true);

      // Refresh wallet balance
      if (voiToken.symbol) {
        await refreshWalletBalance(voiToken.symbol);
      }
    } catch (error) {
      console.error("Direct deposit error:", error);
      toast({
        title: "Deposit Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to claim and deposit rewards",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = () => {
    void loadAllMarkets(true);
    setMarketsToolbarAlgoRefreshNonce((n) => n + 1);
  };

  // Refresh wallet balance for a specific asset (clears cache and refetches)
  const refreshWalletBalance = async (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    const cacheKey = marketsTableWalletBalanceCacheKey(
      asset,
      poolId,
      marketRowKey
    );
    setWalletBalances((prev) => {
      const newBalances = { ...prev };
      delete newBalances[cacheKey];
      delete newBalances[asset];
      return newBalances;
    });

    if (activeAccount?.address) {
      invalidateWalletBalanceRpc(activeAccount.address);
    }

    await fetchWalletBalance(asset, poolId, marketRowKey, {
      bypassCache: true,
    });
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
  const fetchWalletBalance = async (
    asset: string,
    poolId?: string,
    marketRowKey?: string,
    opts?: { bypassCache?: boolean }
  ) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    const cacheKey = marketsTableWalletBalanceCacheKey(
      asset,
      poolId,
      marketRowKey
    );

    if (!opts?.bypassCache && walletBalances[cacheKey] !== undefined) {
      return walletBalances[cacheKey];
    }

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token =
        resolveTokenForDisplayedAsset(asset, poolId, marketRowKey) ??
        (poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset));

      if (!token) {
        console.error(
          `Token ${asset} not found in network config${poolId ? ` with poolId ${poolId}` : ""
          }`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // `network.tokens` key (e.g. `ALGO`); row may have `originalSymbol` `fALGO` under that key.
      const originalSymbol =
        "originalSymbol" in token ? (token as { originalSymbol?: string }).originalSymbol : asset;
      const originalTokenConfig = resolveTokenConfigFromDisplayToken(
        currentNetwork,
        {
          configKey: (token as { configKey?: string }).configKey,
          originalSymbol,
          symbol: token.symbol,
          poolId: token.poolId,
          underlyingContractId: token.underlyingContractId,
        }
      );

      if (!originalTokenConfig) {
        console.error(
          `Original token config not found for ${asset} (poolId: ${token.poolId}, contractId: ${token.underlyingContractId})`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Folks fALGO row: `getAllTokensWithDisplayInfo` can match the standalone `tokens.fALGO`
      // (ASA) when display symbol + pool id collide with another market. That path reads the
      // f-ASA wallet balance (often 0) while the ALGO deposit route spends native ALGO.
      // `SupplyBorrowModal` loads f-ASA separately; cache native spendable here for underlying route.
      const folksDepositAdapters = getFolksAdaptersForPhase(
        originalTokenConfig,
        "deposit"
      );
      const useNativeAlgoForFolksAlgoHybridDeposit =
        currentNetwork === "algorand-mainnet" &&
        folksDepositAdapters.some((a) => a.depositWalletBasis === "market_token") &&
        folksDepositAdapters.some(
          (a) => (a.depositWalletBasis ?? "underlying") === "underlying"
        ) &&
        folksDepositAdapters.some((a) => a.folksParams.pool === "ALGO");

      /** Folks underlying-ASA id when a deposit adapter spends underlying (e.g. USDC for `tokens.fUSDC`). */
      const folksUnderlyingDepositAdapter = folksDepositAdapters.find(
        (a) =>
          a.type === "folks" &&
          (a.depositWalletBasis ?? "underlying") === "underlying"
      );
      const folksUnderlyingAsaStr =
        folksUnderlyingDepositAdapter?.type === "folks"
          ? String(folksUnderlyingDepositAdapter.folksParams.assetId ?? "").trim()
          : "";
      const folksUnderlyingAsaIdForWallet =
        folksUnderlyingAsaStr !== "" && folksUnderlyingAsaStr !== "-"
          ? parseInt(folksUnderlyingAsaStr, 10)
          : NaN;
      const useFolksUnderlyingAsaWalletBalance =
        folksUnderlyingDepositAdapter?.type === "folks" &&
        Number.isFinite(folksUnderlyingAsaIdForWallet) &&
        folksUnderlyingAsaIdForWallet > 0;

      // Initialize ARC200Service with current clients
      const clients = await getSyncedClientsForReads();
      ARC200Service.initialize(clients);
      const bypassRpc = opts?.bypassCache === true;

      // Warm / reuse a single accountInformation snapshot for native + ASA reads.
      if (
        useNativeAlgoForFolksAlgoHybridDeposit ||
        useFolksUnderlyingAsaWalletBalance ||
        tokenStandardUsesNativeWalletBalance(originalTokenConfig.tokenStandard) ||
        originalTokenConfig.tokenStandard === "asa-asa" ||
        originalTokenConfig.tokenStandard === "asa" ||
        originalTokenConfig.tokenStandard === "network-asa" ||
        originalTokenConfig.tokenStandard === "arc200-exchange"
      ) {
        try {
          await getCachedAccountInformation(
            clients.algod,
            activeAccount.address,
            { bypassCache: bypassRpc }
          );
        } catch {
          // Individual paths still fall back to their own reads.
        }
      }

      // Debug: Log token config details
      console.log("[MarketsTable] Token config for balance fetch:", {
        asset,
        network: currentNetwork,
        tokenStandard: originalTokenConfig.tokenStandard,
        underlyingContractId: token.underlyingContractId,
        underlyingAssetId: token.underlyingAssetId,
        poolId: token.poolId,
        address: activeAccount.address,
        useNativeAlgoForFolksAlgoHybridDeposit,
      });

      let balance = 0;

      // Handle different token standards
      if (useNativeAlgoForFolksAlgoHybridDeposit) {
        console.log(
          `[MarketsTable] Folks ALGO hybrid deposit market — using native spendable ALGO for ${asset}`
        );
        try {
          const accountInfo = await getCachedAccountInformation(
            clients.algod,
            activeAccount.address,
            { bypassCache: bypassRpc }
          );
          balance = spendableAlgoHumanFromAccount(accountInfo);
        } catch (error) {
          console.error(
            `Error fetching native ALGO balance for Folks hybrid market ${asset}:`,
            error
          );
          balance = 0;
        }
      } else if (useFolksUnderlyingAsaWalletBalance) {
        // Standalone f-asset rows (e.g. `tokens.fUSDC`) use f-ASA in config; default deposit route is
        // underlying USDC (`folksParams.assetId`), same as `SupplyBorrowModal` after route selection.
        try {
          const atomic = await getCachedAsaHoldingAtomic(
            clients.algod,
            activeAccount.address,
            folksUnderlyingAsaIdForWallet,
            { bypassCache: bypassRpc }
          );
          balance =
            Number(atomic) / Math.pow(10, originalTokenConfig.decimals);
        } catch (error) {
          console.error(
            `Error fetching Folks underlying ASA balance for ${asset}:`,
            error
          );
          balance = 0;
        }
      } else if (
        originalTokenConfig.tokenStandard === "arc200" &&
        token.underlyingContractId
      ) {
        // Fetch ARC200 token balance
        console.log(
          `Fetching ARC200 balance for ${asset} (contract: ${token.underlyingContractId})`
        );
        if (bypassRpc) {
          invalidateWalletBalanceRpc(activeAccount.address);
        }
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
      } else if (
        tokenStandardUsesNativeWalletBalance(originalTokenConfig.tokenStandard)
      ) {
        // For network tokens (like VOI), fetch native balance
        console.log(`[MarketsTable] Entering network token balance fetch for ${asset}`, {
          tokenStandard: originalTokenConfig.tokenStandard,
          address: activeAccount.address,
          network: currentNetwork,
        });
        console.log(`Fetching network token balance for ${asset}`);
        try {
          const accountInfo = await getCachedAccountInformation(
            clients.algod,
            activeAccount.address,
            { bypassCache: bypassRpc }
          );
          console.log(`[MarketsTable] accountInfo for ${asset}:`, accountInfo);
          balance = spendableAlgoHumanFromAccount(accountInfo);
          console.log(`[MarketsTable] Network token balance for ${asset}:`, {
            rawAmount: accountInfo.amount,
            balance,
            minBalance: accountInfo.minBalance,
          });
        } catch (error) {
          console.error(
            `Error fetching network token balance for ${asset}:`,
            error
          );
          balance = 0;
        }
      } else if (
        originalTokenConfig.tokenStandard === "asa-asa" &&
        originalTokenConfig.assetId != null &&
        String(originalTokenConfig.assetId).trim() !== ""
      ) {
        const assetId = parseInt(String(originalTokenConfig.assetId).trim(), 10);
        console.log(
          `Fetching ASA balance for ${asset} (asa-asa asset ID: ${assetId})`
        );
        try {
          const atomic = await getCachedAsaHoldingAtomic(
            clients.algod,
            activeAccount.address,
            assetId,
            { bypassCache: bypassRpc }
          );
          balance =
            Number(atomic) / Math.pow(10, originalTokenConfig.decimals);
          console.log(`ASA balance for ${asset}: ${balance}`);
        } catch (error) {
          console.error(`Error fetching ASA balance for ${asset}:`, error);
          balance = 0;
        }
      } else if (
        (originalTokenConfig.tokenStandard === "asa" ||
          originalTokenConfig.tokenStandard === "network-asa") &&
        token.underlyingAssetId
      ) {
        // For ASA and Folks network-asa (e.g. fALGO): wallet holds the f-ASA; fetch by asset id.
        console.log(
          `Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`
        );
        try {
          const assetId = parseInt(token.underlyingAssetId);
          const atomic = await getCachedAsaHoldingAtomic(
            clients.algod,
            activeAccount.address,
            assetId,
            { bypassCache: bypassRpc }
          );
          balance =
            Number(atomic) / Math.pow(10, originalTokenConfig.decimals);
          console.log(`ASA balance for ${asset}: ${balance}`);
        } catch (error) {
          console.error(`Error fetching ASA balance for ${asset}:`, error);
          balance = 0;
        }
      } else if (originalTokenConfig.tokenStandard === "arc200-exchange") {
        // For ASA tokens, fetch asset balance
        console.log(
          `Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`
        );
        try {
          const assetId = parseInt(token.underlyingAssetId);
          const atomic = await getCachedAsaHoldingAtomic(
            clients.algod,
            activeAccount.address,
            assetId,
            { bypassCache: bypassRpc }
          );
          balance =
            Number(atomic) / Math.pow(10, originalTokenConfig.decimals);
          console.log(`ASA balance for ${asset}: ${balance}`);
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

      // Calculate USD value (same display asset may map to multiple rows)
      const marketForPrice = findMarketRow(
        marketsData as Record<string, Record<string, unknown>>,
        marketsForLookup as Record<string, unknown>[],
        asset,
        poolId,
        marketRowKey
      );
      const tokenPrice = marketForPrice
        ? normalizeMarketData(marketForPrice, currentNetwork as NetworkId).price
        : 0;
      const balanceUSD = balance * tokenPrice;

      console.log({
        balance,
        tokenPrice,
        balanceUSD,
      });

      const balanceData = {
        balance,
        balanceUSD,
      };

      setWalletBalances((prev) => {
        const next = {
          ...prev,
          [cacheKey]: balanceData,
        };
        if (activeAccount?.address) {
          writeMarketsWalletBalancesSession(
            currentNetwork,
            activeAccount.address,
            next
          );
        }
        return next;
      });

      console.log(`Final balance data for ${asset}:`, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  const debouncedPrefetch = useMemo(() => createDebouncedPrefetch(), []);

  const marketHoverBundle = useMemo(
    () => ({
      debounced: debouncedPrefetch,
      userAddress: activeAccount?.address,
      networkId: currentNetwork as NetworkId,
      warmWalletBalance: (p: MarketActionTokenParams) => {
        if (!activeAccount?.address) return;
        // Use the real markets `_sortKey` so hover cache matches modal open.
        void fetchWalletBalance(p.asset, p.poolId, p.marketRowKey);
      },
    }),
    [debouncedPrefetch, activeAccount?.address, currentNetwork]
  );

  const getMarketActionHoverHandlers = useCallback(
    (asset: string, poolId?: string, marketRowKey?: string) =>
      buildMarketHoverHandlers(
        marketHoverBundle,
        asset,
        poolId,
        marketRowKey
      ),
    [marketHoverBundle]
  );

  const prefetchMarketRowOnHover = useCallback(
    (market: Record<string, unknown>) => {
      if (!activeAccount?.address) return;
      const asset = typeof market.asset === "string" ? market.asset : null;
      if (!asset) return;
      const poolId = poolIdFromMarketRow(
        market as { marketInfo?: { poolId?: string }; poolId?: string }
      );
      const rowKey = marketRowKeyFromMarket(
        market as { asset?: string; poolId?: string; configSymbol?: string; _sortKey?: string }
      );
      const configSymbol =
        typeof (market as { configSymbol?: string }).configSymbol === "string"
          ? (market as { configSymbol?: string }).configSymbol
          : configSymbolFromMarketRowKey(rowKey);
      debouncedPrefetch(
        `detailRow:${currentNetwork}:${asset}:${poolId ?? ""}:${configSymbol ?? ""}`,
        () =>
          warmMarketDetailUserPositionRpc({
            userAddress: activeAccount.address,
            networkId: currentNetwork as NetworkId,
            asset,
            poolId,
            configSymbol,
          })
      );
    },
    [activeAccount?.address, currentNetwork, debouncedPrefetch]
  );

  const getAssetData = (asset: string, poolId?: string, marketRowKey?: string) => {
    const poolIdStr = poolId != null && poolId !== "" ? String(poolId) : null;
    let market: (typeof marketsForLookup)[0] | undefined;

    if (marketRowKey) {
      market = marketsForLookup.find(
        (m) => (m as { _sortKey?: string })._sortKey === marketRowKey
      );
    }

    if (!market && poolIdStr) {
      const contractFromKey = marketContractIdFromRowCacheKey(marketRowKey);
      if (contractFromKey) {
        const displayToken = resolveTokenForDisplayedAsset(
          asset,
          poolIdStr,
          marketRowKey
        );
        market = marketsForLookup.find((m) => {
          if (m.asset !== asset) return false;
          const poolMatch =
            String(m.poolId) === poolIdStr ||
            String(
              (m as { marketInfo?: { poolId?: string } }).marketInfo?.poolId
            ) === poolIdStr;
          if (!poolMatch) return false;
          const mid =
            m.marketInfo?.marketId != null
              ? String(m.marketInfo.marketId)
              : displayToken?.underlyingContractId;
          return mid === contractFromKey;
        });
      }
      if (!market) {
        // Exact match by asset + poolId (required for 2 WAD markets etc.)
        market = marketsForLookup.find(
          (m) =>
            m.asset === asset &&
            (String(m.poolId) === poolIdStr ||
              String(
                (m as { marketInfo?: { poolId?: string } }).marketInfo?.poolId
              ) === poolIdStr)
        );
      }
      if (!market) return null;
    }

    if (!market) {
      // No poolId provided – find by asset only
      const matchingMarkets = marketsForLookup.filter((m) => m.asset === asset);
      if (matchingMarkets.length > 1) {
        market = matchingMarkets.reduce((prev, current) => {
          return (current.totalSupply || 0) > (prev.totalSupply || 0)
            ? current
            : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    if (!market) return null;

    // Safely resolve APY values - avoid NaN in deposit modal (include rewards bonus when present)
    const rewardsBonus =
      typeof market.rewardsBonusSupplyAprPercent === "number" &&
      !Number.isNaN(market.rewardsBonusSupplyAprPercent)
        ? market.rewardsBonusSupplyAprPercent
        : 0;
    const intrinsicBonus =
      typeof market.intrinsicSupplyApyPercent === "number" &&
      !Number.isNaN(market.intrinsicSupplyApyPercent)
        ? market.intrinsicSupplyApyPercent
        : 0;
    const intrinsicBorrowBonus =
      typeof market.intrinsicBorrowApyPercent === "number" &&
      !Number.isNaN(market.intrinsicBorrowApyPercent)
        ? market.intrinsicBorrowApyPercent
        : 0;
    const baseSupplyApy =
      typeof market.supplyAPY === "number" && !Number.isNaN(market.supplyAPY)
        ? market.supplyAPY
        : (typeof market.apyCalculation?.apy === "number" &&
          !Number.isNaN(market.apyCalculation?.apy))
          ? market.apyCalculation.apy
          : 0;
    const supplyAPY = baseSupplyApy + rewardsBonus + intrinsicBonus;
    const borrowAPYBase =
      typeof market.borrowAPY === "number" && !Number.isNaN(market.borrowAPY)
        ? market.borrowAPY
        : (typeof market.borrowApyCalculation?.apy === "number" &&
          !Number.isNaN(market.borrowApyCalculation?.apy))
          ? market.borrowApyCalculation.apy
          : 0;
    const borrowAPY = borrowAPYBase + intrinsicBorrowBonus;

    const marketInfo = (market as { marketInfo?: { borrowRate?: number; slope?: number; reserveFactor?: number } }).marketInfo;
    const apyParameters =
      marketInfo &&
      typeof marketInfo.borrowRate === "number" &&
      typeof marketInfo.slope === "number" &&
      typeof marketInfo.reserveFactor === "number"
        ? {
            borrowRateBps: Math.round(marketInfo.borrowRate * 10000),
            slopeBps: Math.round(marketInfo.slope * 10000),
            reserveFactorBps: Math.round(marketInfo.reserveFactor * 10000),
          }
        : undefined;

    const rowKeyForConfig =
      marketRowKey ?? (market as { _sortKey?: string })._sortKey;
    const displayToken = resolveTokenForDisplayedAsset(
      asset,
      poolIdStr ?? undefined,
      rowKeyForConfig
    );
    const tokenConfig =
      displayToken != null
        ? resolveTokenConfigFromDisplayToken(currentNetwork, displayToken)
        : undefined;
    const decimals = (tokenConfig as { decimals?: number } | undefined)?.decimals ?? 8;

    return {
      icon: market.icon,
      decimals,
      totalSupply: market.totalSupply,
      totalSupplyUSD: market.totalSupplyUSD,
      supplyAPY,
      totalBorrow: market.totalBorrow,
      totalBorrowUSD: market.totalBorrowUSD,
      borrowAPY,
      utilization: market.utilization,
      collateralFactor: market.collateralFactor,
      liquidationThreshold: market.liquidationThreshold,
      liquidity: market.totalSupply - market.totalBorrow,
      liquidityUSD: market.totalSupplyUSD - market.totalBorrowUSD,
      reserveFactor: market.reserveFactor,
      apyCalculation: market.apyCalculation,
      borrowApyCalculation: (market as { borrowApyCalculation?: { apy: number } }).borrowApyCalculation,
      apyParameters,
      maxTotalDeposits: market.supplyCap,
      maxTotalBorrows: market.borrowCap,
      isSToken: market.isSToken,
    };
  };

  const detailPositionLoadKeyRef = useRef<string | null>(null);
  const detailPositionLoadIdRef = useRef(0);

  useEffect(() => {
    if (!detailModal.isOpen) {
      detailPositionLoadKeyRef.current = null;
      setDetailModalUserPosition(null);
      setDetailModalUserPositionLoad("idle");
      return;
    }

    const row = detailModal.marketData;
    const asset = detailModal.asset;
    if (!row || !asset) {
      setDetailModalUserPosition(null);
      setDetailModalUserPositionLoad("idle");
      return;
    }

    if (!activeAccount?.address) {
      setDetailModalUserPosition(null);
      setDetailModalUserPositionLoad("idle");
      return;
    }

    const poolId = detailModal.poolId;
    const rowLastFetched = (row as { lastFetched?: number }).lastFetched;
    const loadKey = [
      asset,
      poolId ?? "",
      detailModal.marketRowKey ?? "",
      activeAccount.address,
      currentNetwork,
      rowLastFetched ?? "",
    ].join("|");

    const tokens = getAllTokensWithDisplayInfo(currentNetwork);
    const token =
      resolveTokenForDisplayedAsset(
        asset,
        poolId,
        detailModal.marketRowKey
      ) ??
      (poolId != null && poolId !== ""
        ? tokens.find(
            (t) => t.symbol === asset && String(t.poolId) === String(poolId)
          )
        : tokens.find((t) => t.symbol === asset));

    if (!token?.poolId || !token.underlyingContractId) {
      setDetailModalUserPosition(null);
      setDetailModalUserPositionLoad("idle");
      return;
    }

    const loadId = ++detailPositionLoadIdRef.current;
    const userAddress = activeAccount.address;
    const rpcPoolId = token.poolId;
    const rpcMarketId = token.underlyingContractId;
    const tokenDecimals = token.decimals;

    setDetailModalUserPosition(null);
    setDetailModalUserPositionLoad("loading");

    const buildPosition = (
      depositBal: number | null,
      borrowData: { balance: number; interest: number } | null,
      globalData: Awaited<ReturnType<typeof fetchUserGlobalData>>,
      portfolioHealthFactor: number | null,
      maxWithdrawUnderlying: number | null
    ): MarketDetailUserPosition => {
      const norm = normalizeMarketData(row, currentNetwork as NetworkId);
      const price =
        norm.price > 0 && Number.isFinite(norm.price) ? norm.price : 0;
      const assetData = getAssetData(asset, poolId, detailModal.marketRowKey);

      const dep = depositBal ?? 0;
      const bor = borrowData?.balance ?? 0;
      const suppliedUsdRaw = dep * price;
      const suppliedUsd = roundUsdToCents(suppliedUsdRaw);
      const borrowedUsd = roundUsdToCents(bor * price);
      const withdrawableTokens = maxWithdrawUnderlying ?? dep;
      const withdrawableUsd = roundUsdToCents(withdrawableTokens * price);

      const collateralFactor =
        assetData?.collateralFactor ?? norm.maxLTV ?? 0;
      let borrowableUsd = 0;
      if (globalData) {
        const cfDec = collateralFactor / 100;
        borrowableUsd = Math.max(
          0,
          globalData.totalCollateralValue * cfDec -
            globalData.totalBorrowValue
        );
        const totalBorrow =
          assetData?.totalBorrow ?? Number(row.totalBorrow ?? 0);
        const borrowCap = assetData?.maxTotalBorrows ?? 0;
        if (borrowCap > 0 && price > 0) {
          const remainingBorrowCapTokens = Math.max(
            0,
            borrowCap - totalBorrow
          );
          const remainingBorrowCapUsd = remainingBorrowCapTokens * price;
          borrowableUsd = Math.min(borrowableUsd, remainingBorrowCapUsd);
        }
      }
      borrowableUsd = roundUsdToCents(borrowableUsd);

      let healthFactor = 0;
      if (
        portfolioHealthFactor != null &&
        Number.isFinite(portfolioHealthFactor)
      ) {
        healthFactor = portfolioHealthFactor;
      } else if (globalData) {
        if (globalData.healthFactorIndex != null) {
          healthFactor = globalData.healthFactorIndex;
        } else if (
          globalData.totalBorrowValue <= 0 &&
          globalData.totalCollateralValue > 0
        ) {
          healthFactor = 3;
        } else if (
          globalData.totalBorrowValue > 0 &&
          globalData.totalCollateralValue > 0
        ) {
          healthFactor = Math.min(
            globalData.totalCollateralValue / globalData.totalBorrowValue,
            3
          );
        }
      }

      const supplyAPY = norm.supplyAPY;
      const earnings =
        supplyAPY > 0 && suppliedUsdRaw > 0
          ? roundUsdToCents(suppliedUsdRaw * (supplyAPY / 100))
          : 0;

      return {
        supplied: suppliedUsd,
        borrowed: borrowedUsd,
        withdrawable: withdrawableUsd,
        borrowable: borrowableUsd,
        healthFactor,
        earnings,
      };
    };

    detailPositionLoadKeyRef.current = loadKey;

    const load = async () => {
      try {
        const [depositBal, borrowData, globalData] = await Promise.all([
          fetchUserDepositBalance(
            userAddress,
            rpcPoolId,
            rpcMarketId,
            currentNetwork
          ),
          fetchUserBorrowBalance(
            userAddress,
            rpcPoolId,
            rpcMarketId,
            currentNetwork
          ),
          fetchUserGlobalData(userAddress, currentNetwork),
        ]);

        if (loadId !== detailPositionLoadIdRef.current) return;

        const position = buildPosition(
          depositBal,
          borrowData,
          globalData,
          null,
          null
        );
        setDetailModalUserPosition(position);
        setDetailModalUserPositionLoad("ready");

        void withRpcReadCache(
          `globalUserRows:${userAddress}`,
          () => fetchGlobalUserRowsFromChain(userAddress),
          30_000
        )
          .then((globalUserRows) => {
            if (loadId !== detailPositionLoadIdRef.current) return;
            const portfolioHealthFactor = computePortfolioDisplayHealthFactor({
              globalUserData: globalUserRows,
              deposits: [],
              marketData: markets,
              useMarketRowsForPoolLt: true,
            });
            if (portfolioHealthFactor == null) return;
            setDetailModalUserPosition((prev) =>
              prev
                ? { ...prev, healthFactor: portfolioHealthFactor }
                : prev
            );
          })
          .catch((e) => {
            console.warn("Market detail: portfolio health factor refresh failed:", e);
          });

        void getMaxWithdrawableForMarket(
          rpcPoolId,
          rpcMarketId,
          userAddress,
          currentNetwork,
          tokenDecimals
        )
          .then((maxWithdrawResult) => {
            if (loadId !== detailPositionLoadIdRef.current) return;
            if (maxWithdrawResult?.maxWithdrawUnderlying == null) return;
            setDetailModalUserPosition((prev) => {
              if (!prev) return prev;
              const norm = normalizeMarketData(row, currentNetwork as NetworkId);
              const price =
                norm.price > 0 && Number.isFinite(norm.price) ? norm.price : 0;
              const dep =
                maxWithdrawResult.maxWithdrawUnderlying > 0
                  ? maxWithdrawResult.maxWithdrawUnderlying
                  : 0;
              const effectivePrice =
                price > 0 ? price : dep > 0 ? 1 : 0;
              return {
                ...prev,
                withdrawable: roundUsdToCents(
                  maxWithdrawResult.maxWithdrawUnderlying * effectivePrice
                ),
              };
            });
          })
          .catch((e) => {
            console.warn(
              "Market detail: max withdrawable refresh failed (position still shown):",
              e
            );
          });
      } catch (e) {
        console.error("Failed to load market detail user position:", e);
        if (loadId === detailPositionLoadIdRef.current) {
          setDetailModalUserPosition(null);
          setDetailModalUserPositionLoad("error");
        }
      }
    };

    void load();
  }, [
    detailModal.isOpen,
    detailModal.asset,
    detailModal.poolId,
    detailModal.marketRowKey,
    detailModalRowLastFetched,
    activeAccount?.address,
    currentNetwork,
    // Do not depend on `markets`, `detailModal.marketData` (new refs from rewards remap), or
    // `resolveTokenForDisplayedAsset` (recreated when `markets` changes) — those caused a
    // fetch/setState loop while the detail modal stayed open.
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-0">
      <div className="space-y-2 sm:space-y-3">
        {/* Network + liquidity toolbar */}
        {enabledNetworks.length > 0 && (
          <section
            aria-labelledby="markets-toolbar-heading"
            className="mb-0"
          >
            <h2 id="markets-toolbar-heading" className="sr-only">
              Network, liquidity, and spendable ALGO
            </h2>
            <div className="rounded-xl border border-border/80 bg-muted/25 px-2.5 py-2 shadow-sm dark:bg-muted/10 sm:px-3">
              <Collapsible
                open={showMarketsLiquidityToolbar ? walletToolbarOpen : undefined}
                onOpenChange={
                  showMarketsLiquidityToolbar ? setWalletToolbarOpen : undefined
                }
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg border-border bg-muted/40 px-2.5 text-xs sm:text-sm dark:bg-muted/25 hover:bg-muted/60 dark:hover:bg-muted/35"
                        aria-label={`Network: ${getNetworkConfig(currentNetwork).name}. Change network.`}
                      >
                        <img
                          src={getNetworkLogoPath(currentNetwork)}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/placeholder.svg";
                          }}
                        />
                        <span className="max-w-[9rem] truncate font-medium sm:max-w-none">
                          {getNetworkConfig(currentNetwork).name}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Network
                      </div>
                      <DropdownMenuSeparator />
                      {enabledNetworks.map((networkId) => {
                        const networkConfig = getNetworkConfig(networkId);
                        const isCurrent = currentNetwork === networkId;
                        return (
                          <DropdownMenuItem
                            key={networkId}
                            onClick={() => switchNetwork(networkId)}
                            className="cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={getNetworkLogoPath(networkId)}
                                alt=""
                                className="h-5 w-5 rounded-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = "/placeholder.svg";
                                }}
                              />
                              <span className="text-sm">{networkConfig.name}</span>
                            </div>
                            {isCurrent && (
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {showMarketsLiquidityToolbar && (
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-border bg-muted/40 px-2.5 text-xs sm:text-sm dark:bg-muted/25"
                        >
                          <Fuel className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          Wallet &amp; gas
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              walletToolbarOpen && "rotate-180"
                            )}
                          />
                        </Button>
                      </CollapsibleTrigger>
                  )}
                </div>

                {showMarketsLiquidityToolbar && (
                      <CollapsibleContent className="border-t border-border/60 pt-2 mt-0.5">
                        <div
                          className={cn(
                            "flex flex-col gap-3",
                            "sm:flex-row sm:items-center sm:gap-3"
                          )}
                        >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="sr-only">Liquidity</span>
                      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-3 sm:w-auto">
                        <XchainUsdcBridgeControls />
                        {shouldShowXchainUsdcBridgeControls(
                          currentNetwork,
                          activeWallet?.id
                        ) && (
                          <div
                            className="pointer-events-none hidden h-5 w-px shrink-0 self-center bg-muted-foreground/50 dark:bg-muted-foreground/60 sm:block"
                            aria-hidden
                          />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex h-8 w-fit shrink-0 items-center gap-1.5 self-start rounded-lg border-border bg-muted/40 px-2.5 text-xs dark:bg-muted/25 hover:bg-muted/60 dark:hover:bg-muted/35 sm:self-center sm:text-sm"
                          onClick={() => {
                            setTinymanSwapOpenForGasUp(false);
                            setIsTinymanSwapModalOpen(true);
                          }}
                          aria-label="Open Tinyman swap"
                        >
                          <ArrowDownUp className="h-3.5 w-3.5 shrink-0" />
                          Swap
                        </Button>
                      </div>
                    </div>

                    <div
                      className="pointer-events-none hidden h-7 w-px shrink-0 self-center bg-muted-foreground/25 dark:bg-muted-foreground/35 sm:block"
                      aria-hidden
                    />
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-0 sm:max-w-md",
                        "lg:flex-none lg:shrink",
                        marketsToolbarSpendableExtraTight
                          ? "lg:max-w-[min(200px,46vw)] xl:max-w-[220px]"
                          : "lg:max-w-[min(280px,34vw)] xl:max-w-[min(300px,32vw)]"
                      )}
                    >
                      {/* Below lg: stacked; lg+: amount block | meter | Gas Up in one row */}
                      <div
                        className={cn(
                          "flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center",
                          marketsToolbarSpendableExtraTight
                            ? "lg:gap-1.5"
                            : "lg:gap-2.5"
                        )}
                      >
                        {/* Mobile: order puts meter between caption and balance; lg: caption+amount left, meter right */}
                        <span className="order-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:hidden">
                          <Fuel
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/90"
                            aria-hidden
                          />
                          Spendable
                        </span>
                        <div
                          className={cn(
                            "order-2 flex w-full min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3",
                            "lg:order-2 lg:min-w-0 lg:flex-1 lg:gap-2"
                          )}
                        >
                          <div
                            className={cn(
                              "relative isolate min-w-0 w-full overflow-hidden rounded-full sm:flex-1",
                              "h-3 min-h-[12px] ring-1 ring-border/60 bg-muted/90 dark:bg-muted/70 dark:ring-border/50",
                              "sm:h-2 sm:min-h-[8px] sm:ring-0 sm:bg-muted/70 dark:sm:bg-muted/50",
                              "lg:h-2 lg:min-h-[8px]",
                              marketsToolbarSpendableExtraTight
                                ? "lg:max-w-[5.5rem] xl:max-w-[6.5rem]"
                                : "lg:max-w-[9rem] xl:max-w-[11rem]"
                            )}
                          >
                            {marketsToolbarSpendableAlgoLoading ? (
                              <div
                                className="absolute left-0 top-0 z-[1] h-full w-1/3 animate-pulse rounded-full bg-muted-foreground/35"
                                aria-hidden
                              />
                            ) : (
                              <div
                                className={cn(
                                  "absolute left-0 top-0 z-[1] h-full min-w-0 rounded-full transition-[width] duration-300 ease-out",
                                  marketsToolbarSpendableAlgo == null
                                    ? "w-0 bg-transparent"
                                    : marketsToolbarAlgoMeterBarClass(
                                        marketsToolbarSpendableAlgo
                                      )
                                )}
                                style={
                                  marketsToolbarSpendableAlgo != null
                                    ? {
                                        width: `${marketsToolbarAlgoMeterFillPercent(marketsToolbarSpendableAlgo)}%`,
                                      }
                                    : undefined
                                }
                              />
                            )}
                          </div>
                          {!marketsToolbarSpendableAlgoIsMeterGreen(
                            marketsToolbarSpendableAlgo
                          ) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-fit shrink-0 gap-1 self-start rounded-lg border-border bg-muted/40 px-2 text-[11px] font-medium dark:bg-muted/25 hover:bg-muted/60 dark:hover:bg-muted/35 sm:self-center sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:text-xs lg:h-8 lg:px-2 lg:py-0"
                              onClick={() => {
                                setTinymanSwapOpenForGasUp(true);
                                setIsTinymanSwapModalOpen(true);
                              }}
                              aria-label="Open swap to receive ALGO for fees"
                            >
                              <CircleArrowUp className="h-3.5 w-3.5 shrink-0" />
                              Gas Up
                            </Button>
                          )}
                        </div>
                        <div className="order-3 flex min-w-0 flex-col gap-1.5 lg:order-1 lg:min-w-0 lg:shrink-0 lg:flex-row lg:items-center lg:gap-2">
                          <span className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:inline-flex lg:shrink-0">
                            <Fuel
                              className="h-3 w-3 shrink-0 text-muted-foreground/90"
                              aria-hidden
                            />
                            Spendable
                          </span>
                          <div
                            className="flex min-h-[1.75rem] min-w-0 items-baseline gap-1 lg:min-h-0 lg:gap-1"
                            role="group"
                            aria-label="Spendable ALGO for transaction fees"
                          >
                            <span
                              className={cn(
                                "min-w-0 truncate text-lg font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-xl",
                                "lg:text-sm lg:font-semibold xl:text-base",
                                marketsToolbarSpendableAlgoLoading &&
                                  "text-muted-foreground animate-pulse"
                              )}
                              title={
                                marketsToolbarSpendableAlgo != null &&
                                !marketsToolbarSpendableAlgoLoading
                                  ? `${formatNumber(marketsToolbarSpendableAlgo, {
                                      maximumFractionDigits: 6,
                                      minimumFractionDigits: 0,
                                    })} ALGO`
                                  : undefined
                              }
                            >
                              {marketsToolbarSpendableAlgoLoading
                                ? "…"
                                : marketsToolbarSpendableAlgo == null
                                  ? "—"
                                  : formatNumber(marketsToolbarSpendableAlgo, {
                                      maximumFractionDigits: 4,
                                      minimumFractionDigits: 0,
                                    })}
                            </span>
                            {!marketsToolbarSpendableAlgoLoading &&
                              marketsToolbarSpendableAlgo != null && (
                                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground lg:text-[10px] xl:text-xs">
                                  ALGO
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                        </div>
                      </CollapsibleContent>
                )}
              </Collapsible>
            </div>
          </section>
        )}

        {/* Hero Section */}
        <MarketsHeroSection />

        {/* Markets Table */}
        <div
          ref={marketsListRef}
          className="rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-gray-200/50 dark:border-ocean-teal/20 p-4 card-hover overflow-visible"
        >
          <div className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                Market Overview
                {isLoadingVisible && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Loading...)
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-row gap-2">
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
                    className="flex items-center gap-2 border-ocean-teal/20 text-ocean-teal hover:bg-ocean-teal/10"
                    aria-label="Learn more about markets (opens in new tab)"
                  >
                    Learn More
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                {hasClaimableRewards && (
                  <Button
                    size="sm"
                    onClick={() => setShowClaimModal(true)}
                    className="flex items-center gap-2 bg-yellow-400 border-2 border-yellow-400 text-slate-900 font-bold rounded-lg py-2 px-4 shadow hover:bg-yellow-300 focus:bg-yellow-300 active:bg-yellow-400"
                    style={{ minWidth: 170 }}
                    aria-label="Claim Rewards"
                  >
                    <svg
                      className="h-4 w-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-3V7a2 2 0 00-2-2h-3.28a2 2 0 01-1.95-2.58 2 2 0 00-2.58 2.58H6a2 2 0 00-2 2v2m16 0H4"
                      />
                    </svg>
                    Claim Rewards
                  </Button>
                )}
              </div>
            </div>
            <div className="relative z-20 isolate mt-4 mb-2 w-full">
              <MarketsPageGuidance />
            </div>
          </div>

          <div className="-mx-1 px-1 pb-2 rounded-lg md:sticky md:top-2 md:z-20 md:bg-blue-50/95 dark:md:bg-slate-900/95 md:backdrop-blur-sm">
            <MarketSearchFilters
              embedded
              searchTerm={searchTerm}
              onSearchChange={handleSearchTermChange}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortChange={handleSortFieldChange}
              marketFilter={marketFilter}
              onMarketFilterChange={handleMarketFilterChange}
              hasDMarketTab={hasDMarketTab}
              isMobile={isMobile}
              newMarketsCount={newMarketsCount}
              newMarketsOnly={newMarketsOnly}
              onNewMarketsOnlyChange={(v) => {
                setNewMarketsOnly(v);
                setCurrentPage(1);
              }}
              rewardMarketsCount={rewardMarketsCount}
              rewardMarketsOnly={rewardMarketsOnly}
              onRewardMarketsOnlyChange={(v) => {
                setRewardMarketsOnly(v);
                setCurrentPage(1);
              }}
              multiPoolMarketsCount={multiPoolMarketsCount}
              multiPoolOnly={multiPoolOnly}
              onMultiPoolOnlyChange={(v) => {
                setMultiPoolOnly(v);
                setCurrentPage(1);
              }}
              hasActiveFilters={hasActiveFilters}
              onClearAll={clearAllMarketFilters}
            />
          </div>

          <Separator
            className="my-5 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-ocean-teal/30"
            aria-hidden
          />

          {markets.length === 0 && !wadMintMarketDisplay && !isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No markets found. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <MarketsTableContent
              marketFilter={marketFilter}
              markets={markets}
              pinnedWadMintMarket={wadMintMarketDisplay}
              sortField={sortField}
              sortOrder={sortOrder}
              onRowClick={handleRowClick}
              onInfoClick={handleInfoClick}
              onDepositClick={handleDepositClick}
              onWithdrawClick={handleWithdrawClick}
              onBorrowClick={handleBorrowClick}
              onMintClick={handleMintClick}
              onMigrateClick={handleMigrateClick}
              isLoadingBalance={isLoadingBalance}
              getMarketActionHoverHandlers={getMarketActionHoverHandlers}
              onRowMouseEnter={prefetchMarketRowOnHover}
            />
          )}
        </div>

        {/* Pagination */}
        <MarketPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
        />

        {/* Lazy-loaded action modals — keep Markets chunk free of txn/signing stacks */}
        <Suspense fallback={null}>
        {/* Market Detail Modal */}
        {detailModal.isOpen && detailModal.asset && detailModal.marketData && (
          <PremiumMarketModal
            isOpen={detailModal.isOpen}
            onClose={handleCloseDetailModal}
            asset={detailModal.asset}
            chainId={networkIdToChainId(currentNetwork)}
            networkId={currentNetwork}
            rawMarket={detailModal.marketData}
            marketData={normalizeMarketData(
              detailModal.marketData,
              currentNetwork as NetworkId
            )}
            userPosition={detailModalUserPosition ?? undefined}
            userPositionLoadState={detailModalUserPositionLoad}
            onDeposit={() =>
              handleDepositClick(
                detailModal.asset!,
                detailModal.poolId,
                detailModal.marketRowKey
              )
            }
            onWithdraw={() => handleWithdrawClick(detailModal.asset!)}
            onBorrow={() =>
              handleBorrowClick(
                detailModal.asset!,
                detailModal.poolId,
                detailModal.marketRowKey
              )
            }
            onRepay={() => {}}
          />
        )}

        {/* Deposit Modal */}
        {depositModal.isOpen &&
          depositModal.asset &&
          getAssetData(
            depositModal.asset,
            depositModal.poolId,
            depositModal.marketRowKey
          ) && (
            <SupplyBorrowModal
              isOpen={depositModal.isOpen}
              onClose={handleCloseDepositModal}
              asset={depositModal.asset}
              poolId={depositModal.poolId}
              configSymbol={depositModal.configSymbol}
              marketId={depositModal.marketId}
              marketRowKey={depositModal.marketRowKey}
              network={currentNetwork}
              mode="deposit"
              assetData={
                getAssetData(
                  depositModal.asset,
                  depositModal.poolId,
                  depositModal.marketRowKey
                )!
              }
              walletBalance={
                walletBalances[
                  marketsTableWalletBalanceCacheKey(
                    depositModal.asset,
                    depositModal.poolId,
                    depositModal.marketRowKey
                  )
                ]?.balance || 0
              }
              walletBalanceUSD={
                walletBalances[
                  marketsTableWalletBalanceCacheKey(
                    depositModal.asset,
                    depositModal.poolId,
                    depositModal.marketRowKey
                  )
                ]?.balanceUSD || 0
              }
              poolCollateralMarkets={depositPoolCollateralMarkets}
              isLoadingWalletBalance={isLoadingBalance}
              onRefreshWalletBalance={
                depositModal.asset
                  ? () => {
                      void refreshWalletBalance(
                        depositModal.asset,
                        depositModal.poolId,
                        depositModal.marketRowKey
                      );
                    }
                  : undefined
              }
              onDepositRouteChange={
                depositModal.asset
                  ? () => {
                      void refreshWalletBalance(
                        depositModal.asset,
                        depositModal.poolId,
                        depositModal.marketRowKey
                      );
                    }
                  : undefined
              }
              onTransactionSuccess={async () => {
                // Refresh wallet balance immediately after successful transaction
                if (depositModal.asset) {
                  void refreshWalletBalance(
                    depositModal.asset,
                    depositModal.poolId,
                    depositModal.marketRowKey
                  );
                  // Wait a bit for backend to process metadata, then refresh market data
                  // This ensures the blockchain state and API are in sync
                  setTimeout(() => {
                    loadMarketDataWithBypass(
                      depositModal.marketRowKey ??
                        marketKeyForOnDemandLoad(
                          depositModal.poolId,
                          undefined,
                          depositModal.asset
                        )
                    );
                  }, 3000);
                }
              }}
            />
          )}

        {/* Withdraw Modal */}
        {withdrawModal.isOpen &&
          withdrawModal.asset &&
          (() => {
            const assetData = getAssetData(withdrawModal.asset);
            return assetData ? (
              <WithdrawModal
                isOpen={withdrawModal.isOpen}
                onClose={handleCloseWithdrawModal}
                tokenSymbol={withdrawModal.asset}
                tokenIcon={assetData.icon}
                tokenDecimals={assetData.decimals ?? 8}
                currentlyDeposited={1000}
                marketStats={{
                  supplyAPY: assetData.supplyAPY,
                  borrowAPY: assetData.borrowAPY,
                  utilization: assetData.utilization,
                  collateralFactor: assetData.collateralFactor,
                  tokenPrice:
                    assetData.totalSupply > 0
                      ? (assetData.totalSupplyUSD / assetData.totalSupply) /
                        (withdrawModal.asset?.toUpperCase() === "WAD"
                          ? 1_000_000
                          : 1)
                      : 1.0,
                  totalDeposits: assetData.totalSupply,
                  totalBorrows: assetData.totalBorrow,
                  apyParameters: assetData.apyParameters,
                }}
              />
            ) : null;
          })()}

        {/* Borrow Modal */}
        {borrowModal.isOpen &&
          borrowModal.asset &&
          getAssetData(
            borrowModal.asset,
            borrowModal.poolId,
            borrowModal.marketRowKey
          ) && (
            <SupplyBorrowModal
              isOpen={borrowModal.isOpen}
              onClose={handleCloseBorrowModal}
              asset={borrowModal.asset}
              poolId={borrowModal.poolId}
              configSymbol={borrowModal.configSymbol}
              marketId={borrowModalMarketId}
              marketRowKey={borrowModal.marketRowKey}
              network={currentNetwork}
              mode="borrow"
              assetData={getAssetData(
                borrowModal.asset,
                borrowModal.poolId,
                borrowModal.marketRowKey
              )}
              availableAssets={
                borrowModalAvailableAssets.length >= 2
                  ? borrowModalAvailableAssets
                  : undefined
              }
              onSelectAsset={handleSelectBorrowMarket}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              isLoadingBorrowGlobalData={isLoadingGlobalData}
              poolCollateralMarkets={depositPoolCollateralMarkets}
              onTransactionSuccess={() => {
                // Refresh market data after successful borrow
                if (borrowModal.asset) {
                  loadMarketDataWithBypass(
                    borrowModal.marketRowKey ??
                      marketKeyForOnDemandLoad(
                        borrowModal.poolId,
                        undefined,
                        borrowModal.asset
                      )
                  );
                }
              }}
            />
          )}

        {/* Mint Modal */}
        {mintModal.isOpen &&
          mintModal.asset &&
          getAssetData(
            mintModal.asset,
            mintModal.poolId,
            mintModal.marketRowKey
          ) && (
            <MintModal
              isOpen={mintModal.isOpen}
              onClose={handleCloseMintModal}
              asset={mintModal.asset}
              poolId={mintModal.poolId}
              assetData={getAssetData(
                mintModal.asset,
                mintModal.poolId,
                mintModal.marketRowKey
              )}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              onTransactionSuccess={() => {
                // Refresh market data after successful mint
                if (mintModal.asset) {
                  loadMarketDataWithBypass(
                    mintModal.marketRowKey ??
                      marketKeyForOnDemandLoad(
                        mintModal.poolId,
                        undefined,
                        mintModal.asset
                      )
                  );
                }
              }}
            />
          )}

        <TinymanSwapModal
          isOpen={isTinymanSwapModalOpen}
          onClose={() => {
            setIsTinymanSwapModalOpen(false);
            setTinymanSwapOpenForGasUp(false);
          }}
          networkId={currentNetwork as NetworkId}
          initialReceiveAlgo={tinymanSwapOpenForGasUp}
          onSwapSuccess={() =>
            setMarketsToolbarAlgoRefreshNonce((n) => n + 1)
          }
        />
        </Suspense>

        {/* Claim Rewards Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl p-6 w-full max-w-sm relative">
              <button
                className="absolute top-3 right-3 text-white/60 hover:text-white"
                onClick={() => {
                  setShowClaimModal(false);
                  setClaimConfirmed(false);
                  setClaimedAmount(null);
                  setShareButtonClicked(false);
                }}
                aria-label="Close"
              >
                ✕
              </button>

              {!claimConfirmed ? (
                <>
                  <h2 className="text-2xl font-bold mb-1 text-center">
                    Claim Rewards
                  </h2>
                  <p className="mb-5 text-center text-white/70">
                    Claim your accumulated rewards.
                  </p>
                  <div className="rounded-xl bg-[#131A2A] border border-yellow-400/30 flex flex-col items-center py-5 mb-5">
                    <svg
                      className="h-8 w-8 mb-3 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-3V7a2 2 0 00-2-2h-3.28a2 2 0 01-1.95-2.58 2 2 0 00-2.58 2.58H6a2 2 0 00-2 2v2m16 0H4"
                      />
                    </svg>
                    <div className="text-lg mb-1 text-white/70">
                      Available to Claim
                    </div>
                    <div className="text-3xl font-extrabold text-yellow-300 mb-2">
                      {formattedTotalThisBatch || "0"} {rewardSymbol}
                    </div>
                    {hasMoreRewardsToClaim && (
                      <p className="text-xs text-white/50 mt-1">
                        Showing first {MAX_CLAIMS_PER_TX} of{" "}
                        {Object.keys(claimableRewards).length} rewards. Claim
                        again for the rest.
                      </p>
                    )}
                  </div>
                  {claimableRewardsThisBatch.length > 0 && (
                    <div className="mb-3 px-1">
                      <div className="text-sm text-white/50 mb-2">
                        Breakdown:
                      </div>
                      <div className="space-y-1">
                        {claimableRewardsThisBatch.map(
                          ([rewardId, reward]) => {
                            const rewardInfo = rewards.find(
                              (r) => r.id.toString() === rewardId
                            );
                            return (
                              <div
                                key={rewardId}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-white/70">
                                  {rewardInfo?.name || `Reward ${rewardId}`}:
                                </span>
                                <span className="font-medium text-white">
                                  {reward.formatted}{" "}
                                  {rewardInfo?.symbol || rewardSymbol}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      className="w-full py-3 rounded-lg bg-yellow-400 text-slate-900 font-bold text-lg hover:bg-yellow-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleClaimVoi}
                      disabled={
                        totalClaimableThisBatch === 0 || isClaiming
                      }
                    >
                      {isClaiming
                        ? "Claiming..."
                        : `Claim ${formattedTotalThisBatch || "0"
                        } ${rewardSymbol}`}
                    </button>
                    {voiToken &&
                      (() => {
                        // Try multiple symbol variations to find the market
                        const symbolVariations = [
                          voiToken.symbol, // Original symbol from token config
                          voiToken.symbol === "aVoi" ? "aVoi" : "Voi",
                          voiToken.symbol === "aVoi" ? "aVOI" : "VOI",
                          voiToken.symbol === "aVoi" ? "aVOI" : "Voi",
                          "VOI",
                          "Voi",
                        ];

                        let voiAssetData = null;
                        for (const symbol of symbolVariations) {
                          voiAssetData = getAssetData(symbol, voiToken.poolId);
                          if (voiAssetData) break;
                        }

                        // If still not found, try case-insensitive search
                        if (!voiAssetData) {
                          const matchingMarket = markets.find(
                            (m) =>
                              m.asset?.toLowerCase() ===
                              voiToken.symbol.toLowerCase() &&
                              (!voiToken.poolId || m.poolId === voiToken.poolId)
                          );
                          if (matchingMarket) {
                            voiAssetData = {
                              icon: matchingMarket.icon,
                              totalSupply: matchingMarket.totalSupply,
                              totalSupplyUSD: matchingMarket.totalSupplyUSD,
                              supplyAPY: matchingMarket.supplyAPY,
                              totalBorrow: matchingMarket.totalBorrow,
                              totalBorrowUSD: matchingMarket.totalBorrowUSD,
                              borrowAPY: matchingMarket.borrowAPY,
                              utilization: matchingMarket.utilization,
                              collateralFactor: matchingMarket.collateralFactor,
                              liquidity:
                                matchingMarket.totalSupply -
                                matchingMarket.totalBorrow,
                              liquidityUSD:
                                matchingMarket.totalSupplyUSD -
                                matchingMarket.totalBorrowUSD,
                              reserveFactor: matchingMarket.reserveFactor,
                              apyCalculation: matchingMarket.apyCalculation,
                              maxTotalDeposits: matchingMarket.supplyCap,
                              isSToken: matchingMarket.isSToken,
                            };
                          }
                        }

                        // Hide "Deposit & Earn" if deposit amount + total supply (incl. interest) would exceed cap
                        const totalSupply = Number(voiAssetData?.totalSupply ?? 0);
                        const maxTotalDeposits = Number(voiAssetData?.maxTotalDeposits ?? 0);
                        const depositAmountHuman =
                          totalClaimableThisBatch / Math.pow(10, rewardDecimals);
                        const wouldExceedDepositCap =
                          maxTotalDeposits > 0 &&
                          depositAmountHuman + totalSupply > maxTotalDeposits;

                        if (wouldExceedDepositCap) {
                          return null;
                        }

                        // Use effective APY from apyCalculation if available, otherwise fallback to supplyAPY
                        const apy =
                          voiAssetData?.apyCalculation?.apy ||
                          voiAssetData?.supplyAPY ||
                          0;
                        const formattedAPY = formatPercent(apy / 100, { maximumFractionDigits: 2 });
                        const depositButtonText = isClaiming
                          ? "Processing..."
                          : apy === 0
                            ? "Direct Deposit into Market"
                            : `Deposit & Earn ${formattedAPY} APY`;

                        return (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-white/20"></div>
                              <span className="text-sm text-white/50">or</span>
                              <div className="flex-1 h-px bg-white/20"></div>
                            </div>
                            <button
                              className="w-full py-3 rounded-lg border-2 border-green-600 hover:border-green-700 text-green-600 hover:text-green-700 font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={handleDirectDepositToMarket}
                              disabled={
                                totalClaimableThisBatch === 0 || isClaiming
                              }
                            >
                              {depositButtonText}
                            </button>
                          </>
                        );
                      })()}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center pt-6 pb-8">
                  {/* Sparkles Decorative */}
                  <div className="relative flex flex-col items-center mb-2">
                    {/* Top Left Sparkle */}
                    <svg
                      className="absolute -top-7 -left-7 text-yellow-300 w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* Top Right Sparkle */}
                    <svg
                      className="absolute -top-7 -right-7 text-cyan-400 w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* VOI Logo with Green Check in Box */}
                    <div className="relative">
                      <div className="rounded-2xl border-4 border-yellow-400 p-4 bg-[#182237] shadow-lg flex flex-col items-center">
                        <img
                          src="/lovable-uploads/VOI.png"
                          alt="VOI token"
                          className="w-20 h-20 rounded-full"
                        />
                        {/* Green Check */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 rounded-full p-1.5 border-4 border-[#182237]">
                          <svg
                            className="w-6 h-6 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-center mt-4 mb-2 text-white">
                    Transaction Successful!
                  </h2>
                  <div className="text-md md:text-lg text-white text-center mb-5">
                    {claimedAmount?.wasDeposited ? (
                      <>
                        You successfully claimed and deposited{" "}
                        <span className="text-yellow-400 font-bold">
                          {claimedAmount?.formatted || formattedTotalClaimable}{" "}
                          {claimedAmount?.symbol || rewardSymbol}
                        </span>{" "}
                        into the market
                      </>
                    ) : (
                      <>
                        You successfully claimed rewards{" "}
                        <span className="text-yellow-400 font-bold">
                          {claimedAmount?.formatted || formattedTotalClaimable}{" "}
                          {claimedAmount?.symbol || rewardSymbol}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href="/portfolio"
                      className="w-full block py-4 px-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg text-center transition"
                      onClick={() => {
                        setShowClaimModal(false);
                        setClaimConfirmed(false);
                        setClaimedAmount(null);
                        setShareButtonClicked(false);
                      }}
                    >
                      View Portfolio
                    </a>

                    {/* Divider and Share button - hide when share button is clicked */}
                    {!shareButtonClicked && (
                      <>
                        {/* Divider */}
                        <div className="flex items-center gap-3 my-2">
                          <div className="flex-1 h-px bg-white/20"></div>
                          <span className="text-xs text-white/50">Share</span>
                          <div className="flex-1 h-px bg-white/20"></div>
                        </div>

                        {/* Share on X */}
                        {(() => {
                          // Determine network mentions
                          const networkMentions = isCurrentNetworkVOI()
                            ? " @Voi_Net"
                            : isCurrentNetworkAlgorand()
                              ? " @AlgoFoundation"
                              : "";

                          // Get wallet name
                          const rawWalletName =
                            activeWallet?.metadata?.name || "";
                          let walletName = rawWalletName;
                          if (rawWalletName.toLowerCase() === "lute") {
                            walletName = "@LuteWallet";
                          } else if (rawWalletName.toLowerCase() === "pera") {
                            walletName = "@PeraAlgoWallet";
                          } else if (rawWalletName.toLowerCase() === "defly") {
                            walletName = "@deflyapp";
                          } else if (
                            rawWalletName.toLowerCase() === "vera" ||
                            rawWalletName.toLowerCase() === "walletconnect"
                          ) {
                            walletName = "@Voi_Wallet";
                          } else if (rawWalletName.toLowerCase() === "biatec") {
                            walletName = "@BiatecGroup";
                          }

                          const shareText = claimedAmount?.wasDeposited
                            ? `Just claimed and deposited ${claimedAmount?.formatted ||
                            formattedTotalClaimable
                            } ${claimedAmount?.symbol || rewardSymbol
                            } rewards on @dork_fi${networkMentions}${walletName ? ` using ${walletName}` : ""
                            }! 🎉`
                            : `Just claimed ${claimedAmount?.formatted ||
                            formattedTotalClaimable
                            } ${claimedAmount?.symbol || rewardSymbol
                            } rewards on @dork_fi${networkMentions}${walletName ? ` using ${walletName}` : ""
                            }! 🎉`;

                          return (
                            <a
                              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                                shareText
                              )}&url=${encodeURIComponent(
                                "https://app.dork.fi"
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-black hover:bg-gray-900 text-white font-semibold text-base text-center transition border border-white/20"
                              onClick={() => {
                                setShareButtonClicked(true);
                                // Hide divider and button for screenshot, but keep modal open
                                // Modal will close when user clicks View Portfolio or Close button
                              }}
                            >
                              <svg
                                className="w-5 h-5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                              </svg>
                              Share on X
                            </a>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketsTable;
