import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import {
  ChevronsRight,
  ExternalLink,
  Info,
  Wallet,
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import type { NetworkId } from "@/config";
import {
  resolveSavingsRoute,
  savingsAccountDisplayLabel,
  consumerAssetDisplayLabel,
  isEasySavingsHighYieldAssetConfigKey,
  EASY_SAVINGS_HIGH_YIELD_ENABLED,
  easySavingsProductScope,
} from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import {
  useSavingsAccounts,
  type SavingsAccountRow,
} from "@/hooks/useSavingsAccounts";
import { cn, formatUsdAmount } from "@/lib/utils";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import DorkFiButton from "@/components/ui/DorkFiButton";
import WalletModal from "@/components/WalletModal";
import EasySavingsDepositModal from "@/components/easy-savings/EasySavingsDepositModal";
import EasySavingsWithdrawModal from "@/components/easy-savings/EasySavingsWithdrawModal";
import AccountWithdrawChooserModal from "@/components/easy-savings/AccountWithdrawChooserModal";
import LeveragedWadLpDepositModal from "@/components/easy-savings/LeveragedWadLpDepositModal";
import SimpleSavingsCalculator from "@/components/easy-savings/SimpleSavingsCalculator";
import SavingsPositionCard, {
  type PortfolioChartSeries,
} from "@/components/easy-savings/SavingsPositionCard";
import { useSavingsTransactionHistory } from "@/hooks/useSavingsTransactionHistory";
import { useSavingsUserPositions } from "@/hooks/useSavingsUserPositions";
import { useEasyStartModals } from "@/contexts/easyStartModals";
import { afterOverlayClose, useEasyStartLogin } from "@/hooks/useEasyStartLogin";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import { isLeveragedWadUsdcRoute } from "@/services/leveragedWadLpService";
import LpPairIconStack from "@/components/pools/LpPairIconStack";
import type { SavingsTxRecord } from "@/services/savingsTransactionHistory";
import {
  loadBalanceSnapshots,
  maybeAppendBalanceSnapshot,
  savingsTxRecordsToEvents,
} from "@/services/savingsBalanceHistory";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import { CASH_OUT_MIN_USD } from "@/lib/easyStart/cashOutBuckets";
import { cashOutSourceOptions } from "@/lib/easyStart/cashOutSources";
import { useToast } from "@/hooks/use-toast";
import {
  isPendingEarnFunded,
  pendingEarnSupplyAmount,
} from "@/lib/easyStart/pendingEarnDeposit";
import { usePendingEarnDeposit } from "@/hooks/usePendingEarnDeposit";
import {
  clearPendingEarnWithdraw,
  isPendingEarnWithdrawComplete,
  readPendingEarnWithdraw,
} from "@/lib/easyStart/pendingEarnWithdraw";

/** Synthetic sidebar account: native ASA USDC still in the wallet (not supplied). */
const WALLET_USDC_KEY = "WALLET_USDC";

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatApr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function formatTxWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function shortTxId(txId: string): string {
  if (txId.length <= 12) return txId;
  return `${txId.slice(0, 6)}…${txId.slice(-4)}`;
}

function txKindLabel(item: SavingsTxRecord): string {
  if (item.title) return item.title;
  if (item.kind === "deposit") return "Deposit";
  if (item.kind === "withdraw") return "Withdraw";
  if (item.kind === "borrow") return "Borrow";
  if (item.kind === "repay") return "Repay";
  return "Activity";
}

function txAssetLabel(
  item: SavingsTxRecord,
  accounts: SavingsAccountRow[],
  consumerCopy: boolean
): string {
  let label = item.symbol ?? "";
  if (!label) {
    const byKey = item.assetConfigKey
      ? accounts.find((a) => a.route.asset.configKey === item.assetConfigKey)
      : undefined;
    if (byKey) label = savingsAccountDisplayLabel(byKey.route);
    else {
      const byPool = accounts.find((a) => a.route.poolId === item.poolId);
      if (byPool) label = savingsAccountDisplayLabel(byPool.route);
    }
  }
  if (!label) return "—";
  return consumerCopy ? consumerAssetDisplayLabel(label) : label;
}

function txAmountText(
  item: SavingsTxRecord,
  consumerCopy: boolean
): string | null {
  if (!item.amount) return null;
  if (!item.symbol) return item.amount;
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(item.symbol)
    : item.symbol;
  return `${item.amount} ${symbol}`;
}

function useIsLgUp(): boolean {
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isLgUp;
}

/**
 * Easy Savings — account sidebar; empty-state hero CTA with savings calculator,
 * or funded balance summary with position charts. Deposit opens a signed supply modal.
 */
const SavingsCard = () => {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const { activeAccount } = useDorkFiWalletAdapter();
  const isLgUp = useIsLgUp();
  const privy = usePrivyEasyStart();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const savingsScope = easySavingsProductScope(consumerCopy);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawChooserOpen, setWithdrawChooserOpen] = useState(false);
  /** Bumps after a pending Earn → Base job is cleared or the withdraw modal closes. */
  const [outboundRev, setOutboundRev] = useState(0);
  /** USDC/WAD: false = leveraged mint+supply, true = plain LP supply */
  const [plainLpSupply, setPlainLpSupply] = useState(false);

  const { core: coreAccounts, highYield: highYieldAccounts, all: accounts } =
    useSavingsAccounts(networkId);
  const [assetKey, setAssetKey] = useState<string>("");
  const {
    openDeposit: openEasyStartCashDeposit,
    openWithdraw: openEasyStartCashOut,
  } = useEasyStartModals();
  const openEasyStartLogin = useEasyStartLogin();
  const openConnect = () => {
    if (consumerCopy) {
      void openEasyStartLogin();
      return;
    }
    setWalletModalOpen(true);
  };

  /** USDC savings market — also backs the Wallet balance account (deposit target). */
  const usdcRoute = useMemo(
    () =>
      resolveSavingsRoute({
        networkId,
        assetConfigKey: "USDC",
        scope: savingsScope,
      }),
    [networkId, savingsScope]
  );

  const {
    positions: userPositions,
    coreDepositUsd,
    highYieldDepositUsd,
    coreEarnedUsd,
    highYieldEarnedUsd,
    weightedApy: positionsWeightedApy,
    isLoading: positionsLoading,
  } = useSavingsUserPositions(
    networkId,
    activeAccount?.address,
    accounts
  );

  const usdcQuote = useEasySavingsQuote({
    networkId,
    route: usdcRoute,
    amount: "",
  });

  /** Easy Start Base USDC (staging before bridge to Algorand). */
  const evmAddress = (privy.evmAddress ?? null) as Address | null;
  const {
    data: baseUsdcData,
    isLoading: baseUsdcLoading,
    isError: baseUsdcError,
  } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: Boolean(evmAddress),
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: 2,
  });

  const walletUsdcAlgo =
    activeAccount && usdcQuote.walletBalance != null
      ? Math.max(0, usdcQuote.walletBalance)
      : null;

  const walletUsdcBase = (() => {
    if (!evmAddress || baseUsdcError || baseUsdcData == null) return null;
    const n = Number.parseFloat(baseUsdcData.formatted);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  })();

  /** Combined undeposited USDC (Algorand wallet + Base Easy Start staging). */
  const walletUsdc =
    walletUsdcAlgo != null || walletUsdcBase != null
      ? (walletUsdcAlgo ?? 0) + (walletUsdcBase ?? 0)
      : null;

  const priceForWallet =
    usdcQuote.price != null && usdcQuote.price > 0 ? usdcQuote.price : 1;

  const walletUsdcUsd =
    walletUsdc != null ? walletUsdc * priceForWallet : 0;
  const walletUsdcAlgoUsd =
    walletUsdcAlgo != null ? walletUsdcAlgo * priceForWallet : 0;
  const walletUsdcBaseUsd =
    walletUsdcBase != null ? walletUsdcBase * priceForWallet : 0;

  const pendingWithdraw = useMemo(
    () => readPendingEarnWithdraw(activeAccount?.address),
    [activeAccount?.address, outboundRev]
  );
  const pendingEarnJob = usePendingEarnDeposit(activeAccount?.address);

  useEffect(() => {
    if (!pendingWithdraw || walletUsdcBase == null) return;
    if (!isPendingEarnWithdrawComplete(pendingWithdraw, walletUsdcBase)) return;
    clearPendingEarnWithdraw();
    setOutboundRev((n) => n + 1);
    toast({
      title: consumerCopy ? "Back in your account" : "On Base",
      description: consumerCopy
        ? "The move from Earn finished."
        : "The Algorand to Base swap finished.",
    });
  }, [pendingWithdraw, walletUsdcBase, toast, consumerCopy]);

  const hasWalletUsdc = walletUsdc != null && walletUsdc > 1e-9;
  const hasBaseUsdc = walletUsdcBase != null && walletUsdcBase > 1e-9;
  /** Cash out can start from Base, Earn, or leftover Algorand USDC. */
  const canCashOut =
    cashOutSourceOptions({
      baseUsd: walletUsdcBase ?? 0,
      earnUsd: coreDepositUsd,
      algorandUsd: walletUsdcAlgo ?? 0,
    }).length > 0;
  const walletBalanceLoading =
    (Boolean(activeAccount) &&
      usdcQuote.isLoading &&
      walletUsdcAlgo == null) ||
    (Boolean(evmAddress) && baseUsdcLoading && walletUsdcBase == null);

  const effectiveAssetKey = (() => {
    // Phones have no account switcher, so the portfolio card stays on screen.
    if (!isLgUp && (activeAccount || evmAddress)) return WALLET_USDC_KEY;
    if (assetKey === WALLET_USDC_KEY) return WALLET_USDC_KEY;
    if (assetKey && accounts.some((a) => a.route.asset.configKey === assetKey)) {
      return assetKey;
    }
    // Prefer wallet cash when user has undeposited USDC and no explicit selection.
    if (!assetKey && hasWalletUsdc) return WALLET_USDC_KEY;
    return accounts[0]?.route.asset.configKey ?? "";
  })();

  const isWalletAccount = effectiveAssetKey === WALLET_USDC_KEY;
  const isUsdcSavings = effectiveAssetKey === "USDC";

  const selectedAccount =
    !isWalletAccount
      ? accounts.find((a) => a.route.asset.configKey === effectiveAssetKey) ??
        accounts[0] ??
        null
      : null;

  const isHighYield =
    !isWalletAccount && isEasySavingsHighYieldAssetConfigKey(effectiveAssetKey);
  const isLeveragedWadUsdc =
    !isWalletAccount && isLeveragedWadUsdcRoute(effectiveAssetKey);

  const route: SavingsRoute | null = useMemo(() => {
    if (isWalletAccount) return usdcRoute;
    if (!effectiveAssetKey) return null;
    return resolveSavingsRoute({
      networkId,
      assetConfigKey: effectiveAssetKey,
      scope: savingsScope,
    });
  }, [networkId, effectiveAssetKey, isWalletAccount, usdcRoute, savingsScope]);

  // Same USDC market data when viewing wallet cash (avoids a second market query).
  const quote = useEasySavingsQuote({
    networkId,
    route: isWalletAccount || isUsdcSavings ? null : route,
    amount: "",
  });

  // When viewing wallet / USDC market, reuse live usdc quote for deposit data.
  const activeQuote =
    isWalletAccount || isUsdcSavings ? usdcQuote : quote;

  const marketApy =
    activeQuote.supplyApyPercent ?? selectedAccount?.apy ?? null;

  const symbol = isWalletAccount
    ? consumerCopy
      ? "USD"
      : "USDC"
    : route
      ? consumerCopy
        ? consumerAssetDisplayLabel(savingsAccountDisplayLabel(route))
        : savingsAccountDisplayLabel(route)
      : effectiveAssetKey || "—";

  /** Supply-only on savings markets; undeposited cash on wallet tab (portfolio chart uses portfolioTotalUsd). */
  const chartBalanceUsd = (() => {
    const depositUsd =
      activeQuote.existingDepositUsd > 0
        ? activeQuote.existingDepositUsd
        : activeQuote.existingDeposit != null && activeQuote.price != null
          ? activeQuote.existingDeposit * activeQuote.price
          : activeQuote.existingDeposit ?? 0;
    if (isWalletAccount) return walletUsdcUsd;
    return Math.max(0, depositUsd);
  })();

  const apy = (() => {
    if (isWalletAccount) return hasWalletUsdc ? 0 : marketApy;
    return marketApy;
  })();

  const hasSupplyPosition =
    Boolean(activeAccount) &&
    activeQuote.existingDeposit != null &&
    activeQuote.existingDeposit > 0;

  const hasAnySavingsDeposit = userPositions.some((p) => p.deposit > 1e-12);

  /** Portfolio USD when viewing the Wallet balances account. */
  const portfolioCashOutUsd = Math.max(0, walletUsdcBaseUsd);
  const portfolioAlgorandUsd = Math.max(0, walletUsdcAlgoUsd);
  /** Undeposited USDC on both chains. Cash out spends only the Base portion. */
  const portfolioWalletUsd = portfolioCashOutUsd + portfolioAlgorandUsd;
  const portfolioSavingsUsd = Math.max(0, coreDepositUsd);
  const portfolioHigherYieldUsd = Math.max(0, highYieldDepositUsd);
  const portfolioTotalUsd =
    portfolioWalletUsd + portfolioSavingsUsd + portfolioHigherYieldUsd;
  const portfolioEarnedUsd = coreEarnedUsd + highYieldEarnedUsd;

  const {
    items: marketTxHistory,
    isLoading: marketTxHistoryLoading,
    recordTx: recordTxBase,
    refresh: refreshMarketTxHistory,
  } = useSavingsTransactionHistory({
    networkId,
    address: activeAccount?.address,
    poolId: route?.poolId ?? null,
    enabled: Boolean(activeAccount?.address && route?.poolId && !isWalletAccount),
  });

  const allPoolIds = useMemo(
    () =>
      Array.from(
        new Set(accounts.map((a) => a.route.poolId).filter(Boolean))
      ),
    [accounts]
  );

  const {
    items: allPoolsTxHistory,
    isLoading: allPoolsTxHistoryLoading,
    refresh: refreshAllPoolsTxHistory,
  } = useSavingsTransactionHistory({
    networkId,
    address: activeAccount?.address,
    allPools: true,
    poolIds: allPoolIds,
    enabled: Boolean(activeAccount?.address),
  });

  const txHistory = isWalletAccount ? allPoolsTxHistory : marketTxHistory;
  const txHistoryLoading = isWalletAccount
    ? allPoolsTxHistoryLoading
    : marketTxHistoryLoading;

  /** Bumps after snapshot writes so chart series re-load from localStorage. */
  const [snapshotRev, setSnapshotRev] = useState(0);

  const priceByAssetKey = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const p of userPositions) {
      map[p.route.asset.configKey] = p.price;
    }
    if (effectiveAssetKey && activeQuote.price != null) {
      map[effectiveAssetKey] = activeQuote.price;
    }
    if (usdcRoute && usdcQuote.price != null) {
      map[usdcRoute.asset.configKey] = usdcQuote.price;
    }
    return map;
  }, [
    userPositions,
    effectiveAssetKey,
    activeQuote.price,
    usdcRoute,
    usdcQuote.price,
  ]);

  const historyEvents = useMemo(() => {
    return savingsTxRecordsToEvents(txHistory, priceByAssetKey).map((e) => {
      const key = e.assetConfigKey ?? "";
      const isHy = key
        ? isEasySavingsHighYieldAssetConfigKey(key)
        : false;
      return {
        ...e,
        scope: isHy ? ("high_yield" as const) : ("core" as const),
      };
    });
  }, [txHistory, priceByAssetKey]);

  const marketHistoryEvents = useMemo(() => {
    if (isWalletAccount || !effectiveAssetKey) return historyEvents;
    return historyEvents.filter(
      (e) => !e.assetConfigKey || e.assetConfigKey === effectiveAssetKey
    );
  }, [historyEvents, isWalletAccount, effectiveAssetKey]);

  const coreEvents = useMemo(
    () => historyEvents.filter((e) => e.scope !== "high_yield"),
    [historyEvents]
  );
  const highYieldEvents = useMemo(
    () => historyEvents.filter((e) => e.scope === "high_yield"),
    [historyEvents]
  );

  const marketSeriesKey = route?.poolId ?? "";
  const marketSnapshots = useMemo(() => {
    if (!activeAccount?.address || !marketSeriesKey || isWalletAccount) {
      return [] as Array<{ timestamp: number; balanceUsd: number }>;
    }
    return loadBalanceSnapshots({
      networkId,
      address: activeAccount.address,
      seriesKey: marketSeriesKey,
    }).map((s) => ({
      timestamp: s.timestamp,
      balanceUsd: s.balanceUsd,
    }));
  }, [
    snapshotRev,
    marketSeriesKey,
    isWalletAccount,
    networkId,
    activeAccount?.address,
  ]);

  const portfolioSnapshots = useMemo(() => {
    if (!activeAccount?.address) {
      return {
        total: [] as Array<{ timestamp: number; balanceUsd: number }>,
        wallet: [] as Array<{ timestamp: number; balanceUsd: number }>,
        cash_out: [] as Array<{ timestamp: number; balanceUsd: number }>,
        algorand: [] as Array<{ timestamp: number; balanceUsd: number }>,
        savings: [] as Array<{ timestamp: number; balanceUsd: number }>,
        higher_yield: [] as Array<{ timestamp: number; balanceUsd: number }>,
      };
    }
    const mapKey = (seriesKey: string) =>
      loadBalanceSnapshots({
        networkId,
        address: activeAccount.address,
        seriesKey,
      }).map((s) => ({
        timestamp: s.timestamp,
        balanceUsd: s.balanceUsd,
      }));
    return {
      total: mapKey("portfolio"),
      wallet: mapKey("wallet"),
      cash_out: mapKey("cash_out"),
      algorand: mapKey("algorand_wallet"),
      savings: mapKey("savings"),
      higher_yield: mapKey("higher_yield"),
    };
  }, [snapshotRev, networkId, activeAccount?.address]);

  // Sample live balances so the chart gains real points over time / after txs.
  useEffect(() => {
    const address = activeAccount?.address;
    if (!address) return;

    const write = (seriesKey: string, balanceUsd: number) => {
      if (!Number.isFinite(balanceUsd)) return;
      const wrote = maybeAppendBalanceSnapshot({
        networkId,
        address,
        seriesKey,
        balanceUsd,
      });
      if (wrote) setSnapshotRev((n) => n + 1);
    };

    // Portfolio keys always (even while browsing a market) so Total / Wallet series grow.
    write("portfolio", portfolioTotalUsd);
    write("wallet", portfolioWalletUsd);
    write("cash_out", portfolioCashOutUsd);
    write("algorand_wallet", portfolioAlgorandUsd);
    write("savings", portfolioSavingsUsd);
    write("higher_yield", portfolioHigherYieldUsd);

    if (!isWalletAccount && route?.poolId && !activeQuote.isLoading) {
      write(route.poolId, chartBalanceUsd);
    }
  }, [
    activeAccount?.address,
    networkId,
    isWalletAccount,
    portfolioTotalUsd,
    portfolioWalletUsd,
    portfolioCashOutUsd,
    portfolioAlgorandUsd,
    portfolioSavingsUsd,
    portfolioHigherYieldUsd,
    route?.poolId,
    chartBalanceUsd,
    activeQuote.isLoading,
  ]);

  const recordTx = (
    input: Parameters<typeof recordTxBase>[0] & { balanceAfterUsd?: number }
  ) => {
    recordTxBase(input);
    void refreshMarketTxHistory();
    void refreshAllPoolsTxHistory();
    if (
      activeAccount?.address &&
      input.balanceAfterUsd != null &&
      Number.isFinite(input.balanceAfterUsd)
    ) {
      const wrote = maybeAppendBalanceSnapshot({
        networkId,
        address: activeAccount.address,
        seriesKey: input.poolId,
        balanceUsd: input.balanceAfterUsd,
        force: true,
      });
      if (wrote) setSnapshotRev((n) => n + 1);
    }
    if (activeAccount?.address) {
      maybeAppendBalanceSnapshot({
        networkId,
        address: activeAccount.address,
        seriesKey: "portfolio",
        balanceUsd: portfolioTotalUsd,
        force: true,
      });
      setSnapshotRev((n) => n + 1);
    }
  };

  const logo =
    usdcRoute?.asset.logoPath ||
    route?.asset.logoPath ||
    getTokenImagePath(route?.asset.symbol ?? "USDC") ||
    "/placeholder.svg";

  const balanceLabel = !activeAccount
    ? "—"
    : isWalletAccount
      ? walletUsdc != null
        ? formatToken(walletUsdc)
        : "—"
      : activeQuote.walletBalance != null
        ? formatToken(activeQuote.walletBalance)
        : "—";

  const depositAmountLabel =
    activeAccount &&
    activeQuote.existingDeposit != null &&
    activeQuote.existingDeposit > 0
      ? formatToken(activeQuote.existingDeposit)
      : activeAccount
        ? "0"
        : "—";

  const earnedLabel =
    activeAccount &&
    activeQuote.earnedInterest != null &&
    activeQuote.earnedInterest > 0
      ? formatToken(activeQuote.earnedInterest)
      : activeAccount
        ? "0"
        : "—";

  const portfolioChartSeries = useMemo((): PortfolioChartSeries[] => {
    const weighted = (
      filter: (p: (typeof userPositions)[number]) => boolean
    ): number | null => {
      let weight = 0;
      let sum = 0;
      for (const p of userPositions) {
        if (!filter(p)) continue;
        if (p.depositUsd <= 0 || p.apy == null || !Number.isFinite(p.apy)) {
          continue;
        }
        sum += p.depositUsd * p.apy;
        weight += p.depositUsd;
      }
      if (weight <= 0) return null;
      return sum / weight;
    };

    const savingsApy = weighted((p) => !p.isHighYield);
    const depositWeight = portfolioSavingsUsd + portfolioHigherYieldUsd;
    const totalApy =
      portfolioTotalUsd > 0 && depositWeight > 0 && positionsWeightedApy != null
        ? (depositWeight * positionsWeightedApy) / portfolioTotalUsd
        : portfolioTotalUsd > 0 && depositWeight <= 0
          ? 0
          : positionsWeightedApy;

    const series: PortfolioChartSeries[] = [
      {
        id: "total",
        label: "Total Balance",
        balanceUsd: portfolioTotalUsd,
        apyPercent: totalApy,
        earnedInterestUsd: portfolioEarnedUsd,
        historyEvents,
        historySnapshots: portfolioSnapshots.total,
      },
      {
        id: consumerCopy ? "cash_out" : "wallet",
        label: consumerCopy ? "Ready to cash out" : "Transferrable",
        balanceUsd: portfolioCashOutUsd,
        apyPercent: portfolioCashOutUsd > 0 ? 0 : null,
        earnedInterestUsd: 0,
        historyEvents: [],
        historySnapshots: portfolioSnapshots.cash_out,
      },
      {
        id: "algorand",
        label: consumerCopy ? "Available to move" : "On Algorand",
        balanceUsd: portfolioAlgorandUsd,
        apyPercent: portfolioAlgorandUsd > 0 ? 0 : null,
        earnedInterestUsd: 0,
        historyEvents: [],
        historySnapshots: portfolioSnapshots.algorand,
      },
      {
        id: "savings",
        label: "Earning",
        balanceUsd: portfolioSavingsUsd,
        apyPercent: savingsApy,
        earnedInterestUsd: coreEarnedUsd,
        historyEvents: coreEvents,
        historySnapshots: portfolioSnapshots.savings,
      },
    ];

    if (EASY_SAVINGS_HIGH_YIELD_ENABLED && !consumerCopy) {
      series.push({
        id: "higher_yield",
        label: "Higher Yield",
        balanceUsd: portfolioHigherYieldUsd,
        apyPercent: weighted((p) => p.isHighYield),
        earnedInterestUsd: highYieldEarnedUsd,
        historyEvents: highYieldEvents,
        historySnapshots: portfolioSnapshots.higher_yield,
      });
    }

    return series;
  }, [
    consumerCopy,
    portfolioTotalUsd,
    portfolioCashOutUsd,
    portfolioAlgorandUsd,
    portfolioSavingsUsd,
    portfolioHigherYieldUsd,
    portfolioEarnedUsd,
    coreEarnedUsd,
    highYieldEarnedUsd,
    positionsWeightedApy,
    userPositions,
    historyEvents,
    coreEvents,
    highYieldEvents,
    portfolioSnapshots,
  ]);

  /** Avoid flashing $0.00 on Earn while the deposit query is still in flight. */
  const earnBalancePending =
    !isWalletAccount &&
    Boolean(activeAccount) &&
    activeQuote.existingDeposit == null &&
    activeQuote.isLoading;

  /** Funded view: supply position and/or wallet cash (for wallet / USDC accounts). */
  const hasPosition =
    Boolean(activeAccount || evmAddress) &&
    (isWalletAccount
      ? hasWalletUsdc || hasAnySavingsDeposit
      : isUsdcSavings
        ? hasSupplyPosition || hasWalletUsdc
        : hasSupplyPosition);

  /** Avoid flashing the marketing hero while deposit balance is still loading. */
  const showEmptyHero =
    !hasPosition &&
    !(
      Boolean(activeAccount || evmAddress) &&
      (activeQuote.isLoading ||
        walletBalanceLoading ||
        (isWalletAccount && positionsLoading))
    );

  const pendingEarnLeftover =
    pendingEarnJob && walletUsdcAlgo != null
      ? pendingEarnSupplyAmount(pendingEarnJob, walletUsdcAlgo)
      : 0;
  const pendingEarnReady = Boolean(
    pendingEarnJob &&
      walletUsdcAlgo != null &&
      (isPendingEarnFunded(pendingEarnJob, walletUsdcAlgo) ||
        walletUsdcAlgo >= pendingEarnJob.wantedAmount - 0.01)
  );
  const showPendingEarnBanner = Boolean(
    pendingEarnJob &&
      (pendingEarnReady
        ? pendingEarnLeftover > 0.01
        : Boolean(pendingEarnJob.fromTxId))
  );

  const openDeposit = (opts?: {
    plainLp?: boolean;
    assetConfigKey?: string;
  }) => {
    if (!activeAccount) {
      openConnect();
      return;
    }
    if (opts?.assetConfigKey) {
      setAssetKey(opts.assetConfigKey);
    }
    setPlainLpSupply(Boolean(opts?.plainLp));
    setWithdrawOpen(false);
    setWithdrawChooserOpen(false);
    setDepositOpen(true);
  };

  const openResumeEarnWithdraw = () => {
    if (!activeAccount) {
      openConnect();
      return;
    }
    setAssetKey(usdcRoute?.asset.configKey ?? "USDC");
    setPlainLpSupply(false);
    setDepositOpen(false);
    setWithdrawChooserOpen(false);
    setWithdrawOpen(true);
  };

  const openWithdraw = () => {
    if (!activeAccount) {
      openConnect();
      return;
    }
    if (
      pendingWithdraw &&
      (isWalletAccount || effectiveAssetKey === "USDC" || !hasAnySavingsDeposit)
    ) {
      openResumeEarnWithdraw();
      return;
    }
    if (isWalletAccount) {
      const withDeposit = userPositions.find((p) => p.deposit > 1e-12);
      if (!withDeposit) {
        openDeposit({
          assetConfigKey: usdcRoute?.asset.configKey ?? "USDC",
        });
        return;
      }
      setAssetKey(withDeposit.route.asset.configKey);
    }
    setDepositOpen(false);
    setWithdrawChooserOpen(false);
    setWithdrawOpen(true);
  };

  const openAccountWithdrawChooser = () => {
    if (!activeAccount && !evmAddress) {
      openConnect();
      return;
    }
    setDepositOpen(false);
    setWithdrawOpen(false);
    setWithdrawChooserOpen(true);
  };

  const renderWalletBalanceRow = () => {
    const active = isWalletAccount;
    const usdcLogo =
      usdcRoute?.asset.logoPath ||
      getTokenImagePath("USDC") ||
      "/lovable-uploads/USDC.webp";
    const totalLoading =
      walletBalanceLoading ||
      (Boolean(activeAccount) && positionsLoading);
    return (
      <button
        key={WALLET_USDC_KEY}
        type="button"
        onClick={() => {
          setAssetKey(WALLET_USDC_KEY);
          setDepositOpen(false);
          setWithdrawOpen(false);
          setWithdrawChooserOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-sm shadow-sm transition-colors",
          active
            ? "border-ocean-teal ring-2 ring-ocean-teal/40"
            : "border-border/60 hover:bg-muted/40"
        )}
      >
        <span className="relative shrink-0">
          <img src={usdcLogo} alt="" className="size-7 rounded-full" />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-muted ring-1 ring-background">
            <Wallet className="size-2.5 text-muted-foreground" aria-hidden />
          </span>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-medium truncate">Account Balance</span>
        </span>
        <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
          {!activeAccount && !evmAddress
            ? "—"
            : totalLoading
              ? "…"
              : formatUsdAmount(portfolioTotalUsd)}
        </span>
      </button>
    );
  };

  const renderAccountRow = (row: SavingsAccountRow) => {
    const active = row.route.asset.configKey === effectiveAssetKey;
    const label =
      row.route.asset.configKey === "USDC"
        ? "Earn"
        : consumerCopy &&
            (isLeveragedWadUsdcRoute(row.route.asset.configKey) ||
              isEasySavingsHighYieldAssetConfigKey(row.route.asset.configKey))
          ? "Higher yield"
          : savingsAccountDisplayLabel(row.route);
    const isWadUsdc = isLeveragedWadUsdcRoute(row.route.asset.configKey);
    const rowLogo =
      row.route.asset.logoPath ||
      getTokenImagePath(row.route.asset.symbol) ||
      "/placeholder.svg";
    return (
      <button
        key={row.route.asset.configKey}
        type="button"
        onClick={() => {
          setAssetKey(row.route.asset.configKey);
          setDepositOpen(false);
          setWithdrawOpen(false);
          setWithdrawChooserOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-sm shadow-sm transition-colors",
          active
            ? row.isHighYield
              ? "border-whale-gold ring-2 ring-whale-gold/40"
              : "border-ocean-teal ring-2 ring-ocean-teal/40"
            : "border-border/60 hover:bg-muted/40",
          row.isHighYield && !active && "bg-whale-gold/5"
        )}
      >
        {isWadUsdc ? (
          <LpPairIconStack
            asset1Icon={getTokenImagePath("WAD")}
            asset2Icon="/lovable-uploads/USDC.webp"
            fallbackIcon="/lovable-uploads/LP_TMPOOL2_WAD_USDC_pair.png"
            size="sm"
            alt={label}
          />
        ) : (
          <img src={rowLogo} alt="" className="size-7 rounded-full" />
        )}
        <span className="font-medium text-left min-w-0 truncate">{label}</span>
        <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
          {row.isLoading ? "…" : formatApr(row.apy)}
        </span>
      </button>
    );
  };

  return (
    <section className="w-full max-w-6xl mx-auto">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        {/* Left side widget */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <h1 className="flex items-center gap-2 text-4xl sm:text-5xl font-semibold tracking-tight">
            Savings
            <span
              className="text-muted-foreground"
              title={
                consumerCopy
                  ? "Deposit to earn yield."
                  : "Supply assets to earn a transparent APY."
              }
            >
              <Info className="size-4" />
            </span>
          </h1>

          <div className="hidden lg:block">
            <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              Savings accounts
              <Info className="size-3.5" />
            </p>
            <div className="space-y-3">
              {activeAccount || evmAddress ? renderWalletBalanceRow() : null}
              {coreAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  No savings available right now.
                </p>
              ) : (
                coreAccounts.map(renderAccountRow)
              )}
            </div>
          </div>

          {highYieldAccounts.length > 0 && !consumerCopy ? (
            <div className="hidden lg:block">
              <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                Higher-yield Opportunities
                <span
                  title={
                    consumerCopy
                      ? "Higher yield, higher risk."
                      : "Pooled LP markets with higher yield and higher risk."
                  }
                >
                  <Info className="size-3.5" />
                </span>
              </p>
              <div className="space-y-3">
                {highYieldAccounts.map(renderAccountRow)}
              </div>
            </div>
          ) : null}
        </aside>

        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {showPendingEarnBanner ? (
            <div className="rounded-2xl border border-ocean-teal/40 bg-ocean-teal/5 px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">
                {consumerCopy
                  ? pendingEarnReady
                    ? `Finish depositing ${formatToken(pendingEarnLeftover)} into Earn.`
                    : "Your USDC move is still finishing. Keep this tab open."
                  : pendingEarnReady
                    ? `Finish supplying ${formatToken(pendingEarnLeftover)} USDC.`
                    : "XO Swap is still settling. Keep this tab open."}
              </p>
              <DorkFiButton
                className="mt-3 h-10 rounded-full px-4"
                onClick={() =>
                  openDeposit({
                    assetConfigKey: usdcRoute?.asset.configKey ?? "USDC",
                  })
                }
              >
                {pendingEarnReady
                  ? consumerCopy
                    ? "Finish deposit"
                    : "Finish supply"
                  : consumerCopy
                    ? "Check status"
                    : "Resume"}
              </DorkFiButton>
            </div>
          ) : null}
          {pendingWithdraw ? (
            <div className="rounded-2xl border border-ocean-teal/40 bg-ocean-teal/5 px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">
                Funds left Earn. Finish moving them to your account.
              </p>
              <DorkFiButton
                className="mt-3 h-10 rounded-full px-4"
                onClick={openResumeEarnWithdraw}
              >
                {pendingWithdraw.fromTxId || pendingWithdraw.orderId
                  ? consumerCopy
                    ? "Check status"
                    : "Resume"
                  : consumerCopy
                    ? "Finish move"
                    : "Resume swap"}
              </DorkFiButton>
            </div>
          ) : null}
          {hasPosition ? (
            <>
              <SavingsPositionCard
                balanceUsd={
                  isWalletAccount ? portfolioTotalUsd : chartBalanceUsd
                }
                title={isWalletAccount ? "Portfolio Balance" : undefined}
                isLoading={earnBalancePending}
                chartSeries={isWalletAccount ? portfolioChartSeries : undefined}
                historyEvents={
                  isWalletAccount ? undefined : marketHistoryEvents
                }
                historySnapshots={
                  isWalletAccount ? undefined : marketSnapshots
                }
                balanceLabel={
                  isWalletAccount
                    ? undefined
                    : chartBalanceUsd > 0 && !activeQuote.price
                      ? activeQuote.existingDeposit != null
                        ? `${formatToken(activeQuote.existingDeposit)} ${symbol}`
                        : undefined
                      : undefined
                }
                apyPercent={
                  isWalletAccount
                    ? portfolioChartSeries[0]?.apyPercent ?? 0
                    : apy
                }
                earnedInterestUsd={
                  isWalletAccount
                    ? portfolioEarnedUsd
                    : activeQuote.earnedInterestUsd
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <DorkFiButton
                  className="rounded-full h-12 w-full min-w-0 text-base"
                  onClick={() => openDeposit()}
                >
                  {isLeveragedWadUsdc && !consumerCopy && !isWalletAccount
                    ? "Open position"
                    : "Deposit to Earn"}
                </DorkFiButton>
                <DorkFiButton
                  variant="secondary"
                  className="rounded-full h-12 w-full min-w-0 text-base"
                  onClick={
                    isWalletAccount ? openAccountWithdrawChooser : openWithdraw
                  }
                  disabled={
                    isWalletAccount
                      ? !hasAnySavingsDeposit && !canCashOut && !pendingWithdraw
                      : false
                  }
                >
                  {isWalletAccount
                    ? !hasAnySavingsDeposit && !canCashOut && !pendingWithdraw
                      ? consumerCopy
                        ? "Nothing to withdraw"
                        : "Not supplied"
                      : "Withdraw"
                    : "Withdraw from Earn"}
                </DorkFiButton>
              </div>
              {isLeveragedWadUsdc && !consumerCopy ? (
                <button
                  type="button"
                  onClick={() => openDeposit({ plainLp: true })}
                  className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Supply existing LP
                </button>
              ) : null}

              {isWalletAccount ? (
                <section className="hidden rounded-[28px] border border-border/60 bg-card p-5 sm:block sm:p-6 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    {consumerCopy ? "Savings account" : "Portfolio assets"}
                  </h2>
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-3 font-medium">Asset</th>
                          <th className="pb-3 font-medium">Balance</th>
                          <th className="pb-3 font-medium">Deposit amount</th>
                          <th className="pb-3 font-medium">Earned</th>
                          <th className="pb-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {/* Cash-out balance is Base only. Algorand wallet USDC is a separate row. */}
                        <tr className="border-b border-border/40">
                          <td className="py-4">
                            <span className="flex items-center gap-2 font-medium">
                              <span className="relative shrink-0">
                                <img
                                  src={logo}
                                  alt=""
                                  className="size-6 rounded-full"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-muted ring-1 ring-background">
                                  <Wallet
                                    className="size-2 text-muted-foreground"
                                    aria-hidden
                                  />
                                </span>
                              </span>
                              {consumerCopy ? "Ready to cash out" : "USDC"}
                              <span className="text-xs font-normal text-muted-foreground">
                                {consumerCopy ? "Base" : "Algorand"}
                              </span>
                            </span>
                          </td>
                          <td className="py-4 text-muted-foreground tabular-nums">
                            {consumerCopy
                              ? baseUsdcLoading && walletUsdcBase == null
                                ? "…"
                                : walletUsdcBase != null
                                  ? formatToken(walletUsdcBase)
                                  : evmAddress
                                    ? "0"
                                    : "—"
                              : walletUsdcAlgo != null
                                ? formatToken(walletUsdcAlgo)
                                : activeAccount
                                  ? usdcQuote.isLoading
                                    ? "…"
                                    : "0"
                                  : "—"}
                          </td>
                          <td className="py-4 tabular-nums">—</td>
                          <td className="py-4 tabular-nums text-muted-foreground">
                            —
                          </td>
                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                openDeposit({
                                  assetConfigKey:
                                    usdcRoute?.asset.configKey ?? "USDC",
                                })
                              }
                              className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                            >
                              Deposit
                            </button>
                          </td>
                        </tr>

                        {consumerCopy ? (
                          <tr className="border-b border-border/40">
                            <td className="py-4">
                              <span className="flex items-center gap-2 font-medium">
                                <img
                                  src={logo}
                                  alt=""
                                  className="size-6 rounded-full"
                                />
                                Available to move
                                <span className="text-xs font-normal text-muted-foreground">
                                  Not in Earn
                                </span>
                              </span>
                            </td>
                            <td className="py-4 text-muted-foreground tabular-nums">
                              {walletUsdcAlgo != null
                                ? formatToken(walletUsdcAlgo)
                                : activeAccount
                                  ? usdcQuote.isLoading
                                    ? "…"
                                    : "0"
                                  : "—"}
                            </td>
                            <td className="py-4 tabular-nums">—</td>
                            <td className="py-4 tabular-nums text-muted-foreground">
                              —
                            </td>
                            <td className="py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openDeposit({
                                    assetConfigKey:
                                      usdcRoute?.asset.configKey ?? "USDC",
                                  })
                                }
                                className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                              >
                                Deposit
                              </button>
                            </td>
                          </tr>
                        ) : null}

                        {/* Base Easy Start USDC — bridge before supply */}
                        {evmAddress && !consumerCopy ? (
                          <tr className="border-b border-border/40">
                            <td className="py-4">
                              <span className="flex items-center gap-2 font-medium">
                                <img
                                  src={logo}
                                  alt=""
                                  className="size-6 rounded-full"
                                />
                                USDC
                                <span className="text-xs font-normal text-muted-foreground">
                                  Base
                                </span>
                              </span>
                            </td>
                            <td className="py-4 text-muted-foreground tabular-nums">
                              {baseUsdcLoading && walletUsdcBase == null
                                ? "…"
                                : walletUsdcBase != null
                                  ? formatToken(walletUsdcBase)
                                  : "0"}
                            </td>
                            <td className="py-4 tabular-nums">—</td>
                            <td className="py-4 tabular-nums text-muted-foreground">
                              —
                            </td>
                            <td className="py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openDeposit({
                                    assetConfigKey:
                                      usdcRoute?.asset.configKey ?? "USDC",
                                  })
                                }
                                className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                              >
                                Deposit to Earn
                              </button>
                            </td>
                          </tr>
                        ) : null}

                        {userPositions.map((pos) => {
                          const cfg = pos.route.asset.configKey;
                          const isWad = isLeveragedWadUsdcRoute(cfg);
                          const rowLogo =
                            pos.route.asset.logoPath ||
                            getTokenImagePath(pos.route.asset.symbol) ||
                            "/placeholder.svg";
                          return (
                            <tr
                              key={cfg}
                              className="border-b border-border/40 last:border-0"
                            >
                              <td className="py-4">
                                <span className="flex items-center gap-2 font-medium">
                                  {isWad ? (
                                    <LpPairIconStack
                                      asset1Icon={getTokenImagePath("WAD")}
                                      asset2Icon="/lovable-uploads/USDC.webp"
                                      fallbackIcon="/lovable-uploads/LP_TMPOOL2_WAD_USDC_pair.png"
                                      size="sm"
                                      alt={
                                        consumerCopy && isWad
                                          ? "Higher yield"
                                          : consumerCopy && cfg === "USDC"
                                            ? "Earning"
                                            : pos.label
                                      }
                                    />
                                  ) : (
                                    <img
                                      src={rowLogo}
                                      alt=""
                                      className="size-6 rounded-full"
                                    />
                                  )}
                                  {consumerCopy && isWad
                                    ? "Higher yield"
                                    : consumerCopy && cfg === "USDC"
                                      ? "Earning"
                                      : pos.label}
                                  {pos.isHighYield ? (
                                    <span className="text-xs font-normal text-whale-gold">
                                      Higher yield
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="py-4 text-muted-foreground tabular-nums">
                                {consumerCopy && cfg === "USDC"
                                  ? "—"
                                  : pos.isLoading
                                    ? "…"
                                    : pos.walletBalance != null
                                      ? formatToken(pos.walletBalance)
                                      : "—"}
                              </td>
                              <td className="py-4 tabular-nums">
                                {pos.isLoading
                                  ? "…"
                                  : formatToken(pos.deposit)}
                              </td>
                              <td className="py-4 tabular-nums text-ocean-teal">
                                {pos.isLoading
                                  ? "…"
                                  : formatToken(pos.interest)}
                              </td>
                              <td className="py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDeposit({
                                      assetConfigKey: cfg,
                                      plainLp: isWad ? false : undefined,
                                    })
                                  }
                                  className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                                >
                                  {isWad ? (consumerCopy ? "Deposit" : "Open position") : "Deposit"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                    {consumerCopy ? (
                      walletUsdcBase != null &&
                      walletUsdcBase > CASH_OUT_MIN_USD ? (
                        <>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatUsdAmount(walletUsdcBaseUsd)}
                          </span>{" "}
                          ready to cash out.
                          {walletUsdcAlgo != null &&
                          walletUsdcAlgo > CASH_OUT_MIN_USD ? (
                            <>
                              {" "}
                              <span className="font-medium text-foreground tabular-nums">
                                {formatUsdAmount(walletUsdcAlgoUsd)}
                              </span>{" "}
                              is available to move and can be cashed out from there too.
                            </>
                          ) : null}
                        </>
                      ) : walletUsdcAlgo != null &&
                        walletUsdcAlgo > CASH_OUT_MIN_USD ? (
                        <>
                          This balance is available to move. Cash out can move it,
                          then send it.
                        </>
                      ) : (
                        <>Nothing to cash out.</>
                      )
                    ) : hasBaseUsdc ? (
                      <>
                        Undeposited USDC:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatToken(walletUsdcAlgo ?? 0)}
                        </span>{" "}
                        on Algorand
                        {walletUsdcAlgoUsd > 0
                          ? ` (${formatUsdAmount(walletUsdcAlgoUsd)})`
                          : ""}
                        {" · "}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatToken(walletUsdcBase)}
                        </span>{" "}
                        on Base
                        {walletUsdcBaseUsd > 0
                          ? ` (${formatUsdAmount(walletUsdcBaseUsd)})`
                          : ""}
                        . Use Deposit to Earn to swap Base USDC and supply
                        into a savings market.
                      </>
                    ) : (
                      <>
                        Undeposited USDC in your Algorand wallet. Deposit into a
                        savings market to start earning yield.
                      </>
                    )}
                  </p>
                </section>
              ) : null}

              {isWalletAccount ? (
                <section
                  id="savings-transaction-history"
                  className="rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                      {consumerCopy ? "Activity" : "Transaction history"}
                    </h2>
                    {txHistoryLoading ? (
                      <span className="text-xs text-muted-foreground">
                        Updating…
                      </span>
                    ) : null}
                  </div>

                  {txHistory.length === 0 ? (
                    <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                      {txHistoryLoading
                        ? "Loading history…"
                        : consumerCopy
                          ? "No activity yet. Deposits and withdrawals will show up here."
                          : "No transactions yet. Deposits and withdrawals will show up here."}
                    </p>
                  ) : (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="pb-3 font-medium">Type</th>
                            <th className="pb-3 font-medium">Asset</th>
                            <th className="pb-3 font-medium">Amount</th>
                            <th className="pb-3 font-medium">Date</th>
                            {!consumerCopy ? (
                              <th className="pb-3 font-medium text-right">
                                Transaction
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {txHistory.map((item) => {
                            const url = getExplorerTransactionUrl(
                              networkId,
                              item.txId
                            );
                            const amountText = txAmountText(item, consumerCopy);
                            const isIn = item.kind === "deposit";
                            const isOut = item.kind === "withdraw";
                            return (
                              <tr
                                key={item.txId}
                                className="border-b border-border/40 last:border-0"
                              >
                                <td className="py-4">
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      isIn && "text-ocean-teal",
                                      isOut &&
                                        "text-orange-600 dark:text-orange-400"
                                    )}
                                  >
                                    {txKindLabel(item)}
                                  </span>
                                  {item.detail ? (
                                    <details className="mt-1">
                                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                        View details
                                      </summary>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {item.detail}
                                      </p>
                                    </details>
                                  ) : null}
                                </td>
                                <td className="py-4 font-medium">
                                  {txAssetLabel(item, accounts, consumerCopy)}
                                </td>
                                <td className="py-4 tabular-nums font-medium">
                                  {amountText ? (
                                    <>
                                      {isOut ? "−" : isIn ? "+" : ""}
                                      {amountText}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground font-normal">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 text-muted-foreground">
                                  {formatTxWhen(item.timestamp)}
                                </td>
                                {!consumerCopy && item.kind !== "activity" ? (
                                  <td className="py-4 text-right">
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                      title="View on explorer"
                                    >
                                      <span className="font-mono">
                                        {shortTxId(item.txId)}
                                      </span>
                                      <ExternalLink
                                        className="size-3.5"
                                        aria-hidden
                                      />
                                    </a>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {/* Per-market history when viewing a savings market (not portfolio). */}
              {!isWalletAccount ? (
              <section
                id="savings-transaction-history"
                data-version="history-v2"
                className="rounded-[28px] border border-border bg-card p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    {consumerCopy ? "Activity" : "Transaction history"}
                  </h2>
                  {txHistoryLoading ? (
                    <span className="text-xs text-muted-foreground">
                      Updating…
                    </span>
                  ) : null}
                </div>

                {txHistory.length === 0 ? (
                  <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                    {txHistoryLoading
                      ? "Loading history…"
                      : consumerCopy
                        ? "No activity yet. Deposits and withdrawals will show up here."
                        : "No transactions yet. Deposits and withdrawals will show up here."}
                  </p>
                ) : (
                  <ul className="mt-5 divide-y divide-border/60">
                    {txHistory.map((item) => {
                      const url = getExplorerTransactionUrl(
                        networkId,
                        item.txId
                      );
                      const amountText = txAmountText(item, consumerCopy);
                      const isIn = item.kind === "deposit";
                      const isOut = item.kind === "withdraw";
                      return (
                        <li
                          key={item.txId}
                          className="flex items-start justify-between gap-3 py-3.5 first:pt-1 last:pb-0"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "text-sm font-semibold",
                                  isIn && "text-ocean-teal",
                                  isOut &&
                                    "text-orange-600 dark:text-orange-400"
                                )}
                              >
                                {txKindLabel(item)}
                              </span>
                              {item.detail ? (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                    View details
                                  </summary>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.detail}
                                  </p>
                                </details>
                              ) : null}
                              {amountText ? (
                                <span className="text-sm tabular-nums font-medium">
                                  {isOut ? "−" : isIn ? "+" : ""}
                                  {amountText}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatTxWhen(item.timestamp)}
                            </p>
                          </div>
                          {!consumerCopy && item.kind !== "activity" ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                              title="View on explorer"
                            >
                              <span className="font-mono">
                                {shortTxId(item.txId)}
                              </span>
                              <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              ) : null}
            </>
          ) : showEmptyHero ? (
            <>
              <section className="rounded-[28px] border border-border/60 bg-card p-8 sm:p-10 text-foreground shadow-sm dark:text-white">
                <h2 className="max-w-xl text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
                  Deposit and earn{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {apy != null ? `${apy.toFixed(2)}%` : "—"}
                  </span>{" "}
                  APY!
                </h2>

                <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <div className="flex items-center gap-2">
                      {isLeveragedWadUsdc ? (
                        <LpPairIconStack
                          asset1Icon={getTokenImagePath("WAD")}
                          asset2Icon="/lovable-uploads/USDC.webp"
                          fallbackIcon="/lovable-uploads/LP_TMPOOL2_WAD_USDC_pair.png"
                          size="lg"
                          alt="USDC / WAD"
                        />
                      ) : (
                        <>
                          <img src={logo} alt="" className="size-8 rounded-full" />
                          <ChevronsRight className="size-5 text-muted-foreground/70 dark:text-white/40" />
                          <img src={logo} alt="" className="size-8 rounded-full" />
                        </>
                      )}
                    </div>
                    <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed dark:text-white/65">
                      {isLeveragedWadUsdc ? (
                        consumerCopy ? (
                          <>
                            Higher yield, higher risk. You can lose more than
                            with regular savings.{" "}
                            <span className="text-whale-gold">Higher risk</span>
                          </>
                        ) : (
                          <>
                            Deploy USDC: 75% stays as safe DorkFi collateral, 25% pairs
                            with minted WAD on Tinyman, then LP earns Higher Yield.{" "}
                            <span className="text-whale-gold">Higher risk</span>
                          </>
                        )
                      ) : isHighYield ? (
                        consumerCopy ? (
                          <>
                            Higher yield, higher risk. Rates update
                            automatically.{" "}
                            <span className="text-whale-gold">Higher risk</span>
                          </>
                        ) : (
                          <>
                            Deposit {symbol} LP tokens into a pooled market for higher
                            yield with higher risk. Rates update as pool utilization
                            evolves.{" "}
                            <span className="text-whale-gold">Higher risk</span>
                          </>
                        )
                      ) : (
                        <>
                          Deposit into savings to earn a transparent APY. The
                          rate updates automatically.{" "}
                          <span className="text-ocean-teal">Learn more</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <DorkFiButton
                      className="rounded-xl px-6 h-11 min-w-[140px]"
                      onClick={() => {
                        if (activeAccount) {
                          openDeposit();
                          return;
                        }
                        // Cash-onramp path: email login first, then Easy Start deposit.
                        if (privy.authenticated) {
                          openEasyStartCashDeposit();
                          return;
                        }
                        void openEasyStartLogin();
                      }}
                    >
                      {activeAccount && isLeveragedWadUsdc && !consumerCopy
                        ? "Open position"
                        : "Deposit to Earn"}
                    </DorkFiButton>
                    {activeAccount && !isWalletAccount ? (
                      <button
                        type="button"
                        onClick={openWithdraw}
                        className="rounded-xl border border-[#d7e2f0] bg-white px-6 h-11 min-w-[140px] text-sm font-semibold text-foreground hover:bg-white/70 transition-colors dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                      >
                        Withdraw from Earn
                      </button>
                    ) : null}
                    {isLeveragedWadUsdc && activeAccount && !consumerCopy ? (
                      <button
                        type="button"
                        onClick={() => openDeposit({ plainLp: true })}
                        className="rounded-xl px-4 h-11 text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline dark:text-white/70 dark:hover:text-white"
                      >
                        Supply existing LP
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <SimpleSavingsCalculator apyPercent={marketApy} />
            </>
          ) : (
            <div className="rounded-[28px] border border-border/60 bg-card p-10 sm:p-12 text-center text-sm text-muted-foreground">
              Loading your savings…
            </div>
          )}

          {activeQuote.isLoading && showEmptyHero ? (
            <p className="text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : activeQuote.error ? (
            <p className="text-center text-xs text-destructive">
              {activeQuote.error}
            </p>
          ) : null}
        </div>
      </div>

      <AccountWithdrawChooserModal
        open={withdrawChooserOpen}
        onOpenChange={setWithdrawChooserOpen}
        canWithdrawFromEarn={hasAnySavingsDeposit}
        canCashOut={canCashOut || Boolean(pendingWithdraw)}
        baseUsd={portfolioCashOutUsd}
        earnUsd={portfolioSavingsUsd + portfolioHigherYieldUsd}
        algorandUsd={portfolioAlgorandUsd}
        finishEarnMove={Boolean(pendingWithdraw)}
        consumerCopy={consumerCopy}
        onWithdrawFromEarn={() => {
          setWithdrawChooserOpen(false);
          window.setTimeout(() => {
            if (pendingWithdraw) openResumeEarnWithdraw();
            else openWithdraw();
          }, 200);
        }}
        onCashOut={() => {
          setWithdrawChooserOpen(false);
          window.setTimeout(() => openEasyStartCashOut(), 200);
        }}
      />

      {!consumerCopy ? (
        <WalletModal
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      ) : null}

      {isLeveragedWadUsdc && !plainLpSupply ? (
        <LeveragedWadLpDepositModal
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          route={route}
          networkId={networkId}
          onConnectWallet={() => {
            setDepositOpen(false);
            afterOverlayClose(openConnect);
          }}
          onSuccess={(payload) => {
            if (!route) return;
            recordTx({
              txId: payload.txId,
              kind: payload.kind,
              amount: payload.amount,
              symbol: payload.symbol,
              poolId: route.poolId,
              assetConfigKey: route.asset.configKey,
              balanceAfterUsd: payload.balanceAfterUsd,
            });
          }}
        />
      ) : (
        <EasySavingsDepositModal
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          route={isWalletAccount ? usdcRoute : route}
          networkId={networkId}
          isHighYield={isWalletAccount ? false : isHighYield}
          onConnectWallet={() => {
            setDepositOpen(false);
            afterOverlayClose(openConnect);
          }}
          onSuccess={(payload) => {
            const r = isWalletAccount ? usdcRoute : route;
            if (!r) return;
            recordTx({
              txId: payload.txId,
              kind: payload.kind,
              amount: payload.amount,
              symbol: payload.symbol,
              poolId: r.poolId,
              assetConfigKey: r.asset.configKey,
              balanceAfterUsd: payload.balanceAfterUsd,
            });
          }}
        />
      )}

      <EasySavingsWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          setOutboundRev((n) => n + 1);
        }}
        route={isWalletAccount ? usdcRoute : route}
        networkId={networkId}
        onConnectWallet={() => {
          setWithdrawOpen(false);
          afterOverlayClose(openConnect);
        }}
        onSuccess={(payload) => {
          const r = isWalletAccount ? usdcRoute : route;
          if (!r) return;
          recordTx({
            txId: payload.txId,
            kind: payload.kind,
            amount: payload.amount,
            symbol: payload.symbol,
            poolId: r.poolId,
            assetConfigKey: r.asset.configKey,
            balanceAfterUsd: payload.balanceAfterUsd,
          });
        }}
      />
    </section>
  );
};

export default SavingsCard;
