import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { LiveMarketChart } from "@/components/bets/LiveMarketChart";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { useLiveAssetPrice } from "@/hooks/useLiveAssetPrice";
import {
  formatCountdown,
  getMarketWindow,
} from "@/features/longShort/marketWindow";
import type { LongShortMarketDef } from "@/features/longShort/types";

const LEVERAGE_STEPS = [5, 10, 25, 50, 100] as const;

type Side = "LONG" | "SHORT";

type LongShortMarketDetailProps = {
  market: LongShortMarketDef;
  preferredSide: Side;
  bettingPower: number;
  onBack: () => void;
  onPlace: (side: Side, leverage: number, amount: number) => void;
};

function formatUsd(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

export function LongShortMarketDetail({
  market,
  preferredSide,
  bettingPower,
  onBack,
  onPlace,
}: LongShortMarketDetailProps) {
  const [nowMs, setNowMs] = useState(Date.now());
  const marketWindow = useMemo(
    () => getMarketWindow(market.horizon, nowMs),
    [market.horizon, nowMs]
  );

  const live = useLiveAssetPrice({
    asset: market.asset,
    marketStartMs: marketWindow.startMs,
    marketEndMs: marketWindow.endMs,
    marketKey: market.id,
    enabled: true,
  });

  const ended = nowMs >= marketWindow.endMs;
  const msLeft = Math.max(0, marketWindow.endMs - nowMs);
  const statusLabel = ended ? "ENDED" : "LIVE";

  const [tradeSide, setTradeSide] = useState<Side>(preferredSide);
  const [leverage, setLeverage] = useState(10);
  const [amount, setAmount] = useState("");
  const [localMsg, setLocalMsg] = useState("");

  useEffect(() => {
    setTradeSide(preferredSide);
  }, [preferredSide]);

  useEffect(() => {
    const id = globalThis.setInterval(() => setNowMs(Date.now()), 250);
    return () => globalThis.clearInterval(id);
  }, []);

  const icon = getTokenImagePath(market.asset);
  const feedWarn =
    live.isStale ||
    live.feedStatus === "reconnecting" ||
    live.feedStatus === "connecting" ||
    live.feedStatus === "error";

  const handlePlace = () => {
    if (ended) {
      setLocalMsg("Market ended — waiting for settlement.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setLocalMsg("Type an amount to place a bet.");
      return;
    }
    if (n > bettingPower + 1e-9) {
      setLocalMsg(`Max is ${formatUsd(bettingPower)} (betting power).`);
      return;
    }
    setLocalMsg("");
    onPlace(tradeSide, leverage, n);
    setAmount("");
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to markets
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={icon}
            alt={market.asset}
            className="h-10 w-10 rounded-full border border-border/50 object-contain bg-white shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {market.title}
            </h2>
            <p className="text-sm text-muted-foreground">{market.blurb}</p>
          </div>
        </div>
        <span
          className={`text-xs font-bold tracking-wide px-2.5 py-1 rounded-md border ${
            ended
              ? "border-muted-foreground/40 text-muted-foreground"
              : "border-ocean-teal/50 text-ocean-teal bg-ocean-teal/10"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Price to beat"
          value={
            live.priceToBeat != null ? formatUsd(Number(live.priceToBeat)) : "—"
          }
        />
        <Stat
          label="Current price"
          value={
            live.displayPrice != null && !live.isStale
              ? formatUsd(Number(live.displayPrice))
              : live.displayPrice != null
                ? formatUsd(Number(live.displayPrice))
                : "—"
          }
          sub={
            live.deltaUsd != null && live.deltaPct != null ? (
              <span
                className={
                  live.deltaUsd >= 0 ? "text-green-400" : "text-red-400"
                }
              >
                {live.deltaUsd >= 0 ? "▲" : "▼"} {formatUsd(Math.abs(live.deltaUsd))}{" "}
                ({live.deltaPct >= 0 ? "+" : ""}
                {live.deltaPct.toFixed(2)}%)
              </span>
            ) : null
          }
        />
        <Stat label="Time left" value={formatCountdown(msLeft)} mono />
        <Stat
          label="Leading"
          value={
            live.leadingSide == null
              ? "—"
              : live.leadingSide === "FLAT"
                ? "FLAT"
                : live.leadingSide
          }
          valueClassName={
            live.leadingSide === "LONG"
              ? "text-green-400"
              : live.leadingSide === "SHORT"
                ? "text-red-400"
                : undefined
          }
        />
      </div>

      {feedWarn && (
        <p className="text-xs text-whale-gold">
          {live.feedStatus === "error"
            ? live.error || "Price feed error"
            : "Price feed reconnecting…"}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] gap-4">
        <div className="rounded-xl border border-border/50 bg-card/40 p-2 sm:p-3 min-h-[320px]">
          {live.historical.length === 0 && !live.error ? (
            <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
              Loading chart…
            </div>
          ) : (
            <LiveMarketChart
              historical={live.historical}
              priceToBeat={live.priceToBeat}
              height={360}
            />
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-3 h-fit">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ended}
              onClick={() => setTradeSide("LONG")}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                tradeSide === "LONG"
                  ? "border-green-400 bg-green-500/20"
                  : "border-green-500/30 bg-green-500/5"
              } ${ended ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-sm font-extrabold text-green-400">LONG</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {market.asset} finishes above{" "}
                {live.priceToBeat != null
                  ? formatUsd(Number(live.priceToBeat))
                  : "target"}
              </div>
            </button>
            <button
              type="button"
              disabled={ended}
              onClick={() => setTradeSide("SHORT")}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                tradeSide === "SHORT"
                  ? "border-red-400 bg-red-500/20"
                  : "border-red-500/30 bg-red-500/5"
              } ${ended ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-sm font-extrabold text-red-400">SHORT</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {market.asset} finishes below{" "}
                {live.priceToBeat != null
                  ? formatUsd(Number(live.priceToBeat))
                  : "target"}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {LEVERAGE_STEPS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={ended}
                onClick={() => setLeverage(n)}
                className={`rounded-md py-1.5 text-[11px] font-bold transition-colors ${
                  leverage === n
                    ? "bg-ocean-teal/30 border border-ocean-teal text-white"
                    : "bg-muted/40 border border-border/50 text-muted-foreground hover:bg-muted/60"
                } ${ended ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {n}x
              </button>
            ))}
          </div>

          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Amount"
            disabled={ended}
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ocean-teal/50 disabled:opacity-50"
          />

          <DorkFiButton
            size="sm"
            disabled={ended}
            className={
              tradeSide === "LONG"
                ? "w-full min-w-0 bg-green-500/20 border border-green-400 text-green-400 hover:bg-green-500/30"
                : "w-full min-w-0 bg-red-500/20 border border-red-400 text-red-400 hover:bg-red-500/30"
            }
            onClick={handlePlace}
          >
            Place {tradeSide === "LONG" ? "Long" : "Short"} · {leverage}x
          </DorkFiButton>

          <p className="text-[11px] text-muted-foreground">
            Betting power {formatUsd(bettingPower)}
          </p>
          {localMsg && (
            <p className="text-xs text-muted-foreground">{localMsg}</p>
          )}
          {ended && (
            <p className="text-xs text-whale-gold">
              Market closed. Settlement uses the protocol oracle — not this chart
              feed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </p>
      <p
        className={`text-lg font-bold tabular-nums mt-0.5 ${
          mono ? "font-mono" : ""
        } ${valueClassName ?? "text-foreground"}`}
      >
        {value}
      </p>
      {sub ? <div className="text-xs mt-0.5">{sub}</div> : null}
    </div>
  );
}
