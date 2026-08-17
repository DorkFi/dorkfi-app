import {
  COINBASE_PRODUCT_BY_ASSET,
  getPriceFeedRestBase,
  getPriceFeedWsUrl,
} from "../marketConfig";
import { asDisplayPrice, type LongShortAsset, type PricePoint } from "../types";
import type { AssetPriceFeedProvider, HistoricalPriceQuery } from "./types";

type CoinbaseCandle = [
  number, // time sec
  number, // low
  number, // high
  number, // open
  number, // close
  number, // volume
];

/**
 * Coinbase Exchange public REST + WebSocket feed for Long/Short charts.
 * Display prices only — not settlement.
 *
 * Env (optional):
 * - VITE_LONGSHORT_PRICE_REST_URL
 * - VITE_LONGSHORT_PRICE_WS_URL
 */
export class CoinbasePriceFeedProvider implements AssetPriceFeedProvider {
  readonly id = "coinbase-exchange";

  async fetchHistorical(query: HistoricalPriceQuery): Promise<PricePoint[]> {
    const product = COINBASE_PRODUCT_BY_ASSET[query.asset];
    const granularity = query.granularitySec ?? pickGranularity(query.startMs, query.endMs);
    const base = getPriceFeedRestBase();
    const startIso = new Date(query.startMs).toISOString();
    const endIso = new Date(query.endMs).toISOString();
    const url =
      `${base}/products/${product}/candles` +
      `?start=${encodeURIComponent(startIso)}` +
      `&end=${encodeURIComponent(endIso)}` +
      `&granularity=${granularity}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Price history HTTP ${res.status}`);
    }
    const raw = (await res.json()) as CoinbaseCandle[];
    if (!Array.isArray(raw)) return [];

    // Coinbase returns newest-first
    const points: PricePoint[] = raw
      .map((row) => ({
        time: Number(row[0]),
        value: asDisplayPrice(Number(row[4])),
      }))
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .sort((a, b) => a.time - b.time);

    return points;
  }

  subscribeLive(
    asset: LongShortAsset,
    onPrice: (price: ReturnType<typeof asDisplayPrice>, atMs: number) => void,
    onStatus: (
      status: "connecting" | "live" | "reconnecting" | "error",
      detail?: string
    ) => void
  ): () => void {
    const product = COINBASE_PRODUCT_BY_ASSET[asset];
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectAttempt = 0;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let lastMsgMs = Date.now();

    const clearHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      onStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      try {
        ws = new WebSocket(getPriceFeedWsUrl());
      } catch (err) {
        onStatus("error", err instanceof Error ? err.message : "WS open failed");
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectAttempt = 0;
        lastMsgMs = Date.now();
        ws?.send(
          JSON.stringify({
            type: "subscribe",
            product_ids: [product],
            channels: ["ticker"],
          })
        );
        onStatus("live");
        clearHeartbeat();
        heartbeatTimer = setInterval(() => {
          if (Date.now() - lastMsgMs > 15_000) {
            onStatus("reconnecting", "stale");
            try {
              ws?.close();
            } catch {
              /* ignore */
            }
          }
        }, 5_000);
      };

      ws.onmessage = (ev) => {
        lastMsgMs = Date.now();
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            price?: string;
            time?: string;
          };
          if (msg.type !== "ticker" || msg.price == null) return;
          const price = Number(msg.price);
          if (!Number.isFinite(price)) return;
          const atMs = msg.time ? Date.parse(msg.time) : Date.now();
          onPrice(asDisplayPrice(price), Number.isFinite(atMs) ? atMs : Date.now());
          onStatus("live");
        } catch {
          /* ignore malformed */
        }
      };

      ws.onerror = () => {
        onStatus("error", "WebSocket error");
      };

      ws.onclose = () => {
        clearHeartbeat();
        if (!closed) scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectAttempt += 1;
      const delay = Math.min(30_000, 800 * 2 ** Math.min(reconnectAttempt, 5));
      onStatus("reconnecting");
      setTimeout(connect, delay);
    };

    // Visibility wake — force reconnect if tab slept
    const onVis = () => {
      if (document.visibilityState === "visible" && !closed) {
        lastMsgMs = 0;
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);

    connect();

    return () => {
      closed = true;
      clearHeartbeat();
      document.removeEventListener("visibilitychange", onVis);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    };
  }
}

function pickGranularity(startMs: number, endMs: number): number {
  const spanSec = Math.max(60, (endMs - startMs) / 1000);
  // Stay under Coinbase ~300 candle soft limit
  if (spanSec <= 3 * 3600) return 60;
  if (spanSec <= 12 * 3600) return 300;
  if (spanSec <= 48 * 3600) return 900;
  return 3600;
}

let defaultProvider: AssetPriceFeedProvider | null = null;

export function getDefaultPriceFeedProvider(): AssetPriceFeedProvider {
  if (!defaultProvider) defaultProvider = new CoinbasePriceFeedProvider();
  return defaultProvider;
}
