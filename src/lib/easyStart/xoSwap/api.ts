/** Browser client for Easy Start XO Swap proxy (`/api/xo-swap`). */

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

function xoSwapBase(): string {
  const raw = import.meta.env.VITE_XO_SWAP_API_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/+$/, "");
  return "/api/xo-swap";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & {
    error?: string;
    details?: string;
    code?: string;
    status?: number;
  };
  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.details === "string" && data.details) ||
      (typeof data.code === "string" && data.code) ||
      `XO Swap API ${res.status}`;
    throw new Error(msg);
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

export async function fetchXoSwapHealth(): Promise<XoSwapHealth> {
  const res = await fetch(`${xoSwapBase()}/health`);
  return parseJson<XoSwapHealth>(res);
}

export async function fetchXoPairRates(pairId: string): Promise<XoRate[]> {
  const res = await fetch(
    `${xoSwapBase()}/pair/${encodeURIComponent(pairId)}/rates`
  );
  const data = await parseJson<unknown>(res);
  return asRateList(data);
}

export async function fetchXoPairQuote(
  pairId: string,
  amount: number
): Promise<XoQuote> {
  const res = await fetch(
    `${xoSwapBase()}/pair/${encodeURIComponent(pairId)}/quotes?amount=${encodeURIComponent(String(amount))}`
  );
  return parseJson<XoQuote>(res);
}

export async function createXoFixedOrder(
  input: XoCreateOrderInput
): Promise<XoOrder> {
  const res = await fetch(`${xoSwapBase()}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function createXoFloatingOrder(
  input: XoCreateOrderInput
): Promise<XoOrder> {
  const res = await fetch(`${xoSwapBase()}/orders/float`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function updateXoOrder(
  orderId: string,
  body: { fromTransactionId: string }
): Promise<XoOrder> {
  const res = await fetch(
    `${xoSwapBase()}/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return normalizeOrder(await parseJson<unknown>(res));
}

export async function fetchXoOrder(orderId: string): Promise<XoOrder> {
  const res = await fetch(
    `${xoSwapBase()}/orders/${encodeURIComponent(orderId)}`
  );
  return normalizeOrder(await parseJson<unknown>(res));
}
