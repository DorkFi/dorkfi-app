/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional host for bonus rewards app URLs (default `rewards.nautilus.sh`). Host only, no `https://`. */
  readonly VITE_REWARDS_PROVIDER_HOST?: string;
}
