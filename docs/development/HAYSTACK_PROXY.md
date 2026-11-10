# Haystack proxy (cross-asset repay)

The browser must **never** receive `HAYSTACK_API_KEY`. Quotes and execute calls go through a same-origin Vite middleware in local dev, or a **standalone Node proxy** in beta/production.

## Local development

1. Put the key in `.env` (gitignored), **not** as `VITE_*`:

   ```bash
   HAYSTACK_API_KEY=your-key
   ```

2. `npm run dev` — Vite plugin mounts `/api/haystack` and injects the key.

3. Cross-asset repay UI is **on by default in DEV**. Optional smoke:

   ```bash
   npm run smoke:apis
   ```

## Beta / production checklist

Static SPA hosts (`vite build`) do **not** include the Vite Haystack middleware.

### Feature flag (SPA)

| Build env (SPA) | Value |
|-----------------|-------|
| `VITE_ENABLE_CROSS_ASSET_REPAY` | **true** in committed `.env.production` (production builds on by default). Override with `false` to kill-switch. |
| `VITE_HAYSTACK_PROXY_URL` | omit (SPA falls back to baked Railway proxy) or set absolute proxy origin |
| `HAYSTACK_API_KEY` | **do not set** on the SPA host |

DEV defaults the UI on when the flag is unset. `beta.dork.fi` also auto-enables when unset. Explicit `false`/`0` always forces the UI off.

### Deploy the Haystack proxy

1. **Deploy** `scripts/haystack-proxy.mjs` as its own service (Railway, Fly, etc.):

   | Proxy env | Value |
   |-----------|-------|
   | `HAYSTACK_API_KEY` | server secret only |
   | `HAYSTACK_PROXY_HOST` | `0.0.0.0` |
   | `HAYSTACK_PROXY_PORT` | e.g. `8791` (or platform `$PORT`) |
   | `HAYSTACK_PROXY_CORS_ORIGINS` | `https://beta.dork.fi` (comma-separate more origins) |
   | `HAYSTACK_PROXY_IP_RATE_MAX` | `30` requests per IP per window (optional) |
   | `HAYSTACK_PROXY_GLOBAL_RATE_MAX` | `120` requests per window (optional) |
   | `HAYSTACK_PROXY_DAILY_BUDGET` | `2000` upstream calls per UTC day (optional) |
   | `HAYSTACK_PROXY_MAX_BODY_BYTES` | `131072` execute body cap (optional) |

   **Railway tip:** Railpack detects `bun.lockb` and runs
   `bun install --frozen-lockfile`, which fails when that lockfile is stale.
   For the **proxy service only**, use the Dockerfile (no install):

   | Setting | Value |
   |---------|-------|
   | Config-as-code path | `railway.haystack.toml` |
   | or Dockerfile path | `Dockerfile.haystack` |
   | Start command | `node scripts/haystack-proxy.mjs` (optional; Dockerfile `CMD` already sets it) |

   Do **not** rely on `NIXPACKS_INSTALL_CMD` — this builder is Railpack, not Nixpacks.

   ```bash
   HAYSTACK_API_KEY=… \
   HAYSTACK_PROXY_HOST=0.0.0.0 \
   HAYSTACK_PROXY_CORS_ORIGINS=https://beta.dork.fi \
   npm run haystack-proxy
   ```

2. Confirm `GET /health` → `{ "ok": true }`.

3. **SPA build** — production uses committed `.env.production` (`VITE_ENABLE_CROSS_ASSET_REPAY=true`). Host CI can still override. Never set `HAYSTACK_API_KEY` on the SPA.

4. Wallet QA on mainnet with a tiny repay (quote → swap → repay, cancel mid-flow, Folks debt if applicable).

## Security notes

- Anything prefixed `VITE_` is embedded in the client bundle. Never put the Haystack key there.
- Quote and execute reject a missing `Origin` with `401` `{"error":"Origin required"}`. `GET /health` stays open for Railway. Origins outside `HAYSTACK_PROXY_CORS_ORIGINS` still get `403`.
- An allowed `Origin` is only a header. The proxy also rate-limits both routes per IP and globally (`429`), caps the execute body (`413`), and stops calling Haystack after `HAYSTACK_PROXY_DAILY_BUDGET` upstream calls in a UTC day (`429`). Counters are in memory for one process: they reset on restart, and the daily cap also resets at UTC midnight. On Railway the per-IP key is `X-Real-IP` only.
- The default daily budget is 2000 calls, about a few hundred repay sessions (quotes are debounced, plus one execute). Set it to the number of calls you can afford a script to burn. `0` stops forwarding.
- Client-supplied `apiKey` query/body fields and any client `X-API-Key` are dropped. The proxy sends `HAYSTACK_API_KEY` only in the upstream `X-API-Key` header. Upstream JSON loses `apiKey` fields before the response is sent, and the key is not logged.
- The local Vite middleware does not apply these caps. It is only on the dev machine.
- Do not commit `.env` / `.env.local`.

## Related code

- `vite/haystackProxyPlugin.ts` — local Vite middleware
- `scripts/haystack-proxy.mjs` — standalone proxy
- `src/services/haystackRouterService.ts` — feature flag + quote client
- `src/components/RepayModal.tsx` — cross-asset repay UX (two-step swap → repay)
