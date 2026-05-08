/**
 * Detects clicks/focus targets inside wallet UIs that portal to `document.body`
 * (RainbowKit, WalletConnect / AppKit). Radix `Dialog` with `modal` treats these as
 * "outside" the dialog — use with `onPointerDownOutside` / `onInteractOutside` to
 * `preventDefault()` so the host dialog does not steal or dismiss incorrectly.
 */
export function isPortaledWalletPickerUi(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-rk]") ||
      target.closest('[aria-labelledby="rk_connect_title"]') ||
      target.closest("w3m-modal") ||
      target.closest("wcm-modal")
  );
}
