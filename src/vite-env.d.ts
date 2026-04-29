/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional host for bonus rewards app URLs (default `rewards.nautilus.sh`). Host only, no `https://`. */
  readonly VITE_REWARDS_PROVIDER_HOST?: string;
  /** WalletConnect Cloud project id for RainbowKit (xChain / EVM). Falls back in code if unset. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}
