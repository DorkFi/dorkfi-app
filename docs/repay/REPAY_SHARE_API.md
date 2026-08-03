# Repay / Borrow confirmation share links (OG / X link preview)

## Architecture

| Layer | Path |
|-------|------|
| Share server | `server/index.ts` (Hono, port `8788`) |
| Frontend client | `src/services/xShareService.ts` |
| Repay share flow | `src/utils/repayShare/shareRepayConfirmation.ts` |
| Repay canvas card | `src/utils/repayShare/generateRepayShareImage.ts` |
| Borrow share flow | `src/utils/borrowShare/shareBorrowConfirmation.ts` |
| Borrow canvas card | `src/utils/borrowShare/generateBorrowShareImage.ts` |

Flow:

1. Browser draws the confirmation PNG on canvas
2. `POST /share/repay-confirmation/link` or `POST /share/borrow-confirmation/link` uploads the PNG + metadata
3. Server returns a public permalink (`/repay/:id` or `/borrow/:id`)
4. X compose opens with that URL in the tweet text
5. X’s crawler fetches the permalink → OG HTML with `twitter:card=summary_large_image` and `og:image` → `…/image.png`

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
| `GET` | `/repay/:id/image.png` | Stored repay share PNG |
| `POST` | `/share/borrow-confirmation/link` | `multipart/form-data`: `image`, `amount`, `assetSymbol`, optional `network` |
| `GET` | `/borrow/:id` | OG HTML for crawlers; humans redirect to the app |
| `GET` | `/borrow/:id/image.png` | Stored borrow share PNG |

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
| `X_SHARE_PUBLIC_BASE` | `https://share.dork.fi` (custom domain — see below) |

### Custom domain (required for X to render the card)

X (Twitter) suppresses link-preview cards for shared free-hosting domains such as
`*.up.railway.app`. The OG/Twitter tags served from a `*.up.railway.app` URL are
valid and pass every third-party validator, but X quietly renders the tweet as a
plain link instead of a `summary_large_image` card. The fix is to serve the share
permalink from a custom domain:

1. In Railway, add a custom domain to the share service (e.g. `share.dork.fi`) and
   create the DNS `CNAME` it gives you.
2. Set `X_SHARE_PUBLIC_BASE=https://share.dork.fi` on the share service. Railway
   leaves `RAILWAY_PUBLIC_DOMAIN` pointed at the `*.up.railway.app` host even after
   a custom domain is added, so this must be set explicitly — otherwise
   `og:url`/`og:image` fall back to the suppressed domain (see
   `resolveSharePublicBase` in `server/config.ts`).
3. Rebuild the frontend with `VITE_X_SHARE_API_BASE=https://share.dork.fi` so the
   POST and the resulting tweet URL both use the custom domain.
4. Because the tweet URL is derived server-side from `X_SHARE_PUBLIC_BASE`, changing
   only that variable is enough to change the permalink X sees.

**Validation:** X's own card validator (`cards.twitter.com/validator`) was retired
in 2022. Use `opengraph.xyz` or `socialsharepreview.com`, or fetch as the crawler
directly (the `/repay/:id` and `/borrow/:id` routes only serve OG HTML to crawler
user-agents and 302-redirect everyone else, so a plain browser fetch shows no card):

```bash
curl -A "Twitterbot/1.0" -L "https://share.dork.fi/repay/<id>"
curl -A "Twitterbot/1.0" -L "https://share.dork.fi/borrow/<id>"
```

X also negatively caches URLs it failed to build a card for, and the manual
re-scrape tool is gone — so always verify with a **freshly generated** share link
after any change.

### Optional

| Variable | Purpose |
|----------|---------|
| `X_REPAY_SHARE_STORE_PATH` | Repay image/index store (default `.data/repay-shares`) |
| `X_BORROW_SHARE_STORE_PATH` | Borrow image/index store (default `.data/borrow-shares`) |
| `X_REPAY_SHARE_TTL_DAYS` | Repay link TTL (default `90`) |
| `X_BORROW_SHARE_TTL_DAYS` | Borrow link TTL (default: same as repay TTL) |
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
