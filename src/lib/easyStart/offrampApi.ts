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

export type CoinbaseSellTx = {
  status?: string;
  to_address?: string;
  toAddress?: string;
  sell_amount?: string;
  sellAmount?: string;
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

export function coinbaseSellAmount(tx: CoinbaseSellTx | null): string | null {
  if (!tx) return null;
  const amt = tx.sell_amount || tx.sellAmount;
  return amt != null ? String(amt) : null;
}

export function moonpayPublishableKey(): string | null {
  const key = import.meta.env.VITE_MOONPAY_API_KEY as string | undefined;
  return key?.trim() || null;
}
