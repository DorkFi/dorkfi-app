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
