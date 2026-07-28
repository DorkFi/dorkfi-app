# Repay confirmation share links (OG / X link preview)

## Architecture

| Layer | Path |
|-------|------|
| Share server | `server/index.ts` (Hono, port `8788`) |
| Frontend client | `src/services/xShareService.ts` |
| Share flow | `src/utils/repayShare/shareRepayConfirmation.ts` |
| Canvas card | `src/utils/repayShare/generateRepayShareImage.ts` |

Flow:

1. Browser draws the repay PNG on canvas
2. `POST /share/repay-confirmation/link` uploads the PNG + metadata
3. Server returns a public permalink (`/repay/:id`)
4. X compose opens with that URL in the tweet text
5. X’s crawler fetches `/repay/:id` → OG HTML with `twitter:card=summary_large_image` and `og:image` → `/repay/:id/image.png`

## Local development

1. Copy share env vars into `.env` (see `.env.example` share section)
2. Install deps: `npm install`
3. Run share server: `npm run dev:share-server`
4. Run app: `npm run dev`
5. Vite proxies `/api/x-share/*` → `http://127.0.0.1:8788`

**Note:** X cannot crawl `localhost`. For real link-preview testing you need a public URL (Railway or a tunnel).

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health + `linkShareEnabled` |
| `POST` | `/share/repay-confirmation/link` | `multipart/form-data`: `image`, `amount`, `assetSymbol`, optional `paidWithSymbol`, `network` |
| `GET` | `/repay/:id` | OG HTML for crawlers; humans redirect to the app |
| `GET` | `/repay/:id/image.png` | Stored share PNG |

## Railway production

1. New Railway service from this GitHub repo / branch
2. Railway picks up root `railway.toml` + `nixpacks.toml`
3. Generate a public domain
4. Set variables (see below)
5. Confirm `GET https://<domain>/health` returns `ok: true`
6. Build/deploy the frontend with `VITE_X_SHARE_API_BASE=https://dorkfi-app-repay-share-production.up.railway.app` (or rely on the default in `xShareService.ts` if it matches)

### Required Railway variables

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `X_SHARE_FRONTEND_ORIGIN` | `https://beta.dork.fi` or comma-separated `https://beta.dork.fi,https://app.dork.fi` |
| `X_SHARE_PUBLIC_BASE` | `https://dorkfi-app-repay-share-production.up.railway.app` (required if `RAILWAY_PUBLIC_DOMAIN` is unset) |

### Optional

| Variable | Purpose |
|----------|---------|
| `X_REPAY_SHARE_STORE_PATH` | Image/index store (default `.data/repay-shares`) |
| `X_REPAY_SHARE_TTL_DAYS` | Link TTL (default `90`) |
| `NIXPACKS_NODE_VERSION` | `22` (also in `nixpacks.toml`) |

`PORT` is injected by Railway.

### Persistence warning

Shares are stored on the local filesystem (`.data/…`). Without a Railway volume (or S3), redeploys wipe old permalinks. Attach a volume at `/app/.data` if you need durable cards.

## Share priority (client)

1. **Link share** (OG permalink → X compose)
2. Native Web Share (mobile file share)
3. Clipboard + X intent
4. Download + X intent
5. Text-only X intent
