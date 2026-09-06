export const BORROW_SHARE_WIDTH = 1200;
export const BORROW_SHARE_HEIGHT = 675;

/**
 * Borrow confirmation share artwork (1200×675).
 * Beach whales at a loan desk — overlay text sits in the sky above.
 */
export const BORROW_SHARE_TEMPLATE_PATH =
  "/images/share/borrow-confirmation-template.png";

export function resolveBorrowShareTemplatePath(): string {
  return BORROW_SHARE_TEMPLATE_PATH;
}

export type BorrowShareInput = {
  amount: string;
  assetSymbol: string;
  /** Token icon URL drawn in front of the ticker on the share image. */
  assetIconSrc?: string;
  network?: string;
};

export type BorrowShareResult = {
  blob: Blob;
  objectUrl: string;
};

export type ShareBorrowConfirmationOutcome =
  | "link"
  | "native"
  | "clipboard"
  | "download"
  | "text-only";
