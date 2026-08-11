import { useState, useEffect, useMemo, useRef } from "react";
import BigNumber from "bignumber.js";
import type { ConsensusState } from "@folks-finance/algorand-sdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { InfoIcon, ChevronDown, ChevronUp, Check } from "lucide-react";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import { RepaySharePanel } from "@/components/repay/RepaySharePanel";
import { formatRelativeTime } from "@/utils/timeUtils";
import { useNetwork } from "@/contexts/NetworkContext";
import { calculateBorrowAPY } from "@/utils/apyCalculations";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatUsdPerTokenDisplay } from "@/lib/utils";
import { usdValueForHumanTokenAmount, resolveUsdPerTokenFromMarketInfo } from "@/utils/assetDecimals";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";
import type {
  FolksTokenAdapterConfig,
  NetworkId,
  TokenConfig,
} from "@/config";
import {
  getAlgorandNetworkFromNetworkId,
  getAnyFolksAdapter,
  getAllTokensWithDisplayInfo,
  getFolksAdapterForPhase,
  tokenAdapterStableId,
} from "@/config";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import {
  isEvmXchainWallet,
  isRainbowkitXchainWallet,
} from "@/wallet/xchainSignUi";
import algorandService, {
  type AlgorandNetwork,
} from "@/services/algorandService";
import {
  isCrossAssetRepayFeatureEnabled,
} from "@/services/haystackRouterService";
import { executeHaystackSwap } from "@/services/haystackSwapExecute";
import { useHaystackRepayQuote } from "@/hooks/useHaystackRepayQuote";
import { CrossAssetRepaySection } from "@/components/repay/CrossAssetRepaySection";
import { RepayAmountRows } from "@/components/repay/RepayAmountRows";
import {
  listHaystackPaymentAssets,
  resolveHaystackDebtAsaId,
} from "@/utils/haystackAsaIds";
import {
  ALGORAND_MAINNET_NODELY_ALGOD_URL,
  XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID,
  algoMicroNeededForMinXalgoOutImmediateMintFloor,
  fetchXalgoMainnetConsensusState,
  minXalgoOutImmediateMintFloor,
} from "@/services/xalgoConsensusAdapter";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
  folksUnderlyingHumanToFAssetHuman,
} from "@/services/folksDepositAdapter";
import { spendableAlgoHumanFromAccount } from "@/utils/algorandWalletBalance";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import {
  asaAmountFromAccountInfo,
  getCachedAccountInformation,
} from "@/utils/walletBalanceRpc";
import { withRpcReadCache } from "@/utils/rpcReadCache";
import { fetchMarketInfo } from "@/services/lendingService";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  buildLiquidationThresholdSummaryForDeposit,
  DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX,
  estimatePoolHealthAfterRepay,
} from "@/utils/depositModalPoolHealthEstimate";

/** Amount field is in underlying (e.g. ALGO) vs market f-asset; convert to f-asset human for caps / HF. */
function repayInputToMarketTokenHuman(
  amountStr: string,
  walletBasis: "underlying" | "market_token" | undefined,
  mintedFAssetPerOneUnderlying: bigint | null,
  decimals: number
): number | null {
  const amt = parseFloat(amountStr) || 0;
  if (amt <= 0) return 0;
  if (walletBasis === "underlying") {
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

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  poolId?: string; // For dropdown selection when multiple borrows exist
  network?: string; // Network ID for transaction viewing / dropdown selection
  currentBorrow: number;
  accruedInterest: number;
  walletBalance: number;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number | null;
    currentLTV: number;
    tokenPrice: number;
    collateralFactor?: number;
    totalDeposits?: number;
    totalBorrows?: number;
    apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
    isSToken?: boolean;
  };
  lastUpdateTime?: number; // Market's last update time (when market indices were updated)
  userLastUpdateTime?: number; // User's last update time (when user last interacted with market)
  /** `amount` is in the selected route’s units (f-asset human vs underlying human when Folks repay adapters exist). */
  onSubmit: (
    amount: string,
    opts?: { isRepayAll?: boolean; repayAdapterId?: string }
  ) => Promise<string>;
  /** Folks repay-phase adapters (e.g. fALGO vs ALGO); omit or empty = legacy single-route repay. */
  repayFolksAdapters?: FolksTokenAdapterConfig[];
  /** Decimals for f-asset / underlying (e.g. 6 for ALGO). */
  repayTokenDecimals?: number;
  /**
   * Minted f-asset atomic units for 1.0 underlying (same key as Portfolio withdraw).
   * When set, skips a second Folks RPC for ALGO↔f conversion.
   */
  folksMintOneUnderlyingAtomic?: string;
  /** Full token row; used to resolve Folks pool via deposit adapter (stable vs repay-only list). */
  repayTokenConfig?: Pick<
    TokenConfig,
    | "adapter"
    | "adapters"
    | "assetId"
    | "tokenStandard"
    | "isStoken"
    | "marketOverride"
    | "decimals"
    | "symbol"
  > | null;
  /** Market contract id (ntoken / underlyingContractId) for atomic Haystack+repay. */
  repayMarketId?: string;
  /** Parent can hide Radix overlay while Haystack swap signs (optional). */
  onRainbowkitHostOverlaySuppressed?: (suppressed: boolean) => void;
  /** When provided, show asset dropdown like Supply/Withdraw modals */
  availableAssets?: {
    asset: string;
    icon: string;
    value?: number;
    poolId?: string;
    network?: string;
  }[];
  onSelectAsset?: (asset: string, poolId?: string, network?: string) => void;
  /** Per-pool user totals (USD) for est. health; undefined = loading */
  poolGlobalUserData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  /** Percent 0–100; used with pool collateral rows for min LT (borrow modal parity). */
  liquidationThresholdPercent?: number | null;
  /**
   * When true on Algorand mainnet Governance xALGO, offer repay from wallet xALGO (default) vs native ALGO
   * (consensus `immediate_mint` then nt200 deposit + repay in one group).
   */
  xalgoConsensusRepayAlgoOption?: boolean;
  /**
   * When true, the dialog is not presented so a parent can hide the Radix overlay
   * while xChain (RainbowKit) wallet signing UI appears.
   */
  rainbowkitHostOverlaySuppressed?: boolean;
}

const RepayModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  poolId,
  network,
  currentBorrow,
  accruedInterest,
  walletBalance,
  marketStats,
  lastUpdateTime,
  userLastUpdateTime,
  onSubmit,
  availableAssets,
  onSelectAsset,
  poolGlobalUserData,
  poolCollateralMarkets,
  liquidationThresholdPercent,
  repayFolksAdapters,
  repayTokenDecimals = 6,
  folksMintOneUnderlyingAtomic,
  repayTokenConfig,
  repayMarketId,
  xalgoConsensusRepayAlgoOption = false,
  rainbowkitHostOverlaySuppressed = false,
  onRainbowkitHostOverlaySuppressed,
}: RepayModalProps) => {
  const { activeAccount, activeWallet, transactionSigner } =
    useDorkFiWalletAdapter();
  const { toast } = useToast();
  const [amount, setAmount] = useState<number | "">("");
  const [fiatValue, setFiatValue] = useState(0);
  const { currentNetwork } = useNetwork();
  const networkToUse = network || currentNetwork;
  const { price: oracleTokenPrice } = useTokenPrice(tokenSymbol, networkToUse);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isRepayAll, setIsRepayAll] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<"amount" | "confirm">(
    "amount"
  );
  /** null = repay with debt asset (default). */
  const [crossAssetPaymentAsaId, setCrossAssetPaymentAsaId] = useState<
    number | null
  >(null);
  const [crossAssetSlippagePercent, setCrossAssetSlippagePercent] = useState(1);
  const [haystackSignSuppressed, setHaystackSignSuppressed] = useState(false);
  /** After a successful Haystack swap, skip re-swapping on repay retry. */
  const [completedCrossAssetSwapTxId, setCompletedCrossAssetSwapTxId] = useState<
    string | null
  >(null);
  const repaySubmitInFlightRef = useRef(false);
  const [expandedDetails, setExpandedDetails] = useState<{
    borrowAPY: boolean;
    accruedInterest: boolean;
    liquidationMargin: boolean;
    healthFactor: boolean;
    ltv: boolean;
    collateralFactor: boolean;
  }>({
    borrowAPY: false,
    accruedInterest: false,
    liquidationMargin: false,
    healthFactor: false,
    ltv: false,
    collateralFactor: false,
  });

  const repayAdapterList = repayFolksAdapters ?? [];
  /** Governance xALGO only: Folks-style repay adapters are absent; use synthetic xALGO vs ALGO routes. */
  const xalgoRepayRoutesActive =
    Boolean(xalgoConsensusRepayAlgoOption) &&
    networkToUse === "algorand-mainnet" &&
    tokenSymbol === "xALGO" &&
    repayAdapterList.length === 0;

  /** Content-stable key so parent re-renders (new array ref from getFolksAdaptersForPhase) do not restart effects. */
  const repayAdaptersSignature = xalgoRepayRoutesActive
    ? "xalgo-mainnet-repay-routes"
    : repayAdapterList.length === 0
      ? ""
      : [...repayAdapterList]
          .map((a) => tokenAdapterStableId(a))
          .sort()
          .join("|");

  const repayMultiRoute =
    repayAdapterList.length > 1 || xalgoRepayRoutesActive;

  /** Folks multi-route and xALGO consensus dual-route hide MAX (precision / repay-all semantics). */
  const showMaxButton =
    repayAdapterList.length === 0 && !xalgoRepayRoutesActive;

  const debtHaystackAsaId = useMemo(() => {
    if (networkToUse !== "algorand-mainnet") return null;
    return resolveHaystackDebtAsaId({
      networkId: networkToUse as NetworkId,
      tokenSymbol,
      poolId,
      repayTokenConfig: repayTokenConfig ?? null,
    });
  }, [networkToUse, tokenSymbol, poolId, repayTokenConfig]);

  const [selectedRepayAdapterId, setSelectedRepayAdapterId] =
    useState<string>("");
  const [repayRoutePickerOpen, setRepayRoutePickerOpen] = useState(false);
  const [folksMintedFAssetPerOneUnderlying, setFolksMintedFAssetPerOneUnderlying] =
    useState<bigint | null>(null);
  const [folksMintRatioStatus, setFolksMintRatioStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  /** Human balance of the *underlying* spend asset (native ALGO or Folks pool ASA, e.g. USDC). */
  const [nativeAlgoWalletHuman, setNativeAlgoWalletHuman] = useState<
    number | undefined
  >(undefined);
  /** Spendable balance of the selected Haystack payment ASA (human units). */
  const [crossAssetPaymentWalletHuman, setCrossAssetPaymentWalletHuman] =
    useState<number | undefined>(undefined);
  /** One account snapshot provides balances for every cross-asset dropdown row. */
  const [crossAssetPaymentBalances, setCrossAssetPaymentBalances] = useState<
    Record<number, number> | null
  >(null);
  /** USD/token for payment ASAs (lending oracle); missing keys show $0.00. */
  const [crossAssetPaymentUsdPrices, setCrossAssetPaymentUsdPrices] = useState<
    Record<number, number> | null
  >(null);
  const [xalgoRepayConsensusState, setXalgoRepayConsensusState] =
    useState<ConsensusState | null>(null);

  const selectedRepayAdapter = useMemo(() => {
    if (repayAdapterList.length === 0) return undefined;
    const want = selectedRepayAdapterId.trim();
    if (want !== "") {
      const hit = repayAdapterList.find(
        (a) => tokenAdapterStableId(a) === want
      );
      if (hit) return hit;
    }
    return repayAdapterList[0];
  }, [repayAdapterList, selectedRepayAdapterId]);

  const isXalgoConsensusRepayAlgoRoute =
    xalgoRepayRoutesActive &&
    selectedRepayAdapterId === XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID;

  /**
   * Allow cross-asset on Algorand whenever we can resolve a debt ASA.
   * Only block while the user is on the xALGO→ALGO consensus mint repay route
   * (that path already spends native ALGO).
   */
  const crossAssetEligible =
    isCrossAssetRepayFeatureEnabled() &&
    networkToUse === "algorand-mainnet" &&
    debtHaystackAsaId != null &&
    !isXalgoConsensusRepayAlgoRoute;

  const haystackPaymentAssets = useMemo(() => {
    if (!crossAssetEligible || debtHaystackAsaId == null) return [];
    return listHaystackPaymentAssets(
      networkToUse as NetworkId,
      debtHaystackAsaId
    );
  }, [crossAssetEligible, debtHaystackAsaId, networkToUse]);

  const crossAssetActive =
    crossAssetEligible &&
    crossAssetPaymentAsaId != null &&
    crossAssetPaymentAsaId !== debtHaystackAsaId;

  const selectedPaymentAsset = useMemo(
    () =>
      haystackPaymentAssets.find((a) => a.asaId === crossAssetPaymentAsaId) ??
      null,
    [haystackPaymentAssets, crossAssetPaymentAsaId]
  );

  const haystackQuote = useHaystackRepayQuote({
    enabled: Boolean(isOpen && crossAssetActive),
    debtAsaId: debtHaystackAsaId,
    paymentAsaId: crossAssetPaymentAsaId,
    debtAmountHuman: amount === "" ? "" : String(amount),
    debtDecimals: repayTokenDecimals,
    chain: "mainnet",
  });

  useEffect(() => {
    if (!isOpen) {
      setCrossAssetPaymentAsaId(null);
      setHaystackSignSuppressed(false);
      setCompletedCrossAssetSwapTxId(null);
      repaySubmitInFlightRef.current = false;
    }
  }, [isOpen]);

  // Changing payment asset or amount invalidates a prior partial swap success marker.
  useEffect(() => {
    setCompletedCrossAssetSwapTxId(null);
  }, [crossAssetPaymentAsaId, amount]);

  useEffect(() => {
    onRainbowkitHostOverlaySuppressed?.(haystackSignSuppressed);
  }, [haystackSignSuppressed, onRainbowkitHostOverlaySuppressed]);

  // Clear alternate payment asset if user switches onto xALGO consensus ALGO route.
  useEffect(() => {
    if (isXalgoConsensusRepayAlgoRoute) {
      setCrossAssetPaymentAsaId(null);
    }
  }, [isXalgoConsensusRepayAlgoRoute]);

  const repayWalletBasis = isXalgoConsensusRepayAlgoRoute
    ? "underlying"
    : (selectedRepayAdapter?.repayWalletBasis ?? "market_token");

  const walletUnitSymbol = isXalgoConsensusRepayAlgoRoute
    ? "ALGO"
    : repayAdapterList.length > 0
      ? selectedRepayAdapter?.label ??
        selectedRepayAdapter?.name ??
        tokenSymbol
      : tokenSymbol;

  const repayRouteButtonLabel = useMemo(() => {
    if (xalgoRepayRoutesActive) {
      if (!selectedRepayAdapterId) return "xALGO";
      if (selectedRepayAdapterId === XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID) {
        return "ALGO";
      }
    }
    return (
      selectedRepayAdapter?.label ??
      selectedRepayAdapter?.name ??
      tokenSymbol
    );
  }, [
    xalgoRepayRoutesActive,
    selectedRepayAdapterId,
    selectedRepayAdapter?.label,
    selectedRepayAdapter?.name,
    tokenSymbol,
  ]);

  // Get health factor label and color based on ranges
  const getHealthFactorLabel = (
    healthFactor: number | null
  ): { label: string; color: string } => {
    if (healthFactor === null) {
      return { label: "N/A", color: "text-gray-400 dark:text-gray-500" };
    }
    if (healthFactor >= 3.0) {
      return { label: "Safe", color: "text-green-600 dark:text-green-400" };
    } else if (healthFactor >= 1.5) {
      return { label: "Moderate", color: "text-blue-600 dark:text-blue-400" };
    } else if (healthFactor >= 1.2) {
      return {
        label: "Caution",
        color: "text-yellow-600 dark:text-yellow-400",
      };
    } else if (healthFactor >= 1.0) {
      return {
        label: "Critical",
        color: "text-orange-600 dark:text-orange-400",
      };
    } else {
      return { label: "Liquidatable", color: "text-red-600 dark:text-red-400" };
    }
  };

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setIsLoading(false);
      setTransactionId(null);
      setIsRepayAll(false);
      setWorkflowStep("amount");
      setRepayRoutePickerOpen(false);
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("idle");
      setNativeAlgoWalletHuman(undefined);
      setXalgoRepayConsensusState(null);
      setExpandedDetails({
        borrowAPY: false,
        accruedInterest: false,
        liquidationMargin: false,
        healthFactor: false,
        ltv: false,
        collateralFactor: false,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setRepayRoutePickerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (xalgoRepayRoutesActive) {
      const valid = new Set<string>(["", XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID]);
      setSelectedRepayAdapterId((prev) => (valid.has(prev) ? prev : ""));
      return;
    }
    if (repayAdaptersSignature === "") {
      setSelectedRepayAdapterId("");
      return;
    }
    setSelectedRepayAdapterId((prev) => {
      const ids = repayAdapterList.map((a) => tokenAdapterStableId(a));
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [isOpen, repayAdaptersSignature, xalgoRepayRoutesActive, repayAdapterList]);

  useEffect(() => {
    if (!isOpen) return;
    if (xalgoRepayRoutesActive) {
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("idle");
      return;
    }
    if (repayAdaptersSignature === "") {
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("idle");
      return;
    }

    const cached = folksMintOneUnderlyingAtomic?.trim();
    if (cached) {
      try {
        const v = BigInt(cached);
        if (v > BigInt(0)) {
          setFolksMintedFAssetPerOneUnderlying(v);
          setFolksMintRatioStatus("ready");
          return;
        }
      } catch {
        /* fall through to RPC */
      }
    }

    const folksFromConfig =
      repayTokenConfig != null
        ? getFolksAdapterForPhase(repayTokenConfig, "deposit") ??
          getAnyFolksAdapter(repayTokenConfig)
        : undefined;
    const folks =
      folksFromConfig ??
      getAnyFolksAdapter({ adapters: repayAdapterList });
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!folks || !aln) {
      setFolksMintedFAssetPerOneUnderlying(null);
      setFolksMintRatioStatus("failed");
      return;
    }
    setFolksMintRatioStatus("loading");
    let cancelled = false;
    (async () => {
      try {
        const { algod } = algorandService.initializeClients(aln as any);
        const oneUnderlying = BigInt(10) ** BigInt(repayTokenDecimals);
        const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
          poolName: folks.folksParams.pool,
          underlyingAmount: oneUnderlying,
          algod,
        });
        if (!cancelled) {
          setFolksMintedFAssetPerOneUnderlying(mintedFAsset);
          setFolksMintRatioStatus("ready");
        }
      } catch (e) {
        console.warn("[RepayModal] Folks mint ratio fetch failed", e);
        if (!cancelled) {
          setFolksMintedFAssetPerOneUnderlying(null);
          setFolksMintRatioStatus("failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    repayAdaptersSignature,
    networkToUse,
    repayTokenDecimals,
    folksMintOneUnderlyingAtomic,
    repayTokenConfig,
    xalgoRepayRoutesActive,
  ]);

  useEffect(() => {
    if (!isOpen || !xalgoRepayRoutesActive) {
      setXalgoRepayConsensusState(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
        if (!aln) return;
        const { algod } = await algorandService.initializeClientsForReads(
          aln as AlgorandNetwork,
          { algodServer: ALGORAND_MAINNET_NODELY_ALGOD_URL }
        );
        const st = await fetchXalgoMainnetConsensusState(algod);
        if (!cancelled) setXalgoRepayConsensusState(st);
      } catch {
        if (!cancelled) setXalgoRepayConsensusState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, xalgoRepayRoutesActive, networkToUse]);

  useEffect(() => {
    if (!isOpen || repayWalletBasis !== "underlying" || !activeAccount?.address) {
      setNativeAlgoWalletHuman(undefined);
      return;
    }
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!aln) {
      setNativeAlgoWalletHuman(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { algod } = algorandService.initializeClients(aln as any);
        let human = 0;

        if (isXalgoConsensusRepayAlgoRoute) {
          const accountInfo = await algod
            .accountInformation(activeAccount.address)
            .do();
          human = spendableAlgoHumanFromAccount(accountInfo);
        } else {
          const folks = selectedRepayAdapter;
          if (!folks || folks.type !== "folks") {
            if (!cancelled) setNativeAlgoWalletHuman(undefined);
            return;
          }
          const raw = String(folks.folksParams?.assetId ?? "").trim();
          const underlyingIsNativeAlgo =
            raw === "" || raw === "-" || raw === "0";
          if (underlyingIsNativeAlgo) {
            const accountInfo = await algod
              .accountInformation(activeAccount.address)
              .do();
            human = spendableAlgoHumanFromAccount(accountInfo);
          } else {
            const assetIndex = Number(raw);
            if (!Number.isFinite(assetIndex) || assetIndex <= 0) {
              human = 0;
            } else {
              const holding = await algod
                .accountAssetInformation(activeAccount.address, assetIndex)
                .do();
              const atomic = getAccountAssetHoldingAmountAtomic(holding);
              human =
                atomic != null
                  ? new BigNumber(atomic.toString())
                      .dividedBy(10 ** repayTokenDecimals)
                      .toNumber()
                  : 0;
            }
          }
        }

        if (!cancelled) setNativeAlgoWalletHuman(human);
      } catch {
        if (!cancelled) setNativeAlgoWalletHuman(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    repayWalletBasis,
    activeAccount?.address,
    networkToUse,
    isXalgoConsensusRepayAlgoRoute,
    selectedRepayAdapter,
    repayTokenDecimals,
  ]);

  // Load spendable balance for the selected cross-asset payment ASA (incl. ALGO=0).
  useEffect(() => {
    if (
      !isOpen ||
      !crossAssetActive ||
      crossAssetPaymentAsaId == null ||
      !activeAccount?.address
    ) {
      setCrossAssetPaymentWalletHuman(undefined);
      return;
    }
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!aln) {
      setCrossAssetPaymentWalletHuman(undefined);
      return;
    }
    let cancelled = false;
    const decimals = selectedPaymentAsset?.decimals ?? 6;
    (async () => {
      try {
        const { algod } = algorandService.initializeClients(aln as AlgorandNetwork);
        let human = 0;
        if (crossAssetPaymentAsaId === 0) {
          const accountInfo = await algod
            .accountInformation(activeAccount.address)
            .do();
          human = spendableAlgoHumanFromAccount(accountInfo);
        } else {
          const holding = await algod
            .accountAssetInformation(
              activeAccount.address,
              crossAssetPaymentAsaId
            )
            .do();
          const atomic = getAccountAssetHoldingAmountAtomic(holding);
          human =
            atomic != null
              ? new BigNumber(atomic.toString())
                  .dividedBy(10 ** decimals)
                  .toNumber()
              : 0;
        }
        if (!cancelled) setCrossAssetPaymentWalletHuman(human);
      } catch {
        if (!cancelled) setCrossAssetPaymentWalletHuman(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    crossAssetActive,
    crossAssetPaymentAsaId,
    activeAccount?.address,
    networkToUse,
    selectedPaymentAsset?.decimals,
  ]);

  // Load all dropdown balances from one cached account snapshot.
  useEffect(() => {
    if (
      !isOpen ||
      !crossAssetEligible ||
      !activeAccount?.address ||
      haystackPaymentAssets.length === 0
    ) {
      setCrossAssetPaymentBalances(null);
      return;
    }
    const aln = getAlgorandNetworkFromNetworkId(networkToUse as NetworkId);
    if (!aln) {
      setCrossAssetPaymentBalances(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { algod } = algorandService.initializeClients(
          aln as AlgorandNetwork
        );
        const accountInfo = await getCachedAccountInformation(
          algod,
          activeAccount.address
        );
        const balances: Record<number, number> = {
          0: spendableAlgoHumanFromAccount(accountInfo),
        };
        for (const asset of haystackPaymentAssets) {
          if (asset.asaId === 0) continue;
          const atomic = asaAmountFromAccountInfo(accountInfo, asset.asaId) ?? 0n;
          balances[asset.asaId] = new BigNumber(atomic.toString())
            .shiftedBy(-asset.decimals)
            .toNumber();
        }
        if (!cancelled) setCrossAssetPaymentBalances(balances);
      } catch {
        if (!cancelled) setCrossAssetPaymentBalances({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    crossAssetEligible,
    activeAccount?.address,
    networkToUse,
    haystackPaymentAssets,
  ]);

  // Lending-oracle USD prices for dropdown rows (cached 60s, shared with Markets).
  useEffect(() => {
    if (!isOpen || !crossAssetEligible || haystackPaymentAssets.length === 0) {
      setCrossAssetPaymentUsdPrices(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const displayTokens = getAllTokensWithDisplayInfo(
        networkToUse as NetworkId
      );
      const prices: Record<number, number> = {};
      await Promise.all(
        haystackPaymentAssets.map(async (asset) => {
          const cacheKey = `tokenPrice:${networkToUse}:${asset.symbol}`;
          try {
            const price = await withRpcReadCache(
              cacheKey,
              async () => {
                const match =
                  displayTokens.find(
                    (t) =>
                      t.symbol === asset.symbol &&
                      t.poolId &&
                      t.underlyingContractId
                  ) ??
                  displayTokens.find(
                    (t) => t.symbol === asset.symbol
                  );
                if (!match?.poolId || !match.underlyingContractId) {
                  return 0;
                }
                const marketInfo = await fetchMarketInfo(
                  match.poolId,
                  match.underlyingContractId,
                  networkToUse
                );
                if (!marketInfo) return 0;
                const usd = resolveUsdPerTokenFromMarketInfo(
                  marketInfo,
                  match.decimals ?? asset.decimals
                );
                return Number.isFinite(usd) && usd > 0 ? usd : 0;
              },
              60_000
            );
            prices[asset.asaId] = price;
          } catch {
            prices[asset.asaId] = 0;
          }
        })
      );
      if (!cancelled) setCrossAssetPaymentUsdPrices(prices);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, crossAssetEligible, networkToUse, haystackPaymentAssets]);

  const toggleDetail = (key: keyof typeof expandedDetails) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  /** Single USD/token for header, fiat lines, and HF — oracle first, then marketStats. */
  const displayTokenPrice = useMemo(() => {
    if (oracleTokenPrice > 0 && Number.isFinite(oracleTokenPrice)) {
      return oracleTokenPrice;
    }
    return marketStats.tokenPrice > 0 &&
      Number.isFinite(marketStats.tokenPrice)
      ? marketStats.tokenPrice
      : 0;
  }, [oracleTokenPrice, marketStats.tokenPrice]);

  const formatRepayUsd = (usd: number): string => {
    if (!Number.isFinite(usd) || usd <= 0) return "0.00";
    if (usd >= 0.01) {
      return usd.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return usd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const crossAssetPaymentNeededDisplay = useMemo(() => {
    if (!crossAssetActive || haystackQuote.paymentAtomicNeeded == null) {
      return null;
    }
    const decimals = selectedPaymentAsset?.decimals ?? 6;
    return new BigNumber(haystackQuote.paymentAtomicNeeded.toString())
      .shiftedBy(-decimals)
      .decimalPlaces(Math.min(6, decimals), BigNumber.ROUND_UP)
      .toFixed();
  }, [
    crossAssetActive,
    haystackQuote.paymentAtomicNeeded,
    selectedPaymentAsset?.decimals,
  ]);

  useEffect(() => {
    if (amount !== "" && typeof amount === "number") {
      setFiatValue(usdValueForHumanTokenAmount(amount, displayTokenPrice));
    } else {
      setFiatValue(0);
    }
  }, [amount, displayTokenPrice]);

  const numAmount = amount !== "" && typeof amount === "number" ? amount : 0;

  const maxDebtInInputUnits = useMemo(() => {
    if (repayWalletBasis !== "underlying") return currentBorrow;
    if (isXalgoConsensusRepayAlgoRoute) {
      if (!xalgoRepayConsensusState) return 0;
      const debtAtomic = BigInt(
        new BigNumber(currentBorrow)
          .multipliedBy(10 ** repayTokenDecimals)
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
      try {
        const micro = algoMicroNeededForMinXalgoOutImmediateMintFloor(
          xalgoRepayConsensusState,
          debtAtomic,
          150n
        );
        return Number(micro) / 1e6;
      } catch {
        return 0;
      }
    }
    if (
      folksMintRatioStatus !== "ready" ||
      folksMintedFAssetPerOneUnderlying == null ||
      folksMintedFAssetPerOneUnderlying <= BigInt(0)
    ) {
      return 0;
    }
    return folksFAssetHumanToUnderlyingHuman(
      currentBorrow,
      folksMintedFAssetPerOneUnderlying,
      repayTokenDecimals
    );
  }, [
    repayWalletBasis,
    currentBorrow,
    folksMintRatioStatus,
    folksMintedFAssetPerOneUnderlying,
    repayTokenDecimals,
    isXalgoConsensusRepayAlgoRoute,
    xalgoRepayConsensusState,
  ]);

  const effectiveWalletBalance = useMemo(() => {
    if (repayWalletBasis === "underlying") {
      return nativeAlgoWalletHuman ?? 0;
    }
    return walletBalance;
  }, [repayWalletBasis, nativeAlgoWalletHuman, walletBalance]);

  /**
   * Cross-asset repay spends the *payment* ASA (e.g. ALGO), not wallet WAD.
   * Do not cap the repay amount by debt-token wallet balance or the flow
   * silently forces same-asset repay whenever the user holds enough WAD.
   */
  const maxRepayAmount = crossAssetActive
    ? maxDebtInInputUnits
    : Math.min(maxDebtInInputUnits, effectiveWalletBalance);

  /**
   * Repay amount in **input field units** that covers accrued interest (capped by wallet + total debt).
   * Hidden for xALGO consensus ALGO route (non-linear mint) until we have a dedicated conversion.
   */
  const interestOnlyInInputUnits = useMemo(() => {
    if (!(accruedInterest > 0) || !(currentBorrow > 0)) return null;
    const interestMarketHuman = Math.min(accruedInterest, currentBorrow);

    let rawInInputUnits: number;
    if (repayWalletBasis === "underlying") {
      if (isXalgoConsensusRepayAlgoRoute) return null;
      if (
        folksMintRatioStatus !== "ready" ||
        folksMintedFAssetPerOneUnderlying == null ||
        folksMintedFAssetPerOneUnderlying <= BigInt(0)
      ) {
        return null;
      }
      rawInInputUnits = folksFAssetHumanToUnderlyingHuman(
        interestMarketHuman,
        folksMintedFAssetPerOneUnderlying,
        repayTokenDecimals
      );
    } else {
      rawInInputUnits = interestMarketHuman;
    }

    const capped = Math.min(
      rawInInputUnits,
      maxDebtInInputUnits,
      effectiveWalletBalance
    );
    if (!Number.isFinite(capped) || capped <= 0) return null;
    return capped;
  }, [
    accruedInterest,
    currentBorrow,
    repayWalletBasis,
    isXalgoConsensusRepayAlgoRoute,
    folksMintRatioStatus,
    folksMintedFAssetPerOneUnderlying,
    repayTokenDecimals,
    maxDebtInInputUnits,
    effectiveWalletBalance,
  ]);

  const numAmountMarketTokenHuman = useMemo((): number | null => {
    const amountInputStr =
      amount === "" ? "0" : typeof amount === "number" ? String(amount) : "0";
    if (isXalgoConsensusRepayAlgoRoute) {
      const amt = parseFloat(amountInputStr) || 0;
      if (amt <= 0) return 0;
      if (!xalgoRepayConsensusState) return null;
      const micro = BigInt(
        new BigNumber(amt)
          .times(1e6)
          .integerValue(BigNumber.ROUND_FLOOR)
          .toFixed(0)
      );
      if (micro <= 0n) return 0;
      const xAtomic = minXalgoOutImmediateMintFloor(
        xalgoRepayConsensusState,
        micro,
        150n
      );
      return Number(xAtomic) / 10 ** repayTokenDecimals;
    }
    return repayInputToMarketTokenHuman(
      amountInputStr,
      repayWalletBasis,
      folksMintedFAssetPerOneUnderlying,
      repayTokenDecimals
    );
  }, [
    amount,
    repayWalletBasis,
    folksMintedFAssetPerOneUnderlying,
    repayTokenDecimals,
    isXalgoConsensusRepayAlgoRoute,
    xalgoRepayConsensusState,
  ]);

  /** Routes whose amount unit differs from the other side get the pay/debt rows. */
  const dualUnitRepay = crossAssetActive || repayWalletBasis === "underlying";
  /**
   * Cross-asset quotes fixed-output, so its field is debt-denominated; the Folks
   * and xALGO consensus fields are in the spend asset and submit in those units.
   */
  const repayEditableSide: "pay" | "debt" = crossAssetActive ? "debt" : "pay";

  const derivedDebtAmountDisplay = useMemo(() => {
    if (numAmount <= 0 || numAmountMarketTokenHuman == null) return null;
    return numAmountMarketTokenHuman.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  }, [numAmount, numAmountMarketTokenHuman]);

  const repayDerivedPending =
    numAmount > 0 &&
    (repayEditableSide === "debt"
      ? haystackQuote.isLoading || crossAssetPaymentNeededDisplay == null
      : numAmountMarketTokenHuman == null);

  const repayFolksBlockingSubmit = useMemo(() => {
    if (repayWalletBasis !== "underlying") return false;
    if (numAmount <= 0) return false;
    if (isXalgoConsensusRepayAlgoRoute) {
      return xalgoRepayConsensusState == null;
    }
    if (repayAdapterList.length === 0) return false;
    return folksMintRatioStatus !== "ready";
  }, [
    repayAdapterList.length,
    repayWalletBasis,
    numAmount,
    folksMintRatioStatus,
    isXalgoConsensusRepayAlgoRoute,
    xalgoRepayConsensusState,
  ]);

  const handleMaxClick = () => {
    const roundedMax = Math.round(maxRepayAmount * 1000000) / 1000000;
    setAmount(roundedMax);
    const roundedDebtCap = Math.round(maxDebtInInputUnits * 1000000) / 1000000;
    setIsRepayAll(roundedMax === roundedDebtCap);
  };

  const handleInterestOnlyClick = () => {
    if (interestOnlyInInputUnits == null || !(interestOnlyInInputUnits > 0)) {
      return;
    }
    const rounded = Math.round(interestOnlyInInputUnits * 1e6) / 1e6;
    setAmount(rounded);
    setIsRepayAll(false);
  };

  const handleConfirmRepay = async () => {
    if (repaySubmitInFlightRef.current || isLoading) return;

    const roundedAmount = Math.round(numAmount * 1000000) / 1000000;
    const roundedDebtCap = Math.round(maxDebtInInputUnits * 1000000) / 1000000;
    const shouldUseRepayAll =
      !isXalgoConsensusRepayAlgoRoute &&
      !crossAssetActive &&
      roundedAmount === roundedDebtCap;

    const amountStr = amount !== "" ? amount.toString() : "0";
    console.log(
      `Repay ${amountStr} ${tokenSymbol}${shouldUseRepayAll ? " (repayAll)" : ""}${crossAssetActive ? " (cross-asset)" : ""}`
    );

    repaySubmitInFlightRef.current = true;
    try {
      setIsLoading(true);

      if (crossAssetActive) {
        if (!activeAccount?.address || !transactionSigner) {
          throw new Error("Connect a wallet to repay with another asset.");
        }
        if (!haystackQuote.quote?.txnPayload && !completedCrossAssetSwapTxId) {
          throw new Error(
            haystackQuote.error || "Haystack quote unavailable. Wait for a quote."
          );
        }
        const algorandNetwork = getAlgorandNetworkFromNetworkId(
          networkToUse as NetworkId
        );
        if (!algorandNetwork) {
          throw new Error("Cross-asset repay requires Algorand mainnet.");
        }

        let skipSwap = false;
        let swapTxIdLocal = completedCrossAssetSwapTxId;

        // Only skip the Haystack swap when a prior swap in *this* modal session
        // already succeeded (two-step resume after repay failed). Never skip just
        // because the wallet holds debt ASA — the user explicitly chose another
        // payment asset (e.g. repay WAD with ALGO) and must spend that asset.
        if (completedCrossAssetSwapTxId) {
          skipSwap = true;
          console.log(
            "[cross-asset repay] resuming after prior swap in this session",
            { swapTxId: completedCrossAssetSwapTxId }
          );
        }

        const marketTokenFolksAdapter = repayAdapterList.find(
          (a) => (a.repayWalletBasis ?? "market_token") === "market_token"
        );
        const repayAdapterIdOpt =
          marketTokenFolksAdapter != null
            ? tokenAdapterStableId(marketTokenFolksAdapter)
            : undefined;

        // Cross-asset repay is presented as two wallet signatures (swap, then repay).
        // Atomic compose is best-effort elsewhere; here we go straight to the
        // two-step path so messaging matches what the user is asked to sign.
        const paySymbol = selectedPaymentAsset?.symbol ?? "asset";
        const walletName = activeWallet?.metadata?.name || "your wallet";

        if (!skipSwap) {
          toast({
            title: "Signature 1 of 2 — swap",
            description: `Approve swapping ${paySymbol} → ${tokenSymbol} in ${walletName}. Next you’ll sign the repay.`,
            duration: 14_000,
          });
          setHaystackSignSuppressed(true);
          try {
            const swapResult = await executeHaystackSwap({
              address: activeAccount.address,
              quote: haystackQuote.quote!,
              slippagePercent: crossAssetSlippagePercent,
              transactionSigner,
              activeWallet,
              setRainbowkitSuppressed: setHaystackSignSuppressed,
            });
            swapTxIdLocal = swapResult.txId;
            setCompletedCrossAssetSwapTxId(swapResult.txId);
          } finally {
            setHaystackSignSuppressed(false);
          }
        }

        toast({
          title: "Signature 2 of 2 — repay",
          description: skipSwap
            ? `Swap already completed — approve the ${tokenSymbol} repay in ${walletName}.`
            : `Swap submitted. Now approve the ${tokenSymbol} repay in ${walletName}.`,
          duration: 14_000,
        });

        let txId: string;
        try {
          txId = await onSubmit(amountStr, {
            isRepayAll: shouldUseRepayAll,
            repayAdapterId: repayAdapterIdOpt,
          });
        } catch (repayErr) {
          if (swapTxIdLocal) {
            throw new Error(
              `Swap succeeded (${swapTxIdLocal.slice(0, 8)}…), but repay failed: ${
                repayErr instanceof Error ? repayErr.message : "unknown error"
              }. Tap Continue again to repay only — you will not be asked to swap again.`
            );
          }
          throw repayErr;
        }

        setCompletedCrossAssetSwapTxId(null);
        setTransactionId(txId);

        if (isRainbowkitXchainWallet(activeWallet)) {
          toast({
            title: "Repay confirmed",
            description:
              "Your transaction was submitted. The portfolio will update shortly.",
          });
          onClose();
        } else {
          setShowSuccess(true);
        }
        return;
      }

      const repayAdapterIdOpt = xalgoRepayRoutesActive
        ? selectedRepayAdapterId === XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID
          ? XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID
          : undefined
        : selectedRepayAdapter != null
          ? tokenAdapterStableId(selectedRepayAdapter)
          : undefined;

      const txId = await onSubmit(amountStr, {
        isRepayAll: shouldUseRepayAll,
        repayAdapterId: repayAdapterIdOpt,
      });
      setTransactionId(txId);

      if (isEvmXchainWallet(activeWallet)) {
        toast({
          title: "Repay confirmed",
          description:
            "Your transaction was submitted. The portfolio will update shortly.",
        });
        onClose();
      } else {
        setShowSuccess(true);
      }
    } catch (error) {
      console.error("Repay transaction failed:", error);
      setHaystackSignSuppressed(false);
      const message =
        error instanceof Error ? error.message : "Transaction failed";
      toast({
        title: message.includes("Swap succeeded")
          ? "Repay incomplete"
          : "Repay failed",
        description: message,
        variant: "destructive",
        duration: 12_000,
      });
    } finally {
      setIsLoading(false);
      repaySubmitInFlightRef.current = false;
    }
  };

  const handleViewTransaction = () => {
    if (!transactionId) {
      throw new Error("Transaction ID not found");
    }
    window.open(
      getExplorerTransactionUrl(networkToUse as NetworkId, transactionId),
      "_blank"
    );
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
    setWorkflowStep("amount");
  };

  const roundedAmount = Math.round(numAmount * 1000000) / 1000000;
  const roundedMaxRepay = Math.round(maxRepayAmount * 1000000) / 1000000;

  const crossAssetPaymentAffordable = useMemo(() => {
    if (!crossAssetActive) return true;
    if (haystackQuote.paymentAtomicNeeded == null) return false;
    if (crossAssetPaymentWalletHuman == null) return true; // still loading
    const neededHuman = new BigNumber(
      haystackQuote.paymentAtomicNeeded.toString()
    )
      .shiftedBy(-(selectedPaymentAsset?.decimals ?? 6))
      .toNumber();
    return crossAssetPaymentWalletHuman + 1e-12 >= neededHuman;
  }, [
    crossAssetActive,
    haystackQuote.paymentAtomicNeeded,
    crossAssetPaymentWalletHuman,
    selectedPaymentAsset?.decimals,
  ]);

  const isValidAmount =
    amount !== "" &&
    numAmount > 0 &&
    roundedAmount <= roundedMaxRepay &&
    !repayFolksBlockingSubmit &&
    (!crossAssetActive ||
      (!!haystackQuote.quote?.txnPayload &&
        !haystackQuote.isLoading &&
        crossAssetPaymentAffordable));

  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  /** Principal portion of debt; total owed = currentBorrow = principal + accrued (see lendingService index split). */
  const principalBorrowExclInterest = Math.max(
    0,
    round6(currentBorrow - accruedInterest)
  );
  const repayAmountMarketHuman =
    numAmountMarketTokenHuman != null ? numAmountMarketTokenHuman : 0;

  const estimatedRemainingBorrow = Math.max(
    0,
    round6(currentBorrow - repayAmountMarketHuman)
  );

  const handleContinueToConfirm = () => {
    if (!isValidAmount) return;
    setWorkflowStep("confirm");
  };

  const liquidationSummaryForRepay = useMemo(
    () =>
      buildLiquidationThresholdSummaryForDeposit(
        liquidationThresholdPercent ?? undefined,
        poolCollateralMarkets,
        poolId
      ),
    [liquidationThresholdPercent, poolCollateralMarkets, poolId]
  );

  const estimatedPoolHealthMeta = useMemo(() => {
    if (poolGlobalUserData == null || !liquidationSummaryForRepay) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    const meta = estimatePoolHealthAfterRepay(
      poolGlobalUserData,
      liquidationSummaryForRepay,
      repayAmountMarketHuman,
      displayTokenPrice
    );
    if (!meta) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    return { value: meta.value, deltaPercent: meta.deltaPercent };
  }, [
    poolGlobalUserData,
    liquidationSummaryForRepay,
    repayAmountMarketHuman,
    displayTokenPrice,
  ]);

  const showPoolHealthEstimate =
    poolGlobalUserData != null &&
    liquidationSummaryForRepay != null &&
    estimatedPoolHealthMeta.value !== undefined;

  const healthFactorDisplayValue: number | null = showPoolHealthEstimate
    ? estimatedPoolHealthMeta.value ?? null
    : marketStats.healthFactor;

  const healthFactorLabel = getHealthFactorLabel(healthFactorDisplayValue);

  const repayPoolHealthLoading =
    poolGlobalUserData === undefined && Boolean(poolId);

  const repayPaySide = {
    label: "You pay",
    symbol: crossAssetActive
      ? selectedPaymentAsset?.symbol ?? "asset"
      : walletUnitSymbol,
    iconSrc: crossAssetActive
      ? selectedPaymentAsset?.logoPath ?? undefined
      : undefined,
    derivedAmount: crossAssetPaymentNeededDisplay,
    usdValue: crossAssetActive ? haystackQuote.quote?.usdIn ?? null : null,
    footnote: `Balance: ${(crossAssetActive
      ? crossAssetPaymentWalletHuman ?? 0
      : effectiveWalletBalance
    ).toLocaleString(undefined, { maximumFractionDigits: 6 })}`,
    warning:
      crossAssetActive &&
      !crossAssetPaymentAffordable &&
      haystackQuote.paymentAtomicNeeded != null
        ? `Not enough ${selectedPaymentAsset?.symbol ?? "asset"} for this quote.`
        : undefined,
  };

  const repayDebtSide = {
    label: repayEditableSide === "debt" ? "Debt to repay" : "Repays",
    symbol: tokenSymbol,
    iconSrc: tokenIcon,
    derivedAmount: derivedDebtAmountDisplay,
    usdValue: usdValueForHumanTokenAmount(
      repayEditableSide === "debt" ? numAmount : repayAmountMarketHuman,
      displayTokenPrice
    ),
    footnote: `Owed: ${currentBorrow.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    })}`,
  };

  const repayEditableActions =
    repayMultiRoute || showMaxButton ? (
      <>
        {repayMultiRoute && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRepayRoutePickerOpen(true)}
            className="h-6 max-w-[7rem] gap-0.5 px-1.5 text-whale-gold hover:bg-whale-gold/10"
            title="Choose repay route"
          >
            <span className="truncate text-xs font-medium">
              {repayRouteButtonLabel}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          </Button>
        )}
        {showMaxButton && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleMaxClick}
            className="h-6 px-1.5 text-xs font-medium text-whale-gold hover:bg-whale-gold/10"
          >
            MAX
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <>
    <Dialog
      open={isOpen && !rainbowkitHostOverlaySuppressed && !haystackSignSuppressed}
      onOpenChange={onClose}
    >
      <DialogContent
        className={cn(
          "bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] overflow-hidden flex flex-col px-0 py-0 min-h-0",
          showSuccess
            ? "md:max-w-md h-auto max-h-[min(90vh,90dvh)]"
            : "md:max-w-lg lg:max-w-4xl h-[min(90vh,90dvh)] max-h-[min(90vh,90dvh)] md:h-[min(85vh,85dvh)] md:max-h-[min(85vh,85dvh)]"
        )}
      >
        {showSuccess ? (
          <div className="p-6 overflow-y-auto min-h-0 space-y-4">
            <SupplyBorrowCongrats
              transactionType="repay"
              asset={tokenSymbol}
              assetIcon={tokenIcon}
              amount={amount !== "" ? amount.toString() : ""}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
              aboveActions={
                <RepaySharePanel
                  active={showSuccess}
                  amount={amount !== "" ? amount.toString() : ""}
                  assetSymbol={tokenSymbol}
                  assetIconSrc={tokenIcon}
                  paidWithSymbol={
                    crossAssetActive
                      ? selectedPaymentAsset?.symbol
                      : undefined
                  }
                  paidWithIconSrc={
                    crossAssetActive
                      ? selectedPaymentAsset?.logoPath
                      : undefined
                  }
                  network={network}
                />
              }
            />
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <div className="sticky top-0 z-20 shrink-0 bg-card dark:bg-slate-900 pt-6 px-6 md:px-8 lg:px-10 pb-4 border-b border-gray-200/50 dark:border-slate-700/50">
              <DialogHeader className="pb-0">
                {availableAssets &&
                availableAssets.length > 0 &&
                onSelectAsset ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center gap-3 pb-2 mt-1 h-14">
                      <Select
                        value={`${tokenSymbol}-${poolId ?? ""}-${network ?? ""}`}
                        onValueChange={(value) => {
                          const selected = availableAssets.find(
                            (a) =>
                              `${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}` ===
                              value
                          );
                          if (selected) {
                            onSelectAsset(
                              selected.asset,
                              selected.poolId,
                              selected.network
                            );
                          }
                        }}
                      >
                        <SelectTrigger className="w-auto min-w-0 h-auto bg-transparent border-none p-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 justify-center [&>svg:last-child]:!hidden">
                          <div className="flex items-center gap-2 shrink-0">
                            <img
                              src={tokenIcon}
                              alt={tokenSymbol}
                              className="w-14 h-14 rounded-full ring-2 ring-whale-gold/20 dark:ring-whale-gold/30"
                            />
                            <span className="flex items-center gap-1 text-2xl font-bold text-slate-800 dark:text-white">
                              {tokenSymbol}
                              <ChevronDown className="h-4 w-4 text-slate-800 dark:text-white" />
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableAssets.map((a) => (
                            <SelectItem
                              key={`${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}`}
                              value={`${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}`}
                            >
                              <span className="flex items-center gap-2">
                                <img
                                  src={a.icon}
                                  alt={a.asset}
                                  className="h-5 w-5 rounded-full"
                                />
                                <span>{a.asset}</span>
                                {a.value != null && (
                                  <span className="text-xs text-muted-foreground">
                                    —{" "}
                                    {a.value.toLocaleString(undefined, {
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
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      $
                      {formatUsdPerTokenDisplay(displayTokenPrice)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <img
                      src={tokenIcon}
                      alt={tokenSymbol}
                      className="w-14 h-14 rounded-full ring-2 ring-whale-gold/20 dark:ring-whale-gold/30"
                    />
                    <div className="flex flex-col items-start">
                      <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                        Repay {tokenSymbol}
                      </DialogTitle>
                      <span className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        $
                        {formatUsdPerTokenDisplay(displayTokenPrice)}
                      </span>
                    </div>
                  </div>
                )}
              </DialogHeader>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 px-6 md:px-8 lg:px-10 pb-4 touch-pan-y">
              <div className="flex flex-col lg:flex-row lg:gap-8 space-y-6 lg:space-y-0">
                {/* Left Column: Input Form */}
                <div className="flex-1 space-y-6 min-w-0">
                  {workflowStep === "amount" ? (
                    <div className="space-y-3">
                        {!dualUnitRepay && (
                          <Label
                            htmlFor="amount"
                            className="text-sm font-medium text-slate-600 dark:text-slate-300"
                          >
                            Amount
                          </Label>
                        )}
                        {repayAdapterList.length === 1 && selectedRepayAdapter && (
                          <div className="space-y-1 rounded-lg border border-slate-200/80 bg-white/60 p-3 dark:border-slate-600 dark:bg-slate-800/60">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Repay route
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {selectedRepayAdapter.label ??
                                selectedRepayAdapter.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {(selectedRepayAdapter.repayWalletBasis ??
                                "market_token") === "market_token"
                                ? "f-asset from wallet"
                                : "Underlying (e.g. ALGO) via Folks mint"}
                            </p>
                          </div>
                        )}
                        {repayWalletBasis === "underlying" &&
                          !isXalgoConsensusRepayAlgoRoute &&
                          folksMintRatioStatus === "failed" && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Folks mint rate unavailable. Switch to the f-asset
                              route or try again later.
                            </p>
                          )}
                        {isXalgoConsensusRepayAlgoRoute &&
                          xalgoRepayConsensusState == null && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Loading governance xALGO mint rate…
                            </p>
                          )}
                        {crossAssetEligible && haystackPaymentAssets.length > 0 && (
                          <CrossAssetRepaySection
                            paymentAssets={haystackPaymentAssets}
                            selectedPaymentAsaId={crossAssetPaymentAsaId}
                            onSelectPaymentAsaId={setCrossAssetPaymentAsaId}
                            debtSymbol={tokenSymbol}
                            debtIcon={tokenIcon}
                            debtBalance={walletBalance}
                            debtUsdPrice={displayTokenPrice}
                            paymentBalances={crossAssetPaymentBalances}
                            paymentUsdPrices={crossAssetPaymentUsdPrices}
                            quote={haystackQuote.quote}
                            paymentAtomicNeeded={
                              haystackQuote.paymentAtomicNeeded
                            }
                            isLoading={haystackQuote.isLoading}
                            error={haystackQuote.error}
                            slippagePercent={crossAssetSlippagePercent}
                            onSlippageChange={setCrossAssetSlippagePercent}
                          />
                        )}
                        {dualUnitRepay ? (
                          <RepayAmountRows
                            editableSide={repayEditableSide}
                            amount={amount}
                            onAmountChange={(v) => {
                              setAmount(v);
                              setIsRepayAll(false);
                            }}
                            pay={repayPaySide}
                            debt={repayDebtSide}
                            derivedPending={repayDerivedPending}
                            editableActions={repayEditableActions}
                            formatUsd={formatRepayUsd}
                            autoFocus
                          />
                        ) : (
                          <>
                            <div className="relative">
                              <LocaleNumberInput
                                id="amount"
                                placeholder="0.0"
                                autoFocus
                                value={amount}
                                onChange={(v) => {
                                  setAmount(v ?? "");
                                  setIsRepayAll(false);
                                }}
                                formatOptions={{ maximumFractionDigits: 6 }}
                                className={cn(
                                  "bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-lg h-12",
                                  repayMultiRoute && showMaxButton
                                    ? "pr-40"
                                    : repayMultiRoute
                                      ? "pr-28"
                                      : showMaxButton
                                        ? "pr-16"
                                        : "pr-4"
                                )}
                              />
                              {(repayMultiRoute || showMaxButton) && (
                                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                                  {repayMultiRoute && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setRepayRoutePickerOpen(true)
                                      }
                                      className="h-8 max-w-[7rem] gap-0.5 px-2 text-whale-gold hover:bg-whale-gold/10"
                                      title="Choose repay route"
                                    >
                                      <span className="truncate text-xs font-medium">
                                        {repayRouteButtonLabel}
                                      </span>
                                      <ChevronDown
                                        className="h-3 w-3 shrink-0 opacity-80"
                                        aria-hidden
                                      />
                                    </Button>
                                  )}
                                  {showMaxButton && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleMaxClick}
                                      className="text-whale-gold hover:bg-whale-gold/10 h-8 px-3"
                                    >
                                      MAX
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            {fiatValue > 0 && (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                ≈ $
                                {formatRepayUsd(fiatValue)}
                              </p>
                            )}
                          </>
                        )}
                        <div className="pt-2">
                          <div className="flex flex-col gap-3">
                            {!dualUnitRepay && (
                              <div className="flex flex-row justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Wallet Balance
                                  </p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                    {effectiveWalletBalance.toLocaleString()}{" "}
                                    {walletUnitSymbol}
                                    <span className="text-slate-500 dark:text-slate-400 ml-1">
                                      ($
                                      {formatRepayUsd(
                                        usdValueForHumanTokenAmount(
                                          effectiveWalletBalance,
                                          displayTokenPrice
                                        )
                                      )}
                                      )
                                    </span>
                                  </p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Total owed
                                  </p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                    {currentBorrow.toLocaleString()}{" "}
                                    {tokenSymbol}
                                    <span className="text-slate-500 dark:text-slate-400 ml-1">
                                      ($
                                      {formatRepayUsd(
                                        usdValueForHumanTokenAmount(
                                          currentBorrow,
                                          displayTokenPrice
                                        )
                                      )}
                                      )
                                    </span>
                                  </p>
                                </div>
                              </div>
                            )}
                            {accruedInterest > 0 && (
                              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                                  Accrued Interest
                                </p>
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium break-words">
                                  {accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                                    ($
                                    {formatRepayUsd(
                                      usdValueForHumanTokenAmount(
                                        accruedInterest,
                                        displayTokenPrice
                                      )
                                    )}
                                    )
                                  </span>
                                </p>
                                {interestOnlyInInputUnits != null &&
                                  interestOnlyInInputUnits > 0 && (
                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleInterestOnlyClick}
                                        className="h-8 w-full sm:w-auto border-amber-400/70 bg-white/90 text-amber-900 hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/60"
                                      >
                                        Repay this interest (~
                                        {interestOnlyInInputUnits.toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 6 }
                                        )}{" "}
                                        {walletUnitSymbol})
                                      </Button>
                                      <p className="text-[11px] text-amber-700/85 dark:text-amber-400/90 mt-1.5">
                                        Sets the amount field (capped by wallet).
                                        Use MAX to repay principal + all interest.
                                      </p>
                                    </div>
                                  )}
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                  Included in total owed above. You&apos;ll see a
                                  full breakdown on the next step before signing.
                                  {userLastUpdateTime && (
                                    <span className="block mt-1 text-blue-500 dark:text-blue-400">
                                      Last interaction:{" "}
                                      {formatRelativeTime(userLastUpdateTime)}
                                    </span>
                                  )}
                                  {lastUpdateTime && (
                                    <span className="block mt-1 text-amber-500 dark:text-amber-400">
                                      Last updated:{" "}
                                      {formatRelativeTime(lastUpdateTime)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Confirm repayment
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Review principal, interest, and your estimated
                          remaining borrow for this market before you sign.
                        </p>
                        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Borrow (excl. accrued interest)
                            </span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right tabular-nums">
                              {principalBorrowExclInterest.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                }
                              )}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ≈ $
                                {formatRepayUsd(
                                  usdValueForHumanTokenAmount(
                                    principalBorrowExclInterest,
                                    displayTokenPrice
                                  )
                                )}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Accrued interest
                            </span>
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 text-right tabular-nums">
                              {accruedInterest.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-amber-600/90 dark:text-amber-400/90 font-normal">
                                ≈ $
                                {formatRepayUsd(
                                  usdValueForHumanTokenAmount(
                                    accruedInterest,
                                    displayTokenPrice
                                  )
                                )}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              You pay
                            </span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right tabular-nums">
                              {crossAssetActive &&
                              haystackQuote.paymentAtomicNeeded != null ? (
                                <>
                                  {new BigNumber(
                                    haystackQuote.paymentAtomicNeeded.toString()
                                  )
                                    .shiftedBy(
                                      -(selectedPaymentAsset?.decimals ?? 6)
                                    )
                                    .toFixed(
                                      Math.min(
                                        6,
                                        selectedPaymentAsset?.decimals ?? 6
                                      )
                                    )}{" "}
                                  {selectedPaymentAsset?.symbol ?? "asset"}
                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                    clears{" "}
                                    {numAmount.toLocaleString(undefined, {
                                      maximumFractionDigits: 6,
                                    })}{" "}
                                    {tokenSymbol}
                                  </span>
                                  <span className="block text-[10px] text-whale-gold font-normal">
                                    2 signatures: swap → repay {tokenSymbol}
                                  </span>
                                </>
                              ) : (
                                <>
                                  {numAmount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {walletUnitSymbol}
                                  {repayWalletBasis === "underlying" && (
                                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                      clears{" "}
                                      {repayAmountMarketHuman.toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 6 }
                                      )}{" "}
                                      {tokenSymbol}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                    ≈ $
                                    {formatRepayUsd(
                                      usdValueForHumanTokenAmount(
                                        repayWalletBasis === "underlying"
                                          ? repayAmountMarketHuman
                                          : numAmount,
                                        displayTokenPrice
                                      )
                                    )}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          {crossAssetActive && (
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Provider
                              </span>
                              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                                <img
                                  src="/images/hay-router.png"
                                  alt=""
                                  className="h-4 w-4 rounded-sm bg-black object-contain"
                                />
                                Haystack Router
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-3 px-3 py-2.5 bg-white/60 dark:bg-slate-900/30">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              Est. remaining borrow
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white text-right tabular-nums">
                              {estimatedRemainingBorrow.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                }
                              )}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ≈ $
                                {formatRepayUsd(
                                  usdValueForHumanTokenAmount(
                                    estimatedRemainingBorrow,
                                    displayTokenPrice
                                  )
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Stats Card */}
                <div className="lg:w-80 lg:flex-shrink-0">
                  <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700 lg:sticky lg:top-4">
                    <CardContent className="p-3 md:p-5 lg:p-6">
                      <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 md:mb-4">
                        Position Details
                      </h3>
                      <div className="space-y-2 md:space-y-4">
                        {/* Borrow APY (adjusted after repay when amount entered) */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("borrowAPY")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Borrow APY
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.borrowAPY ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            {(() => {
                              const repayAmount =
                                repayAmountMarketHuman > 0
                                  ? repayAmountMarketHuman
                                  : 0;
                              const params = marketStats.apyParameters;
                              const totalSupply = Number(marketStats.totalDeposits) || 0;
                              const totalBorrow = Number(marketStats.totalBorrows) || 0;
                              const hasTotals = Number.isFinite(totalSupply) && Number.isFinite(totalBorrow) && totalSupply > 0 && totalBorrow > 0;
                              if (repayAmount > 0 && params && hasTotals) {
                                const newTotalBorrow = Math.max(0, totalBorrow - repayAmount);
                                const result = calculateBorrowAPY(
                                  { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
                                  { totalScaledDeposits: totalSupply, totalScaledBorrows: newTotalBorrow, lastUpdateTime: Date.now() },
                                  marketStats.isSToken ?? false
                                );
                                const currentAPY = marketStats.borrowAPY;
                                // After repay, borrow APY should go down (lower utilization). If result is higher, treat as data/unit mismatch and show current.
                                const adjustedAPY = result.apy <= currentAPY ? result.apy : currentAPY;
                                const changePercent = currentAPY > 0 ? ((adjustedAPY - currentAPY) / currentAPY) * 100 : 0;
                                const showChange = Math.abs(changePercent) > 0.01;
                                return (
                                  <div className="text-right">
                                    <div className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">
                                      {Math.max(0, adjustedAPY).toFixed(2)}%
                                    </div>
                                    <div className={`text-xs flex items-center justify-end gap-1 ${
                                      showChange
                                        ? (changePercent > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400")
                                        : "text-slate-500 dark:text-slate-400"
                                    }`}>
                                      {showChange ? (
                                        <>
                                          <span>{changePercent > 0 ? "↑" : "↓"}</span>
                                          <span>{changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%</span>
                                        </>
                                      ) : (
                                        <span>after repay</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">
                                  {marketStats.borrowAPY.toFixed(2)}%
                                </span>
                              );
                            })()}
                          </div>
                          {expandedDetails.borrowAPY && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {numAmount > 0
                                  ? "Borrow APY after your repayment. It typically goes down (lower utilization = lower rate)."
                                  : `Annual percentage yield for borrowing ${tokenSymbol}. This is the interest rate you'll pay on your borrowed amount.`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Accrued Interest */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("accruedInterest")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Accrued Interest
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.accruedInterest ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400">
                              {accruedInterest > 0
                                ? `${accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })} ${tokenSymbol}`
                                : `0 ${tokenSymbol}`}
                            </span>
                          </div>
                          {expandedDetails.accruedInterest && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                The interest that has accrued on your borrow
                                since you borrowed. This is included in your
                                current borrow amount.
                              </p>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                <p className="font-semibold">
                                  Current Borrow:{" "}
                                  {currentBorrow.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                </p>
                                <p className="text-amber-600 dark:text-amber-400">
                                  Accrued Interest:{" "}
                                  {accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">
                                  USD Value: $
                                  {formatRepayUsd(
                                    usdValueForHumanTokenAmount(
                                      accruedInterest,
                                      displayTokenPrice
                                    )
                                  )}
                                </p>
                                {lastUpdateTime && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
                                    Last updated:{" "}
                                    {formatRelativeTime(lastUpdateTime)}
                                  </p>
                                )}
                                {userLastUpdateTime && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
                                    Last interaction:{" "}
                                    {formatRelativeTime(userLastUpdateTime)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Liquidation Margin */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("liquidationMargin")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Liquidation Margin
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.liquidationMargin ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-teal-600 dark:text-teal-400">
                              {marketStats.liquidationMargin.toFixed(2)}%
                            </span>
                          </div>
                          {expandedDetails.liquidationMargin && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                How much safety margin you have before your
                                position can be liquidated. Higher values mean
                                more safety.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Health factor: pool-level estimate (borrow modal parity) or portfolio aggregate */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleDetail("healthFactor")}
                              className="flex items-start gap-1.5 md:gap-2 hover:opacity-70 transition-opacity text-left min-w-0"
                            >
                              <div className="flex flex-col items-start min-w-0">
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1">
                                  {repayPoolHealthLoading
                                    ? "Pool health (est.)"
                                    : showPoolHealthEstimate
                                      ? "Pool health (est.)"
                                      : "Health factor"}
                                  {!repayPoolHealthLoading &&
                                    !showPoolHealthEstimate && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                        (portfolio)
                                      </span>
                                    )}
                                  {showPoolHealthEstimate && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className="inline-flex"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p>
                                          Estimate for this lending pool after
                                          this repay: (collateral × pool
                                          minimum liquidation threshold) ÷ total
                                          borrows (after subtracting this amount
                                          in USD), same shape as on-chain health,
                                          capped at 3.00 like Portfolio. The
                                          colored change is percent vs your
                                          current pool position before this
                                          repay.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </span>
                              </div>
                              {!showPoolHealthEstimate && (
                                <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              )}
                              {expandedDetails.healthFactor ? (
                                <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              ) : (
                                <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              )}
                            </button>
                            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right shrink-0">
                              {repayPoolHealthLoading ? (
                                <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500">
                                  …
                                </span>
                              ) : showPoolHealthEstimate ? (
                                <>
                                  <span
                                    className={cn(
                                      "text-xs md:text-sm font-medium tabular-nums",
                                      estimatedPoolHealthMeta.value != null &&
                                        estimatedPoolHealthMeta.value <
                                          DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-slate-800 dark:text-white"
                                    )}
                                  >
                                    {estimatedPoolHealthMeta.value == null
                                      ? "—"
                                      : estimatedPoolHealthMeta.value.toFixed(2)}
                                  </span>
                                  {estimatedPoolHealthMeta.deltaPercent !=
                                  null ? (
                                    <span
                                      className={cn(
                                        "text-[10px] md:text-xs font-medium tabular-nums",
                                        estimatedPoolHealthMeta.deltaPercent > 0
                                          ? "text-green-600 dark:text-green-400"
                                          : estimatedPoolHealthMeta.deltaPercent <
                                              0
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-slate-500 dark:text-slate-400"
                                      )}
                                    >
                                      {estimatedPoolHealthMeta.deltaPercent > 0
                                        ? "+"
                                        : ""}
                                      {estimatedPoolHealthMeta.deltaPercent.toFixed(
                                        1
                                      )}
                                      %
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span
                                  className={`text-xs md:text-sm font-medium ${healthFactorLabel.color}`}
                                >
                                  {healthFactorLabel.label}
                                  {marketStats.healthFactor !== null && (
                                    <>
                                      {" "}
                                      ({marketStats.healthFactor.toFixed(2)})
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {expandedDetails.healthFactor && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 space-y-2">
                              {showPoolHealthEstimate ? (
                                <>
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Health factor = (collateral × liquidation
                                    threshold) ÷ borrowed
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Uses this pool&apos;s collateral and borrow
                                    totals (USD) and the minimum liquidation
                                    threshold across your collateral in this
                                    pool, matching the borrow modal. Values are
                                    capped at 3.00 for display.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Portfolio aggregate health
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Shown when a pool-level estimate
                                    isn&apos;t available. Based on global user
                                    data (may differ from a single pool).
                                  </p>
                                </>
                              )}
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {healthFactorDisplayValue === null
                                  ? "Health factor data not available. Please refresh your position data."
                                  : healthFactorDisplayValue >= 3.0
                                    ? `✓ Safe: ${healthFactorDisplayValue.toFixed(
                                        2
                                      )} (excellent health)`
                                    : healthFactorDisplayValue >= 1.5
                                      ? `✓ Moderate: ${healthFactorDisplayValue.toFixed(
                                          2
                                        )} (good health)`
                                      : healthFactorDisplayValue >= 1.2
                                        ? `⚠ Caution: ${healthFactorDisplayValue.toFixed(
                                            2
                                          )} (monitor closely)`
                                        : healthFactorDisplayValue >= 1.0
                                          ? `⚠ Critical: ${healthFactorDisplayValue.toFixed(
                                              2
                                            )} (at liquidation threshold)`
                                          : `✗ Liquidatable: ${healthFactorDisplayValue.toFixed(
                                              2
                                            )} (can be liquidated)`}
                              </p>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                <p>• Safe (≥3.0): Excellent health</p>
                                <p>• Moderate (≥1.5): Good health</p>
                                <p>• Caution (≥1.2): Monitor closely</p>
                                <p>
                                  • Critical (≥1.0): At liquidation threshold
                                </p>
                                <p>
                                  • Liquidatable (&lt;1.0): Can be liquidated
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Collateral Factor */}
                        {marketStats.collateralFactor !== undefined && (
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail("collateralFactor")}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                  Collateral Factor
                                </span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.collateralFactor ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">
                                {marketStats.collateralFactor.toFixed(0)}%
                              </span>
                            </div>
                            {expandedDetails.collateralFactor && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Maximum borrowing power from this collateral. This represents
                                  the percentage of the collateral value that can be used for borrowing.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* LTV */}
                        <div>
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("ltv")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                LTV
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.ltv ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">
                              {marketStats.currentLTV.toFixed(2)}%
                            </span>
                          </div>
                          {expandedDetails.ltv && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Loan-to-Value ratio of your position. This shows
                                what percentage of your collateral is being used
                                for borrowing.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200/50 dark:border-slate-700/50 bg-card dark:bg-slate-900 px-6 md:px-8 lg:px-10 py-4">
              {workflowStep === "amount" ? (
                <Button
                  type="button"
                  onClick={handleContinueToConfirm}
                  disabled={
                    !isValidAmount || isLoading || repayFolksBlockingSubmit
                  }
                  className="w-full font-semibold h-12 bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWorkflowStep("amount")}
                    disabled={isLoading}
                    className="w-full sm:flex-1 h-12 border-slate-300 dark:border-slate-600"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmRepay}
                    disabled={isLoading || !isValidAmount}
                    className="w-full sm:flex-1 h-12 font-semibold bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading
                      ? "Processing..."
                      : crossAssetActive
                        ? `Confirm (2 signatures): swap ${selectedPaymentAsset?.symbol ?? "asset"} → repay`
                        : "Confirm repayment"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog
      open={repayRoutePickerOpen && repayMultiRoute}
      onOpenChange={(open) => {
        if (repayMultiRoute) setRepayRoutePickerOpen(open);
      }}
    >
      <DialogContent className="max-h-[min(85vh,85dvh)] min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            Repay route
          </DialogTitle>
          <DialogDescription>
            {xalgoRepayRoutesActive && repayAdapterList.length === 0
              ? "Repay with xALGO you hold, or with native ALGO (governance mint then repay in one group)."
              : "Choose what you spend from your wallet to repay this borrow."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          {xalgoRepayRoutesActive && repayAdapterList.length === 0 ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedRepayAdapterId("");
                  setRepayRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selectedRepayAdapterId === ""
                    ? "border-whale-gold bg-amber-50/90 dark:border-whale-gold dark:bg-amber-950/40"
                    : "border-slate-200 bg-white/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-amber-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    xALGO
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Spend governance xALGO from your wallet (nt200 deposit +
                    repay).
                  </div>
                </div>
                {selectedRepayAdapterId === "" ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-whale-gold"
                    aria-hidden
                  />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRepayAdapterId(XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID);
                  setRepayRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selectedRepayAdapterId === XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID
                    ? "border-whale-gold bg-amber-50/90 dark:border-whale-gold dark:bg-amber-950/40"
                    : "border-slate-200 bg-white/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-amber-700 dark:hover:bg-slate-800"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    ALGO
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Mint xALGO from ALGO via governance, then repay — one atomic
                    wallet group.
                  </div>
                </div>
                {selectedRepayAdapterId ===
                XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID ? (
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-whale-gold"
                    aria-hidden
                  />
                ) : null}
              </button>
            </>
          ) : (
            repayAdapterList.map((a) => {
            const sid = tokenAdapterStableId(a);
            const selected = sid === selectedRepayAdapterId;
            const basis = a.repayWalletBasis ?? "market_token";
            const basisLabel =
              basis === "market_token"
                ? "f-asset from wallet"
                : "Underlying (e.g. ALGO via Folks mint)";
            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSelectedRepayAdapterId(sid);
                  setRepayRoutePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-whale-gold bg-amber-50/90 dark:border-whale-gold dark:bg-amber-950/40"
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
                    className="mt-0.5 h-5 w-5 shrink-0 text-whale-gold"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          }))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RepayModal;
