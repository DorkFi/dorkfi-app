# X Share API (OAuth + image tweet)

Governance vote sharing can post the generated PNG directly to X using the **X API v2** and **OAuth 2.0 PKCE**.

## Architecture

| Layer | Path |
|-------|------|
| Share server | `server/index.ts` (Hono, port `8788`) |
| Frontend client | `src/services/xShareService.ts` |
| Share flow | `src/utils/governanceShare/shareGovernanceVote.ts` |
| UI | `src/components/governance/VoteSuccessModal.tsx` |

## Local development

1. Create an X Developer app with **OAuth 2.0** user auth and scopes:
   `tweet.write`, `users.read`, `offline.access`
2. Register this **exact** callback URL in the X Developer Portal:

   ```
   http://localhost:8080/api/x-share/auth/x/callback
   ```

   This goes through the Vite proxy so OAuth session cookies stay on `localhost:8080`
   (do **not** use `127.0.0.1:8788` for local callback — that breaks cookie/session matching).

3. Copy `.env.example` → `.env` and fill `X_CLIENT_ID` / `X_CLIENT_SECRET`.
4. Install dependencies (if not already):

   ```bash
   npm install
   ```

5. Run the share server:

   ```bash
   npm run dev:share-server
   ```

6. Run the app:

   ```bash
   npm run dev
   ```

7. Vote on `/governance`, open the success modal, click **Connect X**, then **Share on X**.

The Vite proxy forwards `/api/x-share/*` → `http://127.0.0.1:8788/*` so session cookies stay same-origin on `localhost:8080`.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health + `xApiConfigured` |
| `GET` | `/auth/x/status` | Session connection status |
| `GET` | `/auth/x/start?returnTo=/governance` | Begin OAuth PKCE |
| `GET` | `/auth/x/callback` | OAuth callback (X redirects here) |
| `POST` | `/auth/x/disconnect` | Clear stored tokens |
| `POST` | `/share/governance-vote` | `multipart/form-data`: `image`, `text` |

## Production deployment

`app.dork.fi` is static hosting — `/api/x-share` on that domain returns the SPA, **not** the share server. Deploy `server/` separately (e.g. Railway using `railway.toml` + `nixpacks.toml` in the repo root).

Nixpacks is forced to **Node 20** and **`npm ci`** (the repo also has `bun.lockb`, which would otherwise break installs).

| Variable | Example |
|----------|---------|
| `X_CLIENT_ID` | From X Developer Portal (optional for link-share-only) |
| `X_CLIENT_SECRET` | From X Developer Portal (optional for link-share-only) |
| `X_CALLBACK_URL` | `https://dorkfi-app-production.up.railway.app/auth/x/callback` |
| `X_SHARE_FRONTEND_ORIGIN` | `https://app.dork.fi` |
| `X_SHARE_SESSION_SECRET` | Long random string |
| `X_SHARE_PUBLIC_BASE` | Optional — auto-set from `RAILWAY_PUBLIC_DOMAIN` on Railway |
| `NODE_ENV` | `production` |
| `NIXPACKS_NODE_VERSION` | `20` (also set in `nixpacks.toml`) |

Build the frontend with the deployed share server origin (or rely on the production default in `xShareService.ts`):

```bash
VITE_X_SHARE_API_BASE=https://dorkfi-app-production.up.railway.app npm run build
```

Ensure CORS allows `X_SHARE_FRONTEND_ORIGIN` with credentials. Cookies use `SameSite=None; Secure` in production.

**Link preview requirement:** X’s crawler must reach `https://your-share-api.example.com/gov/:id` and `.../image.png` over the public internet. `localhost` URLs will not show a card preview on X.

## Share priority

When the X API is configured and the user is connected:

1. **API post** (image uploaded + tweet created)
2. Otherwise **link share** (permalink with OG image → X compose opens with URL in tweet text)
3. Otherwise **Web Share API** (mobile)
4. Otherwise **clipboard + X intent**
5. Otherwise **download + X intent**

Link shares are served from the share server at `/gov/:id` (HTML + OG tags for crawlers) and `/gov/:id/image.png` (PNG). Humans visiting `/gov/:id` are redirected to `/governance`.

## Link share endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/share/governance-vote/link` | `multipart/form-data`: `image`, `proposalId`, `proposalTitle`, `support`, `votingPower` |
| `GET` | `/gov/:id` | OG HTML for crawlers; redirect humans to governance |
| `GET` | `/gov/:id/image.png` | Stored share PNG |

Set `X_SHARE_PUBLIC_BASE` to the public URL prefix for permalinks (e.g. `https://share-api.example.com` or `https://app.dork.fi/api/x-share`).

## Token storage

Tokens are stored in `.data/x-share-tokens.json` by default (gitignored). For production, replace with Redis or a database keyed by session ID.
