# Governance API integration guide

This document explains how to connect **any application** to the same governance HTTP API that **Governance Insight Hub** uses, and how to reuse patterns (or code) from that hub codebase.

**In this repository:** `/governance` has two tabs: **Live** (see `src/services/governanceService.ts` and `src/hooks/useGovernanceData.ts`) and **Archives** (HTTP client in `src/lib/governanceApi.ts`, UI in `src/components/governance/GovernanceApiProposalsPanel.tsx`). **Archives** always calls `GET /proposals` without a `networkId` query (all chains). File paths such as `src/lib/api.ts` and `src/pages/Overview.tsx` below refer to the **Governance Insight Hub** reference app; this repo’s client module is `governanceApi.ts` instead of `api.ts`.

## What you are integrating with

The hub talks to a **JSON REST** service (the “governance node”). Requests are plain `GET` calls with optional query parameters. There is no auth layer in the hub’s reference client; if your deployment adds API keys or cookies, wire those in your own `fetch` wrapper.

Base URL resolution in the hub app:

1. Use `VITE_GOVERNANCE_API_BASE` when set (trimmed, no trailing slash).
2. Otherwise fall back to  
   `https://dorkfi-governance-node-production.up.railway.app`.

In another app, mirror that with your framework’s env convention (for example `NEXT_PUBLIC_GOVERNANCE_API_BASE` in Next.js).

## Configuration

### Environment variable (Vite / hub)

| Variable | Purpose |
|----------|---------|
| `VITE_GOVERNANCE_API_BASE` | Full origin (`https://api.example.com`) **or** same-origin path to a proxy (`/api/local`, `/api/railway`). |

See `.env.example` in the hub repository root when available.

### Dev proxy (optional)

This repo’s `vite.config.ts` (and the hub’s) define example proxies so the browser never calls a remote origin directly (helps with CORS and ngrok interstitials during development):

- `/api/local` → local governance node (`VITE_GOVERNANCE_LOCAL_TARGET`, default `http://127.0.0.1:8787`)  
- `/api/railway` → production Railway host  
- `/api/ngrok` → tunneled host (`VITE_GOVERNANCE_NGROK_TARGET`, same default) with `ngrok-skip-browser-warning`

Point `VITE_GOVERNANCE_API_BASE=/api/local` (or `/api/railway`) while developing, and replicate the same rewrite pattern in **Next.js rewrites**, **webpack devServer.proxy**, or your API gateway.

### Production CORS

If the browser calls the governance API **directly**, the server must allow your site’s origin. If CORS is restrictive, use a **same-origin BFF** (server route) that proxies to the governance node and keep `GOVERNANCE_API_BASE` pointing at your own `/api/governance` path.

## HTTP API surface

All paths below are appended to the configured base (no trailing slash on the base).

### `GET /health`

Returns JSON with at least `status`; optional `database`, `counts`, etc. Typed as `HealthResponse` in `src/lib/api.ts`.

### `GET /proposals`

Query parameters (all optional):

| Parameter | Description |
|-----------|-------------|
| `limit` | Page size (hub uses `20`). |
| `networkId` | **Chain** id filter (e.g. `voi-mainnet`, `algorand-mainnet`). Not a product slug; see “Network IDs” below. |
| `status` | Server-side status filter when supported. |
| `cursor` | Opaque pagination cursor from a previous response. |

Response is a JSON object (not always the same shape). The hub accepts:

- `proposals` | `data` | `items` — array of proposals  
- `nextCursor`, `cursor` — pagination  
- `hasNextPage`, `hasMore`, `hasNext` — when present, used to decide if another page exists  
- `activeCount`, `closedCount` — optional server tallies  

Use `proposalsNextPageCursor()` from `src/lib/governanceApi.ts` (or `src/lib/api.ts` in the hub) when porting pagination: it avoids treating a echoed `cursor` as “next page” unless the API explicitly says there is more.

### `GET /proposals/:id`

Single proposal. Same fields as list items, including optional `byNetwork` for multichain aggregates.

### `GET /proposals/:id/votes`

Vote rows; hub reads `votes` or `data` array.

## Response model (high level)

Proposal objects are intentionally loose (`[key: string]: unknown` on types) because the node may evolve. Commonly used fields in the hub:

- Identity: `id`, `title`, `description`, `status`, `createdAt`  
- Voting: `votingStart`, `votingEnd` (or `startDate` / `endDate`), `votesFor`, `votesAgainst`, `votesAbstain`, `totalVotes`, `quorum`  
- Multichain: `networkIds[]`, `byNetwork[]` (each row has `networkId`, tallies, power fields)  
- Power / quorum UI: `proposalTotalPower`, `proposalYesPower` (often strings for bigint-safe values)  

Display helpers worth copying:

- `proposalDisplayStatus` — passed/rejected from power vs **69%** threshold when power fields exist  
- `proposalYesPowerFraction`, `mergeProposalForNetwork`, `formatNetworkLabel`, `proposalsListNetworkParam`

## Network IDs vs UI slugs

- **`networkId` query param** must be a **chain** identifier the API understands (e.g. `voi-mainnet`, `algorand-mainnet`).
- The hub’s sidebar may use a **protocol** value like `dorkfi`; `proposalsListNetworkParam()` maps that to **no** `networkId` query (same as “all chains”) so the list does not go empty.

When you add per-chain filters in your own app, pass real chain ids to the API.

## Client implementation notes

### Content-Type and errors

The reference client expects `Content-Type` to include `application/json`. If the body is HTML (common with ngrok interstitials or load balancers), the hub throws:

- `NgrokInterstitialError` — detect ngrok warning pages  
- `HtmlResponseError` — other HTML responses  

Handle these in your UI (retry, open docs link, or proxy with `ngrok-skip-browser-warning`).

### React + TanStack Query (hub)

`Overview` uses `useQuery` with keys like `["proposals", apiNetworkId, cursor]`. Reuse the same key shape if you copy components so cache invalidation stays predictable.

### Minimal standalone example

```ts
const BASE = (import.meta as any).env?.VITE_GOVERNANCE_API_BASE?.replace(/\/+$/, "")
  ?? "https://dorkfi-governance-node-production.up.railway.app";

export async function getProposals(options: {
  limit?: number;
  networkId?: string;
  cursor?: string;
} = {}) {
  const sp = new URLSearchParams();
  if (options.limit) sp.set("limit", String(options.limit));
  if (options.networkId) sp.set("networkId", options.networkId);
  if (options.cursor) sp.set("cursor", options.cursor);
  const q = sp.toString();
  const res = await fetch(`${BASE}/proposals${q ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

Adapt `import.meta.env` to `process.env.NEXT_PUBLIC_…` or your runtime.

## Reusing code from Governance Insight Hub

You can treat the hub repo as a **reference implementation** or copy files into a monorepo.

| Area | Location | Notes |
|------|----------|--------|
| API + types + helpers | `src/lib/api.ts` | Single module; depends only on `fetch` / `import.meta.env`. |
| Categories / badges | `src/lib/governanceCategories.ts`, `src/components/ProposalCategoryBadge.tsx` | UI-specific. |
| Relative dates | `src/lib/formatRelativeTime.ts` | Pure `Intl`; optional `useNow` in `src/hooks/useNow.ts`. |
| Deep linking pattern | `Overview` + `?proposal=` | Optional UX pattern for embeds. |

Dependencies used by the hub UI (if you copy components): React 18, `react-router-dom`, `@tanstack/react-query`, Tailwind + shadcn-style UI under `src/components/ui/`.

For a **non-React** app, copy only `api.ts` (after renaming env access) and implement your own views.

## Embedding in another product

1. **Iframe** — host the hub (or a route that renders only the overview) and align `VITE_GOVERNANCE_API_BASE` with the same API; watch X-Frame-Options / CSP on both sides.  
2. **Shared BFF** — your backend proxies `/governance/*` to the node; the SPA uses a relative base.  
3. **Monorepo package** — extract `src/lib/api.ts` (+ tests in `src/lib/api.governance.test.ts`) into `@org/governance-client` and import from your app.

## Checklist

- [ ] Set base URL for each environment (env + proxy if needed).  
- [ ] Confirm CORS or use a same-origin proxy.  
- [ ] List proposals with `limit` + optional `networkId` (chain id only).  
- [ ] Paginate with `proposalsNextPageCursor` semantics (or your server’s contract).  
- [ ] Detail view: `GET /proposals/:id` and optional votes endpoint.  
- [ ] Handle HTML / ngrok error paths if you expose dev tunnels to browsers.  

For behavior specifics (filters, badges, power bar), read the inline usage in `src/pages/Overview.tsx` and `src/components/ProposalsTable.tsx`.
