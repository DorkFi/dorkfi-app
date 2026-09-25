/**
 * MicroAlgos spendable above protocol min-balance.
 * Keep in sync with src/utils/algorandWalletBalance.ts.
 */
export function spendableAlgoMicroAlgosFromAccount(accountInfo: {
  amount?: unknown;
  minBalance?: unknown;
  "min-balance"?: unknown;
}): bigint {
  const toMicro = (v: unknown): bigint => {
    if (typeof v === "bigint") return v;
    if (typeof v === "number" && Number.isFinite(v)) {
      return BigInt(Math.trunc(v));
    }
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "" && /^-?\d+$/.test(t)) return BigInt(t);
    }
    return 0n;
  };

  const amountMicro = toMicro(accountInfo.amount);
  const minMicro = toMicro(
    accountInfo.minBalance ?? accountInfo["min-balance"]
  );
  return amountMicro > minMicro ? amountMicro - minMicro : 0n;
}

/** Minimum network fee reserved before a sponsor payment. */
export const SPONSOR_ALGO_TXN_FEE_MICRO = 1_000n;

function asMicro(value: unknown): bigint {
  if (typeof value === "bigint") return value > 0n ? value : 0n;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = BigInt(value.trim());
    return n > 0n ? n : 0n;
  }
  return 0n;
}

/** Fee to reserve from suggested params. A zero fee means "let the SDK set min fee". */
export function sponsorPaymentFeeMicro(suggestedParams: {
  minFee?: unknown;
  fee?: unknown;
}): bigint {
  const minFee = asMicro(suggestedParams.minFee);
  const fee = asMicro(suggestedParams.fee);
  const picked = minFee > fee ? minFee : fee;
  return picked > 0n ? picked : SPONSOR_ALGO_TXN_FEE_MICRO;
}

/**
 * Returns an error when the sponsor account cannot cover the payment plus fee
 * above its own min-balance. `null` means the treasury can pay.
 */
export function sponsorTreasuryShortfall(args: {
  spendableMicro: bigint;
  amountMicro: bigint;
  feeMicro?: bigint;
}): string | null {
  const fee = args.feeMicro ?? SPONSOR_ALGO_TXN_FEE_MICRO;
  const need = args.amountMicro + fee;
  if (args.spendableMicro >= need) return null;
  return `Sponsor ALGO treasury is short. Need ${need} microALGO spendable, have ${args.spendableMicro}.`;
}

/** Keep algod / treasury text for logs. Drop empty or huge messages. */
export function sponsorSendErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}
