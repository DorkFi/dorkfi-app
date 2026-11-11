import { decodeAddress } from "algosdk";
import { X_SHARE_API_DEFAULT_ORIGIN } from "@/services/xShareService";

export type OfframpHealth = {
  ok: boolean;
  coinbase: boolean;
  moonpay: boolean;
  walletBind?: boolean;
};

export type CoinbaseSessionResult = {
  sessionToken: string;
  partnerUserRef: string;
  /** Coinbase-hosted Onramp (buy USDC on Base). */
  buyUrl: string;
  /** Coinbase-hosted Offramp (sell USDC). */
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
  // The static app cannot serve /api/offramp. Production uses the share server.
  if (import.meta.env.PROD) {
    return `${X_SHARE_API_DEFAULT_ORIGIN}/api/offramp`;
  }
  return "/api/offramp";
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(text.trim() || `Off-ramp API ${res.status}`);
    }
  }
  if (!res.ok) {
    throw new Error(
      data?.error || text.trim() || `Off-ramp API ${res.status}`
    );
  }
  if (!data) {
    throw new Error(`Off-ramp API ${res.status}`);
  }
  return data;
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchOfframpHealth(): Promise<OfframpHealth> {
  const res = await fetch(`${offrampBase()}/health`);
  return parseJson<OfframpHealth>(res);
}

/** Mint a CDP session token and Coinbase-hosted buy + sell URLs. */
export async function createCoinbaseSession(args: {
  address: string;
  accessToken: string;
  amount?: string;
  redirectUrl?: string;
  /** `algorand` buys or sells ALGO on the xChain account. Omitted keeps Base USDC. */
  destination?: "base" | "algorand";
  /** Bank ACH or the user's Coinbase crypto balance. Used with an ALGO sell. */
  cashoutMethod?: "ACH_BANK_ACCOUNT" | "CRYPTO_ACCOUNT";
}): Promise<CoinbaseSessionResult> {
  const res = await fetch(`${offrampBase()}/coinbase/session`, {
    method: "POST",
    headers: authHeaders(args.accessToken),
    body: JSON.stringify({
      address: args.address,
      amount: args.amount,
      destination: args.destination,
      cashoutMethod: args.cashoutMethod,
      redirectUrl:
        args.redirectUrl ||
        import.meta.env.VITE_OFFRAMP_REDIRECT_URL ||
        `${window.location.origin}/portfolio`,
    }),
  });
  return parseJson<CoinbaseSessionResult>(res);
}

/**
 * Coinbase ALGO buy for a connected Algorand wallet.
 * `walletProof` is a signed 0 ALGO payment; the server checks it and skips Privy.
 */
export async function createWalletCoinbaseSession(args: {
  address: string;
  walletProof: string;
  amount?: string;
  redirectUrl?: string;
}): Promise<CoinbaseSessionResult> {
  const res = await fetch(`${offrampBase()}/coinbase/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: args.address,
      walletProof: args.walletProof,
      amount: args.amount,
      destination: "algorand",
      redirectUrl:
        args.redirectUrl ||
        import.meta.env.VITE_OFFRAMP_REDIRECT_URL ||
        `${window.location.origin}/portfolio`,
    }),
  });
  return parseJson<CoinbaseSessionResult>(res);
}

/** @deprecated Use createCoinbaseSession */
export const createCoinbaseOfframpSession = createCoinbaseSession;

export class OfframpStatusForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("Forbidden");
    this.name = "OfframpStatusForbiddenError";
  }
}

export async function fetchCoinbaseOfframpStatus(
  partnerUserRef: string,
  accessToken: string
): Promise<{ transactions: CoinbaseSellTx[]; latest: CoinbaseSellTx | null }> {
  const res = await fetch(
    `${offrampBase()}/coinbase/status/${encodeURIComponent(partnerUserRef)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 403) {
    throw new OfframpStatusForbiddenError();
  }
  return parseJson(res);
}

export async function signMoonpayWidgetUrl(
  url: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(`${offrampBase()}/moonpay/sign`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ url }),
  });
  const data = await parseJson<{ signature: string }>(res);
  return data.signature;
}

function isAlgorandAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}

export function coinbaseDepositAddress(
  tx: CoinbaseSellTx | null,
  kind: "evm" | "algorand" = "evm"
): string | null {
  if (!tx) return null;
  const addr = tx.to_address || tx.toAddress;
  if (typeof addr !== "string") return null;
  const trimmed = addr.trim();
  if (kind === "algorand") {
    return isAlgorandAddress(trimmed) ? trimmed : null;
  }
  return trimmed.startsWith("0x") ? trimmed : null;
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

export function coinbaseFromAddress(tx: CoinbaseSellTx | null): string | null {
  if (!tx) return null;
  const addr = tx.from_address || tx.fromAddress;
  if (typeof addr !== "string") return null;
  const trimmed = addr.trim();
  return trimmed || null;
}

export function coinbaseFromAddressMatches(
  tx: CoinbaseSellTx | null,
  connected: string | null | undefined,
  kind: "evm" | "algorand"
): boolean {
  const from = coinbaseFromAddress(tx);
  const wallet = connected?.trim();
  if (!from || !wallet) return false;
  if (kind === "algorand") return from === wallet;
  return from.toLowerCase() === wallet.toLowerCase();
}

/** Absolute tolerance is one atomic unit for both ALGO and USDC. */
export function coinbaseAmountsMatch(expected: string, actual: string): boolean {
  const left = Number(expected);
  const right = Number(actual);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return false;
  }
  return Math.abs(left - right) <= 0.000001;
}

export type CoinbaseCashOutDecision =
  | { action: "wait" }
  | { action: "reject"; reason: "from_address" }
  | {
      action: "confirm";
      to: string;
      amount: string;
      amountMatches: boolean;
    };

/**
 * Decide whether a polled sale may be shown for confirmation.
 * This never authorizes a broadcast. The sheet sends only after the user confirms.
 */
export function evaluateCoinbaseCashOutSale(args: {
  tx: CoinbaseSellTx | null;
  kind: "evm" | "algorand";
  connectedAddress: string | null | undefined;
  expectedAmount?: string | null;
}): CoinbaseCashOutDecision {
  const from = coinbaseFromAddress(args.tx);
  const connected = args.connectedAddress?.trim();
  if (
    from &&
    connected &&
    !coinbaseFromAddressMatches(args.tx, connected, args.kind)
  ) {
    return { action: "reject", reason: "from_address" };
  }

  const to = coinbaseDepositAddress(args.tx, args.kind);
  const amount = coinbaseSellAmount(args.tx);
  if (
    !to ||
    !amount ||
    !from ||
    !connected ||
    !coinbaseFromAddressMatches(args.tx, connected, args.kind)
  ) {
    return { action: "wait" };
  }

  const expected = args.expectedAmount?.trim() ?? "";
  return {
    action: "confirm",
    to,
    amount,
    amountMatches: expected.length === 0 || coinbaseAmountsMatch(expected, amount),
  };
}

export function moonpayPublishableKey(): string | null {
  const key = import.meta.env.VITE_MOONPAY_API_KEY as string | undefined;
  return key?.trim() || null;
}
