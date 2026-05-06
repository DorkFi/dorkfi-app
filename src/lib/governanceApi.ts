/**
 * HTTP client for the DorkFi governance node (JSON REST).
 * Base URL: VITE_GOVERNANCE_API_BASE (trimmed, no trailing slash) or production Railway default.
 */

export const GOVERNANCE_API_DEFAULT_ORIGIN =
  "https://dorkfi-governance-node-production.up.railway.app";

export function governanceApiBase(): string {
  const raw = import.meta.env.VITE_GOVERNANCE_API_BASE as string | undefined;
  const t = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  return t || GOVERNANCE_API_DEFAULT_ORIGIN;
}

/** `networkId` query for GET /proposals — omit for all chains. */
export function proposalsListNetworkParam(
  networkId: string | null | undefined
): string | undefined {
  if (!networkId || !networkId.trim()) return undefined;
  return networkId.trim();
}

export class NgrokInterstitialError extends Error {
  constructor(message = "Received ngrok browser interstitial instead of JSON") {
    super(message);
    this.name = "NgrokInterstitialError";
  }
}

export class HtmlResponseError extends Error {
  constructor(message = "Expected JSON but received HTML") {
    super(message);
    this.name = "HtmlResponseError";
  }
}

export type HealthResponse = {
  status?: string;
  database?: string;
  counts?: Record<string, unknown>;
  [key: string]: unknown;
};

function isLikelyNgrokInterstitial(html: string): boolean {
  const h = html.toLowerCase();
  return (
    h.includes("ngrok") &&
    (h.includes("browser warning") || h.includes("visit site") || h.includes("you are about to visit"))
  );
}

async function parseGovernanceJsonResponse(
  res: Response,
  pathForErrors: string
): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Governance API ${pathForErrors}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  if (!ct.includes("application/json")) {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<")) {
      if (isLikelyNgrokInterstitial(text)) {
        throw new NgrokInterstitialError();
      }
      throw new HtmlResponseError(
        `Governance API ${pathForErrors}: non-JSON body (Content-Type: ${ct || "missing"})`
      );
    }
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Governance API ${pathForErrors}: invalid JSON`);
  }
}

async function governanceGetJson(path: string): Promise<unknown> {
  const base = governanceApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseGovernanceJsonResponse(res, path);
}

export async function getGovernanceHealth(): Promise<HealthResponse> {
  const data = await governanceGetJson("/health");
  return (typeof data === "object" && data !== null ? data : {}) as HealthResponse;
}

export function proposalsArrayFromBody(body: Record<string, unknown>): unknown[] {
  const raw = body.proposals ?? body.data ?? body.items;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Next page cursor for GET /proposals pagination.
 * Avoids treating an echoed `cursor` as a next page unless the API signals more data.
 */
export function proposalsNextPageCursor(
  body: Record<string, unknown>,
  requestedCursor: string | undefined
): string | undefined {
  const next =
    typeof body.nextCursor === "string" && body.nextCursor.length > 0
      ? body.nextCursor
      : undefined;
  if (next) return next;

  const more =
    body.hasNextPage === true ||
    body.hasMore === true ||
    body.hasNext === true;

  if (!more) return undefined;

  const echoed =
    typeof body.cursor === "string" && body.cursor.length > 0
      ? body.cursor
      : undefined;
  if (!echoed) return undefined;
  if (requestedCursor !== undefined && echoed === requestedCursor) {
    return undefined;
  }
  return echoed;
}

export type GovernanceProposalsPageResult = {
  body: Record<string, unknown>;
  items: unknown[];
  /** Cursor sent with this request (for pagination helper). */
  requestCursor: string | undefined;
};

export async function getGovernanceProposalsPage(options: {
  limit?: number;
  networkId?: string;
  cursor?: string;
} = {}): Promise<GovernanceProposalsPageResult> {
  const sp = new URLSearchParams();
  if (options.limit != null) sp.set("limit", String(options.limit));
  if (options.networkId) sp.set("networkId", options.networkId);
  if (options.cursor) sp.set("cursor", options.cursor);
  const q = sp.toString();
  const path = `/proposals${q ? `?${q}` : ""}`;
  const data = await governanceGetJson(path);
  const body =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  return {
    body,
    items: proposalsArrayFromBody(body),
    requestCursor: options.cursor,
  };
}

export async function getGovernanceProposalById(
  id: string
): Promise<Record<string, unknown>> {
  const data = await governanceGetJson(`/proposals/${encodeURIComponent(id)}`);
  return typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)
    : {};
}

export async function getGovernanceProposalVotes(
  id: string
): Promise<unknown[]> {
  const data = await governanceGetJson(
    `/proposals/${encodeURIComponent(id)}/votes`
  );
  if (Array.isArray(data)) return data;
  if (
    typeof data === "object" &&
    data !== null &&
    "votes" in data &&
    Array.isArray((data as { votes: unknown }).votes)
  ) {
    return (data as { votes: unknown[] }).votes;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return (data as { data: unknown[] }).data;
  }
  return [];
}
