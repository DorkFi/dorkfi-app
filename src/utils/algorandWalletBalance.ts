/**
 * MicroAlgos spendable above the account's protocol min-balance.
 * Algod may return `amount` / `minBalance` as bigint (SDK v3); normalize before math.
 *
 * Does **not** reserve an extra ALGO for fees — that hid real balances in UI (e.g. ~4 ALGO → 0).
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

/** Whole ALGO (human) spendable above min-balance. */
export function spendableAlgoHumanFromAccount(accountInfo: {
  amount?: unknown;
  minBalance?: unknown;
  "min-balance"?: unknown;
}): number {
  const spendMicro = spendableAlgoMicroAlgosFromAccount(accountInfo);
  return Number(spendMicro) / 1e6;
}
