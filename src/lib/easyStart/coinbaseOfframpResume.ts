/**
 * Same-tab Coinbase cash-out resume.
 * Keep query keys in sync with server/offramp/coinbaseUrls.ts.
 */

export const CB_OFFRAMP_QUERY = "cb_offramp";
export const CB_OFFRAMP_REF_QUERY = "ref";
export const CB_OFFRAMP_PENDING_KEY = "simplfi.cb_offramp.pending";
const MAX_AGE_MS = 30 * 60 * 1000;

export type CoinbaseOfframpPending = {
  partnerUserRef: string;
  amount: string | null;
  sendTxHash?: string | null;
  at: number;
};

export function parseCoinbaseOfframpReturnSearch(
  search: string
): { partnerUserRef: string } | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  if (params.get(CB_OFFRAMP_QUERY) !== "1") return null;
  const partnerUserRef = params.get(CB_OFFRAMP_REF_QUERY)?.trim();
  if (!partnerUserRef) return null;
  return { partnerUserRef };
}

export function isCoinbaseOfframpReferrer(referrer: string): boolean {
  if (!referrer.trim()) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host === "coinbase.com" || host.endsWith(".coinbase.com");
  } catch {
    return false;
  }
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function isFreshPending(value: unknown): value is CoinbaseOfframpPending {
  if (!value || typeof value !== "object") return false;
  const pending = value as CoinbaseOfframpPending;
  if (typeof pending.partnerUserRef !== "string" || !pending.partnerUserRef.trim()) {
    return false;
  }
  if (typeof pending.at !== "number" || !Number.isFinite(pending.at)) return false;
  if (Date.now() - pending.at > MAX_AGE_MS) return false;
  return true;
}

export function saveCoinbaseOfframpPending(
  pending: Omit<CoinbaseOfframpPending, "at"> & { at?: number }
): CoinbaseOfframpPending {
  const next: CoinbaseOfframpPending = {
    partnerUserRef: pending.partnerUserRef,
    amount: pending.amount ?? null,
    sendTxHash: pending.sendTxHash ?? null,
    at: pending.at ?? Date.now(),
  };
  getSessionStorage()?.setItem(CB_OFFRAMP_PENDING_KEY, JSON.stringify(next));
  return next;
}

export function readCoinbaseOfframpPending(): CoinbaseOfframpPending | null {
  const raw = getSessionStorage()?.getItem(CB_OFFRAMP_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isFreshPending(parsed)) {
      clearCoinbaseOfframpPending();
      return null;
    }
    return {
      partnerUserRef: parsed.partnerUserRef,
      amount: typeof parsed.amount === "string" ? parsed.amount : null,
      sendTxHash:
        typeof parsed.sendTxHash === "string" ? parsed.sendTxHash : null,
      at: parsed.at,
    };
  } catch {
    clearCoinbaseOfframpPending();
    return null;
  }
}

export function patchCoinbaseOfframpPending(
  patch: Partial<Omit<CoinbaseOfframpPending, "at" | "partnerUserRef">>
): CoinbaseOfframpPending | null {
  const current = readCoinbaseOfframpPending();
  if (!current) return null;
  return saveCoinbaseOfframpPending({
    ...current,
    ...patch,
  });
}

export function clearCoinbaseOfframpPending(): void {
  getSessionStorage()?.removeItem(CB_OFFRAMP_PENDING_KEY);
}

export function consumeCoinbaseOfframpReturn(opts?: {
  href?: string;
  referrer?: string;
  replaceUrl?: (pathSearchHash: string) => void;
}): CoinbaseOfframpPending | null {
  const href =
    opts?.href ??
    (typeof window !== "undefined" ? window.location.href : "");
  if (!href) return null;

  const url = new URL(href);
  const parsed = parseCoinbaseOfframpReturnSearch(url.search);
  const stored = readCoinbaseOfframpPending();
  const referrer =
    opts?.referrer ??
    (typeof document !== "undefined" ? document.referrer : "");
  const fromCoinbase = isCoinbaseOfframpReferrer(referrer);

  if (!parsed && !fromCoinbase) return null;

  const partnerUserRef = stored?.partnerUserRef || parsed?.partnerUserRef;
  if (!partnerUserRef) return null;

  if (parsed) {
    url.searchParams.delete(CB_OFFRAMP_QUERY);
    url.searchParams.delete(CB_OFFRAMP_REF_QUERY);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const replace =
      opts?.replaceUrl ??
      ((pathSearchHash: string) => {
        if (typeof window === "undefined") return;
        window.history.replaceState(window.history.state, "", pathSearchHash);
      });
    replace(next);
  }

  return saveCoinbaseOfframpPending({
    partnerUserRef,
    amount: stored?.amount ?? null,
    sendTxHash: stored?.sendTxHash ?? null,
    at: stored?.at,
  });
}
