/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional host for bonus rewards app URLs (default `rewards.nautilus.sh`). Host only, no `https://`. */
  readonly VITE_REWARDS_PROVIDER_HOST?: string;
  /** WalletConnect Cloud project id for RainbowKit (xChain / EVM). Falls back in code if unset. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Paid-workflow gateway origin: absolute `https://…` only (no `/api` Vite proxy path). */
  readonly VITE_PAID_WORKFLOW_GATEWAY_URL?: string;
  /** Optional Bearer token for gateway `Authorization` when required. */
  readonly VITE_PAID_WORKFLOW_GATEWAY_API_KEY?: string;
  /** NFT claim-agent base URL: absolute `https://…/claim` (defaults to Railway production if unset/invalid). */
  readonly VITE_NFT_CLAIM_AGENT_BASE?: string;
  /** Optional 58-char relayer for `GET …/claim/:addr/unsigned?relayer=`; defaults to the beneficiary address. */
  readonly VITE_NFT_CLAIM_RELAYER_ADDRESS?: string;
  /** Optional API key for `POST …/claim/batch/unsigned` (Bearer + x-api-key). Without it, batch uses parallel GETs. */
  readonly VITE_NFT_CLAIM_AGENT_API_KEY?: string;
  /** Optional absolute URL for “claim manually” in the NFT rewards modal (defaults to docs). */
  readonly VITE_NFT_CLAIM_MANUAL_URL?: string;
  /** `claimlayer-paid-claimall` JSON `targetChain` (default `voi:mainnet`). Execute body includes `algorandAddress` + `address` (AVM beneficiary). */
  readonly VITE_CLAIMLAYER_TARGET_CHAIN?: string;
  /** When `false` or `0`, NFT holder pay-agent on Base shows maintenance UI instead of WalletConnect. */
  readonly VITE_ENABLE_AGENT_CLAIM?: string;
  /** When `true` or `1`, skip NFT holder eligibility checks before pay-agent (dev/staging only). */
  readonly VITE_BYPASS_AGENT_CLAIM_ELIGIBILITY?: string;
  /** When `false` or `0`, hide the Liquidity Pools page. */
  readonly VITE_ENABLE_POOLS?: string;
  /** When `true` or `1`, show Deposit / Withdraw LP actions on pool cards (Supply / Withdraw always shown). */
  readonly VITE_ENABLE_POOL_DEPOSIT_WITHDRAW?: string;
  /** Privy app id for Easy Start email / social onboarding. */
  readonly VITE_PRIVY_APP_ID?: string;
  /** When `true` or `1`, show Get Started (Privy) alongside Connect Wallet. */
  readonly VITE_ENABLE_PRIVY_ONBOARDING?: string;
}
