/**
 * Normalize anything address-like (string, algosdk.Address, foreign Address
 * from a second algosdk copy) to a 58-char Algorand address string.
 * Dual algosdk copies fail `instanceof Address` and throw `Not an address`.
 *
 * Does not import `algosdk` — the Vite algosdk wrapper imports this file.
 */
const ALGO_ADDRESS_RE = /^[A-Z2-7]{58}$/;

export function asAlgorandAddressString(address: unknown): string | undefined {
  if (address == null) return undefined;
  let value: string | undefined;
  if (typeof address === "string") {
    value = address.trim();
  } else if (
    typeof address === "object" &&
    typeof (address as { toString?: () => string }).toString === "function"
  ) {
    const s = (address as { toString: () => string }).toString().trim();
    if (s && s !== "[object Object]") value = s;
  }
  if (!value || !ALGO_ADDRESS_RE.test(value)) return undefined;
  return value;
}

export function requireAlgorandAddressString(
  address: unknown,
  label = "address"
): string {
  const value = asAlgorandAddressString(address);
  if (!value) {
    throw new Error(`Not a valid Algorand ${label}`);
  }
  return value;
}

const ADDRESS_KEYS = [
  "sender",
  "from",
  "receiver",
  "closeRemainderTo",
  "reKeyTo",
  "rekeyTo",
  "freezeTarget",
  "assetRevocationTarget",
  "manager",
  "reserve",
  "freeze",
  "clawback",
] as const;

/**
 * Coerce address fields on make*TxnFromObject option bags to plain strings
 * so a foreign algosdk `Address` still builds.
 */
export function coerceTxnAddressFields<T extends Record<string, unknown>>(
  opts: T
): T {
  const next: Record<string, unknown> = { ...opts };
  for (const key of ADDRESS_KEYS) {
    if (key in next && next[key] != null) {
      const coerced = asAlgorandAddressString(next[key]);
      if (coerced) next[key] = coerced;
    }
  }
  if (Array.isArray(next.accounts)) {
    next.accounts = next.accounts.map((item) => {
      const coerced = asAlgorandAddressString(item);
      return coerced ?? item;
    });
  }
  return next as T;
}
