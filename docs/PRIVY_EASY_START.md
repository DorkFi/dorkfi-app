# Privy Easy Start onboarding

Optional email / social onboarding path for **Algorand Mainnet only**. Existing wallet connect (Pera, Defly, WalletConnect, RainbowKit xChain) is unchanged.

## User flow

1. **Get Started** → Privy login (email, Google, Apple, passkey)
2. Embedded EVM wallet created on **Base**
3. **Deposit** → one sheet: amount → card/Apple Pay → (ETH gas top-up if needed) → automatic Base→Algorand USDC via **XO Swap**
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
| `CDP_API_KEY_ID` | For Coinbase Offramp | Coinbase Developer Platform secret API key id |
| `CDP_API_KEY_SECRET` | For Coinbase Offramp | CDP secret (PEM / multiline OK in `.env`) |
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

- `GET /api/offramp/health`
- `POST /api/offramp/coinbase/session`
- `GET /api/offramp/coinbase/status/:partnerUserRef`
- `POST /api/offramp/moonpay/sign`

Put CDP / MoonPay **secrets in `.env`** (not `VITE_*`). Restart `npm run dev` after changing them. For production, mount the same handlers from `server/offramp/handlers.ts` on your API and set `VITE_OFFRAMP_API_BASE`.

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
| Fiat + auto-swap | `src/components/easy-start/EasyStartDepositSheet.tsx` — Cash Stash–style orchestrated Deposit |
| Withdraw auto-swap | `src/components/easy-start/EasyStartWithdrawSheet.tsx` — Algorand→Base USDC |
| In-app cash-out | `src/components/easy-start/EasyStartOfframpCashOut.tsx` — Coinbase + MoonPay |
| Off-ramp API (dev) | `server/offramp/handlers.ts` + `plugins/offrampApiPlugin.ts` |
| XO Swap API (dev) | `server/xoSwap/handlers.ts` + `plugins/xoSwapApiPlugin.ts` |
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
- Production hosting of `/api/offramp` and `/api/xo-swap` outside Vite (wire handlers into dorkfi-api or similar)
- RainbowKit `XchainUsdcBridgeControls` still uses the legacy Allbridge dialog — migrate separately

See implementation plan in team docs for full phasing.
