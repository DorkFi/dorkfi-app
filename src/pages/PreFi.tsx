import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Coins,
  ArrowDownCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
  RefreshCcw,
  ExternalLink,
  InfoIcon
} from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import CanvasBubbles from "@/components/CanvasBubbles";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import WalletButton from "@/components/WalletButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";

/**
 * PreFi Frontend – Single-file MVP Dashboard
 * ------------------------------------------------------------
 * What this provides out of the box:
 *  - Clean, modern Tailwind UI with animated interactions
 *  - Markets dashboard (VOI, aUSD, UNIT, BTC, ETH, ALGO)
 *  - Wallet connect placeholder + fully functional Mock Mode
 *  - Deposit flows (with thresholds + validation)
 *  - Balance & deposit tracking per market (mock + pluggable)
 *  - Time‑weighted reward *estimate* preview until launch
 *
 * What you must wire up:
 *  - Replace MOCK adapters with real on‑chain calls in `chainApi`
 *  - Provide correct contract addresses & asset IDs per market
 *  - Set the LAUNCH_TIMESTAMP when Phase 0 closes / markets launch
 *  - Implement wallet connection for VOI/AVM (e.g., Pera/Vera/WalletConnect)
 *
 * Notes:
 *  - This file is self‑contained for easy drop‑in. Move into your app structure
 *    (e.g., /src/pages/PreFi.tsx) and replace the chainApi with real calls.
 *  - Time‑weighted rewards use stake‑seconds (amount × seconds until launch).
 *    We **estimate** user share using a placeholder total stake function.
 *  - All numbers are illustrative in Mock Mode.
 */

/*************************
 * Program Configuration  *
 *************************/
const PROGRAM = {
  VOI_ALLOCATION_TOTAL: 2_000_000, // VOI total rewards for Phase 0
  LAUNCH_TIMESTAMP: Date.UTC(2025, 9, 15, 16, 0, 0), // TODO: set actual launch (Oct 15, 2025 16:00 UTC shown as example)
  // If launch is TBD, the UI will show a countdown using this placeholder.
};

type TokenStandard = "native" | "asa" | "arc200";

type Market = {
  id: string;
  name: string;
  symbol: string;
  min: number; // minimum qualifying deposit for Phase 0
  tokenStandard: TokenStandard;
  assetId?: string; // ASA/ARC‑200 ID if applicable
  contractAddress: string; // prefunding contract / app id (placeholder)
  decimals: number;
};

const MARKETS: Market[] = [
  {
    id: "voi",
    name: "VOI",
    symbol: "VOI",
    min: 10_000,
    tokenStandard: "native",
    contractAddress: "APP_ID_VOI_PREFUND", // TODO
    decimals: 6,
  },
  {
    id: "ausd",
    name: "Aramid USDC",
    symbol: "USDC",
    min: 20,
    tokenStandard: "asa",
    assetId: "ASA_ID_aUSD", // TODO
    contractAddress: "APP_ID_aUSD_PREFUND", // TODO
    decimals: 6,
  },
  {
    id: "unit",
    name: "UNIT",
    symbol: "UNIT",
    min: 10,
    tokenStandard: "arc200",
    assetId: "ARC200_ID_UNIT", // TODO
    contractAddress: "APP_ID_UNIT_PREFUND", // TODO
    decimals: 6,
  },
  {
    id: "btc",
    name: "Wrapped BTC",
    symbol: "BTC",
    min: 20, // USD equivalent
    tokenStandard: "arc200",
    assetId: "ARC200_ID_WBTC", // TODO
    contractAddress: "APP_ID_BTC_PREFUND", // TODO
    decimals: 8,
  },
  {
    id: "eth",
    name: "Wrapped ETH",
    symbol: "ETH",
    min: 20, // USD equivalent
    tokenStandard: "arc200",
    assetId: "ARC200_ID_WETH", // TODO
    contractAddress: "APP_ID_ETH_PREFUND", // TODO
    decimals: 8,
  },
  {
    id: "algo",
    name: "Algorand",
    symbol: "ALGO",
    min: 100,
    tokenStandard: "asa", // ALGO is native on Algorand; use your VOI chain mapping
    assetId: "ASA_ID_ALGO_WRAPPED", // TODO if wrapped; else adjust adapter
    contractAddress: "APP_ID_ALGO_PREFUND", // TODO
    decimals: 6,
  },
];

/*************************
 * Utilities              *
 *************************/
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const fmt0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const nowSec = () => Math.floor(Date.now() / 1000);
const toBase = (amt: number, decimals: number) => BigInt(Math.round(amt * 10 ** decimals));
const fromBase = (amt: bigint, decimals: number) => Number(amt) / 10 ** decimals;

/*************************
 * Minimal State & Types  *
 *************************/
interface WalletState {
  address?: string;
  connected: boolean;
  network: "voi-mainnet" | "voi-testnet";
  mockMode: boolean;
}

interface MarketState {
  walletBalanceBase: bigint; // user wallet token balance
  depositedBase: bigint; // user deposited (prefunded) balance
  totalStakeSecondsBase: bigint; // global stake‑seconds from chain (placeholder)
}

/*************************
 * Chain API (Pluggable)  *
 *************************/
/**
 * Replace this MOCK implementation with production adapters.
 * Suggested approach:
 *  - Use algosdk and your VOI RPC or Indexer endpoints
 *  - Implement wallet adapters (Pera/Vera/WalletConnect) to sign & send
 *  - Implement app call to your prefunding smart contracts
 */
const chainApi = {
  // ====== WALLET ======
  async connectWalletMock(): Promise<WalletState> {
    // In production: open wallet modal and return address/network
    const addrs = [
      "VOI2PREFUND6USER7ADDR8DEMO9AAAAAAA1111",
      "VOI2PREFUND6USER7ADDR8DEMO9BBBBBBB2222",
    ];
    const address = addrs[Math.floor(Math.random() * addrs.length)];
    return {
      address,
      connected: true,
      network: "voi-testnet",
      mockMode: true,
    };
  },

  async disconnectWallet(): Promise<void> {
    // Close session if using WalletConnect, etc.
    return;
  },

  // ====== READS ======
  async getWalletBalanceBase(
    _wallet: WalletState,
    market: Market
  ): Promise<bigint> {
    // Replace with token balance lookup via indexer/node
    // Mock: random-ish stable balances per market
    const seed = BigInt(
      Array.from(market.id).reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    return (seed * 10_000n) % (100_000_000n * BigInt(10 ** (market.decimals - 2)));
  },

  async getUserDepositBase(
    wallet: WalletState,
    market: Market
  ): Promise<bigint> {
    // Replace with read from prefunding contract state (local state/box)
    // Mock: derive from address hash + market
    if (!wallet.address) return 0n;
    const h = BigInt(
      Array.from(wallet.address + market.id).reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    return (h * 1_234_567n) % (500_000n * BigInt(10 ** market.decimals));
  },

  async getTotalStakeSecondsBase(_market: Market): Promise<bigint> {
    // Replace with global stake‑seconds aggregation from contract/global state
    // Mock: pretend 10M stake‑seconds in base units
    return 10_000_000n;
  },

  // ====== WRITES ======
  async depositToPrefund(
    wallet: WalletState,
    market: Market,
    amountBase: bigint
  ): Promise<{ txId: string }>
  {
    // TODO: implement actual app call / token transfer into prefund vault contract
    // For now, simulate success with a fake tx id and small delay
    await new Promise((r) => setTimeout(r, 850));
    return { txId: `TX-${market.id}-${Number(amountBase)}-${Date.now()}` };
  },
};

/*************************
 * UI Components          *
 *************************/
function Stat({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon: any }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 shadow-sm">
      <div className="rounded-xl border border-border bg-card p-2">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-card-foreground">{value}</div>
      </div>
    </div>
  );
}

function Countdown({ launchTs }: { launchTs: number }) {
  const [t, setT] = useState(launchTs - Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(launchTs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [launchTs]);
  if (t <= 0) return <div className="text-accent font-medium">Launching…</div>;
  const sec = Math.floor(t / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (
    <div className="font-semibold tabular-nums text-card-foreground">{d}d {h}h {m}m {s}s</div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-secondary">
      <div 
        className="h-2 rounded-full bg-gradient-progress transition-all duration-300" 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}

/*************************
 * Main Component         *
 *************************/
export default function PreFiDashboard() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false, network: "voi-testnet", mockMode: true });
  const [marketsState, setMarketsState] = useState<Record<string, MarketState>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [txLog, setTxLog] = useState<Array<{ ts: number; marketId: string; amount: number; txId: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [modalAmount, setModalAmount] = useState("");
  const [modalFiatValue, setModalFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const launchTs = PROGRAM.LAUNCH_TIMESTAMP;

  const connect = async () => {
    const s = await chainApi.connectWalletMock();
    setWallet(s);
    setRefreshKey((k) => k + 1);
  };
  const disconnect = async () => {
    await chainApi.disconnectWallet();
    setWallet({ connected: false, network: "voi-testnet", mockMode: true });
  };

  const loadMarket = async (m: Market) => {
    setLoadingMap((x) => ({ ...x, [m.id]: true }));
    try {
      const [wb, dep, totalSS] = await Promise.all([
        chainApi.getWalletBalanceBase(wallet, m),
        chainApi.getUserDepositBase(wallet, m),
        chainApi.getTotalStakeSecondsBase(m),
      ]);
      setMarketsState((s) => ({
        ...s,
        [m.id]: {
          walletBalanceBase: wb,
          depositedBase: dep,
          totalStakeSecondsBase: totalSS,
        },
      }));
    } finally {
      setLoadingMap((x) => ({ ...x, [m.id]: false }));
    }
  };

  useEffect(() => {
    if (!wallet.connected) return;
    MARKETS.forEach(loadMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, refreshKey]);

  // Modal handlers
  const openDepositModal = (market: Market) => {
    console.log("Opening deposit modal for", market.symbol);
    setSelectedMarket(market);
    setModalAmount("");
    setModalFiatValue(0);
    setShowSuccess(false);
    setIsDepositModalOpen(true);
    console.log("Modal should be open now, isDepositModalOpen:", true);
  };

  const closeDepositModal = () => {
    setIsDepositModalOpen(false);
    setSelectedMarket(null);
    setModalAmount("");
    setModalFiatValue(0);
    setShowSuccess(false);
  };

  // Update fiat value when amount changes
  useEffect(() => {
    if (modalAmount && selectedMarket) {
      const numAmount = parseFloat(modalAmount);
      // Mock token price - replace with real prices
      const mockPrice = selectedMarket.id === "ausd" ? 1 : 
                       selectedMarket.id === "voi" ? 0.05 :
                       selectedMarket.id === "btc" ? 65000 :
                       selectedMarket.id === "eth" ? 3000 :
                       selectedMarket.id === "algo" ? 0.25 : 1;
      setModalFiatValue(numAmount * mockPrice);
    } else {
      setModalFiatValue(0);
    }
  }, [modalAmount, selectedMarket]);

  const handleMaxClick = () => {
    if (selectedMarket && marketsState[selectedMarket.id]) {
      const balance = fromBase(marketsState[selectedMarket.id].walletBalanceBase, selectedMarket.decimals);
      setModalAmount(balance.toString());
    }
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleGoToPortfolio = () => {
    closeDepositModal();
    // Navigate to portfolio or main page
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setModalAmount("");
    setModalFiatValue(0);
  };

  const handleConfirmDeposit = async () => {
    if (!selectedMarket || !modalAmount || Number(modalAmount) <= 0) return;
    
    const amount = Number(modalAmount);
    const amountBase = BigInt(Math.floor(amount * 10 ** selectedMarket.decimals));
    
    console.log(`[DEPOSIT] ${amount} ${selectedMarket.symbol} (${amountBase} base units)`);
    
    setLoadingMap(prev => ({ ...prev, [selectedMarket.id]: true }));
    
    try {
      await chainApi.depositToPrefund(wallet, selectedMarket, amountBase);
      
      // Update tx log
      setTxLog(prev => [{
        ts: Date.now(),
        marketId: selectedMarket.id,
        amount: amount,
        txId: `TXN_${Math.random().toString(36).substring(2, 15)}`,
      }, ...prev]);
      
      // Refresh balances (optimistic update for mock)
      setMarketsState(prev => {
        const current = prev[selectedMarket.id];
        return {
          ...prev,
          [selectedMarket.id]: {
            walletBalanceBase: current?.walletBalanceBase ?? 0n,
            depositedBase: (current?.depositedBase ?? 0n) + amountBase,
            totalStakeSecondsBase: current?.totalStakeSecondsBase ?? 10_000_000n,
          },
        };
      });
      
      // Show success screen
      setTimeout(() => {
        setShowSuccess(true);
        setLoadingMap(prev => ({ ...prev, [selectedMarket.id]: false }));
      }, 500);
    } catch (error) {
      console.error("Deposit failed:", error);
      setLoadingMap(prev => ({ ...prev, [selectedMarket.id]: false }));
    }
  };

  const globalDeposited = useMemo(() => {
    let sum = 0;
    for (const m of MARKETS) {
      const st = marketsState[m.id];
      if (!st) continue;
      sum += fromBase(st.depositedBase, m.decimals);
    }
    return sum;
  }, [marketsState]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      
      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      {/* Advanced Canvas Bubble System - Dark Mode Only */}
      <div className="hidden dark:block">
        <CanvasBubbles />
      </div>

      {/* PreFi Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:header-nav-bg backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              aria-label="Go to DorkFi dashboard"
            >
              <div className="flex flex-col">
                <img 
                  src="/lovable-uploads/dork_fi_logo_edit1_light.png" 
                  alt="DorkFi logo" 
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain flex-shrink-0" 
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => {
                    console.error('Logo failed to load, using placeholder');
                    (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>
            </Link>
            
            {/* Theme Toggle and Wallet */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 pt-8 relative z-10">
        <DorkFiCard 
          hoverable
          className="relative text-center overflow-hidden p-6 md:p-8 mb-8"
        >
          {/* Decorative elements */}
          {/* Birds - light mode only */}
          <div className="absolute top-6 left-10 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0s' }}>
            <img
              src="/lovable-uploads/bird_thinner.png"
              alt="Decorative DorkFi bird - top left"
              className="w-8 h-8 md:w-10 md:h-10 -rotate-6 select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="absolute top-14 right-12 opacity-70 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0.5s' }}>
            <img
              src="/lovable-uploads/bird_thinner.png"
              alt="Decorative DorkFi bird - top right"
              className="w-7 h-7 md:w-9 md:h-9 rotate-3 select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="absolute bottom-10 left-14 opacity-60 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '1s' }}>
            <img
              src="/lovable-uploads/bird_thinner.png"
              alt="Decorative DorkFi bird - bottom left"
              className="w-7 h-7 md:w-9 md:h-9 -rotate-2 select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          {/* Dark mode gold fish */}
          <div className="absolute top-4 left-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0s' }}>
            <img
              src="/lovable-uploads/DorkFi_gold_fish.png"
              alt="Decorative DorkFi gold fish - top left"
              className="w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="absolute top-12 right-12 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0.5s' }}>
            <img
              src="/lovable-uploads/DorkFi_gold_fish.png"
              alt="Decorative DorkFi gold fish - top right"
              className="w-[1.896563rem] h-[1.896563rem] md:w-[2.844844rem] md:h-[2.844844rem] -scale-x-100 select-none"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="relative z-10 text-center">
            <H1 className="m-0 text-4xl md:text-5xl text-center">
              <span className="hero-header">PreFi Deposit</span>
            </H1>
            <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto text-center">
              <span className="block md:inline md:whitespace-nowrap">
                Connect Wallet / Deposit Now / Start Earning Incentives
              </span>
              <br className="hidden md:block" />
              <span className="block md:inline md:whitespace-nowrap">
                Earlier, larger deposits earn a greater share.
              </span>
            </Body>
          </div>
        </DorkFiCard>
      </div>

      {/* Stats */}
      <header className="mx-auto max-w-6xl px-4 relative z-10">
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Total VOI Rewards" value={`${fmt0.format(PROGRAM.VOI_ALLOCATION_TOTAL)} VOI`} icon={Coins} />
          <Stat label="Your Total Deposited" value={`${fmt.format(globalDeposited)} (all mkts)`} icon={TrendingUp} />
          <Stat label="Network" value={`${wallet.network}${wallet.mockMode ? " • Mock" : ""}`} icon={BarChart3} />
        </div>
      </header>


      {/* Markets */}
      <main className="mx-auto max-w-6xl px-4 py-8 relative z-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Market Overview Header */}
          <div className="border-b border-border/60 bg-card/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-card-foreground">What is PreFi?</h2>
              <DorkFiButton variant="secondary" className="text-sm">
                Learn More
              </DorkFiButton>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>PreFi lets early supporters earn VOI rewards by pre-depositing into upcoming DorkFi markets.</p>
              <p>Deposits are non-custodial, tracked on-chain, and earn a share of 2,000,000 VOI incentives.</p>
              <p>The pool is time-weighted—earlier, larger deposits earn more at launch.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-left">Asset</th>
                  <th className="px-6 py-4 text-sm font-medium text-right">Wallet Balance</th>
                  <th className="px-6 py-4 text-sm font-medium text-right">Deposited</th>
                  <th className="px-6 py-4 text-sm font-medium text-center w-48">Progress</th>
                  <th className="px-6 py-4 text-sm font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MARKETS.map((m, index) => {
                  const st = marketsState[m.id];
                  const loading = !!loadingMap[m.id];
                  const dep = st ? fromBase(st.depositedBase, m.decimals) : 0;
                  const wal = st ? fromBase(st.walletBalanceBase, m.decimals) : 0;
                  const minOk = dep >= m.min;

                  // Reward estimate (very rough): user's stake‑seconds vs global
                  const secondsRemaining = Math.max(0, Math.floor((launchTs - Date.now()) / 1000));
                  const myStakeSeconds = BigInt(Math.floor(dep * secondsRemaining));
                  const totalSS = st?.totalStakeSecondsBase ?? 10_000_000n; // placeholder global
                  const share = totalSS > 0n ? Number(myStakeSeconds) / Number(totalSS) : 0;
                  const yourEstReward = PROGRAM.VOI_ALLOCATION_TOTAL * share * 0.25; // 25% rough portion to this market — adjust once split is known

                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="border-t border-border hover:bg-secondary/20 transition-colors"
                    >
                      {/* Asset */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl border border-border bg-primary/10 px-3 py-1">
                            <div className="text-sm font-bold text-primary">{m.symbol}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-card-foreground">{m.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Min: {(m.id === "btc" || m.id === "eth" || m.id === "ausd") ? "$" : ""}{fmt.format(m.min)} {m.symbol}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Wallet Balance */}
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold tabular-nums text-card-foreground">
                          {loading ? "…" : `${fmt.format(wal)} ${m.symbol}`}
                        </div>
                      </td>

                      {/* Deposited */}
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold tabular-nums text-card-foreground">
                          {loading ? "…" : `${fmt.format(dep)} ${m.symbol}`}
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="px-6 py-4 w-48">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              {minOk ? (
                                <CheckCircle2 className="h-3 w-3 text-accent" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              )}
                              <span className="text-muted-foreground">
                                {minOk ? "Qualified" : "Needs more"}
                              </span>
                            </div>
                            <span className="text-muted-foreground tabular-nums">
                              {fmt.format(Math.min(dep, m.min))} / {fmt.format(m.min)}
                            </span>
                          </div>
                          <ProgressBar value={Math.min(dep, m.min)} max={m.min} />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <DorkFiButton
                            variant="secondary"
                            disabled={loading}
                            onClick={() => {
                              console.log("Deposit clicked for", m.symbol);
                              openDepositModal(m);
                            }}
                            className="text-sm"
                          >
                            <ArrowDownCircle className="h-4 w-4" /> Deposit
                          </DorkFiButton>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimers */}
        <section className="mt-8">
          <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="mb-2">
              <strong className="text-primary">Non‑custodial:</strong> All prefunding deposits remain user‑controlled in on‑chain contracts.
            </p>
            <p className="mb-2">
              <strong className="text-primary">Time‑weighted distribution:</strong> Rewards accrue based on amount × time until launch. Earlier deposits earn more. Participants below the minimum threshold in any market will not qualify for Phase 0 rewards.
            </p>
            <p>
              <strong className="text-primary">Estimates only:</strong> Reward estimates displayed are indicative and assume placeholder global totals. Final distribution will use the on‑chain prefunding state at launch.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-4 relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <div className="text-center text-muted-foreground text-sm">
            <p>© 2025 DorkFi Protocol. Dive into the depths of DeFi.</p>
          </div>
        </div>
      </footer>

      {/* Deposit Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={closeDepositModal}>
        <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-md px-0 py-0">
          {showSuccess ? (
            <div className="p-6">
              <SupplyBorrowCongrats
                transactionType="deposit"
                asset={selectedMarket?.symbol || ""}
                assetIcon={selectedMarket ? `/lovable-uploads/dorkfi_${selectedMarket.symbol.toLowerCase()}_icon.png` : ""}
                amount={modalAmount}
                onViewTransaction={handleViewTransaction}
                onGoToPortfolio={handleGoToPortfolio}
                onMakeAnother={handleMakeAnother}
                onClose={closeDepositModal}
              />
            </div>
          ) : (
            <>
              <DialogHeader className="pt-6 px-8 pb-1">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Deposit
                </DialogTitle>
                <DialogDescription className="text-center mt-1 text-sm text-slate-400 dark:text-slate-400">
                  Enter the amount to deposit. Your available balance and requirements are shown below.
                </DialogDescription>
                {selectedMarket && (
                  <div className="flex items-center justify-center gap-3 pb-2 mt-3">
                     <div className="rounded-xl border border-border bg-primary/10 px-3 py-1">
                       <div className="text-sm font-bold text-primary">{selectedMarket.symbol}</div>
                     </div>
                    <span className="text-xl font-semibold text-slate-800 dark:text-white">{selectedMarket.symbol}</span>
                  </div>
                )}
              </DialogHeader>
              
              {selectedMarket && (
                <div className="space-y-6 pt-2 px-8 pb-8">
                  <div className="space-y-3">
                    <Label htmlFor="amount" className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Amount
                    </Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.0"
                        autoFocus
                        value={modalAmount}
                        onChange={(e) => setModalAmount(e.target.value)}
                        className="bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleMaxClick}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:bg-teal-400/10 h-8 px-3"
                      >
                        MAX
                      </Button>
                    </div>
                    {modalFiatValue > 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        ≈ ${modalFiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Wallet Balance: {marketsState[selectedMarket.id] 
                        ? fmt.format(fromBase(marketsState[selectedMarket.id].walletBalanceBase, selectedMarket.decimals))
                        : "0"
                      } {selectedMarket.symbol}
                    </p>
                  </div>

                  <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Minimum to Qualify</span>
                          <Tooltip>
                             <TooltipTrigger asChild>
                               <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                             </TooltipTrigger>
                            <TooltipContent>
                              <p>Minimum deposit required to qualify for Phase 0 rewards</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-slate-800 dark:text-white">
                          {(selectedMarket.id === "btc" || selectedMarket.id === "eth" || selectedMarket.id === "ausd") ? "$" : ""}{fmt.format(selectedMarket.min)} {selectedMarket.symbol}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Current Deposited</span>
                          <Tooltip>
                             <TooltipTrigger asChild>
                               <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                             </TooltipTrigger>
                            <TooltipContent>
                              <p>Amount you have already deposited for this market</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-slate-800 dark:text-white">
                          {marketsState[selectedMarket.id] 
                            ? fmt.format(fromBase(marketsState[selectedMarket.id].depositedBase, selectedMarket.decimals))
                            : "0"
                          } {selectedMarket.symbol}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Launch Countdown</span>
                          <Tooltip>
                             <TooltipTrigger asChild>
                               <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                             </TooltipTrigger>
                            <TooltipContent>
                              <p>Time remaining until market launch and reward distribution</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                          {Math.floor((launchTs - Date.now()) / (1000 * 60 * 60 * 24))} days
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleConfirmDeposit}
                    disabled={!modalAmount || Number(modalAmount) <= 0 || loadingMap[selectedMarket.id]}
                    className="w-full font-semibold text-white h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMap[selectedMarket.id] ? (
                      <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Deposit {selectedMarket.symbol}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}