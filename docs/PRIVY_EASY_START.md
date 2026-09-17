# Privy Easy Start onboarding

Optional email / social onboarding path for **Algorand Mainnet only**. Existing wallet connect (Pera, Defly, WalletConnect, RainbowKit xChain) is unchanged.

## User flow

1. **Get Started** → Privy login (email, Google, Apple, passkey)
2. Embedded EVM wallet created on **Base**
3. **Deposit** → one sheet: amount → Coinbase Onramp / Apple Pay / card → (ETH gas top-up if needed) → Deposit to Earn (XO Swap + supply)
4. Algorand xChain address derived from EVM wallet → DorkFi markets (supply signing: Phase 5)
5. **Withdraw** → one sheet: amount → automatic Algorand→Base USDC via **XO Swap** → optional **in-app cash-out** (Coinbase Offramp or MoonPay Sell) via Privy USDC transfer

Advanced XO Swap UI remains available as an escape hatch (Portfolio **Move USDC**).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | No | Privy dashboard app ID (falls back to the baked-in DorkFi app id) |
| `VITE_ENABLE_PRIVY_ONBOARDING` | No | `true` / `1` to enable in production; `false` / `0` to force off. **beta.dork.fi** auto-enables without this. |
| `VITE_MOONPAY_API_KEY` | For MoonPay sell | Publishable MoonPay key (`pk_test_…` / `pk_live_…`) |
| `MOONPAY_SECRET_KEY` | For MoonPay sell | Server-only secret for widget URL signing |
| `CDP_API_KEY_ID` | For Coinbase Onramp + Offramp | Coinbase Developer Platform secret API key id |
| `CDP_API_KEY_SECRET` | For Coinbase Onramp + Offramp | CDP secret (PEM / multiline OK in `.env`) |
| `PRIVY_APP_ID` | For Coinbase Offramp / sponsor | Optional. Verifies the user's Privy JWT. Falls back to `VITE_PRIVY_APP_ID` / baked app id |
| `PRIVY_APP_SECRET` | Sponsor / Coinbase | Privy app secret. Binds sponsor and Coinbase Onramp destinations to the user's embedded wallet |
| `SPONSOR_ENABLED` | For sponsor | `true` to send dust Base ETH + Algorand ALGO to new Easy Start wallets |
| `SPONSOR_ETH_PRIVATE_KEY` | For sponsor | Dedicated Base treasury private key (never `VITE_`) |
| `SPONSOR_ALGO_MNEMONIC` | For sponsor | Dedicated Algorand 25-word mnemonic |
| `VITE_OFFRAMP_API_BASE` | No | Defaults to `/api/offramp` (Vite plugin in dev). Point at your API in production. |
| `VITE_OFFRAMP_REDIRECT_URL` | No | Coinbase Offramp redirect (allowlist in CDP). Defaults to `{origin}/portfolio`. |
| `XO_SWAP_APP_NAME` | For USDC move | Exodus XO Swap partner `App-Name` (server-only) |
| `XO_SWAP_APP_VERSION` | No | Defaults to `1.0.0` |
| `XO_SWAP_API_KEY` | No | Optional Bearer token if Exodus issues one |
| `XO_SWAP_API_BASE` | No | Defaults to `https://exchange.exodus.io` |
| `VITE_XO_SWAP_API_BASE` | No | Defaults to `/api/xo-swap` (Vite plugin in dev). Point at your API in production. |

In local development, Easy Start defaults on. On **https://beta.dork.fi** it also auto-enables (see `PRIVY_AUTO_ENABLE_ORIGINS`). Production (`app.dork.fi`) still needs `VITE_ENABLE_PRIVY_ONBOARDING=true` (or the config feature flag) until you choose to roll it out.

### Off-ramp API (dev)

The Vite plugin `plugins/offrampApiPlugin.ts` serves:

- `GET /api/offramp/health` (`coinbase`, `moonpay`, `walletBind` = `PRIVY_APP_SECRET` present)
- `POST /api/offramp/coinbase/session` (requires `Authorization: Bearer <Privy access token>`). Returns `buyUrl` (Onramp) and `sellUrl` (Offramp).
- `GET /api/offramp/coinbase/status/:partnerUserRef` (same Bearer token)
- `POST /api/offramp/moonpay/sign` (same Bearer token)

Put CDP / MoonPay **secrets in `.env`** (not `VITE_*`). Restart `npm run dev` after changing them. For production, mount the same handlers from `server/offramp/handlers.ts` on your API and set `VITE_OFFRAMP_API_BASE`.

Session-token routes refuse unauthenticated callers so only a signed-in Get Started user can mint a Coinbase Onramp/Offramp session.

Deposit → **Coinbase** (default pay method) opens `buyUrl` (`https://pay.coinbase.com/buy/select-asset?sessionToken=…&defaultExperience=buy`). The destination `0x` must be a Privy wallet on the JWT (`PRIVY_APP_SECRET`). `clientIp` is taken from edge headers (`cf-connecting-ip` / `x-real-ip`), never the JSON body or `X-Forwarded-For`. `partnerUserRef` is the Privy user id. `redirectUrl` must match the request origin or `VITE_OFFRAMP_REDIRECT_URL` (allowlist that URL in CDP). Cash-out still uses `sellUrl`.

### XO Swap API (dev)

The Vite plugin `plugins/xoSwapApiPlugin.ts` serves:

- `GET /api/xo-swap/health`
- `GET /api/xo-swap/pair/:pairId/rates`
- `GET /api/xo-swap/pair/:pairId/quotes?amount=`
- `POST /api/xo-swap/orders` / `POST /api/xo-swap/orders/float`
- `GET|PATCH /api/xo-swap/orders/:orderId`

Put `XO_SWAP_APP_NAME` in `.env` (not `VITE_*`). Restart `npm run dev` after changing it. For production, mount `server/xoSwap/handlers.ts` on your API and set `VITE_XO_SWAP_API_BASE`.

Confirm with Exodus that Direct Swap pairs exist for:

- Base → Algorand: `USDCbasemainnetB5A52617_USDCALGO`
- Algorand → Base: `USDCALGO_USDCbasemainnetB5A52617`

`/pairs`, `/rates`, and `/orders` are geo-gated. Local `npm run dev` uses your machine’s IP, so a `RESTRICTED_GEOLOCATION` response means Exodus is blocking this region — retrying will not help. Test from an allowed network or ask Exodus to enable the pair for `XO_SWAP_APP_NAME`.

### Gas sponsor API (dev)

The Vite plugin `plugins/sponsorApiPlugin.ts` serves:

- `GET /api/easy-start/health`
- `POST /api/easy-start/sponsor` (requires `Authorization: Bearer <Privy access token>`)

Off until `SPONSOR_ENABLED=true`. When a signed-in Easy Start wallet is below the Deposit to Earn floors (0.00005 ETH on Base / 0.1 spendable ALGO), the handler sends **0.0001 ETH** and **1 ALGO** from dedicated treasuries. The Algorand address is re-derived server-side; the EVM destination must match a Privy wallet on the JWT.

Put treasury keys in `.env` (never `VITE_*`). Create dedicated treasuries — do not reuse personal or offramp keys. The client calls this on login and again before Deposit to Earn; a missed or failed send still falls through to the existing ETH/ALGO balance checks.

SimplFi production mounts the same handlers in `server/index.ts`. Railway/Docker only include this code after `dorkfi-app` is pushed and SimplFi `DORKFI_REF` is updated.

## Privy dashboard setup

- Enable login methods: email, Google, Apple, passkey
- Embedded wallets: create on login for users without wallets
- Default chain: **Base**
- Enable fiat **on-ramp** (USDC on Base) — MoonPay / Coinbase buy
- Add allowed origins (localhost, staging, production)

## Coinbase / MoonPay off-ramp setup

- **Coinbase CDP**: enable Offramp, create Secret API Key, allowlist redirect domains
- **MoonPay**: create Sell widget keys; put publishable key in `VITE_MOONPAY_API_KEY` and secret in `MOONPAY_SECRET_KEY`

Cash-out flow after bridge:

1. User picks Coinbase or MoonPay
2. Provider sell UI runs (Coinbase hosted page / MoonPay overlay)
3. App learns deposit address → Privy `sendTransaction` transfers Base USDC
4. Provider pays fiat to the user’s bank / Coinbase account

## Architecture

| Layer | Location |
| --- | --- |
| Feature flag | `src/config/index.ts` → `enablePrivyOnboarding` |
| Privy provider + session context | `src/contexts/PrivySessionProvider.tsx` |
| Unified session | `src/hooks/useDorkFiSession.ts` |
| xChain address derivation | `src/services/xchainAddressService.ts` |
| Header UI | `WalletNetworkButton` — Get Started dropdown with Email + Connect Wallet |
| Fiat + Coinbase Onramp | `src/components/easy-start/EasyStartDepositSheet.tsx` — Cash Stash–style Deposit; Coinbase opens `pay.coinbase.com/buy/select-asset` |
| Withdraw auto-swap | `src/components/easy-start/EasyStartWithdrawSheet.tsx` — Algorand→Base USDC |
| In-app cash-out | `src/components/easy-start/EasyStartOfframpCashOut.tsx` — Coinbase + MoonPay |
| Off-ramp API (dev) | `server/offramp/handlers.ts` + `plugins/offrampApiPlugin.ts` |
| XO Swap API (dev) | `server/xoSwap/handlers.ts` + `plugins/xoSwapApiPlugin.ts` |
| Gas sponsor (ETH + ALGO) | `server/sponsor/handlers.ts` + `plugins/sponsorApiPlugin.ts` — `POST /api/easy-start/sponsor` |
| Headless XO Swap | `src/components/easy-start/EasyStartHeadlessBridge.tsx` (both directions) |
| Swap orchestrator | `src/lib/easyStart/xoSwap/runUsdcSwap.ts` |
| Advanced swap UI | `src/components/easy-start/EasyStartBridgeSheet.tsx` — escape hatch |
| Portfolio staging strip | `src/components/portfolio/EasyStartFundingStrip.tsx` — Deposit + Withdraw + Move USDC |

Native wallet sessions take precedence over Privy when both could apply.

## Rollback

Set `VITE_ENABLE_PRIVY_ONBOARDING=false` (forces off even on beta), or remove the origin from `PRIVY_AUTO_ENABLE_ORIGINS` / set `enablePrivyOnboarding: false` in config. No migration required.

## Phase 5 — On-chain signing (shipped)

Privy Easy Start users can sign Algorand transactions via EIP-712 using the embedded EVM wallet:

- `src/wallet/privyXchainSignTransactions.ts` — `AlgoXEvmSdk.signTxn` + Privy `useSignTypedData`
- `src/hooks/useDorkFiWalletAdapter.ts` — merges `useWallet()` with Privy session
- Supply / withdraw / borrow / repay modals use `useDorkFiWalletAdapter()` instead of raw `useWallet()`

Synthetic wallet id: `privy-easy-start` (treated like RainbowKit xChain for network support checks).

## Not in scope (follow-ups)
- Profile setup (preferred name, avatar)
- Voi / Voi bridge
- Production hosting of `/api/offramp`, `/api/xo-swap`, and `/api/easy-start` outside Vite (SimplFi `server/index.ts` already mounts them)
- RainbowKit `XchainUsdcBridgeControls` still uses the legacy Allbridge dialog — migrate separately

See implementation plan in team docs for full phasing.
