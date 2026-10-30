/** Browser client for Easy Start XO Swap proxy (`/api/xo-swap`). */

import { formatXoSwapError } from "@/lib/easyStart/xoSwap/errors";
import type {
  XoCreateOrderInput,
  XoOrder,
  XoQuote,
  XoRate,
} from "@/lib/easyStart/xoSwap/types";

export type XoSwapHealth = {
  ok: boolean;
  configured: boolean;
  appName: boolean;
};

/** Per-request cap. The server proxy times out at 20s; this is slightly longer so its error wins. */
const XO_SWAP_FETCH_TIMEOUT_MS = 25_000;

export type XoRequest = {
  signal?: AbortSignal;
};

function xoSwapBase(): string {
  const raw = import.meta.env.VITE_XO_SWAP_API_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/+$/, "");
  return "/api/xo-swap";
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  const ac = new AbortController();
  const follow = (source: AbortSignal) => {
    if (ac.signal.aborted) return;
    ac.abort(source.reason);
  };
  if (signal.aborted) follow(signal);
  else signal.addEventListener("abort", () => follow(signal), { once: true });
  if (timeout.aborted) follow(timeout);
  else timeout.addEventListener("abort", () => follow(timeout), { once: true });
  return ac.signal;
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name: unknown }).name) : "";
  const message = err instanceof Error ? err.message : "";
  return name === "TimeoutError" || /timeout/i.test(message);
}

async function xoFetch(
  path: string,
  init: RequestInit | undefined,
  req?: XoRequest
): Promise<Response> {
  try {
    return await fetch(`${xoSwapBase()}${path}`, {
      ...init,
      signal: withTimeout(req?.signal, XO_SWAP_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new Error("The USDC move timed out. Try again.");
    }
    throw err;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & {
    error?: string;
    details?: string;
    code?: string;
    status?: number;
  };
  if (!res.ok) {
    throw new Error(formatXoSwapError(data, `XO Swap API ${res.status}`));
  }
  return data;
}

function asRateList(data: unknown): XoRate[] {
  if (Array.isArray(data)) return data as XoRate[];
  if (data && typeof data === "object") {
    const obj = data as { rates?: unknown; data?: unknown };
    if (Array.isArray(obj.rates)) return obj.rates as XoRate[];
    if (Array.isArray(obj.data)) return obj.data as XoRate[];
  }
  return [];
}

function normalizeOrder(data: unknown): XoOrder {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid XO Swap order response");
  }
  const o = data as Record<string, unknown>;
  const id = String(o.id ?? o.orderId ?? "");
  if (!id) throw new Error("XO Swap order missing id");
  return {
    ...o,
    id,
    payInAddress:
      typeof o.payInAddress === "string"
        ? o.payInAddress
        : typeof o.payinAddress === "string"
          ? o.payinAddress
          : undefined,
    status: (o.status as XoOrder["status"]) ?? undefined,
    message: typeof o.message === "string" ? o.message : undefined,
  };
}

export async function fetchXoSwapHealth(req?: XoRequest): Promise<XoSwapHealth> {
  const res = await xoFetch("/health", undefined, req);
  return parseJson<XoSwapHealth>(res);
}

export async function fetchXoPairRates(
  pairId: string,
  req?: XoRequest
): Promise<XoRate[]> {
  const res = await xoFetch(
    `/pair/${encodeURIComponent(pairId)}/rates`,
    undefined,
    req
  );
  const data = await parseJson<unknown>(res);
  return asRateList(data);
}

export async function fetchXoPairQuote(
  pairId: string,
  amount: number,
  req?: XoRequest
): Promise<XoQuote> {
  const res = await xoFetch(
    `/pair/${encodeURIComponent(pairId)}/quotes?amount=${encodeURIComponent(String(amount))}`,
    undefined,
    req
  );
  return parseJson<XoQuote>(res);
}

export async function createXoFixedOrder(
  input: XoCreateOrderInput,
  req?: XoRequest
): Promise<XoOrder> {
  const res = await xoFetch(
    "/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    req
  );
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function createXoFloatingOrder(
  input: XoCreateOrderInput,
  req?: XoRequest
): Promise<XoOrder> {
  const res = await xoFetch(
    "/orders/float",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    req
  );
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function updateXoOrder(
  orderId: string,
  body: { fromTransactionId: string },
  req?: XoRequest
): Promise<XoOrder> {
  const res = await xoFetch(
    `/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    req
  );
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function fetchXoOrder(
  orderId: string,
  req?: XoRequest
): Promise<XoOrder> {
  const res = await xoFetch(
    `/orders/${encodeURIComponent(orderId)}`,
    undefined,
    req
  );
  return normalizeOrder(await parseJson<unknown>(res));
}
