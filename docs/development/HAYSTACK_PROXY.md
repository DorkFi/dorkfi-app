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

### Option A — Ship code dark (safest first merge)

| Build env (SPA) | Value |
|-----------------|-------|
| `VITE_ENABLE_CROSS_ASSET_REPAY` | **omit** (or `false`) |
| `VITE_HAYSTACK_PROXY_URL` | omit |
| `HAYSTACK_API_KEY` | **do not set** on the SPA host |

On hosts other than `https://beta.dork.fi`, the feature stays hidden when the flag is unset. `beta.dork.fi` auto-enables the UI; set `VITE_ENABLE_CROSS_ASSET_REPAY=false` to force it off.

### Option B — Enable cross-asset repay on beta

1. **Deploy** `scripts/haystack-proxy.mjs` as its own service (Railway, Fly, etc.):

   | Proxy env | Value |
   |-----------|-------|
   | `HAYSTACK_API_KEY` | server secret only |
   | `HAYSTACK_PROXY_HOST` | `0.0.0.0` |
   | `HAYSTACK_PROXY_PORT` | e.g. `8791` (or platform `$PORT`) |
   | `HAYSTACK_PROXY_CORS_ORIGINS` | `https://beta.dork.fi` (comma-separate more origins) |

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

3. **SPA build** env (frontend CI / host):

   | Build env | Value |
   |-----------|-------|
   | `VITE_ENABLE_CROSS_ASSET_REPAY` | omit on beta (auto-on for `beta.dork.fi`); `true` elsewhere |
   | `VITE_HAYSTACK_PROXY_URL` | omit (SPA falls back to `https://profound-bravery-production-418a.up.railway.app`) or override |
   | `HAYSTACK_API_KEY` | **must not** be present |

4. Wallet QA on mainnet with a tiny repay (quote → swap → repay, cancel mid-flow, Folks debt if applicable).

## Security notes

- Anything prefixed `VITE_` is embedded in the client bundle. Never put the Haystack key there.
- The standalone proxy rejects browser `Origin` values outside `HAYSTACK_PROXY_CORS_ORIGINS` (required when binding a non-loopback host). That stops casual quota abuse from other websites; it is not a full auth layer.
- Client-supplied `apiKey` query/body fields are stripped before the proxy injects the server key.
- Do not commit `.env` / `.env.local`.

## Related code

- `vite/haystackProxyPlugin.ts` — local Vite middleware
- `scripts/haystack-proxy.mjs` — standalone proxy
- `src/services/haystackRouterService.ts` — feature flag + quote client
- `src/components/RepayModal.tsx` — cross-asset repay UX (two-step swap → repay)
