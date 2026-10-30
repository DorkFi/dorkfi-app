/** Synthetic use-wallet id for Privy Easy Start (not in WalletManager). */
export const PRIVY_EASY_START_WALLET_ID = "privy-easy-start";

export const privyEasyStartSyntheticWallet = {
  id: PRIVY_EASY_START_WALLET_ID,
  metadata: {
    name: "Easy Start",
    icon: "",
  },
} as const;

export function isPrivyEasyStartWallet(
  wallet: { id: string } | null | undefined
): boolean {
  return (wallet?.id ?? "").toLowerCase() === PRIVY_EASY_START_WALLET_ID;
}

export function isAlgorandMainnetXchainWallet(
  wallet: { id: string } | null | undefined,
  networkId: string
): boolean {
  if (networkId !== "algorand-mainnet") return false;
  const id = (wallet?.id ?? "").toLowerCase();
  return id === "rainbowkit" || id === PRIVY_EASY_START_WALLET_ID;
}
