/** Default liquidation threshold when market data is missing (decimal 0–1). */
export const DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL = 0.85;

/**
 * Opt-in only (avoids spam on every Portfolio render in dev).
 * Set `VITE_DEBUG_USER_HEALTH=true` or `1` in `.env.local` / environment.
 */
export function isUserHealthDebugEnabled(): boolean {
  const env = import.meta.env;
  if (!env) return false;
  const flag = env.VITE_DEBUG_USER_HEALTH;
  return flag === "true" || flag === "1";
}

function debugUserHealth(
  context: string | undefined,
  message: string,
  data: Record<string, unknown>
): void {
  if (!isUserHealthDebugEnabled()) return;
  const prefix = context ? `[userHealth:${context}]` : "[userHealth]";
  console.debug(prefix, message, data);
}

/**
 * On-chain / contract user health uses fixed-point where **10_000 represents 1.0** (human health factor).
 * Example: native `5000` → `0.5`, native `10000` → `1.0` (liquidation boundary in that convention).
 */
export const USER_HEALTH_FIXED_POINT_SCALE = 10_000;

/** Convert contract-native health (integer) to decimal health (divide by scale). */
export function healthNativeToDecimal(native: number | bigint): number {
  const n = typeof native === "bigint" ? Number(native) : native;
  return n / USER_HEALTH_FIXED_POINT_SCALE;
}

/** Convert decimal health to contract-native units (multiply by scale). */
export function healthDecimalToNative(decimal: number): number {
  return decimal * USER_HEALTH_FIXED_POINT_SCALE;
}

/**
 * Normalize liquidation threshold from API/chain (decimal, percent, or basis points) to 0–1.
 */
export function normalizeLiquidationThresholdToDecimal(
  threshold: unknown,
  fallback: number = DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL
): number {
  if (threshold === undefined || threshold === null) return fallback;
  let n: number;
  if (typeof threshold === "bigint") n = Number(threshold);
  else if (typeof threshold === "string") n = parseFloat(threshold);
  else if (typeof threshold === "number") n = threshold;
  else return fallback;
  if (!Number.isFinite(n)) return fallback;
  if (n > 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  if (n <= 10000) return n / 10000;
  return fallback;
}

/**
 * User health in **decimal** units (1.0 = healthy boundary in UI terms), same ratio as
 * `_calculate_user_health(total_collateral_value, total_borrow_value, liquidation_threshold)` on-chain
 * after normalizing by {@link USER_HEALTH_FIXED_POINT_SCALE}: **native 10_000 == 1.0** here.
 *
 * Formula: (collateral × liquidation_threshold) / borrow
 *
 * To compare with raw contract integers, use {@link healthNativeToDecimal}.
 *
 * Pass `debugContext` (e.g. `"portfolio"`) when {@link isUserHealthDebugEnabled} is on to label logs.
 */
export function calculateUserHealthFactor(
  collateral: number,
  borrowed: number,
  liquidationThresholdDecimal: number,
  debugContext?: string
): number | null {
  if (
    (!collateral || collateral <= 0) &&
    (!borrowed || borrowed <= 0)
  ) {
    debugUserHealth(debugContext, "no position (both collateral and borrow empty or invalid)", {
      collateral,
      borrowed,
      liquidationThresholdInput: liquidationThresholdDecimal,
      scaleNote: `contract-native 1.0 == ${USER_HEALTH_FIXED_POINT_SCALE}`,
    });
    return null;
  }

  if (borrowed > 0 && collateral > 0) {
    const lt = normalizeLiquidationThresholdToDecimal(
      liquidationThresholdDecimal,
      DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL
    );
    const calculated = (collateral * lt) / borrowed;
    if (calculated <= 0 || !isFinite(calculated)) {
      debugUserHealth(debugContext, "invalid ratio", {
        collateral,
        borrowed,
        liquidationThresholdInput: liquidationThresholdDecimal,
        liquidationThresholdDecimal: lt,
        calculated,
      });
      return null;
    }
    const nativeApprox = healthDecimalToNative(calculated);
    debugUserHealth(debugContext, "calculated", {
      collateral,
      borrowed,
      liquidationThresholdInput: liquidationThresholdDecimal,
      liquidationThresholdDecimal: lt,
      healthDecimal: calculated,
      healthNativeApprox: Math.round(nativeApprox),
      formula: `(${collateral} × ${lt}) / ${borrowed}`,
      scaleNote: `decimal ${calculated.toFixed(6)} ≈ native ${Math.round(nativeApprox)} (1.0 == ${USER_HEALTH_FIXED_POINT_SCALE})`,
    });
    return calculated;
  }

  if (collateral > 0 && (!borrowed || borrowed <= 0)) {
    debugUserHealth(debugContext, "no borrow — excellent health sentinel", {
      collateral,
      borrowed,
      healthDecimal: 10.0,
      liquidationThresholdInput: liquidationThresholdDecimal,
    });
    return 10.0;
  }

  debugUserHealth(debugContext, "fallback null", {
    collateral,
    borrowed,
    liquidationThresholdInput: liquidationThresholdDecimal,
  });
  return null;
}
