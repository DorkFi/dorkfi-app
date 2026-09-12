/** Client helpers for Easy Start Coinbase + MoonPay off-ramp. */

export type OfframpHealth = {
  ok: boolean;
  coinbase: boolean;
  moonpay: boolean;
};

export type CoinbaseSessionResult = {
  sessionToken: string;
  partnerUserRef: string;
  sellUrl: string;
};

/** MoonPay Sell currency code for Circle USDC on Base (not Ethereum `usdc`). */
export const MOONPAY_SELL_BASE_USDC = "usdc_base";

export type CoinbaseAmount = {
  value?: string;
  currency?: string;
};

export type CoinbaseSellTx = {
  status?: string;
  to_address?: string;
  toAddress?: string;
  sell_amount?: string | CoinbaseAmount;
  sellAmount?: string | CoinbaseAmount;
  asset?: string;
  network?: string;
  from_address?: string;
  fromAddress?: string;
  [key: string]: unknown;
};

function offrampBase(): string {
  const raw = import.meta.env.VITE_OFFRAMP_API_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/+$/, "");
  return "/api/offramp";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Off-ramp API ${res.status}`
    );
  }
  return data;
}

export async function fetchOfframpHealth(): Promise<OfframpHealth> {
  const res = await fetch(`${offrampBase()}/health`);
  return parseJson<OfframpHealth>(res);
}

export async function createCoinbaseOfframpSession(args: {
  address: string;
  amount?: string;
  partnerUserRef?: string;
  redirectUrl?: string;
}): Promise<CoinbaseSessionResult> {
  const res = await fetch(`${offrampBase()}/coinbase/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: args.address,
      amount: args.amount,
      partnerUserRef: args.partnerUserRef,
      redirectUrl:
        args.redirectUrl ||
        import.meta.env.VITE_OFFRAMP_REDIRECT_URL ||
        `${window.location.origin}/portfolio`,
    }),
  });
  return parseJson<CoinbaseSessionResult>(res);
}

export async function fetchCoinbaseOfframpStatus(
  partnerUserRef: string
): Promise<{ transactions: CoinbaseSellTx[]; latest: CoinbaseSellTx | null }> {
  const res = await fetch(
    `${offrampBase()}/coinbase/status/${encodeURIComponent(partnerUserRef)}`
  );
  return parseJson(res);
}

export async function signMoonpayWidgetUrl(url: string): Promise<string> {
  const res = await fetch(`${offrampBase()}/moonpay/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await parseJson<{ signature: string }>(res);
  return data.signature;
}

export function coinbaseDepositAddress(tx: CoinbaseSellTx | null): string | null {
  if (!tx) return null;
  const addr = tx.to_address || tx.toAddress;
  return typeof addr === "string" && addr.startsWith("0x") ? addr : null;
}

/** CDP returns `{ value, currency }` in live payloads; older docs called it a string. */
export function parseCoinbaseAmount(amt: unknown): string | null {
  if (amt == null) return null;
  if (typeof amt === "number") {
    return Number.isFinite(amt) && amt > 0 ? String(amt) : null;
  }
  if (typeof amt === "string") {
    const trimmed = amt.trim();
    if (!trimmed || trimmed === "[object Object]") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? trimmed : null;
  }
  if (typeof amt === "object" && "value" in (amt as object)) {
    return parseCoinbaseAmount((amt as CoinbaseAmount).value);
  }
  return null;
}

export function coinbaseSellAmount(tx: CoinbaseSellTx | null): string | null {
  if (!tx) return null;
  return parseCoinbaseAmount(tx.sell_amount ?? tx.sellAmount);
}

export function moonpayPublishableKey(): string | null {
  const key = import.meta.env.VITE_MOONPAY_API_KEY as string | undefined;
  return key?.trim() || null;
}
