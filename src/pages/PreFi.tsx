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
  ExternalLink
} from "lucide-react";

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
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [txLog, setTxLog] = useState<Array<{ ts: number; marketId: string; amount: number; txId: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleDeposit = async (m: Market) => {
    const num = Number(amounts[m.id] || 0);
    if (!wallet.connected || !wallet.address || !Number.isFinite(num) || num <= 0) return;
    const base = toBase(num, m.decimals);
    setLoadingMap((x) => ({ ...x, [m.id]: true }));
    try {
      const { txId } = await chainApi.depositToPrefund(wallet, m, base);
      // In production, re-pull chain state from indexer after confirmation
      setTxLog((t) => [{ ts: Date.now(), marketId: m.id, amount: num, txId }, ...t]);
      // Optimistic update in mock
      setMarketsState((s) => {
        const cur = s[m.id];
        return {
          ...s,
          [m.id]: {
            walletBalanceBase: cur?.walletBalanceBase ?? 0n,
            depositedBase: (cur?.depositedBase ?? 0n) + base,
            totalStakeSecondsBase: cur?.totalStakeSecondsBase ?? 10_000_000n,
          },
        };
      });
      setAmounts((a) => ({ ...a, [m.id]: "" }));
    } finally {
      setLoadingMap((x) => ({ ...x, [m.id]: false }));
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
    <div className="min-h-dvh w-full bg-gradient-prefi text-foreground">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">PreFi Deposit Incentives</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Encourage early capital commitments and signal interest in upcoming VOI lending markets. Deposits are non‑custodial and tracked on‑chain. Earlier, larger deposits earn a greater share of rewards.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {wallet.connected ? (
              <button 
                onClick={disconnect} 
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm hover:bg-secondary transition-colors"
              >
                <Wallet className="h-4 w-4" /> Disconnect {shortAddr(wallet.address)}
              </button>
            ) : (
              <button 
                onClick={connect} 
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Wallet className="h-4 w-4" /> Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total VOI Rewards" value={`${fmt0.format(PROGRAM.VOI_ALLOCATION_TOTAL)} VOI`} icon={Coins} />
          <Stat label="Launch In" value={<Countdown launchTs={launchTs} />} icon={Clock} />
          <Stat label="Your Total Deposited" value={`${fmt.format(globalDeposited)} (all mkts)`} icon={TrendingUp} />
          <Stat label="Network" value={`${wallet.network}${wallet.mockMode ? " • Mock" : ""}`} icon={BarChart3} />
        </div>
      </header>

      {/* Markets */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium">Asset</th>
                  <th className="px-6 py-4 text-sm font-medium">Wallet Balance</th>
                  <th className="px-6 py-4 text-sm font-medium">Deposited</th>
                  <th className="px-6 py-4 text-sm font-medium">Progress</th>
                  <th className="px-6 py-4 text-sm font-medium">Est. Rewards</th>
                  <th className="px-6 py-4 text-sm font-medium">Actions</th>
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
                            <div className="text-xs text-muted-foreground">Min: {fmt.format(m.min)} {m.symbol}</div>
                          </div>
                        </div>
                      </td>

                      {/* Wallet Balance */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold tabular-nums text-card-foreground">
                          {loading ? "…" : `${fmt.format(wal)} ${m.symbol}`}
                        </div>
                      </td>

                      {/* Deposited */}
                      <td className="px-6 py-4">
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

                      {/* Estimated Rewards */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-accent tabular-nums">
                          {fmt.format(yourEstReward)} VOI
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={0}
                            step={1 / 10 ** m.decimals}
                            placeholder={`Amount`}
                            value={amounts[m.id] ?? ""}
                            onChange={(e) => setAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
                            className="w-24 rounded-xl border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-ring transition-colors"
                          />
                          <button
                            disabled={!wallet.connected || loading}
                            onClick={() => handleDeposit(m)}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          >
                            <ArrowDownCircle className="h-4 w-4" /> Deposit
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-card-foreground">Activity</h2>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-secondary transition-colors"
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Market</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Tx</th>
                </tr>
              </thead>
              <tbody className="bg-card/50">
                {txLog.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-muted-foreground" colSpan={4}>No transactions yet.</td>
                  </tr>
                ) : (
                  txLog.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-3 tabular-nums text-card-foreground">{new Date(t.ts).toLocaleString()}</td>
                      <td className="px-4 py-3 uppercase text-primary font-semibold">{t.marketId}</td>
                      <td className="px-4 py-3 tabular-nums text-card-foreground">{fmt.format(t.amount)}</td>
                      <td className="px-4 py-3">
                        <a className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80 underline transition-colors" href="#" onClick={(e) => e.preventDefault()}>
                          <ExternalLink className="h-4 w-4" /> View
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

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

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-muted-foreground">
        Built for VOI PreFi • Replace mock adapters with real contracts before launch.
      </footer>
    </div>
  );
}