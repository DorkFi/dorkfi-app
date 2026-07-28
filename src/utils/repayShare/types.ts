export const REPAY_SHARE_WIDTH = 1200;
export const REPAY_SHARE_HEIGHT = 675;

/**
 * Repay confirmation share artwork (1200×675).
 * Beach whales exchanging coins — overlay text sits in the sky above.
 */
export const REPAY_SHARE_TEMPLATE_PATH =
  "/images/share/repay-confirmation-template.png";

export function resolveRepayShareTemplatePath(): string {
  return REPAY_SHARE_TEMPLATE_PATH;
}

export type RepayShareInput = {
  amount: string;
  assetSymbol: string;
  /** Token icon URL drawn in front of the ticker on the share image. */
  assetIconSrc?: string;
  /**
   * When set (and different from `assetSymbol`), draw a cross-asset footer:
   * WITH / [icon] PAID_WITH_TICKER
   */
  paidWithSymbol?: string;
  paidWithIconSrc?: string;
  network?: string;
};

export type RepayShareResult = {
  blob: Blob;
  objectUrl: string;
};

export type ShareRepayConfirmationOutcome =
  | "link"
  | "native"
  | "clipboard"
  | "download"
  | "text-only";
