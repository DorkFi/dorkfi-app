# Privy Easy Start onboarding

Optional email / social onboarding path for **Algorand Mainnet only**. Existing wallet connect (Pera, Defly, WalletConnect, RainbowKit xChain) is unchanged.

## User flow

1. **Get Started** → Privy login (email, Google, Apple, passkey)
2. Embedded EVM wallet created on **Base**
3. **Deposit** → one sheet: amount → card/Apple Pay → (ETH gas top-up if needed) → automatic Base→Algorand USDC bridge
4. Algorand xChain address derived from EVM wallet → DorkFi markets (supply signing: Phase 5)
5. **Withdraw** → one sheet: amount → automatic Algorand→Base USDC bridge → USDC on Base wallet

Advanced Allbridge UI remains available as an escape hatch. Bank/card off-ramp is not included yet.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | Yes (when enabled) | Privy dashboard app ID |
| `VITE_ENABLE_PRIVY_ONBOARDING` | No | `true` / `1` to enable in production |

In local development, `enablePrivyOnboarding` defaults to `true` in `getEnvironmentConfig()` when `NODE_ENV=development`.

## Privy dashboard setup

- Enable login methods: email, Google, Apple, passkey
- Embedded wallets: create on login for users without wallets
- Default chain: **Base**
- Enable fiat on-ramp (USDC on Base)
- Add allowed origins (localhost, staging, production)

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

See implementation plan in team docs for full phasing.
