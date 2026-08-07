import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type RefObject,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useAddressName } from "@/hooks/useAddressName";
import { useAvatarImage } from "@/hooks/useAvatarImage";
import { useToast } from "@/hooks/use-toast";
import { isAtDepositCap, isAtBorrowCap } from "@/constants/lendingCaps";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { ResolverService } from "@/services/resolverService";
import { getCurrentNetworkConfig } from "@/config";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import { abi, CONTRACT } from "ulujs";
import { updateTransactionMetadata } from "@/utils/transactionUtils";
import { signAndSendSyncUserMarketsForPriceChangeTx } from "@/utils/syncUserMarketsForPriceChange";
import {
  fetchUserGlobalData,
  fetchAllMarkets,
  collectPositionMarketKeys,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  enhanceAVMMarketInfo,
  fetchMarketInfo,
  repayOnBehalf,
  liquidateCrossMarket,
  fetchUserDataFromChain,
  postRefreshMarketDataSnapshot,
  type MarketInfo,
} from "@/services/lendingService";
import {
  hydratePortfolioNetworkMarketsPhaseA,
  refinePortfolioMarketsPhaseB,
  gapFillPortfolioMarkets,
  readPortfolioMarketsSessionCache,
  writePortfolioMarketsSessionCache,
  marketInfosFromMarketsTableSession,
  mergePortfolioMarketRows,
} from "@/utils/portfolioMarketHydrate";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
} from "@/services/folksDepositAdapter";
import {
  usePortfolioVisibleChainLive,
  portfolioPositionChainKey,
} from "@/hooks/usePortfolioVisibleChainLive";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";
import {
  getAllTokens,
  getTokenConfig,
  resolveIntrinsicSupplyApyPercent,
  type LiveIntrinsicSupplyApySnapshot,
  isFeatureEnabled,
  getEnabledNetworks,
  getAlgorandNetworkFromNetworkId,
  getNetworkConfig,
  getMarketLabel,
  getNetworkDisplayName,
  NetworkId,
  TokenConfig,
  tokenStandardUsesNativeWalletBalance,
  getAnyFolksAdapter,
  getFolksAdapterForPhase,
  getPortfolioVisibleTokens,
  filterPortfolioVisibleMarketRows,
  isMarketsTableExcludedMarket,
  getAllTokensWithDisplayInfo,
} from "@/config";
import {
  getTokenImagePath,
  resolveTokenIconBadgeUrl,
} from "@/utils/tokenImageUtils";
import { MarketRowTokenIcon } from "@/components/markets/MarketRowTokenIcon";
import { marketRowForPortfolioPosition } from "@/utils/marketRowForPortfolioPosition";
import {
  enabledNetworksHaveDMarket,
  itemMatchesPortfolioPositionFilters,
  type PortfolioNetworkFilterValue,
} from "@/utils/portfolioMarketFilter";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import {
  PortfolioPositionsFilteredEmptyState,
} from "@/components/portfolio/PortfolioPositionsFilterBar";
import PortfolioPositionsCardHeader from "@/components/portfolio/PortfolioPositionsCardHeader";
import { usdPerTokenFromPortfolioMarketRow } from "@/utils/assetDecimals";
import { formatNftHolderClaimableDisplayFromAgent } from "@/utils/nftHolderClaimAgentDisplay";
import { spendableAlgoHumanFromAccount } from "@/utils/algorandWalletBalance";
import { portfolioWalletBalanceCacheKey } from "@/utils/portfolioWalletBalanceCacheKey";
import {
  portfolioUsdCacheKey,
  resolveWithLastGoodPortfolioUsd,
} from "@/utils/portfolioUsdCache";
import {
  createDebouncedPrefetch,
  warmRepayModalRpc,
  type MarketActionTokenParams,
} from "@/utils/modalPrefetch";
import { warmBorrowModalMaxAndPool } from "@/utils/modalPrefetchHeavy";
import {
  getCachedAccountInformation,
  getCachedAsaHoldingAtomic,
  invalidateWalletBalanceRpc,
} from "@/utils/walletBalanceRpc";
import { shouldShowConfigSymbolUnderDisplayAsset } from "@/utils/portfolioAssetSubline";
import {
  calculateUserHealthFactor,
  normalizeLiquidationThresholdToDecimal,
} from "@/utils/userHealth";
import EnhancedHealthFactor from "./EnhancedHealthFactor";
import DepositsList from "./DepositsList";
import BorrowsList from "./BorrowsList";
import PortfolioModals from "./PortfolioModals";
import { resolveSupplyBorrowToken } from "./SupplyBorrowModal";
import PortfolioTableMobileCard from "./portfolio/PortfolioTableMobileCard";
import AccruedInterestMobileCard from "./portfolio/AccruedInterestMobileCard";
import PortfolioInsightsHub from "@/components/portfolio/PortfolioInsightsHub";
import PortfolioWalletStatusBar from "@/components/portfolio/PortfolioWalletStatusBar";
import { NftHolderClaimManualModal } from "@/components/portfolio/NftHolderClaimManualModal";
import {
  NftHolderClaimSuccessModal,
  type NftHolderClaimSuccessDetails,
} from "@/components/portfolio/NftHolderClaimSuccessModal";
import {
  NftHolderRewardsModalBody,
  type NftHolderEligibilitySnapshot,
} from "@/components/portfolio/NftHolderRewardsModalBody";
import {
  getClaimlayerUsdAmount,
  getNftHolderClaimAgentBase,
} from "@/services/paidWorkflowGateway";
import NFTSelectionModal from "./liquidation/NFTSelectionModal";
import ProfileUpdateSuccessModal from "./liquidation/ProfileUpdateSuccessModal";
import { UserNFT } from "@/hooks/useUserNFTs";
import { saveAlgorandAvatar } from "@/services/algorandProfileAvatarService";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { isPortaledWalletPickerUi } from "@/lib/isPortaledWalletPickerUi";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import {
  useRewardsAprBonusMap,
  getRewardsBonusSupplyAprPercent,
} from "@/hooks/useRewardsAprBonusMap";
import { useTinymanLiquidStakingLiveApyPercent } from "@/hooks/useTinymanLiquidStakingLiveApyPercent";
import { useXalgoGovernanceLiveApyPercent } from "@/hooks/useXalgoGovernanceLiveApyPercent";
import { useFolksMainnetAlgoDepositLiveApyPercent } from "@/hooks/useFolksMainnetAlgoDepositLiveApyPercent";
import { useFolksMainnetUsdcPoolLiveApyPercent } from "@/hooks/useFolksMainnetUsdcPoolLiveApyPercent";
import { useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent } from "@/hooks/useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent";
import { useFolksMainnetFiTinyEcosystemPoolLiveApyPercent } from "@/hooks/useFolksMainnetFiTinyEcosystemPoolLiveApyPercent";
import { useFolksMainnetWbtcNttPoolLiveApyPercent } from "@/hooks/useFolksMainnetWbtcNttPoolLiveApyPercent";
import { useFolksMainnetWethNttPoolLiveApyPercent } from "@/hooks/useFolksMainnetWethNttPoolLiveApyPercent";

/* eslint-disable no-case-declarations -- many sort switch blocks use const in cases */
/* eslint-disable react-hooks/exhaustive-deps -- many callbacks intentionally use stable deps subset */

/** User-facing line e.g. "Algorand · Market A" for portfolio HF / overview. */
function formatUserMarketLine(
  networkId: string | null | undefined,
  poolId: string | null | undefined
): string | null {
  if (!networkId || !poolId) return null;
  const net = getNetworkDisplayName(networkId);
  const letter = getMarketLabel(networkId as NetworkId, poolId);
  if (letter) return `${net} · Market ${letter}`;
  return `${net} · Pool ${poolId}`;
}

/** Used for portfolio items (deposits, borrows, etc.) that may have network/originalSymbol/interest fields at runtime */
interface ItemWithNetwork {
  network?: string;
  originalSymbol?: string;
  /** Config `tokens` key when display symbol + pool collide (e.g. fALGO). */
  configSymbol?: string;
  /** Lending market app id (underlying ARC200 / nt200 contract). Disambiguates same pool + display symbol. */
  marketId?: string;
  accruedInterest?: number;
  interest?: number;
  accruedInterestValue?: number;
  tokenPrice?: number;
}

/** For sorting Accrued Interest columns: prefer stored USD, else token amount × price. */
function accruedInterestUsdForSort(
  item: ItemWithNetwork
): number {
  const v = item.accruedInterestValue;
  if (v != null && Number.isFinite(v)) return v;
  return (item.accruedInterest ?? 0) * (item.tokenPrice || 1);
}

/** Folks f-asset rows show underlying balance; if their market row has no usable price, use native ALGO same pool. */
function folksUnderlyingUsdFallbackSamePool(
  marketRows: unknown[],
  networkId: NetworkId,
  poolId: string,
  currentUnderlyingMarketId: string
): number {
  const tokens = getAllTokensWithDisplayInfo(networkId);
  const ref = tokens.find(
    (t) =>
      String(t.poolId) === String(poolId) &&
      t.configKey === "ALGO" &&
      String(t.underlyingContractId ?? "") !==
        String(currentUnderlyingMarketId)
  );
  if (!ref?.underlyingContractId) return 0;
  const m = marketRowForPortfolioPosition(marketRows, {
    marketId: ref.underlyingContractId,
    poolId,
    displaySymbol: ref.symbol,
  });
  return usdPerTokenFromPortfolioMarketRow(m, ref.decimals, {
    displaySymbol: ref.symbol,
  });
}

/** When wBTC/goBTC market price is missing, reuse a same-pool BTC-family market with a valid price. */
function btcFamilyUsdFallbackSamePool(
  marketRows: unknown[],
  networkId: NetworkId,
  poolId: string,
  currentUnderlyingMarketId: string
): number {
  const tokens = getAllTokensWithDisplayInfo(networkId);
  const preferred = tokens.filter((t) => {
    if (String(t.poolId) !== String(poolId)) return false;
    if (
      String(t.underlyingContractId ?? "") === String(currentUnderlyingMarketId)
    ) {
      return false;
    }
    const key = String(t.configKey ?? t.originalSymbol ?? t.symbol).toUpperCase();
    return key === "GOBTC" || key === "WBTC" || key === "BTC";
  });
  // Prefer goBTC / fWBTC (Folks) rows — fresher BTC oracle feed on Pool A
  const ordered = [...preferred].sort((a, b) => {
    const score = (t: (typeof preferred)[number]) => {
      const id = String(t.underlyingContractId ?? "");
      if (id === "3575837891") return 0;
      const key = String(t.configKey ?? t.originalSymbol ?? "").toUpperCase();
      if (key === "GOBTC") return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  for (const ref of ordered) {
    if (!ref.underlyingContractId) continue;
    const m = marketRowForPortfolioPosition(marketRows, {
      marketId: ref.underlyingContractId,
      poolId,
      displaySymbol: ref.symbol,
    });
    const usd = usdPerTokenFromPortfolioMarketRow(m, ref.decimals, {
      displaySymbol: ref.symbol,
    });
    if (usd > 0) return usd;
  }
  return 0;
}

function resolvePortfolioPositionUsdPerToken(options: {
  market: unknown;
  tokenDecimals: number;
  networkId: NetworkId;
  poolId?: string | null;
  marketId?: string | null;
  configKey?: string;
  originalSymbol?: string;
  displaySymbol?: string;
  marketRows: unknown[];
}): number {
  let tokenPrice = usdPerTokenFromPortfolioMarketRow(
    options.market,
    options.tokenDecimals,
    { displaySymbol: options.displaySymbol }
  );

  const cacheKey =
    options.poolId != null && options.marketId
      ? portfolioUsdCacheKey(
          String(options.networkId),
          String(options.poolId),
          String(options.marketId)
        )
      : null;

  if (tokenPrice > 0) {
    return resolveWithLastGoodPortfolioUsd(tokenPrice, cacheKey);
  }

  const cfgRaw = getTokenConfig(
    options.networkId,
    options.configKey ?? options.originalSymbol ?? options.displaySymbol ?? ""
  );
  const tc = Array.isArray(cfgRaw)
    ? cfgRaw.find((c) => String(c.poolId) === String(options.poolId)) ??
      cfgRaw[0]
    : cfgRaw;
  if (
    getAnyFolksAdapter(tc ?? {}) &&
    options.poolId != null &&
    options.marketId
  ) {
    tokenPrice = folksUnderlyingUsdFallbackSamePool(
      options.marketRows,
      options.networkId,
      String(options.poolId),
      String(options.marketId)
    );
    if (tokenPrice > 0) {
      return resolveWithLastGoodPortfolioUsd(tokenPrice, cacheKey);
    }
  }

  const sym = String(
    options.configKey ?? options.originalSymbol ?? options.displaySymbol ?? ""
  ).toUpperCase();
  if (
    (sym === "WBTC" || sym === "GOBTC" || sym === "BTC") &&
    options.poolId != null &&
    options.marketId
  ) {
    tokenPrice = btcFamilyUsdFallbackSamePool(
      options.marketRows,
      options.networkId,
      String(options.poolId),
      String(options.marketId)
    );
    if (tokenPrice > 0) {
      return resolveWithLastGoodPortfolioUsd(tokenPrice, cacheKey);
    }
  }

  return resolveWithLastGoodPortfolioUsd(0, cacheKey);
}

function isExcludedPortfolioPositionRow(pos: {
  poolId?: string | null;
  network?: string;
  configSymbol?: string;
  configKey?: string;
}): boolean {
  const networkId = pos.network;
  if (!networkId || pos.poolId == null || String(pos.poolId) === "") {
    return false;
  }
  return isMarketsTableExcludedMarket(
    networkId,
    pos.poolId,
    pos.configSymbol ?? pos.configKey
  );
}

/** Standalone "Accrued Interest" summary card + table (below Supplied/Borrowed). */
const SHOW_ACCRUED_INTEREST_SECTION = false;

/** Liquidation Price column in Borrowed Assets (desktop + mobile card). */
const SHOW_LIQUIDATION_PRICE_IN_BORROWED = false;

/** Supplied / borrowed asset lists: rows per page. */
const ASSET_LIST_PAGE_SIZE = 10;

function sliceAssetListPage<T>(
  items: T[],
  currentPage: number,
  pageSize: number
): T[] {
  if (items.length === 0) return [];
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const lastPage = pageCount - 1;
  const page = Math.min(currentPage, lastPage);
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

function PortfolioAssetListPagination({
  currentPage,
  onPageChange,
  totalItems,
  pageSize,
  scrollToRef,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  scrollToRef: RefObject<HTMLDivElement | null> | null;
}) {
  if (totalItems <= pageSize) return null;
  const pageCount = Math.ceil(totalItems / pageSize);
  const lastPage = pageCount - 1;
  const current = Math.min(currentPage, lastPage);
  const from = current * pageSize + 1;
  const to = Math.min((current + 1) * pageSize, totalItems);

  const go = (page: number) => {
    onPageChange(Math.max(0, Math.min(page, lastPage)));
    if (scrollToRef?.current) {
      setTimeout(() => {
        scrollToRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
      <p
        className="text-sm text-muted-foreground text-center sm:text-left"
        aria-live="polite"
      >
        Showing {from}–{to} of {totalItems}
      </p>
      <div className="flex items-center justify-center gap-2 w-full sm:w-auto min-w-0">
        <DorkFiButton
          type="button"
          variant="secondary"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="min-w-0 flex-1 sm:flex-initial"
        >
          <span className="sm:hidden">Prev</span>
          <span className="hidden sm:inline">Previous</span>
        </DorkFiButton>
        <span
          className="text-sm text-muted-foreground tabular-nums shrink-0 min-w-[4.5rem] text-center"
          aria-label={`Page ${current + 1} of ${pageCount}`}
        >
          {current + 1} / {pageCount}
        </span>
        <DorkFiButton
          type="button"
          variant="secondary"
          onClick={() => go(current + 1)}
          disabled={current >= lastPage}
          className="min-w-0 flex-1 sm:flex-initial"
        >
          Next
        </DorkFiButton>
      </div>
    </div>
  );
}

const Portfolio = () => {
  const { address: routeAddress } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { formatNumber, formatCurrency, formatPercent } = useNumberI18n();
  const queryClient = useQueryClient();

  const rewardsAprNetworks = useMemo(
    () => getEnabledNetworks() as NetworkId[],
    []
  );
  const rewardsAprByBaseUrl = useRewardsAprBonusMap(rewardsAprNetworks);
  const liveIntrinsicApyFetchEnabled = useMemo(
    () =>
      (getEnabledNetworks() as NetworkId[]).includes("algorand-mainnet"),
    []
  );
  const tinymanLiveIntrinsicApyPct = useTinymanLiquidStakingLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const xalgoLiveIntrinsicApyPct = useXalgoGovernanceLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksAlgoDepositLiveApyPct = useFolksMainnetAlgoDepositLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksUsdcPoolLiveApy = useFolksMainnetUsdcPoolLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksFiUsdcEcosystemLiveApy = useFolksMainnetFiUsdcEcosystemPoolLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksFiTinyEcosystemLiveApy = useFolksMainnetFiTinyEcosystemPoolLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksWbtcNttLiveApy = useFolksMainnetWbtcNttPoolLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const folksWethNttLiveApy = useFolksMainnetWethNttPoolLiveApyPercent(
    liveIntrinsicApyFetchEnabled
  );
  const liveIntrinsicSupplyApy = useMemo<LiveIntrinsicSupplyApySnapshot>(
    () => ({
      tinymanLiquidStakingPercent: tinymanLiveIntrinsicApyPct,
      xalgoGovernanceLambdaPercent: xalgoLiveIntrinsicApyPct,
      folksMainnetAlgoDepositPercent: folksAlgoDepositLiveApyPct,
      folksMainnetUsdcDepositPercent: folksUsdcPoolLiveApy?.depositPercent ?? null,
      folksMainnetUsdcBorrowPercent: folksUsdcPoolLiveApy?.borrowPercent ?? null,
      folksMainnetFiUsdcEcosystemDepositPercent:
        folksFiUsdcEcosystemLiveApy?.depositPercent ?? null,
      folksMainnetFiUsdcEcosystemBorrowPercent:
        folksFiUsdcEcosystemLiveApy?.borrowPercent ?? null,
      folksMainnetFiTinyEcosystemDepositPercent:
        folksFiTinyEcosystemLiveApy?.depositPercent ?? null,
      folksMainnetFiTinyEcosystemBorrowPercent:
        folksFiTinyEcosystemLiveApy?.borrowPercent ?? null,
      folksMainnetWbtcNttDepositPercent:
        folksWbtcNttLiveApy?.depositPercent ?? null,
      folksMainnetWbtcNttBorrowPercent:
        folksWbtcNttLiveApy?.borrowPercent ?? null,
      folksMainnetWethNttDepositPercent:
        folksWethNttLiveApy?.depositPercent ?? null,
      folksMainnetWethNttBorrowPercent:
        folksWethNttLiveApy?.borrowPercent ?? null,
    }),
    [
      tinymanLiveIntrinsicApyPct,
      xalgoLiveIntrinsicApyPct,
      folksAlgoDepositLiveApyPct,
      folksUsdcPoolLiveApy,
      folksFiUsdcEcosystemLiveApy,
      folksFiTinyEcosystemLiveApy,
      folksWbtcNttLiveApy,
      folksWethNttLiveApy,
    ]
  );

  // Use address from route params if available, otherwise fall back to activeAccount address
  const displayAddress = routeAddress || activeAccount?.address;
  // Normalize addresses for comparison (case-insensitive)
  const normalizedRouteAddress = routeAddress?.toLowerCase();
  const normalizedActiveAddress = activeAccount?.address?.toLowerCase();
  const isViewOnly =
    !!routeAddress && normalizedRouteAddress !== normalizedActiveAddress;

  // Debug log (can be removed later)
  if (routeAddress) {
    console.log("[Portfolio] View mode check:", {
      routeAddress: normalizedRouteAddress,
      activeAddress: normalizedActiveAddress,
      isViewOnly,
    });
  }

  const { name: addressName } = useAddressName(displayAddress);
  const {
    avatarImage,
    isResolved: isAvatarResolved,
    refetch: refetchAvatar,
  } = useAvatarImage(displayAddress);
  const { toast } = useToast();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isNarrowPositionsViewport =
    breakpoint === "mobile" || breakpoint === "tablet";

  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [withdrawModal, setWithdrawModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    marketId?: string;
    configSymbol?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [borrowModal, setBorrowModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
    marketRowKey?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [repayModal, setRepayModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
    configSymbol?: string;
    marketId?: string;
  }>({
    isOpen: false,
    asset: null,
  });

  // Real user data state
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [marketData, setMarketData] = useState<unknown[]>([]);
  /** Folks: minted f-asset (atomic) for 1.0 underlying; key `networkId|configSymbol|poolId`. */
  const [folksMintedOneUnderlyingByKey, setFolksMintedOneUnderlyingByKey] =
    useState<Record<string, string>>({});
  const [userPositions, setUserPositions] = useState<unknown[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isRefreshingMarkets, setIsRefreshingMarkets] = useState(false);
  const [refreshingMarket, setRefreshingMarket] = useState<string | null>(null);
  const [refreshingSection, setRefreshingSection] = useState<string | null>(
    null
  );
  const [dataError, setDataError] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<
    Record<string, { balance: number; balanceUSD: number; lastUpdated: number }>
  >({});
  const [isLoadingWalletBalance, setIsLoadingWalletBalance] = useState(false);
  const [userBorrowBalance, setUserBorrowBalance] = useState<number>(0);
  const [isLoadingBorrowData, setIsLoadingBorrowData] = useState(false);
  const [isLoadingRepayData, setIsLoadingRepayData] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [userProfileAvatar, setUserProfileAvatar] = useState<string | null>(
    null
  );
  // Guards for fetchUser: prevent concurrent fetches and stale-address races
  const fetchUserInFlight = useRef(false);
  const fetchUserAddressRef = useRef<string | null>(null);

  // Compute final avatar: prioritize user profile avatar > resolver avatar
  // If neither exists, components will show placeholder
  const displayAvatar = useMemo(() => {
    return userProfileAvatar || avatarImage || undefined;
  }, [userProfileAvatar, avatarImage]);

  const {
    data: nftHolderClaimAgent,
    isSuccess: nftHolderClaimAgentSuccess,
    isPending: nftHolderClaimAgentPending,
    isFetching: nftHolderClaimAgentFetching,
    isError: nftHolderClaimAgentIsError,
    error: nftHolderClaimAgentFetchError,
  } = useQuery({
    queryKey: ["nft-holder-claim-agent", displayAddress],
    queryFn: async () => {
      const url = `${getNftHolderClaimAgentBase()}/${encodeURIComponent(displayAddress!)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Claim agent HTTP ${res.status}`);
      }
      return res.json() as {
        address: string;
        claimable: boolean;
        transactionCount: number;
        totalClaimableRaw: string;
        totalClaimableDisplay: string;
        batches: Array<{ slots?: Array<{ rewardSymbol?: string }> }>;
        errors: unknown[];
        /** Optional server field; falls back to `claimable` when absent. */
        eligible?: boolean;
      };
    },
    enabled: Boolean(displayAddress && !isViewOnly),
    /** Always stale so `invalidateQueries` and modal-open refetch actually hit the claim agent. */
    staleTime: 0,
  });

  const nftHolderClaimableDisplayWithSymbol = useMemo(
    () => formatNftHolderClaimableDisplayFromAgent(nftHolderClaimAgent),
    [nftHolderClaimAgent]
  );

  const nftHolderClaimableDisplayAmount = nftHolderClaimAgent
    ? Number.parseFloat(nftHolderClaimAgent.totalClaimableDisplay)
    : NaN;
  const nftHolderClaimParsedOk =
    nftHolderClaimAgent != null &&
    Number.isFinite(nftHolderClaimableDisplayAmount);
  const showPortfolioRewardsClaim =
    !isViewOnly &&
    nftHolderClaimAgentSuccess &&
    nftHolderClaimParsedOk &&
    nftHolderClaimableDisplayAmount > 0;
  const showPortfolioNftHolderRewardsNoBalance =
    !isViewOnly &&
    nftHolderClaimAgentSuccess &&
    nftHolderClaimParsedOk &&
    nftHolderClaimableDisplayAmount <= 0;

  /** Placeholder card until claim agent returns (initial load or refetch without a resolved outcome yet). */
  const showPortfolioNftHolderRewardsFetching =
    !isViewOnly &&
    Boolean(displayAddress) &&
    !nftHolderClaimAgentIsError &&
    (nftHolderClaimAgentPending || nftHolderClaimAgentFetching) &&
    !showPortfolioRewardsClaim &&
    !showPortfolioNftHolderRewardsNoBalance;

  const [positionsNetworkFilter, setPositionsNetworkFilter] =
    useState<PortfolioNetworkFilterValue>("all");
  const [positionsMarketFilter, setPositionsMarketFilter] =
    useState<MarketFilter>("all");
  const [positionsSearchTerm, setPositionsSearchTerm] = useState("");
  const hasDMarketTab = useMemo(() => enabledNetworksHaveDMarket(), []);

  useEffect(() => {
    if (hasDMarketTab) return;
    if (positionsMarketFilter === "D") setPositionsMarketFilter("all");
  }, [hasDMarketTab, positionsMarketFilter]);

  const clearPositionsFilters = useCallback(() => {
    setPositionsNetworkFilter("all");
    setPositionsMarketFilter("all");
    setPositionsSearchTerm("");
  }, []);

  const [suppliedAssetsSort, setSuppliedAssetsSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "apy", direction: "desc" });
  const [suppliedAssetsPage, setSuppliedAssetsPage] = useState(0);
  const suppliedAssetsTableRef = useRef<HTMLDivElement>(null);
  const [portfolioPositionsTab, setPortfolioPositionsTab] = useState<
    "supplied" | "borrowed"
  >("supplied");
  const [borrowedAssetsPage, setBorrowedAssetsPage] = useState(0);
  const borrowedAssetsTableRef = useRef<HTMLDivElement>(null);
  const [borrowedAssetsSort, setBorrowedAssetsSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "apy", direction: "desc" });
  const [accruedInterestSearchTerm, setAccruedInterestSearchTerm] =
    useState<string>("");
  const [showAllAccruedInterest, setShowAllAccruedInterest] =
    useState<boolean>(false);
  const accruedInterestTableRef = useRef<HTMLDivElement>(null);
  const [accruedInterestSort, setAccruedInterestSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "value", direction: "desc" });
  const [atRiskAssetsSort, setAtRiskAssetsSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "riskRatio", direction: "asc" }); // Default sort by risk ratio (most risky first)

  const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
  const [selectedLiquidationPosition, setSelectedLiquidationPosition] =
    useState<unknown | null>(null);
  /** USD amount to liquidate (0 to position.liquidationAmount); enables partial liquidation */
  const [partialLiquidationAmountUsd, setPartialLiquidationAmountUsd] =
    useState<number>(0);
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [selectedRepayPosition, setSelectedRepayPosition] =
    useState<unknown | null>(null);
  const [isRepaying, setIsRepaying] = useState(false);
  const [repayWalletBalance, setRepayWalletBalance] = useState<number | null>(null);
  const [isLoadingRepayBalance, setIsLoadingRepayBalance] = useState(false);

  // NFT selection state
  const [nftModalOpen, setNftModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [nftHolderRewardsClaimModalOpen, setNftHolderRewardsClaimModalOpen] =
    useState(false);
  const [nftClaimSuccessOpen, setNftClaimSuccessOpen] = useState(false);
  const [nftClaimSuccessDetails, setNftClaimSuccessDetails] =
    useState<NftHolderClaimSuccessDetails | null>(null);
  const [nftClaimManualModalOpen, setNftClaimManualModalOpen] = useState(false);

  /** Fresh claim-agent snapshot whenever the rewards modal opens. */
  useEffect(() => {
    if (!nftHolderRewardsClaimModalOpen || !displayAddress || isViewOnly) return;
    void queryClient.invalidateQueries({
      queryKey: ["nft-holder-claim-agent", displayAddress],
    });
  }, [nftHolderRewardsClaimModalOpen, displayAddress, isViewOnly, queryClient]);

  console.log("marketData", marketData);

  // Human USD per 1 underlying token for `MarketInfo` rows (oracle-aware).
  const formatPriceFromContract = useCallback(
    (contractPrice: string | number, tokenDecimals: number) =>
      usdPerTokenFromPortfolioMarketRow(
        { price: contractPrice },
        tokenDecimals
      ),
    []
  );

  const { attachChainPollRow, mergeDeposit, mergeBorrow } =
    usePortfolioVisibleChainLive({
      address: displayAddress,
      marketData,
      formatPriceFromContract,
    });

  // POST `/market-data/...` when a supply/borrow position modal opens (fresh API snapshot for that market).
  useEffect(() => {
    const pick = depositModal.isOpen
      ? depositModal
      : withdrawModal.isOpen
        ? withdrawModal
        : borrowModal.isOpen
          ? borrowModal
          : repayModal.isOpen
            ? repayModal
            : null;
    if (!pick?.isOpen || !pick.asset) {
      return;
    }
    const networkId = (pick.network || currentNetwork) as NetworkId;
    const poolId = pick.poolId;
    if (!poolId) {
      return;
    }
    const configSymbol = pick.configSymbol;
    const marketId = pick.marketId;

    const tokens = getAllTokensWithDisplayInfo(networkId);
    const token = resolveSupplyBorrowToken(
      tokens,
      pick.asset,
      poolId,
      configSymbol,
      marketId
    );
    const appId = token?.poolId != null ? String(token.poolId) : poolId;
    const uMid = token?.underlyingContractId
      ? String(token.underlyingContractId)
      : marketId != null && String(marketId) !== ""
        ? String(marketId)
        : "";
    if (!uMid) {
      return;
    }

    void (async () => {
      try {
        await postRefreshMarketDataSnapshot(networkId, appId, uMid);
      } catch (e) {
        console.warn(
          "[Portfolio] postRefreshMarketDataSnapshot on modal open failed",
          { networkId, appId, marketId: uMid },
          e
        );
      }
    })();
  }, [
    depositModal,
    withdrawModal,
    borrowModal,
    repayModal,
    currentNetwork,
  ]);

  // Function to fetch ntoken balance for a specific token
  const fetchNTokenBalance = async (
    userAddress: string,
    nTokenId: string,
    networkId: string
  ) => {
    try {
      if (!nTokenId) {
        console.log("No nTokenId provided, returning 0");
        return 0;
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      console.log(`Fetching nToken balance for contract: ${nTokenId}`);
      const nTokenBalance = await ARC200Service.getBalance(
        userAddress,
        nTokenId
      );

      if (nTokenBalance) {
        // Convert from smallest units to human readable format
        const balance = parseFloat(
          ARC200Service.formatBalance(nTokenBalance, 6)
        ); // nTokens typically have 6 decimals
        console.log(`nToken balance: ${balance}`);
        return balance;
      } else {
        console.log(`No nToken balance found for contract: ${nTokenId}`);
        return 0;
      }
    } catch (error) {
      console.error("Error fetching nToken balance:", error);
      return 0;
    }
  };

  // Function to fetch user positions (both deposits and borrows)
  const fetchUserPositions = async (
    userAddress: string,
    networkId: string,
    markets: unknown[] = []
  ) => {
    try {
      console.log("fetchUserPositions called with:", {
        userAddress,
        networkId,
        marketsCount: markets.length,
      });
      const tokens = getPortfolioVisibleTokens(networkId as NetworkId);
      const positions = [];

      for (const token of tokens) {
        if (token.underlyingContractId && token.poolId) {
          if (
            isMarketsTableExcludedMarket(
              networkId as NetworkId,
              token.poolId,
              token.configKey
            )
          ) {
            continue;
          }
          const rowTokenConfigRaw = getTokenConfig(
            networkId as NetworkId,
            token.configKey ?? token.originalSymbol ?? token.symbol
          );
          const rowTokenConfig = Array.isArray(rowTokenConfigRaw)
            ? rowTokenConfigRaw.find(
                (tc) => String(tc.poolId) === String(token.poolId)
              ) ?? rowTokenConfigRaw[0]
            : rowTokenConfigRaw;
          const positionIconBadgeUrl = resolveTokenIconBadgeUrl(
            rowTokenConfig?.iconBadgeFromSymbol
          );

          // Match by market id + pool (display symbol can collide, e.g. ALGO vs fALGO both "Algo")
          let market = marketRowForPortfolioPosition(markets, {
            marketId: token.underlyingContractId,
            poolId: token.poolId,
            displaySymbol: token.symbol,
          });

          console.log({
            fetchUserPositions: {
              token,
              markets,
              market,
            },
          });

          if (!market) {
            market = markets.find(
              (m) =>
                (m as { symbol?: string }).symbol === token.symbol &&
                String((m as { poolId?: string }).poolId) ===
                  String(token.poolId)
            ) as Record<string, unknown> | undefined;
          }

          // Fetch both deposit and borrow balances for this token
          const [depositBalance, borrowData] = await Promise.all([
            fetchUserDepositBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              networkId as NetworkId
            ),
            fetchUserBorrowBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              networkId as NetworkId
            ),
          ]);

          // Extract borrow balance and interest from the new return type
          const borrowBalance = borrowData?.balance || 0;
          const borrowInterest = borrowData?.interest || 0;

          // Add deposit position if user has deposits
          if (depositBalance && depositBalance > 0) {
            // Fetch ntoken balance for this deposit
            const nTokenBalance = await fetchNTokenBalance(
              userAddress,
              rowTokenConfig?.nTokenId || "",
              networkId
            );

            const tokenPrice = resolvePortfolioPositionUsdPerToken({
              market,
              tokenDecimals: token.decimals,
              networkId: networkId as NetworkId,
              poolId: token.poolId,
              marketId: token.underlyingContractId,
              configKey: token.configKey,
              originalSymbol: token.originalSymbol,
              displaySymbol: token.symbol,
              marketRows: markets,
            });

            console.log(`Deposit position for ${token.symbol}:`, {
              depositBalance,
              nTokenBalance,
              marketPrice: (market as { price?: unknown } | undefined)?.price,
              tokenPrice: tokenPrice,
              calculatedValue: depositBalance * tokenPrice,
              marketFound: !!market,
            });

            positions.push({
              asset: token.symbol,
              originalSymbol: token.originalSymbol ?? token.symbol,
              configSymbol: token.configKey,
              marketId: token.underlyingContractId,
              icon: token.logoPath,
              iconBadgeUrl: positionIconBadgeUrl,
              balance: depositBalance,
              nTokenBalance: nTokenBalance,
              value: depositBalance * tokenPrice,
              apy:
                market?.apyCalculation?.apy ||
                (market?.supplyRate ? market.supplyRate * 100 : 0),
              tokenPrice: tokenPrice,
              type: "deposit",
              poolId: token.poolId,
              network: networkId, // Add network information
            });
          }

          // Add borrow position if user has borrows
          if (borrowBalance && borrowBalance > 0) {
            const tokenPrice = resolvePortfolioPositionUsdPerToken({
              market,
              tokenDecimals: token.decimals,
              networkId: networkId as NetworkId,
              poolId: token.poolId,
              marketId: token.underlyingContractId,
              configKey: token.configKey,
              originalSymbol: token.originalSymbol,
              displaySymbol: token.symbol,
              marketRows: markets,
            });

            console.log(`Borrow position for ${token.symbol}:`, {
              borrowBalance,
              borrowInterest,
              marketPrice: market?.price,
              tokenPrice: tokenPrice,
              calculatedValue: borrowBalance * tokenPrice,
              marketFound: !!market,
            });

            positions.push({
              asset: token.symbol,
              configSymbol: token.configKey,
              marketId: token.underlyingContractId,
              icon: token.logoPath,
              iconBadgeUrl: positionIconBadgeUrl,
              balance: borrowBalance,
              value: borrowBalance * tokenPrice,
              apy:
                market?.borrowApyCalculation?.apy ||
                (market?.borrowRateCurrent
                  ? market.borrowRateCurrent * 100
                  : 0),
              tokenPrice: tokenPrice,
              type: "borrow",
              interest: borrowInterest,
              poolId: token.poolId,
              network: networkId, // Add network information
            });
          }
        }
      }

      console.log("fetchUserPositions returning:", positions);
      return positions;
    } catch (error) {
      console.error("Error fetching user positions:", error);
      return [];
    }
  };

  // Folks fALGO (etc.): cache minted f-asset for 1.0 underlying (deposits + borrows so borrow-only users get a ratio for repay/UX).
  useEffect(() => {
    const deposits = user?.computed?.deposits;
    const borrows = user?.computed?.borrows;
    const fromDeposits = Array.isArray(deposits) ? deposits : [];
    const fromBorrows = Array.isArray(borrows) ? borrows : [];
    const list = [...fromDeposits, ...fromBorrows];
    if (list.length === 0) {
      setFolksMintedOneUnderlyingByKey({});
      return;
    }

    let cancelled = false;

    (async () => {
      const fetched: Record<string, string> = {};

      for (const item of list) {
        const networkId = item.network as NetworkId | undefined;
        const marketId =
          item.marketId?.toString() || item.underlyingContractId?.toString();
        const appId = item.appId?.toString() || item.poolId?.toString();
        if (!networkId || !marketId || !appId) continue;
        if (networkId !== "algorand-mainnet") continue;

        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find(
          (t) =>
            (t.underlyingContractId === marketId ||
              t.originalContractId === marketId) &&
            t.poolId === appId
        );
        if (!token) continue;

        const configSym =
          token.configKey ?? token.originalSymbol ?? token.symbol;
        const key = `${networkId}|${configSym}|${appId}`;

        if (fetched[key]) continue;

        const raw = getTokenConfig(networkId, configSym);
        const tc: TokenConfig | undefined = Array.isArray(raw)
          ? raw.find((c) => String(c.poolId) === String(appId)) ?? raw[0]
          : raw;

        const folksTc =
          getFolksAdapterForPhase(tc ?? {}, "deposit") ??
          getAnyFolksAdapter(tc ?? {});
        if (!folksTc) continue;

        const algodNet = getAlgorandNetworkFromNetworkId(networkId);
        if (!algodNet) continue;

        try {
          const clients = algorandService.initializeClients(algodNet);
          const oneUnderlyingAtomic = BigInt(
            new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
          );
          const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount(
            {
              poolName: folksTc.folksParams.pool,
              underlyingAmount: oneUnderlyingAtomic,
              algod: clients.algod,
            }
          );
          if (mintedFAsset > BigInt(0)) {
            fetched[key] = mintedFAsset.toString();
          }
        } catch (e) {
          console.warn(
            "[Portfolio] Folks mint ratio for supplied/borrow display failed",
            { key, error: e }
          );
        }
      }

      if (!cancelled) {
        setFolksMintedOneUnderlyingByKey(fetched);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.computed?.deposits, user?.computed?.borrows]);

  // Transform user.computed.deposits and user.computed.borrows into table format
  const transformedDepositsAndBorrows = useMemo(() => {
    const transformedDeposits: unknown[] = [];
    const transformedBorrows: unknown[] = [];

    if (user?.computed?.deposits && Array.isArray(user.computed.deposits)) {
      user.computed.deposits.forEach((item: Record<string, unknown>) => {
        try {
          const networkId = item.network;
          const marketId =
            item.marketId?.toString() || item.underlyingContractId?.toString();
          const appId = item.appId?.toString() || item.poolId?.toString();

          if (!networkId || !marketId || !appId) {
            console.warn("Missing required fields for deposit item:", item);
            return;
          }

          // Get tokens for this network
          const tokens = getAllTokensWithDisplayInfo(networkId as NetworkId);

          // Find token matching marketId and poolId
          const token = tokens.find(
            (t) =>
              (String(t.underlyingContractId ?? "") === String(marketId) ||
                String(t.originalContractId ?? "") === String(marketId)) &&
              String(t.poolId ?? "") === String(appId)
          );

          if (!token) {
            console.warn(
              `Token not found for marketId ${marketId}, appId ${appId} on network ${networkId}`
            );
            return;
          }

          if (
            isMarketsTableExcludedMarket(
              networkId as NetworkId,
              appId,
              token.configKey
            )
          ) {
            return;
          }

          // Find market data (do not match display symbol only — ALGO vs fALGO both "Algo" on same pool)
          const market = marketRowForPortfolioPosition(marketData, {
            marketId,
            poolId: appId,
            displaySymbol: token.symbol,
          }) as { depositIndex?: string; borrowIndex?: string; price?: string; apyCalculation?: { apy?: number }; supplyRate?: number } | undefined;

          console.log("[Portfolio] Market data:", {
            market,
            marketDataLength: marketData.length,
            symbol: token.symbol,
            appId,
            marketId,
          });

          // Calculate actual balance from scaled deposits
          // Formula: actual_deposits = (scaled_deposits * current_deposit_index) / SCALE
          // SCALE = 1e18
          const SCALE = BigInt(1e18);
          // Handle scaledDeposits as string or number from API
          const scaledDepositsValue =
            typeof item.scaledDeposits === "string"
              ? item.scaledDeposits
              : (item.scaledDeposits || 0).toString();
          const scaledDeposits = BigInt(scaledDepositsValue);

          // Get depositIndex from market data - it should be a string representation of BigInt
          // If not available, use default SCALE (1e18) as fallback to still show the item
          let depositIndex: bigint;
          let depositIndexStr: string;
          if (!market?.depositIndex) {
            console.warn(
              `[Portfolio] depositIndex not found for ${token.symbol} (poolId: ${appId}), using default SCALE`
            );
            depositIndex = SCALE;
            depositIndexStr = SCALE.toString();
          } else {
            depositIndexStr = market.depositIndex.toString();
            depositIndex = BigInt(depositIndexStr);
          }

          const actualDepositsRaw =
            scaledDeposits === 0n
              ? 0n
              : (scaledDeposits * depositIndex) / SCALE;

          // actualDepositsRaw is in the smallest unit (e.g., micro-units for 6 decimals)
          // Divide by token decimals to get human-readable amount
          const actualBalance =
            Number(actualDepositsRaw) / Math.pow(10, token.decimals);

          // Sanity check: if balance seems unreasonably high (> 1e10), there might be a conversion issue
          if (actualBalance > 1e10) {
            console.error(
              `[Portfolio] Unreasonably high balance calculated for ${token.symbol}:`,
              {
                scaledDeposits: scaledDepositsValue,
                depositIndex: depositIndexStr,
                actualDepositsRaw: actualDepositsRaw.toString(),
                tokenDecimals: token.decimals,
                actualBalance,
                item: item,
              }
            );
            return; // Skip this item if calculation seems wrong
          }

          // Debug logging
          console.log(
            `[Portfolio] Deposit transformation for ${token.symbol}:`,
            {
              scaledDeposits: scaledDepositsValue,
              depositIndex: depositIndexStr,
              actualDepositsRaw: actualDepositsRaw.toString(),
              tokenDecimals: token.decimals,
              actualBalance,
              marketFound: !!market,
            }
          );

          if (actualBalance <= 0) {
            return; // Skip zero balances
          }

          // Get token price (oracle-aware; Folks/BTC family fallbacks — never invent $1)
          const tokenPrice = resolvePortfolioPositionUsdPerToken({
            market,
            tokenDecimals: token.decimals,
            networkId: networkId as NetworkId,
            poolId: appId,
            marketId,
            configKey: token.configKey,
            originalSymbol: token.originalSymbol,
            displaySymbol: token.symbol,
            marketRows: marketData,
          });

          // Get APY
          const apy =
            market?.apyCalculation?.apy ||
            (market?.supplyRate ? market.supplyRate * 100 : 0);

          // Extract depositIndex from user.userData item (this is the user's deposit index for this market)
          // The item comes from user.userData array, which has depositIndex for the matching market
          const userDepositIndex =
            item.depositIndex?.toString() || item.userDepositIndex?.toString();

          // Calculate accrued interest for deposits
          // Accrued Interest = Current Deposit Value - Original Deposit Amount
          // Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE
          // Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE
          let accruedInterest = 0;
          if (userDepositIndex && scaledDeposits > 0n && depositIndex > 0n) {
            const userDepositIndexBigInt = BigInt(userDepositIndex);
            if (userDepositIndexBigInt > 0n) {
              if (userDepositIndexBigInt > depositIndex) {
                console.warn(
                  "Invalid deposit index relationship: userDepositIndex > currentDepositIndex",
                  {
                    userDepositIndex: userDepositIndex,
                    currentDepositIndex: depositIndex.toString(),
                    tokenSymbol: token.symbol,
                    marketId,
                  }
                );
                accruedInterest = 0;
              } else {
                const interestRaw =
                  (scaledDeposits * (depositIndex - userDepositIndexBigInt)) / SCALE;
                accruedInterest = Math.max(
                  0,
                  Number(interestRaw) / Math.pow(10, token.decimals)
                );
              }
            }
          }

          const folksDisplayKey = `${String(networkId)}|${String(
            token.configKey ?? token.originalSymbol ?? token.symbol
          )}|${String(appId)}`;
          const mintedOneStr = folksMintedOneUnderlyingByKey[folksDisplayKey];
          let balanceForDisplay = actualBalance;
          let accruedInterestForDisplay = accruedInterest;
          if (mintedOneStr) {
            try {
              const mf = BigInt(mintedOneStr);
              if (mf > BigInt(0)) {
                balanceForDisplay = folksFAssetHumanToUnderlyingHuman(
                  actualBalance,
                  mf,
                  token.decimals
                );
                accruedInterestForDisplay = folksFAssetHumanToUnderlyingHuman(
                  accruedInterest,
                  mf,
                  token.decimals
                );
              }
            } catch {
              /* ignore invalid cache */
            }
          }

          const depositBadgeCfgRaw = getTokenConfig(
            networkId as NetworkId,
            token.configKey ?? token.originalSymbol ?? ""
          );
          const depositBadgeCfg = Array.isArray(depositBadgeCfgRaw)
            ? depositBadgeCfgRaw.find(
                (c) => String(c.poolId) === String(appId)
              ) ?? depositBadgeCfgRaw[0]
            : depositBadgeCfgRaw;

          transformedDeposits.push({
            asset: token.symbol,
            originalSymbol: token.originalSymbol ?? token.symbol,
            configSymbol: token.configKey ?? token.originalSymbol,
            icon: token.logoPath,
            iconBadgeUrl: resolveTokenIconBadgeUrl(
              depositBadgeCfg?.iconBadgeFromSymbol
            ),
            balance: balanceForDisplay,
            value: balanceForDisplay * tokenPrice,
            apy: apy,
            tokenPrice: tokenPrice,
            poolId: appId,
            network: networkId,
            type: "deposit",
            scaledDeposits: scaledDepositsValue, // Include scaled deposits for interest calculations
            userDepositIndex: userDepositIndex, // User deposit index from user.userData for this matching market
            marketId: marketId, // Include marketId for matching
            appId: appId, // Include appId for matching
            accruedInterest: accruedInterestForDisplay,
            accruedInterestValue: accruedInterestForDisplay * tokenPrice,
          });
        } catch (error) {
          console.error("Error transforming deposit item:", error, item);
        }
      });
    }

    if (user?.computed?.borrows && Array.isArray(user.computed.borrows)) {
      user.computed.borrows.forEach((item: Record<string, unknown>) => {
        try {
          const networkId = item.network;
          const marketId =
            item.marketId?.toString() || item.underlyingContractId?.toString();
          const appId = item.appId?.toString() || item.poolId?.toString();

          if (!networkId || !marketId || !appId) {
            console.warn("Missing required fields for borrow item:", item);
            return;
          }

          // Get tokens for this network
          const tokens = getAllTokensWithDisplayInfo(networkId as NetworkId);

          // Find token matching marketId and poolId
          const token = tokens.find(
            (t) =>
              (String(t.underlyingContractId ?? "") === String(marketId) ||
                String(t.originalContractId ?? "") === String(marketId)) &&
              String(t.poolId ?? "") === String(appId)
          );

          if (!token) {
            console.warn(
              `Token not found for marketId ${marketId}, appId ${appId} on network ${networkId}`
            );
            return;
          }

          if (
            isMarketsTableExcludedMarket(
              networkId as NetworkId,
              appId,
              token.configKey
            )
          ) {
            return;
          }

          const market = marketRowForPortfolioPosition(marketData, {
            marketId,
            poolId: appId,
            displaySymbol: token.symbol,
          }) as { borrowIndex?: string; price?: string; borrowApyCalculation?: { apy?: number }; borrowRateCurrent?: number } | undefined;

          // Calculate actual balance from scaled borrows
          // Formula: actual_borrows = (scaled_borrows * current_borrow_index) / SCALE
          // SCALE = 1e18
          const SCALE = BigInt(1e18);
          // Handle scaledBorrows as string or number from API
          const scaledBorrowsValue =
            typeof item.scaledBorrows === "string"
              ? item.scaledBorrows
              : (item.scaledBorrows || 0).toString();
          const scaledBorrows = BigInt(scaledBorrowsValue);

          // Get borrowIndex from market data - it should be a string representation of BigInt
          // If not available, use default SCALE (1e18) as fallback to still show the item
          let borrowIndex: bigint;
          let borrowIndexStr: string;
          if (!market?.borrowIndex) {
            console.warn(
              `[Portfolio] borrowIndex not found for ${token.symbol} (poolId: ${appId}), using default SCALE`
            );
            borrowIndex = SCALE;
            borrowIndexStr = SCALE.toString();
          } else {
            borrowIndexStr = market.borrowIndex.toString();
            borrowIndex = BigInt(borrowIndexStr);
          }

          const actualBorrowsRaw =
            scaledBorrows === 0n ? 0n : (scaledBorrows * borrowIndex) / SCALE;

          // actualBorrowsRaw is in the smallest unit (e.g., micro-units for 6 decimals)
          // Divide by token decimals to get human-readable amount
          const actualBalance =
            Number(actualBorrowsRaw) / Math.pow(10, token.decimals);

          // Sanity check: if balance seems unreasonably high (> 1e10), there might be a conversion issue
          if (actualBalance > 1e10) {
            console.error(
              `[Portfolio] Unreasonably high balance calculated for ${token.symbol}:`,
              {
                scaledBorrows: scaledBorrowsValue,
                borrowIndex: borrowIndexStr,
                actualBorrowsRaw: actualBorrowsRaw.toString(),
                tokenDecimals: token.decimals,
                actualBalance,
                item: item,
              }
            );
            return; // Skip this item if calculation seems wrong
          }

          // Debug logging
          console.log(
            `[Portfolio] Borrow transformation for ${token.symbol}:`,
            {
              scaledBorrows: scaledBorrowsValue,
              borrowIndex: borrowIndexStr,
              actualBorrowsRaw: actualBorrowsRaw.toString(),
              tokenDecimals: token.decimals,
              actualBalance,
              marketFound: !!market,
            }
          );

          if (actualBalance <= 0) {
            return; // Skip zero balances
          }

          // Get token price (oracle-aware; Folks/BTC family fallbacks — never invent $1)
          const tokenPrice = resolvePortfolioPositionUsdPerToken({
            market,
            tokenDecimals: token.decimals,
            networkId: networkId as NetworkId,
            poolId: appId,
            marketId,
            configKey: token.configKey,
            originalSymbol: token.originalSymbol,
            displaySymbol: token.symbol,
            marketRows: marketData,
          });

          // Get APY
          const apy =
            market?.borrowApyCalculation?.apy ||
            (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0);

          // Extract borrowIndex from user.userData item (this is the user's borrow index for this market)
          const userBorrowIndex =
            item.borrowIndex?.toString() || item.userBorrowIndex?.toString();

          // Calculate accrued interest for borrows
          // Accrued Interest = Current Borrow Amount - Original Borrow Amount
          // Current Borrow Amount = (scaledBorrows × currentBorrowIndex) ÷ SCALE
          // Original Borrow Amount = (scaledBorrows × userBorrowIndex) ÷ SCALE
          let accruedInterest = 0;
          if (userBorrowIndex && scaledBorrows > 0n && borrowIndex > 0n) {
            const userBorrowIndexBigInt = BigInt(userBorrowIndex);
            if (userBorrowIndexBigInt > 0n) {
              // Validate: currentBorrowIndex should always be >= userBorrowIndex
              // (current index increases over time as interest accrues)
              if (userBorrowIndexBigInt > borrowIndex) {
                console.warn(
                  "Invalid borrow index relationship: userBorrowIndex > currentBorrowIndex",
                  {
                    userBorrowIndex: userBorrowIndex,
                    currentBorrowIndex: borrowIndex.toString(),
                    tokenSymbol: token.symbol,
                    marketId,
                  }
                );
                // If indices are invalid, assume no interest accrued
                accruedInterest = 0;
              } else {
                const interestRaw =
                  (scaledBorrows * (borrowIndex - userBorrowIndexBigInt)) / SCALE;
                accruedInterest = Math.max(
                  0,
                  Number(interestRaw) / Math.pow(10, token.decimals)
                );
              }
            }
          }

          const borrowBadgeCfgRaw = getTokenConfig(
            networkId as NetworkId,
            token.configKey ?? token.originalSymbol ?? ""
          );
          const borrowBadgeCfg = Array.isArray(borrowBadgeCfgRaw)
            ? borrowBadgeCfgRaw.find(
                (c) => String(c.poolId) === String(appId)
              ) ?? borrowBadgeCfgRaw[0]
            : borrowBadgeCfgRaw;

          transformedBorrows.push({
            asset: token.symbol,
            configSymbol: token.configKey ?? token.originalSymbol,
            icon: token.logoPath,
            iconBadgeUrl: resolveTokenIconBadgeUrl(
              borrowBadgeCfg?.iconBadgeFromSymbol
            ),
            balance: actualBalance,
            value: actualBalance * tokenPrice,
            apy: apy,
            tokenPrice: tokenPrice,
            poolId: appId,
            marketId: marketId,
            network: networkId,
            type: "borrow",
            interest: accruedInterest, // Accrued interest for borrows (interest owed) - using 'interest' to match Borrow interface
            accruedInterest: accruedInterest, // Keep for backward compatibility
            accruedInterestValue: accruedInterest * tokenPrice, // Accrued interest in USD
          });
        } catch (error) {
          console.error("Error transforming borrow item:", error, item);
        }
      });
    }

    return { deposits: transformedDeposits, borrows: transformedBorrows };
  }, [
    user?.computed?.deposits,
    user?.computed?.borrows,
    marketData,
    folksMintedOneUnderlyingByKey,
  ]);

  // Use transformed deposits and borrows from user.computed, fallback to userPositions
  // If user.computed exists but transformation resulted in empty arrays, fall back to userPositions
  const hasComputedData = user?.computed?.deposits || user?.computed?.borrows;
  const rawDeposits =
    hasComputedData && transformedDepositsAndBorrows.deposits.length > 0
      ? transformedDepositsAndBorrows.deposits
      : userPositions.filter((pos) => pos.type === "deposit");
  const rawBorrows =
    hasComputedData && transformedDepositsAndBorrows.borrows.length > 0
      ? transformedDepositsAndBorrows.borrows
      : userPositions.filter((pos) => pos.type === "borrow");
  const deposits = rawDeposits.filter(
    (pos) => !isExcludedPortfolioPositionRow(pos as ItemWithNetwork)
  );
  const borrows = rawBorrows.filter(
    (pos) => !isExcludedPortfolioPositionRow(pos as ItemWithNetwork)
  );

  const hasBothPositionTypes =
    deposits.length > 0 && borrows.length > 0;

  // Combine deposits and borrows with accrued interest, grouped by market
  const accruedInterestItems = useMemo(() => {
    // Group by market key: asset + network + poolId
    const marketMap = new Map<string, unknown>();

    // Process deposits with accrued interest
    deposits.forEach((deposit) => {
      const accruedInterest = deposit.accruedInterest || 0;
      if (accruedInterest > 0) {
        const marketKey = `${deposit.asset}-${(deposit as ItemWithNetwork).network || "unknown"
          }-${deposit.poolId || "unknown"}`;
        const existing = marketMap.get(marketKey);

        if (existing) {
          existing.earnedInterest += accruedInterest;
          existing.earnedInterestValue +=
            deposit.accruedInterestValue ||
            accruedInterest * (deposit.tokenPrice || 1);
          if (
            !(existing as { iconBadgeUrl?: string }).iconBadgeUrl &&
            (deposit as { iconBadgeUrl?: string }).iconBadgeUrl
          ) {
            (existing as { iconBadgeUrl?: string }).iconBadgeUrl = (
              deposit as { iconBadgeUrl?: string }
            ).iconBadgeUrl;
          }
        } else {
          marketMap.set(marketKey, {
            asset: deposit.asset,
            icon: deposit.icon,
            iconBadgeUrl: (deposit as { iconBadgeUrl?: string }).iconBadgeUrl,
            network: (deposit as ItemWithNetwork).network,
            poolId: deposit.poolId,
            tokenPrice: deposit.tokenPrice || 1,
            earnedInterest: accruedInterest,
            earnedInterestValue:
              deposit.accruedInterestValue ||
              accruedInterest * (deposit.tokenPrice || 1),
            owedInterest: 0,
            owedInterestValue: 0,
          });
        }
      }
    });

    // Process borrows with accrued interest
    borrows.forEach((borrow) => {
      const accruedInterest =
        borrow.accruedInterest || (borrow as ItemWithNetwork).interest || 0;
      if (accruedInterest > 0) {
        const marketKey = `${borrow.asset}-${(borrow as ItemWithNetwork).network || "unknown"
          }-${borrow.poolId || "unknown"}`;
        const existing = marketMap.get(marketKey);

        if (existing) {
          existing.owedInterest += accruedInterest;
          existing.owedInterestValue +=
            borrow.accruedInterestValue ||
            accruedInterest * (borrow.tokenPrice || 1);
          if (
            !(existing as { iconBadgeUrl?: string }).iconBadgeUrl &&
            (borrow as { iconBadgeUrl?: string }).iconBadgeUrl
          ) {
            (existing as { iconBadgeUrl?: string }).iconBadgeUrl = (
              borrow as { iconBadgeUrl?: string }
            ).iconBadgeUrl;
          }
        } else {
          marketMap.set(marketKey, {
            asset: borrow.asset,
            icon: borrow.icon,
            iconBadgeUrl: (borrow as { iconBadgeUrl?: string }).iconBadgeUrl,
            network: (borrow as ItemWithNetwork).network,
            poolId: borrow.poolId,
            tokenPrice: borrow.tokenPrice || 1,
            earnedInterest: 0,
            earnedInterestValue: 0,
            owedInterest: accruedInterest,
            owedInterestValue:
              borrow.accruedInterestValue ||
              accruedInterest * (borrow.tokenPrice || 1),
          });
        }
      }
    });

    // Convert map to array and calculate net accrued interest
    const items = Array.from(marketMap.values())
      .map((market) => {
        const netInterest = market.earnedInterest - market.owedInterest;
        const netInterestValue =
          market.earnedInterestValue - market.owedInterestValue;

        return {
          ...market,
          netInterest: netInterest,
          netInterestValue: netInterestValue,
          // Keep individual values for display if needed
          accruedInterest: Math.abs(netInterest), // For sorting/comparison
          accruedInterestValue: Math.abs(netInterestValue), // For sorting/comparison
        };
      })
      .filter((item) => Math.abs(item.netInterest) > 0); // Only show markets with non-zero net interest

    return items;
  }, [deposits, borrows]);

  // Debug logging
  console.log("[Portfolio] Final deposits and borrows:", {
    hasComputedData,
    transformedDepositsCount: transformedDepositsAndBorrows.deposits.length,
    transformedBorrowsCount: transformedDepositsAndBorrows.borrows.length,
    userPositionsDepositsCount: userPositions.filter(
      (pos) => pos.type === "deposit"
    ).length,
    userPositionsBorrowsCount: userPositions.filter(
      (pos) => pos.type === "borrow"
    ).length,
    finalDepositsCount: deposits.length,
    finalBorrowsCount: borrows.length,
  });

  // Calculate totals - prioritize computed global values from API, then fallback to local calculations
  const totalCollateral =
    user?.computed?.globalCollateralValue !== undefined
      ? Number(user.computed.globalCollateralValue)
      : userGlobalData?.totalCollateralValue ||
      deposits.reduce((sum, deposit) => sum + deposit.value, 0);

  console.log({
  });

  const totalBorrowed =
    user?.computed?.globalBorrowValue !== undefined
      ? Number(user.computed.globalBorrowValue)
      : userGlobalData?.totalBorrowValue ||
      borrows.reduce((sum, borrow) => sum + borrow.value, 0);

  // Calculate weighted liquidation threshold based on borrowed assets only
  // This is more accurate because liquidation risk only applies to markets with active debt
  const calculateWeightedLiquidationThreshold = () => {
    if (marketData.length === 0) {
      // Fallback to standard threshold if no market data
      return 0.85; // 85% liquidation threshold
    }

    let weightedThreshold = 0;
    let totalBorrowWeight = 0;

    // Calculate weighted average liquidation threshold based on borrowed assets
    // Only consider markets where the user has active borrows since:
    // 1. Liquidation only occurs when debt exists
    // 2. Collateral without debt doesn't create liquidation risk
    // 3. Each borrowed asset has its own liquidation threshold
    borrows.forEach((borrow) => {
      const market = marketRowForPortfolioPosition(marketData, {
        marketId: (borrow as ItemWithNetwork).marketId,
        poolId: borrow.poolId,
        displaySymbol: borrow.asset,
      }) as { liquidationThreshold?: unknown } | undefined;
      console.log(
        `Borrow asset: ${borrow.asset}, value: ${borrow.value}, market found:`,
        !!market
      );
      if (market) {
        console.log(
          `Market liquidation threshold:`,
          market.liquidationThreshold
        );
      }
      if (market && borrow.value > 0) {
        const threshold = market.liquidationThreshold || 0.85;
        weightedThreshold += borrow.value * threshold;
        totalBorrowWeight += borrow.value;
        console.log(
          `Added to calculation: borrow=${borrow.value}, threshold=${threshold}`
        );
      }
    });

    const result =
      totalBorrowWeight > 0 ? weightedThreshold / totalBorrowWeight : 0.85;
    console.log(`Weighted liquidation threshold calculation:`, {
      weightedThreshold,
      totalBorrowWeight,
      result,
    });
    return result;
  };

  // Temporarily use fixed threshold to debug the issue
  const weightedLiquidationThreshold = 0.85; // Fixed 85% threshold
  // const weightedLiquidationThreshold = calculateWeightedLiquidationThreshold();

  // Calculate weighted average collateral factor based on user's deposits
  // This gives an average collateral factor across all deposited assets
  const calculateWeightedCollateralFactor = () => {
    if (marketData.length === 0 || deposits.length === 0) {
      // Fallback to standard 80% if no market data or deposits
      return 0.8;
    }

    let weightedCollateralFactor = 0;
    let totalDepositValue = 0;

    deposits.forEach((deposit) => {
      const market = marketRowForPortfolioPosition(marketData, {
        marketId: (deposit as ItemWithNetwork).marketId,
        poolId: deposit.poolId,
        displaySymbol: deposit.asset,
      });
      if (market && deposit.value > 0) {
        const collateralFactor = market.collateralFactor || 0.8;
        weightedCollateralFactor += deposit.value * collateralFactor;
        totalDepositValue += deposit.value;
      }
    });

    const result =
      totalDepositValue > 0
        ? weightedCollateralFactor / totalDepositValue
        : 0.8;
    return result;
  };

  const weightedCollateralFactor = calculateWeightedCollateralFactor();

  /** Min liquidation threshold among markets where the user has deposits — matches conservative aggregate health (same LT shape as `_calculate_user_health`). */
  const minLiquidationThresholdForHealth = useMemo(() => {
    const md = marketData as Array<{
      symbol?: string;
      poolId?: string;
      liquidationThreshold?: unknown;
      marketInfo?: { liquidationThreshold?: unknown };
    }>;
    if (!deposits.length || !md.length) {
      return normalizeLiquidationThresholdToDecimal(undefined);
    }
    const thresholds: number[] = [];
    for (const deposit of deposits) {
      if (!deposit.value || deposit.value <= 0) continue;
      const market = marketRowForPortfolioPosition(marketData, {
        marketId: (deposit as ItemWithNetwork).marketId,
        poolId: deposit.poolId,
        displaySymbol: deposit.asset,
      }) as (typeof md)[0] | undefined;
      const raw =
        market?.liquidationThreshold ??
        market?.marketInfo?.liquidationThreshold;
      if (raw !== undefined && raw !== null) {
        thresholds.push(normalizeLiquidationThresholdToDecimal(raw));
      }
    }
    return thresholds.length > 0
      ? Math.min(...thresholds)
      : normalizeLiquidationThresholdToDecimal(undefined);
  }, [deposits, marketData]);

  // Calculate at-risk assets: assets where (deposit value * liquidation factor) / total borrow value < 1
  const atRiskAssets = useMemo(() => {
    if (totalBorrowed <= 0 || deposits.length === 0) {
      return [];
    }

    return deposits
      .map((deposit) => {
        // Find market data for this deposit to get liquidation factor
        const market = marketRowForPortfolioPosition(marketData, {
          marketId: (deposit as ItemWithNetwork).marketId,
          poolId: deposit.poolId,
          displaySymbol: deposit.asset,
        });

        const liquidationFactor =
          market?.liquidationThreshold ??
          (market as { marketInfo?: { liquidationThreshold?: unknown } })
            ?.marketInfo?.liquidationThreshold ??
          0.85;

        // Convert to number if needed
        const liquidationFactorNum =
          typeof liquidationFactor === "string"
            ? parseFloat(liquidationFactor)
            : typeof liquidationFactor === "bigint"
              ? Number(liquidationFactor)
              : liquidationFactor;

        // Calculate risk ratio: (deposit value * liquidation factor) / total borrow value
        let riskRatio = (deposit.value * liquidationFactorNum) / totalBorrowed;

        // Get pool collateral value and borrows from global user data (API endpoint: /global-user-data)
        // Match by poolId/appId to find the corresponding global user data entry for this pool
        let poolCollateralValueUSD = 0;
        let poolBorrowsUSD = 0;

        if (
          user?.globalUserData &&
          Array.isArray(user.globalUserData) &&
          deposit.poolId
        ) {
          const poolGlobalData = user.globalUserData.find(
            (item: Record<string, unknown>) => String(item.appId) === String(deposit.poolId)
          );

          if (poolGlobalData) {
            console.log("[Portfolio] Pool global data:", poolGlobalData);
            try {
              // Global user data values are scaled by 1e12, so divide to get USD
              // This comes from the global user state of the appId (pool)
              poolCollateralValueUSD =
                Number(
                  BigInt(poolGlobalData.totalCollateralValue) / BigInt(1e12)
                ) || 0;
              poolBorrowsUSD =
                Number(
                  BigInt(poolGlobalData.totalBorrowValue) / BigInt(1e12)
                ) || 0;

              riskRatio =
                (poolCollateralValueUSD * liquidationFactorNum) /
                poolBorrowsUSD;
            } catch (error) {
              console.warn(
                `Error parsing global user data for pool ${deposit.poolId}:`,
                error
              );
            }
          } else {
            // Log when pool data is not found (helpful for debugging)
            console.debug(
              `No global user data found for pool ${deposit.poolId} (asset: ${deposit.asset})`
            );
          }
        }

        return {
          ...deposit,
          liquidationFactor: liquidationFactorNum,
          riskRatio,
          isAtRisk: riskRatio < 1,
          poolCollateralValueUSD,
          poolBorrowsUSD,
        };
      })
      .filter((asset) => asset.isAtRisk && asset.poolBorrowsUSD >= 0.01)
      .sort((a, b) => a.riskRatio - b.riskRatio); // Sort by risk ratio (most risky first)
  }, [deposits, marketData, totalBorrowed, user?.globalUserData]);

  // Portfolio health matches lending pool _calculate_user_health(collateral, borrow, liquidation_threshold).
  // Prefer each pool's get_global_user-style totals from `user.globalUserData`; portfolio HF = worst (min) HF
  // across pools with borrows. Fallback to aggregate collateral/borrow when per-pool data is missing.

  const { healthFactor, hfWorstPoolId, hfWorstNetwork } = useMemo(() => {
    const md = marketData as Array<{
      symbol?: string;
      poolId?: string;
      liquidationThreshold?: unknown;
      marketInfo?: { liquidationThreshold?: unknown };
    }>;

    const minLtForPool = (poolId: string): number => {
      const thresholds: number[] = [];
      for (const deposit of deposits) {
        if (String(deposit.poolId ?? "") !== poolId) continue;
        if (!deposit.value || deposit.value <= 0) continue;
        const market = marketRowForPortfolioPosition(marketData, {
          marketId: (deposit as ItemWithNetwork).marketId,
          poolId: deposit.poolId,
          displaySymbol: deposit.asset,
        }) as (typeof md)[0] | undefined;
        const raw =
          market?.liquidationThreshold ??
          market?.marketInfo?.liquidationThreshold;
        if (raw !== undefined && raw !== null) {
          thresholds.push(normalizeLiquidationThresholdToDecimal(raw));
        }
      }
      return thresholds.length > 0
        ? Math.min(...thresholds)
        : normalizeLiquidationThresholdToDecimal(undefined);
    };

    let worst: number | null = null;
    let worstPoolId: string | null = null;
    let worstNetwork: string | null = null;

    const gud = user?.globalUserData;
    if (Array.isArray(gud) && gud.length > 0) {
      for (const item of gud) {
        const rec = item as Record<string, unknown>;
        const poolId = String(rec.appId ?? rec.poolId ?? "");
        if (!poolId) continue;

        const poolNetworkRaw = rec.network;
        const poolNetwork =
          poolNetworkRaw != null && String(poolNetworkRaw).trim() !== ""
            ? String(poolNetworkRaw)
            : null;

        let collateral = 0;
        let borrow = 0;
        try {
          collateral = Number(
            BigInt(String(rec.totalCollateralValue ?? 0)) / BigInt(1e12)
          );
          borrow = Number(
            BigInt(String(rec.totalBorrowValue ?? 0)) / BigInt(1e12)
          );
        } catch {
          continue;
        }

        const lt = minLtForPool(poolId);

        if (borrow <= 0) {
          continue;
        }

        const hf = calculateUserHealthFactor(
          collateral,
          borrow,
          lt,
          `pool:${poolId}`
        );
        if (hf != null && isFinite(hf)) {
          if (worst === null || hf < worst) {
            worst = hf;
            worstPoolId = poolId;
            worstNetwork = poolNetwork;
          }
        }
      }
    }

    const aggregateFallback = calculateUserHealthFactor(
      totalCollateral,
      totalBorrowed,
      minLiquidationThresholdForHealth,
      "portfolio-aggregate-fallback"
    );

    const healthFactorValue = worst !== null ? worst : aggregateFallback;

    return {
      healthFactor: healthFactorValue,
      hfWorstPoolId: worstPoolId,
      hfWorstNetwork: worstNetwork,
    };
  }, [
    user?.globalUserData,
    deposits,
    marketData,
    totalCollateral,
    totalBorrowed,
    minLiquidationThresholdForHealth,
  ]);

  // Helper function to saturate health factor values at 3.00 for display
  const saturateHealthFactor = (healthFactor: number | null): number | null => {
    if (healthFactor === null) return null;
    return Math.min(healthFactor, 3.0);
  };

  /** One row per lending pool, for Network Portfolio — not network-aggregated. */
  const poolPortfolioBreakdown = useMemo(() => {
    const gudArray = Array.isArray(user?.globalUserData)
      ? user.globalUserData
      : [];

    const md = marketData as Array<{
      symbol?: string;
      poolId?: string;
      appId?: string;
      liquidationThreshold?: unknown;
      marketInfo?: { liquidationThreshold?: unknown };
    }>;

    const minLtForPool = (poolId: string): number => {
      const thresholds: number[] = [];
      for (const deposit of deposits) {
        if (String(deposit.poolId ?? "") !== poolId) continue;
        if (!deposit.value || deposit.value <= 0) continue;
        const market = marketRowForPortfolioPosition(marketData, {
          marketId: (deposit as ItemWithNetwork).marketId,
          poolId: deposit.poolId,
          displaySymbol: deposit.asset,
        }) as (typeof md)[0] | undefined;
        const raw =
          market?.liquidationThreshold ??
          market?.marketInfo?.liquidationThreshold;
        if (raw !== undefined && raw !== null) {
          thresholds.push(normalizeLiquidationThresholdToDecimal(raw));
        }
      }
      return thresholds.length > 0
        ? Math.min(...thresholds)
        : normalizeLiquidationThresholdToDecimal(undefined);
    };

    type PoolAgg = {
      poolId: string;
      network: string;
      collateral: number;
      borrow: number;
      fromGud: boolean;
    };

    const byKey = new Map<string, PoolAgg>();

    for (const raw of gudArray) {
      const rec = raw as Record<string, unknown>;
      const poolId = String(rec.appId ?? rec.poolId ?? "");
      if (!poolId) continue;

      let collateral = 0;
      let borrow = 0;
      try {
        collateral = Number(
          BigInt(String(rec.totalCollateralValue ?? 0)) / BigInt(1e12)
        );
        borrow = Number(
          BigInt(String(rec.totalBorrowValue ?? 0)) / BigInt(1e12)
        );
      } catch {
        continue;
      }

      const network = String(rec.network || "unknown");
      byKey.set(`${network}:${poolId}`, {
        poolId,
        network,
        collateral,
        borrow,
        fromGud: true,
      });
    }

    const ensurePool = (network: string, poolId: string) => {
      if (!poolId || !network) return;
      const key = `${network}:${poolId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          poolId,
          network,
          collateral: 0,
          borrow: 0,
          fromGud: false,
        });
      }
    };

    for (const deposit of deposits) {
      ensurePool(
        String((deposit as ItemWithNetwork).network ?? ""),
        String(deposit.poolId ?? "")
      );
    }
    for (const borrow of borrows) {
      ensurePool(
        String((borrow as ItemWithNetwork).network ?? ""),
        String(borrow.poolId ?? "")
      );
    }

    for (const agg of byKey.values()) {
      if (agg.fromGud) continue;
      agg.collateral = deposits
        .filter(
          (d) =>
            String(d.poolId ?? "") === agg.poolId &&
            String((d as ItemWithNetwork).network ?? "") === agg.network
        )
        .reduce((sum, d) => sum + (d.value || 0), 0);
      agg.borrow = borrows
        .filter(
          (b) =>
            String(b.poolId ?? "") === agg.poolId &&
            String((b as ItemWithNetwork).network ?? "") === agg.network
        )
        .reduce((sum, b) => sum + (b.value || 0), 0);
    }

    const rows: Array<{
      poolKey: string;
      poolId: string;
      network: string;
      networkDisplayName: string;
      marketLabel: string | null;
      title: string;
      chartLabel: string;
      collateral: number;
      borrow: number;
      netValue: number;
      healthFactor: number | null;
      liquidationMargin: number;
    }> = [];

    for (const agg of byKey.values()) {
      if (agg.collateral <= 0 && agg.borrow <= 0) continue;

      const { poolId, network, collateral, borrow } = agg;
      const networkDisplayName = network
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const marketLabel = getMarketLabel(network, poolId);
      const title = marketLabel
        ? `${networkDisplayName} · Market ${marketLabel}`
        : `${networkDisplayName} · Pool ${poolId}`;

      const shortNet = network.toLowerCase().includes("algorand")
        ? "Algorand"
        : network.toLowerCase().includes("voi")
          ? "VOI"
          : networkDisplayName.split(" ")[0] || networkDisplayName;

      const chartLabel = marketLabel
        ? `${shortNet} · ${marketLabel}`
        : `${shortNet} · ${poolId.length > 8 ? `…${poolId.slice(-6)}` : poolId}`;

      const lt = minLtForPool(poolId);
      const hfRaw = calculateUserHealthFactor(
        collateral,
        borrow,
        lt,
        `pool-portfolio:${poolId}`
      );
      const healthFactor =
        hfRaw === null ? null : saturateHealthFactor(hfRaw);

      const networkLTV =
        collateral > 0 ? (borrow / collateral) * 100 : borrow > 0 ? 100 : 0;
      const networkLiquidationMargin =
        collateral > 0 ? lt * 100 - networkLTV : 0;

      rows.push({
        poolKey: `${network}:${poolId}`,
        poolId,
        network,
        networkDisplayName,
        marketLabel,
        title,
        chartLabel,
        collateral,
        borrow,
        netValue: collateral - borrow,
        healthFactor,
        liquidationMargin: networkLiquidationMargin,
      });
    }

    return rows.sort(
      (a, b) => b.collateral + b.borrow - (a.collateral + a.borrow)
    );
  }, [user?.globalUserData, deposits, borrows, marketData]);

  const networkPortfolioPoolsFiltered = useMemo(() => {
    return poolPortfolioBreakdown.filter((row) =>
      itemMatchesPortfolioPositionFilters(
        { asset: row.title, poolId: row.poolId, network: row.network },
        {
          networkFilter: positionsNetworkFilter,
          marketFilter: positionsMarketFilter,
        }
      )
    );
  }, [
    poolPortfolioBreakdown,
    positionsNetworkFilter,
    positionsMarketFilter,
  ]);

  // Fetch wallet balance when repay modal opens
  useEffect(() => {
    const loadRepayWalletBalance = async () => {
      if (!repayModalOpen || !selectedRepayPosition || !activeAccount?.address) {
        setRepayWalletBalance(null);
        return;
      }

      const debtMarketId = selectedRepayPosition.debtMarketId;
      const networkId = selectedRepayPosition.networkId;
      const debtSymbol = selectedRepayPosition.debtSymbol;

      if (!debtMarketId || !networkId) {
        setRepayWalletBalance(null);
        return;
      }

      setIsLoadingRepayBalance(true);
      try {
        // Get token information to get decimals
        const tokens = getAllTokensWithDisplayInfo(networkId);
        let token = tokens.find(
          (t) => t.underlyingContractId === debtMarketId?.toString()
        );

        if (!token && debtSymbol) {
          token = tokens.find((t) => t.symbol === debtSymbol);
        }

        if (!token) {
          console.error("Token not found for debt market:", debtMarketId);
          setRepayWalletBalance(0);
          return;
        }

        // Get token config for decimals
        const originalSymbol =
          "originalSymbol" in token
            ? (token as ItemWithNetwork).originalSymbol
            : debtSymbol;
        const originalTokenConfigRaw = getTokenConfig(networkId, originalSymbol);

        if (!originalTokenConfigRaw) {
          console.error("Token config not found for:", originalSymbol);
          setRepayWalletBalance(0);
          return;
        }

        const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
          ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(selectedRepayPosition.appId)
          ) || originalTokenConfigRaw[0]
          : originalTokenConfigRaw;

        // Initialize clients for the network
        const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
        if (!algorandNetwork) {
          throw new Error(`Invalid network: ${networkId}`);
        }
        const clients = await algorandService.initializeClientsForTransactions(
          algorandNetwork
        );
        ARC200Service.initialize(clients);

        // Fetch balance using contractId directly
        const contractId = debtMarketId.toString();
        console.log(
          `Fetching wallet balance for ${debtSymbol} using contractId: ${contractId}`
        );
        const arc200Balance = await ARC200Service.getBalance(
          activeAccount.address,
          contractId
        );

        if (arc200Balance) {
          // Convert from smallest units to human readable format
          const balance = parseFloat(
            ARC200Service.formatBalance(
              arc200Balance,
              originalTokenConfig.decimals || token.decimals || 6
            )
          );
          console.log(`Wallet balance for ${debtSymbol}: ${balance}`);
          setRepayWalletBalance(balance);
        } else {
          console.log(`No wallet balance found for ${debtSymbol}`);
          setRepayWalletBalance(0);
        }
      } catch (error) {
        console.error("Error fetching repay wallet balance:", error);
        setRepayWalletBalance(0);
      } finally {
        setIsLoadingRepayBalance(false);
      }
    };

    loadRepayWalletBalance();
  }, [repayModalOpen, selectedRepayPosition, activeAccount?.address]);

  const lowestAtRiskHealthFactor =
    atRiskAssets.length > 0
      ? Math.min(...atRiskAssets.map((asset) => asset.riskRatio))
      : null;

  // Use the lowest health factor from at-risk assets if it's lower than the global health factor
  const healthFactorToDisplay =
    lowestAtRiskHealthFactor !== null &&
      (healthFactor === null || lowestAtRiskHealthFactor < healthFactor)
      ? lowestAtRiskHealthFactor
      : healthFactor;

  const displayHealthFactor = saturateHealthFactor(healthFactorToDisplay);

  const nftHolderModalEligibilitySnapshot = useMemo((): NftHolderEligibilitySnapshot | null => {
    if (!displayAddress || isViewOnly) return null;
    return {
      collateralUsd: totalCollateral,
      borrowedUsd: totalBorrowed,
      healthFactor: displayHealthFactor,
      hasProfileAvatar: Boolean(displayAvatar?.trim()),
    };
  }, [
    displayAddress,
    isViewOnly,
    totalCollateral,
    totalBorrowed,
    displayHealthFactor,
    displayAvatar,
  ]);

  /** Which lending market the headline HF refers to (worst pool or tightest at-risk deposit). */
  const positionOverviewMarketLine = useMemo(() => {
    const useAtRisk =
      lowestAtRiskHealthFactor !== null &&
      (healthFactor === null || lowestAtRiskHealthFactor < healthFactor);
    if (
      useAtRisk &&
      atRiskAssets.length > 0 &&
      lowestAtRiskHealthFactor !== null
    ) {
      const minR = lowestAtRiskHealthFactor;
      const tied = atRiskAssets.filter(
        (a) => Math.abs(a.riskRatio - minR) < 1e-5
      );
      const lines = tied
        .map((a) =>
          formatUserMarketLine(
            (a as ItemWithNetwork).network ?? undefined,
            a.poolId
          )
        )
        .filter((x): x is string => Boolean(x));
      const uniq = [...new Set(lines)];
      if (uniq.length === 1) return uniq[0];
      if (uniq.length > 1) return uniq.join(" · ");
    }
    if (hfWorstPoolId && hfWorstNetwork) {
      const line = formatUserMarketLine(hfWorstNetwork, hfWorstPoolId);
      if (line) return line;
    }
    const poolLines = new Map<string, string>();
    for (const d of deposits) {
      const net = (d as ItemWithNetwork).network;
      const pid = d.poolId;
      if (!net || !pid) continue;
      const line = formatUserMarketLine(net, pid);
      if (line) poolLines.set(`${net}::${String(pid)}`, line);
    }
    if (poolLines.size === 1) return [...poolLines.values()][0];
    if (poolLines.size > 1) return "Multiple markets";
    return null;
  }, [
    lowestAtRiskHealthFactor,
    healthFactor,
    atRiskAssets,
    hfWorstPoolId,
    hfWorstNetwork,
    deposits,
  ]);

  // Calculate Net LTV (Loan-to-Value ratio)
  const netLTV =
    totalCollateral > 0 ? (totalBorrowed / totalCollateral) * 100 : 0;

  // Calculate liquidation margins for all networks and find the lowest
  // This represents the most critical safety buffer across all networks
  const calculateLowestLiquidationMargin = (): number => {
    if (
      !user?.computed?.networkValues ||
      Object.keys(user.computed.networkValues).length === 0
    ) {
      // Fallback to global calculation if no network data
      return totalCollateral > 0
        ? weightedLiquidationThreshold * 100 - netLTV
        : 0;
    }

    const networkLiquidationMargins = Object.entries(
      user.computed.networkValues
    ).map(([network, values]: [string, unknown]) => {
      const networkCollateral = values.collateral || 0;
      const networkBorrow = values.borrow || 0;

      // Find minimum liquidation threshold for markets with deposits in this network
      const networkDeposits = deposits.filter((deposit) => {
        const depositNetwork = (deposit as ItemWithNetwork).network;
        if (!depositNetwork) return false;
        const normalized = depositNetwork.toLowerCase();
        const normalizedNetwork = network.toLowerCase();
        return normalized.includes(normalizedNetwork.split("-")[0]);
      });

      let networkLiquidationThreshold = weightedLiquidationThreshold;
      if (networkDeposits.length > 0) {
        const liquidationThresholds: number[] = [];
        networkDeposits.forEach((deposit) => {
          const market = marketRowForPortfolioPosition(marketData, {
            marketId: (deposit as ItemWithNetwork).marketId,
            poolId: deposit.poolId,
            displaySymbol: deposit.asset,
          });
          const threshold =
            market?.liquidationThreshold ??
            (market as { marketInfo?: { liquidationThreshold?: unknown } })
              ?.marketInfo?.liquidationThreshold ??
            0.85;
          const thresholdNum =
            typeof threshold === "string"
              ? parseFloat(threshold)
              : typeof threshold === "bigint"
                ? Number(threshold)
                : threshold;
          liquidationThresholds.push(thresholdNum);
        });
        if (liquidationThresholds.length > 0) {
          networkLiquidationThreshold = Math.min(...liquidationThresholds);
        }
      }

      // Calculate network LTV and liquidation margin
      const networkLTV =
        networkCollateral > 0 ? (networkBorrow / networkCollateral) * 100 : 0;
      const networkLiquidationMargin =
        networkCollateral > 0
          ? networkLiquidationThreshold * 100 - networkLTV
          : 0;

      return networkLiquidationMargin;
    });

    // Return the lowest liquidation margin across all networks
    return networkLiquidationMargins.length > 0
      ? Math.min(...networkLiquidationMargins)
      : totalCollateral > 0
        ? weightedLiquidationThreshold * 100 - netLTV
        : 0;
  };

  // Liquidation margin = lowest across all networks
  // This represents the most critical safety buffer before liquidation
  const liquidationMargin = calculateLowestLiquidationMargin();

  // Transform deposits and borrows for the success modal
  const modalDeposits = useMemo(() => {
    return deposits
      .filter((deposit) => deposit.value > 0)
      .map((deposit) => ({
        asset: deposit.asset,
        icon: deposit.icon,
        iconBadgeUrl: (deposit as { iconBadgeUrl?: string }).iconBadgeUrl,
        value: deposit.value,
        apy:
          deposit.apy +
          getRewardsBonusSupplyAprPercent(
            (deposit as ItemWithNetwork).network ?? currentNetwork,
            (deposit as ItemWithNetwork).configSymbol ??
              (deposit as ItemWithNetwork).originalSymbol ??
              deposit.asset,
            deposit.poolId != null ? String(deposit.poolId) : undefined,
            rewardsAprByBaseUrl
          ),
      }));
  }, [deposits, rewardsAprByBaseUrl, currentNetwork]);

  const modalBorrows = useMemo(() => {
    return borrows
      .filter((borrow) => borrow.value > 0)
      .map((borrow) => ({
        asset: borrow.asset,
        icon: borrow.icon,
        iconBadgeUrl: (borrow as { iconBadgeUrl?: string }).iconBadgeUrl,
        value: borrow.value,
        apy: borrow.apy,
      }));
  }, [borrows]);

  // Calculate risk factor for each borrow position
  const calculatePositionRiskFactor = (borrow: Record<string, unknown>) => {
    if (!borrow.value || borrow.value <= 0 || totalCollateral === 0) return 0;

    // Risk factor = (borrow value / total collateral) * (1 / health factor)
    // Higher risk factor = more dangerous position
    const positionWeight = borrow.value / totalCollateral;
    const healthFactorContribution =
      healthFactor !== null && healthFactor > 0 ? 1 / healthFactor : 10; // High risk if HF is low or null
    return positionWeight * healthFactorContribution;
  };

  // Filter and sort borrows by risk factor
  const riskyBorrows = borrows
    .filter((borrow) => borrow.value > 0) // Only positions with actual borrows
    .map((borrow) => ({
      ...borrow,
      riskFactor: calculatePositionRiskFactor(borrow),
    }))
    .sort((a, b) => b.riskFactor - a.riskFactor); // Sort by risk factor descending

  // Debug logging
  console.log("Portfolio Debug:", {
    totalCollateral,
    totalBorrowed,
    usingComputedValues: user?.computed !== undefined,
    globalNetPortfolioValue: user?.computed?.globalNetPortfolioValue,
    networkValues: user?.computed?.networkValues,
    weightedLiquidationThreshold,
    netLTV,
    liquidationMargin,
    marketDataLength: marketData.length,
    riskyBorrows: riskyBorrows.map((b) => ({
      asset: b.asset,
      riskFactor: b.riskFactor.toFixed(3),
    })),
  });

  // Fetch wallet balance for a specific asset (same as MarketsTable)
  const fetchWalletBalance = async (
    asset: string,
    networkId?: string,
    doFetch?: boolean,
    opts?: { poolId?: string; marketId?: string; configSymbol?: string }
  ) => {
    if (!displayAddress) {
      return { balance: 0, balanceUSD: 0, lastUpdated: Date.now() };
    }

    // Use provided network or fallback to current network
    const networkToUse = networkId || currentNetwork;

    if (!networkToUse) {
      return { balance: 0, balanceUSD: 0, lastUpdated: Date.now() };
    }

    const legacyKey = `${networkToUse}-${asset}`;
    const preliminaryKey = portfolioWalletBalanceCacheKey(networkToUse, {
      marketId: opts?.marketId,
      poolId: opts?.poolId,
      configSymbol: opts?.configSymbol,
      displaySymbol: asset,
    });
    console.log("[Portfolio] fetchWalletBalance cache check:", {
      asset,
      networkId,
      networkToUse,
      preliminaryKey,
      legacyKey,
      cached:
        !!walletBalances[preliminaryKey] ||
        (!!walletBalances[legacyKey] && preliminaryKey === legacyKey),
    });
    const cachedEarly =
      walletBalances[preliminaryKey] ||
      (preliminaryKey === legacyKey ? walletBalances[legacyKey] : undefined);
    if (cachedEarly && !doFetch) {
      console.log("[Portfolio] Using cached balance:", cachedEarly);
      return cachedEarly;
    }

    try {
      console.log("[Portfolio] Fetching fresh balance for:", {
        asset,
        networkToUse,
        opts,
      });
      const tokens = getAllTokensWithDisplayInfo(networkToUse as NetworkId);
      const token = resolveSupplyBorrowToken(
        tokens,
        asset,
        opts?.poolId,
        opts?.configSymbol,
        opts?.marketId
      );

      console.log("token", token);

      if (!token) {
        console.error(
          `Token ${asset} not found in network config for network: ${networkToUse}`
        );
        return { balance: 0, balanceUSD: 0, lastUpdated: Date.now() };
      }

      // Keys must match {@link PortfolioModals} / `refreshWalletBalance`: same fields as
      // `depositModal` (opts). Do not fall back to `token.underlyingContractId` or
      // `token.configKey` when opts omit them — that produced `m:…|p:…` or `c:USDC|p:…`
      // while the modal used `s:USDC|p:…` (display + pool only), so balance read as 0.
      const optMid =
        opts?.marketId != null && String(opts.marketId).trim() !== ""
          ? String(opts.marketId)
          : undefined;
      const optPid =
        opts?.poolId != null && String(opts.poolId).trim() !== ""
          ? String(opts.poolId)
          : token.poolId != null && String(token.poolId).trim() !== ""
            ? String(token.poolId)
            : undefined;
      const optCfg =
        opts?.configSymbol != null && String(opts.configSymbol).trim() !== ""
          ? String(opts.configSymbol)
          : undefined;

      const cacheKey = portfolioWalletBalanceCacheKey(networkToUse, {
        marketId: optMid,
        poolId: optPid,
        configSymbol: optCfg,
        displaySymbol: asset,
      });

      if (walletBalances[cacheKey] && !doFetch) {
        return walletBalances[cacheKey];
      }

      // Get the original token config to access tokenStandard
      const configLookupKey =
        token.configKey ??
        ("originalSymbol" in token
          ? (token as ItemWithNetwork).originalSymbol
          : asset);
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse as NetworkId,
        configLookupKey
      );
      console.log("originalTokenConfigRaw", { originalTokenConfigRaw, token });
      if (!originalTokenConfigRaw) {
        console.error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
        return { balance: 0, balanceUSD: 0, lastUpdated: Date.now() };
      }

      // Handle array of token configs (multiple markets)
      // For multi-market tokens, find the one matching the token's poolId
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
          (tc) => String(tc.poolId) === String(token.poolId)
        ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      // Initialize ARC200Service with clients for the specific network
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as NetworkId
      );
      let clients;
      if (algorandNetwork) {
        // Use the specific network's clients
        clients = await algorandService.initializeClientsForReads(
          algorandNetwork
        );
      } else {
        // Fallback to current network if conversion fails
        console.warn(
          `Could not convert networkId ${networkToUse} to AlgorandNetwork, using current network`
        );
        clients = await algorandService.getCurrentClientsForReads();
      }
      ARC200Service.initialize(clients);

      const bypassRpc = doFetch === true;
      if (
        tokenStandardUsesNativeWalletBalance(originalTokenConfig.tokenStandard) ||
        originalTokenConfig.tokenStandard === "asa-asa" ||
        originalTokenConfig.tokenStandard === "asa" ||
        originalTokenConfig.tokenStandard === "network-asa" ||
        originalTokenConfig.tokenStandard === "arc200-exchange"
      ) {
        try {
          await getCachedAccountInformation(clients.algod, displayAddress, {
            bypassCache: bypassRpc,
          });
        } catch {
          // Paths below still attempt their own reads.
        }
      }

      let balance = 0;

      // Debug: Log token config details
      console.log("[Portfolio] Token config for balance fetch:", {
        asset,
        networkToUse,
        tokenStandard: originalTokenConfig.tokenStandard,
        underlyingContractId: token.underlyingContractId,
        underlyingAssetId: token.underlyingAssetId,
        poolId: token.poolId,
      });

      // Handle different token standards
      if (
        originalTokenConfig.tokenStandard === "arc200" &&
        token.underlyingContractId
      ) {
        // Fetch ARC200 token balance
        console.log(
          `Fetching ARC200 balance for ${asset} (contract: ${token.underlyingContractId})`
        );
        if (bypassRpc) {
          invalidateWalletBalanceRpc(displayAddress);
        }
        const arc200Balance = await ARC200Service.getBalance(
          displayAddress,
          token.underlyingContractId
        );
        console.log("arc200Balance", { arc200Balance });

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
        console.log(`[Portfolio] Entering network token balance fetch for ${asset}`, {
          tokenStandard: originalTokenConfig.tokenStandard,
          displayAddress,
          networkToUse,
        });
        console.log(`Fetching network token balance for ${asset}`);
        try {
          const accountInfo = await getCachedAccountInformation(
            clients.algod,
            displayAddress,
            { bypassCache: bypassRpc }
          );
          console.log("accountInfo", accountInfo);
          balance = spendableAlgoHumanFromAccount(accountInfo);
          console.log(`Network token balance for ${asset}: ${balance}`);
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
        // Folks `asa-asa`: wallet holds the row ASA (e.g. USDC), not the network coin.
        const assetId = parseInt(String(originalTokenConfig.assetId).trim(), 10);
        console.log(
          `Fetching ASA balance for ${asset} (asa-asa asset ID: ${assetId})`
        );
        try {
          const atomic = await getCachedAsaHoldingAtomic(
            clients.algod,
            displayAddress,
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
            displayAddress,
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
            displayAddress,
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

      // Calculate USD value using market data
      // Note: marketData might only contain current network's data
      // For cross-network balances, we might need to fetch market data separately
      const market = marketRowForPortfolioPosition(marketData, {
        marketId: token.underlyingContractId,
        poolId: token.poolId,
        displaySymbol: asset,
      });
      const tokenPrice = resolvePortfolioPositionUsdPerToken({
        market,
        tokenDecimals: token.decimals,
        networkId: networkToUse as NetworkId,
        poolId: token.poolId,
        marketId: token.underlyingContractId,
        configKey: (token as { configKey?: string }).configKey,
        originalSymbol: (token as { originalSymbol?: string }).originalSymbol,
        displaySymbol: asset,
        marketRows: marketData,
      });

      //console.log({ market, tokenPrice, marketData, asset });

      const balanceUSD = balance * tokenPrice;

      const balanceData = {
        balance,
        balanceUSD,
        lastUpdated: Date.now(),
      };

      setWalletBalances((prev) => ({
        ...prev,
        [cacheKey]: balanceData,
        ...(cacheKey === legacyKey ? { [legacyKey]: balanceData } : {}),
        [asset]: balanceData,
      }));

      console.log(
        `[Portfolio] Final balance data for ${asset} on ${networkToUse}:`,
        {
          balanceData,
          cacheKey,
          stored: true,
        }
      );
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0, lastUpdated: Date.now() };
    }
  };

  // Refresh wallet balance for a specific asset
  const refreshWalletBalance = useCallback(
    async (
      asset: string,
      networkId?: string,
      opts?: { poolId?: string; marketId?: string; configSymbol?: string }
    ) => {
      if (!activeAccount?.address) return;

      const nid = (networkId || currentNetwork) as string;
      if (!nid) return;

      try {
        const primary = portfolioWalletBalanceCacheKey(nid, {
          marketId: opts?.marketId,
          poolId: opts?.poolId,
          configSymbol: opts?.configSymbol,
          displaySymbol: asset,
        });
        const legacy = `${nid}-${asset}`;
        setWalletBalances((prev) => {
          const newBalances = { ...prev };
          delete newBalances[primary];
          delete newBalances[legacy];
          delete newBalances[asset];
          return newBalances;
        });

        await fetchWalletBalance(asset, networkId, true, opts);
      } catch (error) {
        console.error("Error refreshing wallet balance:", error);
      }
    },

    [activeAccount?.address, currentNetwork]
  );

  // Function to sync user markets for price change (required in view-only mode)
  const syncUserMarketsForPriceChange = useCallback(
    async (userAddress: string, poolId?: string, marketId?: string) => {
      if (!signTransactions || !activeAccount?.address) {
        throw new Error("Wallet not connected");
      }

      if (!poolId) {
        console.log("[Portfolio] No poolId provided for sync");
        return;
      }

      try {
        await signAndSendSyncUserMarketsForPriceChangeTx(
          userAddress,
          poolId,
          marketId,
          activeAccount.address,
          signTransactions
        );
        console.log("[Portfolio] Markets synced successfully");
      } catch (error) {
        console.error("[Portfolio] Error syncing markets:", error);
        throw error;
      }
    },
    [signTransactions, activeAccount?.address]
  );

  // Function to refresh positions data
  const handleRefreshPositions = async () => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingPositions(true);
    try {
      // fetch market from node api for accurate position info
      // Fetch fresh market data and global data first
      const markets = await fetchAllMarkets(currentNetwork, {
        excludeMarketsTableHidden: true,
      });
      // const marketDataResponse =
      //   await dorkfiAPIService.getAllMarketDataByNetwork(currentNetwork);
      // const freshMarketData = marketDataResponse.success
      //   ? marketDataResponse.data
      //   : [];
      const marketData = markets;

      if (!displayAddress) {
        setIsLoadingPositions(false);
        return;
      }

      const freshGlobalData = await fetchUserGlobalData(
        displayAddress,
        currentNetwork,
        marketData
      );

      // Fetch user positions from all enabled networks (not just currentNetwork)
      // This ensures VOI items don't disappear when doing Algorand transactions
      const enabledNetworks = getEnabledNetworks();
      const networkPositionResults = await Promise.all(
        enabledNetworks.map(async (networkId) => {
          try {
            const networkMarkets = filterPortfolioVisibleMarketRows(
              networkId as NetworkId,
              await fetchAllMarkets(networkId)
            );
            return await fetchUserPositions(
              displayAddress,
              networkId,
              networkMarkets
            );
          } catch (error) {
            console.error(
              `Error fetching positions for network ${networkId}:`,
              error
            );
            return [];
          }
        })
      );
      const allPositions = networkPositionResults.flat();

      setMarketData((prev) => mergePortfolioMarketRows(prev, marketData));
      setUserPositions(allPositions);
      setUserGlobalData(freshGlobalData);
    } catch (error) {
      console.error("Error refreshing positions:", error);
      setDataError("Failed to refresh positions data");
    } finally {
      setIsLoadingPositions(false);
    }
  };

  // Function to refresh all markets via POST requests
  const handleRefreshMarkets = useCallback(async () => {
    if (isRefreshingMarkets) return;

    setIsRefreshingMarkets(true);
    try {
      // In view-only mode, sync markets first (sync all markets from all pools)
      if (isViewOnly && displayAddress && signTransactions) {
        try {
          toast({
            title: "Syncing Markets",
            description:
              "Please sign the transaction to sync markets before refreshing...",
            duration: 3000,
          });
          // Get all unique poolIds from deposits and borrows
          const allPoolIds = new Set<string>();
          deposits.forEach((deposit) => {
            if (deposit.balance > 0 && deposit.poolId) {
              allPoolIds.add(deposit.poolId);
            }
          });
          borrows.forEach((borrow) => {
            if (borrow.balance > 0 && borrow.poolId) {
              allPoolIds.add(borrow.poolId);
            }
          });
          // Sync each poolId (will sync all markets in each pool)
          for (const poolId of allPoolIds) {
            await syncUserMarketsForPriceChange(displayAddress, poolId);
          }
          toast({
            title: "Markets Synced",
            description: "Markets synced successfully. Refreshing data...",
            duration: 2000,
          });
        } catch (error) {
          console.error("[Portfolio] Failed to sync markets:", error);
          toast({
            title: "Sync Failed",
            description: "Failed to sync markets. Refresh cancelled.",
            variant: "destructive",
            duration: 3000,
          });
          setIsRefreshingMarkets(false);
          return;
        }
      }
      const enabledNetworks = getEnabledNetworks();
      let refreshedCount = 0;
      let failedCount = 0;

      // Refresh markets for all enabled networks
      for (const networkId of enabledNetworks) {
        try {
          const tokens = getAllTokensWithDisplayInfo(networkId as NetworkId);

          // Refresh each market
          for (const token of tokens) {
            if (!token.poolId || !token.underlyingContractId) continue;

            try {
              const appId = parseInt(token.poolId);
              const marketId = parseInt(token.underlyingContractId);

              console.log(
                `[Portfolio] Refreshing market data for ${token.symbol} (appId: ${appId}, marketId: ${marketId}, network: ${networkId})`
              );

              const result = await dorkfiAPIService.fetchFreshMarketData(
                networkId,
                appId,
                marketId
              );

              if (result.success) {
                refreshedCount++;
              } else {
                failedCount++;
                console.warn(
                  `[Portfolio] Failed to refresh market ${token.symbol}:`,
                  result.error
                );
              }
            } catch (error) {
              failedCount++;
              console.error(
                `[Portfolio] Error refreshing market ${token.symbol}:`,
                error
              );
            }
          }
        } catch (error) {
          console.error(
            `[Portfolio] Error processing network ${networkId}:`,
            error
          );
        }
      }

      console.log(
        `[Portfolio] Market refresh complete: ${refreshedCount} succeeded, ${failedCount} failed`
      );

      // Show toast notification
      if (refreshedCount > 0) {
        toast({
          title: "Markets Refreshed",
          description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
            }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          duration: 3000,
        });
      } else {
        toast({
          title: "Refresh Failed",
          description: "Failed to refresh market data. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }

      // Refresh user data after markets are updated (only if not in view-only mode)
      if (displayAddress && refreshedCount > 0 && !isViewOnly) {
        setTimeout(() => {
          fetchUser(displayAddress);
        }, 1000);
      } else if (isViewOnly && refreshedCount > 0) {
        // In view-only mode, just refresh the displayed data without triggering user API refresh
        setTimeout(() => {
          handleRefreshPositions();
        }, 1000);
      }
    } catch (error) {
      console.error("[Portfolio] Error refreshing markets:", error);
      toast({
        title: "Refresh Error",
        description: "An error occurred while refreshing markets.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsRefreshingMarkets(false);
    }
     
  }, [
    isRefreshingMarkets,
    displayAddress,
    toast,
    isViewOnly,
    signTransactions,
    syncUserMarketsForPriceChange,
  ]);

  // Function to refresh markets for a specific section
  const handleRefreshSectionMarkets = useCallback(
    async (
      items: Array<{ asset: string; poolId?: string; network?: string }>,
      sectionName: string
    ) => {
      if (refreshingSection === sectionName) return;

      setRefreshingSection(sectionName);
      try {
        let refreshedCount = 0;
        let failedCount = 0;

        // Get unique markets from items
        const marketKeys = new Set<string>();
        const marketIdsToSync = new Set<string>();
        items.forEach((item) => {
          const networkToUse = item.network || currentNetwork;
          const key = `${item.asset}-${item.poolId || "default"
            }-${networkToUse}`;
          marketKeys.add(key);
          if (item.poolId) {
            marketIdsToSync.add(item.poolId);
          }
        });

        // In view-only mode, sync only the markets in this section first
        if (
          isViewOnly &&
          displayAddress &&
          signTransactions &&
          marketIdsToSync.size > 0
        ) {
          try {
            // Sync each poolId (will sync all markets in each pool)
            for (const poolIdToSync of marketIdsToSync) {
              await syncUserMarketsForPriceChange(displayAddress, poolIdToSync);
            }
          } catch (error) {
            console.error("[Portfolio] Failed to sync markets:", error);
            toast({
              title: "Sync Failed",
              description: "Failed to sync markets. Refresh cancelled.",
              variant: "destructive",
              duration: 3000,
            });
            setRefreshingSection(null);
            return;
          }
        }

        // Refresh each unique market
        for (const key of marketKeys) {
          const [asset, poolId, networkId] = key.split("-");
          const networkToUse = (networkId || currentNetwork) as NetworkId;
          const actualPoolId = poolId === "default" ? undefined : poolId;

          try {
            const tokens = getAllTokensWithDisplayInfo(networkToUse);
            const token = actualPoolId
              ? tokens.find(
                (t) => t.symbol === asset && t.poolId === actualPoolId
              )
              : tokens.find((t) => t.symbol === asset);

            if (!token?.poolId || !token?.underlyingContractId) {
              console.warn(
                `[Portfolio] Cannot refresh market: token not found for ${asset}${actualPoolId ? ` with poolId ${actualPoolId}` : ""
                } on network ${networkToUse}`
              );
              continue;
            }

            const appId = parseInt(token.poolId);
            const marketId = parseInt(token.underlyingContractId);

            console.log(
              `[Portfolio] Refreshing market data for ${asset} (appId: ${appId}, marketId: ${marketId}, network: ${networkToUse})`
            );

            const result = await dorkfiAPIService.fetchFreshMarketData(
              networkToUse,
              appId,
              marketId
            );

            if (result.success) {
              refreshedCount++;
            } else {
              failedCount++;
              console.warn(
                `[Portfolio] Failed to refresh market ${asset}:`,
                result.error
              );
            }
          } catch (error) {
            failedCount++;
            console.error(
              `[Portfolio] Error refreshing market ${asset}:`,
              error
            );
          }
        }

        console.log(
          `[Portfolio] ${sectionName} market refresh complete: ${refreshedCount} succeeded, ${failedCount} failed`
        );

        // Show toast notification
        if (refreshedCount > 0) {
          toast({
            title: `${sectionName} Refreshed`,
            description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
              }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
            duration: 3000,
          });
        } else {
          toast({
            title: "Refresh Failed",
            description: `Failed to refresh ${sectionName.toLowerCase()} market data. Please try again.`,
            variant: "destructive",
            duration: 3000,
          });
        }

        // Refresh user data after markets are updated (only if not in view-only mode)
        if (displayAddress && refreshedCount > 0 && !isViewOnly) {
          setTimeout(() => {
            fetchUser(displayAddress);
          }, 1000);
        } else if (isViewOnly && refreshedCount > 0) {
          // In view-only mode, refresh positions data without API user refresh
          setTimeout(() => {
            handleRefreshPositions();
          }, 1000);
        }
      } catch (error) {
        console.error(
          `[Portfolio] Error refreshing ${sectionName} markets:`,
          error
        );
        toast({
          title: "Refresh Error",
          description: `An error occurred while refreshing ${sectionName.toLowerCase()} markets.`,
          variant: "destructive",
          duration: 3000,
        });
      } finally {
        setRefreshingSection(null);
      }
    },
    [
      refreshingSection,
      currentNetwork,
      displayAddress,
      toast,
      isViewOnly,
      signTransactions,
      syncUserMarketsForPriceChange,
    ]
  );

  // Function to refresh a single market
  const handleRefreshSingleMarket = useCallback(
    async (asset: string, poolId?: string, networkId?: string) => {
      const marketKey = `${asset}-${poolId || "default"}-${networkId || currentNetwork
        }`;

      if (refreshingMarket === marketKey) return;

      setRefreshingMarket(marketKey);
      try {
        const networkToUse = (networkId || currentNetwork) as NetworkId;
        const tokens = getAllTokensWithDisplayInfo(networkToUse);

        // Find the token that matches both symbol and poolId if provided
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (!token?.poolId || !token?.underlyingContractId) {
          console.warn(
            `[Portfolio] Cannot refresh market: token not found for ${asset}${poolId ? ` with poolId ${poolId}` : ""
            } on network ${networkToUse}`
          );
          return;
        }

        const appId = parseInt(token.poolId);
        const marketId = parseInt(token.underlyingContractId);

        // In view-only mode, sync this specific market first
        if (
          isViewOnly &&
          displayAddress &&
          signTransactions &&
          poolId &&
          marketId
        ) {
          try {
            await syncUserMarketsForPriceChange(
              displayAddress,
              poolId,
              marketId.toString()
            );
          } catch (error) {
            console.error("[Portfolio] Failed to sync market:", error);
            toast({
              title: "Sync Failed",
              description: "Failed to sync market. Refresh cancelled.",
              variant: "destructive",
              duration: 3000,
            });
            setRefreshingMarket(null);
            return;
          }
        }

        console.log(
          `[Portfolio] Refreshing market data for ${asset} (appId: ${appId}, marketId: ${marketId}, network: ${networkToUse})`
        );

        // POST request to fetch fresh market data and update market in app
        const result = await dorkfiAPIService.fetchFreshMarketData(
          networkToUse,
          appId,
          marketId
        );

        if (result.success) {
          console.log(
            `[Portfolio] Successfully refreshed market data for ${asset}:`,
            result.data
          );
          toast({
            title: "Market Refreshed",
            description: `Successfully refreshed ${asset} market data`,
            duration: 2000,
          });

          // Refresh user data after market is updated (only if not in view-only mode)
          if (displayAddress && !isViewOnly) {
            setTimeout(() => {
              fetchUser(displayAddress);
            }, 500);
          } else if (isViewOnly) {
            // In view-only mode, refresh positions data without API user refresh
            setTimeout(() => {
              handleRefreshPositions();
            }, 500);
          }
        } else {
          console.warn(
            `[Portfolio] Failed to refresh market data for ${asset}:`,
            result.error
          );
          toast({
            title: "Refresh Failed",
            description: `Failed to refresh ${asset} market data`,
            variant: "destructive",
            duration: 2000,
          });
        }
      } catch (error) {
        console.error(
          `[Portfolio] Error refreshing market data for ${asset}:`,
          error
        );
        toast({
          title: "Refresh Error",
          description: `An error occurred while refreshing ${asset}`,
          variant: "destructive",
          duration: 2000,
        });
      } finally {
        setRefreshingMarket(null);
      }
    },
    [
      refreshingMarket,
      currentNetwork,
      activeAccount?.address,
      toast,
      isViewOnly,
      displayAddress,
      signTransactions,
      syncUserMarketsForPriceChange,
    ]
  );

  // Function to refresh markets for Supplied Assets section
  const handleRefreshSuppliedAssets = useCallback(async () => {
    if (refreshingSection === "Supplied Assets" || deposits.length === 0)
      return;

    setRefreshingSection("Supplied Assets");
    try {
      let refreshedCount = 0;
      let failedCount = 0;

      for (const deposit of deposits) {
        try {
          const networkToUse = ((deposit as ItemWithNetwork).network ||
            currentNetwork) as NetworkId;
          const tokens = getAllTokensWithDisplayInfo(networkToUse);

          const mid = (deposit as ItemWithNetwork).marketId;
          const token =
            mid && deposit.poolId
              ? tokens.find(
                (t) =>
                  String(t.underlyingContractId) === String(mid) &&
                  String(t.poolId) === String(deposit.poolId)
                )
              : deposit.poolId
                ? tokens.find(
                  (t) =>
                    t.symbol === deposit.asset &&
                    String(t.poolId) === String(deposit.poolId)
                )
                : tokens.find((t) => t.symbol === deposit.asset);

          if (!token?.poolId || !token?.underlyingContractId) continue;

          const appId = parseInt(token.poolId);
          const marketId = parseInt(token.underlyingContractId);

          const result = await dorkfiAPIService.fetchFreshMarketData(
            networkToUse,
            appId,
            marketId
          );

          if (result.success) {
            refreshedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          console.error(`Error refreshing market for ${deposit.asset}:`, error);
        }
      }

      if (refreshedCount > 0) {
        toast({
          title: "Supplied Assets Refreshed",
          description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
            }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          duration: 2000,
        });

        if (displayAddress && !isViewOnly) {
          setTimeout(() => {
            fetchUser(displayAddress);
          }, 500);
        } else if (isViewOnly) {
          setTimeout(() => {
            handleRefreshPositions();
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error refreshing supplied assets:", error);
      toast({
        title: "Refresh Error",
        description: "An error occurred while refreshing markets",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setRefreshingSection(null);
    }
  }, [deposits, currentNetwork, refreshingSection, displayAddress, toast]);

  // Function to refresh markets for Borrowed Assets section
  const handleRefreshBorrowedAssets = useCallback(async () => {
    if (refreshingSection === "Borrowed Assets" || borrows.length === 0) return;

    setRefreshingSection("Borrowed Assets");
    try {
      let refreshedCount = 0;
      let failedCount = 0;

      for (const borrow of borrows) {
        try {
          const networkToUse = ((borrow as ItemWithNetwork).network ||
            currentNetwork) as NetworkId;
          const tokens = getAllTokensWithDisplayInfo(networkToUse);

          const bMid = (borrow as ItemWithNetwork).marketId;
          const token =
            bMid && borrow.poolId
              ? tokens.find(
                (t) =>
                  String(t.underlyingContractId) === String(bMid) &&
                  String(t.poolId) === String(borrow.poolId)
                )
              : borrow.poolId
                ? tokens.find(
                  (t) =>
                    t.symbol === borrow.asset &&
                    String(t.poolId) === String(borrow.poolId)
                )
                : tokens.find((t) => t.symbol === borrow.asset);

          if (!token?.poolId || !token?.underlyingContractId) continue;

          const appId = parseInt(token.poolId);
          const marketId = parseInt(token.underlyingContractId);

          const result = await dorkfiAPIService.fetchFreshMarketData(
            networkToUse,
            appId,
            marketId
          );

          if (result.success) {
            refreshedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          console.error(`Error refreshing market for ${borrow.asset}:`, error);
        }
      }

      if (refreshedCount > 0) {
        toast({
          title: "Borrowed Assets Refreshed",
          description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
            }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          duration: 2000,
        });

        if (displayAddress && !isViewOnly) {
          setTimeout(() => {
            fetchUser(displayAddress);
          }, 500);
        } else if (isViewOnly) {
          setTimeout(() => {
            handleRefreshPositions();
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error refreshing borrowed assets:", error);
      toast({
        title: "Refresh Error",
        description: "An error occurred while refreshing markets",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setRefreshingSection(null);
    }
  }, [
    borrows,
    currentNetwork,
    refreshingSection,
    activeAccount?.address,
    toast,
  ]);

  // Function to refresh markets for Accrued Interest section
  const handleRefreshAccruedInterest = useCallback(async () => {
    if (
      refreshingSection === "Accrued Interest" ||
      accruedInterestItems.length === 0
    )
      return;

    setRefreshingSection("Accrued Interest");
    try {
      let refreshedCount = 0;
      let failedCount = 0;

      for (const item of accruedInterestItems) {
        try {
          const networkToUse = ((item as ItemWithNetwork).network ||
            currentNetwork) as NetworkId;
          const tokens = getAllTokensWithDisplayInfo(networkToUse);

          const token = item.poolId
            ? tokens.find(
              (t) => t.symbol === item.asset && t.poolId === item.poolId
            )
            : tokens.find((t) => t.symbol === item.asset);

          if (!token?.poolId || !token?.underlyingContractId) continue;

          const appId = parseInt(token.poolId);
          const marketId = parseInt(token.underlyingContractId);

          const result = await dorkfiAPIService.fetchFreshMarketData(
            networkToUse,
            appId,
            marketId
          );

          if (result.success) {
            refreshedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          console.error(`Error refreshing market for ${item.asset}:`, error);
        }
      }

      if (refreshedCount > 0) {
        toast({
          title: "Accrued Interest Refreshed",
          description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
            }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          duration: 2000,
        });

        if (displayAddress && !isViewOnly) {
          setTimeout(() => {
            fetchUser(displayAddress);
          }, 500);
        } else if (isViewOnly) {
          setTimeout(() => {
            handleRefreshPositions();
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error refreshing accrued interest:", error);
      toast({
        title: "Refresh Error",
        description: "An error occurred while refreshing markets",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setRefreshingSection(null);
    }
  }, [
    accruedInterestItems,
    currentNetwork,
    refreshingSection,
    activeAccount?.address,
    toast,
  ]);

  // Function to refresh markets for At Risk Assets section
  const handleRefreshAtRiskAssets = useCallback(async () => {
    if (refreshingSection === "At Risk Assets" || atRiskAssets.length === 0)
      return;

    setRefreshingSection("At Risk Assets");
    try {
      let refreshedCount = 0;
      let failedCount = 0;

      for (const asset of atRiskAssets) {
        try {
          const networkToUse = ((asset as ItemWithNetwork).network ||
            currentNetwork) as NetworkId;
          const tokens = getAllTokensWithDisplayInfo(networkToUse);

          const token = asset.poolId
            ? tokens.find(
              (t) => t.symbol === asset.asset && t.poolId === asset.poolId
            )
            : tokens.find((t) => t.symbol === asset.asset);

          if (!token?.poolId || !token?.underlyingContractId) continue;

          const appId = parseInt(token.poolId);
          const marketId = parseInt(token.underlyingContractId);

          const result = await dorkfiAPIService.fetchFreshMarketData(
            networkToUse,
            appId,
            marketId
          );

          if (result.success) {
            refreshedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          console.error(`Error refreshing market for ${asset.asset}:`, error);
        }
      }

      if (refreshedCount > 0) {
        toast({
          title: "At Risk Assets Refreshed",
          description: `Successfully refreshed ${refreshedCount} market${refreshedCount !== 1 ? "s" : ""
            }${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          duration: 2000,
        });

        if (displayAddress && !isViewOnly) {
          setTimeout(() => {
            fetchUser(displayAddress);
          }, 500);
        } else if (isViewOnly) {
          setTimeout(() => {
            handleRefreshPositions();
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error refreshing at risk assets:", error);
      toast({
        title: "Refresh Error",
        description: "An error occurred while refreshing markets",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setRefreshingSection(null);
    }
  }, [
    atRiskAssets,
    currentNetwork,
    refreshingSection,
    activeAccount?.address,
    toast,
  ]);

  const fetchUser = async (userAddress: string) => {
    // Deduplicate concurrent calls for the same address; cancel stale-address results
    if (fetchUserInFlight.current && fetchUserAddressRef.current === userAddress) return;
    fetchUserInFlight.current = true;
    fetchUserAddressRef.current = userAddress;

    const isCurrentFetchUser = () =>
      fetchUserAddressRef.current === userAddress;

    const applyPortfolioComputed = (user: Record<string, unknown>) => {
      if (!isCurrentFetchUser()) return;
      if (!user.globalUserData || !Array.isArray(user.globalUserData)) {
        return;
      }
      console.log(
        "[Portfolio] User data globalUserData:",
        user.globalUserData
      );
      const globalCollateralValue =
        user.globalUserData
          .map((item: Record<string, unknown>) =>
            BigInt(item.totalCollateralValue as string | number)
          )
          .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
        BigInt(1e12);
      console.log(
        "[Portfolio] Global collateral value:",
        globalCollateralValue
      );
      const globalBorrowValue =
        user.globalUserData
          .map((item: Record<string, unknown>) =>
            BigInt(item.totalBorrowValue as string | number)
          )
          .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
        BigInt(1e12);
      console.log("[Portfolio] Global borrow value:", globalBorrowValue);
      const globalNetPortfolioValue = globalCollateralValue - globalBorrowValue;
      console.log(
        "[Portfolio] Global net portfolio value:",
        globalNetPortfolioValue
      );

      const networkValues: Record<
        string,
        {
          collateral: number;
          borrow: number;
          netValue: number;
        }
      > = {};

      user.globalUserData.forEach((item: Record<string, unknown>) => {
        const network = String(item.network || "unknown");
        const collateralValue = Number(
          BigInt(String(item.totalCollateralValue ?? 0)) / BigInt(1e12)
        );
        const borrowValue = Number(
          BigInt(String(item.totalBorrowValue ?? 0)) / BigInt(1e12)
        );
        const netValue = collateralValue - borrowValue;

        if (!networkValues[network]) {
          networkValues[network] = {
            collateral: 0,
            borrow: 0,
            netValue: 0,
          };
        }

        networkValues[network].collateral += collateralValue;
        networkValues[network].borrow += borrowValue;
        networkValues[network].netValue += netValue;
      });

      const deposits: Record<string, unknown>[] = [];
      const borrows: Record<string, unknown>[] = [];
      if (user.userData && Array.isArray(user.userData)) {
        user.userData.forEach((item: Record<string, unknown>) => {
          if (BigInt(String(item.scaledDeposits ?? 0)) > BigInt(0)) {
            deposits.push(item);
          }
          if (BigInt(String(item.scaledBorrows ?? 0)) > BigInt(0)) {
            borrows.push(item);
          }
        });
      }
      const computedUser = {
        ...user,
        computed: {
          globalCollateralValue: Number(globalCollateralValue),
          globalBorrowValue: Number(globalBorrowValue),
          globalNetPortfolioValue: Number(globalNetPortfolioValue),
          networkValues: networkValues,
          deposits,
          borrows,
        },
      };
      console.log("[Portfolio] User:", computedUser);
      if (!isCurrentFetchUser()) return;
      setUser(computedUser);
      console.log("[Portfolio] Network values:", networkValues);
    };

    try {
      console.log(
        `[Portfolio] Attempting to fetch user data from API for ${userAddress}`
      );
      const apiResponse = await dorkfiAPIService.getUser(userAddress);

      console.log("[Portfolio] API response:", apiResponse);

      if (apiResponse.success && apiResponse.data) {
        if (!isCurrentFetchUser()) return;
        const user = apiResponse.data as Record<string, unknown>;
        console.log("[Portfolio] User data fetched from API:", user);

        if (user.avatar || user.avatarImage || user.profileImage) {
          const avatarUrl =
            (user.avatar || user.avatarImage || user.profileImage) as string;
          setUserProfileAvatar(avatarUrl);
          console.log("[Portfolio] User profile avatar found:", avatarUrl);
        } else {
          setUserProfileAvatar(null);
        }

        applyPortfolioComputed(user);
        return;
      }

      console.error("Error fetching user data:", apiResponse);

      console.log(
        `[Portfolio] API failed; falling back to chain for ${userAddress}`
      );
      const chain = await fetchUserDataFromChain(userAddress);
      if (chain && isCurrentFetchUser()) {
        setUserProfileAvatar(null);
        applyPortfolioComputed({
          address: userAddress,
          globalUserData: chain.globalUserData,
          userData: chain.userData,
          userDataSource: "chain",
        });
      }
    } catch (error) {
      console.error("Error fetching user global data:", error);
      const chain = await fetchUserDataFromChain(userAddress);
      if (chain && isCurrentFetchUser()) {
        setUserProfileAvatar(null);
        applyPortfolioComputed({
          address: userAddress,
          globalUserData: chain.globalUserData,
          userData: chain.userData,
          userDataSource: "chain",
        });
      }
    } finally {
      // Only clear the in-flight flag if this call is still the current one
      if (fetchUserAddressRef.current === userAddress) {
        fetchUserInFlight.current = false;
      }
    }
  };

  useEffect(() => {
    if (!displayAddress) return;
    // Reset in-flight state when address changes so new address always fetches
    fetchUserInFlight.current = false;
    fetchUserAddressRef.current = null;
    fetchUser(displayAddress);
  }, [displayAddress]);

  // Fast market hydrate: session cache → bulk Phase A (no oracle) → gap-fill
  // position keys → background Phase B oracle refine. Avoids N×(GET+oracle)
  // before Value (USD) / APY can paint.
  useEffect(() => {
    if (!displayAddress) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    const mergeVisible = (incoming: MarketInfo[]) => {
      if (cancelled || incoming.length === 0) return;
      setMarketData((prev) => mergePortfolioMarketRows(prev, incoming));
    };

    const hydrate = async () => {
      try {
        const enabledNetworks = getEnabledNetworks() as NetworkId[];
        const positionKeys = collectPositionMarketKeys([
          ...((user?.computed?.deposits as Record<string, unknown>[]) ?? []),
          ...((user?.computed?.borrows as Record<string, unknown>[]) ?? []),
        ]);

        await Promise.all(
          enabledNetworks.map(async (networkId) => {
            // Instant remount / after Markets visit
            mergeVisible(marketInfosFromMarketsTableSession(networkId));
            const sessionCached = readPortfolioMarketsSessionCache(networkId);
            if (sessionCached?.length) {
              mergeVisible(
                filterPortfolioVisibleMarketRows(networkId, sessionCached)
              );
            }

            let phaseAMarkets: MarketInfo[] = [];
            let refineJobs: Awaited<
              ReturnType<typeof hydratePortfolioNetworkMarketsPhaseA>
            >["refineJobs"] = [];

            try {
              const phaseA =
                await hydratePortfolioNetworkMarketsPhaseA(networkId);
              if (cancelled) return;
              phaseAMarkets = phaseA.markets;
              refineJobs = phaseA.refineJobs;
              mergeVisible(phaseAMarkets);
              // Merge into session so Phase A refresh cannot wipe prior oracle refine.
              const sessionPrev =
                readPortfolioMarketsSessionCache(networkId) ?? [];
              writePortfolioMarketsSessionCache(
                networkId,
                mergePortfolioMarketRows(sessionPrev, phaseAMarkets) as MarketInfo[]
              );
            } catch (error) {
              console.error(
                `[Portfolio] Phase A bulk hydrate failed for ${networkId}:`,
                error
              );
            }

            // Gap-fill only open positions missing from bulk (not the full token list).
            const phaseAKeySet = new Set(
              phaseAMarkets.map(
                (m) => `${m.networkId}|${m.poolId}|${m.marketId}`
              )
            );
            const keysToFill = positionKeys.filter(
              (k) =>
                k.networkId === networkId &&
                !phaseAKeySet.has(`${k.networkId}|${k.poolId}|${k.marketId}`)
            );

            if (keysToFill.length > 0) {
              try {
                const filled = await gapFillPortfolioMarkets(keysToFill);
                if (cancelled) return;
                mergeVisible(filled);
                if (filled.length > 0) {
                  const sessionPrev =
                    readPortfolioMarketsSessionCache(networkId) ?? [];
                  writePortfolioMarketsSessionCache(
                    networkId,
                    mergePortfolioMarketRows(sessionPrev, [
                      ...phaseAMarkets,
                      ...filled,
                    ]) as MarketInfo[]
                  );
                }
              } catch (error) {
                console.error(
                  `[Portfolio] Gap-fill failed for ${networkId}:`,
                  error
                );
              }
            }

            // Phase B: oracle refine — non-blocking; merge never replaces oracle with bulk
            if (refineJobs.length > 0) {
              void refinePortfolioMarketsPhaseB(
                refineJobs,
                (market) => {
                  mergeVisible([market]);
                  const sessionPrev =
                    readPortfolioMarketsSessionCache(networkId) ?? [];
                  writePortfolioMarketsSessionCache(
                    networkId,
                    mergePortfolioMarketRows(sessionPrev, [market]) as MarketInfo[]
                  );
                },
                isCancelled
              );
            }

            console.log("[Portfolio] Bulk market hydrate:", {
              networkId,
              phaseA: phaseAMarkets.length,
              refineJobs: refineJobs.length,
              gapFill: keysToFill.length,
            });
          })
        );
      } catch (error) {
        console.error("Error fetching market data:", error);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.computed, activeAccount?.address, displayAddress]);

  // Fetch user global data and market data when wallet connects
  // useEffect(() => {
  //   const fetchData = async () => {
  //     if (!activeAccount?.address || !currentNetwork) {
  //       setUserGlobalData(null);
  //       setMarketData([]);
  //       return;
  //     }

  //     setIsLoadingData(true);
  //     setDataError(null);

  //     try {
  //       console.log(
  //         "Fetching user global data for:",
  //         activeAccount.address,
  //         "on network:",
  //         currentNetwork
  //       );

  //       // fetch market data from api for faster response on page load
  //       // Fetch markets first, then global data (so we can pass marketData for healthFactorIndex calculation)
  //       const markets = await fetchAllMarkets(currentNetwork);
  //       const tokens = getAllTokensWithDisplayInfo(currentNetwork);
  //       const marketDataResponse =
  //         await dorkfiAPIService.getAllMarketDataByNetwork(currentNetwork);
  //       const freshMarketData = marketDataResponse.success
  //         ? marketDataResponse.data.map((item: any) => {
  //             // Try multiple matching strategies to find the correct token
  //             let token = tokens.find(
  //               (t) =>
  //                 t.originalContractId === `${item.marketId}` &&
  //                 t.poolId === `${item.appId}`
  //             );

  //             // If not found, try matching by underlyingContractId
  //             if (!token) {
  //               token = tokens.find(
  //                 (t) =>
  //                   t.underlyingContractId === `${item.marketId}` &&
  //                   t.poolId === `${item.appId}`
  //               );
  //             }

  //             // If still not found, try matching by poolId and marketId "0" (for network tokens like VOI)
  //             if (!token && item.marketId === "0") {
  //               token = tokens.find(
  //                 (t) =>
  //                   t.poolId === `${item.appId}` &&
  //                   (t.assetId === "0" || t.originalContractId === "0")
  //               );
  //             }

  //             // Log if token not found for debugging
  //             if (!token) {
  //               console.warn(
  //                 `Token not found for marketId ${item.marketId}, appId ${item.appId}`,
  //                 {
  //                   availableTokens: tokens.map((t) => ({
  //                     symbol: t.symbol,
  //                     originalContractId: t.originalContractId,
  //                     underlyingContractId: t.underlyingContractId,
  //                     poolId: t.poolId,
  //                   })),
  //                 }
  //               );
  //             }

  //             return enhanceAVMMarketInfo(item, token as any);
  //           })
  //         : [];
  //       const marketData = markets;

  //       const globalData = await fetchUserGlobalData(
  //         activeAccount.address,
  //         currentNetwork,
  //         marketData
  //       );

  //       // Fetch user positions from all enabled networks
  //       const enabledNetworks = getEnabledNetworks();
  //       const allPositions = [];

  //       for (const networkId of enabledNetworks) {
  //         try {
  //           const networkMarkets = await fetchAllMarkets(networkId);
  //           const networkPositions = await fetchUserPositions(
  //             activeAccount.address,
  //             networkId,
  //             networkMarkets
  //           );
  //           allPositions.push(...networkPositions);
  //         } catch (error) {
  //           console.error(
  //             `Error fetching positions for network ${networkId}:`,
  //             error
  //           );
  //         }
  //       }

  //       console.log({
  //         markets,
  //         freshMarketData,
  //         marketData,
  //         globalData: globalData,
  //         positions: allPositions,
  //       });

  //       if (globalData) {
  //         console.log("User global data fetched:", globalData);
  //         setUserGlobalData(globalData);
  //       } else {
  //         console.log("No user global data found");
  //         setUserGlobalData(null);
  //       }

  //       if (freshMarketData) {
  //         console.log("Market data fetched:", freshMarketData);
  //         setMarketData(freshMarketData);
  //       } else {
  //         console.log("No market data found");
  //         setMarketData([]);
  //       }

  //       if (allPositions && allPositions.length > 0) {
  //         console.log(
  //           "User positions fetched from all networks:",
  //           allPositions
  //         );
  //         setUserPositions(allPositions);
  //       } else {
  //         console.log("No user positions found");
  //         setUserPositions([]);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching data:", error);
  //       setDataError(
  //         error instanceof Error ? error.message : "Failed to fetch data"
  //       );
  //       setUserGlobalData(null);
  //       setMarketData([]);
  //     } finally {
  //       setIsLoadingData(false);
  //     }
  //   };

  //   fetchData();
  // }, [activeAccount?.address, currentNetwork]);

  // Reset supplied list page when filters change
  useEffect(() => {
    setSuppliedAssetsPage(0);
  }, [positionsSearchTerm, positionsNetworkFilter, positionsMarketFilter]);

  // Reset borrowed list page when filters change
  useEffect(() => {
    setBorrowedAssetsPage(0);
  }, [positionsSearchTerm, positionsNetworkFilter, positionsMarketFilter]);

  const positionPassesPortfolioFilters = useCallback(
    (item: { asset: string; poolId?: string; network?: string }) =>
      itemMatchesPortfolioPositionFilters(item, {
        searchTerm: positionsSearchTerm,
        networkFilter: positionsNetworkFilter,
        marketFilter: positionsMarketFilter,
        marketNetworkFallback: currentNetwork,
      }),
    [
      positionsSearchTerm,
      positionsNetworkFilter,
      positionsMarketFilter,
      currentNetwork,
    ]
  );

  const accruedInterestPassesNetworkFilter = useCallback(
    (item: { asset: string; network?: string }) =>
      itemMatchesPortfolioPositionFilters(item, {
        searchTerm: accruedInterestSearchTerm,
        networkFilter: positionsNetworkFilter,
      }),
    [accruedInterestSearchTerm, positionsNetworkFilter]
  );

  const filteredSuppliedCount = useMemo(
    () => deposits.filter(positionPassesPortfolioFilters).length,
    [deposits, positionPassesPortfolioFilters]
  );

  const filteredBorrowedCount = useMemo(
    () => borrows.filter(positionPassesPortfolioFilters).length,
    [borrows, positionPassesPortfolioFilters]
  );

  const handleDepositClick = async (
    asset: string,
    poolId?: string,
    networkId?: string,
    configSymbol?: string,
    marketId?: string
  ) => {
    if (!activeAccount?.address) {
      return;
    }

    if (marketData.length === 0) {
      toast({
        title: "Market data loading",
        description: "Market data is loading. Please try again shortly.",
        variant: "default",
      });
      return;
    }

    // Don't open modal if market is at or over deposit cap
    const market = marketRowForPortfolioPosition(marketData, {
      marketId,
      poolId,
      displaySymbol: asset,
    }) as any;
    if (market) {
      const totalSupply = Number(market.totalDeposits ?? 0);
      const maxTotalDeposits = Number(market.maxTotalDeposits ?? 0);
      if (isAtDepositCap(totalSupply, maxTotalDeposits)) {
        toast({
          title: "Deposit cap reached",
          description:
            "This market has reached its deposit cap. Deposits are not available.",
          variant: "destructive",
        });
        return;
      }
    }

    setDepositModal({
      isOpen: true,
      asset,
      poolId,
      network: networkId,
      configSymbol,
      marketId,
    });

    setIsLoadingWalletBalance(true);
    void (async () => {
      try {
        await fetchWalletBalance(asset, networkId, true, {
          poolId,
          marketId,
          configSymbol,
        });

        if (deposits.length > 0) {
          const otherDeposits = deposits.filter((d) => {
            const dn = d as ItemWithNetwork;
            if (marketId != null && dn.marketId != null) {
              return (
                String(dn.marketId) !== String(marketId) ||
                String(d.poolId ?? "") !== String(poolId ?? "")
              );
            }
            return d.asset !== asset || d.poolId !== poolId;
          });
          if (otherDeposits.length > 0) {
            Promise.all(
              otherDeposits.map((d) =>
                fetchWalletBalance(
                  d.asset,
                  (d as ItemWithNetwork).network || networkId,
                  true,
                  {
                    poolId: d.poolId,
                    marketId: (d as ItemWithNetwork).marketId,
                    configSymbol: (d as ItemWithNetwork).configSymbol,
                  }
                ).catch((error) =>
                  console.error(
                    "[Portfolio] Error prefetching wallet balance for deposit asset",
                    d.asset,
                    error
                  )
                )
              )
            ).catch((error) =>
              console.error(
                "[Portfolio] Error in prefetch wallet balances Promise.all",
                error
              )
            );
          }
        }
      } catch (error) {
        console.error("Error fetching wallet balance for deposit:", error);
      } finally {
        setIsLoadingWalletBalance(false);
      }
    })();
  };

  const prefetchWithdrawIndicesRef = useRef<
    | ((
        asset: string,
        poolId?: string,
        marketId?: string,
        networkIdOverride?: string,
        configSymbol?: string
      ) => Promise<void>)
    | null
  >(null);

  const debouncedPortfolioPrefetch = useMemo(() => createDebouncedPrefetch(), []);

  const prefetchWithdrawModalData = (
    asset: string,
    poolId?: string,
    networkId?: string,
    marketId?: string,
    configSymbol?: string
  ) => {
    void prefetchWithdrawIndicesRef.current?.(
      asset,
      poolId,
      marketId,
      networkId,
      configSymbol
    );
  };

  const prefetchDepositOnHover = useCallback(
    (
      asset: string,
      poolId?: string,
      networkId?: string,
      configSymbol?: string,
      marketId?: string
    ) => {
      if (!activeAccount?.address) return;
      const networkToUse = (networkId || currentNetwork) as NetworkId;
      const key = `deposit:${networkToUse}:${asset}:${poolId ?? ""}:${configSymbol ?? ""}:${marketId ?? ""}`;
      debouncedPortfolioPrefetch(key, () => {
        void fetchWalletBalance(asset, networkToUse, true, {
          poolId,
          marketId,
          configSymbol,
        });
      });
    },
    [activeAccount?.address, currentNetwork, debouncedPortfolioPrefetch]
  );

  const prefetchBorrowOnHover = useCallback(
    (
      asset: string,
      poolId?: string,
      networkId?: string,
      configSymbol?: string,
      marketId?: string
    ) => {
      if (!activeAccount?.address) return;
      const networkToUse = (networkId || currentNetwork) as NetworkId;
      const params: MarketActionTokenParams = {
        userAddress: activeAccount.address,
        networkId: networkToUse,
        asset,
        poolId,
        configSymbol,
        marketId,
      };
      debouncedPortfolioPrefetch(
        `borrow:${networkToUse}:${asset}:${poolId ?? ""}:${configSymbol ?? ""}:${marketId ?? ""}`,
        () => warmBorrowModalMaxAndPool(params)
      );
    },
    [activeAccount?.address, currentNetwork, debouncedPortfolioPrefetch]
  );

  const prefetchRepayOnHover = useCallback(
    (
      asset: string,
      poolId?: string,
      networkId?: string,
      configSymbol?: string,
      marketId?: string
    ) => {
      if (!activeAccount?.address) return;
      const networkToUse = (networkId || currentNetwork) as NetworkId;
      const params: MarketActionTokenParams = {
        userAddress: activeAccount.address,
        networkId: networkToUse,
        asset,
        poolId,
        configSymbol,
        marketId,
      };
      debouncedPortfolioPrefetch(
        `repay:${networkToUse}:${asset}:${poolId ?? ""}:${configSymbol ?? ""}:${marketId ?? ""}`,
        () => {
          warmRepayModalRpc(params);
          void fetchWalletBalance(asset, networkToUse, true, {
            poolId,
            marketId,
            configSymbol,
          });
        }
      );
    },
    [activeAccount?.address, currentNetwork, debouncedPortfolioPrefetch]
  );

  const handleWithdrawClick = (
    asset: string,
    poolId?: string,
    networkId?: string,
    marketId?: string,
    configSymbol?: string
  ) => {
    // Open modal immediately; indices and max withdraw load in background when modal opens
    setWithdrawModal({
      isOpen: true,
      asset,
      poolId,
      network: networkId,
      marketId,
      configSymbol,
    });
  };

  const handleBorrowClick = async (
    asset: string,
    poolId?: string,
    networkId?: string,
    configSymbol?: string,
    marketId?: string
  ) => {
    if (marketData.length === 0) {
      toast({
        title: "Market data loading",
        description: "Market data is loading. Please try again shortly.",
        variant: "default",
      });
      return;
    }

    // Don't open modal if market is at or over borrow cap.
    // marketData entries are MarketInfo from fetchAllMarkets (totalBorrows, maxTotalBorrows).
    const market = marketRowForPortfolioPosition(marketData, {
      marketId,
      poolId,
      displaySymbol: asset,
    }) as any;
    if (market) {
      const totalBorrows = Number(market.totalBorrows ?? 0);
      const maxTotalBorrows = Number(market.maxTotalBorrows ?? 0);
      if (isAtBorrowCap(totalBorrows, maxTotalBorrows)) {
        toast({
          title: "Borrow cap reached",
          description:
            "This market has reached its borrow cap. Borrowing is not available.",
          variant: "destructive",
        });
        return;
      }
    }

    const networkToUse = (networkId || currentNetwork) as NetworkId;

    setBorrowModal({
      isOpen: true,
      asset,
      poolId,
      network: networkToUse,
      configSymbol,
      marketId,
    });

    setIsLoadingBorrowData(true);
    void (async () => {
      try {
        if (activeAccount?.address) {
          warmBorrowModalMaxAndPool({
            userAddress: activeAccount.address,
            networkId: networkToUse,
            asset,
            poolId,
            configSymbol,
            marketId,
          });

          const tokens = getAllTokensWithDisplayInfo(networkToUse);
          const token = resolveSupplyBorrowToken(
            tokens,
            asset,
            poolId,
            configSymbol,
            marketId
          );

          const [globalData, borrowData] = await Promise.all([
            fetchUserGlobalData(activeAccount.address, networkToUse),
            token && token.poolId && token.underlyingContractId
              ? fetchUserBorrowBalance(
                  activeAccount.address,
                  token.poolId,
                  token.underlyingContractId,
                  networkToUse
                )
              : Promise.resolve(null),
          ]);

          setUserGlobalData(globalData);
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserGlobalData(null);
          setUserBorrowBalance(0);
        }
      } catch (error) {
        console.error("Error fetching user data for borrow:", error);
      } finally {
        setIsLoadingBorrowData(false);
      }
    })();
  };

  const borrowModalMarketPickerRows = useMemo(() => {
    if (!Array.isArray(marketData) || marketData.length === 0) return [];
    return (marketData as Array<Record<string, unknown>>).map((m, i) => {
      const symbol = String(m.symbol ?? "");
      const poolId =
        m.poolId != null
          ? String(m.poolId)
          : m.appId != null
            ? String(m.appId)
            : "";
      const mi = m.marketInfo as Record<string, unknown> | undefined;
      const borrowApy =
        typeof m.borrowApyCalculation === "object" &&
        m.borrowApyCalculation != null &&
        typeof (m.borrowApyCalculation as { apy?: number }).apy === "number"
          ? (m.borrowApyCalculation as { apy: number }).apy
          : typeof m.borrowRateCurrent === "number"
            ? (m.borrowRateCurrent as number) * 100
            : undefined;
      const cfgKey =
        typeof m.configSymbol === "string" && m.configSymbol.trim() !== ""
          ? m.configSymbol
          : symbol;
      const cfgRaw = getTokenConfig(currentNetwork, cfgKey);
      const cfgOne = Array.isArray(cfgRaw)
        ? poolId
          ? cfgRaw.find((c: { poolId?: string }) => String(c.poolId) === poolId) ??
            cfgRaw[0]
          : cfgRaw[0]
        : cfgRaw;
      return {
        asset: symbol,
        icon: getTokenImagePath(symbol),
        iconBadgeUrl: resolveTokenIconBadgeUrl(
          (cfgOne as TokenConfig | undefined)?.iconBadgeFromSymbol
        ),
        value: borrowApy,
        poolId: poolId || undefined,
        network: currentNetwork,
        marketId:
          m.marketId != null
            ? String(m.marketId)
            : mi?.marketId != null
              ? String(mi.marketId)
              : undefined,
        configSymbol:
          typeof m.configSymbol === "string" ? m.configSymbol : undefined,
        marketRowKey: `portfolio-borrow|${symbol}|${poolId}|${i}`,
      };
    });
  }, [marketData, currentNetwork]);

  const handleSelectBorrowAssetForModal = useCallback(
    async (
      nextAsset: string,
      nextPoolId?: string,
      nextNetwork?: string,
      pick?: { marketId?: string; configSymbol?: string; marketRowKey?: string }
    ) => {
      const networkToUse = (nextNetwork || currentNetwork) as NetworkId;
      setBorrowModal((prev) => ({
        ...prev,
        isOpen: true,
        asset: nextAsset,
        poolId: nextPoolId,
        network: networkToUse,
        configSymbol: pick?.configSymbol ?? prev.configSymbol,
        marketId: pick?.marketId ?? prev.marketId,
        marketRowKey: pick?.marketRowKey ?? prev.marketRowKey,
      }));
      if (!activeAccount?.address) return;
      try {
        const tokens = getAllTokensWithDisplayInfo(networkToUse);
        const token = resolveSupplyBorrowToken(
          tokens,
          nextAsset,
          nextPoolId,
          pick?.configSymbol,
          pick?.marketId
        );
        if (token?.poolId && token?.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            networkToUse
          );
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } catch (e) {
        console.error(
          "Error refreshing borrow balance after asset switch:",
          e
        );
      }
    },
    [activeAccount?.address, currentNetwork]
  );

  const handleRepayClick = async (
    asset: string,
    poolId?: string,
    networkId?: string,
    configSymbol?: string,
    marketId?: string
  ) => {
    if (!activeAccount?.address) {
      console.error("No active account for repayment");
      return;
    }

    const networkToUse = (networkId || currentNetwork) as NetworkId;

    setRepayModal({
      isOpen: true,
      asset,
      poolId,
      network: networkToUse,
      configSymbol,
      marketId,
    });

    setIsLoadingRepayData(true);
    void (async () => {
      try {
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          networkToUse
        );
        setUserGlobalData(globalData);
        await refreshWalletBalance(asset, networkToUse, {
          poolId,
          marketId,
          configSymbol,
        });
      } catch (error) {
        console.error("Error fetching data for repay:", error);
      } finally {
        setIsLoadingRepayData(false);
      }
    })();
  };

  const handleAddCollateral = () => {
    // Reuse handleDepositClick so we always fetch wallet balances
    if (deposits.length > 0) {
      const largest = deposits.reduce((prev, cur) =>
        (cur.value > prev.value ? cur : prev) as typeof prev
      );
      handleDepositClick(
        largest.asset,
        largest.poolId,
        (largest as ItemWithNetwork).network,
        (largest as ItemWithNetwork).configSymbol,
        (largest as ItemWithNetwork).marketId
      );
    } else if (marketData.length > 0) {
      const m = marketData[0] as { symbol?: string; poolId?: string };
      handleDepositClick(m.symbol ?? "VOI", m.poolId, currentNetwork);
    } else {
      handleDepositClick("VOI", undefined, currentNetwork);
    }
  };

  const handleBuyVoi = () => {
    console.log("Redirect to VOI purchase");
  };

  // Handle liquidation
  const handleLiquidation = useCallback(async () => {
    if (
      !selectedLiquidationPosition ||
      !activeAccount?.address ||
      !signTransactions
    ) {
      toast({
        title: "Error",
        description: "Missing required information for liquidation",
        variant: "destructive",
      });
      return;
    }

    setIsLiquidating(true);
    try {
      const debtSymbol =
        selectedLiquidationPosition.debtTokenInfo?.data?.symbol;
      const collateralSymbol =
        selectedLiquidationPosition.collateralTokenInfo?.data?.symbol;
      const networkId = selectedLiquidationPosition.network as NetworkId;
      const userAddress = selectedLiquidationPosition.user;
      const maxLiquidationUsd =
        selectedLiquidationPosition.liquidationAmount || 0;
      const liquidationValueUsd = Math.min(
        Math.max(0, partialLiquidationAmountUsd),
        maxLiquidationUsd
      );

      console.log("marketData", marketData);

      // Get debt market to get price - try multiple matching strategies
      let debtMarket = marketData.find((m) => {
        const matchesSymbol = m.symbol === debtSymbol;
        const matchesNetwork =
          (m as ItemWithNetwork).network === networkId ||
          (networkId && m.network === networkId);
        const matchesPool =
          selectedLiquidationPosition.debtMarketId &&
          (m.poolId === selectedLiquidationPosition.debtMarketId.toString() ||
            m.appId === selectedLiquidationPosition.debtMarketId.toString());
        return matchesSymbol && (matchesNetwork || matchesPool);
      });

      // If not found, try matching by symbol and network only
      if (!debtMarket) {
        debtMarket = marketData.find((m) => {
          const matchesSymbol = m.symbol === debtSymbol;
          const matchesNetwork =
            (m as ItemWithNetwork).network === networkId ||
            (networkId && m.network === networkId);
          return matchesSymbol && matchesNetwork;
        });
      }

      // If still not found, try matching by symbol only (fallback)
      if (!debtMarket) {
        debtMarket = marketData.find((m) => m.symbol === debtSymbol);
      }

      if (!debtMarket) {
        console.error("Debt market not found:", {
          debtSymbol,
          networkId,
          debtMarketId: selectedLiquidationPosition.debtMarketId,
          availableMarkets: marketData.map((m) => ({
            symbol: m.symbol,
            poolId: m.poolId,
            appId: m.appId,
            network: (m as ItemWithNetwork).network,
          })),
        });
        throw new Error(
          `Debt market not found for ${debtSymbol} on ${networkId}`
        );
      }

      console.log("Debt market found in handler:", {
        symbol: debtMarket.symbol,
        poolId: debtMarket.poolId,
        appId: debtMarket.appId,
        network: (debtMarket as ItemWithNetwork).network,
      });

      // Get token configs - need to find tokens matching the specific markets
      const allTokens = getAllTokensWithDisplayInfo(networkId);
      const dt = allTokens.find(
        (t) => t.underlyingContractId === debtMarket.appId
      );
      console.log("dt", {
        dt,
        allTokens,
        networkId,
      });

      // Use the appId from the opportunity/position data as the poolId
      // This is the pool that contains the debtMarketId and is the correct pool for liquidation
      const poolId = selectedLiquidationPosition.appId?.toString();

      if (!poolId) {
        throw new Error("Pool ID (appId) not found in position data");
      }

      console.log("Using poolId from opportunity:", {
        appId: selectedLiquidationPosition.appId,
        poolId,
        debtMarketId: selectedLiquidationPosition.debtMarketId,
        collateralMarketId: selectedLiquidationPosition.collateralMarketId,
      });

      // Resolve full token configs (with tokenStandard) for debt and collateral via getTokenConfig
      const resolveTokenConfig = (
        symbol: string,
        poolIdStr: string
      ): TokenConfig | null => {
        const raw = getTokenConfig(networkId, symbol);
        if (!raw) return null;
        return Array.isArray(raw)
          ? raw.find((tc) => String(tc.poolId) === String(poolIdStr)) ??
          raw[0]
          : raw;
      };
      // Try config key first (symbol), then fall back to display-info lookup for originalSymbol
      let debtTokenConfig = resolveTokenConfig(debtSymbol, poolId);
      let collateralTokenConfig = resolveTokenConfig(collateralSymbol, poolId);
      if (!debtTokenConfig || !collateralTokenConfig) {
        const allTokens = getAllTokensWithDisplayInfo(networkId);
        if (!debtTokenConfig) {
          const debtDisplay = allTokens.find(
            (t) =>
              (t.symbol === debtSymbol || t.originalSymbol === debtSymbol) &&
              (poolId
                ? String(t.poolId) === String(poolId)
                : true)
          ) ?? allTokens.find(
            (t) => t.symbol === debtSymbol || t.originalSymbol === debtSymbol
          ) ?? (selectedLiquidationPosition.debtMarketId
            ? allTokens.find(
              (t) =>
                String(t.underlyingContractId) ===
                String(selectedLiquidationPosition.debtMarketId)
            )
            : undefined);
          const debtKey =
            debtDisplay && "originalSymbol" in debtDisplay
              ? (debtDisplay as { originalSymbol?: string }).originalSymbol
              : debtSymbol;
          if (debtKey)
            debtTokenConfig = resolveTokenConfig(debtKey, poolId) ?? null;
        }
        if (!collateralTokenConfig) {
          const collateralDisplay = allTokens.find(
            (t) =>
              (t.symbol === collateralSymbol ||
                t.originalSymbol === collateralSymbol) &&
              (poolId ? String(t.poolId) === String(poolId) : true)
          ) ?? allTokens.find(
            (t) =>
              t.symbol === collateralSymbol ||
              t.originalSymbol === collateralSymbol
          ) ?? (selectedLiquidationPosition.collateralMarketId
            ? allTokens.find(
              (t) =>
                String(t.underlyingContractId) ===
                String(selectedLiquidationPosition.collateralMarketId)
            )
            : undefined);
          const collateralKey =
            collateralDisplay && "originalSymbol" in collateralDisplay
              ? (collateralDisplay as { originalSymbol?: string })
                .originalSymbol
              : collateralSymbol;
          if (collateralKey)
            collateralTokenConfig =
              resolveTokenConfig(collateralKey, poolId) ?? null;
        }
      }

      // Build display tokens (symbol, poolId, underlyingContractId, decimals) from configs
      const toDisplayToken = (
        cfg: TokenConfig | null
      ): {
        symbol: string;
        originalSymbol: string;
        poolId?: string;
        underlyingContractId?: string;
        underlyingAssetId?: string;
        decimals: number;
      } | null => {
        if (!cfg) return null;
        const contractId =
          cfg.marketOverride?.underlyingContractId ?? cfg.contractId;
        const assetId = cfg.marketOverride?.underlyingAssetId ?? cfg.assetId;
        return {
          symbol: cfg.marketOverride?.displaySymbol ?? cfg.symbol,
          originalSymbol: cfg.symbol,
          poolId: cfg.poolId,
          underlyingContractId: contractId,
          underlyingAssetId: assetId,
          decimals: cfg.decimals,
        };
      };
      const debtToken = toDisplayToken(debtTokenConfig);
      const collateralToken = toDisplayToken(collateralTokenConfig);

      if (!debtToken || !collateralToken) {
        const missing = [
          !debtToken && `debt ${debtSymbol}`,
          !collateralToken && `collateral ${collateralSymbol}`,
        ]
          .filter(Boolean)
          .join(", ");
        console.error("Token configs not found:", {
          debtSymbol,
          collateralSymbol,
          poolId,
          debtMarketId: selectedLiquidationPosition.debtMarketId,
          collateralMarketId: selectedLiquidationPosition.collateralMarketId,
          debtTokenConfig: !!debtTokenConfig,
          collateralTokenConfig: !!collateralTokenConfig,
        });
        throw new Error(
          `Token config not found for ${missing}. Ensure the debt and collateral assets are listed in the app config for this network.`
        );
      }

      console.log("Tokens found:", {
        debtToken: { symbol: debtToken.symbol, poolId: debtToken.poolId },
        collateralToken: {
          symbol: collateralToken.symbol,
          poolId: collateralToken.poolId,
        },
        poolIdFromOpportunity: poolId,
        debtTokenStandard: debtTokenConfig?.tokenStandard,
        collateralTokenStandard: collateralTokenConfig?.tokenStandard,
      });

      // Get token price (oracle-aware)
      let debtTokenPrice = usdPerTokenFromPortfolioMarketRow(
        debtMarket,
        debtToken.decimals ?? 6
      );
      if (!(debtTokenPrice > 0) && debtMarket.marketInfo) {
        debtTokenPrice = usdPerTokenFromPortfolioMarketRow(
          debtMarket.marketInfo,
          debtToken.decimals ?? 6
        );
      }

      if (debtTokenPrice === 0) {
        throw new Error("Debt token price not available");
      }

      // Calculate debt amount in tokens
      const debtAmountInTokens = BigInt(
        new BigNumber(liquidationValueUsd)
          .dividedBy(debtTokenPrice)
          .multipliedBy(new BigNumber(10).pow(debtToken.decimals))
          .toFixed(0)
      );

      console.log("debtAmountInTokens", debtAmountInTokens);

      // Get collateral market to get price
      const collateralMarket = marketData.find((m) => {
        const matchesSymbol = m.symbol === collateralSymbol;
        const matchesNetwork =
          (m as ItemWithNetwork).network === networkId ||
          (networkId && m.network === networkId);
        const matchesPool =
          selectedLiquidationPosition.collateralMarketId &&
          (m.poolId ===
            selectedLiquidationPosition.collateralMarketId.toString() ||
            m.appId ===
            selectedLiquidationPosition.collateralMarketId.toString());
        return matchesSymbol && (matchesNetwork || matchesPool);
      });

      // If not found, try matching by symbol and network only
      if (!collateralMarket) {
        const collateralMarketFallback = marketData.find((m) => {
          const matchesSymbol = m.symbol === collateralSymbol;
          const matchesNetwork =
            (m as ItemWithNetwork).network === networkId ||
            (networkId && m.network === networkId);
          return matchesSymbol && matchesNetwork;
        });
        if (collateralMarketFallback) {
          Object.assign({}, collateralMarket, collateralMarketFallback);
        }
      }

      // Get collateral token price (oracle-aware)
      let collateralTokenPrice = usdPerTokenFromPortfolioMarketRow(
        collateralMarket,
        collateralToken.decimals ?? 6
      );
      if (!(collateralTokenPrice > 0) && collateralMarket?.marketInfo) {
        collateralTokenPrice = usdPerTokenFromPortfolioMarketRow(
          collateralMarket.marketInfo,
          collateralToken.decimals ?? 6
        );
      }

      if (collateralTokenPrice === 0) {
        console.warn(
          "Collateral token price not available, using debt token price as fallback"
        );
        collateralTokenPrice = debtTokenPrice;
      }

      // Get liquidation bonus from the position or market data
      // The liquidation bonus is the percentage extra collateral the liquidator receives
      const liquidationBonus =
        selectedLiquidationPosition.liquidationBonus || 0.2; // Default 20%

      // Calculate min collateral received in collateral token atomic units
      // Step 1: Normalize liquidation value to dollar amount (it's already in USD)
      // Step 2: Convert dollar amount to collateral tokens using collateral market price
      // Step 3: Apply liquidation bonus (liquidator receives more collateral)
      // Step 4: Convert to atomic units (multiply by 10^decimals)
      const liquidationValueDollars = new BigNumber(liquidationValueUsd);

      console.log("collateralTokenPrice", collateralTokenPrice);

      // Convert dollar amount to collateral tokens using collateral market price
      const collateralAmountInTokens = liquidationValueDollars
        .dividedBy(collateralTokenPrice)
        .multipliedBy(new BigNumber(1).plus(liquidationBonus));

      console.log(
        "collateralAmountInTokens",
        collateralAmountInTokens.toString()
      );

      // Convert to atomic units by multiplying by 10^decimals
      const minCollateralReceived = BigInt(
        collateralAmountInTokens
          .multipliedBy(new BigNumber(10).pow(collateralToken.decimals))
          .toFixed(0)
      );

      console.log("Min collateral received calculation:", {
        liquidationValueUsd,
        collateralTokenPrice,
        liquidationBonus,
        collateralAmountInTokens: collateralAmountInTokens.toString(),
        minCollateralReceived: minCollateralReceived.toString(),
      });

      // Human-readable amounts for lending service
      const debtAmountHuman = new BigNumber(debtAmountInTokens.toString())
        .dividedBy(10 ** debtToken.decimals)
        .toString();
      const minCollateralAmountHuman = collateralAmountInTokens.toString();

      const result = await liquidateCrossMarket(
        poolId,
        debtTokenConfig,
        collateralTokenConfig,
        debtAmountHuman,
        minCollateralAmountHuman,
        userAddress,
        activeAccount.address,
        networkId,
        undefined,
        undefined
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const customR = { txns: result.txns };

      const stxns = await signTransactions(
        customR.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await algosdk.waitForConfirmation(algorandClients.algod, res.txid, 4);

      // Update transaction metadata
      await updateTransactionMetadata(res.txid, networkId);

      toast({
        title: "Liquidation Successful",
        description: `Transaction confirmed: ${res.txid}`,
      });

      // Close modal and refresh data
      setLiquidationModalOpen(false);
      setSelectedLiquidationPosition(null);

      // Refresh user data
      if (displayAddress) {
        await fetchUser(displayAddress);
      }
    } catch (error) {
      console.error("Liquidation error:", error);
      toast({
        title: "Liquidation Failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLiquidating(false);
    }
  }, [
    selectedLiquidationPosition,
    activeAccount,
    signTransactions,
    marketData,
    displayAddress,
    fetchUser,
    toast,
  ]);

  const handleClaim = useCallback(
    async (position: {
      user?: string;
      network?: string;
      appId?: string | number;
      collateralTokenInfo?: { data?: { symbol?: string } };
      collateralMarketId?: string | number;
    }) => {
      if (!activeAccount?.address) {
        toast({
          title: "Wallet required",
          description: "Connect a wallet to claim.",
          variant: "destructive",
        });
        return;
      }
      const networkId = position.network as NetworkId;
      const poolId = position.appId?.toString();
      const collateralSymbol =
        position.collateralTokenInfo?.data?.symbol ?? "";

      const resolveTokenConfig = (
        symbol: string,
        poolIdStr: string
      ): TokenConfig | null => {
        const raw = getTokenConfig(networkId, symbol);
        if (!raw) return null;
        return Array.isArray(raw)
          ? raw.find((tc) => String(tc.poolId) === String(poolIdStr)) ?? raw[0]
          : raw;
      };

      let collateralTokenConfig = poolId
        ? resolveTokenConfig(collateralSymbol, poolId)
        : null;
      if (!collateralTokenConfig && poolId) {
        const allTokens = getAllTokensWithDisplayInfo(networkId);
        const collateralDisplay =
          allTokens.find(
            (t) =>
              (t.symbol === collateralSymbol ||
                t.originalSymbol === collateralSymbol) &&
              String(t.poolId) === String(poolId)
          ) ??
          allTokens.find(
            (t) =>
              t.symbol === collateralSymbol ||
              t.originalSymbol === collateralSymbol
          ) ??
          (position.collateralMarketId
            ? allTokens.find(
              (t) =>
                String(t.underlyingContractId) ===
                String(position.collateralMarketId)
            )
            : undefined);
        const collateralKey =
          collateralDisplay && "originalSymbol" in collateralDisplay
            ? (collateralDisplay as { originalSymbol?: string }).originalSymbol
            : collateralSymbol;
        if (collateralKey) {
          collateralTokenConfig = resolveTokenConfig(collateralKey, poolId) ?? null;
        }
      }

      if (!collateralTokenConfig) {
        toast({
          title: "Claim failed",
          description: `Collateral token config not found for ${collateralSymbol} on this pool.`,
          variant: "destructive",
        });
        return;
      }

      console.log("collateralTokenConfig", collateralTokenConfig);

      const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
      if (!algorandNetwork) {
        toast({
          title: "Claim failed",
          description: `Invalid or unsupported network: ${networkId}`,
          variant: "destructive",
        });
        return;
      }

      try {
        const clients = await algorandService.initializeClientsForTransactions(
          algorandNetwork
        );
        if (collateralTokenConfig.tokenStandard === "asa") {
          const ci = new CONTRACT(
            Number(collateralTokenConfig.contractId),
            clients.algod,
            undefined,
            abi.nt200,
            { addr: activeAccount.address, sk: new Uint8Array() }
          );
          const balanceR = await ci.arc200_balanceOf(activeAccount.address);
          if (!balanceR.success) {
            throw new Error(balanceR.error);
          }
          const balance = balanceR.returnValue;
          console.log("balance", balance);
          ci.setFee(3000);
          const claimR = await ci.withdraw(balance);
          console.log("claimR", claimR);
          if (!claimR.success) {
            throw new Error(claimR.error);
          }
          console.log("claimR", claimR);
          const stxns = await signTransactions(
            claimR.txns.map((txn: string) =>
              Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
            )
          );
          const res = await clients.algod.sendRawTransaction(stxns).do();
          await algosdk.waitForConfirmation(clients.algod, res.txid, 4);
          await updateTransactionMetadata(res.txid, networkId);
          toast({
            title: "Claim Successful",
            description: `Transaction confirmed: ${res.txid}`,
          });
          //} else if (collateralTokenConfig.tokenStandard === "network") {
        } else {
          toast({
            title: "Claim failed",
            description: "Claim is not yet available for this position.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Claim failed",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      }
    },
    [activeAccount?.address, toast]
  );

  // Show loading state
  if (isLoadingData) {
    return (
      <div className="space-y-3 sm:space-y-6">
        {/* Health Factor Skeleton */}
        <DorkFiCard className="p-4 sm:p-8">
          <div className="grid grid-cols-1 items-start gap-4 sm:gap-8 lg:grid-cols-[420px,1fr] lg:gap-10">
            <div className="order-2 space-y-4 lg:order-1 lg:border-r-2 lg:border-ocean-teal/20 lg:pr-8">
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
            <div className="order-1 space-y-4 sm:space-y-6 lg:order-2">
              <Skeleton className="hidden h-8 w-48 sm:block" />
              <div className="space-y-3 sm:hidden">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full max-w-xs" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="col-span-2 h-16 w-full sm:col-span-1 sm:h-24" />
                <Skeleton className="hidden h-24 w-full sm:block" />
              </div>
            </div>
          </div>
        </DorkFiCard>
      </div>
    );
  }

  // Show no wallet connected state
  if (!activeAccount?.address) {
    return (
      <div className="space-y-6">
        {/* Connect Wallet Card */}
        <DorkFiCard className="text-center p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              Connect Your Wallet
            </h2>
            <p className="text-muted-foreground">
              Connect your wallet to access your portfolio data and manage your
              lending positions.
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                Use the wallet button in the top navigation to connect.
              </p>
            </div>
          </div>
        </DorkFiCard>
      </div>
    );
  }

  // Show loading state while avatar check is in progress
  if (!isAvatarResolved) {
    return (
      <div className="space-y-3 sm:space-y-6">
        {/* Health Factor Skeleton */}
        <DorkFiCard className="p-4 sm:p-6 md:p-8">
          <div className="grid grid-cols-1 items-start gap-4 sm:gap-8 lg:grid-cols-[420px,1fr] lg:gap-10">
            <div className="order-2 space-y-4 lg:order-1 lg:border-r-2 lg:border-ocean-teal/20 lg:pr-8">
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
            <div className="order-1 space-y-4 sm:space-y-6 lg:order-2">
              <Skeleton className="hidden h-8 w-40 sm:block" />
              <div className="space-y-3 sm:hidden">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full max-w-xs" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="col-span-2 h-16 w-full sm:col-span-1 sm:h-24" />
                <Skeleton className="hidden h-24 w-full sm:block" />
              </div>
            </div>
          </div>
        </DorkFiCard>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {dataError && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/20 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm text-red-400">
              Error loading data: {dataError}
            </span>
          </div>
        </div>
      )}

      {/* Render health factor section after avatar check is complete */}
      {isAvatarResolved &&
        (() => {
          // Check if wallet is Pera or Defly - disable edit profile for these wallets
          const walletId = activeWallet?.id?.toLowerCase() || "";
          const walletName = activeWallet?.metadata?.name?.toLowerCase() || "";
          const isPeraOrDefly =
            walletId === "pera" ||
            walletId === "defly" ||
            walletName.includes("pera") ||
            walletName.includes("defly");

          const walletAddressLabel =
            addressName ||
            `${activeAccount?.address.slice(0, 8)}...${activeAccount?.address.slice(-8)}`;

          return (
            <>
              <EnhancedHealthFactor
                healthFactor={displayHealthFactor}
                marketContextLine={positionOverviewMarketLine}
                totalCollateral={totalCollateral}
                totalBorrowed={totalBorrowed}
                dorkNftImage={displayAvatar || undefined}
                underwaterBg="/lovable-uploads/44ebe994-a30e-4eb1-a4a1-776aa2978776.png"
                onAddCollateral={!isViewOnly ? handleAddCollateral : undefined}
                onBuyVoi={!isViewOnly ? handleBuyVoi : undefined}
                onRepayDebt={
                  !isViewOnly
                    ? () => {
                        if (borrows.length > 0) {
                          const largestBorrow = borrows.reduce((prev, current) =>
                            current.value > prev.value ? current : prev
                          );
                          handleRepayClick(
                            largestBorrow.asset,
                            largestBorrow.poolId,
                            (largestBorrow as ItemWithNetwork).network,
                            (largestBorrow as ItemWithNetwork).configSymbol,
                            (largestBorrow as ItemWithNetwork).marketId
                          );
                        }
                      }
                    : undefined
                }
                onWithdraw={
                  !isViewOnly && deposits.length > 0
                    ? () => {
                        const largestDeposit = deposits.reduce((prev, current) =>
                          current.value > prev.value ? current : prev
                        );
                        handleWithdrawClick(
                          largestDeposit.asset,
                          largestDeposit.poolId,
                          (largestDeposit as ItemWithNetwork).network,
                          (largestDeposit as ItemWithNetwork).marketId,
                          (largestDeposit as ItemWithNetwork).configSymbol
                        );
                      }
                    : undefined
                }
                onEditProfile={
                  !isViewOnly &&
                  (currentNetwork === "algorand-mainnet" || !isPeraOrDefly)
                    ? () => setNftModalOpen(true)
                    : undefined
                }
                onRefreshMarkets={handleRefreshMarkets}
                isRefreshingMarkets={isRefreshingMarkets}
                insights={
                  poolPortfolioBreakdown.length > 0 || displayAddress ? (
                    <PortfolioInsightsHub
                      layout="toolbar"
                      showNetworkRow={poolPortfolioBreakdown.length > 0}
                      networkPortfolioPoolsFiltered={
                        networkPortfolioPoolsFiltered
                      }
                      positionsNetworkFilter={positionsNetworkFilter}
                      positionsMarketFilter={positionsMarketFilter}
                      borrows={borrows}
                      healthFactor={healthFactor}
                      displayHealthFactor={displayHealthFactor}
                      totalBorrowed={totalBorrowed}
                      isMobile={isMobile}
                      displayAddress={displayAddress}
                      isViewOnly={isViewOnly}
                      showNftRow={!isViewOnly && Boolean(displayAddress)}
                      nftRewardsLoading={showPortfolioNftHolderRewardsFetching}
                      nftClaimableDisplay={nftHolderClaimableDisplayWithSymbol}
                      nftHasClaimable={showPortfolioRewardsClaim}
                      onOpenNftRewards={() =>
                        setNftHolderRewardsClaimModalOpen(true)
                      }
                    />
                  ) : undefined
                }
              />

              <PortfolioWalletStatusBar
                hasComputedData={Boolean(user?.computed)}
                hasUserGlobalData={Boolean(userGlobalData)}
                addressLabel={walletAddressLabel}
                globalNetPortfolioValue={user?.computed?.globalNetPortfolioValue}
                showRiskMetrics={marketData.length > 0 && totalBorrowed > 0}
                weightedCollateralFactor={weightedCollateralFactor}
                weightedLiquidationThreshold={weightedLiquidationThreshold}
              />
            </>
          );
        })()}

      {/* Per-Network Asset Tables */}
      {user?.computed?.networkValues &&
        Object.keys(user.computed.networkValues).length > 0 && (
          <TooltipProvider>
            <div className="flex flex-col gap-6">
              {(deposits.length > 0 || borrows.length > 0) && (
                <DorkFiCard className="order-0 p-4 md:p-6">
                  <PortfolioPositionsCardHeader
                    portfolioPositionsTab={portfolioPositionsTab}
                    onTabChange={setPortfolioPositionsTab}
                    hasBothPositionTypes={hasBothPositionTypes}
                    hasSupplied={deposits.length > 0}
                    hasBorrowed={borrows.length > 0}
                    filteredSuppliedCount={filteredSuppliedCount}
                    filteredBorrowedCount={filteredBorrowedCount}
                    isViewOnly={isViewOnly}
                    refreshingSection={refreshingSection}
                    onRefreshSupplied={() => void handleRefreshSuppliedAssets()}
                    onRefreshBorrowed={() => void handleRefreshBorrowedAssets()}
                    networkFilter={positionsNetworkFilter}
                    onNetworkFilterChange={setPositionsNetworkFilter}
                    marketFilter={positionsMarketFilter}
                    onMarketFilterChange={setPositionsMarketFilter}
                    searchTerm={positionsSearchTerm}
                    onSearchTermChange={setPositionsSearchTerm}
                    hasDMarketTab={hasDMarketTab}
                    isMobile={isNarrowPositionsViewport}
                  />
              {/* Supplied Assets Table */}
              {deposits.length > 0 && (
                <div
                  ref={suppliedAssetsTableRef}
                  className={cn(
                    hasBothPositionTypes &&
                      portfolioPositionsTab === "borrowed" &&
                      "hidden"
                  )}
                >
                  {/* Mobile Card View */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {(() => {
                        const filteredAndSorted = deposits
                          .filter(positionPassesPortfolioFilters)
                          .sort((a, b) => {
                            let comparison = 0;

                            switch (suppliedAssetsSort.column) {
                              case "network": {
                                const networkA = (
                                  (a as ItemWithNetwork).network || "Unknown"
                                ).toLowerCase();
                                const networkB = (
                                  (b as ItemWithNetwork).network || "Unknown"
                                ).toLowerCase();
                                comparison = networkA.localeCompare(networkB);
                                break;
                              }
                              case "asset":
                                comparison = a.asset.localeCompare(b.asset);
                                break;
                              case "supplied":
                                comparison = a.balance - b.balance;
                                break;
                              case "value":
                                comparison = a.value - b.value;
                                break;
                              case "apy":
                                comparison = a.apy - b.apy;
                                break;
                              case "accruedInterest": {
                                comparison =
                                  accruedInterestUsdForSort(
                                    a as ItemWithNetwork
                                  ) -
                                  accruedInterestUsdForSort(
                                    b as ItemWithNetwork
                                  );
                                break;
                              }
                              case "collateralFactor": {
                                const marketACF = marketRowForPortfolioPosition(
                                  marketData,
                                  {
                                    marketId: (a as ItemWithNetwork).marketId,
                                    poolId: a.poolId,
                                    displaySymbol: a.asset,
                                  }
                                );
                                const marketBCF = marketRowForPortfolioPosition(
                                  marketData,
                                  {
                                    marketId: (b as ItemWithNetwork).marketId,
                                    poolId: b.poolId,
                                    displaySymbol: b.asset,
                                  }
                                );
                                let collateralFactorA =
                                  marketACF?.collateralFactor ??
                                  marketACF?.marketInfo?.collateralFactor ??
                                  0.8;
                                let collateralFactorB =
                                  marketBCF?.collateralFactor ??
                                  marketBCF?.marketInfo?.collateralFactor ??
                                  0.8;
                                if (typeof collateralFactorA === "string") {
                                  collateralFactorA = parseFloat(collateralFactorA);
                                } else if (
                                  typeof collateralFactorA === "bigint"
                                ) {
                                  collateralFactorA = Number(collateralFactorA);
                                }
                                if (typeof collateralFactorB === "string") {
                                  collateralFactorB = parseFloat(collateralFactorB);
                                } else if (
                                  typeof collateralFactorB === "bigint"
                                ) {
                                  collateralFactorB = Number(collateralFactorB);
                                }
                                if (
                                  collateralFactorA > 1 &&
                                  collateralFactorA <= 100
                                ) {
                                  collateralFactorA = collateralFactorA / 100;
                                } else if (collateralFactorA > 100) {
                                  collateralFactorA = collateralFactorA / 10000;
                                }
                                if (
                                  collateralFactorB > 1 &&
                                  collateralFactorB <= 100
                                ) {
                                  collateralFactorB = collateralFactorB / 100;
                                } else if (collateralFactorB > 100) {
                                  collateralFactorB = collateralFactorB / 10000;
                                }
                                comparison =
                                  collateralFactorB - collateralFactorA;
                                break;
                              }
                              case "liquidationFactor": {
                                const marketALF = marketRowForPortfolioPosition(
                                  marketData,
                                  {
                                    marketId: (a as ItemWithNetwork).marketId,
                                    poolId: a.poolId,
                                    displaySymbol: a.asset,
                                  }
                                );
                                const marketBLF = marketRowForPortfolioPosition(
                                  marketData,
                                  {
                                    marketId: (b as ItemWithNetwork).marketId,
                                    poolId: b.poolId,
                                    displaySymbol: b.asset,
                                  }
                                );
                                let liquidationThresholdA =
                                  marketALF?.liquidationThreshold ??
                                  (marketALF as { marketInfo?: { liquidationThreshold?: unknown } })
                                    ?.marketInfo?.liquidationThreshold ??
                                  0.85;
                                let liquidationThresholdB =
                                  marketBLF?.liquidationThreshold ??
                                  (marketBLF as { marketInfo?: { liquidationThreshold?: unknown } })
                                    ?.marketInfo?.liquidationThreshold ??
                                  0.85;
                                if (
                                  typeof liquidationThresholdA === "string"
                                ) {
                                  liquidationThresholdA = parseFloat(
                                    liquidationThresholdA
                                  );
                                } else if (
                                  typeof liquidationThresholdA === "bigint"
                                ) {
                                  liquidationThresholdA = Number(
                                    liquidationThresholdA
                                  );
                                }
                                if (
                                  typeof liquidationThresholdB === "string"
                                ) {
                                  liquidationThresholdB = parseFloat(
                                    liquidationThresholdB
                                  );
                                } else if (
                                  typeof liquidationThresholdB === "bigint"
                                ) {
                                  liquidationThresholdB = Number(
                                    liquidationThresholdB
                                  );
                                }
                                if (
                                  liquidationThresholdA > 1 &&
                                  liquidationThresholdA <= 100
                                ) {
                                  liquidationThresholdA =
                                    liquidationThresholdA / 100;
                                } else if (liquidationThresholdA > 100) {
                                  liquidationThresholdA =
                                    liquidationThresholdA / 10000;
                                }
                                if (
                                  liquidationThresholdB > 1 &&
                                  liquidationThresholdB <= 100
                                ) {
                                  liquidationThresholdB =
                                    liquidationThresholdB / 100;
                                } else if (liquidationThresholdB > 100) {
                                  liquidationThresholdB =
                                    liquidationThresholdB / 10000;
                                }
                                comparison =
                                  liquidationThresholdB - liquidationThresholdA;
                                break;
                              }
                              default:
                                comparison = a.apy - b.apy;
                                break;
                            }

                            return suppliedAssetsSort.direction === "asc"
                              ? comparison
                              : -comparison;
                          });

                        const displayDeposits = sliceAssetListPage(
                          filteredAndSorted,
                          suppliedAssetsPage,
                          ASSET_LIST_PAGE_SIZE
                        );

                        if (displayDeposits.length === 0) {
                          return (
                            <PortfolioPositionsFilteredEmptyState
                              totalCount={deposits.length}
                              entityLabel="supplied assets"
                              onClearFilters={clearPositionsFilters}
                            />
                          );
                        }

                        return (
                          <>
                            {displayDeposits.map((depositRaw) => {
                              const depositNet =
                                (depositRaw as ItemWithNetwork).network ||
                                currentNetwork ||
                                "";
                              const deposit = mergeDeposit(
                                depositRaw as ItemWithNetwork
                              ) as ItemWithNetwork;
                              const depositChainPollKey =
                                portfolioPositionChainKey(
                                  "deposit",
                                  String(depositNet),
                                  String(deposit.poolId ?? ""),
                                  deposit.asset,
                                  (deposit as ItemWithNetwork).marketId
                                );
                              const rewardsBonusApr = getRewardsBonusSupplyAprPercent(
                                (deposit as ItemWithNetwork).network ??
                                  currentNetwork,
                                (deposit as ItemWithNetwork).configSymbol ??
                                  (deposit as ItemWithNetwork).originalSymbol ??
                                  deposit.asset,
                                deposit.poolId != null
                                  ? String(deposit.poolId)
                                  : undefined,
                                rewardsAprByBaseUrl
                              );
                              const depositApyWithRewards =
                                deposit.apy + rewardsBonusApr;
                              const market = marketRowForPortfolioPosition(
                                marketData,
                                {
                                  marketId: (deposit as ItemWithNetwork).marketId,
                                  poolId: deposit.poolId,
                                  displaySymbol: deposit.asset,
                                }
                              );
                              const depositCapReached = isAtDepositCap(
                                Number(market?.totalDeposits ?? 0),
                                Number(market?.maxTotalDeposits ?? 0),
                              );
                              const depositNetForRewards =
                                (deposit as ItemWithNetwork).network ||
                                currentNetwork;
                              const rewardKeyMobile =
                                (deposit as ItemWithNetwork).configSymbol ??
                                (deposit as ItemWithNetwork).originalSymbol ??
                                deposit.asset;
                              const rewardBonusAprMobile =
                                getRewardsBonusSupplyAprPercent(
                                  depositNetForRewards as NetworkId,
                                  rewardKeyMobile,
                                  deposit.poolId
                                    ? String(deposit.poolId)
                                    : undefined,
                                  rewardsAprByBaseUrl
                                );
                              const intrinsicAprMobile =
                                resolveIntrinsicSupplyApyPercent(
                                  depositNetForRewards as NetworkId,
                                  rewardKeyMobile,
                                  deposit.poolId
                                    ? String(deposit.poolId)
                                    : undefined,
                                  liveIntrinsicSupplyApy
                                );
                              return (
                                <div
                                  key={`${deposit.asset}-${deposit.poolId || "default"}-${(deposit as ItemWithNetwork).marketId ?? ""
                                    }`}
                                  ref={attachChainPollRow(depositChainPollKey)}
                                >
                                <PortfolioTableMobileCard
                                  asset={deposit.asset}
                                  configSymbol={
                                    (deposit as ItemWithNetwork).configSymbol
                                  }
                                  icon={deposit.icon}
                                  iconBadgeUrl={
                                    (deposit as { iconBadgeUrl?: string })
                                      .iconBadgeUrl
                                  }
                                  value={deposit.value}
                                  balance={deposit.balance}
                                  apy={deposit.apy}
                                  intrinsicApyPercent={
                                    intrinsicAprMobile > 0
                                      ? intrinsicAprMobile
                                      : undefined
                                  }
                                  rewardBonusAprPercent={
                                    rewardBonusAprMobile > 0
                                      ? rewardBonusAprMobile
                                      : undefined
                                  }
                                  accruedInterest={
                                    (deposit as ItemWithNetwork).accruedInterest
                                  }
                                  accruedInterestValue={
                                    (deposit as ItemWithNetwork).accruedInterestValue
                                  }
                                  network={(deposit as ItemWithNetwork).network}
                                  poolId={deposit.poolId}
                                  depositDisabled={depositCapReached}
                                  onDepositClick={
                                    !isViewOnly && !market?.isPaused
                                      ? () =>
                                        handleDepositClick(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as ItemWithNetwork).network,
                                          (deposit as ItemWithNetwork).configSymbol,
                                          (deposit as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  onDepositMouseEnter={
                                    !isViewOnly
                                      ? () =>
                                        prefetchDepositOnHover(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as ItemWithNetwork).network,
                                          (deposit as ItemWithNetwork).configSymbol,
                                          (deposit as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  onWithdrawClick={
                                    !isViewOnly
                                      ? () =>
                                        handleWithdrawClick(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as ItemWithNetwork).network,
                                          (deposit as ItemWithNetwork).marketId,
                                          (deposit as ItemWithNetwork).configSymbol
                                        )
                                      : undefined
                                  }
                                  onWithdrawMouseEnter={
                                    !isViewOnly
                                      ? () =>
                                        prefetchWithdrawModalData(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as ItemWithNetwork).network,
                                          (deposit as ItemWithNetwork).marketId,
                                          (deposit as ItemWithNetwork).configSymbol
                                        )
                                      : undefined
                                  }
                                  type="deposit"
                                />
                                </div>
                              );
                            })}
                            <PortfolioAssetListPagination
                              currentPage={suppliedAssetsPage}
                              onPageChange={setSuppliedAssetsPage}
                              totalItems={filteredAndSorted.length}
                              pageSize={ASSET_LIST_PAGE_SIZE}
                              scrollToRef={suppliedAssetsTableRef}
                            />
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (suppliedAssetsSort.column === "asset") {
                                    setSuppliedAssetsSort({
                                      column: "asset",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "asset",
                                      direction: "asc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Asset
                                {suppliedAssetsSort.column === "asset" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-center">
                              Network
                            </TableHead>
                            <TableHead className="text-center">
                              Market
                            </TableHead>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (
                                    suppliedAssetsSort.column === "supplied"
                                  ) {
                                    setSuppliedAssetsSort({
                                      column: "supplied",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "supplied",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Supplied
                                {suppliedAssetsSort.column === "supplied" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (suppliedAssetsSort.column === "value") {
                                    setSuppliedAssetsSort({
                                      column: "value",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "value",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Value (USD)
                                {suppliedAssetsSort.column === "value" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-right">
                              <button
                                onClick={() => {
                                  if (suppliedAssetsSort.column === "apy") {
                                    setSuppliedAssetsSort({
                                      column: "apy",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "apy",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex w-full items-center justify-end gap-1 hover:text-foreground transition-colors"
                              >
                                APY
                                {suppliedAssetsSort.column === "apy" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-right">
                              <button
                                onClick={() => {
                                  if (
                                    suppliedAssetsSort.column ===
                                    "accruedInterest"
                                  ) {
                                    setSuppliedAssetsSort({
                                      column: "accruedInterest",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "accruedInterest",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex w-full items-center justify-end gap-1 hover:text-foreground transition-colors"
                              >
                                Accrued Interest
                                {suppliedAssetsSort.column ===
                                  "accruedInterest" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-[1%]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const filteredAndSorted = deposits
                              .filter(positionPassesPortfolioFilters)
                              .sort((a, b) => {
                                let comparison = 0;

                                switch (suppliedAssetsSort.column) {
                                  case "network": {
                                    const networkA = (
                                      (a as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    const networkB = (
                                      (b as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    comparison =
                                      networkA.localeCompare(networkB);
                                    break;
                                  }
                                  case "asset":
                                    comparison = a.asset.localeCompare(b.asset);
                                    break;
                                  case "supplied":
                                    comparison = a.balance - b.balance;
                                    break;
                                  case "value":
                                    comparison = a.value - b.value;
                                    break;
                                  case "apy":
                                    comparison = a.apy - b.apy;
                                    break;
                                  case "accruedInterest": {
                                    comparison =
                                      accruedInterestUsdForSort(
                                        a as ItemWithNetwork
                                      ) -
                                      accruedInterestUsdForSort(
                                        b as ItemWithNetwork
                                      );
                                    break;
                                  }
                                  case "collateralFactor": {
                                    const marketACF = marketRowForPortfolioPosition(
                                      marketData,
                                      {
                                        marketId: (a as ItemWithNetwork).marketId,
                                        poolId: a.poolId,
                                        displaySymbol: a.asset,
                                      }
                                    );
                                    const marketBCF = marketRowForPortfolioPosition(
                                      marketData,
                                      {
                                        marketId: (b as ItemWithNetwork).marketId,
                                        poolId: b.poolId,
                                        displaySymbol: b.asset,
                                      }
                                    );
                                    let collateralFactorA =
                                      marketACF?.collateralFactor ??
                                      marketACF?.marketInfo?.collateralFactor ??
                                      0.8;
                                    let collateralFactorB =
                                      marketBCF?.collateralFactor ??
                                      marketBCF?.marketInfo?.collateralFactor ??
                                      0.8;
                                    // Convert to number if needed and normalize to decimal format
                                    if (typeof collateralFactorA === "string") {
                                      collateralFactorA =
                                        parseFloat(collateralFactorA);
                                    } else if (
                                      typeof collateralFactorA === "bigint"
                                    ) {
                                      collateralFactorA =
                                        Number(collateralFactorA);
                                    }
                                    if (typeof collateralFactorB === "string") {
                                      collateralFactorB =
                                        parseFloat(collateralFactorB);
                                    } else if (
                                      typeof collateralFactorB === "bigint"
                                    ) {
                                      collateralFactorB =
                                        Number(collateralFactorB);
                                    }
                                    if (
                                      collateralFactorA > 1 &&
                                      collateralFactorA <= 100
                                    ) {
                                      collateralFactorA =
                                        collateralFactorA / 100;
                                    } else if (collateralFactorA > 100) {
                                      collateralFactorA =
                                        collateralFactorA / 10000;
                                    }
                                    if (
                                      collateralFactorB > 1 &&
                                      collateralFactorB <= 100
                                    ) {
                                      collateralFactorB =
                                        collateralFactorB / 100;
                                    } else if (collateralFactorB > 100) {
                                      collateralFactorB =
                                        collateralFactorB / 10000;
                                    }
                                    comparison =
                                      collateralFactorB - collateralFactorA;
                                    break;
                                  }
                                  case "liquidationFactor": {
                                    const marketALF = marketRowForPortfolioPosition(
                                      marketData,
                                      {
                                        marketId: (a as ItemWithNetwork).marketId,
                                        poolId: a.poolId,
                                        displaySymbol: a.asset,
                                      }
                                    );
                                    const marketBLF = marketRowForPortfolioPosition(
                                      marketData,
                                      {
                                        marketId: (b as ItemWithNetwork).marketId,
                                        poolId: b.poolId,
                                        displaySymbol: b.asset,
                                      }
                                    );
                                    let liquidationThresholdA =
                                      marketALF?.liquidationThreshold ??
                                      (marketALF as { marketInfo?: { liquidationThreshold?: unknown } })
                                        ?.marketInfo?.liquidationThreshold ??
                                      0.85;
                                    let liquidationThresholdB =
                                      marketBLF?.liquidationThreshold ??
                                      (marketBLF as { marketInfo?: { liquidationThreshold?: unknown } })
                                        ?.marketInfo?.liquidationThreshold ??
                                      0.85;
                                    // Convert to number if needed and normalize to decimal format
                                    if (
                                      typeof liquidationThresholdA === "string"
                                    ) {
                                      liquidationThresholdA = parseFloat(
                                        liquidationThresholdA
                                      );
                                    } else if (
                                      typeof liquidationThresholdA === "bigint"
                                    ) {
                                      liquidationThresholdA = Number(
                                        liquidationThresholdA
                                      );
                                    }
                                    if (
                                      typeof liquidationThresholdB === "string"
                                    ) {
                                      liquidationThresholdB = parseFloat(
                                        liquidationThresholdB
                                      );
                                    } else if (
                                      typeof liquidationThresholdB === "bigint"
                                    ) {
                                      liquidationThresholdB = Number(
                                        liquidationThresholdB
                                      );
                                    }
                                    if (
                                      liquidationThresholdA > 1 &&
                                      liquidationThresholdA <= 100
                                    ) {
                                      liquidationThresholdA =
                                        liquidationThresholdA / 100;
                                    } else if (liquidationThresholdA > 100) {
                                      liquidationThresholdA =
                                        liquidationThresholdA / 10000;
                                    }
                                    if (
                                      liquidationThresholdB > 1 &&
                                      liquidationThresholdB <= 100
                                    ) {
                                      liquidationThresholdB =
                                        liquidationThresholdB / 100;
                                    } else if (liquidationThresholdB > 100) {
                                      liquidationThresholdB =
                                        liquidationThresholdB / 10000;
                                    }
                                    comparison =
                                      liquidationThresholdB -
                                      liquidationThresholdA;
                                    break;
                                  }
                                  default:
                                    comparison = a.apy - b.apy;
                                    break;
                                }

                                return suppliedAssetsSort.direction === "asc"
                                  ? comparison
                                  : -comparison;
                              });

                            const displayDeposits = sliceAssetListPage(
                              filteredAndSorted,
                              suppliedAssetsPage,
                              ASSET_LIST_PAGE_SIZE
                            );

                            return displayDeposits.map((depositRaw, index) => {
                              const deposit = mergeDeposit(
                                depositRaw as ItemWithNetwork
                              ) as ItemWithNetwork;
                              // Get market label using the deposit's network, not currentNetwork
                              const depositNetworkForMarket =
                                (deposit as ItemWithNetwork).network || currentNetwork;
                              const depositMarketLabel = getMarketLabel(
                                depositNetworkForMarket,
                                deposit.poolId
                              );

                              const market = marketRowForPortfolioPosition(
                                marketData,
                                {
                                  marketId: (deposit as ItemWithNetwork).marketId,
                                  poolId: deposit.poolId,
                                  displaySymbol: deposit.asset,
                                }
                              );

                              const depositCapReached = isAtDepositCap(
                                Number(market?.totalDeposits ?? 0),
                                Number(market?.maxTotalDeposits ?? 0),
                              );

                              const depositNetworkForToken =
                                (deposit as ItemWithNetwork).network || currentNetwork;

                              const rewardConfigKey =
                                (deposit as ItemWithNetwork).configSymbol ??
                                (deposit as ItemWithNetwork).originalSymbol ??
                                deposit.asset;
                              const rewardBonusApr = getRewardsBonusSupplyAprPercent(
                                depositNetworkForToken as NetworkId,
                                rewardConfigKey,
                                deposit.poolId != null
                                  ? String(deposit.poolId)
                                  : undefined,
                                rewardsAprByBaseUrl
                              );
                              const intrinsicApr =
                                resolveIntrinsicSupplyApyPercent(
                                  depositNetworkForToken as NetworkId,
                                  rewardConfigKey,
                                  deposit.poolId != null
                                    ? String(deposit.poolId)
                                    : undefined,
                                  liveIntrinsicSupplyApy
                                );

                              // Get network name from deposit or infer
                              let networkName = "Unknown";
                              const depositNetwork = (deposit as ItemWithNetwork).network;
                              if (depositNetwork) {
                                // Format network name: "algorand-mainnet" -> "Algorand", "voi-mainnet" -> "VOI"
                                const normalized = depositNetwork.toLowerCase();
                                if (normalized.includes("algorand")) {
                                  networkName = "Algorand";
                                } else if (normalized.includes("voi")) {
                                  networkName = "VOI";
                                } else {
                                  // Fallback to formatted name
                                  networkName = depositNetwork
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1)
                                    )
                                    .join(" ");
                                }
                              } else if (
                                positionsNetworkFilter === "all"
                              ) {
                                // Fallback: try to infer from networkValues
                                const matchingNetwork = Object.entries(
                                  user.computed.networkValues
                                ).find(([network, values]: [string, unknown]) => {
                                  // Simple heuristic: if deposit value is close to network collateral, it might belong there
                                  return (
                                    Math.abs(
                                      values.collateral - deposit.value
                                    ) <
                                    values.collateral * 0.1
                                  );
                                });
                                if (matchingNetwork) {
                                  const network = matchingNetwork[0];
                                  const normalized = network.toLowerCase();
                                  if (normalized.includes("algorand")) {
                                    networkName = "Algorand";
                                  } else if (normalized.includes("voi")) {
                                    networkName = "VOI";
                                  } else {
                                    // Fallback to formatted name
                                    networkName = network
                                      .split("-")
                                      .map(
                                        (word) =>
                                          word.charAt(0).toUpperCase() +
                                          word.slice(1)
                                      )
                                      .join(" ");
                                  }
                                }
                              }

                              const depositDesktopChainKey =
                                portfolioPositionChainKey(
                                  "deposit",
                                  String(
                                    (deposit as ItemWithNetwork).network ||
                                      currentNetwork ||
                                      ""
                                  ),
                                  String(deposit.poolId ?? ""),
                                  deposit.asset,
                                  (deposit as ItemWithNetwork).marketId
                                );

                              return (
                                <TableRow
                                  key={index}
                                  ref={attachChainPollRow(
                                    depositDesktopChainKey
                                  )}
                                  className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20"
                                >
                                  <TableCell className="min-w-0">
                                    <div className="flex flex-col items-center gap-1 min-w-0">
                                      <MarketRowTokenIcon
                                        market={{
                                          icon: deposit.icon,
                                          asset: deposit.asset,
                                          iconBadgeUrl: (
                                            deposit as { iconBadgeUrl?: string }
                                          ).iconBadgeUrl,
                                        }}
                                        poolLetterLabel={
                                          depositMarketLabel ?? null
                                        }
                                        imgClassName="w-8 h-8 shrink-0 rounded-full object-contain"
                                      />
                                      <span className="font-medium truncate text-center">
                                        {deposit.asset}
                                      </span>
                                      {shouldShowConfigSymbolUnderDisplayAsset(
                                        deposit.asset,
                                        (deposit as ItemWithNetwork).configSymbol
                                      ) && (
                                          <span className="text-[10px] text-muted-foreground truncate text-center max-w-[5rem] leading-tight">
                                            {
                                              (deposit as ItemWithNetwork)
                                                .configSymbol
                                            }
                                          </span>
                                        )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-center">
                                    {networkName}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {depositMarketLabel || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {formatNumber(deposit.balance, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 6,
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(deposit.value, "USD", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    <div className="flex flex-col gap-0.5 items-end">
                                      <span className="text-green-600 dark:text-green-400">
                                        {formatPercent(deposit.apy / 100, {
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                      {intrinsicApr > 0 ? (
                                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                                          +{intrinsicApr.toFixed(2)}%
                                        </span>
                                      ) : null}
                                      {rewardBonusApr > 0 ? (
                                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                                          +{rewardBonusApr.toFixed(2)}%
                                        </span>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {deposit.accruedInterest > 0 ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                          {formatNumber(deposit.accruedInterest, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                          })}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatCurrency(
                                            deposit.accruedInterestValue ||
                                            deposit.accruedInterest *
                                            (deposit.tokenPrice || 1),
                                            "USD",
                                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                          )}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap w-[1%]">
                                    <div className="flex items-center gap-2">
                                      {!isViewOnly && (
                                        <>
                                          {!market?.isPaused && (
                                            <DorkFiButton
                                              size="sm"
                                              variant="secondary"
                                              onMouseEnter={() =>
                                                prefetchDepositOnHover(
                                                  deposit.asset,
                                                  deposit.poolId,
                                                  (deposit as ItemWithNetwork).network,
                                                  (deposit as ItemWithNetwork).configSymbol,
                                                  (deposit as ItemWithNetwork).marketId
                                                )
                                              }
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (depositCapReached) return;
                                                handleDepositClick(
                                                  deposit.asset,
                                                  deposit.poolId,
                                                  (deposit as ItemWithNetwork).network,
                                                  (deposit as ItemWithNetwork).configSymbol,
                                                  (deposit as ItemWithNetwork).marketId
                                                );
                                              }}
                                              disabled={depositCapReached}
                                              title={
                                                depositCapReached
                                                  ? "Market at deposit cap"
                                                  : "Supply more of this asset to earn yield and use as collateral"
                                              }
                                              aria-label="Supply"
                                              className="min-w-[92px] h-8 shrink-0 px-2 gap-1"
                                            >
                                              <span className="text-base leading-none">+</span>
                                              <span className="hidden lg:inline text-xs">Supply</span>
                                            </DorkFiButton>
                                          )}
                                          <DorkFiButton
                                            size="sm"
                                            variant="withdraw"
                                            onMouseEnter={() =>
                                              prefetchWithdrawModalData(
                                                deposit.asset,
                                                deposit.poolId,
                                                (deposit as ItemWithNetwork).network,
                                                (deposit as ItemWithNetwork).marketId,
                                                (deposit as ItemWithNetwork).configSymbol
                                              )
                                            }
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleWithdrawClick(
                                                deposit.asset,
                                                deposit.poolId,
                                                (deposit as ItemWithNetwork).network,
                                                (deposit as ItemWithNetwork).marketId,
                                                (deposit as ItemWithNetwork).configSymbol
                                              );
                                            }}
                                            title="Withdraw this asset back to your wallet"
                                            aria-label="Withdraw"
                                            className="min-w-[92px] h-8 shrink-0 px-2 gap-1"
                                          >
                                            <span className="text-base leading-none">−</span>
                                            <span className="hidden lg:inline text-xs">Withdraw</span>
                                          </DorkFiButton>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                            );
                          });
                        })()}
                        {deposits.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                className="text-center text-muted-foreground py-8"
                              >
                                No supplied assets
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!isMobile &&
                    (() => {
                      const filteredAndSorted = deposits
                        .filter(positionPassesPortfolioFilters)
                        .sort((a, b) => {
                          let comparison = 0;

                          switch (suppliedAssetsSort.column) {
                            case "network":
                              const networkA = (
                                (a as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              const networkB = (
                                (b as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              comparison = networkA.localeCompare(networkB);
                              break;
                            case "asset":
                              comparison = a.asset.localeCompare(b.asset);
                              break;
                            case "supplied":
                              comparison = a.balance - b.balance;
                              break;
                            case "value":
                              comparison = a.value - b.value;
                              break;
                            case "apy":
                              comparison = a.apy - b.apy;
                              break;
                            case "accruedInterest":
                              comparison =
                                accruedInterestUsdForSort(
                                  a as ItemWithNetwork
                                ) -
                                accruedInterestUsdForSort(
                                  b as ItemWithNetwork
                                );
                              break;
                            default:
                              comparison = a.apy - b.apy;
                              break;
                          }

                          return suppliedAssetsSort.direction === "asc"
                            ? comparison
                            : -comparison;
                        });

                      return (
                        <PortfolioAssetListPagination
                          currentPage={suppliedAssetsPage}
                          onPageChange={setSuppliedAssetsPage}
                          totalItems={filteredAndSorted.length}
                          pageSize={ASSET_LIST_PAGE_SIZE}
                          scrollToRef={suppliedAssetsTableRef}
                        />
                      );
                    })()}
                </div>
              )}

              {borrows.length > 0 && (
                <div
                  ref={borrowedAssetsTableRef}
                  className={cn(
                    hasBothPositionTypes &&
                      portfolioPositionsTab === "supplied" &&
                      "hidden"
                  )}
                >
                  {/* Mobile Card View */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {(() => {
                        const filteredAndSorted = borrows
                          .filter(positionPassesPortfolioFilters)
                          .sort((a, b) => {
                            let comparison = 0;
                            switch (borrowedAssetsSort.column) {
                              case "value":
                                comparison = a.value - b.value;
                                break;
                              case "apy":
                                comparison = a.apy - b.apy;
                                break;
                              case "borrowed":
                                comparison = a.balance - b.balance;
                                break;
                              default:
                                comparison = a.apy - b.apy;
                            }
                            return borrowedAssetsSort.direction === "asc"
                              ? comparison
                              : -comparison;
                          });

                        const displayBorrows = sliceAssetListPage(
                          filteredAndSorted,
                          borrowedAssetsPage,
                          ASSET_LIST_PAGE_SIZE
                        );

                        if (displayBorrows.length === 0) {
                          return (
                            <PortfolioPositionsFilteredEmptyState
                              totalCount={borrows.length}
                              entityLabel="borrowed assets"
                              onClearFilters={clearPositionsFilters}
                            />
                          );
                        }

                        return (
                          <>
                            {displayBorrows.map((borrowRaw) => {
                              const borrow = mergeBorrow(
                                borrowRaw as ItemWithNetwork
                              ) as ItemWithNetwork;
                              const borrowNet =
                                (borrow as ItemWithNetwork).network ||
                                currentNetwork ||
                                "";
                              const borrowChainPollKey =
                                portfolioPositionChainKey(
                                  "borrow",
                                  String(borrowNet),
                                  String(borrow.poolId ?? ""),
                                  borrow.asset,
                                  (borrow as ItemWithNetwork).marketId
                                );
                              const market = marketRowForPortfolioPosition(
                                marketData,
                                {
                                  marketId: (borrow as ItemWithNetwork).marketId,
                                  poolId: borrow.poolId,
                                  displaySymbol: borrow.asset,
                                }
                              ) as any;
                              const borrowCapReached =
                                market &&
                                isAtBorrowCap(
                                  Number(market?.totalBorrows ?? 0),
                                  Number(market?.maxTotalBorrows ?? 0),
                                );
                              const liquidationThreshold =
                                market?.liquidationThreshold || 0.85;
                              const liquidationThresholdNum =
                                typeof liquidationThreshold === "string"
                                  ? parseFloat(liquidationThreshold)
                                  : typeof liquidationThreshold === "bigint"
                                    ? Number(liquidationThreshold)
                                    : liquidationThreshold;
                              const normalizedThreshold =
                                liquidationThresholdNum > 1 &&
                                  liquidationThresholdNum <= 100
                                  ? liquidationThresholdNum / 100
                                  : liquidationThresholdNum > 100
                                    ? liquidationThresholdNum / 10000
                                    : liquidationThresholdNum;

                              const liquidationPrice =
                                SHOW_LIQUIDATION_PRICE_IN_BORROWED
                                  ? (() => {
                                      const currentPrice =
                                        borrow.tokenPrice || 1;
                                      const requiredCollateralForThisBorrow =
                                        borrow.value / normalizedThreshold;
                                      const borrowRatio =
                                        totalBorrowed > 0
                                          ? borrow.value / totalBorrowed
                                          : 0;
                                      return totalCollateral > 0
                                        ? currentPrice *
                                            (requiredCollateralForThisBorrow /
                                              (totalCollateral * borrowRatio ||
                                                1))
                                        : currentPrice / normalizedThreshold;
                                    })()
                                  : undefined;

                              return (
                                <div
                                  key={`${borrow.asset}-${borrow.poolId || "default"
                                    }`}
                                  ref={attachChainPollRow(borrowChainPollKey)}
                                >
                                <PortfolioTableMobileCard
                                  asset={borrow.asset}
                                  configSymbol={
                                    (borrow as ItemWithNetwork).configSymbol
                                  }
                                  icon={borrow.icon}
                                  iconBadgeUrl={
                                    (borrow as { iconBadgeUrl?: string })
                                      .iconBadgeUrl
                                  }
                                  value={borrow.value}
                                  balance={borrow.balance}
                                  apy={borrow.apy}
                                  accruedInterest={
                                    (borrow as ItemWithNetwork).accruedInterest ||
                                    (borrow as ItemWithNetwork).interest
                                  }
                                  accruedInterestValue={
                                    (borrow as ItemWithNetwork).accruedInterestValue
                                  }
                                  liquidationPrice={liquidationPrice}
                                  network={(borrow as ItemWithNetwork).network}
                                  poolId={borrow.poolId}
                                  borrowDisabled={borrowCapReached}
                                  onDepositClick={
                                    !isViewOnly && !market?.isPaused
                                      ? () =>
                                        handleBorrowClick(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as ItemWithNetwork).network,
                                          (borrow as ItemWithNetwork).configSymbol,
                                          (borrow as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  onDepositMouseEnter={
                                    !isViewOnly
                                      ? () =>
                                        prefetchBorrowOnHover(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as ItemWithNetwork).network,
                                          (borrow as ItemWithNetwork).configSymbol,
                                          (borrow as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  onWithdrawClick={
                                    !isViewOnly
                                      ? () =>
                                        handleRepayClick(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as ItemWithNetwork).network,
                                          (borrow as ItemWithNetwork).configSymbol,
                                          (borrow as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  onWithdrawMouseEnter={
                                    !isViewOnly
                                      ? () =>
                                        prefetchRepayOnHover(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as ItemWithNetwork).network,
                                          (borrow as ItemWithNetwork).configSymbol,
                                          (borrow as ItemWithNetwork).marketId
                                        )
                                      : undefined
                                  }
                                  type="borrow"
                                />
                                </div>
                              );
                            })}
                            <PortfolioAssetListPagination
                              currentPage={borrowedAssetsPage}
                              onPageChange={setBorrowedAssetsPage}
                              totalItems={filteredAndSorted.length}
                              pageSize={ASSET_LIST_PAGE_SIZE}
                              scrollToRef={borrowedAssetsTableRef}
                            />
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (borrowedAssetsSort.column === "asset") {
                                    setBorrowedAssetsSort({
                                      column: "asset",
                                      direction:
                                        borrowedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setBorrowedAssetsSort({
                                      column: "asset",
                                      direction: "asc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Asset
                                {borrowedAssetsSort.column === "asset" ? (
                                  borrowedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-center">
                              Network
                            </TableHead>
                            <TableHead className="text-center">
                              Market
                            </TableHead>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (
                                    borrowedAssetsSort.column === "borrowed"
                                  ) {
                                    setBorrowedAssetsSort({
                                      column: "borrowed",
                                      direction:
                                        borrowedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setBorrowedAssetsSort({
                                      column: "borrowed",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Borrowed
                                {borrowedAssetsSort.column === "borrowed" ? (
                                  borrowedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (borrowedAssetsSort.column === "value") {
                                    setBorrowedAssetsSort({
                                      column: "value",
                                      direction:
                                        borrowedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setBorrowedAssetsSort({
                                      column: "value",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Value (USD)
                                {borrowedAssetsSort.column === "value" ? (
                                  borrowedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-right">
                              <button
                                onClick={() => {
                                  if (borrowedAssetsSort.column === "apy") {
                                    setBorrowedAssetsSort({
                                      column: "apy",
                                      direction:
                                        borrowedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setBorrowedAssetsSort({
                                      column: "apy",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex w-full items-center justify-end gap-1 hover:text-foreground transition-colors"
                              >
                                APY
                                {borrowedAssetsSort.column === "apy" ? (
                                  borrowedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead className="text-right">
                              <button
                                onClick={() => {
                                  if (
                                    borrowedAssetsSort.column ===
                                    "accruedInterest"
                                  ) {
                                    setBorrowedAssetsSort({
                                      column: "accruedInterest",
                                      direction:
                                        borrowedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setBorrowedAssetsSort({
                                      column: "accruedInterest",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex w-full items-center justify-end gap-1 hover:text-foreground transition-colors"
                              >
                                Accrued Interest
                                {borrowedAssetsSort.column ===
                                  "accruedInterest" ? (
                                  borrowedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            {SHOW_LIQUIDATION_PRICE_IN_BORROWED && (
                              <TableHead className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  Liquidation Price
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-semibold mb-1">
                                        Liquidation Price
                                      </p>
                                      <p className="text-sm mb-2">
                                        The estimated price at which your
                                        collateral would need to drop to trigger
                                        liquidation for this borrowed position.
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Liquidation occurs when: Collateral Value
                                        × Liquidation Threshold &lt; Borrowed
                                        Value
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        This is calculated based on your total
                                        collateral and the asset's liquidation
                                        threshold (typically 85%).
                                      </p>
                                    </TooltipContent>
                                  </UITooltip>
                                </div>
                              </TableHead>
                            )}
                            <TableHead className="whitespace-nowrap w-[1%]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const filteredAndSorted = borrows
                              .filter(positionPassesPortfolioFilters)
                              .sort((a, b) => {
                                let comparison = 0;

                                switch (borrowedAssetsSort.column) {
                                  case "network":
                                    const networkA = (
                                      (a as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    const networkB = (
                                      (b as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    comparison =
                                      networkA.localeCompare(networkB);
                                    break;
                                  case "asset":
                                    comparison = a.asset.localeCompare(b.asset);
                                    break;
                                  case "borrowed":
                                    comparison = a.balance - b.balance;
                                    break;
                                  case "value":
                                    comparison = a.value - b.value;
                                    break;
                                  case "apy":
                                    comparison = a.apy - b.apy;
                                    break;
                                  case "accruedInterest":
                                    comparison =
                                      accruedInterestUsdForSort(
                                        a as ItemWithNetwork
                                      ) -
                                      accruedInterestUsdForSort(
                                        b as ItemWithNetwork
                                      );
                                    break;
                                  default:
                                    comparison = a.apy - b.apy;
                                    break;
                                }

                                return borrowedAssetsSort.direction === "asc"
                                  ? comparison
                                  : -comparison;
                              });

                            const displayBorrows = sliceAssetListPage(
                              filteredAndSorted,
                              borrowedAssetsPage,
                              ASSET_LIST_PAGE_SIZE
                            );

                            return displayBorrows.map((borrowRaw, index) => {
                              const borrow = mergeBorrow(
                                borrowRaw as ItemWithNetwork
                              ) as ItemWithNetwork;
                              const market = marketRowForPortfolioPosition(
                                marketData,
                                {
                                  marketId: (borrow as ItemWithNetwork).marketId,
                                  poolId: borrow.poolId,
                                  displaySymbol: borrow.asset,
                                }
                              ) as any;
                              const borrowCapReached =
                                market &&
                                isAtBorrowCap(
                                  Number(market?.totalBorrows ?? 0),
                                  Number(market?.maxTotalBorrows ?? 0),
                                );
                              const liquidationThreshold =
                                market?.liquidationThreshold || 0.85;

                              // Calculate market label using the borrow's network, not currentNetwork
                              const borrowNetwork =
                                (borrow as ItemWithNetwork).network || currentNetwork;
                              const borrowMarketLabel = getMarketLabel(
                                borrowNetwork,
                                borrow.poolId
                              );

                              const liquidationPrice =
                                SHOW_LIQUIDATION_PRICE_IN_BORROWED
                                  ? (() => {
                                      const currentPrice =
                                        borrow.tokenPrice || 1;
                                      const borrowRatio =
                                        totalBorrowed > 0
                                          ? borrow.value / totalBorrowed
                                          : 0;
                                      const requiredCollateralForThisBorrow =
                                        borrow.value / liquidationThreshold;
                                      return totalCollateral > 0
                                        ? currentPrice *
                                            (requiredCollateralForThisBorrow /
                                              (totalCollateral * borrowRatio ||
                                                1))
                                        : currentPrice / liquidationThreshold;
                                    })()
                                  : undefined;

                              // Get network name from borrow or infer
                              let networkName = "Unknown";
                              // borrowNetwork is already declared above
                              if (borrowNetwork) {
                                // Format network name: "algorand-mainnet" -> "Algorand", "voi-mainnet" -> "VOI"
                                const normalized = borrowNetwork.toLowerCase();
                                if (normalized.includes("algorand")) {
                                  networkName = "Algorand";
                                } else if (normalized.includes("voi")) {
                                  networkName = "VOI";
                                } else {
                                  // Fallback to formatted name
                                  networkName = borrowNetwork
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1)
                                    )
                                    .join(" ");
                                }
                              } else if (
                                positionsNetworkFilter === "all"
                              ) {
                                // Fallback: try to infer from networkValues
                                const matchingNetwork = Object.entries(
                                  user.computed.networkValues
                                ).find(([network, values]: [string, unknown]) => {
                                  return (
                                    Math.abs(values.borrow - borrow.value) <
                                    values.borrow * 0.1
                                  );
                                });
                                if (matchingNetwork) {
                                  const network = matchingNetwork[0];
                                  const normalized = network.toLowerCase();
                                  if (normalized.includes("algorand")) {
                                    networkName = "Algorand";
                                  } else if (normalized.includes("voi")) {
                                    networkName = "VOI";
                                  } else {
                                    // Fallback to formatted name
                                    networkName = network
                                      .split("-")
                                      .map(
                                        (word) =>
                                          word.charAt(0).toUpperCase() +
                                          word.slice(1)
                                      )
                                      .join(" ");
                                  }
                                }
                              }

                              const borrowDesktopChainKey =
                                portfolioPositionChainKey(
                                  "borrow",
                                  String(
                                    (borrow as ItemWithNetwork).network ||
                                      currentNetwork ||
                                      ""
                                  ),
                                  String(borrow.poolId ?? ""),
                                  borrow.asset,
                                  (borrow as ItemWithNetwork).marketId
                                );

                              return (
                                <TableRow
                                  key={index}
                                  ref={attachChainPollRow(borrowDesktopChainKey)}
                                  className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20"
                                >
                                  <TableCell className="min-w-0">
                                    <div className="flex flex-col items-center gap-1 min-w-0">
                                      <MarketRowTokenIcon
                                        market={{
                                          icon: borrow.icon,
                                          asset: borrow.asset,
                                          iconBadgeUrl: (
                                            borrow as { iconBadgeUrl?: string }
                                          ).iconBadgeUrl,
                                        }}
                                        poolLetterLabel={
                                          borrowMarketLabel ?? null
                                        }
                                        imgClassName="w-8 h-8 shrink-0 rounded-full object-contain"
                                      />
                                      <span className="font-medium truncate text-center">
                                        {borrow.asset}
                                      </span>
                                      {shouldShowConfigSymbolUnderDisplayAsset(
                                        borrow.asset,
                                        (borrow as ItemWithNetwork).configSymbol
                                      ) && (
                                          <span className="text-[10px] text-muted-foreground truncate text-center max-w-[5rem] leading-tight">
                                            {
                                              (borrow as ItemWithNetwork)
                                                .configSymbol
                                            }
                                          </span>
                                        )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-center">
                                    {networkName}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {borrowMarketLabel || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {formatNumber(borrow.balance, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 6,
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(borrow.value, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    <div className="flex flex-col gap-0.5 items-end">
                                      <span className="text-red-600 dark:text-red-400">
                                        {formatPercent(borrow.apy / 100, { maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {borrow.accruedInterest > 0 ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                          {formatNumber(borrow.accruedInterest, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                          })}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatCurrency(
                                            borrow.accruedInterestValue ||
                                            borrow.accruedInterest *
                                            (borrow.tokenPrice || 1),
                                            "USD",
                                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                          )}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  {SHOW_LIQUIDATION_PRICE_IN_BORROWED &&
                                    liquidationPrice !== undefined && (
                                      <TableCell className="text-right tabular-nums">
                                        <span className="text-sm">
                                          {formatCurrency(liquidationPrice, "USD", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 4,
                                          })}
                                        </span>
                                      </TableCell>
                                    )}
                                  <TableCell className="whitespace-nowrap w-[1%]">
                                    <div className="flex items-center gap-2">
                                      {!isViewOnly && (
                                        <>
                                          {!market?.isPaused && (
                                            <DorkFiButton
                                              size="sm"
                                              variant="borrow-outline"
                                              onMouseEnter={() =>
                                                prefetchBorrowOnHover(
                                                  borrow.asset,
                                                  borrow.poolId,
                                                  (borrow as ItemWithNetwork).network,
                                                  (borrow as ItemWithNetwork).configSymbol,
                                                  (borrow as ItemWithNetwork).marketId
                                                )
                                              }
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (borrowCapReached) return;
                                                handleBorrowClick(
                                                  borrow.asset,
                                                  borrow.poolId,
                                                  (borrow as ItemWithNetwork).network,
                                                  (borrow as ItemWithNetwork).configSymbol,
                                                  (borrow as ItemWithNetwork).marketId
                                                );
                                              }}
                                              disabled={borrowCapReached}
                                              title={
                                                borrowCapReached
                                                  ? "Market at borrow cap"
                                                  : "Borrow more of this asset against your collateral"
                                              }
                                              aria-label="Borrow"
                                              className="min-w-[92px] h-8 shrink-0 px-2 gap-1"
                                            >
                                              <span className="text-base leading-none">+</span>
                                              <span className="hidden lg:inline text-xs">Borrow</span>
                                            </DorkFiButton>
                                          )}
                                          <DorkFiButton
                                            size="sm"
                                            variant="danger-outline"
                                            onMouseEnter={() =>
                                              prefetchRepayOnHover(
                                                borrow.asset,
                                                borrow.poolId,
                                                (borrow as ItemWithNetwork).network,
                                                (borrow as ItemWithNetwork).configSymbol,
                                                (borrow as ItemWithNetwork).marketId
                                              )
                                            }
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRepayClick(
                                                borrow.asset,
                                                borrow.poolId,
                                                (borrow as ItemWithNetwork).network,
                                                (borrow as ItemWithNetwork).configSymbol,
                                                (borrow as ItemWithNetwork).marketId
                                              );
                                            }}
                                            title="Repay this debt to improve health factor"
                                            aria-label="Repay"
                                            className="min-w-[92px] h-8 shrink-0 px-2 gap-1"
                                          >
                                            <span className="text-base leading-none">−</span>
                                            <span className="hidden lg:inline text-xs">Repay</span>
                                          </DorkFiButton>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                          {borrows.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={
                                  SHOW_LIQUIDATION_PRICE_IN_BORROWED ? 9 : 8
                                }
                                className="text-center text-muted-foreground py-8"
                              >
                                No borrowed assets
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!isMobile &&
                    (() => {
                      const filteredAndSorted = borrows
                        .filter(positionPassesPortfolioFilters)
                        .sort((a, b) => {
                          let comparison = 0;

                          switch (borrowedAssetsSort.column) {
                            case "network":
                              const networkA = (
                                (a as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              const networkB = (
                                (b as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              comparison = networkA.localeCompare(networkB);
                              break;
                            case "asset":
                              comparison = a.asset.localeCompare(b.asset);
                              break;
                            case "borrowed":
                              comparison = a.balance - b.balance;
                              break;
                            case "value":
                              comparison = a.value - b.value;
                              break;
                            case "apy":
                              comparison = a.apy - b.apy;
                              break;
                            case "accruedInterest":
                              comparison =
                                accruedInterestUsdForSort(
                                  a as ItemWithNetwork
                                ) -
                                accruedInterestUsdForSort(
                                  b as ItemWithNetwork
                                );
                              break;
                            default:
                              comparison = a.apy - b.apy;
                              break;
                          }

                          return borrowedAssetsSort.direction === "asc"
                            ? comparison
                            : -comparison;
                        });

                      return (
                        <PortfolioAssetListPagination
                          currentPage={borrowedAssetsPage}
                          onPageChange={setBorrowedAssetsPage}
                          totalItems={filteredAndSorted.length}
                          pageSize={ASSET_LIST_PAGE_SIZE}
                          scrollToRef={borrowedAssetsTableRef}
                        />
                      );
                    })()}
                </div>
              )}
                </DorkFiCard>
              )}

              {/* At Risk Assets Table */}
              {atRiskAssets.length > 0 &&
                (() => {
                  // Check if any asset has non-zero pool borrows
                  const hasPoolBorrows = atRiskAssets.some(
                    (asset) => asset.poolBorrowsUSD > 0
                  );

                  return (
                    <DorkFiCard
                      className={cn(
                        "p-6 md:p-8 border-orange-500/50 bg-orange-500/5",
                        hasBothPositionTypes && "order-2 lg:order-3"
                      )}
                    >
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                            <H1 className="text-xl md:text-2xl text-orange-500">
                              At Risk Assets
                            </H1>
                          </div>
                          <DorkFiButton
                            onClick={handleRefreshAtRiskAssets}
                            disabled={refreshingSection === "At Risk Assets"}
                            variant="secondary"
                            size="sm"
                            className="min-w-0"
                            title={
                              isViewOnly
                                ? "Refresh market data (view-only mode)"
                                : "Refresh market data for at risk assets"
                            }
                          >
                            <RefreshCw
                              className={`w-3 h-3 mr-1.5 ${refreshingSection === "At Risk Assets"
                                ? "animate-spin"
                                : ""
                                }`}
                            />
                            Refresh
                          </DorkFiButton>
                        </div>
                        <Body className="text-sm text-muted-foreground">
                          These assets have a health factor (collateral value ×
                          liquidation factor / total borrows) less than 1.0,
                          indicating potential liquidation risk.
                        </Body>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (atRiskAssetsSort.column === "asset") {
                                      setAtRiskAssetsSort({
                                        column: "asset",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "asset",
                                        direction: "asc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Asset
                                  {atRiskAssetsSort.column === "asset" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (atRiskAssetsSort.column === "network") {
                                      setAtRiskAssetsSort({
                                        column: "network",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "network",
                                        direction: "asc",
                                      });
                                    }
                                  }}
                                  className="flex items-center justify-center gap-1 hover:text-foreground transition-colors w-full"
                                >
                                  Network
                                  {atRiskAssetsSort.column === "network" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead>Market</TableHead>
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (atRiskAssetsSort.column === "value") {
                                      setAtRiskAssetsSort({
                                        column: "value",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "value",
                                        direction: "desc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Value (USD)
                                  {atRiskAssetsSort.column === "value" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (
                                      atRiskAssetsSort.column ===
                                      "liquidationFactor"
                                    ) {
                                      setAtRiskAssetsSort({
                                        column: "liquidationFactor",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "liquidationFactor",
                                        direction: "desc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Liquidation Factor
                                  {atRiskAssetsSort.column ===
                                    "liquidationFactor" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (
                                      atRiskAssetsSort.column === "depositValue"
                                    ) {
                                      setAtRiskAssetsSort({
                                        column: "depositValue",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "depositValue",
                                        direction: "desc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Deposit Value
                                  {atRiskAssetsSort.column ===
                                    "depositValue" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              {hasPoolBorrows && (
                                <TableHead>
                                  <button
                                    onClick={() => {
                                      if (
                                        atRiskAssetsSort.column ===
                                        "borrowValue"
                                      ) {
                                        setAtRiskAssetsSort({
                                          column: "borrowValue",
                                          direction:
                                            atRiskAssetsSort.direction === "asc"
                                              ? "desc"
                                              : "asc",
                                        });
                                      } else {
                                        setAtRiskAssetsSort({
                                          column: "borrowValue",
                                          direction: "desc",
                                        });
                                      }
                                    }}
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                  >
                                    Borrow Value
                                    {atRiskAssetsSort.column ===
                                      "borrowValue" ? (
                                      atRiskAssetsSort.direction === "asc" ? (
                                        <ArrowUp className="w-3 h-3" />
                                      ) : (
                                        <ArrowDown className="w-3 h-3" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                                    )}
                                  </button>
                                </TableHead>
                              )}
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (
                                      atRiskAssetsSort.column === "riskRatio"
                                    ) {
                                      setAtRiskAssetsSort({
                                        column: "riskRatio",
                                        direction:
                                          atRiskAssetsSort.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAtRiskAssetsSort({
                                        column: "riskRatio",
                                        direction: "asc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Health Factor
                                  {atRiskAssetsSort.column === "riskRatio" ? (
                                    atRiskAssetsSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Sort at-risk assets based on selected column
                              const sortedAtRiskAssets = [...atRiskAssets].sort(
                                (a, b) => {
                                  let comparison = 0;

                                  switch (atRiskAssetsSort.column) {
                                    case "asset":
                                      comparison = a.asset.localeCompare(
                                        b.asset
                                      );
                                      break;
                                    case "network":
                                      const networkA = (
                                        (a as ItemWithNetwork).network || "Unknown"
                                      ).toLowerCase();
                                      const networkB = (
                                        (b as ItemWithNetwork).network || "Unknown"
                                      ).toLowerCase();
                                      comparison =
                                        networkA.localeCompare(networkB);
                                      break;
                                    case "value":
                                      comparison = a.value - b.value;
                                      break;
                                    case "liquidationFactor":
                                      comparison =
                                        a.liquidationFactor -
                                        b.liquidationFactor;
                                      break;
                                    case "depositValue":
                                      comparison =
                                        a.poolCollateralValueUSD -
                                        b.poolCollateralValueUSD;
                                      break;
                                    case "borrowValue":
                                      comparison =
                                        a.poolBorrowsUSD - b.poolBorrowsUSD;
                                      break;
                                    case "riskRatio":
                                    default:
                                      comparison = a.riskRatio - b.riskRatio;
                                      break;
                                  }

                                  return atRiskAssetsSort.direction === "asc"
                                    ? comparison
                                    : -comparison;
                                }
                              );

                              const filteredAtRiskAssets =
                                sortedAtRiskAssets.filter(
                                  positionPassesPortfolioFilters
                                );

                              return filteredAtRiskAssets.map(
                                (asset, index) => {
                                  // Get market label using the asset's network, not currentNetwork
                                  const assetNetwork =
                                    (asset as ItemWithNetwork).network || currentNetwork;
                                  const marketLabel = getMarketLabel(
                                    assetNetwork,
                                    asset.poolId
                                  );

                                  return (
                                    <TableRow
                                      key={`${asset.asset}-${asset.poolId || index
                                        }`}
                                      className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-orange-400 hover:shadow-[0_0_16px_4px_rgba(249,115,22,0.15)] hover:bg-orange-500/5 hover:z-20 cursor-pointer"
                                    >
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <MarketRowTokenIcon
                                            market={{
                                              icon: asset.icon,
                                              asset: asset.asset,
                                              iconBadgeUrl: (
                                                asset as { iconBadgeUrl?: string }
                                              ).iconBadgeUrl,
                                            }}
                                            poolLetterLabel={marketLabel}
                                            imgClassName="h-6 w-6 shrink-0 rounded-full object-contain"
                                          />
                                          <span className="font-medium">
                                            {asset.asset}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(() => {
                                          const depositNetwork = (asset as ItemWithNetwork)
                                            .network;
                                          if (depositNetwork) {
                                            // Format network name: "algorand-mainnet" -> "Algorand", "voi-mainnet" -> "VOI"
                                            const normalized =
                                              depositNetwork.toLowerCase();
                                            if (
                                              normalized.includes("algorand")
                                            ) {
                                              return "Algorand";
                                            } else if (
                                              normalized.includes("voi")
                                            ) {
                                              return "VOI";
                                            } else {
                                              // Fallback to formatted name
                                              return depositNetwork
                                                .split("-")
                                                .map(
                                                  (word) =>
                                                    word
                                                      .charAt(0)
                                                      .toUpperCase() +
                                                    word.slice(1)
                                                )
                                                .join(" ");
                                            }
                                          }
                                          return "Unknown";
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {marketLabel || "-"}
                                      </TableCell>
                                      <TableCell>
                                        $
                                        {formatNumber(asset.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                      <TableCell>
                                        {formatPercent(asset.liquidationFactor, { maximumFractionDigits: 1 })}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-muted-foreground">
                                          {formatCurrency(asset.poolCollateralValueUSD, "USD", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </TableCell>
                                      {hasPoolBorrows && (
                                        <TableCell>
                                          <span className="text-muted-foreground">
                                            {formatCurrency(asset.poolBorrowsUSD, "USD",
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              }
                                            )}
                                          </span>
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        <span
                                          className={`font-semibold ${asset.riskRatio < 0.5
                                            ? "text-red-500"
                                            : asset.riskRatio < 0.75
                                              ? "text-orange-500"
                                              : "text-yellow-500"
                                            }`}
                                        >
                                          {formatNumber(asset.riskRatio, { maximumFractionDigits: 3 })}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {!isViewOnly && (() => {
                                            const atRiskMarket =
                                              marketRowForPortfolioPosition(
                                                marketData,
                                                {
                                                  marketId: (asset as ItemWithNetwork)
                                                    .marketId,
                                                  poolId: asset.poolId,
                                                  displaySymbol: asset.asset,
                                                }
                                              ) as any;
                                            const depositCapReached =
                                              atRiskMarket &&
                                              isAtDepositCap(
                                                Number(atRiskMarket?.totalDeposits ?? 0),
                                                Number(atRiskMarket?.maxTotalDeposits ?? 0),
                                              );
                                            return !atRiskMarket?.isPaused && (
                                              <DorkFiButton
                                                variant="secondary"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDepositClick(
                                                    asset.asset,
                                                    asset.poolId,
                                                    (asset as ItemWithNetwork).network,
                                                    (asset as ItemWithNetwork).configSymbol,
                                                    (asset as ItemWithNetwork).marketId
                                                  );
                                                }}
                                                disabled={depositCapReached}
                                                title={
                                                  depositCapReached
                                                    ? "Market at deposit cap"
                                                    : "Supply more of this asset to earn yield and use as collateral"
                                                }
                                                aria-label="Supply"
                                                className="min-w-[92px] h-8 px-2 gap-1"
                                              >
                                                <span className="text-base leading-none">+</span>
                                                <span className="hidden lg:inline text-xs">Supply</span>
                                              </DorkFiButton>
                                            );
                                          })()}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </DorkFiCard>
                  );
                })()}

              {/* Accrued Interest Table */}
              {SHOW_ACCRUED_INTEREST_SECTION && accruedInterestItems.length > 0 && (
                <DorkFiCard
                  className={cn(
                    "p-6 md:p-8",
                    hasBothPositionTypes && "order-4"
                  )}
                >
                  <div ref={accruedInterestTableRef} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <H1 className="text-xl md:text-2xl">
                        Accrued Interest
                        {positionsNetworkFilter !== "all" && (
                          <span className="text-lg text-muted-foreground ml-2">
                            (
                            {positionsNetworkFilter.charAt(0).toUpperCase() +
                              positionsNetworkFilter.slice(1)}
                            )
                          </span>
                        )}
                      </H1>
                      <DorkFiButton
                        onClick={handleRefreshAccruedInterest}
                        disabled={refreshingSection === "Accrued Interest"}
                        variant="secondary"
                        size="sm"
                        className="min-w-0"
                        title={
                          isViewOnly
                            ? "Refresh market data (view-only mode)"
                            : "Refresh market data for accrued interest"
                        }
                      >
                        <RefreshCw
                          className={`w-3 h-3 mr-1.5 ${refreshingSection === "Accrued Interest"
                            ? "animate-spin"
                            : ""
                            }`}
                        />
                        Refresh
                      </DorkFiButton>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search assets..."
                        value={accruedInterestSearchTerm}
                        onChange={(e) =>
                          setAccruedInterestSearchTerm(e.target.value)
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {(() => {
                        const filteredAndSorted = accruedInterestItems
                          .filter(accruedInterestPassesNetworkFilter)
                          .sort((a, b) => {
                            let comparison = 0;
                            switch (accruedInterestSort.column) {
                              case "interest":
                                comparison =
                                  (a.netInterestValue || 0) -
                                  (b.netInterestValue || 0);
                                break;
                              case "value":
                                comparison =
                                  (a.netInterestValue || 0) -
                                  (b.netInterestValue || 0);
                                break;
                              default:
                                comparison =
                                  (a.netInterestValue || 0) -
                                  (b.netInterestValue || 0);
                            }
                            return accruedInterestSort.direction === "asc"
                              ? comparison
                              : -comparison;
                          });

                        const displayItems = showAllAccruedInterest
                          ? filteredAndSorted
                          : filteredAndSorted.slice(0, 5);
                        const hasMore = filteredAndSorted.length > 5;

                        if (displayItems.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <p>No accrued interest</p>
                            </div>
                          );
                        }

                        return (
                          <>
                            {displayItems.map((item) => {
                              const hasDeposits =
                                (item.earnedInterest || 0) > 0;
                              const hasBorrows = (item.owedInterest || 0) > 0;

                              return (
                                <AccruedInterestMobileCard
                                  key={`${item.asset}-${item.poolId || "default"
                                    }-${(item as ItemWithNetwork).network || "unknown"}`}
                                  asset={item.asset}
                                  icon={item.icon}
                                  iconBadgeUrl={
                                    (item as { iconBadgeUrl?: string }).iconBadgeUrl
                                  }
                                  netInterest={item.netInterest || 0}
                                  netInterestValue={item.netInterestValue || 0}
                                  earnedInterest={item.earnedInterest}
                                  owedInterest={item.owedInterest}
                                  earnedInterestValue={item.earnedInterestValue}
                                  owedInterestValue={item.owedInterestValue}
                                  tokenPrice={item.tokenPrice}
                                  network={(item as ItemWithNetwork).network}
                                  poolId={item.poolId}
                                />
                              );
                            })}
                            {hasMore && (
                              <DorkFiButton
                                variant="secondary"
                                onClick={() =>
                                  setShowAllAccruedInterest(
                                    !showAllAccruedInterest
                                  )
                                }
                                className="w-full min-w-0"
                              >
                                {showAllAccruedInterest
                                  ? "Show Less"
                                  : "Show More"}
                              </DorkFiButton>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (accruedInterestSort.column === "asset") {
                                    setAccruedInterestSort({
                                      column: "asset",
                                      direction:
                                        accruedInterestSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setAccruedInterestSort({
                                      column: "asset",
                                      direction: "asc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Asset
                                {accruedInterestSort.column === "asset" ? (
                                  accruedInterestSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            {positionsNetworkFilter === "all" && (
                              <TableHead>
                                <button
                                  onClick={() => {
                                    if (
                                      accruedInterestSort.column === "network"
                                    ) {
                                      setAccruedInterestSort({
                                        column: "network",
                                        direction:
                                          accruedInterestSort.direction ===
                                            "asc"
                                            ? "desc"
                                            : "asc",
                                      });
                                    } else {
                                      setAccruedInterestSort({
                                        column: "network",
                                        direction: "asc",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  Network
                                  {accruedInterestSort.column === "network" ? (
                                    accruedInterestSort.direction === "asc" ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                            )}
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (
                                    accruedInterestSort.column === "interest"
                                  ) {
                                    setAccruedInterestSort({
                                      column: "interest",
                                      direction:
                                        accruedInterestSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setAccruedInterestSort({
                                      column: "interest",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Net Accrued Interest
                                {accruedInterestSort.column === "interest" ? (
                                  accruedInterestSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (accruedInterestSort.column === "value") {
                                    setAccruedInterestSort({
                                      column: "value",
                                      direction:
                                        accruedInterestSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setAccruedInterestSort({
                                      column: "value",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Value (USD)
                                {accruedInterestSort.column === "value" ? (
                                  accruedInterestSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const filteredAndSorted = accruedInterestItems
                              .filter(accruedInterestPassesNetworkFilter)
                              .sort((a, b) => {
                                let comparison = 0;

                                switch (accruedInterestSort.column) {
                                  case "network":
                                    const networkA = (
                                      (a as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    const networkB = (
                                      (b as ItemWithNetwork).network || "Unknown"
                                    ).toLowerCase();
                                    comparison =
                                      networkA.localeCompare(networkB);
                                    break;
                                  case "asset":
                                    comparison = a.asset.localeCompare(b.asset);
                                    break;
                                  case "interest":
                                    comparison =
                                      (a.netInterestValue || 0) -
                                      (b.netInterestValue || 0);
                                    break;
                                  case "value":
                                  default:
                                    comparison =
                                      (a.netInterestValue || 0) -
                                      (b.netInterestValue || 0);
                                    break;
                                }

                                return accruedInterestSort.direction === "asc"
                                  ? comparison
                                  : -comparison;
                              });

                            const displayItems = showAllAccruedInterest
                              ? filteredAndSorted
                              : filteredAndSorted.slice(0, 5);
                            const hasMore = filteredAndSorted.length > 5;

                            return displayItems.map((item, index) => {
                              // Get network name from item or infer
                              let networkName = "Unknown";
                              const itemNetwork = (item as ItemWithNetwork).network;
                              if (itemNetwork) {
                                const normalized = itemNetwork.toLowerCase();
                                if (normalized.includes("algorand")) {
                                  networkName = "Algorand";
                                } else if (normalized.includes("voi")) {
                                  networkName = "VOI";
                                } else {
                                  networkName = itemNetwork
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1)
                                    )
                                    .join(" ");
                                }
                              } else if (positionsNetworkFilter === "all") {
                                const matchingNetwork = Object.entries(
                                  user.computed.networkValues
                                ).find(([network, values]: [string, unknown]) => {
                                  // Try to match by checking if the net interest value is close to any network's values
                                  const netValue = Math.abs(
                                    item.netInterestValue || 0
                                  );
                                  return (
                                    Math.abs(values.collateral - netValue) <
                                    values.collateral * 0.1 ||
                                    Math.abs(values.borrow - netValue) <
                                    values.borrow * 0.1
                                  );
                                });
                                if (matchingNetwork) {
                                  const network = matchingNetwork[0];
                                  const normalized = network.toLowerCase();
                                  if (normalized.includes("algorand")) {
                                    networkName = "Algorand";
                                  } else if (normalized.includes("voi")) {
                                    networkName = "VOI";
                                  } else {
                                    networkName = network
                                      .split("-")
                                      .map(
                                        (word) =>
                                          word.charAt(0).toUpperCase() +
                                          word.slice(1)
                                      )
                                      .join(" ");
                                  }
                                }
                              }

                              const isNetPositive = (item.netInterest || 0) > 0;
                              const hasDeposits =
                                (item.earnedInterest || 0) > 0;
                              const hasBorrows = (item.owedInterest || 0) > 0;
                              const accruedMarketLabel = getMarketLabel(
                                itemNetwork || currentNetwork,
                                item.poolId
                              );

                              return (
                                <TableRow
                                  key={index}
                                  className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20"
                                >
                                  <TableCell className="min-w-0">
                                    <div className="flex flex-col items-center gap-1 min-w-0">
                                      <MarketRowTokenIcon
                                        market={{
                                          icon: item.icon as string,
                                          asset: item.asset as string,
                                          iconBadgeUrl: (
                                            item as { iconBadgeUrl?: string }
                                          ).iconBadgeUrl,
                                        }}
                                        poolLetterLabel={
                                          accruedMarketLabel ?? null
                                        }
                                        imgClassName="w-8 h-8 shrink-0 rounded-full object-contain"
                                      />
                                      <span className="font-medium truncate text-center">
                                        {item.asset}
                                      </span>
                                    </div>
                                  </TableCell>
                                  {positionsNetworkFilter === "all" && (
                                    <TableCell className="font-medium">
                                      {networkName}
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span
                                        className={
                                          isNetPositive
                                            ? "text-green-600 dark:text-green-400 font-medium"
                                            : "text-red-600 dark:text-red-400 font-medium"
                                        }
                                      >
                                        {isNetPositive ? "+" : ""}
                                        {formatNumber(item.netInterest || 0, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 6,
                                        })}{" "}
                                        {item.asset}
                                      </span>
                                      {hasDeposits && hasBorrows && (
                                        <span className="text-xs text-muted-foreground mt-0.5">
                                          Earned:{" "}
                                          {formatNumber(item.earnedInterest, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                          })}{" "}
                                          | Owed:{" "}
                                          {formatNumber(item.owedInterest, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={
                                        isNetPositive
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-red-600 dark:text-red-400"
                                      }
                                    >
                                      {isNetPositive ? "+" : ""}
                                      {formatCurrency(item.netInterestValue || 0, "USD", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                          {accruedInterestItems.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center text-muted-foreground py-8"
                              >
                                No accrued interest
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!isMobile &&
                    (() => {
                      const filteredAndSorted = accruedInterestItems
                        .filter(accruedInterestPassesNetworkFilter)
                        .sort((a, b) => {
                          let comparison = 0;

                          switch (accruedInterestSort.column) {
                            case "network":
                              const networkA = (
                                (a as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              const networkB = (
                                (b as ItemWithNetwork).network || "Unknown"
                              ).toLowerCase();
                              comparison = networkA.localeCompare(networkB);
                              break;
                            case "asset":
                              comparison = a.asset.localeCompare(b.asset);
                              break;
                            case "interest":
                              comparison =
                                (a.netInterestValue || 0) -
                                (b.netInterestValue || 0);
                              break;
                            case "value":
                            default:
                              comparison =
                                (a.netInterestValue || 0) -
                                (b.netInterestValue || 0);
                              break;
                          }

                          return accruedInterestSort.direction === "asc"
                            ? comparison
                            : -comparison;
                        });

                      const hasMore = filteredAndSorted.length > 5;

                      return hasMore ? (
                        <div className="mt-4 text-center">
                          <DorkFiButton
                            variant="secondary"
                            onClick={() => {
                              const wasExpanded = showAllAccruedInterest;
                              setShowAllAccruedInterest(
                                !showAllAccruedInterest
                              );
                              if (
                                wasExpanded &&
                                accruedInterestTableRef.current
                              ) {
                                setTimeout(() => {
                                  accruedInterestTableRef.current?.scrollIntoView(
                                    {
                                      behavior: "smooth",
                                      block: "start",
                                    }
                                  );
                                }, 0);
                              }
                            }}
                            className="w-full min-w-0"
                          >
                            {showAllAccruedInterest ? "Show Less" : "Show More"}
                          </DorkFiButton>
                        </div>
                      ) : null;
                    })()}
                </DorkFiCard>
              )}
            </div>
          </TooltipProvider>
        )}

      {/* At Risk Positions Section - Show when health factor < 1.5 and there are borrows */}
      {isFeatureEnabled("enableLiquidations") &&
        healthFactor !== null &&
        healthFactor < 1.5 &&
        healthFactor > 0 &&
        totalBorrowed > 0 &&
        !isLoadingData && (
          <DorkFiCard className="border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <H1 className="text-xl text-red-500 m-0">At Risk Positions</H1>
              </div>
              <button
                onClick={() => displayAddress && fetchUser(displayAddress)}
                disabled={isLoadingPositions}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh positions data"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoadingPositions ? "animate-spin" : ""
                    }`}
                />
                Refresh
              </button>
            </div>
            <Body className="text-red-400 mb-4">
              Your health factor is below 1.5, indicating elevated liquidation
              risk. Consider reducing your borrowed amount or adding more
              collateral.
            </Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-sm text-red-300 mb-2">Health Factor</div>
                <div className="text-2xl font-bold text-red-400">
                  {displayHealthFactor !== null
                    ? formatNumber(displayHealthFactor, { maximumFractionDigits: 3 })
                    : "N/A"}
                </div>
                <div className="text-xs text-red-300 mt-1">
                  Target: 1.5+ for safety
                </div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-sm text-red-300 mb-2">
                  Liquidation Margin
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {formatPercent(liquidationMargin / 100, { maximumFractionDigits: 1 })}
                </div>
                <div className="text-xs text-red-300 mt-1">
                  Safety buffer remaining
                </div>
              </div>
            </div>

            {/* Risky Borrow Positions */}
            {riskyBorrows.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-red-300 mb-3 font-medium">
                  Risky Borrow Positions
                </div>
                <div className="space-y-2">
                  {riskyBorrows.map((borrow, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <MarketRowTokenIcon
                          market={{
                            icon: borrow.icon,
                            asset: borrow.asset,
                            iconBadgeUrl: (borrow as { iconBadgeUrl?: string })
                              .iconBadgeUrl,
                          }}
                          poolLetterLabel={null}
                          imgClassName="h-6 w-6 shrink-0 rounded-full object-contain"
                        />
                        <div>
                          <div className="text-sm font-medium text-red-400">
                            {borrow.asset}
                          </div>
                          <div className="text-xs text-red-300">
                            {formatNumber(borrow.balance, { maximumFractionDigits: 2 })} {borrow.asset}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-400">
                          {formatCurrency(borrow.value, "USD", { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-red-300">
                          {formatPercent(borrow.apy / 100, { maximumFractionDigits: 2 })} APY • Risk:{" "}
                          {formatPercent(borrow.riskFactor, { maximumFractionDigits: 1 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DorkFiCard>
        )}

      {/*<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DepositsList
          deposits={deposits}
          onDepositClick={handleDepositClick}
          onWithdrawClick={handleWithdrawClick}
          onRefresh={() => {} handleRefreshPositions}
          isLoading={isLoadingPositions}
        />
        <BorrowsList
          borrows={borrows}
          onBorrowClick={handleBorrowClick}
          onRepayClick={handleRepayClick}
          onRefresh={() => {} andleRefreshPositions}
          isLoading={isLoadingPositions}
        />
      </div>*/}

      <PortfolioModals
        depositModal={depositModal}
        withdrawModal={withdrawModal}
        borrowModal={borrowModal}
        borrowMarketPickerAssets={
          borrowModalMarketPickerRows.length >= 2
            ? borrowModalMarketPickerRows
            : undefined
        }
        onSelectBorrowMarket={handleSelectBorrowAssetForModal}
        repayModal={repayModal}
        deposits={deposits}
        borrows={borrows}
        walletBalances={walletBalances}
        marketData={marketData}
        userGlobalData={userGlobalData}
        userBorrowBalance={userBorrowBalance}
        folksMintedOneUnderlyingByKey={folksMintedOneUnderlyingByKey}
        prefetchWithdrawIndicesRef={prefetchWithdrawIndicesRef}
        isLoadingWalletBalance={isLoadingWalletBalance}
        isLoadingBorrowGlobalData={isLoadingBorrowData}
        onCloseDepositModal={() =>
          setDepositModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
            configSymbol: undefined,
            marketId: undefined,
          })
        }
        onCloseWithdrawModal={() =>
          setWithdrawModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
            marketId: undefined,
            configSymbol: undefined,
          })
        }
        onCloseBorrowModal={() =>
          setBorrowModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
            configSymbol: undefined,
            marketId: undefined,
            marketRowKey: undefined,
          })
        }
        onCloseRepayModal={() =>
          setRepayModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
            configSymbol: undefined,
            marketId: undefined,
          })
        }
        onSelectWithdrawAsset={(asset, poolId, network, pick) =>
          setWithdrawModal((prev) => {
            const candidates = deposits.filter(
              (d) =>
                d.asset === asset &&
                String(d.poolId ?? "") === String(poolId ?? "")
            ) as ItemWithNetwork[];
            const hit =
              (pick?.marketId != null && pick.marketId !== ""
                ? candidates.find(
                    (d) => String(d.marketId) === String(pick.marketId)
                  )
                : undefined) ??
              (pick?.configSymbol != null && pick.configSymbol !== ""
                ? candidates.find((d) => d.configSymbol === pick.configSymbol)
                : undefined) ??
              candidates.find(
                (d) => String(d.marketId) === String(prev.marketId)
              ) ??
              candidates.find((d) => d.configSymbol === prev.configSymbol) ??
              candidates[0];
            return {
              ...prev,
              asset,
              poolId,
              network,
              marketId: hit?.marketId ?? prev.marketId,
              configSymbol: hit?.configSymbol ?? prev.configSymbol,
            };
          })
        }
        onSelectDepositAsset={(asset, poolId, network) =>
          setDepositModal((prev) => {
            const candidates = deposits.filter(
              (d) =>
                d.asset === asset &&
                String(d.poolId ?? "") === String(poolId ?? "")
            ) as ItemWithNetwork[];
            const hit =
              candidates.find(
                (d) => String(d.marketId) === String(prev.marketId)
              ) ??
              candidates.find((d) => d.configSymbol === prev.configSymbol) ??
              candidates[0];
            return {
              ...prev,
              asset,
              poolId,
              network,
              configSymbol: hit?.configSymbol ?? prev.configSymbol,
              marketId: hit?.marketId ?? prev.marketId,
            };
          })
        }
        onSelectRepayAsset={(asset, poolId, network) =>
          setRepayModal((prev) => {
            const candidates = borrows.filter(
              (b) =>
                b.asset === asset &&
                String(b.poolId ?? "") === String(poolId ?? "")
            ) as ItemWithNetwork[];
            const hit =
              candidates.find(
                (b) => String(b.marketId) === String(prev.marketId)
              ) ??
              candidates.find((b) => b.configSymbol === prev.configSymbol) ??
              candidates[0];
            return {
              ...prev,
              asset,
              poolId,
              network,
              configSymbol: hit?.configSymbol ?? prev.configSymbol,
              marketId: hit?.marketId ?? prev.marketId,
            };
          })
        }
        onRefreshWalletBalance={refreshWalletBalance}
        onRefreshMarket={() => displayAddress && fetchUser(displayAddress)}
      />

      <Dialog
        modal={false}
        open={nftHolderRewardsClaimModalOpen}
        onOpenChange={setNftHolderRewardsClaimModalOpen}
      >
        <DialogContent
          className="max-h-[min(90vh,880px)] w-full max-w-[min(100vw-1.5rem,42rem)] overflow-y-auto overflow-x-hidden border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl sm:max-w-3xl z-[100]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            window.requestAnimationFrame(() => {
              document.getElementById("nft-reward-primary-pay")?.focus();
            });
          }}
          onInteractOutside={(e) => {
            if (isPortaledWalletPickerUi(e.target)) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isPortaledWalletPickerUi(e.target)) e.preventDefault();
          }}
        >
          <DialogHeader className="space-y-1 border-b border-slate-800 px-8 py-5 text-left sm:px-10">
            <DialogTitle className="text-base font-semibold tracking-tight text-emerald-400/95">
              NFT holder rewards
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-slate-500">
              Pay an agent on Base with USDC (x402) to verify eligibility and run your claim.
              Claimable now {nftHolderClaimableDisplayWithSymbol}.
            </DialogDescription>
          </DialogHeader>
          <NftHolderRewardsModalBody
            claimableDisplay={nftHolderClaimableDisplayWithSymbol}
            feeUsd={getClaimlayerUsdAmount()}
            displayAddress={displayAddress}
            activeAvmAddress={activeAccount?.address}
            isViewOnly={isViewOnly}
            claimAgent={nftHolderClaimAgent ?? null}
            claimAgentPending={nftHolderClaimAgentPending}
            claimAgentFetching={nftHolderClaimAgentFetching}
            claimAgentIsError={nftHolderClaimAgentIsError}
            claimAgentFetchError={nftHolderClaimAgentFetchError}
            eligibilitySnapshot={nftHolderModalEligibilitySnapshot}
            appQueryClient={queryClient}
            onPayClose={() => setNftHolderRewardsClaimModalOpen(false)}
            onRequestOpenManualClaim={() => {
              setNftHolderRewardsClaimModalOpen(false);
              window.requestAnimationFrame(() => {
                setNftClaimManualModalOpen(true);
              });
            }}
            onClaimSuccessShare={(details) => {
              setNftClaimSuccessDetails(details);
              window.requestAnimationFrame(() => {
                setNftClaimSuccessOpen(true);
              });
            }}
          />
          <DialogFooter className="border-t border-slate-800 bg-slate-950/95 px-8 py-5 sm:justify-center sm:px-10">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              onClick={() => setNftHolderRewardsClaimModalOpen(false)}
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NftHolderClaimManualModal
        open={nftClaimManualModalOpen}
        onOpenChange={setNftClaimManualModalOpen}
        beneficiaryAddress={displayAddress ?? ""}
      />

      <NftHolderClaimSuccessModal
        open={nftClaimSuccessOpen}
        onOpenChange={(open) => {
          setNftClaimSuccessOpen(open);
          if (!open) setNftClaimSuccessDetails(null);
        }}
        details={nftClaimSuccessDetails}
        claimableSummary={nftHolderClaimableDisplayWithSymbol}
      />

      {/* NFT Selection Modal */}
      <NFTSelectionModal
        open={nftModalOpen}
        onOpenChange={setNftModalOpen}
        onSelectNFT={(nft: UserNFT) => {
          // Avatar will be updated via useAvatarImage hook after transaction
        }}
        onConfirmNFT={async (nft: UserNFT) => {
          if (!activeAccount?.address || !activeWallet) {
            throw new Error("Wallet not connected");
          }

          // Algorand: set the profile NFT directly from a bridged Dork ASA — no enVoi (.voi)
          // name and no transaction required. The choice is stored against the address.
          if (currentNetwork === "algorand-mainnet") {
            try {
              const avatarValue = `arc72:${nft.contractId}:${nft.tokenId}`;
              const imageUrl = nft.imageUrl;

              // Persists to the API (avatar + avatarDorkfi) and caches locally. Do NOT call the
              // address-only `updateUserProfile` here: on Algorand it re-derives from Envoi and
              // would overwrite the avatar we just set with null.
              await saveAlgorandAvatar(activeAccount.address, {
                avatarValue,
                imageUrl,
              });

              // Optimistically reflect the new PFP immediately.
              setUserProfileAvatar(imageUrl);

              refetchAvatar();
              setNftModalOpen(false);
              setSuccessModalOpen(true);
            } catch (error) {
              console.error("Error updating profile NFT:", error);
              toast({
                title: "Failed to update profile",
                description:
                  error instanceof Error
                    ? error.message
                    : "Failed to update profile NFT",
                variant: "destructive",
              });
              throw error;
            }
            return;
          }

          if (!signTransactions) {
            throw new Error("Wallet not connected");
          }

          if (!addressName) {
            throw new Error("You must own an Envoi name to set a profile NFT");
          }

          try {
            // Only supported on voi-mainnet
            if (currentNetwork !== "voi-mainnet") {
              throw new Error("Profile NFTs are only supported on Voi Network");
            }

            const resolverNetwork = "mainnet";

            // Initialize resolver service
            const resolver = new ResolverService(
              resolverNetwork,
              activeAccount.address
            );

            // Construct arc72 format: arc72:<app_id>:<token_id>
            const avatarValue = `arc72:${nft.contractId}:${nft.tokenId}`;

            console.log("addressName", addressName);
            console.log("avatarValue", avatarValue);

            // Set avatar text record using resolver service
            const setTextResult = await resolver.setText(
              addressName,
              "avatar_dorkfi",
              avatarValue
            );

            console.log("setTextResult", setTextResult);

            if (!setTextResult.success) {
              throw new Error("Failed to prepare transaction");
            }

            // Show toast notification to prompt user to open wallet
            const walletName = activeWallet?.metadata?.name || "your wallet";
            toast({
              title: "Please Sign Transaction",
              description: `Please open ${walletName} and sign the transaction`,
              duration: 10000,
            });

            // Sign transactions
            const stxns = await signTransactions(
              setTextResult.txns.map((txn: string) =>
                Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
              )
            );

            // Get the correct algod client for the network
            const algorandNetwork = getAlgorandNetworkFromNetworkId(
              currentNetwork as NetworkId
            );
            if (!algorandNetwork) {
              throw new Error(`Invalid network: ${currentNetwork}`);
            }
            const algorandClients =
              await algorandService.initializeClientsForTransactions(
                algorandNetwork
              );

            // Send transaction
            const res = await algorandClients.algod
              .sendRawTransaction(stxns)
              .do();

            // Wait for confirmation
            await waitForConfirmation(algorandClients.algod, res.txid, 4);

            // Poll the resolver until the new value is reflected or timeout
            let newAvatarText = await resolver.text(
              addressName,
              "avatar_dorkfi"
            );
            let attempts = 0;
            while (newAvatarText !== avatarValue && attempts < 10) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              newAvatarText = await resolver.text(addressName, "avatar_dorkfi");
              attempts++;
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Notify API that user profile has been updated
            try {
              await dorkfiAPIService.updateUserProfile(activeAccount.address);
              console.log("User profile updated in API");
            } catch (apiError) {
              // Log error but don't fail the transaction - the on-chain update was successful
              console.error("Error updating user profile in API:", apiError);
            }

            // Refresh user portfolio data from API
            try {
              await fetchUser(activeAccount.address);
              console.log("User portfolio refreshed from API");
            } catch (fetchError) {
              console.error("Error refreshing user portfolio:", fetchError);
            }

            // Refetch the avatar image to update the UI
            refetchAvatar();

            // Close NFT selection modal and show success modal
            setNftModalOpen(false);
            setSuccessModalOpen(true);
          } catch (error) {
            console.error("Error updating profile NFT:", error);
            toast({
              title: "Transaction Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to update profile NFT",
              variant: "destructive",
            });
            throw error; // Re-throw to let the modal handle the error
          }
        }}
        currentImageUrl={displayAvatar || undefined}
      />

      {/* Profile Update Success Modal */}
      <ProfileUpdateSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        avatarImage={displayAvatar || undefined}
        healthFactor={displayHealthFactor}
        deposits={modalDeposits}
        borrows={modalBorrows}
        netLTV={netLTV}
        addressName={addressName}
      />

      {/* Liquidation Modal */}
      <Dialog
        open={liquidationModalOpen}
        onOpenChange={(open) => {
          setLiquidationModalOpen(open);
          if (!open && selectedLiquidationPosition) {
            setPartialLiquidationAmountUsd(
              selectedLiquidationPosition.liquidationAmount ?? 0
            );
          }
        }}
      >
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle>Liquidate Position</DialogTitle>
          </DialogHeader>
          {selectedLiquidationPosition &&
            (() => {
              // Calculate liquidation amount in WAD from selected partial amount and debt market price
              const debtSymbol =
                selectedLiquidationPosition.debtTokenInfo?.data?.symbol;
              const networkId = selectedLiquidationPosition.network;
              const maxLiquidationUsd =
                selectedLiquidationPosition.liquidationAmount || 0;
              const liquidationValueUsd = Math.min(
                Math.max(0, partialLiquidationAmountUsd),
                maxLiquidationUsd
              );

              // Find the debt market to get price - try multiple matching strategies
              let debtMarket = marketData.find((m) => {
                const matchesSymbol = m.symbol === debtSymbol;
                const matchesNetwork =
                  (m as ItemWithNetwork).network === networkId ||
                  (networkId && m.network === networkId);
                const matchesPool =
                  selectedLiquidationPosition.debtMarketId &&
                  (m.poolId ===
                    selectedLiquidationPosition.debtMarketId.toString() ||
                    m.appId ===
                    selectedLiquidationPosition.debtMarketId.toString());
                return matchesSymbol && (matchesNetwork || matchesPool);
              });

              // If not found, try matching by symbol and network only
              if (!debtMarket) {
                debtMarket = marketData.find((m) => {
                  const matchesSymbol = m.symbol === debtSymbol;
                  const matchesNetwork =
                    (m as ItemWithNetwork).network === networkId ||
                    (networkId && m.network === networkId);
                  return matchesSymbol && matchesNetwork;
                });
              }

              // If still not found, try matching by symbol only (fallback)
              if (!debtMarket) {
                debtMarket = marketData.find((m) => m.symbol === debtSymbol);
              }

              // Get token price from market
              let debtTokenPrice = 0;
              if (debtMarket) {
                console.log("debtMarket found:", {
                  symbol: debtMarket.symbol,
                  poolId: debtMarket.poolId,
                  appId: debtMarket.appId,
                  network: (debtMarket as ItemWithNetwork).network,
                  price: debtMarket.price,
                  marketInfoPrice: debtMarket.marketInfo?.price,
                });

                const token = getAllTokensWithDisplayInfo(
                  networkId as NetworkId
                ).find((t) => t.symbol === debtSymbol);

                debtTokenPrice = resolvePortfolioPositionUsdPerToken({
                  market: debtMarket,
                  tokenDecimals: token?.decimals || 6,
                  networkId: networkId as NetworkId,
                  poolId: debtMarket.appId?.toString?.() ?? debtMarket.poolId,
                  marketId:
                    debtMarket.marketId ??
                    debtMarket.underlyingContractId ??
                    token?.underlyingContractId,
                  configKey: token?.configKey,
                  originalSymbol: token?.originalSymbol,
                  displaySymbol: debtSymbol,
                  marketRows: marketData,
                });
                if (!(debtTokenPrice > 0) && debtMarket.marketInfo) {
                  debtTokenPrice = usdPerTokenFromPortfolioMarketRow(
                    debtMarket.marketInfo,
                    token?.decimals || 6
                  );
                }
                console.log("Resolved debt token price:", {
                  debtTokenPrice,
                  decimals: token?.decimals || 6,
                });
              } else {
                console.warn("Debt market not found:", {
                  debtSymbol,
                  networkId,
                  debtMarketId: selectedLiquidationPosition.debtMarketId,
                  availableMarkets: marketData.map((m) => ({
                    symbol: m.symbol,
                    poolId: m.poolId,
                    network: (m as ItemWithNetwork).network,
                  })),
                });
              }

              console.log("Final debtTokenPrice:", debtTokenPrice);
              console.log("liquidationValueUsd:", liquidationValueUsd);

              // Calculate liquidation amount in tokens from liquidation value
              const liquidationAmountInTokens =
                debtTokenPrice > 0 ? liquidationValueUsd / debtTokenPrice : 0;

              const liquidationAmountWad = liquidationAmountInTokens;

              const formattedLiquidationAmount =
                liquidationAmountWad > 0
                  ? Math.floor(liquidationAmountWad).toLocaleString("en-US", {
                    useGrouping: true,
                  })
                  : "0";

              return (
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        User Address
                      </p>
                      <p className="font-mono text-sm break-all">
                        {selectedLiquidationPosition.user}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Network
                      </p>
                      <p>
                        {selectedLiquidationPosition.network === "voi-mainnet"
                          ? "Voi"
                          : selectedLiquidationPosition.network ===
                            "algorand-mainnet"
                            ? "Algorand"
                            : selectedLiquidationPosition.network || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Debt Asset
                      </p>
                      <div className="flex items-center gap-2">
                        <img
                          src={getTokenImagePath(
                            selectedLiquidationPosition.debtTokenInfo?.data
                              ?.symbol || ""
                          )}
                          alt={
                            selectedLiquidationPosition.debtTokenInfo?.data
                              ?.symbol || ""
                          }
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.svg";
                          }}
                        />
                        <span className="font-medium">
                          {selectedLiquidationPosition.debtTokenInfo?.data
                            ?.symbol || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Collateral Asset
                      </p>
                      <div className="flex items-center gap-2">
                        <img
                          src={getTokenImagePath(
                            selectedLiquidationPosition.collateralTokenInfo
                              ?.data?.symbol || ""
                          )}
                          alt={
                            selectedLiquidationPosition.collateralTokenInfo
                              ?.data?.symbol || ""
                          }
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.svg";
                          }}
                        />
                        <span className="font-medium">
                          {selectedLiquidationPosition.collateralTokenInfo?.data
                            ?.symbol || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Debt Value
                      </p>
                      <p className="font-medium">
                        {formatCurrency(selectedLiquidationPosition.borrowValueUsd ?? 0, "USD", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Collateral Value
                      </p>
                      <p className="font-medium">
                        {formatCurrency(selectedLiquidationPosition.collateralValueUsd ?? 0, "USD", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Max Liquidation Value
                      </p>
                      <p className="font-medium">
                        {formatCurrency(selectedLiquidationPosition.liquidationAmount ?? 0, "USD", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Liquidation Amount
                      </p>
                      <p className="font-medium font-mono">
                        {formattedLiquidationAmount} WAD
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Amount to liquidate (USD)
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min={0}
                        max={maxLiquidationUsd}
                        step={0.01}
                        value={
                          partialLiquidationAmountUsd === 0 &&
                            maxLiquidationUsd > 0
                            ? ""
                            : partialLiquidationAmountUsd
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setPartialLiquidationAmountUsd(0);
                            return;
                          }
                          const v = parseFloat(raw);
                          if (!Number.isNaN(v)) {
                            setPartialLiquidationAmountUsd(
                              Math.min(
                                Math.max(0, v),
                                maxLiquidationUsd
                              )
                            );
                          }
                        }}
                        placeholder="0"
                        className="flex-1 min-w-[120px] h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <DorkFiButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPartialLiquidationAmountUsd(maxLiquidationUsd)
                        }
                        className="min-w-0"
                      >
                        Max
                      </DorkFiButton>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        className="flex-1"
                        value={[
                          maxLiquidationUsd > 0
                            ? Math.round(
                              (liquidationValueUsd / maxLiquidationUsd) * 100
                            )
                            : 100,
                        ]}
                        onValueChange={([p]) =>
                          setPartialLiquidationAmountUsd(
                            (p / 100) * maxLiquidationUsd
                          )
                        }
                        min={0}
                        max={100}
                        step={1}
                      />
                      <span className="text-sm font-medium tabular-nums w-24 text-right">
                        {formatCurrency(liquidationValueUsd, "USD", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      0% = no liquidation · 100% = full liquidation (
                      {formatCurrency(maxLiquidationUsd, "USD", {
                        maximumFractionDigits: 2,
                      })}
                      )
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <DorkFiButton
                      variant="secondary"
                      onClick={() => setLiquidationModalOpen(false)}
                      className="min-w-0"
                    >
                      Cancel
                    </DorkFiButton>
                    <DorkFiButton
                      variant="danger"
                      onClick={handleLiquidation}
                      disabled={
                        isLiquidating ||
                        debtTokenPrice === 0 ||
                        liquidationValueUsd <= 0
                      }
                      className="min-w-0"
                    >
                      {isLiquidating
                        ? "Processing..."
                        : "Proceed to Liquidation"}
                    </DorkFiButton>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Repay Modal */}
      <Dialog open={repayModalOpen} onOpenChange={setRepayModalOpen}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle>Repay on Behalf</DialogTitle>
          </DialogHeader>
          {selectedRepayPosition &&
            (() => {
              const debtSymbol = selectedRepayPosition.debtSymbol;
              const networkId = selectedRepayPosition.networkId;
              const borrowValueUsd = selectedRepayPosition.borrowValueUsd || 0;
              const debtMarket = selectedRepayPosition.debtMarket;
              const debtMarketId = selectedRepayPosition.debtMarketId;

              // Get token information
              const tokens = getAllTokensWithDisplayInfo(networkId);
              let token = tokens.find(
                (t) =>
                  t.symbol === debtSymbol &&
                  t.poolId === selectedRepayPosition.appId?.toString()
              );

              if (!token && debtMarketId) {
                token = tokens.find(
                  (t) => t.underlyingContractId === debtMarketId
                );
              }

              if (!token) {
                token = tokens.find((t) => t.symbol === debtSymbol);
              }

              // Get token price (oracle-aware; never invent $1)
              const tokenPrice = resolvePortfolioPositionUsdPerToken({
                market: debtMarket,
                tokenDecimals: token?.decimals ?? 6,
                networkId,
                poolId:
                  selectedRepayPosition.appId?.toString() ?? token?.poolId,
                marketId: debtMarketId ?? token?.underlyingContractId,
                configKey: token?.configKey,
                originalSymbol: token?.originalSymbol,
                displaySymbol: debtSymbol,
                marketRows: marketData,
              });

              // Calculate token amount from USD value (0 price → 0 amount; UI disables action)
              const calculatedTokenAmount =
                tokenPrice > 0 ? borrowValueUsd / tokenPrice : 0;

              // Use minimum of calculated amount and wallet balance
              const tokenAmount = repayWalletBalance !== null
                ? Math.min(calculatedTokenAmount, repayWalletBalance)
                : calculatedTokenAmount;

              // Handler for repay on behalf
              const handleRepayOnBehalf = async () => {
                if (!activeAccount?.address) {
                  toast({
                    title: "Error",
                    description: "Please connect your wallet",
                    variant: "destructive",
                  });
                  return;
                }

                if (!token) {
                  toast({
                    title: "Error",
                    description: "Token not found",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  setIsRepaying(true);

                  // Get token config for tokenStandard (try originalSymbol then debtSymbol)
                  const originalSymbol =
                    "originalSymbol" in token
                      ? (token as ItemWithNetwork).originalSymbol
                      : debtSymbol;
                  let originalTokenConfigRaw = getTokenConfig(
                    networkId,
                    originalSymbol
                  );
                  if (!originalTokenConfigRaw) {
                    originalTokenConfigRaw = getTokenConfig(
                      networkId,
                      debtSymbol
                    );
                  }

                  if (!originalTokenConfigRaw) {
                    throw new Error(
                      `Token config not found for ${debtSymbol} (tried: ${originalSymbol}, ${debtSymbol}). Ensure the asset is in the app config for this network.`
                    );
                  }

                  const originalTokenConfig = Array.isArray(
                    originalTokenConfigRaw
                  )
                    ? originalTokenConfigRaw.find(
                      (tc) =>
                        String(tc.poolId) ===
                        String(selectedRepayPosition.appId)
                    ) || originalTokenConfigRaw[0]
                    : originalTokenConfigRaw;

                  // Use token's underlyingContractId for marketId
                  const marketId = token.underlyingContractId;
                  const poolId = selectedRepayPosition.appId?.toString();

                  if (!poolId) {
                    throw new Error("Pool ID not found");
                  }

                  if (!marketId) {
                    throw new Error("Market ID not found");
                  }

                  // Call repayOnBehalf
                  const result = await repayOnBehalf(
                    poolId,
                    marketId,
                    originalTokenConfig.tokenStandard,
                    tokenAmount.toString(),
                    activeAccount.address,
                    selectedRepayPosition.user || "",
                    networkId
                  );

                  if (!result.success) {
                    throw new Error(
                      (result as { error?: string }).error || "Repay failed"
                    );
                  }

                  toast({
                    title: "Please Sign Transaction",
                    description: `Please open ${activeWallet?.metadata?.name || "your wallet"} and sign the transaction`,
                    duration: 10000,
                  });

                  // Sign and send transactions
                  const stxns = await signTransactions(
                    (result as { txns: string[] }).txns.map((txn: string) =>
                      Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
                    )
                  );

                  // Get the correct algod client for the network
                  const algorandNetwork =
                    getAlgorandNetworkFromNetworkId(networkId);
                  if (!algorandNetwork) {
                    throw new Error(`Invalid network: ${networkId}`);
                  }
                  const algorandClients =
                    await algorandService.initializeClientsForTransactions(
                      algorandNetwork
                    );
                  const res =
                    await algorandClients.algod
                      .sendRawTransaction(stxns)
                      .do();

                  await waitForConfirmation(
                    algorandClients.algod,
                    res.txid,
                    4
                  );

                  toast({
                    title: "Success",
                    description: "Repay transaction completed successfully",
                  });

                  // Close modal and refresh data
                  setRepayModalOpen(false);
                  setSelectedRepayPosition(null);

                  // Refresh user data
                  if (displayAddress) {
                    await fetchUser(displayAddress);
                  }
                } catch (error) {
                  console.error("Repay on behalf error:", error);
                  toast({
                    title: "Repay Failed",
                    description:
                      error instanceof Error
                        ? error.message
                        : "Repay failed",
                    variant: "destructive",
                  });
                } finally {
                  setIsRepaying(false);
                }
              };

              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Repay debt on behalf of another user. You will provide
                      the tokens, and the beneficiary's debt will be reduced.
                    </p>
                  </div>

                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Debt Asset:</span>
                      <span className="text-sm">{debtSymbol || "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Debt Value (USD):
                      </span>
                      <span className="text-sm">
                        {formatCurrency(borrowValueUsd, "USD", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Token Amount:
                      </span>
                      <span className="text-sm">
                        {isLoadingRepayBalance ? (
                          "Loading..."
                        ) : (
                          <>
                            {formatNumber(tokenAmount, { maximumFractionDigits: 6 })} {debtSymbol}
                            {repayWalletBalance !== null &&
                              repayWalletBalance < calculatedTokenAmount && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (limited by wallet balance)
                                </span>
                              )}
                          </>
                        )}
                      </span>
                    </div>
                    {repayWalletBalance !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          Your Wallet Balance:
                        </span>
                        <span className="text-sm">
                          {formatNumber(repayWalletBalance, { maximumFractionDigits: 6 })} {debtSymbol}
                        </span>
                      </div>
                    )}
                    {repayWalletBalance !== null &&
                      repayWalletBalance < calculatedTokenAmount && (
                        <div className="text-xs text-muted-foreground p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          Note: Your wallet balance ({formatNumber(repayWalletBalance, { maximumFractionDigits: 6 })}) is less than the full debt amount ({formatNumber(calculatedTokenAmount, { maximumFractionDigits: 6 })}). Only {formatNumber(tokenAmount, { maximumFractionDigits: 6 })} will be repaid.
                        </div>
                      )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Beneficiary:</span>
                      <span className="text-xs font-mono">
                        {selectedRepayPosition.user || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Network:</span>
                      <span className="text-sm">
                        {networkId === "voi-mainnet"
                          ? "Voi"
                          : networkId === "algorand-mainnet"
                            ? "Algorand"
                            : networkId}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <DorkFiButton
                      variant="secondary"
                      onClick={() => setRepayModalOpen(false)}
                      disabled={isRepaying}
                      className="min-w-0"
                    >
                      Cancel
                    </DorkFiButton>
                    <DorkFiButton
                      variant="primary"
                      onClick={handleRepayOnBehalf}
                      disabled={
                        isRepaying ||
                        !token ||
                        !activeAccount?.address ||
                        tokenPrice === 0
                      }
                      className="min-w-0"
                    >
                      {isRepaying ? "Processing..." : "Repay"}
                    </DorkFiButton>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Portfolio;
