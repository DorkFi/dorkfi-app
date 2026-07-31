import algosdk from "algosdk";

/** nt200 / ARC200 user balance box name: `0x00 || publicKey` (33 bytes). */
export function nt200UserBalanceBoxName(userAddress: string): Uint8Array {
  const key = new Uint8Array(33);
  key[0] = 0;
  key.set(algosdk.decodeAddress(userAddress).publicKey, 1);
  return key;
}

/**
 * Returns true when the user's nt200 balance box already exists on `appId`.
 * Used to avoid submitting `createBalanceBox` when the box is present
 * (on-chain assert: `intc_0 // 0; ==; assert`).
 */
export async function nt200UserBalanceBoxExists(
  algod: { getApplicationBoxByName: (appId: number, name: Uint8Array) => { do: () => Promise<unknown> } },
  appId: number,
  userAddress: string
): Promise<boolean> {
  if (!Number.isFinite(appId) || appId <= 0) return false;
  try {
    await algod
      .getApplicationBoxByName(appId, nt200UserBalanceBoxName(userAddress))
      .do();
    return true;
  } catch (error: unknown) {
    const status =
      (error as { status?: number; response?: { status?: number } })?.status ??
      (error as { response?: { status?: number } })?.response?.status;
    const message = error instanceof Error ? error.message : String(error);
    if (
      status === 404 ||
      /box not found|not found/i.test(message)
    ) {
      return false;
    }
    // On unexpected RPC errors, assume unknown — caller should still try safe combos.
    console.warn("nt200UserBalanceBoxExists: unexpected error", {
      appId,
      userAddress,
      error,
    });
    return false;
  }
}

/** Matches createBalanceBox "box must not exist" TEAL assert. */
export function isNt200CreateBalanceBoxAlreadyExistsError(
  error: unknown
): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (!/logic eval error:\s*assert failed/i.test(msg)) return false;
  // createBalanceBox: box_get exists-flag compared to 0
  return /opcodes=intc_0\s*\/\/\s*0;\s*==;\s*assert/i.test(msg);
}
