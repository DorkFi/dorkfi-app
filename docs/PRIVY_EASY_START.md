# Privy Easy Start onboarding

Optional email / social onboarding path for **Algorand Mainnet only**. Existing wallet connect (Pera, Defly, WalletConnect, RainbowKit xChain) is unchanged.

## User flow

1. **Get Started** → Privy login (email, Google, Apple, passkey)
2. Embedded EVM wallet created on **Base**
3. **Deposit** → one sheet: amount → card/Apple Pay → (ETH gas top-up if needed) → automatic Base→Algorand USDC bridge
4. Algorand xChain address derived from EVM wallet → DorkFi markets (supply signing: Phase 5)
5. **Withdraw** → one sheet: amount → automatic Algorand→Base USDC bridge → optional **in-app cash-out** (Coinbase Offramp or MoonPay Sell) via Privy USDC transfer

Advanced Allbridge UI remains available as an escape hatch.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | Yes (when enabled) | Privy dashboard app ID |
| `VITE_ENABLE_PRIVY_ONBOARDING` | No | `true` / `1` to enable in production |
| `VITE_MOONPAY_API_KEY` | For MoonPay sell | Publishable MoonPay key (`pk_test_…` / `pk_live_…`) |
| `MOONPAY_SECRET_KEY` | For MoonPay sell | Server-only secret for widget URL signing |
| `CDP_API_KEY_ID` | For Coinbase Offramp | Coinbase Developer Platform secret API key id |
| `CDP_API_KEY_SECRET` | For Coinbase Offramp | CDP secret (PEM / multiline OK in `.env`) |
| `VITE_OFFRAMP_API_BASE` | No | Defaults to `/api/offramp` (Vite plugin in dev). Point at your API in production. |
| `VITE_OFFRAMP_REDIRECT_URL` | No | Coinbase Offramp redirect (allowlist in CDP). Defaults to `{origin}/portfolio`. |

In local development, `enablePrivyOnboarding` defaults to `true` in `getEnvironmentConfig()` when `NODE_ENV=development`.

### Off-ramp API (dev)

The Vite plugin `plugins/offrampApiPlugin.ts` serves:

- `GET /api/offramp/health`
- `POST /api/offramp/coinbase/session`
- `GET /api/offramp/coinbase/status/:partnerUserRef`
- `POST /api/offramp/moonpay/sign`

Put CDP / MoonPay **secrets in `.env`** (not `VITE_*`). Restart `npm run dev` after changing them. For production, mount the same handlers from `server/offramp/handlers.ts` on your API and set `VITE_OFFRAMP_API_BASE`.

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
| Fiat + auto-bridge | `src/components/easy-start/EasyStartDepositSheet.tsx` — Cash Stash–style orchestrated Deposit |
| Withdraw auto-bridge | `src/components/easy-start/EasyStartWithdrawSheet.tsx` — Algorand→Base USDC |
| In-app cash-out | `src/components/easy-start/EasyStartOfframpCashOut.tsx` — Coinbase + MoonPay |
| Off-ramp API (dev) | `server/offramp/handlers.ts` + `plugins/offrampApiPlugin.ts` |
| Headless Allbridge | `src/components/easy-start/EasyStartHeadlessBridge.tsx` (supports both directions) |
| Advanced bridge UI | `src/components/easy-start/EasyStartBridgeSheet.tsx` — escape hatch |
| Bridge adapter | `src/hooks/usePrivyBridgeWalletAdapter.ts` |
| Portfolio staging strip | `src/components/portfolio/EasyStartFundingStrip.tsx` — Deposit + Withdraw |

Native wallet sessions take precedence over Privy when both could apply.

## Rollback

Set `VITE_ENABLE_PRIVY_ONBOARDING=false` or `enablePrivyOnboarding: false` in config. No migration required.

## Phase 5 — On-chain signing (shipped)

Privy Easy Start users can sign Algorand transactions via EIP-712 using the embedded EVM wallet:

- `src/wallet/privyXchainSignTransactions.ts` — `AlgoXEvmSdk.signTxn` + Privy `useSignTypedData`
- `src/hooks/useDorkFiWalletAdapter.ts` — merges `useWallet()` with Privy session
- Supply / withdraw / borrow / repay modals use `useDorkFiWalletAdapter()` instead of raw `useWallet()`

Synthetic wallet id: `privy-easy-start` (treated like RainbowKit xChain for network support checks).

## Not in scope (follow-ups)
- Profile setup (preferred name, avatar)
- Voi / Voi bridge
- Production hosting of `/api/offramp` outside Vite (wire `handlers.ts` into dorkfi-api or similar)

See implementation plan in team docs for full phasing.
