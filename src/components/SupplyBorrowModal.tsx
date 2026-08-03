/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import { BorrowSharePanel } from "@/components/borrow/BorrowSharePanel";
import { MarketRowTokenIcon } from "@/components/markets/MarketRowTokenIcon";
import SupplyBorrowHeader from "./SupplyBorrowHeader";
import SupplyBorrowForm from "./SupplyBorrowForm";
import SupplyBorrowStats from "./SupplyBorrowStats";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  deposit,
  borrow,
  fetchUserGlobalData,
  fetchUserGlobalDataForPool,
  fetchMarketInfoFromContract,
  MAX_WITHDRAW_HEALTH_FACTOR_TARGET,
} from "@/services/lendingService";
import {
  getTokenConfig,
  resolveTokenConfigFromDisplayToken,
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  getNetworkConfig,
  NetworkId,
  getFolksAdaptersForPhase,
  getAnyFolksAdapter,
  tokenAdapterStableId,
  resolveDepositFolksAdapter,
  resolveBorrowFolksAdapter,
  FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET,
  FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING,
  isFolksAlgoDepositTwoStepEnabled,
  type FolksTokenAdapterConfig,
  type TokenConfig,
  type TokenStandard,
} from "@/config";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
  folksUnderlyingHumanToFAssetHuman,
} from "@/services/folksDepositAdapter";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { updateTransactionMetadata } from "@/utils/transactionUtils";
import { warmBorrowModalMaxAndPool } from "@/utils/modalPrefetchHeavy";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";
import {
  buildLiquidationThresholdSummaryForDeposit,
  estimatePoolHealthAfterBorrow,
  estimatePoolHealthAfterDeposit,
  maxBorrowTokenAmountForMinEstimatedHealth,
  shouldBlockDepositForLowEstimatedHealth,
} from "@/utils/depositModalPoolHealthEstimate";
import TransactionSignPreview from "./TransactionSignPreview";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import { spendableAlgoHumanFromAccount } from "@/utils/algorandWalletBalance";
import { getUserFriendlyError } from "@/utils/errorUtils";
import {
  ALGORAND_MAINNET_NODELY_ALGOD_URL,
  MainnetConsensusConfig,
  XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID,
  XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID,
  fetchXalgoMainnetConsensusState,
  minAlgoOutBurnFloor,
  xalgoAtomicNeededForMinAlgoOutFloor,
} from "@/services/xalgoConsensusAdapter";
import {
  buildXalgoConsensusMintAndDepositSingleGroup,
  formatXalgoAtomicAsHuman,
} from "@/services/xalgoMintSupplySingleGroup";
import {
  buildTalgoConsensusMintAndDepositSingleGroup,
  formatTalgoAtomicAsHuman,
} from "@/services/talgoMintSupplySingleGroup";
import {
  MAINNET_TALGO_LIQUID_STAKING_APP_ID,
  TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID,
} from "@/services/tinymanTalgoAdapter";
import { buildXalgoConsensusBorrowAndBurnSingleGroup } from "@/services/xalgoBorrowBurnSingleGroup";
import type { ConsensusState } from "@folks-finance/algorand-sdk";
import {
  resolveSupplyBorrowToken,
  supplyBorrowTokenConfigLookupKey,
  type SupplyBorrowTokenRow,
} from "@/utils/resolveSupplyBorrowToken";

export { resolveSupplyBorrowToken } from "@/utils/resolveSupplyBorrowToken";

/** Built transaction group ready for wallet signature (review step). */
interface PendingSupplyBorrowSign {
  txnsB64: string[];
  poolAppId: string;
  marketContractId: string;
  underlyingAssetId?: string | null;
  actualNetwork: NetworkId;
  tokenSymbol: string;
  originalSymbol: string;
  originalTokenConfig: {
    decimals: number;
    tokenStandard: string;
    poolId?: string | number;
  };
  /** Folks Governance xALGO `immediate_mint` only; `lending` includes atomic mint+supply when preview variant is combined. */
  signKind?: "lending" | "xalgo-consensus-mint";
  /** Overrides default sign-preview layout (e.g. single-group mint + lending supply). */
  txSignPreviewVariant?:
    | "lending"
    | "xalgo-consensus-mint"
    | "xalgo-mint-supply-combined"
    | "xalgo-borrow-burn-combined"
    | "talgo-tinyman-mint-supply-combined";
  /** Human ALGO amount for sign preview when `signKind` is `xalgo-consensus-mint`. */
  consensusMintAlgoHuman?: string;
  /** Human ALGO (minimum out) for borrow+burn sign preview. */
  consensusBurnAlgoHuman?: string;
  /** Consensus app id for the deposit sign preview (Folks Governance xALGO). */
  consensusAppIdForPreview?: string;
  /** Human amount for sign preview when it should not use the form field (e.g. combined supply min xALGO). */
  previewAmountHuman?: string;
  /** Step 1 of `VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP`: Folks mint only; step 2 is f-ALGO supply. */
  folksTwoStepPhase?: "folks_mint_only";
  /** f-ALGO ASA id for prefilling amount after step 1. */
  fAssetIdForFolksStep2?: string;
}

/** Pick one `TokenConfig` from `getTokenConfig` when the symbol maps to an array (e.g. several USDC pools). */
function pickTokenConfigForSupplyBorrowRow(
  raw: TokenConfig | TokenConfig[] | undefined,
  tok: SupplyBorrowTokenRow
): TokenConfig | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return raw;
  const poolStr = String(tok.poolId ?? "").trim();
  const contractStr = String(tok.underlyingContractId ?? "").trim();
  const poolOk = (tc: TokenConfig) =>
    poolStr === "" || String(tc.poolId ?? "") === poolStr;
  if (contractStr !== "") {
    const byContract = raw.find(
      (tc) =>
        poolOk(tc) && String(tc.contractId ?? "").trim() === contractStr
    );
    if (byContract) return byContract;
  }
  return raw.find(poolOk) ?? raw[0] ?? null;
}

/** Row in the optional supply/borrow asset picker (same disambiguation idea as Withdraw modal). */
export type SupplyBorrowAvailableAsset = {
  asset: string;
  icon: string;
  iconBadgeUrl?: string;
  value?: number;
  poolId?: string;
  network?: string;
  marketId?: string;
  configSymbol?: string;
  /** Stable id for this table row (e.g. on-demand `_sortKey`). */
  marketRowKey?: string;
};

/** Stable Select value when the same display asset appears on multiple pools or contracts. */
export function supplyBorrowAssetRowKey(
  a: SupplyBorrowAvailableAsset,
  index: number
): string {
  const rk =
    a.marketRowKey != null && String(a.marketRowKey).trim() !== ""
      ? String(a.marketRowKey)
      : "";
  if (rk !== "") return rk;
  const pool = a.poolId ?? "";
  const net = a.network ?? "";
  const mid =
    a.marketId != null && String(a.marketId) !== "" ? String(a.marketId) : "";
  const cfg =
    a.configSymbol != null && String(a.configSymbol) !== ""
      ? String(a.configSymbol)
      : "";
  if (mid === "" && cfg === "") {
    return `${a.asset}|${pool}|${net}|i${index}`;
  }
  return `${a.asset}|${pool}|${net}|${mid}|${cfg}`;
}

/** Max wall time for building unsigned borrow/supply txns before surfacing a retryable error. */
const BUILD_TRANSACTION_TIMEOUT_MS = 90_000;
const BUILD_TIMEOUT_MARKER = "BUILD_TXN_TIMEOUT";

function withBuildTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${BUILD_TIMEOUT_MARKER}:${label}: We couldn’t build the transaction. Please try again.`
        )
      );
    }, BUILD_TRANSACTION_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Borrow amount field vs protocol: user may enter ALGO (underlying route) or f-asset; caps are in market-token human. */
function borrowInputToMarketTokenHuman(
  amountStr: string,
  receiveBasis: "underlying" | "market_token" | undefined,
  mintedFAssetPerOneUnderlying: bigint | null,
  decimals: number
): number | null {
  const amt = parseFloat(amountStr) || 0;
  if (amt <= 0) return 0;
  if (receiveBasis === "underlying") {
    if (
      mintedFAssetPerOneUnderlying == null ||
      mintedFAssetPerOneUnderlying <= BigInt(0)
    ) {
      return null;
    }
    return folksUnderlyingHumanToFAssetHuman(
      amt,
      mintedFAssetPerOneUnderlying,
      decimals
    );
  }
  return amt;
}

interface SupplyBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  poolId?: string; // Pool ID to identify specific market when multiple markets exist for same symbol
  /** Config `tokens` key for this row (e.g. `fALGO`); required to disambiguate when `symbol` + `poolId` collide. */
  configSymbol?: string;
  /** Underlying market contract id; wins when display `symbol` + `poolId` collide (e.g. ALGO vs fALGO). */
  marketId?: string;
  /** On-demand / table row key when the picker needs to match the open market exactly. */
  marketRowKey?: string;
  network?: string; // Network ID for cross-network operations
  transactionId?: string;
  mode: "deposit" | "borrow";
  assetData: {
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
    maxTotalDeposits?: number;
    maxTotalBorrows?: number;
    isSToken?: boolean;
    reserveFactor?: number;
    apyCalculation?: { apy: number; utilizationRate?: number };
    borrowApyCalculation?: { apy: number };
    apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
  };
  walletBalance?: number;
  walletBalanceUSD?: number;
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  userBorrowBalance?: number;
  onTransactionSuccess?: () => void;
  onRefreshWalletBalance?: () => void;
  /** Refetch wallet / market balances when the user picks a different deposit route (e.g. fALGO vs ALGO). */
  onDepositRouteChange?: () => void | Promise<void>;
  /** When provided, show an in-modal asset picker (deposit and/or borrow), same pattern as Withdraw. */
  availableAssets?: SupplyBorrowAvailableAsset[];
  onSelectAsset?: (
    asset: string,
    poolId?: string,
    network?: string,
    pick?: {
      marketId?: string;
      configSymbol?: string;
      marketRowKey?: string;
    }
  ) => void;
  walletBalanceLastUpdated?: number;
  /** Supplied collateral markets in this pool (for deposit mode LT comparison). */
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  /**
   * When a deposit adapter uses `depositWalletBasis: "market_token"`, wallet balance of that ASA
   * (e.g. f-ASA units). Omit when only underlying routes exist.
   */
  walletBalanceMarketToken?: number;
  /** Parent is refreshing wallet balance after optimistic modal open. */
  isLoadingWalletBalance?: boolean;
  /** Parent is loading borrow global data after optimistic modal open. */
  isLoadingBorrowGlobalData?: boolean;
  /** Optional deposit-mode notice (e.g. Tinyman farm reward disqualification). */
  depositNotice?: string;
  /** Stacked icons for LP pair markets (underlying assets). */
  assetPairIcons?: { asset1Icon: string; asset2Icon: string };
}

const SupplyBorrowModal = ({
  isOpen,
  onClose,
  asset,
  poolId,
  configSymbol,
  marketId,
  marketRowKey,
  network,
  mode,
  assetData,
  walletBalance: propWalletBalance = 0,
  walletBalanceUSD: propWalletBalanceUSD = 0,
  userGlobalData,
  userBorrowBalance = 0,
  onTransactionSuccess,
  onRefreshWalletBalance,
  onDepositRouteChange,
  availableAssets,
  onSelectAsset,
  walletBalanceLastUpdated,
  poolCollateralMarkets,
  walletBalanceMarketToken,
  isLoadingWalletBalance = false,
  isLoadingBorrowGlobalData: _isLoadingBorrowGlobalData = false,
  depositNotice,
  assetPairIcons,
}: SupplyBorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionNetworkId, setTransactionNetworkId] = useState<
    string | null
  >(null);
  const [retryCount, setRetryCount] = useState(0);
  const [calculatedMaxBorrow, setCalculatedMaxBorrow] = useState<number | null>(
    null
  );
  const [isLoadingMaxBorrow, setIsLoadingMaxBorrow] = useState(false);
  const [maxBorrowError, setMaxBorrowError] = useState<string | null>(null);
  /** Bumps on modal close / new build so stale in-flight builds do not update UI. */
  const buildGenerationRef = useRef(0);
  /** Bumps when max-borrow deps change so stale in-flight calcs do not update UI. */
  const maxBorrowGenRef = useRef(0);
  /** Per-pool collateral/borrow (USD) for deposit health estimate; undefined = not loaded */
  const [poolGlobalUserData, setPoolGlobalUserData] = useState<
    | {
        totalCollateralValue: number;
        totalBorrowValue: number;
        lastUpdateTime: number;
      }
    | null
    | undefined
  >(undefined);
  const [pendingSign, setPendingSign] = useState<PendingSupplyBorrowSign | null>(
    null
  );
  const [isSigning, setIsSigning] = useState(false);
  /** Hide Radix dialog while xChain (RainbowKit) wallet UI signs (overlay blocks MetaMask). */
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);
  /** Set after two-step (Folks) step 1 mint is confirmed; reset when modal opens. */
  const [folksTwoStepMintConfirmed, setFolksTwoStepMintConfirmed] =
    useState(false);
  /**
   * Pre-deposit standalone ASA opt-in status when
   * {@link TokenConfig.requireStandaloneFAssetOptInBeforeDeposit} or
   * {@link TokenConfig.requireStandaloneMarketAsaOptInBeforeDeposit} applies.
   */
  const [fAssetPreOptInStatus, setFAssetPreOptInStatus] = useState<
    "idle" | "checking" | "in" | "out"
  >("idle");
  const [isPreDepositFAssetOptInSubmitting, setIsPreDepositFAssetOptInSubmitting] =
    useState(false);
  /** Selected Folks deposit route; defaults to underlying when both f-asset and underlying routes exist. */
  const [selectedDepositAdapterId, setSelectedDepositAdapterId] =
    useState<string>("");
  /** Spendable native ALGO (human) when xALGO “ALGO” consensus deposit route is selected. */
  const [nativeAlgoSpendableHuman, setNativeAlgoSpendableHuman] = useState<
    number | null
  >(null);
  const [depositRoutePickerOpen, setDepositRoutePickerOpen] = useState(false);
  const [selectedBorrowAdapterId, setSelectedBorrowAdapterId] =
    useState<string>("");
  const [borrowRoutePickerOpen, setBorrowRoutePickerOpen] = useState(false);
  /** Folks mint: f-asset out for 1.0 underlying in smallest units (for ALGO ↔ fALGO borrow UI). */
  const [folksMintedFAssetPerOneUnderlying, setFolksMintedFAssetPerOneUnderlying] =
    useState<bigint | null>(null);
  const [folksMintRatioStatus, setFolksMintRatioStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  /**
   * When the parent opens borrow but never set `userGlobalData` (e.g. pre-fetch threw),
   * load aggregate user totals here so the modal is not stuck on "Loading…" forever.
   */
  const [borrowUserGlobalFallback, setBorrowUserGlobalFallback] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
    healthFactorIndex?: number;
  } | null>(null);
  const [borrowUserGlobalFallbackStatus, setBorrowUserGlobalFallbackStatus] =
    useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [borrowUserGlobalFallbackRetry, setBorrowUserGlobalFallbackRetry] =
    useState(0);

  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();

  // Use provided network or fallback to current network
  const networkToUse = network || currentNetwork;

  const effectiveUserGlobalData = useMemo(() => {
    if (userGlobalData != null) return userGlobalData;
    return borrowUserGlobalFallback;
  }, [userGlobalData, borrowUserGlobalFallback]);

  const { price: tokenPrice } = useTokenPrice(asset, networkToUse);
  const { price: algoUsdForXalgoRoute } = useTokenPrice(
    "ALGO",
    networkToUse as NetworkId
  );

  const supplyBorrowSelectRowKey = useMemo(() => {
    if (!availableAssets?.length) return "";
    const idx = availableAssets.findIndex(
      (a) =>
        a.asset === asset &&
        String(a.poolId ?? "") === String(poolId ?? "") &&
        String(a.network ?? "") === String(network ?? "") &&
        String(a.marketId ?? "") === String(marketId ?? "") &&
        String(a.configSymbol ?? "") === String(configSymbol ?? "") &&
        String(a.marketRowKey ?? "") === String(marketRowKey ?? "")
    );
    if (idx >= 0) return supplyBorrowAssetRowKey(availableAssets[idx], idx);
    const loose = availableAssets.findIndex(
      (a) =>
        a.asset === asset &&
        String(a.poolId ?? "") === String(poolId ?? "") &&
        String(a.network ?? "") === String(network ?? "")
    );
    if (loose >= 0) return supplyBorrowAssetRowKey(availableAssets[loose], loose);
    return supplyBorrowAssetRowKey(availableAssets[0], 0);
  }, [
    availableAssets,
    asset,
    poolId,
    network,
    marketId,
    configSymbol,
    marketRowKey,
  ]);

  const parentUserGlobalProvided = userGlobalData != null;

  useEffect(() => {
    if (mode !== "borrow" || !isOpen) {
      setBorrowUserGlobalFallback(null);
      setBorrowUserGlobalFallbackStatus("idle");
      setBorrowUserGlobalFallbackRetry(0);
      return;
    }
    if (!activeAccount?.address) {
      setBorrowUserGlobalFallback(null);
      setBorrowUserGlobalFallbackStatus("idle");
      return;
    }
    if (parentUserGlobalProvided) {
      setBorrowUserGlobalFallback(null);
      setBorrowUserGlobalFallbackStatus("idle");
      return;
    }

    let cancelled = false;
    setBorrowUserGlobalFallbackStatus("loading");

    (async () => {
      try {
        const data = await fetchUserGlobalData(
          activeAccount.address,
          networkToUse as NetworkId
        );
        if (cancelled) return;
        if (data != null) {
          setBorrowUserGlobalFallback(data);
          setBorrowUserGlobalFallbackStatus("ready");
        } else {
          setBorrowUserGlobalFallback(null);
          setBorrowUserGlobalFallbackStatus("failed");
        }
      } catch {
        if (!cancelled) {
          setBorrowUserGlobalFallback(null);
          setBorrowUserGlobalFallbackStatus("failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    isOpen,
    activeAccount?.address,
    networkToUse,
    parentUserGlobalProvided,
    borrowUserGlobalFallbackRetry,
  ]);

  const retryBorrowUserGlobalFetch = useCallback(() => {
    setBorrowUserGlobalFallbackRetry((n) => n + 1);
  }, []);

  const resolvedDepositTokenConfig = useMemo((): TokenConfig | null => {
    if (mode !== "deposit") return null;
    const tokens = getAllTokensWithDisplayInfo(networkToUse as NetworkId);
    const tok = resolveSupplyBorrowToken(
      tokens,
      asset,
      poolId,
      configSymbol,
      marketId
    );
    if (!tok?.underlyingContractId) return null;
    const lookupKey = supplyBorrowTokenConfigLookupKey(tok, asset);
    const raw = getTokenConfig(networkToUse as NetworkId, lookupKey);
    return pickTokenConfigForSupplyBorrowRow(raw, tok);
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  const depositOriginalSymbol = useMemo(() => {
    if (mode !== "deposit") return null;
    const tokens = getAllTokensWithDisplayInfo(networkToUse as NetworkId);
    const tok = resolveSupplyBorrowToken(
      tokens,
      asset,
      poolId,
      configSymbol,
      marketId
    );
    if (!tok) return null;
    return supplyBorrowTokenConfigLookupKey(tok, asset);
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  /** Governance xALGO lending row (config symbol or `tokens` map key via `depositOriginalSymbol`). */
  const isXalgoGovernanceLendingMarket = useMemo(() => {
    if (mode !== "deposit" || !resolvedDepositTokenConfig) return false;
    return (
      resolvedDepositTokenConfig.symbol === "xALGO" ||
      depositOriginalSymbol === "xALGO"
    );
  }, [mode, resolvedDepositTokenConfig, depositOriginalSymbol]);

  const depositFolksAdapters = useMemo((): FolksTokenAdapterConfig[] => {
    if (!resolvedDepositTokenConfig) return [];
    return getFolksAdaptersForPhase(resolvedDepositTokenConfig, "deposit");
  }, [resolvedDepositTokenConfig]);

  const xalgoDepositConsensusAlgoOption = useMemo(
    () =>
      mode === "deposit" &&
      networkToUse === "algorand-mainnet" &&
      isXalgoGovernanceLendingMarket,
    [mode, networkToUse, isXalgoGovernanceLendingMarket]
  );

  /** tALGO lending row (Tinyman liquid staking ASA). */
  const isTalgoTinymanLendingMarket = useMemo(() => {
    if (mode !== "deposit" || !resolvedDepositTokenConfig) return false;
    return (
      resolvedDepositTokenConfig.symbol === "tALGO" ||
      depositOriginalSymbol === "tALGO"
    );
  }, [mode, resolvedDepositTokenConfig, depositOriginalSymbol]);

  const talgoDepositTinymanAlgoOption = useMemo(
    () =>
      mode === "deposit" &&
      networkToUse === "algorand-mainnet" &&
      isTalgoTinymanLendingMarket,
    [mode, networkToUse, isTalgoTinymanLendingMarket]
  );

  const depositMultiRoute =
    mode === "deposit" &&
    (depositFolksAdapters.length > 1 ||
      xalgoDepositConsensusAlgoOption ||
      talgoDepositTinymanAlgoOption);

  /** Folks deposit adapter for xALGO ASA from wallet (used after governance mint). */
  const xalgoUnderlyingDepositAdapterId = useMemo(() => {
    if (mode !== "deposit") return null;
    if (!isXalgoGovernanceLendingMarket) return null;
    const a = depositFolksAdapters.find(
      (x) => (x.depositWalletBasis ?? "underlying") === "underlying"
    );
    return a ? tokenAdapterStableId(a) : null;
  }, [mode, isXalgoGovernanceLendingMarket, depositFolksAdapters]);

  const resolvedBorrowTokenConfig = useMemo((): TokenConfig | null => {
    if (mode !== "borrow") return null;
    const tokens = getAllTokensWithDisplayInfo(networkToUse as NetworkId);
    const tok = resolveSupplyBorrowToken(
      tokens,
      asset,
      poolId,
      configSymbol,
      marketId
    );
    if (!tok?.underlyingContractId) return null;
    const lookupKey = supplyBorrowTokenConfigLookupKey(tok, asset);
    const raw = getTokenConfig(networkToUse as NetworkId, lookupKey);
    return pickTokenConfigForSupplyBorrowRow(raw, tok);
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  const borrowOriginalSymbol = useMemo(() => {
    if (mode !== "borrow") return null;
    const tokens = getAllTokensWithDisplayInfo(networkToUse as NetworkId);
    const tok = resolveSupplyBorrowToken(
      tokens,
      asset,
      poolId,
      configSymbol,
      marketId
    );
    if (!tok) return null;
    return supplyBorrowTokenConfigLookupKey(tok, asset);
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  /** Governance xALGO lending row (borrow), same disambiguation as deposit. */
  const isXalgoGovernanceBorrowMarket = useMemo(() => {
    if (mode !== "borrow" || !resolvedBorrowTokenConfig) return false;
    return (
      resolvedBorrowTokenConfig.symbol === "xALGO" ||
      borrowOriginalSymbol === "xALGO"
    );
  }, [mode, resolvedBorrowTokenConfig, borrowOriginalSymbol]);

  const xalgoBorrowConsensusAlgoOption = useMemo(
    () =>
      mode === "borrow" &&
      networkToUse === "algorand-mainnet" &&
      isXalgoGovernanceBorrowMarket,
    [mode, networkToUse, isXalgoGovernanceBorrowMarket]
  );

  const borrowFolksAdapters = useMemo((): FolksTokenAdapterConfig[] => {
    if (!resolvedBorrowTokenConfig) return [];
    return getFolksAdaptersForPhase(resolvedBorrowTokenConfig, "borrow");
  }, [resolvedBorrowTokenConfig]);

  const borrowMultiRoute =
    mode === "borrow" &&
    (borrowFolksAdapters.length > 1 || xalgoBorrowConsensusAlgoOption);

  const isXalgoConsensusBorrowAlgoRoute = useMemo(
    () =>
      mode === "borrow" &&
      selectedBorrowAdapterId === XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID,
    [mode, selectedBorrowAdapterId]
  );

  const [xalgoBorrowConsensusState, setXalgoBorrowConsensusState] =
    useState<ConsensusState | null>(null);

  const selectedBorrowAdapter = useMemo(() => {
    if (!resolvedBorrowTokenConfig || !selectedBorrowAdapterId) {
      return undefined;
    }
    return resolveBorrowFolksAdapter(
      resolvedBorrowTokenConfig,
      selectedBorrowAdapterId
    );
  }, [resolvedBorrowTokenConfig, selectedBorrowAdapterId]);

  useEffect(() => {
    if (!isOpen || mode !== "borrow" || !resolvedBorrowTokenConfig) {
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("idle");
      return;
    }
    const folks = getAnyFolksAdapter(resolvedBorrowTokenConfig);
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!folks || !aln) {
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("idle");
      return;
    }
    setFolksMintRatioStatus("loading");
    let cancelled = false;
    (async () => {
      try {
        const { algod } = algorandService.initializeClients(aln as any);
        const dec = resolvedBorrowTokenConfig.decimals ?? 6;
        const oneUnderlying = BigInt(10) ** BigInt(dec);
        const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
          poolName: folks.folksParams.pool,
          underlyingAmount: oneUnderlying,
          algod,
        });
        if (!cancelled) {
          setFolksMintedFAssetPerOneUnderlying(mintedFAsset);
          setFolksMintRatioStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setFolksMintedFAssetPerOneUnderlying(null);
          setFolksMintRatioStatus("failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, resolvedBorrowTokenConfig, networkToUse]);

  useEffect(() => {
    if (!isOpen) setDepositRoutePickerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setBorrowRoutePickerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRainbowkitSignDialogSuppressed(false);
    }
  }, [isOpen]);

  /** f-ASA wallet balance (human) when config exposes a `market_token` deposit route; fills in if parent omits `walletBalanceMarketToken`. */
  const [fetchedFAssetWalletHuman, setFetchedFAssetWalletHuman] = useState<
    number | undefined
  >(undefined);

  useEffect(() => {
    if (!isOpen || mode !== "deposit" || !resolvedDepositTokenConfig) {
      setFetchedFAssetWalletHuman(undefined);
      return;
    }
    const needMarketTokenBalance = getFolksAdaptersForPhase(
      resolvedDepositTokenConfig,
      "deposit"
    ).some(
      (a) => (a.depositWalletBasis ?? "underlying") === "market_token"
    );
    if (!needMarketTokenBalance || !activeAccount?.address) {
      setFetchedFAssetWalletHuman(undefined);
      return;
    }
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!aln) {
      setFetchedFAssetWalletHuman(undefined);
      return;
    }
    const folks = getAnyFolksAdapter(resolvedDepositTokenConfig);
    const fAssetStr =
      folks?.type === "folks"
        ? String(folks.folksParams.fAssetId ?? "").trim()
        : "";
    if (
      fAssetStr === "" ||
      !Number.isFinite(Number(fAssetStr)) ||
      Number(fAssetStr) <= 0
    ) {
      setFetchedFAssetWalletHuman(undefined);
      return;
    }
    const fAssetAsa = Number(fAssetStr);
    let cancelled = false;
    (async () => {
      try {
        const { algod } = algorandService.initializeClients(aln as any);
        const info = await algod
          .accountAssetInformation(activeAccount.address, fAssetAsa)
          .do();
        const raw = getAccountAssetHoldingAmountAtomic(info);
        const dec = resolvedDepositTokenConfig.decimals ?? 6;
        const human =
          raw != null ? Number(raw) / 10 ** dec : 0;
        if (!cancelled) setFetchedFAssetWalletHuman(human);
      } catch {
        if (!cancelled) setFetchedFAssetWalletHuman(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    mode,
    resolvedDepositTokenConfig,
    activeAccount?.address,
    networkToUse,
    selectedDepositAdapterId,
  ]);

  const selectedDepositAdapter = useMemo(() => {
    if (!resolvedDepositTokenConfig || !selectedDepositAdapterId) {
      return undefined;
    }
    if (
      selectedDepositAdapterId === XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID ||
      selectedDepositAdapterId === TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID
    ) {
      return undefined;
    }
    return resolveDepositFolksAdapter(
      resolvedDepositTokenConfig,
      selectedDepositAdapterId
    );
  }, [resolvedDepositTokenConfig, selectedDepositAdapterId]);

  const isXalgoConsensusDepositAlgoRoute = useMemo(
    () =>
      mode === "deposit" &&
      selectedDepositAdapterId === XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID,
    [mode, selectedDepositAdapterId]
  );

  const isTalgoTinymanDepositAlgoRoute = useMemo(
    () =>
      mode === "deposit" &&
      selectedDepositAdapterId === TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID,
    [mode, selectedDepositAdapterId]
  );

  const isNativeAlgoConsensusDepositRoute = useMemo(
    () => isXalgoConsensusDepositAlgoRoute || isTalgoTinymanDepositAlgoRoute,
    [isXalgoConsensusDepositAlgoRoute, isTalgoTinymanDepositAlgoRoute]
  );

  useEffect(() => {
    if (
      !isOpen ||
      mode !== "deposit" ||
      !isNativeAlgoConsensusDepositRoute ||
      !activeAccount?.address ||
      networkToUse !== "algorand-mainnet"
    ) {
      setNativeAlgoSpendableHuman(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const aln = getAlgorandNetworkFromNetworkId("algorand-mainnet");
        if (!aln) {
          if (!cancelled) setNativeAlgoSpendableHuman(null);
          return;
        }
        const { algod } = await algorandService.initializeClientsForReads(
          aln,
          { algodServer: ALGORAND_MAINNET_NODELY_ALGOD_URL }
        );
        const info = await algod
          .accountInformation(activeAccount.address)
          .do();
        if (!cancelled) {
          setNativeAlgoSpendableHuman(spendableAlgoHumanFromAccount(info));
        }
      } catch {
        if (!cancelled) setNativeAlgoSpendableHuman(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    mode,
    isNativeAlgoConsensusDepositRoute,
    activeAccount?.address,
    networkToUse,
  ]);

  const preDepositFAssetAsaId = useMemo((): number | null => {
    const tc = resolvedDepositTokenConfig;
    if (!tc) return null;
    if (tc.requireStandaloneMarketAsaOptInBeforeDeposit) {
      if (selectedDepositAdapter?.depositWalletBasis === "market_token") {
        return null;
      }
      const raw = tc.assetId != null ? String(tc.assetId).trim() : "";
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (!tc.requireStandaloneFAssetOptInBeforeDeposit) {
      return null;
    }
    const folks = getAnyFolksAdapter(tc);
    if (folks?.type !== "folks") return null;
    const n = Number(String(folks.folksParams.fAssetId ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [resolvedDepositTokenConfig, selectedDepositAdapter]);

  const depositRequiresStandaloneFAssetOptIn = useMemo(() => {
    if (
      mode !== "deposit" ||
      (networkToUse as string) !== "algorand-mainnet" ||
      preDepositFAssetAsaId == null
    ) {
      return false;
    }
    if (
      resolvedDepositTokenConfig?.requireStandaloneMarketAsaOptInBeforeDeposit &&
      isNativeAlgoConsensusDepositRoute
    ) {
      return false;
    }
    return true;
  }, [
    mode,
    networkToUse,
    preDepositFAssetAsaId,
    resolvedDepositTokenConfig?.requireStandaloneMarketAsaOptInBeforeDeposit,
    isNativeAlgoConsensusDepositRoute,
  ]);

  const preDepositFAssetDisplayLabel = useMemo(() => {
    const tc = resolvedDepositTokenConfig;
    if (!tc) return "f-asset";
    if (tc.requireStandaloneMarketAsaOptInBeforeDeposit) {
      return tc.symbol || tc.name || "asset";
    }
    if (!tc.requireStandaloneFAssetOptInBeforeDeposit) {
      return "f-asset";
    }
    const tok = getFolksAdaptersForPhase(tc, "deposit").find(
      (a) => (a.depositWalletBasis ?? "underlying") === "market_token"
    );
    return tok?.label ?? tok?.name ?? "Folks f-asset";
  }, [resolvedDepositTokenConfig]);

  useEffect(() => {
    if (
      !isOpen ||
      mode !== "deposit" ||
      !depositRequiresStandaloneFAssetOptIn ||
      !activeAccount?.address ||
      preDepositFAssetAsaId == null
    ) {
      setFAssetPreOptInStatus("idle");
      return;
    }
    let cancelled = false;
    setFAssetPreOptInStatus("checking");
    void (async () => {
      try {
        const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
        if (!aln) {
          if (!cancelled) setFAssetPreOptInStatus("idle");
          return;
        }
        const { algod } = algorandService.initializeClients(aln as any);
        await algod
          .accountAssetInformation(activeAccount.address, preDepositFAssetAsaId)
          .do();
        if (!cancelled) setFAssetPreOptInStatus("in");
      } catch {
        if (!cancelled) setFAssetPreOptInStatus("out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    mode,
    depositRequiresStandaloneFAssetOptIn,
    activeAccount?.address,
    preDepositFAssetAsaId,
    networkToUse,
  ]);

  const effectiveDepositWalletBalance = useMemo(() => {
    if (mode !== "deposit") return propWalletBalance;
    if (isNativeAlgoConsensusDepositRoute) {
      return nativeAlgoSpendableHuman != null &&
        Number.isFinite(nativeAlgoSpendableHuman)
        ? nativeAlgoSpendableHuman
        : 0;
    }
    const basis =
      selectedDepositAdapter?.depositWalletBasis ?? "underlying";
    if (basis === "market_token") {
      const ext =
        walletBalanceMarketToken ?? fetchedFAssetWalletHuman;
      return ext !== undefined && ext !== null && Number.isFinite(ext)
        ? ext
        : 0;
    }
    return propWalletBalance;
  }, [
    mode,
    isNativeAlgoConsensusDepositRoute,
    nativeAlgoSpendableHuman,
    selectedDepositAdapterId,
    selectedDepositAdapter?.depositWalletBasis,
    propWalletBalance,
    walletBalanceMarketToken,
    fetchedFAssetWalletHuman,
  ]);

  /** USD under wallet row: follows selected deposit route (underlying vs f-asset). */
  const effectiveDepositWalletBalanceUSD = useMemo(() => {
    if (mode !== "deposit") return propWalletBalanceUSD;
    if (isNativeAlgoConsensusDepositRoute) {
      const b = nativeAlgoSpendableHuman;
      const p = algoUsdForXalgoRoute;
      if (
        b != null &&
        Number.isFinite(b) &&
        p > 0 &&
        Number.isFinite(p)
      ) {
        return b * p;
      }
      return 0;
    }
    const basis =
      selectedDepositAdapter?.depositWalletBasis ?? "underlying";
    if (basis === "market_token") {
      const b = effectiveDepositWalletBalance;
      if (tokenPrice > 0 && Number.isFinite(b)) {
        return b * tokenPrice;
      }
      return 0;
    }
    return propWalletBalanceUSD;
  }, [
    mode,
    isNativeAlgoConsensusDepositRoute,
    nativeAlgoSpendableHuman,
    algoUsdForXalgoRoute,
    selectedDepositAdapterId,
    selectedDepositAdapter?.depositWalletBasis,
    propWalletBalanceUSD,
    effectiveDepositWalletBalance,
    tokenPrice,
  ]);

  useEffect(() => {
    if (!isOpen || mode !== "deposit") return;
    if (talgoDepositTinymanAlgoOption) {
      const tinymanId = TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID;
      if (depositFolksAdapters.length === 0) {
        setSelectedDepositAdapterId((prev) => {
          if (prev === tinymanId) return tinymanId;
          return "";
        });
        return;
      }
      const folksIds = depositFolksAdapters.map((a) =>
        tokenAdapterStableId(a)
      );
      const allIds = [tinymanId, ...folksIds];
      setSelectedDepositAdapterId((prev) => {
        if (prev && allIds.includes(prev)) return prev;
        const preferred = depositFolksAdapters.find(
          (a) => (a.depositWalletBasis ?? "underlying") === "underlying"
        );
        return preferred ? tokenAdapterStableId(preferred) : tinymanId;
      });
      return;
    }
    if (xalgoDepositConsensusAlgoOption) {
      const consensusId = XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID;
      if (depositFolksAdapters.length === 0) {
        setSelectedDepositAdapterId((prev) => {
          if (prev === consensusId) return consensusId;
          return "";
        });
        return;
      }
      const folksIds = depositFolksAdapters.map((a) =>
        tokenAdapterStableId(a)
      );
      const allIds = [consensusId, ...folksIds];
      setSelectedDepositAdapterId((prev) => {
        if (prev && allIds.includes(prev)) return prev;
        const preferred = depositFolksAdapters.find(
          (a) => (a.depositWalletBasis ?? "underlying") === "underlying"
        );
        return preferred ? tokenAdapterStableId(preferred) : consensusId;
      });
      return;
    }
    const list = depositFolksAdapters;
    if (list.length === 0) {
      setSelectedDepositAdapterId("");
      return;
    }
    setSelectedDepositAdapterId((prev) => {
      const ids = list.map((a) => tokenAdapterStableId(a));
      if (prev && ids.includes(prev)) return prev;
      const preferred =
        list.find(
          (a) => (a.depositWalletBasis ?? "underlying") === "underlying"
        ) ?? list[0];
      return preferred ? tokenAdapterStableId(preferred) : "";
    });
  }, [
    isOpen,
    mode,
    talgoDepositTinymanAlgoOption,
    xalgoDepositConsensusAlgoOption,
    depositFolksAdapters,
  ]);

  useEffect(() => {
    if (!isOpen || mode !== "borrow") return;
    if (xalgoBorrowConsensusAlgoOption) {
      const consensusBorrowAlgoId = XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID;
      const folksIds = borrowFolksAdapters.map((a) =>
        tokenAdapterStableId(a)
      );
      const valid = new Set<string>(["", consensusBorrowAlgoId, ...folksIds]);
      setSelectedBorrowAdapterId((prev) =>
        valid.has(prev) ? prev : ""
      );
      return;
    }
    const list = borrowFolksAdapters;
    if (list.length === 0) {
      setSelectedBorrowAdapterId("");
      return;
    }
    setSelectedBorrowAdapterId((prev) => {
      const ids = list.map((a) => tokenAdapterStableId(a));
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [isOpen, mode, xalgoBorrowConsensusAlgoOption, borrowFolksAdapters]);

  useEffect(() => {
    if (
      !isOpen ||
      mode !== "borrow" ||
      networkToUse !== "algorand-mainnet" ||
      !isXalgoGovernanceBorrowMarket
    ) {
      setXalgoBorrowConsensusState(null);
      return;
    }
    let cancelled = false;
    setXalgoBorrowConsensusState(null);
    (async () => {
      try {
        const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
        if (!aln) return;
        const { algod } = await algorandService.initializeClientsForReads(
          aln as AlgorandNetwork,
          { algodServer: ALGORAND_MAINNET_NODELY_ALGOD_URL }
        );
        const st = await fetchXalgoMainnetConsensusState(algod);
        if (!cancelled) setXalgoBorrowConsensusState(st);
      } catch {
        if (!cancelled) setXalgoBorrowConsensusState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, networkToUse, isXalgoGovernanceBorrowMarket]);

  const prevDepositAdapterIdRef = useRef<string>("");
  const onDepositRouteChangeRef = useRef(onDepositRouteChange);
  onDepositRouteChangeRef.current = onDepositRouteChange;

  const prevBorrowAdapterIdRef = useRef<string>("");

  useEffect(() => {
    if (!isOpen) {
      prevDepositAdapterIdRef.current = "";
      prevBorrowAdapterIdRef.current = "";
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode !== "deposit" || !isOpen) return;
    if (!selectedDepositAdapterId) return;
    const prev = prevDepositAdapterIdRef.current;
    const changed = prev !== "" && prev !== selectedDepositAdapterId;
    if (changed) {
      setAmount("");
      setFiatValue(0);
      void Promise.resolve(onDepositRouteChangeRef.current?.()).catch(
        () => {}
      );
    }
    prevDepositAdapterIdRef.current = selectedDepositAdapterId;
  }, [mode, isOpen, selectedDepositAdapterId]);

  useEffect(() => {
    if (mode !== "borrow" || !isOpen) return;
    if (!selectedBorrowAdapterId) return;
    const prev = prevBorrowAdapterIdRef.current;
    const changed = prev !== "" && prev !== selectedBorrowAdapterId;
    if (changed) {
      setAmount("");
      setFiatValue(0);
    }
    prevBorrowAdapterIdRef.current = selectedBorrowAdapterId;
  }, [mode, isOpen, selectedBorrowAdapterId]);

  const depositBlockedByLowEstimatedHealth = useMemo(() => {
    if (mode !== "deposit") return false;
    if (isNativeAlgoConsensusDepositRoute) return false;
    const summary = buildLiquidationThresholdSummaryForDeposit(
      assetData.liquidationThreshold,
      poolCollateralMarkets,
      poolId
    );
    const meta = estimatePoolHealthAfterDeposit(
      poolGlobalUserData ?? null,
      summary,
      parseFloat(amount) || 0,
      tokenPrice
    );
    if (!meta) return false;
    return shouldBlockDepositForLowEstimatedHealth(meta.value);
  }, [
    mode,
    assetData.liquidationThreshold,
    poolCollateralMarkets,
    poolId,
    poolGlobalUserData,
    amount,
    tokenPrice,
    isNativeAlgoConsensusDepositRoute,
  ]);

  const borrowTokenDecimals = useMemo(() => {
    if (mode !== "borrow") return 8;
    const raw = getTokenConfig(networkToUse as NetworkId, asset);
    const cfg = Array.isArray(raw)
      ? raw.find(
          (tc: { poolId?: string | number }) =>
            String(tc.poolId) === String(poolId)
        ) ?? raw[0]
      : raw;
    return cfg?.decimals ?? 8;
  }, [mode, networkToUse, asset, poolId]);

  /** Protocol + market liquidity cap in human tokens (always finite in borrow mode). */
  const borrowLiquidityOnlyTokens = useMemo(() => {
    if (mode !== "borrow") return null;
    // Do not fall back to assetData.liquidity when max is unknown/errored — market
    // liquidity alone can look more permissive than collateral allows.
    const raw = calculatedMaxBorrow !== null ? calculatedMaxBorrow : 0;
    const safeRaw =
      typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const borrowCap = assetData.maxTotalBorrows ?? 0;
    if (borrowCap <= 0) return safeRaw;
    const remaining = Math.max(0, borrowCap - (assetData.totalBorrow ?? 0));
    return Math.min(safeRaw, remaining);
  }, [
    mode,
    calculatedMaxBorrow,
    assetData.maxTotalBorrows,
    assetData.totalBorrow,
  ]);

  const liquidationSummaryForBorrowCap = useMemo(() => {
    if (mode !== "borrow") return null;
    return buildLiquidationThresholdSummaryForDeposit(
      assetData.liquidationThreshold,
      poolCollateralMarkets,
      poolId
    );
  }, [mode, assetData.liquidationThreshold, poolCollateralMarkets, poolId]);

  const hfSafeMaxBorrowTokens = useMemo(() => {
    if (
      mode !== "borrow" ||
      poolGlobalUserData == null ||
      !liquidationSummaryForBorrowCap
    ) {
      return null;
    }
    const raw = maxBorrowTokenAmountForMinEstimatedHealth(
      poolGlobalUserData,
      liquidationSummaryForBorrowCap,
      tokenPrice,
      MAX_WITHDRAW_HEALTH_FACTOR_TARGET
    );
    if (raw == null || !Number.isFinite(raw)) return null;
    const d = Math.min(Math.max(0, borrowTokenDecimals), 8);
    const f = 10 ** d;
    return Math.floor(raw * f + Number.EPSILON) / f;
  }, [
    mode,
    poolGlobalUserData,
    liquidationSummaryForBorrowCap,
    tokenPrice,
    borrowTokenDecimals,
  ]);

  const effectiveBorrowCap = useMemo(() => {
    if (mode !== "borrow" || borrowLiquidityOnlyTokens == null) return null;
    if (hfSafeMaxBorrowTokens == null) return borrowLiquidityOnlyTokens;
    return Math.max(0, Math.min(borrowLiquidityOnlyTokens, hfSafeMaxBorrowTokens));
  }, [mode, borrowLiquidityOnlyTokens, hfSafeMaxBorrowTokens]);

  const borrowInputReceiveBasis =
    selectedBorrowAdapter?.borrowReceiveBasis ?? "market_token";

  const amountBorrowMarketTokenHuman = useMemo((): number | null => {
    if (mode !== "borrow") return 0;
    if (isXalgoConsensusBorrowAlgoRoute) {
      const parsed = parseFloat(amount) || 0;
      if (parsed <= 0) return 0;
      if (!xalgoBorrowConsensusState) return null;
      const desiredAlgoMicro = BigInt(
        new BigNumber(parsed)
          .times(1e6)
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
      const xAtomic = xalgoAtomicNeededForMinAlgoOutFloor(
        xalgoBorrowConsensusState,
        desiredAlgoMicro,
        150n
      );
      return Number(xAtomic) / 10 ** borrowTokenDecimals;
    }
    return borrowInputToMarketTokenHuman(
      amount,
      borrowInputReceiveBasis,
      folksMintedFAssetPerOneUnderlying,
      borrowTokenDecimals
    );
  }, [
    mode,
    amount,
    isXalgoConsensusBorrowAlgoRoute,
    xalgoBorrowConsensusState,
    borrowInputReceiveBasis,
    folksMintedFAssetPerOneUnderlying,
    borrowTokenDecimals,
  ]);

  const effectiveBorrowCapInInputUnits = useMemo(() => {
    if (mode !== "borrow" || effectiveBorrowCap == null) return null;
    if (isXalgoConsensusBorrowAlgoRoute) {
      if (!xalgoBorrowConsensusState) return null;
      const d = Math.min(Math.max(0, borrowTokenDecimals), 18);
      const capX = BigInt(
        new BigNumber(effectiveBorrowCap)
          .times(10 ** d)
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
      if (capX <= 0n) return 0;
      const maxAlgoMicro = minAlgoOutBurnFloor(
        xalgoBorrowConsensusState,
        capX,
        150n
      );
      return Number(maxAlgoMicro) / 1e6;
    }
    if (borrowInputReceiveBasis !== "underlying") {
      return effectiveBorrowCap;
    }
    if (
      folksMintRatioStatus === "ready" &&
      folksMintedFAssetPerOneUnderlying != null &&
      folksMintedFAssetPerOneUnderlying > BigInt(0)
    ) {
      return folksFAssetHumanToUnderlyingHuman(
        effectiveBorrowCap,
        folksMintedFAssetPerOneUnderlying,
        borrowTokenDecimals
      );
    }
    return null;
  }, [
    mode,
    effectiveBorrowCap,
    isXalgoConsensusBorrowAlgoRoute,
    xalgoBorrowConsensusState,
    borrowTokenDecimals,
    borrowInputReceiveBasis,
    folksMintRatioStatus,
    folksMintedFAssetPerOneUnderlying,
  ]);

  /** Human unit for max borrowable line: Folks underlying is USDC on some pools, ALGO on others — never hardcode ALGO. */
  const maxBorrowableUnitSymbol = useMemo(() => {
    if (mode !== "borrow") return undefined;
    if (isXalgoConsensusBorrowAlgoRoute) return "ALGO";
    return (
      selectedBorrowAdapter?.label ??
      selectedBorrowAdapter?.name ??
      asset
    );
  }, [mode, isXalgoConsensusBorrowAlgoRoute, selectedBorrowAdapter, asset]);

  const borrowMaxLineLoading = useMemo(() => {
    if (mode !== "borrow") return false;
    // Any in-flight max calc must hide/clear stale values from a prior asset.
    const waitingOnMaxCalc = isLoadingMaxBorrow;
    return (
      waitingOnMaxCalc ||
      (borrowInputReceiveBasis === "underlying" &&
        folksMintRatioStatus === "loading") ||
      (isXalgoConsensusBorrowAlgoRoute && xalgoBorrowConsensusState == null)
    );
  }, [
    mode,
    isLoadingMaxBorrow,
    borrowInputReceiveBasis,
    folksMintRatioStatus,
    isXalgoConsensusBorrowAlgoRoute,
    xalgoBorrowConsensusState,
  ]);

  const borrowFolksRateUnavailable = useMemo(
    () =>
      mode === "borrow" &&
      !isXalgoConsensusBorrowAlgoRoute &&
      borrowInputReceiveBasis === "underlying" &&
      folksMintRatioStatus === "failed",
    [
      mode,
      isXalgoConsensusBorrowAlgoRoute,
      borrowInputReceiveBasis,
      folksMintRatioStatus,
    ]
  );

  /** Underlying-route borrow needs Folks mint ratio before submit. */
  const borrowFolksBlockingSubmit = useMemo(() => {
    if (mode !== "borrow") return false;
    if (isXalgoConsensusBorrowAlgoRoute) return false;
    if (borrowInputReceiveBasis !== "underlying") return false;
    const a = parseFloat(amount) || 0;
    if (a <= 0) return false;
    return folksMintRatioStatus !== "ready";
  }, [
    mode,
    isXalgoConsensusBorrowAlgoRoute,
    borrowInputReceiveBasis,
    amount,
    folksMintRatioStatus,
  ]);

  /** Est. pool HF after borrowing `amount` (for submit / button guard). */
  const estimatedHealthFactorAfterBorrow = useMemo(() => {
    if (
      mode !== "borrow" ||
      poolGlobalUserData == null ||
      !liquidationSummaryForBorrowCap
    ) {
      return null;
    }
    const amt =
      isXalgoConsensusBorrowAlgoRoute && amountBorrowMarketTokenHuman != null
        ? amountBorrowMarketTokenHuman
        : parseFloat(amount) || 0;
    if (amt <= 0) return null;
    const meta = estimatePoolHealthAfterBorrow(
      poolGlobalUserData,
      liquidationSummaryForBorrowCap,
      amt,
      tokenPrice
    );
    return meta?.value ?? null;
  }, [
    mode,
    poolGlobalUserData,
    liquidationSummaryForBorrowCap,
    amount,
    tokenPrice,
    isXalgoConsensusBorrowAlgoRoute,
    amountBorrowMarketTokenHuman,
  ]);

  const borrowSubmitBlockedBelowHfTarget = useMemo(() => {
    if (mode !== "borrow") return false;
    const a = parseFloat(amount) || 0;
    if (a <= 0) return false;
    const v = estimatedHealthFactorAfterBorrow;
    if (v == null || !Number.isFinite(v)) return false;
    return v < MAX_WITHDRAW_HEALTH_FACTOR_TARGET - 1e-9;
  }, [mode, amount, estimatedHealthFactorAfterBorrow]);

  const borrowExceedsEffectiveCap = useMemo(() => {
    if (mode !== "borrow" || effectiveBorrowCap == null) return false;
    const m = amountBorrowMarketTokenHuman;
    if (m === null) return false;
    return m > effectiveBorrowCap + 1e-9;
  }, [mode, amountBorrowMarketTokenHuman, effectiveBorrowCap]);

  const borrowNoCapacityAtHfTarget = useMemo(() => {
    return (
      mode === "borrow" &&
      effectiveBorrowCap != null &&
      effectiveBorrowCap <= 0
    );
  }, [mode, effectiveBorrowCap]);

  useEffect(() => {
    const needsPoolHealth =
      (mode === "deposit" || mode === "borrow") &&
      isOpen &&
      poolId &&
      activeAccount?.address;
    if (!needsPoolHealth) {
      setPoolGlobalUserData(undefined);
      return;
    }
    let cancelled = false;
    fetchUserGlobalDataForPool(
      activeAccount.address,
      networkToUse as NetworkId,
      poolId
    )
      .then((data) => {
        if (!cancelled) setPoolGlobalUserData(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setPoolGlobalUserData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, poolId, activeAccount?.address, networkToUse]);

  // Calculate max borrow amount when modal opens in borrow mode
  useEffect(() => {
    const fetchMaxBorrowAmount = async () => {
      // Only calculate for borrow mode
      if (mode !== "borrow" || !isOpen || !activeAccount?.address) {
        maxBorrowGenRef.current += 1;
        setCalculatedMaxBorrow(null);
        setIsLoadingMaxBorrow(false);
        setMaxBorrowError(null);
        return;
      }

      console.log("SupplyBorrowModal: Calculating max borrow amount", {
        isOpen,
        mode,
        address: activeAccount.address,
        asset,
        currentNetwork,
      });

      const gen = ++maxBorrowGenRef.current;
      setIsLoadingMaxBorrow(true);
      setCalculatedMaxBorrow(null);
      setMaxBorrowError(null);

      let keepLoadingForPoolData = false;
      try {
        const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
        // If poolId is provided, find the token that matches both symbol and poolId
        // Otherwise, fall back to finding by symbol only (for backward compatibility)
        const token = resolveSupplyBorrowToken(
          tokens,
          asset,
          poolId,
          configSymbol,
          marketId
        );

        if (!token) {
          throw new Error(
            `Token ${asset} not found in network config${poolId ? ` with poolId ${poolId}` : ""
            }`
          );
        }

        if (!token.poolId || !token.underlyingContractId) {
          throw new Error(
            `Token ${asset} missing pool or contract configuration`
          );
        }

        // Prefer config key so Folks / multi-row tokens resolve the correct `tokens[...]` entry
        const originalSymbol =
          (token as { configKey?: string }).configKey ??
          ("originalSymbol" in token ? (token as any).originalSymbol : asset);
        const tokenConfigRaw = getTokenConfig(
          networkToUse as any,
          originalSymbol
        );
        if (!tokenConfigRaw) {
          throw new Error(
            `Token config not found for ${asset} (originalSymbol: ${originalSymbol})`
          );
        }

        const tokenConfig = resolveTokenConfigFromDisplayToken(
          networkToUse as NetworkId,
          {
            configKey: (token as { configKey?: string }).configKey,
            originalSymbol,
            symbol: token.symbol,
            poolId: token.poolId,
            underlyingContractId: token.underlyingContractId,
          }
        );

        if (!tokenConfig) {
          throw new Error(
            `Token config not found for ${asset} (originalSymbol: ${originalSymbol})`
          );
        }

        const marketPoolId = token.poolId;
        /** Contract market id for on-chain borrow math (avoid shadowing `marketId` prop — TDZ above). */
        const underlyingMarketId = token.underlyingContractId;
        const decimals = tokenConfig.decimals;

        console.log("SupplyBorrowModal: Calling calculateMaxBorrowAmount", {
          poolId: marketPoolId,
          userId: activeAccount.address,
          marketId: underlyingMarketId,
          asset,
        });

        const storageAppId = getNetworkConfig(networkToUse as NetworkId)?.contracts?.appStorageId;

        const maxBorrowBigInt = await calculateMaxBorrowAmount(
          marketPoolId,
          activeAccount.address,
          underlyingMarketId,
          storageAppId ? Number(storageAppId) : undefined
        );

        if (gen !== maxBorrowGenRef.current) return;

        console.log("SupplyBorrowModal: maxBorrowBigInt result", {
          maxBorrowBigInt,
          isZero: maxBorrowBigInt === BigInt(0),
          isNull: maxBorrowBigInt === null,
        });

        // Get total deposits and total borrowed from assetData
        const totalDeposits = assetData.totalSupply;
        const totalBorrowed = assetData.totalBorrow;

        // Cap by market borrow cap (amount remaining)
        const capByBorrowCap = (value: number) => {
          const borrowCap = assetData.maxTotalBorrows ?? 0;
          if (borrowCap <= 0) return value;
          const remaining = Math.max(0, borrowCap - (assetData.totalBorrow ?? 0));
          return Math.min(value, remaining);
        };

        // Calculate total deposits - total borrowed
        const depositsMinusBorrowed = totalDeposits - totalBorrowed;

        console.log("SupplyBorrowModal: Market totals", {
          totalDeposits,
          totalBorrowed,
          depositsMinusBorrowed,
        });

        if (maxBorrowBigInt !== null && maxBorrowBigInt !== BigInt(0)) {
          // Convert from bigint (atomic units) to number (human-readable)
          const maxBorrowBN = new BigNumber(maxBorrowBigInt.toString());
          const divisor = new BigNumber(10).pow(decimals);
          const maxBorrowNumber = maxBorrowBN.dividedBy(divisor).toNumber();

          // Calculate buffer based on liquidation factor and collateral factor
          // If liquidation factor is 85 and collateral factor is 80, buffer is 5%
          // Add this buffer as 100% borrow value (multiply by 1 + buffer/100)
          let adjustedMaxBorrow = maxBorrowNumber;
          if (assetData.liquidationThreshold && assetData.collateralFactor) {
            const liquidationFactor = assetData.liquidationThreshold; // Already in percentage
            const collateralFactor = assetData.collateralFactor; // Already in percentage
            const buffer = liquidationFactor - collateralFactor; // e.g., 85 - 80 = 5
            if (buffer > 0) {
              // Add buffer as percentage: multiply by (1 + buffer/100)
              adjustedMaxBorrow = maxBorrowNumber * (1 + buffer / 100);
              console.log("SupplyBorrowModal: Buffer calculation", {
                liquidationFactor,
                collateralFactor,
                buffer,
                originalMaxBorrow: maxBorrowNumber,
                adjustedMaxBorrow,
              });
            }
          }

          // Take minimum of (total deposits - total borrowed) and current borrowable value, then cap by borrow cap
          const finalMaxBorrow = capByBorrowCap(
            Math.max(
              0,
              Math.min(adjustedMaxBorrow, depositsMinusBorrowed)
            )
          );

          if (gen !== maxBorrowGenRef.current) return;
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("SupplyBorrowModal: Max borrow amount calculated:", {
            maxBorrowNumber,
            adjustedMaxBorrow,
            depositsMinusBorrowed,
            finalMaxBorrow,
          });
        } else if (
          effectiveUserGlobalData &&
          effectiveUserGlobalData.totalCollateralValue > 0
        ) {
          // Borrowing power must be based on collateral in this pool only (not aggregate across pools)
          if (
            poolId != null &&
            poolId !== "" &&
            poolGlobalUserData === undefined
          ) {
            // Pool totals still loading (separate effect); keep spinner and re-run when ready
            keepLoadingForPoolData = true;
            return;
          }
          const collateralForBorrow =
            poolGlobalUserData != null
              ? poolGlobalUserData.totalCollateralValue
              : effectiveUserGlobalData.totalCollateralValue;
          console.log("SupplyBorrowModal: Pool data", {
            poolGlobalUserData,
            poolId,
          });
          const maxBorrowUSD =
            collateralForBorrow * (assetData.collateralFactor / 100);
          const nextMaxBorrow = capByBorrowCap(
            tokenPrice != null && tokenPrice > 0
              ? (maxBorrowUSD / tokenPrice) * Math.pow(10, 6) / Math.pow(10, decimals)
              : 0
          );
          if (gen !== maxBorrowGenRef.current) return;
          setCalculatedMaxBorrow(nextMaxBorrow);
        } else {
          // Even if maxBorrowBigInt is 0, we should still check deposits - borrowed, then cap by borrow cap
          const finalMaxBorrow = capByBorrowCap(Math.max(0, depositsMinusBorrowed));
          if (gen !== maxBorrowGenRef.current) return;
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log(
            "SupplyBorrowModal: Max borrow amount (deposits - borrowed):",
            finalMaxBorrow
          );
        }
      } catch (error) {
        if (gen !== maxBorrowGenRef.current) return;
        console.error(
          "SupplyBorrowModal: Error calculating max borrow amount:",
          error
        );
        setMaxBorrowError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        setCalculatedMaxBorrow(null);
      } finally {
        if (gen === maxBorrowGenRef.current && !keepLoadingForPoolData) {
          setIsLoadingMaxBorrow(false);
        }
      }
    };

    fetchMaxBorrowAmount();
  }, [
    isOpen,
    mode,
    activeAccount?.address,
    asset,
    poolId,
    configSymbol,
    marketId,
    networkToUse,
    tokenPrice,
    assetData.totalBorrow,
    assetData.maxTotalBorrows,
    assetData.collateralFactor,
    assetData.liquidationThreshold,
    assetData.totalSupply,
    effectiveUserGlobalData?.totalCollateralValue,
    poolGlobalUserData,
  ]);

  // Warm RPC caches as soon as borrow modal opens (not only on row hover)
  useEffect(() => {
    if (
      !isOpen ||
      mode !== "borrow" ||
      !activeAccount?.address ||
      !asset
    ) {
      return;
    }
    warmBorrowModalMaxAndPool({
      userAddress: activeAccount.address,
      networkId: networkToUse as NetworkId,
      asset,
      poolId: poolId != null ? String(poolId) : undefined,
      configSymbol,
      marketId: marketId != null ? String(marketId) : undefined,
    });
  }, [
    isOpen,
    mode,
    activeAccount?.address,
    asset,
    poolId,
    configSymbol,
    marketId,
    networkToUse,
  ]);

  useEffect(() => {
    if (!isOpen) {
      buildGenerationRef.current += 1;
      maxBorrowGenRef.current += 1;
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setPendingSign(null);
  }, [amount, asset, mode, poolId, configSymbol, marketId, network, networkToUse]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setError(null);
      setTransactionId(null);
      setTransactionNetworkId(null);
      setRetryCount(0);
      setPendingSign(null);
      setIsSigning(false);
      setFolksTwoStepMintConfirmed(false);
      if (mode !== "borrow") {
        setCalculatedMaxBorrow(null);
        setMaxBorrowError(null);
      }
    }
  }, [isOpen, mode]);

  const handleAmountChange = useCallback(
    (newAmount: string, newFiatValue: number) => {
      setAmount(newAmount);
      setFiatValue(newFiatValue);
    },
    []
  );

  const finalizeAfterSign = async (
    stxns: Uint8Array[],
    pending: PendingSupplyBorrowSign,
    res: { txid: string }
  ) => {
    const finalNetwork = pending.actualNetwork;
    setTransactionNetworkId(finalNetwork);
    const algorandNetwork = getAlgorandNetworkFromNetworkId(
      finalNetwork as NetworkId
    );
    if (!algorandNetwork) {
      throw new Error(`Invalid network: ${finalNetwork}`);
    }
    const algorandClients =
      await algorandService.initializeClientsForTransactions(algorandNetwork);
    await waitForConfirmation(algorandClients.algod, res.txid, 4);

    if (pending.folksTwoStepPhase === "folks_mint_only") {
      setTransactionId(res.txid);
      setPendingSign(null);
      setFolksTwoStepMintConfirmed(true);
      setSelectedDepositAdapterId(FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id);
      const d = pending.originalTokenConfig.decimals;
      let supplyHumanStr: string | null = null;
      const fAssetIdStr = pending.fAssetIdForFolksStep2?.trim() ?? "";
      if (
        activeAccount?.address &&
        fAssetIdStr !== "" &&
        fAssetIdStr !== "0" &&
        fAssetIdStr !== "-"
      ) {
        const fAssetId = parseInt(fAssetIdStr, 10);
        if (Number.isFinite(fAssetId) && fAssetId > 0) {
          try {
            const { algod } = await algorandService.initializeClientsForReads(
              algorandNetwork
            );
            const acc = await algod
              .accountAssetInformation(activeAccount.address, fAssetId)
              .do();
            const atomic = getAccountAssetHoldingAmountAtomic(acc);
            if (atomic != null && atomic > 0n) {
              const human = new BigNumber(atomic.toString())
                .dividedBy(10 ** d)
                .decimalPlaces(
                  Math.min(8, Math.max(0, d)),
                  BigNumber.ROUND_DOWN
                );
              supplyHumanStr = human.isZero() ? null : human.toFixed();
              setAmount(supplyHumanStr ?? "");
            }
          } catch (e) {
            console.warn("f-ALGO balance read after Folks mint step:", e);
          }
        }
      }
      void onRefreshWalletBalance?.();

      const tryDepositTwoStepChain =
        isFolksAlgoDepositTwoStepEnabled() &&
        String(finalNetwork) === "algorand-mainnet" &&
        activeAccount?.address &&
        supplyHumanStr != null &&
        supplyHumanStr !== "";

      if (tryDepositTwoStepChain) {
        try {
          const amountInAtomicUnits = new BigNumber(supplyHumanStr)
            .multipliedBy(10 ** d)
            .toFixed(0);
          const depositResult = await deposit(
            pending.poolAppId,
            pending.marketContractId,
            pending.originalTokenConfig.tokenStandard as TokenStandard,
            amountInAtomicUnits,
            activeAccount.address,
            finalNetwork as NetworkId,
            { depositAdapterId: FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id }
          );
          if (!depositResult.success) {
            throw new Error(
              "error" in depositResult && depositResult.error
                ? String(depositResult.error)
                : "Supply step failed to build."
            );
          }
          if (!("txns" in depositResult) || !depositResult.txns?.length) {
            throw new Error("No transactions returned for supply step.");
          }
          const pending2: PendingSupplyBorrowSign = {
            txnsB64: depositResult.txns,
            poolAppId: pending.poolAppId,
            marketContractId: pending.marketContractId,
            underlyingAssetId: pending.underlyingAssetId ?? null,
            actualNetwork: pending.actualNetwork,
            tokenSymbol: pending.tokenSymbol,
            originalSymbol: pending.originalSymbol,
            originalTokenConfig: pending.originalTokenConfig,
            signKind: "lending",
            txSignPreviewVariant: "lending",
          };
          const walletName = activeWallet?.metadata?.name || "your wallet";
          toast({
            title: "Please Sign Transaction",
            description: `Step 2 of 2 — supply f-ALGO to the market in ${walletName}`,
            duration: 10000,
          });
          const stxns2 = await withRainbowkitHostDialogDismissed({
            wallet: activeWallet,
            setSuppressed: setRainbowkitSignDialogSuppressed,
            leaveOverlayDismissedOnSuccess: true,
            run: () =>
              signTransactions(
                pending2.txnsB64.map((txn: string) =>
                  Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
                )
              ),
          });
          const res2 = await algorandClients.algod.sendRawTransaction(stxns2).do();
          await finalizeAfterSign(stxns2, pending2, res2);
          if (isRainbowkitXchainWallet(activeWallet)) {
            setShowSuccess(false);
            toast({
              title: "Supply confirmed",
              description:
                "Your transaction was submitted. The portfolio will update shortly.",
            });
            onClose();
          }
        } catch (chainErr) {
          if (isRainbowkitXchainWallet(activeWallet)) {
            setRainbowkitSignDialogSuppressed(false);
          }
          console.error("Deposit two-step chain:", chainErr);
          toast({
            variant: "destructive",
            title: "Supply step",
            description:
              chainErr instanceof Error
                ? `${chainErr.message} You can tap Supply again to finish.`
                : "Step 2 did not continue. Tap Supply again to finish from your f-ALGO balance.",
            duration: 12_000,
          });
          toast({
            title: "Folks mint confirmed",
            description:
              "Your f-ALGO balance was updated. Use Supply again if needed.",
            duration: 10_000,
          });
        }
        return;
      }

      toast({
        title: "Folks mint confirmed",
        description:
          "Amount set to your f-ALGO balance. Review and build again to supply to the market (step 2).",
        duration: 12_000,
      });
      return;
    }

    if (pending.signKind === "xalgo-consensus-mint") {
      setTransactionId(res.txid);

      setPendingSign(null);
      toast({
        title: "xALGO mint submitted",
        description:
          "Confirming on-chain. Your xALGO balance updates shortly; then you can supply below.",
      });
      const apiNet = pending.actualNetwork;
      if (activeAccount?.address) {
        void Promise.all([
          dorkfiAPIService.fetchFreshUserData(
            activeAccount.address,
            apiNet,
            parseInt(pending.poolAppId, 10),
            parseInt(pending.marketContractId, 10)
          ),
          fetchMarketInfoFromContract(
            pending.poolAppId,
            pending.marketContractId,
            apiNet
          ),
          dorkfiAPIService.fetchFreshUserHealth(
            apiNet,
            parseInt(pending.poolAppId, 10),
            activeAccount.address
          ),
        ])
          .then(() => new Promise((resolve) => setTimeout(resolve, 2000)))
          .then(() => {
            if (onTransactionSuccess) {
              onTransactionSuccess();
            }
          })
          .catch((error) => {
            console.error(
              "Error calling fetchFreshUserData after xALGO mint:",
              error
            );
            if (onTransactionSuccess) {
              onTransactionSuccess();
            }
          });
      }
      void onRefreshWalletBalance?.();
      return;
    }

    const decodedStxns = stxns.map((txn: Uint8Array<ArrayBufferLike>) => {
      return algosdk.decodeSignedTransaction(txn);
    });
    const poolTxn = decodedStxns
      .slice()
      .reverse()
      .find(
        (txn: any) =>
          txn.txn.type === "appl" &&
          Number(txn.txn.applicationCall.appIndex) ===
            parseInt(pending.poolAppId, 10)
      );
    const poolTxnID = poolTxn?.txn?.txID?.();
    if (!poolTxnID) {
      throw new Error("Could not locate pool application transaction in group.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    let metadataUpdated = false;
    let metaRetry = 0;
    const maxRetries = 10;
    const apiBaseUrl =
      import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";
    const networkParam = finalNetwork ? `?network=${finalNetwork}` : "";

    while (!metadataUpdated && metaRetry < maxRetries) {
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
          const metaResult = await response.json();
          console.log("Transaction metadata successfully updated:", metaResult.data);
          metadataUpdated = true;
        } else {
          const errBody = await response.json();
          throw new Error(errBody.error || "Failed to update transaction metadata");
        }
      } catch (err) {
        metaRetry++;
        if (metaRetry < maxRetries) {
          const delay = 1000 * Math.pow(2, metaRetry - 1);
          console.warn(
            `Metadata update attempt ${metaRetry} failed, retrying in ${delay}ms:`,
            err
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("Failed to update transaction metadata after all retries:", err);
        }
      }
    }

    if (!activeAccount?.address) return;

    const apiNet = pending.actualNetwork;
    Promise.all([
      dorkfiAPIService.fetchFreshUserData(
        activeAccount.address,
        apiNet,
        parseInt(pending.poolAppId, 10),
        parseInt(pending.marketContractId, 10)
      ),
      fetchMarketInfoFromContract(
        pending.poolAppId,
        pending.marketContractId,
        apiNet
      ),
      dorkfiAPIService.fetchFreshUserHealth(
        apiNet,
        parseInt(pending.poolAppId, 10),
        activeAccount.address
      ),
    ])
      .then(() => new Promise((resolve) => setTimeout(resolve, 2000)))
      .then(() => {
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }
      })
      .catch((error) => {
        console.error("Error calling fetchFreshUserData after transaction:", error);
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }
      });

    console.log("Transaction confirmed:", res);
    setTransactionId(res.txid);
    setPendingSign(null);
    setShowSuccess(true);
  };

  const handleConfirmSign = async () => {
    if (!pendingSign || !activeAccount?.address) {
      setError("Connect your wallet to sign.");
      return;
    }
    const pending = pendingSign;
    setIsSigning(true);
    setError(null);
    try {
      if (activeWallet) {
        const walletId = activeWallet.id?.toLowerCase() || "";
        const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const networkId = pending.actualNetwork as string;

        const isUniversalWallet =
          walletId === "lute" ||
          walletId === "kibisis" ||
          walletId === "vera" ||
          walletId === "biatec";

        const isVOIWallet = false;

        const isAlgorandWallet =
          walletId === "pera" ||
          walletId === "defly" ||
          walletName.includes("pera") ||
          walletName.includes("defly");

        const isWalletConnect = walletId === "walletconnect";
        let isWalletConnectVOI = false;
        let isWalletConnectAlgorand = false;

        if (isWalletConnect) {
          isWalletConnectVOI =
            walletName.includes("vera") || walletName.includes("biatec");
          isWalletConnectAlgorand =
            walletName.includes("pera") || walletName.includes("defly");
        }

        const isXchainRainbowkit =
          walletId === "rainbowkit" && networkId === "algorand-mainnet";

        const isSupported =
          isXchainRainbowkit ||
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
          (!isVOIWallet && !isAlgorandWallet && !isWalletConnect);

        if (!isSupported) {
          const networkName =
            networkId === "voi-mainnet" ? "VOI Network" : "Algorand Mainnet";
          throw new Error(
            `Your wallet (${activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the transaction`,
        duration: 10000,
      });

      const stxns = await withRainbowkitHostDialogDismissed({
        wallet: activeWallet,
        setSuppressed: setRainbowkitSignDialogSuppressed,
        leaveOverlayDismissedOnSuccess: true,
        run: () =>
          signTransactions(
            pending.txnsB64.map((txn: string) =>
              Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
            )
          ),
      });

      const finalNetwork = pending.actualNetwork;
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        finalNetwork as NetworkId
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${finalNetwork}`);
      }
      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();

      await finalizeAfterSign(stxns, pending, res);
      if (isRainbowkitXchainWallet(activeWallet)) {
        setShowSuccess(false);
        toast({
          title: mode === "deposit" ? "Supply confirmed" : "Borrow confirmed",
          description:
            "Your transaction was submitted. The portfolio will update shortly.",
        });
        onClose();
      }
    } catch (error) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      console.error(`${mode} sign error:`, error);
      let errorMessage = `${mode} failed`;
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("compatible wallet")) {
          errorMessage = error.message;
        } else if (message.includes("rejected") || message.includes("user")) {
          errorMessage = "Transaction was rejected or cancelled by user.";
        } else if (message.includes("gas") || message.includes("fee")) {
          errorMessage =
            "Transaction failed due to insufficient gas fees. Please ensure you have enough tokens for gas.";
        } else {
          errorMessage = getUserFriendlyError(error);
        }
      } else {
        errorMessage = getUserFriendlyError(error);
      }
      setError(errorMessage);
    } finally {
      setIsSigning(false);
    }
  };

  const handlePreDepositFAssetOptIn = useCallback(async () => {
    if (
      !activeAccount?.address ||
      preDepositFAssetAsaId == null ||
      !depositRequiresStandaloneFAssetOptIn
    ) {
      return;
    }
    setIsPreDepositFAssetOptInSubmitting(true);
    setError(null);
    try {
      const networkId = networkToUse as string;
      if (activeWallet) {
        const walletId = activeWallet.id?.toLowerCase() || "";
        const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const isUniversalWallet =
          walletId === "lute" ||
          walletId === "kibisis" ||
          walletId === "vera" ||
          walletId === "biatec";
        const isVOIWallet = false;
        const isAlgorandWallet =
          walletId === "pera" ||
          walletId === "defly" ||
          walletName.includes("pera") ||
          walletName.includes("defly");
        const isWalletConnect = walletId === "walletconnect";
        let isWalletConnectVOI = false;
        let isWalletConnectAlgorand = false;
        if (isWalletConnect) {
          isWalletConnectVOI =
            walletName.includes("vera") || walletName.includes("biatec");
          isWalletConnectAlgorand =
            walletName.includes("pera") || walletName.includes("defly");
        }
        const isXchainRainbowkit =
          walletId === "rainbowkit" && networkId === "algorand-mainnet";

        const isSupported =
          isXchainRainbowkit ||
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
          (!isVOIWallet && !isAlgorandWallet && !isWalletConnect);
        if (!isSupported) {
          const networkName =
            networkId === "voi-mainnet" ? "VOI Network" : "Algorand Mainnet";
          throw new Error(
            `Your wallet (${activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
      if (!aln) {
        throw new Error("Invalid network");
      }
      const algod = (
        await algorandService.initializeClientsForTransactions(aln)
      ).algod;
      const params = await algod.getTransactionParams().do();
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: activeAccount.address,
        receiver: activeAccount.address,
        amount: 0,
        assetIndex: preDepositFAssetAsaId,
        suggestedParams: { ...params, flatFee: true, fee: 1000n },
      });
      const txnsB64 = algosdk
        .assignGroupID([txn])
        .map((t) =>
          Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString("base64")
        );

      toast({
        title: "Sign opt-in",
        description: `Approve holding ${preDepositFAssetDisplayLabel} in your wallet.`,
        duration: 10000,
      });

      const stxns = await withRainbowkitHostDialogDismissed({
        wallet: activeWallet,
        setSuppressed: setRainbowkitSignDialogSuppressed,
        run: () =>
          signTransactions(
            txnsB64.map((b64) =>
              Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
            )
          ),
      });
      const res = await algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algod, res.txid, 4);
      setFAssetPreOptInStatus("in");
      toast({
        title: "Opt-in complete",
        description: `You can supply ${asset} to this market now.`,
      });
      void onRefreshWalletBalance?.();
    } catch (error) {
      console.error("pre-deposit f-asset opt-in:", error);
      let errorMessage = "Opt-in failed";
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("compatible wallet")) {
          errorMessage = error.message;
        } else if (message.includes("rejected") || message.includes("user")) {
          errorMessage = "Transaction was rejected or cancelled by user.";
        } else {
          errorMessage = error.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsPreDepositFAssetOptInSubmitting(false);
    }
  }, [
    activeAccount?.address,
    activeWallet,
    asset,
    currentNetwork,
    depositRequiresStandaloneFAssetOptIn,
    networkToUse,
    onRefreshWalletBalance,
    preDepositFAssetAsaId,
    preDepositFAssetDisplayLabel,
    signTransactions,
    toast,
  ]);

  const handleBuildTransaction = async () => {
    if (!activeAccount?.address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (isLoading) {
      return;
    }

    const buildGen = ++buildGenerationRef.current;

    // For deposits, check wallet balance (per selected deposit adapter basis).
    // xALGO consensus ALGO route: spendable ALGO loads async; until then effective balance is 0 — do not block.
    if (mode === "deposit") {
      const amt = parseFloat(amount);
      if (isNativeAlgoConsensusDepositRoute) {
        if (
          nativeAlgoSpendableHuman != null &&
          Number.isFinite(nativeAlgoSpendableHuman) &&
          amt > nativeAlgoSpendableHuman
        ) {
          setError("Insufficient wallet balance");
          return;
        }
      } else if (amt > effectiveDepositWalletBalance) {
        setError("Insufficient wallet balance");
        return;
      }
    }

    if (mode === "deposit" && isXalgoConsensusDepositAlgoRoute) {
      if (
        !resolvedDepositTokenConfig?.poolId ||
        !resolvedDepositTokenConfig.contractId
      ) {
        setError("Market configuration is incomplete. Refresh and try again.");
        return;
      }
      if (!depositOriginalSymbol) {
        setError("Could not resolve token for deposit.");
        return;
      }
      if (networkToUse !== "algorand-mainnet") {
        setError("ALGO (consensus) deposit is only available on Algorand mainnet.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const parsed = parseFloat(amount);
        const algoMicroAlgos = BigInt(
          new BigNumber(parsed)
            .times(1e6)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0)
        );
        const { txnsB64, minXalgoAtomic } =
          await buildXalgoConsensusMintAndDepositSingleGroup({
            userAddress: activeAccount.address,
            networkId: networkToUse as NetworkId,
            algoMicroAlgos,
            poolId: String(resolvedDepositTokenConfig.poolId),
            marketId: String(resolvedDepositTokenConfig.contractId),
            tokenStandard: String(
              resolvedDepositTokenConfig.tokenStandard
            ) as TokenStandard,
            ...(xalgoUnderlyingDepositAdapterId != null &&
            String(xalgoUnderlyingDepositAdapterId).trim() !== ""
              ? {
                  depositAdapterId:
                    String(xalgoUnderlyingDepositAdapterId).trim(),
                }
              : {}),
          });
        const dec = resolvedDepositTokenConfig.decimals ?? 6;
        setPendingSign({
          txnsB64,
          poolAppId: String(resolvedDepositTokenConfig.poolId),
          marketContractId: String(resolvedDepositTokenConfig.contractId),
          underlyingAssetId: String(MainnetConsensusConfig.xAlgoId),
          actualNetwork: networkToUse as NetworkId,
          tokenSymbol: "xALGO",
          originalSymbol: depositOriginalSymbol,
          originalTokenConfig: {
            decimals: dec,
            tokenStandard: String(resolvedDepositTokenConfig.tokenStandard),
            poolId: resolvedDepositTokenConfig.poolId,
          },
          signKind: "lending",
          txSignPreviewVariant: "xalgo-mint-supply-combined",
          consensusMintAlgoHuman: String(parsed),
          consensusAppIdForPreview: String(MainnetConsensusConfig.consensusAppId),
          previewAmountHuman: formatXalgoAtomicAsHuman(minXalgoAtomic, dec),
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not build mint and supply."
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "deposit" && isTalgoTinymanDepositAlgoRoute) {
      if (
        !resolvedDepositTokenConfig?.poolId ||
        !resolvedDepositTokenConfig.contractId
      ) {
        setError("Market configuration is incomplete. Refresh and try again.");
        return;
      }
      if (!depositOriginalSymbol) {
        setError("Could not resolve token for deposit.");
        return;
      }
      if (networkToUse !== "algorand-mainnet") {
        setError("ALGO (Tinyman mint) deposit is only available on Algorand mainnet.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const parsed = parseFloat(amount);
        const algoMicroAlgos = BigInt(
          new BigNumber(parsed)
            .times(1e6)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0)
        );
        const { txnsB64, minTalgoAtomic } =
          await buildTalgoConsensusMintAndDepositSingleGroup({
            userAddress: activeAccount.address,
            networkId: networkToUse as NetworkId,
            algoMicroAlgos,
            poolId: String(resolvedDepositTokenConfig.poolId),
            marketId: String(resolvedDepositTokenConfig.contractId),
            tokenStandard: String(
              resolvedDepositTokenConfig.tokenStandard
            ) as TokenStandard,
          });
        const dec = resolvedDepositTokenConfig.decimals ?? 6;
        setPendingSign({
          txnsB64,
          poolAppId: String(resolvedDepositTokenConfig.poolId),
          marketContractId: String(resolvedDepositTokenConfig.contractId),
          underlyingAssetId: String(resolvedDepositTokenConfig.assetId ?? ""),
          actualNetwork: networkToUse as NetworkId,
          tokenSymbol: "tALGO",
          originalSymbol: depositOriginalSymbol,
          originalTokenConfig: {
            decimals: dec,
            tokenStandard: String(resolvedDepositTokenConfig.tokenStandard),
            poolId: resolvedDepositTokenConfig.poolId,
          },
          signKind: "lending",
          txSignPreviewVariant: "talgo-tinyman-mint-supply-combined",
          consensusMintAlgoHuman: String(parsed),
          consensusAppIdForPreview: String(MAINNET_TALGO_LIQUID_STAKING_APP_ID),
          previewAmountHuman: formatTalgoAtomicAsHuman(minTalgoAtomic, dec),
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not build mint and supply."
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "borrow") {
      if (!effectiveUserGlobalData) {
        setError(
          borrowUserGlobalFallbackStatus === "failed"
            ? "Could not load your account summary. Use Retry above or try again later."
            : "User data is still loading. Try again in a moment."
        );
        return;
      }
      if (borrowNoCapacityAtHfTarget) {
        setError("No borrow capacity available at the current health factor target.");
        return;
      }
      if (borrowExceedsEffectiveCap) {
        setError(
          `Borrow amount exceeds the maximum that keeps estimated health factor at or above ${MAX_WITHDRAW_HEALTH_FACTOR_TARGET.toFixed(2)}.`
        );
        return;
      }
      if (borrowSubmitBlockedBelowHfTarget) {
        setError(
          `Borrow would put estimated pool health factor below ${MAX_WITHDRAW_HEALTH_FACTOR_TARGET.toFixed(2)}.`
        );
        return;
      }
    }

    if (
      mode === "borrow" &&
      isXalgoConsensusBorrowAlgoRoute &&
      resolvedBorrowTokenConfig?.poolId &&
      resolvedBorrowTokenConfig.contractId
    ) {
      if (!activeAccount?.address) {
        setError("Please connect your wallet first");
        return;
      }
      if (!borrowOriginalSymbol) {
        setError("Could not resolve token for borrow.");
        return;
      }
      if (networkToUse !== "algorand-mainnet") {
        setError(
          "Borrow with consensus burn is only available on Algorand mainnet."
        );
        return;
      }
      if (amountBorrowMarketTokenHuman === null) {
        setError("Waiting for consensus rate. Try again in a moment.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const parsed = parseFloat(amount);
        const desiredMinAlgoMicros = BigInt(
          new BigNumber(parsed)
            .times(1e6)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0)
        );
        const { txnsB64, borrowedXalgoAtomic } = await withBuildTimeout(
          buildXalgoConsensusBorrowAndBurnSingleGroup({
            userAddress: activeAccount.address,
            networkId: networkToUse as NetworkId,
            desiredMinAlgoMicros,
            poolId: String(resolvedBorrowTokenConfig.poolId),
            marketId: String(resolvedBorrowTokenConfig.contractId),
            tokenStandard: String(
              resolvedBorrowTokenConfig.tokenStandard
            ) as TokenStandard,
          }),
          "borrow+burn"
        );
        if (buildGen !== buildGenerationRef.current) return;
        const dec = resolvedBorrowTokenConfig.decimals ?? 6;
        setPendingSign({
          txnsB64,
          poolAppId: String(resolvedBorrowTokenConfig.poolId),
          marketContractId: String(resolvedBorrowTokenConfig.contractId),
          underlyingAssetId: String(MainnetConsensusConfig.xAlgoId),
          actualNetwork: networkToUse as NetworkId,
          tokenSymbol: "xALGO",
          originalSymbol: borrowOriginalSymbol,
          originalTokenConfig: {
            decimals: dec,
            tokenStandard: String(resolvedBorrowTokenConfig.tokenStandard),
            poolId: resolvedBorrowTokenConfig.poolId,
          },
          signKind: "lending",
          txSignPreviewVariant: "xalgo-borrow-burn-combined",
          consensusBurnAlgoHuman: String(parsed),
          consensusAppIdForPreview: String(MainnetConsensusConfig.consensusAppId),
          previewAmountHuman: formatXalgoAtomicAsHuman(borrowedXalgoAtomic, dec),
        });
      } catch (e) {
        if (buildGen !== buildGenerationRef.current) return;
        setError(
          e instanceof Error
            ? e.message
            : "We couldn’t build the transaction. Please try again."
        );
      } finally {
        if (buildGen === buildGenerationRef.current) {
          setIsLoading(false);
        }
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("=== SUPPLYBORROWMODAL HANDLESUBMIT DEBUG ===");
      console.log("Input params:", { asset, poolId, mode, amount });

      const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
      console.log(
        "All tokens for",
        asset,
        "on network",
        networkToUse,
        ":",
        tokens
          .filter((t) => t.symbol === asset)
          .map((t) => ({
            symbol: t.symbol,
            poolId: t.poolId,
            underlyingContractId: t.underlyingContractId,
          }))
      );

      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      let token = resolveSupplyBorrowToken(
        tokens,
        asset,
        poolId,
        configSymbol,
        marketId
      );

      // If token not found in specified network, try other enabled networks
      let actualNetwork = networkToUse;
      if (!token && !network) {
        const { getEnabledNetworks } = await import("@/config");
        const enabledNetworks = getEnabledNetworks();

        for (const enabledNetwork of enabledNetworks) {
          if (enabledNetwork === networkToUse) continue;

          const otherTokens = getAllTokensWithDisplayInfo(
            enabledNetwork as any
          );
          const otherToken = resolveSupplyBorrowToken(
            otherTokens,
            asset,
            poolId,
            configSymbol,
            marketId
          );

          if (otherToken) {
            // Found token in another network, use that network
            token = otherToken;
            actualNetwork = enabledNetwork;
            break;
          }
        }
      }

      console.log("Token lookup result:", {
        poolIdProvided: poolId,
        configSymbol,
        tokenFound: !!token,
        tokenPoolId: token?.poolId,
        tokenSymbol: token?.symbol,
        tokenConfigKey: (token as { configKey?: string } | undefined)?.configKey,
        tokenUnderlyingContractId: token?.underlyingContractId,
        networkUsed: actualNetwork,
      });

      if (!token) {
        console.error("Token not found!", {
          asset,
          poolId,
          availableTokens: tokens.filter((t) => t.symbol === asset),
        });
        throw new Error(
          `Token ${asset} not found in network config${poolId ? ` with poolId ${poolId}` : ""
          }`
        );
      }

      if (!token.poolId || !token.underlyingContractId) {
        throw new Error(
          `Token ${asset} missing pool or contract configuration`
        );
      }

      // Get the original token config to access tokenStandard
      const originalSymbol =
        (token as { configKey?: string }).configKey ??
        ("originalSymbol" in token ? (token as any).originalSymbol : asset);
      const tokenConfigRaw = getTokenConfig(
        actualNetwork as any,
        originalSymbol
      );
      if (!tokenConfigRaw) {
        throw new Error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
      }

      const originalTokenConfig = resolveTokenConfigFromDisplayToken(
        actualNetwork as NetworkId,
        {
          configKey: (token as { configKey?: string }).configKey,
          originalSymbol,
          symbol: token.symbol,
          poolId: token.poolId,
          underlyingContractId: token.underlyingContractId,
        }
      );

      if (!originalTokenConfig) {
        throw new Error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol}, contractId: ${token.underlyingContractId})`
        );
      }

      // Validate decimals exists
      if (
        typeof originalTokenConfig.decimals !== "number" ||
        isNaN(originalTokenConfig.decimals)
      ) {
        throw new Error(
          `Invalid decimals for token ${asset}: ${originalTokenConfig.decimals}`
        );
      }

      const needsStandalonePreDepositOptIn =
        originalTokenConfig.requireStandaloneFAssetOptInBeforeDeposit ||
        originalTokenConfig.requireStandaloneMarketAsaOptInBeforeDeposit;
      const skipPreDepositOptInForNativeAlgoMintRoute =
        originalTokenConfig.requireStandaloneMarketAsaOptInBeforeDeposit &&
        (isXalgoConsensusDepositAlgoRoute || isTalgoTinymanDepositAlgoRoute);
      const depositAdIdTrim = selectedDepositAdapterId.trim();
      const skipPreDepositOptInForMarketTokenDeposit =
        originalTokenConfig.requireStandaloneMarketAsaOptInBeforeDeposit &&
        depositAdIdTrim !== "" &&
        depositAdIdTrim !== XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID &&
        depositAdIdTrim !== TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID &&
        resolveDepositFolksAdapter(
          originalTokenConfig,
          depositAdIdTrim
        )?.depositWalletBasis === "market_token";
      if (
        mode === "deposit" &&
        actualNetwork === "algorand-mainnet" &&
        needsStandalonePreDepositOptIn &&
        !skipPreDepositOptInForNativeAlgoMintRoute &&
        !skipPreDepositOptInForMarketTokenDeposit &&
        fAssetPreOptInStatus !== "in"
      ) {
        const optLabel = originalTokenConfig.requireStandaloneMarketAsaOptInBeforeDeposit
          ? originalTokenConfig.symbol || originalTokenConfig.name || "this asset"
          : "the Folks f-asset";
        setError(
          fAssetPreOptInStatus === "checking"
            ? `Still checking ${optLabel} opt-in status. Wait a moment and try again.`
            : `Opt in to ${optLabel} first using the button above (one small transaction), then supply.`
        );
        setIsLoading(false);
        return;
      }

      // For borrows, check liquidity in market-token human (f-asset); input may be ALGO on underlying route
      if (mode === "borrow") {
        const marketHuman = borrowInputToMarketTokenHuman(
          amount,
          borrowInputReceiveBasis,
          folksMintedFAssetPerOneUnderlying,
          originalTokenConfig.decimals
        );
        if (marketHuman === null) {
          setError(
            "Wait for Folks rate to load, or switch borrow route to f-asset."
          );
          setIsLoading(false);
          return;
        }
        if (marketHuman > assetData.liquidity + 1e-9) {
          setError("Insufficient liquidity available for borrowing");
          setIsLoading(false);
          return;
        }
      }

      let amountHumanForAtomic = amount;
      if (
        mode === "borrow" &&
        borrowInputReceiveBasis === "underlying" &&
        folksMintedFAssetPerOneUnderlying != null &&
        folksMintedFAssetPerOneUnderlying > BigInt(0)
      ) {
        const parsed = parseFloat(amount) || 0;
        amountHumanForAtomic = String(
          folksUnderlyingHumanToFAssetHuman(
            parsed,
            folksMintedFAssetPerOneUnderlying,
            originalTokenConfig.decimals
          )
        );
      }

      // Convert amount to atomic units (considering token decimals)
      const amountInAtomicUnits = new BigNumber(amountHumanForAtomic)
        .multipliedBy(10 ** originalTokenConfig.decimals)
        .toFixed(0);

      console.log(`=== ${mode.toUpperCase()} TRANSACTION PARAMS ===`);
      console.log("Final parameters:", {
        poolId: token.poolId,
        poolIdFromProp: poolId,
        poolIdMatch: token.poolId === poolId,
        marketId: token.underlyingContractId,
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amountInAtomicUnits,
        userAddress: activeAccount.address,
        networkId: actualNetwork,
        depositAdapterId: selectedDepositAdapterId || undefined,
      });

      if (poolId && token.poolId !== poolId) {
        console.error("⚠️ POOLID MISMATCH!", {
          expectedPoolId: poolId,
          actualTokenPoolId: token.poolId,
          asset,
        });
      }

      let result;

      if (mode === "deposit") {
        // Call the lending service deposit method
        const depositAdapterTrimmed = selectedDepositAdapterId.trim();
        const useFolksTwoStep =
          isFolksAlgoDepositTwoStepEnabled() &&
          (actualNetwork as string) === "algorand-mainnet" &&
          depositAdapterTrimmed === FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING.id;
        const depositBaseOpts =
          depositAdapterTrimmed !== "" &&
          depositAdapterTrimmed !== XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID &&
          depositAdapterTrimmed !== TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID
            ? { depositAdapterId: depositAdapterTrimmed }
            : undefined;
        result = await withBuildTimeout(
          deposit(
            token.poolId,
            token.underlyingContractId,
            originalTokenConfig.tokenStandard,
            amountInAtomicUnits,
            activeAccount.address,
            actualNetwork as NetworkId,
            useFolksTwoStep
              ? { ...depositBaseOpts, folksTwoStep: "folks_mint_only" as const }
              : depositBaseOpts
          ),
          "deposit"
        );
      } else if (mode === "borrow") {
        // Call the lending service borrow method
        const borrowAdTrim = selectedBorrowAdapterId.trim();
        const borrowOpts =
          borrowAdTrim !== "" &&
          borrowAdTrim !== XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID
            ? { borrowAdapterId: selectedBorrowAdapterId }
            : undefined;
        result = await withBuildTimeout(
          borrow(
            token.poolId,
            token.underlyingContractId,
            originalTokenConfig.tokenStandard,
            amountInAtomicUnits,
            activeAccount.address,
            actualNetwork as NetworkId,
            borrowOpts
          ),
          "borrow"
        );
      } else {
        throw new Error(`Unsupported mode: ${mode}`);
      }

      if (buildGen !== buildGenerationRef.current) return;

      if (!result.success) {
        throw new Error(result.error || `${mode} failed`);
      }

      console.log(`${mode} result:`, result);

      if (
        mode === "deposit" &&
        "depositMeta" in result &&
        result.depositMeta?.folksTwoStep === "folks_mint_only" &&
        result.txns.length > 0
      ) {
        const underlyingAssetId =
          token && typeof token === "object" && "underlyingAssetId" in token
            ? (token as { underlyingAssetId?: string }).underlyingAssetId
            : undefined;
        setPendingSign({
          txnsB64: result.txns,
          poolAppId: token.poolId,
          marketContractId: token.underlyingContractId,
          underlyingAssetId: underlyingAssetId ?? null,
          actualNetwork: actualNetwork as NetworkId,
          tokenSymbol: asset,
          originalSymbol,
          originalTokenConfig: {
            decimals: originalTokenConfig.decimals,
            tokenStandard: String(originalTokenConfig.tokenStandard),
            poolId: originalTokenConfig.poolId,
          },
          signKind: "lending",
          txSignPreviewVariant: "lending",
          folksTwoStepPhase: "folks_mint_only",
          fAssetIdForFolksStep2: String(
            (originalTokenConfig as { assetId?: string | number }).assetId ?? ""
          ),
        });
        return;
      }

      if (activeWallet) {
        const walletId = activeWallet.id?.toLowerCase() || "";
        const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const networkId = actualNetwork as string;

        const isUniversalWallet =
          walletId === "lute" ||
          walletId === "kibisis" ||
          walletId === "vera" ||
          walletId === "biatec";

        const isVOIWallet = false;

        const isAlgorandWallet =
          walletId === "pera" ||
          walletId === "defly" ||
          walletName.includes("pera") ||
          walletName.includes("defly");

        const isWalletConnect = walletId === "walletconnect";
        let isWalletConnectVOI = false;
        let isWalletConnectAlgorand = false;

        if (isWalletConnect) {
          isWalletConnectVOI =
            walletName.includes("vera") || walletName.includes("biatec");
          isWalletConnectAlgorand =
            walletName.includes("pera") || walletName.includes("defly");
        }

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
          (!isVOIWallet && !isAlgorandWallet && !isWalletConnect);

        if (!isSupported) {
          const networkName =
            networkId === "voi-mainnet" ? "VOI Network" : "Algorand Mainnet";
          throw new Error(
            `Your wallet (${activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      const underlyingAssetId =
        token && typeof token === "object" && "underlyingAssetId" in token
          ? (token as { underlyingAssetId?: string }).underlyingAssetId
          : undefined;

      if (!result.txns || result.txns.length === 0) {
        throw new Error("No transactions returned from protocol; nothing to sign.");
      }

      setPendingSign({
        txnsB64: result.txns,
        poolAppId: token.poolId,
        marketContractId: token.underlyingContractId,
        underlyingAssetId: underlyingAssetId ?? null,
        actualNetwork: actualNetwork as NetworkId,
        tokenSymbol: asset,
        originalSymbol,
        originalTokenConfig: {
          decimals: originalTokenConfig.decimals,
          tokenStandard: String(originalTokenConfig.tokenStandard),
          poolId: originalTokenConfig.poolId,
        },
      });
    } catch (error) {
      if (buildGen !== buildGenerationRef.current) return;
      console.error(`${mode} error:`, error);

      // Enhanced error handling with specific messages
      let errorMessage = `${mode} failed`;

      if (error instanceof Error) {
        const message = error.message;
        const messageLower = message.toLowerCase();

        if (message.startsWith(`${BUILD_TIMEOUT_MARKER}:`)) {
          errorMessage =
            "We couldn’t build the transaction. Please try again.";
        } else if (messageLower.includes("compatible wallet")) {
          errorMessage = message;
        } else if (messageLower.includes("insufficient liquidity for withdraw")) {
          errorMessage =
            "Insufficient liquidity for withdraw. Please check your deposit and borrow balances, add collateral, or repay debt and try again.";
        } else if (messageLower.includes("insufficient collateral for borrow")) {
          errorMessage =
            "Insufficient collateral for borrow. Please check your collateral balance, add collateral, or repay debt and try again.";
        } else if (messageLower.includes("tried to spend")) {
          errorMessage = `Insufficient ${networkToUse === "algorand-mainnet" ? "Algorand" : "Voi"
            } Network balance for this transaction. Please check your wallet balance and try again.`;
        } else if (
          messageLower.includes("insufficient liquidity") ||
          messageLower.includes("insufficient collateral") ||
          messageLower.includes("insufficient wallet")
        ) {
          errorMessage =
            mode === "deposit"
              ? "Insufficient wallet balance for this transaction"
              : "Insufficient liquidity or collateral for this transaction";
        } else if (
          messageLower.includes("connection") ||
          messageLower.includes("network request failed") ||
          messageLower.includes("failed to fetch")
        ) {
          errorMessage =
            "Network connection issue. Please check your internet connection and try again.";
        } else if (
          messageLower.includes("rejected by user") ||
          messageLower.includes("user rejected") ||
          messageLower.includes("user cancelled") ||
          messageLower.includes("user canceled")
        ) {
          errorMessage = "Transaction was rejected or cancelled by user.";
        } else {
          errorMessage = getUserFriendlyError(error);
        }
      }

      setError(errorMessage);
    } finally {
      if (buildGen === buildGenerationRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleViewTransaction = () => {
    if (!transactionId) return;
    const net = (transactionNetworkId || network || currentNetwork) as NetworkId;
    window.open(getExplorerTransactionUrl(net, transactionId), "_blank");
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
    setTransactionId(null);
    setTransactionNetworkId(null);
  };

  const handleRetry = () => {
    setError(null);
    setRetryCount((prev) => prev + 1);
    handleBuildTransaction();
  };

  const showFolksTwoStepDepositStepper = useMemo(() => {
    if (mode !== "deposit" || !isFolksAlgoDepositTwoStepEnabled()) {
      return false;
    }
    if (String(networkToUse) !== "algorand-mainnet") return false;
    const ad = String(selectedDepositAdapterId ?? "").trim();
    if (ad === "") return false;
    return (
      ad === FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING.id ||
      ad === FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id
    );
  }, [mode, networkToUse, selectedDepositAdapterId]);

  const folksTwoStepSignLabelStep1 = useMemo(() => {
    if (pendingSign?.folksTwoStepPhase !== "folks_mint_only") {
      return null;
    }
    if (isSigning) return "Signing in wallet…";
    return "Review & sign in wallet";
  }, [pendingSign?.folksTwoStepPhase, isSigning]);

  const folksTwoStepSignLabelStep2 = useMemo(() => {
    if (!folksTwoStepMintConfirmed) return null;
    if (pendingSign?.folksTwoStepPhase === "folks_mint_only") return null;
    if (!pendingSign) return null;
    if (selectedDepositAdapterId !== FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id) {
      return null;
    }
    if (isSigning) return "Signing in wallet…";
    return "Review & sign in wallet";
  }, [
    folksTwoStepMintConfirmed,
    pendingSign,
    selectedDepositAdapterId,
    isSigning,
  ]);
  /** After mint, step2 is the active supply step. */
  const folksTwoStepStep2Current = useMemo(
    () =>
      folksTwoStepMintConfirmed &&
      selectedDepositAdapterId === FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id,
    [folksTwoStepMintConfirmed, selectedDepositAdapterId]
  );

  return (
    <>
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={onClose}
    >
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden flex flex-col p-0 overscroll-contain">
        {showSuccess ? (
          <div className="p-6">
            <SupplyBorrowCongrats
              transactionType={mode}
              asset={asset}
              assetIcon={assetData.icon}
              assetPairIcons={assetPairIcons}
              amount={amount}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
              viewTransactionDisabled={!transactionId}
              aboveActions={
                mode === "borrow" ? (
                  <BorrowSharePanel
                    active={showSuccess}
                    amount={amount}
                    assetSymbol={asset}
                    assetIconSrc={assetData.icon}
                    network={networkToUse}
                  />
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="flex flex-col min-h-0">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0">
                <DialogTitle className="sr-only">
                  {mode === "deposit" ? "Supply" : "Borrow"} {asset}
                </DialogTitle>
                {availableAssets &&
                availableAssets.length > 0 &&
                onSelectAsset ? (
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white capitalize">
                      {mode === "deposit" ? "supply" : "borrow"}
                    </h2>
                    <div className="flex items-center justify-center gap-3 pb-2 mt-3 h-14">
                      <Select
                        value={supplyBorrowSelectRowKey}
                        onValueChange={(value) => {
                          const idx = availableAssets.findIndex(
                            (a, i) => supplyBorrowAssetRowKey(a, i) === value
                          );
                          const selected =
                            idx >= 0 ? availableAssets[idx] : undefined;
                          if (selected) {
                            onSelectAsset(
                              selected.asset,
                              selected.poolId,
                              selected.network,
                              {
                                marketId: selected.marketId,
                                configSymbol: selected.configSymbol,
                                marketRowKey: selected.marketRowKey,
                              }
                            );
                          }
                        }}
                      >
                        <SelectTrigger className="w-auto min-w-0 h-auto bg-transparent border-none p-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 justify-center [&>svg:last-child]:!hidden">
                          <div className="flex items-center gap-2 shrink-0">
                            {(() => {
                              const idx = availableAssets.findIndex(
                                (a, i) =>
                                  supplyBorrowAssetRowKey(a, i) ===
                                  supplyBorrowSelectRowKey
                              );
                              const sel =
                                idx >= 0 ? availableAssets[idx] : undefined;
                              return (
                                <MarketRowTokenIcon
                                  market={{
                                    icon: sel?.icon ?? assetData.icon,
                                    asset,
                                    iconBadgeUrl: sel?.iconBadgeUrl,
                                  }}
                                  poolLetterLabel={null}
                                  imgClassName="h-12 w-12 rounded-full object-contain shadow"
                                />
                              );
                            })()}
                            <span className="flex items-center gap-1 text-xl font-semibold text-slate-800 dark:text-white">
                              {asset}
                              <ChevronDown className="h-4 w-4 text-slate-800 dark:text-white" />
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableAssets.map((a, i) => (
                            <SelectItem
                              key={supplyBorrowAssetRowKey(a, i)}
                              value={supplyBorrowAssetRowKey(a, i)}
                            >
                              <span className="flex items-center gap-2">
                                <MarketRowTokenIcon
                                  market={{
                                    icon: a.icon,
                                    asset: a.asset,
                                    iconBadgeUrl: a.iconBadgeUrl,
                                  }}
                                  poolLetterLabel={null}
                                  imgClassName="h-8 w-8 shrink-0 rounded-full object-contain"
                                />
                                <span>{a.asset}</span>
                                {a.value != null && (
                                  <span className="text-xs text-muted-foreground">
                                    —{" "}
                                    {mode === "borrow"
                                      ? `${Number(a.value).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}% borrow APY`
                                      : Number(a.value).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <SupplyBorrowHeader
                    mode={mode}
                    asset={asset}
                    assetIcon={assetData.icon}
                    assetPairIcons={assetPairIcons}
                  />
                )}
              </DialogHeader>
            </div>

            <div className="px-6 pt-2 pb-4 md:pb-3 space-y-3">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-1">
                        Transaction Failed
                      </p>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {error}
                      </p>
                      {retryCount > 0 && (
                        <p className="text-red-500 dark:text-red-500 text-xs mt-1">
                          Retry attempt: {retryCount}
                        </p>
                      )}
                    </div>
                    {retryCount < 3 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="ml-2 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {showFolksTwoStepDepositStepper && !showSuccess && (
                <div
                  className="mb-1 rounded-lg border border-teal-200/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-teal-800/40 dark:bg-slate-800/60"
                  role="navigation"
                  aria-label="Two-step Folks deposit progress"
                >
                  <p className="mb-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Two-step deposit
                  </p>
                  <ol className="flex w-full items-start gap-1 sm:gap-2">
                    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:flex-row sm:items-stretch">
                      <div className="flex w-full min-w-0 sm:items-center sm:gap-2">
                        <span
                          className={cn(
                            "mx-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:mx-0",
                            folksTwoStepMintConfirmed
                              ? "bg-teal-600 text-white dark:bg-teal-500"
                              : isSigning &&
                                  pendingSign?.folksTwoStepPhase ===
                                    "folks_mint_only"
                                ? "bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100"
                                : (selectedDepositAdapterId ===
                                      FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING.id ||
                                    pendingSign?.folksTwoStepPhase ===
                                      "folks_mint_only")
                                  ? "ring-2 ring-teal-500 ring-offset-1 ring-offset-white bg-teal-100 text-teal-900 dark:ring-offset-slate-900 dark:bg-teal-900/40 dark:text-teal-100"
                                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          )}
                          aria-current={
                            !folksTwoStepMintConfirmed
                              ? "step"
                              : undefined
                          }
                        >
                          {folksTwoStepMintConfirmed ? (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            "1"
                          )}
                        </span>
                        <div className="min-w-0 flex-1 text-center sm:text-left">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            Mint f-ALGO
                          </p>
                          {folksTwoStepSignLabelStep1 != null && (
                            <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 sm:justify-start">
                              {isSigning && pendingSign?.folksTwoStepPhase ===
                                "folks_mint_only" && (
                                <Loader2
                                  className="h-3 w-3 shrink-0 animate-spin"
                                  aria-hidden
                                />
                              )}
                              {folksTwoStepSignLabelStep1}
                            </p>
                          )}
                          {selectedDepositAdapterId ===
                            FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING.id &&
                            !pendingSign &&
                            !folksTwoStepMintConfirmed && (
                              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 sm:text-left">
                                Use ALGO · Build transaction
                              </p>
                            )}
                        </div>
                      </div>
                    </li>
                    <li
                      className="mt-3 flex h-px w-4 shrink-0 self-center border-t-2 border-dotted border-slate-300 sm:mt-0 sm:w-5 dark:border-slate-600"
                      aria-hidden
                    />
                    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:flex-row sm:items-stretch">
                      <div className="flex w-full min-w-0 sm:items-center sm:gap-2">
                        <span
                          className={cn(
                            "mx-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:mx-0",
                            isSigning &&
                              pendingSign &&
                              pendingSign.folksTwoStepPhase !==
                                "folks_mint_only" &&
                              selectedDepositAdapterId ===
                                FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id
                              ? "bg-teal-100 text-teal-900 dark:bg-teal-900/50"
                              : selectedDepositAdapterId ===
                                    FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id &&
                                  folksTwoStepMintConfirmed
                                ? "ring-2 ring-teal-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900"
                                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          )}
                        >
                          2
                        </span>
                        <div
                          className="min-w-0 flex-1 text-center sm:text-left"
                          aria-current={
                            folksTwoStepStep2Current ? "step" : undefined
                          }
                        >
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            Supply f-ALGO
                          </p>
                          {folksTwoStepSignLabelStep2 != null && (
                            <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 sm:justify-start">
                              {isSigning && (
                                <Loader2
                                  className="h-3 w-3 shrink-0 animate-spin"
                                  aria-hidden
                                />
                              )}
                              {folksTwoStepSignLabelStep2}
                            </p>
                          )}
                          {folksTwoStepMintConfirmed &&
                            selectedDepositAdapterId ===
                              FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET.id &&
                            !pendingSign &&
                            !showSuccess && (
                              <p className="mt-0.5 text-center text-[10px] text-slate-500 dark:text-slate-400 sm:text-left">
                                Tap Supply to retry if step 2 did not run
                              </p>
                            )}
                        </div>
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {mode === "borrow" &&
                !effectiveUserGlobalData &&
                activeAccount?.address &&
                (borrowUserGlobalFallbackStatus === "failed" ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-red-600 dark:text-red-400 text-sm mb-2">
                      Could not load your account summary. Check your connection
                      and try again.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900/30"
                      onClick={retryBorrowUserGlobalFetch}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                      Loading user data... Please wait before borrowing.
                    </p>
                  </div>
                ))}

              {mode === "deposit" &&
                !depositMultiRoute &&
                depositFolksAdapters.length === 1 && (
                <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white/60 p-3 dark:border-slate-600 dark:bg-slate-800/60">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Deposit route
                  </Label>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {depositFolksAdapters[0].label ?? depositFolksAdapters[0].name}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(depositFolksAdapters[0].depositWalletBasis ??
                    "underlying") === "market_token"
                      ? "f-asset from wallet"
                      : "Underlying (e.g. ALGO)"}
                  </p>
                </div>
              )}

              {mode === "borrow" && borrowFolksAdapters.length === 1 && (
                <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white/60 p-3 dark:border-slate-600 dark:bg-slate-800/60">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Borrow route
                  </Label>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {borrowFolksAdapters[0].label ?? borrowFolksAdapters[0].name}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(borrowFolksAdapters[0].borrowReceiveBasis ??
                    "market_token") === "underlying"
                      ? "Receive native ALGO (Folks redeem)"
                      : "Receive f-asset in wallet"}
                  </p>
                </div>
              )}

              {mode === "deposit" && depositNotice ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 mb-4">
                  <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                    {depositNotice}
                  </p>
                </div>
              ) : null}

              <SupplyBorrowForm
                key={
                  mode === "deposit" && selectedDepositAdapterId
                    ? `dep-${selectedDepositAdapterId}`
                    : `${mode}-form`
                }
                mode={mode}
                asset={asset}
                walletBalance={
                  mode === "deposit"
                    ? effectiveDepositWalletBalance
                    : propWalletBalance
                }
                walletBalanceUSD={
                  mode === "deposit"
                    ? effectiveDepositWalletBalanceUSD
                    : propWalletBalanceUSD
                }
                walletBalanceDisplaySymbol={
                  mode === "deposit"
                    ? isNativeAlgoConsensusDepositRoute
                      ? "ALGO"
                      : selectedDepositAdapter
                        ? selectedDepositAdapter.label ??
                          selectedDepositAdapter.name ??
                          asset
                        : undefined
                    : undefined
                }
                walletBalanceRowTitle={
                  mode === "deposit"
                    ? isNativeAlgoConsensusDepositRoute
                      ? "Wallet balance · ALGO"
                      : selectedDepositAdapter
                        ? `Wallet balance · ${
                            selectedDepositAdapter.label ??
                            selectedDepositAdapter.name ??
                            asset
                          }`
                        : undefined
                    : undefined
                }
                availableToSupplyOrBorrow={
                  mode === "borrow"
                    ? effectiveBorrowCapInInputUnits ?? 0
                    : assetData.liquidity
                }
                supplyAPY={assetData.supplyAPY}
                totalSupply={assetData.totalSupply}
                maxTotalDeposits={assetData.maxTotalDeposits}
                userGlobalData={effectiveUserGlobalData}
                collateralFactor={assetData.collateralFactor}
                onAmountChange={handleAmountChange}
                onSubmit={handleBuildTransaction}
                isLoading={isLoading || isSigning}
                disabled={
                  (mode === "borrow" && !effectiveUserGlobalData) ||
                  (mode === "borrow" && borrowExceedsEffectiveCap) ||
                  (mode === "borrow" && borrowSubmitBlockedBelowHfTarget) ||
                  (mode === "borrow" && borrowNoCapacityAtHfTarget) ||
                  (mode === "borrow" && borrowFolksBlockingSubmit) ||
                  (mode === "borrow" && borrowMaxLineLoading) ||
                  (mode === "borrow" &&
                    isXalgoConsensusBorrowAlgoRoute &&
                    amountBorrowMarketTokenHuman === null)
                }
                hideButton={true}
                isLoadingMaxBorrow={borrowMaxLineLoading}
                maxBorrowError={maxBorrowError}
                maxBorrowableUnitSymbol={maxBorrowableUnitSymbol}
                borrowFolksRateUnavailable={borrowFolksRateUnavailable}
                network={networkToUse}
                walletBalanceLastUpdated={walletBalanceLastUpdated}
                onRefreshWalletBalance={onRefreshWalletBalance}
                depositWalletBalancePending={
                  isLoadingWalletBalance ||
                  (isNativeAlgoConsensusDepositRoute &&
                    nativeAlgoSpendableHuman == null)
                }
                amountFieldEndAdornment={
                  depositMultiRoute ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDepositRoutePickerOpen(true)}
                      className="h-8 max-w-full gap-1 px-2 text-teal-600 hover:bg-teal-500/15 dark:text-teal-400"
                      title="Choose deposit route"
                    >
                      <span className="truncate text-sm font-medium">
                        {isNativeAlgoConsensusDepositRoute
                          ? "ALGO"
                          : (xalgoDepositConsensusAlgoOption ||
                                talgoDepositTinymanAlgoOption) &&
                              selectedDepositAdapterId === ""
                            ? asset
                            : selectedDepositAdapter?.label ??
                              selectedDepositAdapter?.name ??
                              asset}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 opacity-80"
                        aria-hidden
                      />
                    </Button>
                  ) : borrowMultiRoute ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBorrowRoutePickerOpen(true)}
                      className="h-8 max-w-full gap-1 px-2 text-whale-gold hover:bg-whale-gold/15 dark:text-whale-gold"
                      title="Choose borrow route"
                    >
                      <span className="truncate text-sm font-medium">
                        {isXalgoConsensusBorrowAlgoRoute
                          ? "ALGO"
                          : xalgoBorrowConsensusAlgoOption &&
                              selectedBorrowAdapterId === ""
                            ? "xALGO"
                            : selectedBorrowAdapter?.label ??
                              selectedBorrowAdapter?.name ??
                              asset}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 opacity-80"
                        aria-hidden
                      />
                    </Button>
                  ) : undefined
                }
              />

              <SupplyBorrowStats
                mode={mode}
                asset={asset}
                poolId={poolId}
                network={networkToUse}
                assetData={assetData}
                userGlobalData={effectiveUserGlobalData}
                poolGlobalUserData={poolGlobalUserData}
                depositAmount={mode === "deposit" ? parseFloat(amount) || 0 : 0}
                borrowAmount={
                  mode === "borrow"
                    ? amountBorrowMarketTokenHuman != null
                      ? amountBorrowMarketTokenHuman
                      : 0
                    : 0
                }
                userBorrowBalance={userBorrowBalance}
                isSToken={assetData.isSToken || false}
                poolCollateralMarkets={poolCollateralMarkets}
              />

              {pendingSign && (
                <TransactionSignPreview
                  mode={mode}
                  asset={pendingSign.tokenSymbol}
                  amount={
                    pendingSign.txSignPreviewVariant ===
                    "xalgo-borrow-burn-combined"
                      ? pendingSign.consensusBurnAlgoHuman ?? amount
                      : (pendingSign.txSignPreviewVariant ===
                            "xalgo-mint-supply-combined" ||
                          pendingSign.txSignPreviewVariant ===
                            "talgo-tinyman-mint-supply-combined")
                        ? pendingSign.consensusMintAlgoHuman ?? amount
                        : pendingSign.signKind === "xalgo-consensus-mint" &&
                            pendingSign.consensusMintAlgoHuman
                          ? pendingSign.consensusMintAlgoHuman
                          : pendingSign.previewAmountHuman != null
                            ? pendingSign.previewAmountHuman
                            : amount
                  }
                  networkId={pendingSign.actualNetwork}
                  poolAppId={
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "talgo-tinyman-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-borrow-burn-combined"
                      ? pendingSign.poolAppId
                      : pendingSign.signKind === "xalgo-consensus-mint" &&
                          pendingSign.consensusAppIdForPreview
                        ? pendingSign.consensusAppIdForPreview
                        : pendingSign.poolAppId
                  }
                  marketContractId={pendingSign.marketContractId}
                  underlyingAssetId={pendingSign.underlyingAssetId}
                  txnCount={pendingSign.txnsB64.length}
                  estimatedFeeAlgoDisplay={(
                    (pendingSign.txnsB64.length * 1000) /
                    1e6
                  ).toFixed(4)}
                  reserveFactorPercent={assetData.reserveFactor ?? null}
                  lendingPoolAppId={
                    pendingSign.signKind === "xalgo-consensus-mint" &&
                    pendingSign.txSignPreviewVariant !==
                      "xalgo-mint-supply-combined" &&
                    pendingSign.txSignPreviewVariant !==
                      "talgo-tinyman-mint-supply-combined"
                      ? pendingSign.poolAppId
                      : null
                  }
                  previewVariant={
                    pendingSign.txSignPreviewVariant ??
                    (pendingSign.signKind === "xalgo-consensus-mint"
                      ? "xalgo-consensus-mint"
                      : "lending")
                  }
                  governanceConsensusAppId={
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "talgo-tinyman-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-borrow-burn-combined"
                      ? pendingSign.consensusAppIdForPreview ?? undefined
                      : undefined
                  }
                  mintThenSupplyXalgoHumanMin={
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "talgo-tinyman-mint-supply-combined" ||
                    pendingSign.txSignPreviewVariant ===
                      "xalgo-borrow-burn-combined"
                      ? pendingSign.previewAmountHuman ?? undefined
                      : undefined
                  }
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 shrink-0 space-y-2">
              {!pendingSign &&
                mode === "deposit" &&
                depositRequiresStandaloneFAssetOptIn &&
                fAssetPreOptInStatus !== "in" && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {fAssetPreOptInStatus === "checking"
                      ? `Checking ${preDepositFAssetDisplayLabel} opt-in…`
                      : `Opt in to ${preDepositFAssetDisplayLabel} first (one transaction), then you can supply.`}
                  </p>
                )}
              <div className="flex gap-3">
              {pendingSign ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setPendingSign(null)}
                    disabled={isSigning}
                    className="flex-1"
                  >
                    Back to edit
                  </Button>
                  <Button
                    onClick={handleConfirmSign}
                    disabled={isSigning}
                    className={`flex-1 font-semibold h-11 ${mode === "deposit"
                      ? "bg-teal-600 hover:bg-teal-700 text-white"
                      : "bg-whale-gold hover:bg-whale-gold/90 text-black"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSigning ? (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing…
                      </div>
                    ) : (
                      "Sign in wallet"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading || isPreDepositFAssetOptInSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  {mode === "deposit" &&
                  depositRequiresStandaloneFAssetOptIn &&
                  fAssetPreOptInStatus !== "in" ? (
                    <Button
                      type="button"
                      onClick={() => void handlePreDepositFAssetOptIn()}
                      disabled={
                        isPreDepositFAssetOptInSubmitting ||
                        fAssetPreOptInStatus === "checking"
                      }
                      className="flex-1 font-semibold h-11 bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPreDepositFAssetOptInSubmitting ? (
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Signing…
                        </div>
                      ) : fAssetPreOptInStatus === "checking" ? (
                        "Checking…"
                      ) : (
                        `Opt in to ${preDepositFAssetDisplayLabel}`
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBuildTransaction}
                      disabled={
                        !amount ||
                        parseFloat(amount) <= 0 ||
                        isLoading ||
                        (mode === "borrow" && !effectiveUserGlobalData) ||
                        (mode === "borrow" && borrowNoCapacityAtHfTarget) ||
                        (mode === "borrow" && borrowExceedsEffectiveCap) ||
                        (mode === "borrow" && borrowSubmitBlockedBelowHfTarget) ||
                        (mode === "borrow" && borrowFolksBlockingSubmit) ||
                        (mode === "borrow" && borrowMaxLineLoading) ||
                        (mode === "borrow" &&
                          isXalgoConsensusBorrowAlgoRoute &&
                          amountBorrowMarketTokenHuman === null) ||
                        (mode === "deposit" && depositBlockedByLowEstimatedHealth)
                      }
                      className={`flex-1 font-semibold h-11 ${mode === "deposit"
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "bg-whale-gold hover:bg-whale-gold/90 text-black"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Building transaction…
                        </div>
                      ) : (
                        `${mode === "deposit" ? "Supply" : "Borrow"} ${asset}`
                      )}
                    </Button>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog
      open={depositRoutePickerOpen && depositMultiRoute}
      onOpenChange={(open) => {
        if (depositMultiRoute) setDepositRoutePickerOpen(open);
      }}
    >
      <DialogContent className="max-h-[min(85vh,85dvh)] min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            Deposit route
          </DialogTitle>
          <DialogDescription>
            Choose what you supply from your wallet for this market.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          {talgoDepositTinymanAlgoOption &&
            depositFolksAdapters.length === 0 && (
              <button
                key="talgo-wallet-asa"
                type="button"
                onClick={() => {
                  setSelectedDepositAdapterId("");
                  setDepositRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selectedDepositAdapterId === ""
                    ? "border-teal-500 bg-teal-50/90 dark:border-teal-500 dark:bg-teal-950/40"
                    : "border-slate-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-teal-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    tALGO
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Supply Tinyman tALGO ASA you already hold (no ALGO mint).
                  </div>
                </div>
                {selectedDepositAdapterId === "" ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                ) : null}
              </button>
            )}
          {talgoDepositTinymanAlgoOption ? (
            <button
              key={TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID}
              type="button"
              onClick={() => {
                setSelectedDepositAdapterId(TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID);
                setDepositRoutePickerOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                selectedDepositAdapterId === TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID
                  ? "border-teal-500 bg-teal-50/90 dark:border-teal-500 dark:bg-teal-950/40"
                  : "border-slate-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-teal-700 dark:hover:bg-slate-800"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ALGO
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Mint tALGO from native ALGO via Tinyman liquid staking, then
                  supply to this market in one transaction (use Supply below).
                </div>
              </div>
              {selectedDepositAdapterId ===
              TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID ? (
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                  aria-hidden
                />
              ) : null}
            </button>
          ) : null}
          {xalgoDepositConsensusAlgoOption &&
            depositFolksAdapters.length === 0 && (
              <button
                key="xalgo-wallet-asa"
                type="button"
                onClick={() => {
                  setSelectedDepositAdapterId("");
                  setDepositRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selectedDepositAdapterId === ""
                    ? "border-teal-500 bg-teal-50/90 dark:border-teal-500 dark:bg-teal-950/40"
                    : "border-slate-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-teal-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    xALGO
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Supply governance xALGO ASA you already hold (no consensus
                    mint).
                  </div>
                </div>
                {selectedDepositAdapterId === "" ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                ) : null}
              </button>
            )}
          {xalgoDepositConsensusAlgoOption ? (
            <button
              key={XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID}
              type="button"
              onClick={() => {
                setSelectedDepositAdapterId(
                  XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID
                );
                setDepositRoutePickerOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                selectedDepositAdapterId ===
                  XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID
                  ? "border-teal-500 bg-teal-50/90 dark:border-teal-500 dark:bg-teal-950/40"
                  : "border-slate-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-teal-700 dark:hover:bg-slate-800"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ALGO
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Mint xALGO from native ALGO via consensus, then supply to this
                  market in one transaction (use Supply below).
                </div>
              </div>
              {selectedDepositAdapterId ===
              XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID ? (
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                  aria-hidden
                />
              ) : null}
            </button>
          ) : null}
          {depositFolksAdapters.map((a) => {
            const sid = tokenAdapterStableId(a);
            const selected = sid === selectedDepositAdapterId;
            const basis = a.depositWalletBasis ?? "underlying";
            const basisLabel =
              basis === "market_token"
                ? "f-asset from wallet"
                : "Underlying (e.g. ALGO)";
            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSelectedDepositAdapterId(sid);
                  setDepositRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-teal-500 bg-teal-50/90 dark:border-teal-500 dark:bg-teal-950/40"
                    : "border-slate-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-teal-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {a.label ?? a.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {basisLabel}
                  </div>
                </div>
                {selected ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={borrowRoutePickerOpen && borrowMultiRoute}
      onOpenChange={(open) => {
        if (borrowMultiRoute) setBorrowRoutePickerOpen(open);
      }}
    >
      <DialogContent className="max-h-[min(85vh,85dvh)] min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            Borrow route
          </DialogTitle>
          <DialogDescription>
            Choose what you receive in your wallet after this borrow.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          {xalgoBorrowConsensusAlgoOption &&
            borrowFolksAdapters.length === 0 && (
              <button
                key="xalgo-borrow-asa"
                type="button"
                onClick={() => {
                  setSelectedBorrowAdapterId("");
                  setBorrowRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selectedBorrowAdapterId === ""
                    ? "border-amber-500 bg-amber-50/90 dark:border-amber-500 dark:bg-amber-950/40"
                    : "border-slate-200 bg-white/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-amber-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    xALGO
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Borrow governance xALGO ASA to your wallet (no consensus burn).
                  </div>
                </div>
                {selectedBorrowAdapterId === "" ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                ) : null}
              </button>
            )}
          {xalgoBorrowConsensusAlgoOption ? (
            <button
              key={XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID}
              type="button"
              onClick={() => {
                setSelectedBorrowAdapterId(
                  XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID
                );
                setBorrowRoutePickerOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                selectedBorrowAdapterId ===
                  XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID
                  ? "border-amber-500 bg-amber-50/90 dark:border-amber-500 dark:bg-amber-950/40"
                  : "border-slate-200 bg-white/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-amber-700 dark:hover:bg-slate-800"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ALGO
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Borrow xALGO from the pool, burn to native ALGO via consensus in
                  one transaction (amount is ALGO you expect to receive, min).
                </div>
              </div>
              {selectedBorrowAdapterId ===
              XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID ? (
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
              ) : null}
            </button>
          ) : null}
          {borrowFolksAdapters.map((a) => {
            const sid = tokenAdapterStableId(a);
            const selected = sid === selectedBorrowAdapterId;
            const basis = a.borrowReceiveBasis ?? "market_token";
            const basisLabel =
              basis === "underlying"
                ? "Native ALGO (Folks redeem)"
                : "f-asset in wallet";
            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSelectedBorrowAdapterId(sid);
                  setBorrowRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-amber-500 bg-amber-50/90 dark:border-amber-500 dark:bg-amber-950/40"
                    : "border-slate-200 bg-white/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-amber-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {a.label ?? a.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {basisLabel}
                  </div>
                </div>
                {selected ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default SupplyBorrowModal;
