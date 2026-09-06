/**
 * nt200 createBalanceBox helpers.
 *
 * Box presence is detected by simulating `createBalanceBox` (ulujs CONTRACT +
 * abi.nt200), not by constructing box names or calling getApplicationBoxByName.
 */

/** Matches createBalanceBox "box must not exist" TEAL assert or explicit text. */
export function isNt200CreateBalanceBoxAlreadyExistsError(
  error: unknown
): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase();
  if (
    lower.includes("box already exist") ||
    lower.includes("err box exist") ||
    lower.includes("box exists")
  ) {
    return true;
  }
  if (!/logic eval error:\s*assert failed/i.test(msg)) return false;
  // createBalanceBox: box_get exists-flag compared to 0
  return /opcodes=intc_0\s*\/\/\s*0;\s*==;\s*assert/i.test(msg);
}

/**
 * Map a standalone createBalanceBox simulate result to box status.
 * success → missing (create would work);
 * already-exists assert → present;
 * else → unknown.
 */
export function classifyNt200CreateBalanceBoxSimulateResult(result: {
  success?: boolean;
  error?: unknown;
}): "present" | "missing" | "unknown" {
  if (result?.success === true) return "missing";
  if (isNt200CreateBalanceBoxAlreadyExistsError(result?.error)) {
    return "present";
  }
  return "unknown";
}
