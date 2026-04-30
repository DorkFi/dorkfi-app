/** Active wallet is xChain EVM (RainbowKit) per use-wallet fork. */
export function isRainbowkitXchainWallet(
  wallet: { id: string } | null | undefined
): boolean {
  return (wallet?.id ?? "").toLowerCase() === "rainbowkit";
}

type SetSuppressed = (value: boolean) => void;

/**
 * Temporarily dismiss the host Radix dialog (`open={isOpen && !suppressed}`) so
 * xChain / WalletUI / MetaMask prompts are not trapped behind a modal overlay.
 *
 * When `leaveOverlayDismissedOnSuccess` is true (RainbowKit only), a successful
 * `run()` leaves the overlay dismissed so the host modal stays hidden until the
 * caller closes it (e.g. `onClose()`). On error, overlay is always restored.
 */
export async function withRainbowkitHostDialogDismissed<T>(opts: {
  wallet: { id: string } | null | undefined;
  setSuppressed: SetSuppressed;
  /** Extra time after closing overlay before invoking the wallet (ms). */
  settleMs?: number;
  run: () => Promise<T>;
  leaveOverlayDismissedOnSuccess?: boolean;
}): Promise<T> {
  const {
    wallet,
    setSuppressed,
    settleMs = 220,
    run,
    leaveOverlayDismissedOnSuccess = false,
  } = opts;
  if (!isRainbowkitXchainWallet(wallet)) {
    return run();
  }
  setSuppressed(true);
  await new Promise((r) => setTimeout(r, settleMs));
  try {
    const result = await run();
    if (!leaveOverlayDismissedOnSuccess) {
      setSuppressed(false);
    }
    return result;
  } catch (e) {
    setSuppressed(false);
    throw e;
  }
}
