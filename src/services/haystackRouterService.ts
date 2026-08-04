/**
 * Haystack Order Router client — calls our private proxy only.
 * Never send HAYSTACK_API_KEY from the browser.
 *
 * @see https://txnlab.gitbook.io/haystack-router/developers/api-order-router
 */

export type HaystackChain = "mainnet" | "testnet";
export type HaystackQuoteType = "fixed-input" | "fixed-output";

export type HaystackTxnPayload = {
  iv: string;
  data: string;
};

export type HaystackQuoteResponse = {
  quote: number;
  profitAmount?: number;
  profitASAID?: number;
  usdIn?: number;
  usdOut?: number;
  userPriceImpact?: number;
  route?: unknown[];
  quotes?: { name: string; value: number }[];
  requiredAppOptIns?: number[];
  txnPayload: HaystackTxnPayload | null;
  fromASAID?: number;
  toASAID?: number;
  type?: string;
};

export type HaystackExecuteTxn = {
  data: string;
  group?: string;
  /** `false` / null = user must sign; non-empty string = pre-signed logic sig blob (base64). */
  logicSigBlob: false | string | null;
};

export type HaystackExecuteResponse = {
  txns: HaystackExecuteTxn[];
};

/**
 * Deployed Haystack key proxy (Railway). Used when `VITE_HAYSTACK_PROXY_URL` is
 * unset outside Vite DEV so beta builds work without host env. Override with
 * `VITE_HAYSTACK_PROXY_URL` when needed. Never put `HAYSTACK_API_KEY` in VITE_*.
 */
export const DEFAULT_HAYSTACK_PROXY_URL =
  "https://profound-bravery-production-418a.up.railway.app";

/**
 * Client-side deadline for a quote request (connect + proxy + upstream).
 * Prevents the UI from spinning for the full browser TCP timeout when the
 * Railway proxy is down or unreachable.
 */
export const HAYSTACK_QUOTE_TIMEOUT_MS = 12_000;

/** Client-side deadline for building execute txns from a quote payload. */
export const HAYSTACK_EXECUTE_TIMEOUT_MS = 20_000;

/** Origins where cross-asset repay is on without `VITE_ENABLE_CROSS_ASSET_REPAY`. */
export const CROSS_ASSET_REPAY_AUTO_ENABLE_ORIGINS = [
  "https://beta.dork.fi",
] as const;

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Base URL for the Haystack proxy (no trailing slash).
 * - Absolute `VITE_HAYSTACK_PROXY_URL` wins when set
 * - `beta.dork.fi` always uses the Railway proxy (never same-origin `/api/…`)
 * - Vite DEV default: `/api/haystack` (middleware injects the API key)
 * - Other builds: baked Railway proxy origin
 */
export function getHaystackProxyBaseUrl(
  origin = typeof window !== "undefined" ? window.location.origin : ""
): string {
  const raw = (
    import.meta.env.VITE_HAYSTACK_PROXY_URL as string | undefined
  )?.trim();
  if (raw && isAbsoluteHttpUrl(raw)) {
    return raw.replace(/\/$/, "");
  }
  if (
    origin &&
    (CROSS_ASSET_REPAY_AUTO_ENABLE_ORIGINS as readonly string[]).includes(
      origin
    )
  ) {
    return DEFAULT_HAYSTACK_PROXY_URL;
  }
  if (import.meta.env.DEV === true) {
    return "/api/haystack";
  }
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return DEFAULT_HAYSTACK_PROXY_URL;
}

/**
 * Cross-asset repay UI gate.
 * - Explicit `true`/`1` → on (needs a deployed proxy + `VITE_HAYSTACK_PROXY_URL` in prod)
 * - Explicit `false`/`0` → off
 * - `beta.dork.fi` auto-enables for testing without host build env
 * - Unset → on in Vite DEV only; **off on other production hosts**
 */
export function isCrossAssetRepayFeatureEnabled(
  origin = typeof window !== "undefined" ? window.location.origin : ""
): boolean {
  const flag = import.meta.env.VITE_ENABLE_CROSS_ASSET_REPAY;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  if (
    origin &&
    (CROSS_ASSET_REPAY_AUTO_ENABLE_ORIGINS as readonly string[]).includes(
      origin
    )
  ) {
    return true;
  }
  return import.meta.env.DEV === true;
}

function quotePath(proxyBase: string): string {
  // Standalone proxy: /api/fetchQuote
  // Vite plugin: /api/haystack + /api/fetchQuote
  if (proxyBase.endsWith("/api/haystack") || proxyBase === "/api/haystack") {
    return `${proxyBase}/api/fetchQuote`;
  }
  return `${proxyBase}/api/fetchQuote`;
}

function executePath(proxyBase: string): string {
  if (proxyBase.endsWith("/api/haystack") || proxyBase === "/api/haystack") {
    return `${proxyBase}/api/fetchExecuteSwapTxns`;
  }
  return `${proxyBase}/api/fetchExecuteSwapTxns`;
}

/**
 * Combine an optional external AbortSignal with a timeout. Timeout aborts set
 * `name = "TimeoutError"` so callers can show a proxy-unavailable message;
 * external abort keeps standard `AbortError` for ignore-on-unmount.
 */
export function createHaystackDeadlineSignal(
  timeoutMs: number,
  external?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();

  if (external?.aborted) {
    controller.abort(external.reason);
    return { signal: controller.signal, cleanup: () => undefined };
  }

  const onTimeout = () => {
    const reason =
      typeof DOMException !== "undefined"
        ? new DOMException(
            `Haystack request exceeded ${timeoutMs}ms`,
            "TimeoutError"
          )
        : Object.assign(new Error(`Haystack request exceeded ${timeoutMs}ms`), {
            name: "TimeoutError",
          });
    controller.abort(reason);
  };
  const tid = setTimeout(onTimeout, timeoutMs);

  const onExternal = () => {
    clearTimeout(tid);
    controller.abort(external!.reason);
  };
  external?.addEventListener("abort", onExternal, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(tid);
      external?.removeEventListener("abort", onExternal);
    },
  };
}

export function formatHaystackFetchError(
  err: unknown,
  kind: "quote" | "execute"
): Error {
  if (err instanceof Error) {
    // Caller cancelled (unmount / amount change) — rethrow unchanged.
    if (err.name === "AbortError") {
      return err;
    }
    if (
      err.name === "TimeoutError" ||
      /exceeded \d+ms/i.test(err.message) ||
      /aborted due to timeout/i.test(err.message)
    ) {
      return new Error(
        `Haystack ${kind} timed out. The routing proxy may be unavailable — retry shortly or check the Haystack proxy service.`
      );
    }
    if (
      err.name === "TypeError" ||
      /failed to fetch|networkerror|load failed|network request failed/i.test(
        err.message
      )
    ) {
      return new Error(
        `Haystack ${kind} could not reach the routing proxy. The proxy may be down — retry shortly.`
      );
    }
    return err;
  }
  return new Error(`Haystack ${kind} failed`);
}

async function parseHaystackJsonResponse(
  res: Response,
  kind: "quote" | "execute"
): Promise<unknown> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Haystack ${kind} failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" &&
      json &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : text.slice(0, 200) || res.statusText;
    throw new Error(`Haystack ${kind} failed (${res.status}): ${msg}`);
  }
  return json;
}

export type FetchHaystackQuoteParams = {
  chain?: HaystackChain;
  amount: bigint | number | string;
  type: HaystackQuoteType;
  fromASAID: number;
  toASAID: number;
  /** Reserve room for post-swap repay txns when composing atomically later. */
  maxGroupSize?: number;
  maxDepth?: number;
  disabledProtocols?: string[];
  optIn?: boolean;
  algodUri?: string;
  algodToken?: string;
  algodPort?: string | number;
  /** Cancel in-flight quote (e.g. effect cleanup). Combined with quote timeout. */
  signal?: AbortSignal;
  /** Override default {@link HAYSTACK_QUOTE_TIMEOUT_MS}. */
  timeoutMs?: number;
};

export async function fetchHaystackQuote(
  params: FetchHaystackQuoteParams
): Promise<HaystackQuoteResponse> {
  const proxyBase = getHaystackProxyBaseUrl();
  const search = new URLSearchParams();
  search.set("chain", params.chain ?? "mainnet");
  search.set("amount", String(params.amount));
  search.set("type", params.type);
  search.set("fromASAID", String(params.fromASAID));
  search.set("toASAID", String(params.toASAID));
  if (params.maxGroupSize != null) {
    search.set("maxGroupSize", String(params.maxGroupSize));
  }
  if (params.maxDepth != null) {
    search.set("maxDepth", String(params.maxDepth));
  }
  if (params.disabledProtocols?.length) {
    search.set("disabledProtocols", params.disabledProtocols.join(","));
  }
  if (params.optIn != null) {
    search.set("optIn", String(params.optIn));
  }
  if (params.algodUri) search.set("algodUri", params.algodUri);
  if (params.algodToken != null) search.set("algodToken", params.algodToken);
  if (params.algodPort != null) search.set("algodPort", String(params.algodPort));

  // Haystack requires algod params — use public Nodely defaults when omitted.
  if (!params.algodUri) {
    search.set(
      "algodUri",
      params.chain === "testnet"
        ? "https://testnet-api.4160.nodely.dev"
        : "https://mainnet-api.4160.nodely.dev"
    );
    search.set("algodToken", "");
    search.set("algodPort", "443");
  }

  const url = `${quotePath(proxyBase)}?${search.toString()}`;
  const timeoutMs = params.timeoutMs ?? HAYSTACK_QUOTE_TIMEOUT_MS;
  const { signal, cleanup } = createHaystackDeadlineSignal(
    timeoutMs,
    params.signal
  );

  try {
    const res = await fetch(url, { signal });
    const json = await parseHaystackJsonResponse(res, "quote");
    return json as HaystackQuoteResponse;
  } catch (err) {
    // External cancel (effect cleanup / user navigation) — leave as AbortError.
    if (params.signal?.aborted) {
      throw err instanceof Error
        ? err
        : Object.assign(new Error("Aborted"), { name: "AbortError" });
    }
    // fetch() surfaces signal.abort as AbortError; recover TimeoutError from our deadline.
    const reason = signal.reason;
    if (
      reason instanceof Error &&
      (reason.name === "TimeoutError" || /exceeded \d+ms/i.test(reason.message))
    ) {
      throw formatHaystackFetchError(reason, "quote");
    }
    throw formatHaystackFetchError(err, "quote");
  } finally {
    cleanup();
  }
}

export async function fetchHaystackExecuteTxns(args: {
  address: string;
  txnPayload: HaystackTxnPayload;
  /** Slippage percent, e.g. 1 = 1% */
  slippage: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<HaystackExecuteResponse> {
  const proxyBase = getHaystackProxyBaseUrl();
  const timeoutMs = args.timeoutMs ?? HAYSTACK_EXECUTE_TIMEOUT_MS;
  const { signal, cleanup } = createHaystackDeadlineSignal(
    timeoutMs,
    args.signal
  );

  try {
    const res = await fetch(executePath(proxyBase), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: args.address,
        txnPayloadJSON: args.txnPayload,
        slippage: args.slippage,
      }),
      signal,
    });
    const json = await parseHaystackJsonResponse(res, "execute");
    return json as HaystackExecuteResponse;
  } catch (err) {
    if (args.signal?.aborted) {
      throw err instanceof Error
        ? err
        : Object.assign(new Error("Aborted"), { name: "AbortError" });
    }
    const reason = signal.reason;
    if (
      reason instanceof Error &&
      (reason.name === "TimeoutError" || /exceeded \d+ms/i.test(reason.message))
    ) {
      throw formatHaystackFetchError(reason, "execute");
    }
    throw formatHaystackFetchError(err, "execute");
  } finally {
    cleanup();
  }
}
