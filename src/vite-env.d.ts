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
  /** Optional absolute URL for “claim manually” in the NFT rewards modal (defaults to docs). */
  readonly VITE_NFT_CLAIM_MANUAL_URL?: string;
  /** `claimlayer-paid-claimall` JSON `targetChain` (default `voi:mainnet`). Execute body includes `algorandAddress` + `address` (AVM beneficiary). */
  readonly VITE_CLAIMLAYER_TARGET_CHAIN?: string;
}
