import { aramidClaimUrl } from "@/lib/easyStart/aramid/constants";

/** Timed out waiting for soldiers to credit Base USDC. Source lock already succeeded. */
export class AramidCreditPendingError extends Error {
  readonly claimUrl: string;
  readonly claimTxId?: string;

  constructor(claimTxId?: string) {
    const claimUrl = aramidClaimUrl(claimTxId);
    super("USD is still on the way");
    this.name = "AramidCreditPendingError";
    this.claimUrl = claimUrl;
    this.claimTxId = claimTxId;
  }
}

export function isAramidCreditPendingError(
  error: unknown
): error is AramidCreditPendingError {
  return error instanceof AramidCreditPendingError;
}
