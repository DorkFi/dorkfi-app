import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { LongShortMarketDetail } from "@/components/bets/LongShortMarketDetail";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import {
  LONG_SHORT_MARKETS,
  PERP_ASSETS,
} from "@/features/longShort/marketConfig";
import type { LongShortMarketDef } from "@/features/longShort/types";

/** Alpha Arcade perps leverage steps (same as MCP / coming-soon UI). */
const LEVERAGE_STEPS = [5, 10, 25, 50, 100] as const;

type Bias = "bullish" | "bearish" | null;
type Side = "LONG" | "SHORT";

type OpenBet = {
  id: string;
  title: string;
  side: Side;
  stake: number;
  leverage: number;
};

function formatUsd(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Digits + optional single decimal only. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Bets desk — live dorkfi-app Header/Footer + Long/Short tickets + market charts.
 */
const BetsPage = () => {
  const [activeTab, setActiveTab] = useState("bets");
  const [bias, setBias] = useState<Bias>(null);
  const [bettingPower, setBettingPower] = useState(420.69);
  const [cash, setCash] = useState(420.69);
  const [selectedMarket, setSelectedMarket] =
    useState<LongShortMarketDef | null>(null);
  const [leverageByKey, setLeverageByKey] = useState<Record<string, number>>(
    () => {
      const init: Record<string, number> = {};
      for (const m of LONG_SHORT_MARKETS) init[`m:${m.id}`] = 10;
      for (const a of PERP_ASSETS) init[`p:${a}`] = 10;
      return init;
    }
  );
  const [amountByKey, setAmountByKey] = useState<Record<string, string>>({});
  const [openBets, setOpenBets] = useState<OpenBet[]>([]);
  const [lastEvent, setLastEvent] = useState("");

  const side: Side | null =
    bias === "bullish" ? "LONG" : bias === "bearish" ? "SHORT" : null;

  const setLev = (key: string, lev: number) => {
    setLeverageByKey((prev) => ({ ...prev, [key]: lev }));
  };

  const setAmount = (key: string, raw: string) => {
    setAmountByKey((prev) => ({ ...prev, [key]: sanitizeAmount(raw) }));
  };

  const fundAndPlace = (stake: number, label: string, leverage: number, placeSide: Side) => {
    if (stake <= 0) {
      setLastEvent("Enter an amount greater than 0.");
      return;
    }
    if (stake > bettingPower + 1e-9) {
      setLastEvent(`Max is ${formatUsd(bettingPower)} (betting power).`);
      return;
    }
    let nextCash = cash;
    if (stake > nextCash + 1e-9) {
      nextCash = stake;
    }
    nextCash = Math.round((nextCash - stake) * 100) / 100;
    const nextPower = Math.round((bettingPower - stake) * 100) / 100;
    setCash(nextCash);
    setBettingPower(Math.max(0, nextPower));
    setOpenBets((prev) => [
      {
        id: `bet-${Date.now()}`,
        title: label,
        side: placeSide,
        stake,
        leverage,
      },
      ...prev,
    ]);
    setLastEvent(`${placeSide} ${label} · ${formatUsd(stake)} @ ${leverage}x`);
  };

  const placeMarket = (market: LongShortMarketDef) => {
    if (!side) return;
    const key = `m:${market.id}:${side}`;
    const levKey = `m:${market.id}`;
    const parsed = parseAmount(amountByKey[key] ?? "");
    if (parsed == null) {
      setLastEvent("Type an amount to place a bet.");
      return;
    }
    fundAndPlace(parsed, market.title, leverageByKey[levKey] ?? 10, side);
  };

  const placePerp = (asset: string) => {
    if (!side) return;
    const key = `p:${asset}:${side}`;
    const levKey = `p:${asset}`;
    const parsed = parseAmount(amountByKey[key] ?? "");
    if (parsed == null) {
      setLastEvent("Type a margin amount.");
      return;
    }
    fundAndPlace(parsed, `${asset} Perp`, leverageByKey[levKey] ?? 10, side);
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <div className="absolute inset-0 z-0 light-mode-beach-bg dark:hidden pointer-events-none" />
      <div className="absolute inset-0 z-0 beach-overlay dark:hidden pointer-events-none" />
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay pointer-events-none" />

      <div className="relative z-50 shrink-0">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 space-y-5">
        {selectedMarket && side ? (
          <LongShortMarketDetail
            market={selectedMarket}
            preferredSide={side}
            bettingPower={bettingPower}
            onBack={() => setSelectedMarket(null)}
            onPlace={(placeSide, leverage, amount) => {
              fundAndPlace(amount, selectedMarket.title, leverage, placeSide);
            }}
          />
        ) : (
          <>
            <section className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="space-y-2 flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                  Long/Short
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                  {bias === "bullish"
                    ? "Feeling up only? Dorks or chubs, everyone’s either long or short. Size doesn’t lie — go long and bet big (or keep it modest)."
                    : bias === "bearish"
                      ? "Feeling down bad? Dorks or chubs, everyone’s either long or short. Size doesn’t lie — go short and bet big (or keep it modest)."
                      : "Dorks or chubs, everyone’s either long or short. Size doesn’t lie — pick a side and bet big (or keep it modest)."}
                </p>
              </div>

              <div className="relative w-full md:w-[200px] lg:w-[220px] shrink-0 aspect-square max-h-[200px] md:max-h-none flex items-center justify-center">
                {bias === "bullish" ? (
                  <img
                    src="/lovable-uploads/bets/bullish-chub.png"
                    alt="Bullish — up only"
                    className="max-h-full max-w-full object-contain drop-shadow-lg transition-opacity duration-300"
                  />
                ) : bias === "bearish" ? (
                  <img
                    src="/lovable-uploads/bets/bearish-down-bad.png"
                    alt="Bearish — down bad"
                    className="max-h-full max-w-full object-contain drop-shadow-lg transition-opacity duration-300"
                  />
                ) : (
                  <img
                    src="/lovable-uploads/bets/neutral-chub.png"
                    alt="Neutral"
                    className="max-h-full max-w-full object-contain drop-shadow-lg transition-opacity duration-300"
                  />
                )}
              </div>
            </section>

            <section>
              <p className="text-sm text-muted-foreground font-medium">
                Betting power
              </p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums text-whale-gold mt-1">
                {formatUsd(bettingPower)}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-1">
                Are you bullish or bearish?
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Pick a bias, then open a market for the live chart and trade ticket.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBias("bullish")}
                  className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${
                    bias === "bullish"
                      ? "border-green-400 bg-green-500/20"
                      : "border-green-500/40 bg-green-500/10 hover:bg-green-500/15"
                  }`}
                >
                  <div className="text-xl font-extrabold uppercase tracking-wide text-green-400">
                    Bullish
                  </div>
                  <div className="text-sm text-green-400/80 mt-1">Long markets</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBias("bearish")}
                  className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${
                    bias === "bearish"
                      ? "border-red-400 bg-red-500/20"
                      : "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                  }`}
                >
                  <div className="text-xl font-extrabold uppercase tracking-wide text-red-400">
                    Bearish
                  </div>
                  <div className="text-sm text-red-400/80 mt-1">Short markets</div>
                </button>
              </div>
            </section>

            {!side && (
              <p className="text-sm text-muted-foreground">
                Select Bullish or Bearish to open the desk.
              </p>
            )}

            {side && (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {LONG_SHORT_MARKETS.map((market) => {
                  const levKey = `m:${market.id}`;
                  const amtKey = `m:${market.id}:${side}`;
                  const lev = leverageByKey[levKey] ?? 10;
                  return (
                    <TicketCard
                      key={market.id}
                      asset={market.asset}
                      title={market.title}
                      blurb={market.blurb}
                      side={side}
                      lev={lev}
                      amount={amountByKey[amtKey] ?? ""}
                      onOpen={() => setSelectedMarket(market)}
                      onLev={(n) => setLev(levKey, n)}
                      onAmount={(v) => setAmount(amtKey, v)}
                      onPlace={() => placeMarket(market)}
                    />
                  );
                })}

                {PERP_ASSETS.map((asset) => {
                  const levKey = `p:${asset}`;
                  const amtKey = `p:${asset}:${side}`;
                  const lev = leverageByKey[levKey] ?? 10;
                  return (
                    <TicketCard
                      key={asset}
                      asset={asset}
                      title={`${asset} Perp`}
                      blurb="Coming soon · Alpha Arcade leverage"
                      side={side}
                      lev={lev}
                      amount={amountByKey[amtKey] ?? ""}
                      onLev={(n) => setLev(levKey, n)}
                      onAmount={(v) => setAmount(amtKey, v)}
                      onPlace={() => placePerp(asset)}
                      soon
                    />
                  );
                })}
              </section>
            )}

            {lastEvent && (
              <p className="text-xs text-muted-foreground">{lastEvent}</p>
            )}

            {openBets.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-base font-bold text-foreground">
                  Open positions
                </h3>
                {openBets.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-sm border border-border/40 rounded-lg px-3 py-2"
                  >
                    <span>
                      <span
                        className={
                          b.side === "LONG" ? "text-green-400" : "text-red-400"
                        }
                      >
                        {b.side}
                      </span>{" "}
                      · {b.title} · {formatUsd(b.stake)} · {b.leverage}x
                    </span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <div className="relative z-10 shrink-0">
        <Footer />
      </div>
    </div>
  );
};

function TicketCard({
  asset,
  title,
  blurb,
  side,
  lev,
  amount,
  onOpen,
  onLev,
  onAmount,
  onPlace,
  soon,
}: {
  asset: string;
  title: string;
  blurb: string;
  side: Side;
  lev: number;
  amount: string;
  onOpen?: () => void;
  onLev: (n: number) => void;
  onAmount: (v: string) => void;
  onPlace: () => void;
  soon?: boolean;
}) {
  const sideColor = side === "LONG" ? "text-green-400" : "text-red-400";
  const icon = getTokenImagePath(asset);

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-2.5 h-full flex flex-col">
      <button
        type="button"
        disabled={soon || !onOpen}
        onClick={onOpen}
        className={`flex items-start gap-2.5 min-w-0 text-left rounded-lg -m-1 p-1 ${
          soon || !onOpen
            ? "cursor-default"
            : "hover:bg-muted/30 transition-colors cursor-pointer"
        }`}
      >
        <img
          src={icon}
          alt={asset}
          className="h-8 w-8 rounded-full border border-border/50 object-contain bg-white shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm text-foreground leading-tight truncate">
            {title}{" "}
            <span className={`text-[10px] font-bold tracking-wide ${sideColor}`}>
              {side}
            </span>
            {soon && (
              <span className="ml-1.5 text-[10px] font-semibold text-pink-400">
                Soon
              </span>
            )}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {blurb}
            {!soon && onOpen ? " · Open live chart" : ""}
          </p>
        </div>
      </button>

      <div className="grid grid-cols-5 gap-1">
        {LEVERAGE_STEPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onLev(n)}
            className={`rounded-md py-1.5 text-[11px] font-bold transition-colors ${
              lev === n
                ? "bg-ocean-teal/30 border border-ocean-teal text-white"
                : "bg-muted/40 border border-border/50 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {n}x
          </button>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-1 gap-2">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Amount"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.ctrlKey ||
              e.metaKey ||
              e.altKey ||
              [
                "Backspace",
                "Delete",
                "Tab",
                "Escape",
                "Enter",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
              ].includes(e.key)
            ) {
              return;
            }
            if (e.key === "." && !amount.includes(".")) return;
            if (!/^\d$/.test(e.key)) e.preventDefault();
          }}
          className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ocean-teal/50"
        />
        <DorkFiButton
          size="sm"
          variant={side === "LONG" ? "primary" : "secondary"}
          className={
            side === "LONG"
              ? "w-full min-w-0 bg-green-500/20 border border-green-400 text-green-400 hover:bg-green-500/30"
              : "w-full min-w-0 bg-red-500/20 border border-red-400 text-red-400 hover:bg-red-500/30"
          }
          onClick={onPlace}
        >
          Place {side === "LONG" ? "Long" : "Short"} · {lev}x
        </DorkFiButton>
      </div>
    </div>
  );
}

export default BetsPage;
