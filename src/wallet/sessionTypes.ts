/** How the user authenticated with DorkFi. */
export type AuthPath = "avm" | "rainbowkit" | "privy" | "none";

export interface DorkFiSession {
  authPath: AuthPath;
  /** Native AVM or xChain Algorand address used for portfolio / lending. */
  algorandAddress: string | null;
  /** Set for RainbowKit xChain and Privy Easy Start sessions. */
  evmAddress: string | null;
  isAuthenticated: boolean;
  displayName: string | null;
}

export const EMPTY_DORKFI_SESSION: DorkFiSession = {
  authPath: "none",
  algorandAddress: null,
  evmAddress: null,
  isAuthenticated: false,
  displayName: null,
};
