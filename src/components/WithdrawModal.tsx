import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, ChevronDown, ChevronUp, Check } from "lucide-react";
import { formatRelativeTime, formatRelativeTimeFromISO } from "@/utils/timeUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import { calculateDepositAPY } from "@/utils/apyCalculations";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  fetchUserGlobalDataForPool,
  MAX_WITHDRAW_HEALTH_FACTOR_TARGET,
} from "@/services/lendingService";
import {
  tokenAdapterStableId,
  type FolksTokenAdapterConfig,
  type NetworkId,
} from "@/config";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";
import {
  buildLiquidationThresholdSummaryForDeposit,
  DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX,
  estimatePoolHealthAfterWithdraw,
} from "@/utils/depositModalPoolHealthEstimate";
import { cn } from "@/lib/utils";
import {
  folksFAssetHumanToUnderlyingHuman,
  folksUnderlyingHumanToFAssetHuman,
} from "@/services/folksDepositAdapter";

/** Require withdraw-all confirmation when MAX targets ≥ this share of deposited balance (or full balance). */
const WITHDRAW_ALL_CONFIRM_MIN_SHARE = 0.95;
/** Unsafe HF-cap override only if estimated pool HF after withdraw stays at or above this. */
const MIN_HF_FOR_UNSAFE_WITHDRAW_OVERRIDE = 1.05;

/** Stable React / Radix Select key when display `asset` + pool + network collide (e.g. ALGO vs fALGO both "Algo"). */
export function withdrawAvailableAssetRowKey(
  a: {
    asset: string;
    poolId?: string;
    network?: string;
    marketId?: string;
    configSymbol?: string;
  },
  index: number
): string {
  const pool = a.poolId ?? "";
  const net = a.network ?? "";
  const mid = a.marketId != null && String(a.marketId) !== "" ? String(a.marketId) : "";
  const cfg =
    a.configSymbol != null && String(a.configSymbol) !== ""
      ? String(a.configSymbol)
      : "";
  if (mid === "" && cfg === "") {
    return `${a.asset}|${pool}|${net}|i${index}`;
  }
  return `${a.asset}|${pool}|${net}|${mid}|${cfg}`;
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  /** Optional list of withdrawable assets for in-modal asset switching */
  availableAssets?: {
    asset: string;
    icon: string;
    value: number;
    poolId?: string;
    network?: string;
    marketId?: string;
    configSymbol?: string;
  }[];
  /** Called when the user selects a different asset from the dropdown */
  onSelectAsset?: (
    asset: string,
    poolId?: string,
    network?: string,
    pick?: { marketId?: string; configSymbol?: string }
  ) => void;
  /** Disambiguates current row when `availableAssets` has duplicate display symbols. */
  selectedMarketId?: string;
  selectedConfigSymbol?: string;
  currentlyDeposited: number;
  marketStats: {
    supplyAPY: number;
    borrowAPY: number;
    utilization: number;
    collateralFactor: number;
    tokenPrice: number;
    totalDeposits?: number;
    totalBorrows?: number;
    apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
    marketCapacity?: number;
    liquidationMargin?: number;
    healthFactor?: number;
    ltv?: number;
    accruedInterest?: number;
    currentDepositIndex?: string;
    userDepositIndex?: string;
    scaledDeposits?: string;
    lastUpdateTime?: number | string;
    /** Percent 0–100, same as deposit modal / getAssetData */
    liquidationThreshold?: number;
  };
  /** Health-factor-safe max withdraw (from getMaxWithdrawable). When set, Max button and validation use this instead of full deposit. */
  maxWithdrawUnderlying?: number;
  /** Token decimals for amount display (e.g. 8 for goBTC). Default 8 so small balances are not truncated. */
  tokenDecimals?: number;
  onSubmit?: (
    amount: string,
    options?: {
      isMaxWithdraw?: boolean;
      withdrawAllConfirmed?: boolean;
      unsafeHealthFactorOverrideConfirmed?: boolean;
      /** Folks withdraw-phase adapter id (see {@link tokenAdapterStableId}). */
      withdrawAdapterId?: string;
    }
  ) => void;
  isLoading?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onRefreshBalance?: () => void;
  /** Lending pool (for pool-scoped LT / est. health, same as deposit modal). */
  poolId?: string;
  network?: string;
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  /**
   * When true, user has no borrows in this pool — full "Max" withdraw may use withdraw-all on-chain.
   * In that case a confirmation checkbox is shown before submit.
   */
  poolHasNoBorrows?: boolean;
  /**
   * When true (e.g. token `adapter` in config — Folks f-asset path), skip HF-safe cap from chain,
   * HF-cap warnings/override, and pool health fetch for this withdrawal.
   */
  disableHealthFactorWithdrawSafety?: boolean;
  /**
   * Folks `network-asa`: user enters and sees underlying (e.g. ALGO); `onSubmit` amount is underlying.
   */
  withdrawAmountIsUnderlying?: boolean;
  /** Symbol for amount labels / pricing when `withdrawAmountIsUnderlying` (e.g. ALGO). */
  amountSymbol?: string;
  /** Folks minted f-asset (atomic) for 1.0 underlying; enables ≈ f-asset hint under the amount field. */
  folksMintOneUnderlyingAtomic?: string;
  /** Lending market token symbol for conversion hint (e.g. fALGO). */
  marketPositionSymbol?: string;
  /**
   * Human balance in lending market token (e.g. fALGO) for index-based accrued / original deposit math.
   * When withdrawing in underlying, pass f-asset `deposit.balance`; `currentlyDeposited` is then underlying for display.
   */
  positionBalanceForIndexStats?: number;
  /** Folks `network-asa`: on-chain position in f-asset human units (`deposit.balance`); used when withdrawing to f-ASA. */
  positionMarketTokenHuman?: number;
  /** Folks withdraw-phase adapters for this market (empty if none); mirrors deposit modal route UX. */
  folksWithdrawAdapters?: FolksTokenAdapterConfig[];
}

const WithdrawModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  availableAssets,
  onSelectAsset,
  selectedMarketId,
  selectedConfigSymbol,
  currentlyDeposited,
  marketStats,
  maxWithdrawUnderlying,
  tokenDecimals = 8,
  onSubmit,
  isLoading = false,
  showTooltip = false,
  tooltipText = "",
  onRefreshBalance,
  poolId,
  network: networkProp,
  poolCollateralMarkets,
  poolHasNoBorrows = false,
  disableHealthFactorWithdrawSafety = false,
  withdrawAmountIsUnderlying = false,
  amountSymbol,
  folksMintOneUnderlyingAtomic,
  marketPositionSymbol,
  positionBalanceForIndexStats,
  positionMarketTokenHuman,
  folksWithdrawAdapters = [],
}: WithdrawModalProps) => {
  const withdrawFolksAdapters = folksWithdrawAdapters;
  const withdrawMultiRoute = withdrawFolksAdapters.length > 1;
  const displayDecimals = Math.min(Math.max(0, tokenDecimals), 8);
  const amountLabelSymbol = amountSymbol ?? tokenSymbol;
  const balanceForIndexMath =
    positionBalanceForIndexStats ??
    positionMarketTokenHuman ??
    currentlyDeposited;
  const folksMintOneBi = useMemo(() => {
    if (!folksMintOneUnderlyingAtomic?.trim()) return null;
    try {
      const v = BigInt(folksMintOneUnderlyingAtomic.trim());
      return v > BigInt(0) ? v : null;
    } catch {
      return null;
    }
  }, [folksMintOneUnderlyingAtomic]);

  const [amount, setAmount] = useState<number | "">("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  /** True when the current amount was set with MAX (cleared when the user edits the field). */
  const [withdrawViaMax, setWithdrawViaMax] = useState(false);
  const [withdrawFullPositionConfirmed, setWithdrawFullPositionConfirmed] =
    useState(false);
  const [unsafeHfOverrideConfirmed, setUnsafeHfOverrideConfirmed] =
    useState(false);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [showDebugValues, setShowDebugValues] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [selectedWithdrawAdapterId, setSelectedWithdrawAdapterId] =
    useState("");
  const [withdrawRoutePickerOpen, setWithdrawRoutePickerOpen] =
    useState(false);
  const prevWithdrawAdapterIdRef = useRef<string>("");
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();
  const networkToUse = (networkProp || currentNetwork) as NetworkId | undefined;

  useEffect(() => {
    if (!isOpen) setWithdrawRoutePickerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      prevWithdrawAdapterIdRef.current = "";
      return;
    }
    const list = withdrawFolksAdapters;
    if (list.length === 0) {
      setSelectedWithdrawAdapterId("");
      return;
    }
    setSelectedWithdrawAdapterId((prev) => {
      const ids = list.map((a) => tokenAdapterStableId(a));
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [isOpen, withdrawFolksAdapters]);

  useEffect(() => {
    if (!isOpen || !selectedWithdrawAdapterId) return;
    const prev = prevWithdrawAdapterIdRef.current;
    const changed = prev !== "" && prev !== selectedWithdrawAdapterId;
    if (changed) {
      setAmount("");
      setWithdrawViaMax(false);
      setFiatValue(0);
    }
    prevWithdrawAdapterIdRef.current = selectedWithdrawAdapterId;
  }, [isOpen, selectedWithdrawAdapterId]);

  const selectedWithdrawAdapter = useMemo(() => {
    if (withdrawFolksAdapters.length === 0) return undefined;
    if (!selectedWithdrawAdapterId) return withdrawFolksAdapters[0];
    return (
      withdrawFolksAdapters.find(
        (a) => tokenAdapterStableId(a) === selectedWithdrawAdapterId
      ) ?? withdrawFolksAdapters[0]
    );
  }, [withdrawFolksAdapters, selectedWithdrawAdapterId]);

  const withdrawReceiveMarketToken = useMemo(
    () => selectedWithdrawAdapter?.withdrawReceiveBasis === "market_token",
    [selectedWithdrawAdapter]
  );

  const effectiveAmountLabelSymbol = useMemo(
    () =>
      withdrawReceiveMarketToken
        ? (marketPositionSymbol ??
            selectedWithdrawAdapter?.label ??
            selectedWithdrawAdapter?.name ??
            "fALGO")
        : amountLabelSymbol,
    [
      withdrawReceiveMarketToken,
      marketPositionSymbol,
      selectedWithdrawAdapter,
      amountLabelSymbol,
    ]
  );

  const detailUnitSymbol = useMemo(
    () =>
      withdrawReceiveMarketToken
        ? effectiveAmountLabelSymbol
        : withdrawAmountIsUnderlying
          ? amountLabelSymbol
          : tokenSymbol,
    [
      withdrawReceiveMarketToken,
      effectiveAmountLabelSymbol,
      withdrawAmountIsUnderlying,
      amountLabelSymbol,
      tokenSymbol,
    ]
  );

  const useUnderlyingIndexConversion =
    withdrawAmountIsUnderlying && !withdrawReceiveMarketToken;

  const fiatPriceSymbol = useMemo(
    () =>
      withdrawReceiveMarketToken
        ? (marketPositionSymbol ??
            effectiveAmountLabelSymbol ??
            tokenSymbol)
        : withdrawAmountIsUnderlying
          ? amountLabelSymbol
          : tokenSymbol,
    [
      withdrawReceiveMarketToken,
      marketPositionSymbol,
      effectiveAmountLabelSymbol,
      withdrawAmountIsUnderlying,
      amountLabelSymbol,
      tokenSymbol,
    ]
  );

  const { price: oracleTokenPrice } = useTokenPrice(
    fiatPriceSymbol,
    networkToUse
  );

  const equivalentFAssetHumanHint = useMemo(() => {
    if (
      !useUnderlyingIndexConversion ||
      folksMintOneBi == null ||
      amount === "" ||
      typeof amount !== "number" ||
      !Number.isFinite(amount)
    ) {
      return null;
    }
    return folksUnderlyingHumanToFAssetHuman(
      amount,
      folksMintOneBi,
      tokenDecimals
    );
  }, [useUnderlyingIndexConversion, folksMintOneBi, amount, tokenDecimals]);

  const withdrawSelectRowKey = useMemo(() => {
    if (!availableAssets?.length) return tokenSymbol;
    const idx = availableAssets.findIndex(
      (a) =>
        a.asset === tokenSymbol &&
        String(a.poolId ?? "") === String(poolId ?? "") &&
        String(a.network ?? "") === String(networkProp ?? "") &&
        String(a.marketId ?? "") === String(selectedMarketId ?? "") &&
        String(a.configSymbol ?? "") === String(selectedConfigSymbol ?? "")
    );
    if (idx >= 0) {
      return withdrawAvailableAssetRowKey(availableAssets[idx], idx);
    }
    const loose = availableAssets.findIndex(
      (a) =>
        a.asset === tokenSymbol &&
        String(a.poolId ?? "") === String(poolId ?? "") &&
        String(a.network ?? "") === String(networkProp ?? "")
    );
    if (loose >= 0) {
      return withdrawAvailableAssetRowKey(availableAssets[loose], loose);
    }
    return tokenSymbol;
  }, [
    availableAssets,
    tokenSymbol,
    poolId,
    networkProp,
    selectedMarketId,
    selectedConfigSymbol,
  ]);

  const [poolGlobalUserData, setPoolGlobalUserData] = useState<
    | {
        totalCollateralValue: number;
        totalBorrowValue: number;
        lastUpdateTime: number;
      }
    | null
    | undefined
  >(undefined);

  useEffect(() => {
    if (
      disableHealthFactorWithdrawSafety ||
      !isOpen ||
      !poolId ||
      !activeAccount?.address ||
      !networkToUse
    ) {
      setPoolGlobalUserData(undefined);
      return;
    }
    let cancelled = false;
    fetchUserGlobalDataForPool(
      activeAccount.address,
      networkToUse,
      poolId
    )
      .then((data) => {
        if (!cancelled && data) {
          setPoolGlobalUserData({
            totalCollateralValue: data.totalCollateralValue,
            totalBorrowValue: data.totalBorrowValue,
            lastUpdateTime: data.lastUpdateTime,
          });
        } else if (!cancelled) {
          setPoolGlobalUserData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPoolGlobalUserData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    poolId,
    activeAccount?.address,
    networkToUse,
    disableHealthFactorWithdrawSafety,
  ]);

  // Prefer market row price (disambiguates fALGO vs ALGO); useTokenPrice matches first symbol only.
  const priceForHealth =
    marketStats.tokenPrice > 0 && Number.isFinite(marketStats.tokenPrice)
      ? marketStats.tokenPrice
      : oracleTokenPrice > 0 && Number.isFinite(oracleTokenPrice)
        ? oracleTokenPrice
        : 0;

  const liquidationThresholdSummary = useMemo(() => {
    const lt = marketStats.liquidationThreshold;
    if (lt == null || !Number.isFinite(lt)) return null;
    return buildLiquidationThresholdSummaryForDeposit(
      lt,
      poolCollateralMarkets,
      poolId
    );
  }, [marketStats.liquidationThreshold, poolCollateralMarkets, poolId]);

  const withdrawAmountForEstimate =
    typeof amount === "number" && amount > 0 && Number.isFinite(amount)
      ? amount
      : 0;

  const estimatedPoolHealthMeta = useMemo(() => {
    if (poolGlobalUserData == null || !liquidationThresholdSummary) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    const meta = estimatePoolHealthAfterWithdraw(
      poolGlobalUserData,
      liquidationThresholdSummary,
      withdrawAmountForEstimate,
      priceForHealth
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
    liquidationThresholdSummary,
    withdrawAmountForEstimate,
    priceForHealth,
  ]);

  const unsafeOverrideAllowedByHfFloor = useMemo(() => {
    const v = estimatedPoolHealthMeta.value;
    if (v == null || !Number.isFinite(v)) return false;
    return v >= MIN_HF_FOR_UNSAFE_WITHDRAW_OVERRIDE - 1e-9;
  }, [estimatedPoolHealthMeta.value]);

  // Calculate values using indices
  // Formula:
  // Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE
  // Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE
  // 
  // Since currentlyDeposited is already calculated correctly using currentDepositIndex,
  // we can calculate original deposit using the ratio of indices:
  // Original Deposit = currentlyDeposited × (userDepositIndex / currentDepositIndex)
  const calculateOriginalDeposit = (): number => {
    if (
      marketStats.currentDepositIndex &&
      marketStats.userDepositIndex &&
      balanceForIndexMath > 0
    ) {
      try {
        const currentIndex = Number(marketStats.currentDepositIndex);
        const userIndex = Number(marketStats.userDepositIndex);
        if (currentIndex > 0 && userIndex > 0) {
          // Validate: currentDepositIndex should always be >= userDepositIndex
          // (current index increases over time as interest accrues)
          if (userIndex > currentIndex) {
            console.warn(
              "Invalid index relationship: userDepositIndex > currentDepositIndex",
              {
                userDepositIndex: userIndex,
                currentDepositIndex: currentIndex,
                tokenSymbol,
              }
            );
            // If indices are invalid, fall back (assume no interest accrued if indices are wrong)
            return balanceForIndexMath;
          }
          // Original Deposit = balance × (userDepositIndex / currentDepositIndex)
          return balanceForIndexMath * (userIndex / currentIndex);
        }
      } catch (error) {
        console.error("Error calculating original deposit:", error);
      }
    }
    // Fallback: calculate from balance and accruedInterest
    return balanceForIndexMath - (marketStats.accruedInterest ?? 0);
  };

  const originalDepositMarketUnits = calculateOriginalDeposit();
  const accruedInterestMarketUnits = Math.max(
    0,
    balanceForIndexMath - originalDepositMarketUnits
  );

  const currentDepositValue = useMemo(
    () =>
      withdrawReceiveMarketToken
        ? (positionMarketTokenHuman ??
            positionBalanceForIndexStats ??
            currentlyDeposited)
        : currentlyDeposited,
    [
      withdrawReceiveMarketToken,
      positionMarketTokenHuman,
      positionBalanceForIndexStats,
      currentlyDeposited,
    ]
  );
  // HF-safe max from chain can differ slightly from portfolio "Deposited Balance" due to rounding;
  // when the protocol allows withdrawing the full position, snap MAX to the same number we show.
  const effectiveMaxWithdraw = useMemo(() => {
    if (disableHealthFactorWithdrawSafety || maxWithdrawUnderlying == null) {
      return currentDepositValue;
    }
    if (maxWithdrawUnderlying <= 0) {
      return 0;
    }
    const capped = Math.min(maxWithdrawUnderlying, currentDepositValue);
    if (currentDepositValue <= 0) return capped;
    const factor = 10 ** displayDecimals;
    const relTol = Math.max(1 / factor, currentDepositValue * 1e-12);
    if (maxWithdrawUnderlying >= currentDepositValue - relTol) {
      return currentDepositValue;
    }
    return capped;
  }, [
    disableHealthFactorWithdrawSafety,
    maxWithdrawUnderlying,
    currentDepositValue,
    displayDecimals,
  ]);

  const originalDepositAmount =
    useUnderlyingIndexConversion && !folksMintOneBi
      ? 0
      : useUnderlyingIndexConversion && folksMintOneBi
        ? folksFAssetHumanToUnderlyingHuman(
            originalDepositMarketUnits,
            folksMintOneBi,
            tokenDecimals
          )
        : originalDepositMarketUnits;
  const accruedInterest =
    useUnderlyingIndexConversion && !folksMintOneBi
      ? 0
      : useUnderlyingIndexConversion && folksMintOneBi
        ? folksFAssetHumanToUnderlyingHuman(
            accruedInterestMarketUnits,
            folksMintOneBi,
            tokenDecimals
          )
        : accruedInterestMarketUnits;

  // Debug logging for index validation
  if (marketStats.currentDepositIndex && marketStats.userDepositIndex) {
    const currentIndex = Number(marketStats.currentDepositIndex);
    const userIndex = Number(marketStats.userDepositIndex);
    if (userIndex > currentIndex) {
      console.error("WithdrawModal: Invalid index relationship detected", {
        tokenSymbol,
        currentDepositIndex: currentIndex,
        userDepositIndex: userIndex,
        currentlyDeposited,
        calculatedOriginalDeposit: originalDepositAmount,
        calculatedAccruedInterest: currentDepositValue - originalDepositAmount,
      });
    }
  }

  const handleToggleDetail = (field: string) => {
    setExpandedDetail(prev => (prev === field ? null : field));
  };

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setInternalLoading(false);
      setWithdrawViaMax(false);
      setWithdrawFullPositionConfirmed(false);
      setUnsafeHfOverrideConfirmed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (amount !== "" && typeof amount === "number") {
      const p =
        marketStats.tokenPrice > 0 && Number.isFinite(marketStats.tokenPrice)
          ? marketStats.tokenPrice
          : oracleTokenPrice > 0 && Number.isFinite(oracleTokenPrice)
            ? oracleTokenPrice
            : 0;
      setFiatValue(amount * p);
    } else {
      setFiatValue(0);
    }
  }, [amount, marketStats.tokenPrice, oracleTokenPrice]);

  const handleMaxClick = () => {
    // Use health-factor-safe max when available (getMaxWithdrawable), else full deposit
    setWithdrawViaMax(true);
    const formattedAmount = parseFloat(effectiveMaxWithdraw.toFixed(displayDecimals));
    setAmount(formattedAmount);
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
    setWithdrawViaMax(false);
    setWithdrawFullPositionConfirmed(false);
    setUnsafeHfOverrideConfirmed(false);
  };

  // Use same precision as display decimals for comparison to avoid floating point failures
  const precision = Math.pow(10, displayDecimals);
  const amountRounded =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.floor(amount * precision) / precision
      : NaN;
  const maxRounded =
    Number.isFinite(effectiveMaxWithdraw)
      ? Math.floor(effectiveMaxWithdraw * precision) / precision
      : 0;
  const depositRounded =
    currentDepositValue > 0 && Number.isFinite(currentDepositValue)
      ? Math.floor(currentDepositValue * precision) / precision
      : 0;

  const amtFactor = 10 ** Math.min(Math.max(0, tokenDecimals), 8);
  /** MAX + no borrows: full deposit, or ≥95% of deposit — protocol withdraw-all confirmation. */
  const needsWithdrawAllConfirmation = useMemo(() => {
    if (!poolHasNoBorrows || !withdrawViaMax) return false;
    if (amount === "" || typeof amount !== "number" || !Number.isFinite(amount)) {
      return false;
    }
    if (currentDepositValue <= 0) return false;
    const a = amount;
    const matchesFullDeposit =
      Math.round(a * amtFactor) ===
      Math.round(currentDepositValue * amtFactor);
    const ratio = a / currentDepositValue;
    const atLeastMinShare =
      ratio >= WITHDRAW_ALL_CONFIRM_MIN_SHARE - 1e-12 &&
      ratio <= 1 + 1e-9;
    return matchesFullDeposit || atLeastMinShare;
  }, [poolHasNoBorrows, withdrawViaMax, amount, currentDepositValue, amtFactor]);

  useEffect(() => {
    if (!needsWithdrawAllConfirmation) {
      setWithdrawFullPositionConfirmed(false);
    }
  }, [needsWithdrawAllConfirmation]);

  const wouldDropBelowHf =
    !disableHealthFactorWithdrawSafety &&
    amount !== "" &&
    typeof amount === "number" &&
    Number.isFinite(amountRounded) &&
    amountRounded > maxRounded;

  const exceedsDepositedBalance =
    typeof amount === "number" &&
    Number.isFinite(amountRounded) &&
    Number.isFinite(depositRounded) &&
    depositRounded > 0 &&
    amountRounded > depositRounded + 1e-12;

  const needsUnsafeHfConfirmation =
    wouldDropBelowHf && !exceedsDepositedBalance;

  useEffect(() => {
    if (!needsUnsafeHfConfirmation || !unsafeOverrideAllowedByHfFloor) {
      setUnsafeHfOverrideConfirmed(false);
    }
  }, [needsUnsafeHfConfirmation, unsafeOverrideAllowedByHfFloor]);

  const isValidAmount =
    amount !== "" &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amountRounded > 0 &&
    !exceedsDepositedBalance &&
    (amountRounded <= maxRounded ||
      (needsUnsafeHfConfirmation &&
        unsafeOverrideAllowedByHfFloor &&
        unsafeHfOverrideConfirmed));

  const canSubmitWithdraw =
    isValidAmount &&
    (!needsWithdrawAllConfirmation || withdrawFullPositionConfirmed);

  const handleSubmit = async () => {
    setInternalLoading(true);
    try {
      if (onSubmit) {
        const isMaxWithdraw = withdrawViaMax;
        setWithdrawViaMax(false);
        await onSubmit(
          amount !== "" && typeof amount === "number" ? String(amount) : "",
          {
            isMaxWithdraw,
            withdrawAllConfirmed:
              needsWithdrawAllConfirmation && withdrawFullPositionConfirmed,
            unsafeHealthFactorOverrideConfirmed:
              needsUnsafeHfConfirmation &&
              unsafeOverrideAllowedByHfFloor &&
              unsafeHfOverrideConfirmed,
            withdrawAdapterId:
              withdrawFolksAdapters.length > 0
                ? selectedWithdrawAdapterId || undefined
                : undefined,
          }
        );
      } else {
        console.log(`Withdraw ${amount !== "" ? amount.toString() : ""} ${tokenSymbol}`);

        await new Promise((resolve) => setTimeout(resolve, 500));
        setShowSuccess(true);
      }
    } catch (error) {
      console.error("Withdraw failed:", error);
      // Don't show success on error
    } finally {
      setInternalLoading(false);
    }
  };

  // Share of current deposit; shown in UI only when under 100%.
  let withdrawSharePercent: number | null = null;
  if (
    currentDepositValue > 0 &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0
  ) {
    const pct = (amount / currentDepositValue) * 100;
    if (pct < 100 - 1e-9) {
      withdrawSharePercent = pct;
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md h-[80vh] md:h-[70vh] max-h-[80vh] md:max-h-[70vh] overflow-hidden flex flex-col p-0">
        {showSuccess ? (
          <div className="p-6 overflow-y-auto">
            <SupplyBorrowCongrats
              transactionType="withdraw"
              asset={
                withdrawAmountIsUnderlying || withdrawFolksAdapters.length > 0
                  ? effectiveAmountLabelSymbol
                  : tokenSymbol
              }
              assetIcon={tokenIcon}
              amount={amount !== "" ? amount.toString() : ""}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0 min-h-[7.5rem]">
              <DialogHeader className="pb-0">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Withdraw
                </DialogTitle>
                <div className="flex items-center justify-center gap-3 pb-2 mt-3 h-14">
                  {availableAssets && availableAssets.length > 0 && onSelectAsset ? (
                    <Select
                      value={withdrawSelectRowKey}
                      onValueChange={(value) => {
                        const idx = availableAssets.findIndex(
                          (a, i) =>
                            withdrawAvailableAssetRowKey(a, i) === value
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
                            }
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="w-auto min-w-0 h-auto bg-transparent border-none p-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 justify-center [&>svg:last-child]:!hidden">
                        <div className="flex items-center gap-2 shrink-0">
                          <img
                            src={
                              availableAssets.find(
                                (a, i) =>
                                  withdrawAvailableAssetRowKey(a, i) ===
                                  withdrawSelectRowKey
                              )?.icon || tokenIcon
                            }
                            alt={tokenSymbol}
                            className="w-12 h-12 rounded-full shadow"
                          />
                          <span className="flex items-center gap-1 text-xl font-semibold text-slate-800 dark:text-white">
                            {tokenSymbol}
                            <ChevronDown className="h-4 w-4 text-slate-800 dark:text-white" />
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets.map((asset, index) => (
                          <SelectItem
                            key={withdrawAvailableAssetRowKey(asset, index)}
                            value={withdrawAvailableAssetRowKey(asset, index)}
                          >
                            <span className="flex items-center gap-2">
                              <img
                                src={asset.icon}
                                alt={asset.asset}
                                className="h-5 w-5 rounded-full"
                              />
                              <span>{asset.asset}</span>
                              {asset.value != null && (
                                <span className="text-xs text-muted-foreground">
                                  —{" "}
                                  {asset.value.toLocaleString(undefined, {
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
                  ) : (
                    <>
                      <img
                        src={tokenIcon}
                        alt={tokenSymbol}
                        className="w-12 h-12 rounded-full shadow"
                      />
                      {showTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xl font-semibold text-slate-800 dark:text-white cursor-help underline decoration-dotted">
                              {tokenSymbol}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{tooltipText}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xl font-semibold text-slate-800 dark:text-white">
                          {tokenSymbol}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 md:pb-3 space-y-3 touch-pan-y min-h-0 [scrollbar-gutter:stable]">
              <div
                className="space-y-3"
                key={
                  withdrawFolksAdapters.length > 0
                    ? `w-${selectedWithdrawAdapterId || "none"}`
                    : "withdraw-amount"
                }
              >
                <Label
                  htmlFor="amount"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  {withdrawAmountIsUnderlying || withdrawFolksAdapters.length > 0
                    ? `Amount (${effectiveAmountLabelSymbol})`
                    : "Amount"}
                </Label>
                <div className="relative">
                  <LocaleNumberInput
                    id="amount"
                    placeholder="0.0"
                    autoFocus
                    value={amount}
                    onChange={(v) => {
                      setWithdrawViaMax(false);
                      setAmount(v ?? "");
                    }}
                    formatOptions={{ maximumFractionDigits: displayDecimals }}
                    className={`bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-lg h-12 ${
                      withdrawMultiRoute ? "pr-36" : "pr-16"
                    }`}
                  />
                  {withdrawMultiRoute ? (
                    <div className="absolute right-1 top-1/2 flex max-w-[calc(100%-3rem)] -translate-y-1/2 items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setWithdrawRoutePickerOpen(true)}
                        className="h-8 max-w-full gap-1 px-2 text-teal-600 hover:bg-teal-500/15 dark:text-teal-400"
                        title="Choose withdraw route"
                      >
                        <span className="truncate text-sm font-medium">
                          {selectedWithdrawAdapter?.label ??
                            selectedWithdrawAdapter?.name ??
                            tokenSymbol}
                        </span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 opacity-80"
                          aria-hidden
                        />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleMaxClick}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:bg-red-400/10 h-8 px-3"
                    >
                      MAX
                    </Button>
                  )}
                </div>
                {fiatValue > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ≈ $
                    {fiatValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
                {equivalentFAssetHumanHint != null &&
                  useUnderlyingIndexConversion &&
                  marketPositionSymbol != null &&
                  marketPositionSymbol !== "" && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ≈{" "}
                      {equivalentFAssetHumanHint.toLocaleString(undefined, {
                        maximumFractionDigits: 8,
                      })}{" "}
                      {marketPositionSymbol} on lending (est.)
                    </p>
                  )}
                {withdrawSharePercent != null && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ≈{" "}
                    {withdrawSharePercent.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0,
                    })}
                    % of your deposited balance
                  </p>
                )}
                {!disableHealthFactorWithdrawSafety &&
                  maxWithdrawUnderlying != null &&
                  maxWithdrawUnderlying < currentDepositValue && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      HF-safe max:{" "}
                      {effectiveMaxWithdraw.toLocaleString(undefined, {
                        maximumFractionDigits: displayDecimals,
                      })}{" "}
                      {effectiveAmountLabelSymbol} (≈ $
                      {(effectiveMaxWithdraw * marketStats.tokenPrice).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                      ) — keeps health factor at or above{" "}
                      {MAX_WITHDRAW_HEALTH_FACTOR_TARGET.toFixed(2)}.
                    </p>
                  )}
                {exceedsDepositedBalance && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription>
                      Amount exceeds your deposited balance. Lower the amount to
                      continue.
                    </AlertDescription>
                  </Alert>
                )}
                {needsUnsafeHfConfirmation && !unsafeOverrideAllowedByHfFloor && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription>
                      Override is not available: estimated health factor for this
                      amount is below {MIN_HF_FOR_UNSAFE_WITHDRAW_OVERRIDE.toFixed(2)}{" "}
                      (or could not be estimated). Lower the amount to continue.
                    </AlertDescription>
                  </Alert>
                )}
                {needsUnsafeHfConfirmation && unsafeOverrideAllowedByHfFloor && (
                  <>
                    <Alert
                      variant="default"
                      className="py-2 border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
                    >
                      <AlertDescription>
                        This amount is above the health-factor safety cap (
                        {MAX_WITHDRAW_HEALTH_FACTOR_TARGET.toFixed(2)}). Estimated
                        health factor may drop below that level.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-950/40">
                      <Checkbox
                        id="unsafe-hf-override"
                        checked={unsafeHfOverrideConfirmed}
                        onCheckedChange={(c) =>
                          setUnsafeHfOverrideConfirmed(c === true)
                        }
                        className="mt-0.5 border-amber-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <Label
                        htmlFor="unsafe-hf-override"
                        className="text-sm font-normal leading-snug text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        I understand the risk and want to proceed anyway.
                      </Label>
                    </div>
                  </>
                )}
                {/* Deposited Balance Display */}
                <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        Deposited Balance
                      </span>
                      {onRefreshBalance && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onRefreshBalance}
                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800"
                          title="Refresh deposited balance"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </Button>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                        {currentDepositValue.toLocaleString(undefined, {
                          maximumFractionDigits: displayDecimals,
                        })}{" "}
                        {detailUnitSymbol}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        ≈ $
                        {(currentDepositValue * marketStats.tokenPrice).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardContent className="p-3 space-y-2">
                  {/* Utilization */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("utilization")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "utilization" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {marketStats.utilization.toFixed(2)}%
                      </span>
                    </div>
                    {expandedDetail === "utilization" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Percentage of supplied assets being borrowed.</p>
                      </div>
                    )}
                  </div>

                  {/* Collateral Factor */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("collateralFactor")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "collateralFactor" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {marketStats.collateralFactor.toFixed(0)}%
                      </span>
                    </div>
                    {expandedDetail === "collateralFactor" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Maximum borrowing power from this collateral.</p>
                      </div>
                    )}
                  </div>

                  {/* Liquidation threshold — same aggregate logic as deposit modal */}
                  {liquidationThresholdSummary && (
                    <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <button
                          onClick={() => handleToggleDetail("liquidationThreshold")}
                          type="button"
                          className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity shrink-0"
                        >
                          <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                            Liquidation threshold
                          </span>
                          <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          {expandedDetail === "liquidationThreshold" ? (
                            <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          )}
                        </button>
                        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-white">
                            {liquidationThresholdSummary.primaryPercent}%
                          </span>
                          {liquidationThresholdSummary.secondaryLine ? (
                            <span className="text-[10px] md:text-xs tabular-nums text-slate-500 dark:text-slate-400">
                              {liquidationThresholdSummary.secondaryLine}
                            </span>
                          ) : null}
                          {liquidationThresholdSummary.deltaFromPreviousPoolMin != null ? (
                            <span className="text-[10px] md:text-xs font-medium tabular-nums text-red-600 dark:text-red-400">
                              {liquidationThresholdSummary.deltaFromPreviousPoolMin > 0 ? "+" : ""}
                              {liquidationThresholdSummary.deltaFromPreviousPoolMin.toFixed(1)}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {expandedDetail === "liquidationThreshold" && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                            <p>
                              The large figure is the minimum liquidation threshold used for aggregate health in this pool (binding constraint across your supplied collateral). The line below, when shown, is this market&apos;s own threshold. Liquidation may occur if health falls to this loan-to-value level.
                            </p>
                            {poolCollateralMarkets &&
                              poolCollateralMarkets.length > 0 &&
                              poolId && (
                                <>
                                  <p className="font-medium text-slate-700 dark:text-slate-300">
                                    Your collateral in this pool
                                  </p>
                                  <div className="rounded-md border border-gray-200 dark:border-slate-600 overflow-hidden text-[10px] md:text-xs">
                                    <div className="grid grid-cols-[1fr_auto] gap-2 px-2 py-1.5 bg-slate-100/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                                      <span>Asset</span>
                                      <span className="text-right">Liq. threshold</span>
                                    </div>
                                    {poolCollateralMarkets.map((row) => (
                                      <div
                                        key={`${row.symbol}-${row.poolId}`}
                                        className={`grid grid-cols-[1fr_auto] gap-2 px-2 py-1.5 border-t border-gray-100 dark:border-slate-700/80 items-center ${
                                          row.symbol === tokenSymbol
                                            ? "bg-red-500/5 dark:bg-red-500/10"
                                            : ""
                                        }`}
                                      >
                                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate pr-1">
                                          {row.symbol}
                                          {row.symbol === tokenSymbol ? (
                                            <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">
                                              (withdrawing)
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="text-right tabular-nums text-slate-800 dark:text-slate-100">
                                          {row.liquidationThresholdPercent.toFixed(1)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pool health (est.) after this withdrawal */}
                  {!disableHealthFactorWithdrawSafety &&
                    poolGlobalUserData != null &&
                    estimatedPoolHealthMeta.value !== undefined && (
                      <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                            <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">
                              Pool health (est.)
                            </span>
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  Estimate for this lending pool after withdrawing the amount above: (collateral × pool minimum liquidation threshold) ÷ borrows, same shape as on-chain health, capped at 3.00 like Portfolio. Collateral is your current pool total minus the USD value of this withdrawal (uses oracle price when available). The colored change is percent vs your current pool health before this withdrawal.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex min-w-0 flex-col items-end gap-0.5 text-right shrink-0">
                            <span
                              className={cn(
                                "text-sm font-medium tabular-nums",
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
                            {estimatedPoolHealthMeta.deltaPercent != null ? (
                              <span
                                className={cn(
                                  "text-[10px] md:text-xs font-medium tabular-nums",
                                  estimatedPoolHealthMeta.deltaPercent > 0
                                    ? "text-green-600 dark:text-green-400"
                                    : estimatedPoolHealthMeta.deltaPercent < 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-slate-500 dark:text-slate-400"
                                )}
                              >
                                {estimatedPoolHealthMeta.deltaPercent > 0 ? "+" : ""}
                                {estimatedPoolHealthMeta.deltaPercent.toFixed(1)}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Estimated APY (adjusted after withdraw when amount entered) */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("depositAPY")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Estimated APY</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "depositAPY" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      {(() => {
                        const withdrawAmount = typeof amount === "number" && amount > 0 ? amount : 0;
                        const params = marketStats.apyParameters;
                        const totalSupply = marketStats.totalDeposits ?? 0;
                        const totalBorrow = marketStats.totalBorrows ?? 0;
                        if (withdrawAmount > 0 && params && totalSupply > 0) {
                          const newTotalSupply = Math.max(0, totalSupply - withdrawAmount);
                          const result = calculateDepositAPY(
                            { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
                            { totalScaledDeposits: newTotalSupply, totalScaledBorrows: totalBorrow, lastUpdateTime: Date.now() }
                          );
                          const currentAPY = marketStats.supplyAPY;
                          const changePercent = currentAPY > 0 ? ((result.apy - currentAPY) / currentAPY) * 100 : 0;
                          return (
                            <div className="text-right">
                              <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
                                {Math.max(0, result.apy).toFixed(2)}%
                              </div>
                              {Math.abs(changePercent) > 0.1 && (
                                <div className={`text-xs flex items-center justify-end gap-1 ${
                                  changePercent > 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                }`}>
                                  <span>{changePercent > 0 ? "↑" : "↓"}</span>
                                  <span>{changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                            {marketStats.supplyAPY.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </div>
                    {expandedDetail === "depositAPY" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {typeof amount === "number" && amount > 0
                            ? "Deposit APY after your withdrawal (based on adjusted utilization)."
                            : `Annual percentage yield for supplying ${tokenSymbol}.`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Accrued Interest */}
                  <div className="pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("accruedInterest")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Accrued Interest</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "accruedInterest" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className={`text-sm font-medium ${accruedInterest > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-800 dark:text-white"
                        }`}>
                        {accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {detailUnitSymbol}
                      </span>
                    </div>
                    {expandedDetail === "accruedInterest" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {accruedInterest > 0
                            ? `Interest earned on your supplied ${detailUnitSymbol} since deposit.`
                            : `Interest calculation for your supplied ${detailUnitSymbol} since deposit.`}
                        </p>
                        <div className="text-xs text-slate-500 dark:text-slate-500 space-y-1">
                          <p className="font-semibold">How it's calculated:</p>
                          <p>Accrued Interest = Current Deposit Value - Original Deposit Amount</p>
                          <p className="mt-1">• Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE</p>
                          <p>• Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE</p>
                          <p className="mt-1 text-slate-400 dark:text-slate-600">The deposit index increases over time as interest accrues, reflecting the growth of your deposit value.</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                          <button
                            onClick={() => setShowDebugValues(!showDebugValues)}
                            type="button"
                            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity w-full"
                          >
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Debug Values</span>
                            <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            {showDebugValues ? (
                              <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500 ml-auto" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500 ml-auto" />
                            )}
                          </button>
                          {showDebugValues && (
                            <div className="mt-2 space-y-1 text-xs font-mono text-slate-500 dark:text-slate-500">
                              <div className="flex justify-between">
                                <span>Currently Deposited:</span>
                                <span className="text-slate-700 dark:text-slate-300">{currentDepositValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Accrued Interest:</span>
                                <span className={`${accruedInterest > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-700 dark:text-slate-300"
                                  }`}>
                                  {accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 6 })} {detailUnitSymbol}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Original Deposit:</span>
                                <span className="text-slate-700 dark:text-slate-300">{originalDepositAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {detailUnitSymbol}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Interest Rate (APY):</span>
                                <span className="text-slate-700 dark:text-slate-300">{marketStats.supplyAPY.toFixed(2)}%</span>
                              </div>
                              {marketStats.scaledDeposits && (
                                <div className="flex justify-between">
                                  <span>Scaled Deposits:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{marketStats.scaledDeposits}</span>
                                </div>
                              )}
                              {marketStats.currentDepositIndex && (
                                <div className="flex justify-between">
                                  <span>Current Deposit Index:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{marketStats.currentDepositIndex}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>User Deposit Index:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                  {marketStats.userDepositIndex || "N/A"}
                                </span>
                              </div>
                              {marketStats.currentDepositIndex && marketStats.userDepositIndex && (
                                <div className="flex justify-between">
                                  <span>Index Growth:</span>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {((Number(marketStats.currentDepositIndex) / Number(marketStats.userDepositIndex) - 1) * 100).toFixed(2)}%
                                  </span>
                                </div>
                              )}
                              {marketStats.lastUpdateTime && (
                                <div className="flex justify-between">
                                  <span>Last Update Time:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                    {typeof marketStats.lastUpdateTime === 'number'
                                      ? formatRelativeTime(marketStats.lastUpdateTime)
                                      : typeof marketStats.lastUpdateTime === 'string'
                                        ? formatRelativeTimeFromISO(marketStats.lastUpdateTime)
                                        : marketStats.lastUpdateTime
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {needsWithdrawAllConfirmation && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-950/40">
                  <Checkbox
                    id="withdraw-full-confirm"
                    checked={withdrawFullPositionConfirmed}
                    onCheckedChange={(c) =>
                      setWithdrawFullPositionConfirmed(c === true)
                    }
                    className="mt-0.5 border-amber-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <Label
                    htmlFor="withdraw-full-confirm"
                    className="text-sm font-normal leading-snug text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    I understand this withdraws at least{" "}
                    {(WITHDRAW_ALL_CONFIRM_MIN_SHARE * 100).toFixed(0)}% of my
                    supplied balance for this asset (protocol withdraw-all).
                  </Label>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 flex gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading || internalLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <DorkFiButton
                variant="withdraw"
                onClick={handleSubmit}
                disabled={!canSubmitWithdraw || isLoading || internalLoading}
                className="flex-1 min-w-0 h-11 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading || internalLoading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  <span>Withdraw {effectiveAmountLabelSymbol}</span>
                )}
              </DorkFiButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog
      open={withdrawRoutePickerOpen && withdrawMultiRoute}
      onOpenChange={(open) => {
        if (withdrawMultiRoute) setWithdrawRoutePickerOpen(open);
      }}
    >
      <DialogContent className="max-h-[min(85vh,85dvh)] min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            Withdraw route
          </DialogTitle>
          <DialogDescription>
            Choose the Folks withdraw path for this market (same idea as deposit
            route selection).
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          {withdrawFolksAdapters.map((a) => {
            const sid = tokenAdapterStableId(a);
            const selected = sid === selectedWithdrawAdapterId;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSelectedWithdrawAdapterId(sid);
                  setWithdrawRoutePickerOpen(false);
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
                    {a.withdrawReceiveBasis === "market_token"
                      ? "Receive f-ASA in your wallet (no Folks redeem to native ALGO)."
                      : "Receive native ALGO (pool withdraw, then Folks redeem)."}
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
    </>
  );
};

export default WithdrawModal;
