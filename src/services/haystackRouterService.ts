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
 * Base URL for the Haystack proxy (no trailing slash).
 * - Dev default: `/api/haystack` (Vite middleware injects the API key)
 * - Prod: set `VITE_HAYSTACK_PROXY_URL` to your deployed proxy origin
 *   (e.g. `https://api.example.com` serving `/api/fetchQuote`)
 */
export function getHaystackProxyBaseUrl(): string {
  const raw = (
    import.meta.env.VITE_HAYSTACK_PROXY_URL as string | undefined
  )?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  // Vite plugin mounts at /api/haystack and forwards /api/fetchQuote…
  return "/api/haystack";
}

/**
 * Cross-asset repay UI gate.
 * - Explicit `true`/`1` → on (beta/prod need a deployed proxy + `VITE_HAYSTACK_PROXY_URL`)
 * - Explicit `false`/`0` → off
 * - Unset → on in Vite DEV only; **off in production builds** (safe dark ship to beta)
 */
export function isCrossAssetRepayFeatureEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_CROSS_ASSET_REPAY;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
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
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Haystack quote failed (${res.status}): ${text.slice(0, 200)}`
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
    throw new Error(`Haystack quote failed (${res.status}): ${msg}`);
  }
  return json as HaystackQuoteResponse;
}

export async function fetchHaystackExecuteTxns(args: {
  address: string;
  txnPayload: HaystackTxnPayload;
  /** Slippage percent, e.g. 1 = 1% */
  slippage: number;
}): Promise<HaystackExecuteResponse> {
  const proxyBase = getHaystackProxyBaseUrl();
  const res = await fetch(executePath(proxyBase), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: args.address,
      txnPayloadJSON: args.txnPayload,
      slippage: args.slippage,
    }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Haystack execute failed (${res.status}): ${text.slice(0, 200)}`
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
    throw new Error(`Haystack execute failed (${res.status}): ${msg}`);
  }
  return json as HaystackExecuteResponse;
}
