import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@txnlab/use-wallet-react";
import { Info, Loader2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import {
  getHealthFactorBand,
  getHealthFactorStatusLabel,
} from "@/utils/healthFactorUx";
import { formatUsdAmount, cn } from "@/lib/utils";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { Switch } from "@/components/ui/switch";
import WalletModal from "@/components/WalletModal";

function formatTokenAmt(n: number | null | undefined, digits = 5): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatUsdAmount(n);
}

/** Horizontal scale ticks under position bars. */
function ScaleTicks({ max }: { max: number }) {
  const ticks =
    max <= 0
      ? [0]
      : [0, max * 0.25, max * 0.5, max * 0.75, max].map((v) =>
          Number(v.toFixed(2))
        );
  return (
    <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
      {ticks.map((t, i) => (
        <span key={`${t}-${i}`}>{t}</span>
      ))}
    </div>
  );
}

function PositionBars({
  supplied,
  borrowed,
}: {
  supplied: number;
  borrowed: number;
}) {
  const scale = Math.max(supplied, borrowed, 0.01);
  const suppliedPct = Math.min(100, (supplied / scale) * 100);
  const borrowedPct = Math.min(100, (borrowed / scale) * 100);
  const maxBorrowPct = Math.min(100, ((supplied * 0.8) / scale) * 100);

  return (
    <div className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        Your position
        <Info className="size-3.5 text-muted-foreground" />
      </h2>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Supplied</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatUsd(supplied)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-sky-400/90 transition-all"
            style={{ width: `${suppliedPct}%` }}
          />
        </div>
        <ScaleTicks max={scale} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Borrowed</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatUsd(borrowed)}
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 via-orange-400 to-amber-300 transition-all"
            style={{ width: `${borrowedPct}%` }}
          />
          {supplied > 0 ? (
            <span
              className="absolute top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground"
              style={{ left: `calc(${maxBorrowPct}% - 14px)` }}
            >
              max
            </span>
          ) : null}
        </div>
        <ScaleTicks max={scale} />
      </div>
    </div>
  );
}

function HealthGauge({
  healthFactor,
  liquidationPrice,
  referencePrice,
  referenceSymbol,
}: {
  healthFactor: number | null;
  liquidationPrice: number | null;
  referencePrice: number | null;
  referenceSymbol: string | null;
}) {
  const band = getHealthFactorBand(healthFactor);
  const label =
    band === "safe"
      ? "Healthy"
      : getHealthFactorStatusLabel(healthFactor);
  const display =
    healthFactor == null
      ? "—"
      : healthFactor >= 10
        ? "10+"
        : healthFactor.toFixed(2);

  // Map HF to gauge angle: 1 → left (risky), 4+ → right (safe)
  const clamped =
    healthFactor == null || !Number.isFinite(healthFactor)
      ? 1
      : Math.min(4, Math.max(1, healthFactor));
  const t = (clamped - 1) / 3; // 0..1
  const angle = Math.PI * (1 - t); // π → 0
  const cx = 120;
  const cy = 110;
  const r = 88;
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(angle);

  return (
    <div className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        Health factor
        <Info className="size-3.5 text-muted-foreground" />
      </h2>

      <div className="relative mx-auto mt-2 w-full max-w-[260px]">
        <svg viewBox="0 0 240 140" className="w-full">
          <defs>
            <linearGradient id="hfArc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path
            d="M 24 110 A 88 88 0 0 1 216 110"
            fill="none"
            stroke="url(#hfArc)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-foreground"
          />
          <circle cx={cx} cy={cy} r="5" className="fill-foreground" />
          <text
            x="28"
            y="130"
            className="fill-muted-foreground text-[10px]"
          >
            1
          </text>
          <text
            x="200"
            y="130"
            className="fill-muted-foreground text-[10px]"
          >
            4+
          </text>
        </svg>

        <div className="absolute inset-x-0 top-[42%] flex flex-col items-center">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              band === "safe" || band === "none"
                ? "bg-emerald-500/15 text-emerald-500"
                : band === "warning"
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-destructive/15 text-destructive"
            )}
          >
            {label}
          </span>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {display}
          </p>
        </div>
      </div>

      <dl className="mt-auto space-y-2 pt-4 text-sm border-t border-border/50">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Liquidation Price</dt>
          <dd className="font-medium tabular-nums">
            {liquidationPrice != null ? formatUsd(liquidationPrice) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">
            {referenceSymbol
              ? `Current ${referenceSymbol} Price`
              : "Reference Price"}
          </dt>
          <dd className="font-medium tabular-nums">
            {referencePrice != null ? formatUsd(referencePrice) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

type SupplyRow = {
  key: string;
  symbol: string;
  icon: string;
  wallet: number;
  walletUsd: number;
  supplied: number;
  suppliedUsd: number;
  apy: number | null;
  asCollateral: boolean;
};

const WALLET_COLORS = [
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#a5b4fc",
  "#c4b5fd",
  "#f9a8d4",
];

/**
 * Simple Spark-style portfolio for Chub — position, health, supply, wallet.
 */
const PortfolioDashboard = () => {
  const { activeAccount } = useWallet();
  const navigate = useNavigate();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [includeSupplied, setIncludeSupplied] = useState(true);

  const {
    deposits,
    borrows,
    totalCollateral,
    totalBorrowed,
    healthFactor,
    walletBalances,
    isLoading,
    isLoadingPositions,
    error,
  } = usePortfolioData();

  const supplyRows: SupplyRow[] = useMemo(() => {
    const byAsset = new Map<string, SupplyRow>();

    for (const d of deposits) {
      byAsset.set(d.asset, {
        key: d.asset,
        symbol: d.asset,
        icon: d.icon || getTokenImagePath(d.asset) || "/placeholder.svg",
        wallet: 0,
        walletUsd: 0,
        supplied: d.balance,
        suppliedUsd: d.value,
        apy: d.apy,
        asCollateral: true,
      });
    }

    for (const [symbol, bal] of Object.entries(walletBalances)) {
      const existing = byAsset.get(symbol);
      if (existing) {
        existing.wallet = bal.balance;
        existing.walletUsd = bal.balanceUSD;
      } else if (bal.balance > 0 || bal.balanceUSD > 0) {
        byAsset.set(symbol, {
          key: symbol,
          symbol,
          icon: getTokenImagePath(symbol) || "/placeholder.svg",
          wallet: bal.balance,
          walletUsd: bal.balanceUSD,
          supplied: 0,
          suppliedUsd: 0,
          apy: null,
          asCollateral: false,
        });
      }
    }

    return [...byAsset.values()].sort((a, b) => {
      if (b.suppliedUsd !== a.suppliedUsd) return b.suppliedUsd - a.suppliedUsd;
      return b.walletUsd - a.walletUsd;
    });
  }, [deposits, walletBalances]);

  const primaryCollateral = deposits[0] ?? null;
  const liquidationPrice =
    primaryCollateral &&
    totalBorrowed > 0 &&
    primaryCollateral.balance > 0
      ? totalBorrowed / (primaryCollateral.balance * 0.85)
      : null;

  const walletSegments = useMemo(() => {
    const segments: Array<{ name: string; value: number }> = [];
    for (const [symbol, bal] of Object.entries(walletBalances)) {
      if (bal.balanceUSD > 0.005) {
        segments.push({ name: symbol, value: bal.balanceUSD });
      }
    }
    if (includeSupplied) {
      for (const d of deposits) {
        if (d.value > 0.005) {
          segments.push({ name: `${d.asset} (supplied)`, value: d.value });
        }
      }
    }
    return segments.sort((a, b) => b.value - a.value);
  }, [walletBalances, deposits, includeSupplied]);

  const walletTotal = walletSegments.reduce((s, x) => s + x.value, 0);

  if (!activeAccount) {
    return (
      <section className="w-full max-w-3xl mx-auto rounded-[28px] border border-border/60 bg-card p-8 text-center shadow-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground text-sm">
          Connect your wallet to see supplies, borrows, and health.
        </p>
        <button
          type="button"
          onClick={() => setWalletModalOpen(true)}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ocean-teal px-6 text-sm font-semibold text-white hover:bg-ocean-teal/90"
        >
          Connect Wallet
        </button>
        <WalletModal
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </section>
    );
  }

  const loading = isLoading || isLoadingPositions;

  return (
    <section className="w-full max-w-6xl mx-auto space-y-4">
      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : null}
      {loading ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading portfolio…
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
        <PositionBars supplied={totalCollateral} borrowed={totalBorrowed} />
        <HealthGauge
          healthFactor={healthFactor}
          liquidationPrice={liquidationPrice}
          referencePrice={primaryCollateral?.tokenPrice ?? null}
          referenceSymbol={primaryCollateral?.asset ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
        {/* Supply table */}
        <div className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm overflow-x-auto">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Supply</h2>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="pb-3 font-medium">Assets</th>
                <th className="pb-3 font-medium">In Wallet</th>
                <th className="pb-3 font-medium">Your supply</th>
                <th className="pb-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    APY <Info className="size-3" />
                  </span>
                </th>
                <th className="pb-3 font-medium">Collateral</th>
                <th className="pb-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {supplyRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No balances yet. Supply assets from Savings to get started.
                  </td>
                </tr>
              ) : (
                supplyRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="py-3.5">
                      <span className="flex items-center gap-2 font-medium">
                        <img
                          src={row.icon}
                          alt=""
                          className="size-7 rounded-full"
                        />
                        {row.symbol}
                      </span>
                    </td>
                    <td className="py-3.5 tabular-nums">
                      <div>{formatTokenAmt(row.wallet)}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.walletUsd > 0 ? formatUsd(row.walletUsd) : "—"}
                      </div>
                    </td>
                    <td className="py-3.5 tabular-nums">
                      {row.supplied > 0 ? (
                        <>
                          <div>{formatTokenAmt(row.supplied)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatUsd(row.suppliedUsd)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 tabular-nums">
                      {row.apy != null && row.apy > 0
                        ? `${row.apy.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="py-3.5">
                      <Switch
                        checked={row.asCollateral}
                        disabled
                        aria-label={`${row.symbol} as collateral`}
                      />
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigate("/savings")}
                          className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/80"
                        >
                          Supply
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/savings")}
                          disabled={row.supplied <= 0}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 disabled:opacity-40"
                        >
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {borrows.length > 0 ? (
            <div className="mt-6 pt-4 border-t border-border/50">
              <h3 className="text-sm font-semibold mb-3">Borrows</h3>
              <ul className="space-y-2 text-sm">
                {borrows.map((b) => (
                  <li
                    key={`borrow-${b.asset}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <img
                        src={
                          b.icon ||
                          getTokenImagePath(b.asset) ||
                          "/placeholder.svg"
                        }
                        alt=""
                        className="size-6 rounded-full"
                      />
                      {b.asset}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatTokenAmt(b.balance)} · {formatUsd(b.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* My Wallet */}
        <div className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-lg font-semibold tracking-tight">My Wallet</h2>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Include supplied
              <Switch
                checked={includeSupplied}
                onCheckedChange={setIncludeSupplied}
              />
            </label>
          </div>

          <div className="relative mx-auto h-56 w-full max-w-[240px]">
            {walletTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={walletSegments}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {walletSegments.map((_, i) => (
                      <Cell
                        key={i}
                        fill={WALLET_COLORS[i % WALLET_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No wallet assets
              </div>
            )}
            {walletTotal > 0 ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatUsd(walletTotal)}
                </span>
              </div>
            ) : null}
          </div>

          {walletSegments.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-xs">
              {walletSegments.slice(0, 6).map((s, i) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{
                        background: WALLET_COLORS[i % WALLET_COLORS.length],
                      }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {formatUsd(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default PortfolioDashboard;
