/**
 * Detects clicks/focus targets inside wallet UIs that portal to `document.body`
 * (RainbowKit, WalletConnect / AppKit, Pera). Radix `Dialog` with `modal` treats
 * these as "outside" the dialog — use with `onPointerDownOutside` /
 * `onInteractOutside` to `preventDefault()` so the host dialog does not steal
 * or dismiss incorrectly.
 */
const PERA_WALLET_UI =
  "#pera-wallet-connect-modal-wrapper, #pera-wallet-redirect-modal-wrapper, #pera-wallet-sign-txn-modal-wrapper, #pera-wallet-sign-txn-toast-wrapper, pera-wallet-connect-modal, pera-wallet-redirect-modal, pera-wallet-sign-txn-modal, pera-wallet-sign-txn-toast";

export function isPortaledWalletPickerUi(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-rk]") ||
      target.closest('[aria-labelledby="rk_connect_title"]') ||
      target.closest("w3m-modal") ||
      target.closest("wcm-modal") ||
      target.closest(PERA_WALLET_UI)
  );
}
