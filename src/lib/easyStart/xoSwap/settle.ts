/** When an Exodus order is done enough to supply into Earn. */

export function isXoOrderSettled(order: {
  status?: string;
  toTransactionId?: string;
}): boolean {
  const status = (order.status || "").toLowerCase();
  if (status === "complete" || status === "completed") return true;
  if (typeof order.toTransactionId === "string" && order.toTransactionId.trim()) {
    return true;
  }
  return false;
}

export function isXoOrderFailed(order: { status?: string }): boolean {
  const status = (order.status || "").toLowerCase();
  return status === "failed" || status === "expired" || status === "refunded";
}

/** Algorand USDC rose by most of the quoted Exodus output (spread allowed). */
export function isAlgoCreditArrived(args: {
  current: number;
  baseline: number;
  expectedToAmount: number;
}): boolean {
  if (!Number.isFinite(args.current) || !Number.isFinite(args.baseline)) {
    return false;
  }
  const expected = Number.isFinite(args.expectedToAmount)
    ? args.expectedToAmount
    : 0;
  const minCredit = Math.max(0.01, expected * 0.9);
  return args.current + 1e-9 >= args.baseline + minCredit;
}
