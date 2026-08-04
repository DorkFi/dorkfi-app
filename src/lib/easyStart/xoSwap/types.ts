/** XO Swap V3 shapes used by Easy Start (subset; API may return extra fields). */

export type XoAmount = {
  value: number;
  /** Optional currency / asset id from API */
  currency?: string;
};

export type XoRate = {
  amount: XoAmount;
  minerFee: XoAmount;
  min: XoAmount;
  max: XoAmount;
  /** Unix ms expiry */
  expiry?: number;
};

export type XoQuote = {
  toAmount: XoAmount;
  fromAmount?: XoAmount;
  minerFee?: XoAmount;
  expiry?: number;
};

export type XoOrderStatus =
  | "inProgress"
  | "complete"
  | "failed"
  | "expired"
  | "refunded"
  | "delayed"
  | string;

export type XoOrder = {
  id: string;
  status?: XoOrderStatus;
  message?: string;
  payInAddress?: string;
  pairId?: string;
  fromAmount?: number | XoAmount;
  toAmount?: number | XoAmount;
  fromTransactionId?: string;
  toTransactionId?: string;
  [key: string]: unknown;
};

export type XoCreateOrderInput = {
  pairId: string;
  fromAmount: number;
  fromAddress: string;
  toAddress: string;
  toAmount: number;
};
