/**
 * Pera's connect sheet is `position: fixed; height: 100vh; bottom: 0`.
 * Mobile browsers treat 100vh as the tall layout viewport, so the launch
 * button sits under the browser toolbar. Pin the overlay to the visual
 * viewport so the button stays on screen in every browser.
 */

const PERA_CONNECT_WRAPPER_ID = "pera-wallet-connect-modal-wrapper";

type ViewportBox = {
  height: number;
  offsetTop: number;
};

type OverlayStyleTarget = {
  style: {
    top: string;
    height: string;
    bottom: string;
  };
};

function needsPin(current: string, next: number) {
  const parsed = Number.parseFloat(current);
  return !Number.isFinite(parsed) || Math.abs(parsed - next) > 0.5;
}

export function pinPeraConnectModalOverlay(
  overlay: OverlayStyleTarget,
  viewport: ViewportBox
) {
  // Browsers serialize subpixel style values (1000.208px → "1000.21px").
  // Compare numerically so a viewport scroll does not rewrite the same box.
  if (needsPin(overlay.style.top, viewport.offsetTop)) {
    overlay.style.top = `${viewport.offsetTop}px`;
  }
  if (needsPin(overlay.style.height, viewport.height)) {
    overlay.style.height = `${viewport.height}px`;
  }
  if (overlay.style.bottom !== "auto") overlay.style.bottom = "auto";
}

const MOBILE_SHEET_CLASS = "pera-wallet-modal--mobile";
const alignedMobileSheets = new WeakMap<object, { scrollTop: number }>();

type MobileSheet = {
  style: { maxHeight: string };
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
};

type SheetOverlay = {
  classList: { contains(token: string): boolean };
  querySelector(selector: string): unknown;
};

function asMobileSheet(value: unknown): MobileSheet | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("style" in value) || !("scrollHeight" in value) || !("clientHeight" in value)) {
    return null;
  }
  return value as MobileSheet;
}

/**
 * On a short screen the bottom-anchored sheet is taller than the overlay, so
 * the close control sits above the visible area and cannot be scrolled to.
 * Cap the sheet to the overlay and start at the bottom, where Launch and
 * Install are. The close control is at the top of that same scroll.
 * Layout can grow after the first pass (fonts, images). Keep following the
 * bottom until the user scrolls up toward the close control.
 */
export function fitPeraConnectMobileSheet(overlay: SheetOverlay) {
  if (!overlay.classList.contains(MOBILE_SHEET_CLASS)) return;
  const sheet = asMobileSheet(overlay.querySelector(".pera-wallet-modal__body"));
  if (!sheet) return;

  sheet.style.maxHeight = "100%";
  const maxScroll = sheet.scrollHeight - sheet.clientHeight;
  if (maxScroll <= 1) return;

  const previous = alignedMobileSheets.get(sheet);
  const userScrolledUp =
    previous !== undefined &&
    Math.abs(sheet.scrollTop - previous.scrollTop) > 1 &&
    Math.abs(sheet.scrollTop - maxScroll) > 1;
  if (userScrolledUp) return;

  sheet.scrollTop = sheet.scrollHeight;
  alignedMobileSheets.set(sheet, { scrollTop: sheet.scrollTop });
}

function findPeraConnectOverlay(): HTMLElement | null {
  const overlay = document
    .querySelector("pera-wallet-connect-modal")
    ?.shadowRoot?.querySelector(".pera-wallet-modal");
  return overlay instanceof HTMLElement ? overlay : null;
}

let installed = false;

export function installPeraConnectModalViewportPin() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let listening = false;
  let pinFrames = 0;

  const sync = () => {
    const overlay = findPeraConnectOverlay();
    if (!overlay) {
      detach();
      if (document.getElementById(PERA_CONNECT_WRAPPER_ID) && pinFrames < 10) {
        pinFrames += 1;
        requestAnimationFrame(sync);
      }
      return;
    }
    pinFrames = 0;
    pinOpenOverlay(overlay);
    attach();
  };

  const pinOpenOverlay = (overlay: HTMLElement) => {
    pinPeraConnectModalOverlay(overlay, viewport);
    fitPeraConnectMobileSheet(overlay);
    // The first pass can run before fonts and images finish layout.
    requestAnimationFrame(() => {
      const current = findPeraConnectOverlay();
      if (current) fitPeraConnectMobileSheet(current);
    });
  };

  const onViewportChange = () => {
    const overlay = findPeraConnectOverlay();
    if (!overlay) {
      detach();
      return;
    }
    pinOpenOverlay(overlay);
  };

  function attach() {
    if (listening) return;
    listening = true;
    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
  }

  function detach() {
    if (!listening) return;
    listening = false;
    viewport.removeEventListener("resize", onViewportChange);
    viewport.removeEventListener("scroll", onViewportChange);
  }

  const observer = new MutationObserver(() => {
    sync();
  });
  observer.observe(document.body, { childList: true });
  sync();
}
