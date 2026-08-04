import { useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  ChevronsRight,
  Info,
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import type { NetworkId } from "@/config";
import {
  resolveSavingsRoute,
  savingsAccountDisplayLabel,
  isEasySavingsHighYieldAssetConfigKey,
} from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import {
  useSavingsAccounts,
  type SavingsAccountRow,
} from "@/hooks/useSavingsAccounts";
import { cn } from "@/lib/utils";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import DorkFiButton from "@/components/ui/DorkFiButton";
import WalletModal from "@/components/WalletModal";
import EasySavingsDepositModal from "@/components/easy-savings/EasySavingsDepositModal";
import SavingsRateChart, {
  buildSavingsRateHistory,
} from "@/components/easy-savings/SavingsRateChart";

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatApr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

const CHART_TABS = [
  "Savings Rate",
  "Collateral Composition",
  "Liquidity",
  "Risk Rating",
] as const;

const CHART_RANGES = ["1M", "3M", "1Y", "All"] as const;

/**
 * Easy Savings — Spark-style layout: account sidebar, hero CTA, rate chart,
 * and supported-assets deposit row. Deposit opens a signed supply modal.
 */
const SavingsCard = () => {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const { activeAccount } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [chartTab, setChartTab] =
    useState<(typeof CHART_TABS)[number]>("Savings Rate");
  const [chartRange, setChartRange] =
    useState<(typeof CHART_RANGES)[number]>("3M");

  const { core: coreAccounts, highYield: highYieldAccounts, all: accounts } =
    useSavingsAccounts(networkId);
  const [assetKey, setAssetKey] = useState<string>("");

  const effectiveAssetKey =
    assetKey && accounts.some((a) => a.route.asset.configKey === assetKey)
      ? assetKey
      : accounts[0]?.route.asset.configKey ?? "";

  const selectedAccount =
    accounts.find((a) => a.route.asset.configKey === effectiveAssetKey) ??
    accounts[0] ??
    null;

  const isHighYield = isEasySavingsHighYieldAssetConfigKey(effectiveAssetKey);

  const route: SavingsRoute | null = useMemo(() => {
    if (!effectiveAssetKey) return null;
    return resolveSavingsRoute({
      networkId,
      assetConfigKey: effectiveAssetKey,
    });
  }, [networkId, effectiveAssetKey]);

  const quote = useEasySavingsQuote({
    networkId,
    route,
    amount: "",
  });

  const symbol = route ? savingsAccountDisplayLabel(route) : effectiveAssetKey || "—";
  const apy = quote.supplyApyPercent ?? selectedAccount?.apy ?? null;
  const logo =
    route?.asset.logoPath ||
    getTokenImagePath(route?.asset.symbol ?? "") ||
    "/placeholder.svg";

  const rateHistory = useMemo(() => buildSavingsRateHistory(apy), [apy]);

  const balanceLabel =
    activeAccount && quote.walletBalance != null
      ? formatToken(quote.walletBalance)
      : "—";

  const openDeposit = () => {
    if (!activeAccount) {
      setWalletModalOpen(true);
      return;
    }
    setDepositOpen(true);
  };

  const renderAccountRow = (row: SavingsAccountRow) => {
    const active = row.route.asset.configKey === effectiveAssetKey;
    const label = savingsAccountDisplayLabel(row.route);
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
        <img src={rowLogo} alt="" className="size-7 rounded-full" />
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
              title="Supply assets to earn a transparent APY."
            >
              <Info className="size-4" />
            </span>
          </h1>

          <div>
            <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              Savings accounts
              <Info className="size-3.5" />
            </p>
            <div className="space-y-3">
              {coreAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  No savings markets on this network.
                </p>
              ) : (
                coreAccounts.map(renderAccountRow)
              )}
            </div>
          </div>

          {highYieldAccounts.length > 0 ? (
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                Higher-yield Opportunities
                <span
                  title="Pooled LP markets with higher yield and higher risk."
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
          <section className="rounded-[28px] bg-zinc-950 p-8 sm:p-10 text-white">
            <h2 className="max-w-xl text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
              Deposit your {symbol} and earn{" "}
              <span className="text-emerald-400">
                {apy != null ? `${apy.toFixed(2)}%` : "—"}
              </span>{" "}
              APY!
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <img src={logo} alt="" className="size-8 rounded-full" />
                  <ChevronsRight className="size-5 text-white/40" />
                  <img src={logo} alt="" className="size-8 rounded-full" />
                </div>
                <p className="mt-4 max-w-md text-sm text-white/65 leading-relaxed">
                  {isHighYield ? (
                    <>
                      Deposit {symbol} LP tokens into a pooled market for higher
                      yield with higher risk. Rates update as pool utilization
                      evolves.{" "}
                      <span className="text-whale-gold">Higher risk</span>
                    </>
                  ) : (
                    <>
                      Deposit your {symbol} into DorkFi Savings to earn a
                      transparent APY in {symbol}. The rate updates
                      automatically as markets evolve.{" "}
                      <span className="text-ocean-teal">Learn more</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <DorkFiButton
                  className="rounded-xl px-6 h-11 min-w-[140px]"
                  onClick={openDeposit}
                >
                  {activeAccount ? "Deposit" : "Connect Wallet"}
                </DorkFiButton>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
                {CHART_TABS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChartTab(item)}
                    className={cn(
                      "rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-colors",
                      chartTab === item
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
                {CHART_RANGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChartRange(item)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      chartRange === item
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8">
              {chartTab === "Savings Rate" ? (
                <SavingsRateChart data={rateHistory} />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">
                  {chartTab} data is unavailable yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Supported assets
            </h2>
            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">Balance</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-4">
                    <span className="flex items-center gap-2 font-medium">
                      <img src={logo} alt="" className="size-6 rounded-full" />
                      {symbol}
                    </span>
                  </td>
                  <td className="py-4 text-muted-foreground tabular-nums">
                    {balanceLabel}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={openDeposit}
                      className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                    >
                      Deposit
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {quote.isLoading ? (
            <p className="text-center text-xs text-muted-foreground">
              Loading market data…
            </p>
          ) : quote.error ? (
            <p className="text-center text-xs text-destructive">{quote.error}</p>
          ) : null}
        </div>
      </div>

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      <EasySavingsDepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        route={route}
        networkId={networkId}
        isHighYield={isHighYield}
        onConnectWallet={() => {
          setDepositOpen(false);
          setWalletModalOpen(true);
        }}
      />
    </section>
  );
};

export default SavingsCard;
