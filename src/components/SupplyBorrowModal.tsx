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
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  getNetworkConfig,
  NetworkId,
  getFolksAdaptersForPhase,
  getAnyFolksAdapter,
  tokenAdapterStableId,
  resolveDepositFolksAdapter,
  resolveBorrowFolksAdapter,
  type FolksTokenAdapterConfig,
  type TokenConfig,
} from "@/config";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
  folksUnderlyingHumanToFAssetHuman,
} from "@/services/folksDepositAdapter";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { updateTransactionMetadata } from "@/utils/transactionUtils";
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
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";

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
}

type SupplyBorrowTokenRow = {
  symbol: string;
  poolId?: string;
  configKey?: string;
  originalSymbol?: string;
  underlyingContractId?: string;
  /** Config `contractId` when it differs from `underlyingContractId` (display ASA). */
  originalContractId?: string;
};

/** When display `asset` + `poolId` match multiple config rows (e.g. Algo vs fALGO), pass the tokens map key from the market row (`configSymbol`). */
export function resolveSupplyBorrowToken<T extends SupplyBorrowTokenRow>(
  tokens: T[],
  asset: string,
  poolId: string | undefined,
  configSymbol: string | undefined,
  marketId?: string | null
): T | undefined {
  const poolOk = (t: T) =>
    poolId == null || poolId === "" || String(t.poolId) === String(poolId);

  // Prefer config key first: API `marketId` may not match `underlyingContractId` (e.g. asset id),
  // and display `symbol` + pool collide for ALGO vs fALGO.
  if (configSymbol) {
    const byKey = tokens.find(
      (t) =>
        poolOk(t) &&
        (t.configKey === configSymbol ||
          t.originalSymbol === configSymbol ||
          t.symbol === configSymbol)
    );
    if (byKey) return byKey;
  }

  if (marketId != null && marketId !== "" && poolId != null && poolId !== "") {
    const byContract = tokens.find(
      (t) =>
        String(t.underlyingContractId ?? "") === String(marketId) &&
        String(t.poolId ?? "") === String(poolId)
    );
    if (byContract) return byContract;
    const byOriginal = tokens.find(
      (t) =>
        String(t.originalContractId ?? "") === String(marketId) &&
        String(t.poolId ?? "") === String(poolId)
    );
    if (byOriginal) return byOriginal;
  }

  if (poolId != null && poolId !== "") {
    return tokens.find((t) => t.symbol === asset && poolOk(t));
  }
  return tokens.find((t) => t.symbol === asset);
}

/** Row in the optional supply/borrow asset picker (same disambiguation idea as Withdraw modal). */
export type SupplyBorrowAvailableAsset = {
  asset: string;
  icon: string;
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
  /** Folks f-asset ASA opt-in status when {@link TokenConfig.requireStandaloneFAssetOptInBeforeDeposit} applies. */
  const [fAssetPreOptInStatus, setFAssetPreOptInStatus] = useState<
    "idle" | "checking" | "in" | "out"
  >("idle");
  const [isPreDepositFAssetOptInSubmitting, setIsPreDepositFAssetOptInSubmitting] =
    useState(false);
  /** Selected Folks deposit route; defaults to underlying when both f-asset and underlying routes exist. */
  const [selectedDepositAdapterId, setSelectedDepositAdapterId] =
    useState<string>("");
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
    const originalSymbol =
      (tok as { configKey?: string }).configKey ??
      ("originalSymbol" in tok
        ? (tok as { originalSymbol?: string }).originalSymbol
        : asset);
    const raw = getTokenConfig(networkToUse as NetworkId, originalSymbol);
    if (!raw) return null;
    return Array.isArray(raw)
      ? raw.find((tc) => String(tc.poolId) === String(tok.poolId)) ?? raw[0]
      : raw;
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  const depositFolksAdapters = useMemo((): FolksTokenAdapterConfig[] => {
    if (!resolvedDepositTokenConfig) return [];
    return getFolksAdaptersForPhase(resolvedDepositTokenConfig, "deposit");
  }, [resolvedDepositTokenConfig]);

  const depositMultiRoute =
    mode === "deposit" && depositFolksAdapters.length > 1;

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
    const originalSymbol =
      (tok as { configKey?: string }).configKey ??
      ("originalSymbol" in tok
        ? (tok as { originalSymbol?: string }).originalSymbol
        : asset);
    const raw = getTokenConfig(networkToUse as NetworkId, originalSymbol);
    if (!raw) return null;
    return Array.isArray(raw)
      ? raw.find((tc) => String(tc.poolId) === String(tok.poolId)) ?? raw[0]
      : raw;
  }, [mode, networkToUse, asset, poolId, configSymbol, marketId]);

  const borrowFolksAdapters = useMemo((): FolksTokenAdapterConfig[] => {
    if (!resolvedBorrowTokenConfig) return [];
    return getFolksAdaptersForPhase(resolvedBorrowTokenConfig, "borrow");
  }, [resolvedBorrowTokenConfig]);

  const borrowMultiRoute =
    mode === "borrow" && borrowFolksAdapters.length > 1;

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
    return resolveDepositFolksAdapter(
      resolvedDepositTokenConfig,
      selectedDepositAdapterId
    );
  }, [resolvedDepositTokenConfig, selectedDepositAdapterId]);

  const preDepositFAssetAsaId = useMemo((): number | null => {
    if (!resolvedDepositTokenConfig?.requireStandaloneFAssetOptInBeforeDeposit) {
      return null;
    }
    const folks = getAnyFolksAdapter(resolvedDepositTokenConfig);
    if (folks?.type !== "folks") return null;
    const n = Number(String(folks.folksParams.fAssetId ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [resolvedDepositTokenConfig]);

  const depositRequiresStandaloneFAssetOptIn = useMemo(
    () =>
      mode === "deposit" &&
      (networkToUse as string) === "algorand-mainnet" &&
      preDepositFAssetAsaId != null,
    [mode, networkToUse, preDepositFAssetAsaId]
  );

  const preDepositFAssetDisplayLabel = useMemo(() => {
    if (!resolvedDepositTokenConfig?.requireStandaloneFAssetOptInBeforeDeposit) {
      return "f-asset";
    }
    const tok = getFolksAdaptersForPhase(
      resolvedDepositTokenConfig,
      "deposit"
    ).find((a) => (a.depositWalletBasis ?? "underlying") === "market_token");
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
    selectedDepositAdapterId,
    selectedDepositAdapter?.depositWalletBasis,
    propWalletBalance,
    walletBalanceMarketToken,
    fetchedFAssetWalletHuman,
  ]);

  /** USD under wallet row: follows selected deposit route (underlying vs f-asset). */
  const effectiveDepositWalletBalanceUSD = useMemo(() => {
    if (mode !== "deposit") return propWalletBalanceUSD;
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
    selectedDepositAdapterId,
    selectedDepositAdapter?.depositWalletBasis,
    propWalletBalanceUSD,
    effectiveDepositWalletBalance,
    tokenPrice,
  ]);

  useEffect(() => {
    if (!isOpen || mode !== "deposit") return;
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
  }, [isOpen, mode, depositFolksAdapters]);

  useEffect(() => {
    if (!isOpen || mode !== "borrow") return;
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
  }, [isOpen, mode, borrowFolksAdapters]);

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
    const raw =
      calculatedMaxBorrow !== null ? calculatedMaxBorrow : assetData.liquidity;
    const safeRaw =
      typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const borrowCap = assetData.maxTotalBorrows ?? 0;
    if (borrowCap <= 0) return safeRaw;
    const remaining = Math.max(0, borrowCap - (assetData.totalBorrow ?? 0));
    return Math.min(safeRaw, remaining);
  }, [
    mode,
    calculatedMaxBorrow,
    assetData.liquidity,
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
    return borrowInputToMarketTokenHuman(
      amount,
      borrowInputReceiveBasis,
      folksMintedFAssetPerOneUnderlying,
      borrowTokenDecimals
    );
  }, [
    mode,
    amount,
    borrowInputReceiveBasis,
    folksMintedFAssetPerOneUnderlying,
    borrowTokenDecimals,
  ]);

  const effectiveBorrowCapInInputUnits = useMemo(() => {
    if (mode !== "borrow" || effectiveBorrowCap == null) return null;
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
    borrowInputReceiveBasis,
    folksMintRatioStatus,
    folksMintedFAssetPerOneUnderlying,
    borrowTokenDecimals,
  ]);

  const maxBorrowableUnitSymbol = useMemo(() => {
    if (mode !== "borrow") return undefined;
    if (
      borrowInputReceiveBasis === "underlying" &&
      folksMintRatioStatus === "ready"
    ) {
      return "ALGO";
    }
    return asset;
  }, [mode, borrowInputReceiveBasis, folksMintRatioStatus, asset]);

  const borrowMaxLineLoading = useMemo(() => {
    if (mode !== "borrow") return false;
    return (
      isLoadingMaxBorrow ||
      (borrowInputReceiveBasis === "underlying" &&
        folksMintRatioStatus === "loading")
    );
  }, [mode, isLoadingMaxBorrow, borrowInputReceiveBasis, folksMintRatioStatus]);

  const borrowFolksRateUnavailable = useMemo(
    () =>
      mode === "borrow" &&
      borrowInputReceiveBasis === "underlying" &&
      folksMintRatioStatus === "failed",
    [mode, borrowInputReceiveBasis, folksMintRatioStatus]
  );

  /** Underlying-route borrow needs Folks mint ratio before submit. */
  const borrowFolksBlockingSubmit = useMemo(() => {
    if (mode !== "borrow") return false;
    if (borrowInputReceiveBasis !== "underlying") return false;
    const a = parseFloat(amount) || 0;
    if (a <= 0) return false;
    return folksMintRatioStatus !== "ready";
  }, [mode, borrowInputReceiveBasis, amount, folksMintRatioStatus]);

  /** Est. pool HF after borrowing `amount` (for submit / button guard). */
  const estimatedHealthFactorAfterBorrow = useMemo(() => {
    if (
      mode !== "borrow" ||
      poolGlobalUserData == null ||
      !liquidationSummaryForBorrowCap
    ) {
      return null;
    }
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return null;
    const meta = estimatePoolHealthAfterBorrow(
      poolGlobalUserData,
      liquidationSummaryForBorrowCap,
      amt,
      tokenPrice
    );
    return meta?.value ?? null;
  }, [mode, poolGlobalUserData, liquidationSummaryForBorrowCap, amount, tokenPrice]);

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

      setIsLoadingMaxBorrow(true);
      setMaxBorrowError(null);

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

        // Handle case where tokenConfig might be an array (multiple markets)
        // Compare poolIds as strings to ensure exact match
        const tokenConfig = Array.isArray(tokenConfigRaw)
          ? tokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || tokenConfigRaw[0]
          : tokenConfigRaw;

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
          const poolData =
            poolId != null && poolId !== ""
              ? await fetchUserGlobalDataForPool(
                activeAccount.address,
                networkToUse as NetworkId,
                Number(poolId)
              )
              : null;
          console.log("SupplyBorrowModal: Pool data", { poolData, poolId });
          const collateralForBorrow =
            poolData != null
              ? poolData.totalCollateralValue
              : effectiveUserGlobalData.totalCollateralValue;
          const maxBorrowUSD = collateralForBorrow * (assetData.collateralFactor / 100);
          const calculatedMaxBorrow = capByBorrowCap(
            tokenPrice != null && tokenPrice > 0
              ? (maxBorrowUSD / tokenPrice) * Math.pow(10, 6) / Math.pow(10, decimals)
              : 0
          );
          setCalculatedMaxBorrow(calculatedMaxBorrow);
        } else {
          // Even if maxBorrowBigInt is 0, we should still check deposits - borrowed, then cap by borrow cap
          const finalMaxBorrow = capByBorrowCap(Math.max(0, depositsMinusBorrowed));
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log(
            "SupplyBorrowModal: Max borrow amount (deposits - borrowed):",
            finalMaxBorrow
          );
        }
      } catch (error) {
        console.error(
          "SupplyBorrowModal: Error calculating max borrow amount:",
          error
        );
        setMaxBorrowError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        setCalculatedMaxBorrow(null);
      } finally {
        setIsLoadingMaxBorrow(false);
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
    effectiveUserGlobalData?.totalCollateralValue,
  ]);

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
            networkId === "voi-mainnet" ? "VOI Mainnet" : "Algorand Mainnet";
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

      const stxns = await signTransactions(
        pending.txnsB64.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

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
    } catch (error) {
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
          errorMessage = error.message;
        }
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
            networkId === "voi-mainnet" ? "VOI Mainnet" : "Algorand Mainnet";
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

      const stxns = await signTransactions(
        txnsB64.map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
      );
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

    // For deposits, check wallet balance (per selected deposit adapter basis)
    if (
      mode === "deposit" &&
      parseFloat(amount) > effectiveDepositWalletBalance
    ) {
      setError("Insufficient wallet balance");
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

      // Handle case where tokenConfig might be an array (multiple markets)
      const originalTokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw.find(
          (tc) => String(tc.poolId) === String(token.poolId)
        ) || tokenConfigRaw[0]
        : tokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
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

      if (
        mode === "deposit" &&
        actualNetwork === "algorand-mainnet" &&
        originalTokenConfig.requireStandaloneFAssetOptInBeforeDeposit &&
        fAssetPreOptInStatus !== "in"
      ) {
        setError(
          fAssetPreOptInStatus === "checking"
            ? "Still checking f-asset opt-in status. Wait a moment and try again."
            : "Opt in to the Folks f-asset first using the button above (one small transaction), then supply."
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
        result = await deposit(
          token.poolId,
          token.underlyingContractId,
          originalTokenConfig.tokenStandard,
          amountInAtomicUnits,
          activeAccount.address,
          actualNetwork as NetworkId,
          selectedDepositAdapterId.trim() !== ""
            ? { depositAdapterId: selectedDepositAdapterId }
            : undefined
        );
      } else if (mode === "borrow") {
        // Call the lending service borrow method
        result = await borrow(
          token.poolId,
          token.underlyingContractId,
          originalTokenConfig.tokenStandard,
          amountInAtomicUnits,
          activeAccount.address,
          actualNetwork as NetworkId,
          selectedBorrowAdapterId.trim() !== ""
            ? { borrowAdapterId: selectedBorrowAdapterId }
            : undefined
        );
      } else {
        throw new Error(`Unsupported mode: ${mode}`);
      }

      if (!result.success) {
        throw new Error(result.error || `${mode} failed`);
      }

      console.log(`${mode} result:`, result);

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
            networkId === "voi-mainnet" ? "VOI Mainnet" : "Algorand Mainnet";
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
      console.error(`${mode} error:`, error);

      // Enhanced error handling with specific messages
      let errorMessage = `${mode} failed`;

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes("compatible wallet")) {
          errorMessage = error.message;
        } else if (message.includes("insufficient liquidity for withdraw")) {
          errorMessage =
            "Insufficient liquidity for withdraw. Please check your deposit and borrow balances, add collateral, or repay debt and try again.";
        } else if (message.includes("insufficient collateral for borrow")) {
          errorMessage =
            "Insufficient collateral for borrow. Please check your collateral balance, add collateral, or repay debt and try again.";
        } else if (message.includes("tried to spend")) {
          errorMessage = `Insufficient ${networkToUse === "algorand-mainnet" ? "Algorand" : "Voi"
            } Network balance for this transaction. Please check your wallet balance and try again.`;
        } else if (message.includes("insufficient")) {
          errorMessage =
            mode === "deposit"
              ? "Insufficient wallet balance for this transaction"
              : "Insufficient liquidity or collateral for this transaction";
        } else if (
          message.includes("network") ||
          message.includes("connection")
        ) {
          errorMessage =
            "Network connection issue. Please check your internet connection and try again.";
        } else if (message.includes("gas") || message.includes("fee")) {
          errorMessage =
            "Transaction failed due to insufficient gas fees. Please ensure you have enough tokens for gas.";
        } else if (message.includes("rejected") || message.includes("user")) {
          errorMessage = "Transaction was rejected or cancelled by user.";
        } else if (message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please try again.";
        } else if (
          message.includes("invalid") ||
          message.includes("malformed")
        ) {
          errorMessage =
            "Invalid transaction parameters. Please refresh and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransaction = () => {
    if (!transactionId) {
      throw new Error("Transaction ID not found");
    }
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

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden flex flex-col p-0 overscroll-contain">
        {showSuccess ? (
          <div className="p-6">
            <SupplyBorrowCongrats
              transactionType={mode}
              asset={asset}
              assetIcon={assetData.icon}
              amount={amount}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
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
                            <img
                              src={assetData.icon}
                              alt={asset}
                              className="w-12 h-12 rounded-full shadow"
                            />
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
                                <img
                                  src={a.icon}
                                  alt={a.asset}
                                  className="h-5 w-5 rounded-full"
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

              {mode === "deposit" && depositFolksAdapters.length === 1 && (
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
                  mode === "deposit" && selectedDepositAdapter
                    ? selectedDepositAdapter.label ??
                      selectedDepositAdapter.name ??
                      asset
                    : undefined
                }
                walletBalanceRowTitle={
                  mode === "deposit" && selectedDepositAdapter
                    ? `Wallet balance · ${
                        selectedDepositAdapter.label ??
                        selectedDepositAdapter.name ??
                        asset
                      }`
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
                  (mode === "borrow" && borrowFolksBlockingSubmit)
                }
                hideButton={true}
                isLoadingMaxBorrow={borrowMaxLineLoading}
                maxBorrowError={maxBorrowError}
                maxBorrowableUnitSymbol={maxBorrowableUnitSymbol}
                borrowFolksRateUnavailable={borrowFolksRateUnavailable}
                network={networkToUse}
                walletBalanceLastUpdated={walletBalanceLastUpdated}
                onRefreshWalletBalance={onRefreshWalletBalance}
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
                        {selectedDepositAdapter?.label ??
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
                        {selectedBorrowAdapter?.label ??
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
                  amount={amount}
                  networkId={pendingSign.actualNetwork}
                  poolAppId={pendingSign.poolAppId}
                  marketContractId={pendingSign.marketContractId}
                  underlyingAssetId={pendingSign.underlyingAssetId}
                  txnCount={pendingSign.txnsB64.length}
                  estimatedFeeAlgoDisplay={(
                    (pendingSign.txnsB64.length * algosdk.MIN_TXN_FEE) /
                    1e6
                  ).toFixed(4)}
                  reserveFactorPercent={assetData.reserveFactor ?? null}
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
