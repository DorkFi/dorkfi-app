# xChain Accounts integration plan (Voi + Algorand)

**Status:** Partially implemented (Algorand Mainnet xChain path; Voi gated)  
**Audience:** Engineers integrating [xChain Accounts](https://github.com/algorandfoundation/xchain-accounts) into DorkFi PreFi.

## Implementation in this repo (done)

- **Packages:** `@txnlab/use-wallet*` aliased to `@d13co/*`, `algo-x-evm-sdk`, `@d13co/algo-x-evm-ui`, `@rainbow-me/rainbowkit`, `wagmi`, `viem` (see `package.json`).
- **`src/wallet/xchainWagmiConfig.ts`:** wagmi + `algorandChain`; `VITE_WALLETCONNECT_PROJECT_ID` optional (falls back to existing WC project id).
- **`src/main.tsx`:** `Buffer` + `TronWebProto` stub; RainbowKit + use-wallet-ui CSS.
- **`vite.config.ts`:** `resolve.dedupe` for react-query / wagmi / RainbowKit / use-wallet-react.
- **`src/contexts/NetworkContext.tsx`:** `WalletId.RAINBOWKIT` only when `networkId === "algorand-mainnet"`; `WalletUIProvider` + `evm-connect` disclaimer; `isNetworkSupportedByWallet` for `rainbowkit`.
- **`src/components/WalletModal.tsx`:** “MetaMask (xChain)” entry on Algorand Mainnet.
- **`src/components/WalletNetworkButton.tsx`:** RainbowKit → Algorand Mainnet only in network picker.

**Rollback:** Restore stock `@txnlab/use-wallet@^4.x` (non-alias), remove xChain-specific files/imports, and revert `NetworkContext` / `WalletModal` / `WalletNetworkButton` / `main.tsx` / `vite.config` edits.

**Voi:** xChain is **not** registered on `voi-mainnet` until the preconditions table is satisfied.

## Purpose

Define how to add **EVM-controlled Algorand accounts** (MetaMask-style signing via EIP-712 + LogicSig) while preserving **first-class support for both**:

- **Voi Mainnet** (`voi-mainnet`, AVM wallet stack, `walletNetworkId: voimain` in app config)
- **Algorand Mainnet** (`algorand-mainnet`, AVM wallet stack, `walletNetworkId: mainnet`)

Upstream positions the protocol as **beta** and documents **React** integration paths. Treat deployment and Voi parity as **discovery gates** before shipping.

## References

- [xChain Accounts repository](https://github.com/algorandfoundation/xchain-accounts) (LogicSig, `algo-x-evm-sdk`, forked `@txnlab/use-wallet*`, RainbowKit, optional bridge/swap UI, rpc-server, dfx)
- [INTEGRATION.md](https://github.com/algorandfoundation/xchain-accounts/blob/main/INTEGRATION.md) (package aliases, `WalletUIProvider`, wagmi, notices, Vite troubleshooting)
- Optional: [integration survey](https://forms.gle/qjY5hLREzem6Wrvk6) for early adopters

## How xChain fits DorkFi

Today PreFi uses **`@txnlab/use-wallet-react` v4** with a **`WalletManager`** built in `src/contexts/NetworkContext.tsx`: custom **`NetworkConfigBuilder`** (Algorand mainnet + `voimain`), and **`getWalletsForNetwork`** for AVM networks (Kibisis, Lute, Pera, Biatec, WalletConnect). Transaction flows overwhelmingly use **`useWallet()` → `signTransactions`**.

xChain adds a **parallel signer path**: same Algorand-style txns, but **sender** is a **LogicSig-derived address** and authorization is **EVM typed data**, not a native AVM wallet app. Integration should stay compatible with existing **`signTransactions`** call sites where the forked wallet stack provides a drop-in signer.

## Preconditions (must answer before build)

| Topic | Question | Impact | Answer (as of implementation) |
|--------|-----------|--------|--------------------------------|
| **LogicSig on Voi** | Is the xChain EVM LogicSig **deployed and supported** on Voi Mainnet with the same security model as Algorand? Does `algo-x-evm-sdk` expose chain/genesis config for **voimain** (genesis hash `r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=`)? | If **no**, ship xChain **only on Algorand** until upstream or DorkFi ops document Voi support. | **Not enabled on Voi** in the app; treat as **open** until confirmed with upstream/on-chain. |
| **Wagmi / “Algorand EVM” chain** | Does `algorandChain` (or equivalent) from the SDK map cleanly to **both** networks, or is a second chain definition required for Voi? | Drives **RainbowKit `chains`** and MetaMask custom-network UX. | **Algorand:** `algorandChain` from `algo-x-evm-sdk`. **Voi:** not wired. |
| **Protocol contracts** | Do Folks / PreFi contracts and indexing treat LogicSig senders like normal accounts everywhere (opt-ins, deposits, liquidations)? | May require **contract or indexer** confirmation, not only frontend. | **Open** — run Phase 4 QA on Algorand Mainnet with a funded xChain address. |

Document further answers in this file or a linked runbook when known.

## Target behavior (product)

1. **Algorand Mainnet:** User may connect **native AVM wallets** (existing) **or** xChain (EVM) where supported; **derived address** must be fundable and usable for PreFi operations supported on that network.
2. **Voi Mainnet:** Same **only if** preconditions pass; otherwise UI clearly states **xChain unavailable on Voi** and does not offer RainbowKit / xChain on that network.
3. **Network switching:** Switching `voi-mainnet` ↔ `algorand-mainnet` follows existing rules; **`isNetworkSupportedByWallet`** (and wallet modal copy) must include the new wallet id so users are not stuck in an invalid combination.

## Phased implementation

### Phase 0 — Discovery (time-boxed)

- Confirm with xChain / Algorand Foundation (or on-chain artifacts) **Voi support** and any **app ID / template** differences vs Algorand.
- Spike: forked `@d13co` packages + minimal RainbowKit + **Algorand Mainnet only** in a branch; one payment or opt-in flow end-to-end.

### Phase 1 — Dependencies and build

Per [INTEGRATION.md](https://github.com/algorandfoundation/xchain-accounts/blob/main/INTEGRATION.md):

- Install **`algo-x-evm-sdk`**, npm aliases for **`@txnlab/use-wallet`** / **`use-wallet-react`** / **`use-wallet-ui-react`** → **`@d13co/*`**, **`@rainbow-me/rainbowkit`**, optional **`@d13co/algo-x-evm-ui`**, optional Allbridge / Haystack if using bundled bridge or swap tab.
- Entry + **Vite**: `Buffer`, `globalThis`, optional `TronWebProto` stub; **dedupe** for react-query, wagmi, RainbowKit, use-wallet packages.
- **WalletConnect** project id for RainbowKit if required.

### Phase 2 — Wallet shell (DorkFi-specific)

- **`NetworkContext.tsx`**: When enabling xChain for a network, add **`WalletId.RAINBOWKIT`** (or the id the fork documents) with **`wagmiConfig`**; ensure **`WalletManager`** `networks` / **`defaultNetwork`** stay aligned with `getNetworkConfig(...).walletNetworkId` (`voimain` vs `mainnet`).
- **`WalletModal.tsx`** (and any provider list): Surface xChain / MetaMask path **only** for networks where Phase 0 succeeded.
- Optionally wrap with **`WalletUIProvider`** for transaction review, notices (`evm-connect`, `sign`, bridge disclaimers), and onboarding; match DorkFi theme.

### Phase 3 — Guards and UX

- Extend **`isNetworkSupportedByWallet`** for the xChain / RainbowKit wallet type: e.g. allow **only** `algorand-mainnet` until Voi is verified; then allow **both** if verified.
- Copy: beta disclaimer, funding the derived address (min ALGO / VOI), ASA opt-in flows if using upstream “Receive” / manage flows.

### Phase 4 — QA matrix

Run at least smoke + critical paths **per network** (as enabled):

| Area | Algorand | Voi (if enabled) |
|------|----------|------------------|
| Connect / disconnect / reconnect | ✓ | ✓ |
| Switch app network with xChain connected | ✓ | ✓ |
| Deposit / withdraw PreFi | ✓ | ✓ |
| Borrow / repay / HF-sensitive actions if applicable | ✓ | ✓ |
| Opt-in to assets | ✓ | ✓ |
| Atomic groups (if any single-user flow) | ✓ | ✓ |

Record failures; distinguish **SDK vs contract vs indexer** issues.

## Code touchpoints (this repo)

| Location | Notes |
|----------|--------|
| `src/contexts/NetworkContext.tsx` | `createWalletManager`, `getWalletsForNetwork`, `getNetworks`, `isNetworkSupportedByWallet` |
| `src/components/WalletModal.tsx` | Provider list and availability for AVM networks |
| `src/config/index.ts` | `voi-mainnet` / `algorand-mainnet` `walletNetworkId`, `networkType` |
| Call sites of `useWallet()` / `signTransactions` | Should remain unchanged if signer is drop-in; watch for assumptions on **account type** or **auth-addr** |

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Beta protocol | Disclaimers, feature flag, limited rollout |
| Voi not supported by template | Gate UI; document; track upstream issue |
| Bundle size / duplicate wagmi | Vite dedupe; lazy-load wallet UI if needed |
| User funds on wrong network | Clear network badge; disconnect on invalid switch |

## Out of scope (unless product asks)

- Self-hosting **rpc-server** or **dfx** (deferred execution): optional later for MetaMask Mobile or retry UX.
- Replacing native wallets: xChain is **additive**, not a replacement for Pera/Lute/etc.

## Completion criteria

- [x] Preconditions table filled for Voi + Algorand (see table above; Voi remains TBD)  
- [ ] Algorand Mainnet xChain path tested on agreed flows  
- [x] Voi path **explicitly disabled** in UI (no `RAINBOWKIT` in `WalletManager` on Voi) + docs  
- [ ] Security / legal notices for EVM connect reviewed  
- [x] Rollback plan documented (see **Implementation in this repo** above)

---

*Update this plan as upstream (`xchain-accounts`, `algo-x-evm-sdk`) and DorkFi network configs evolve.*
