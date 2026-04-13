/**
 * Unified health factor UX: single user-facing risk metric (min HF).
 * Liquidation occurs at HF = 1.0; color bands are for awareness only.
 */

export const HF_LIQUIDATION = 1.0;
export const HF_WARNING_MAX = 1.2;
export const HF_AT_RISK_MAX = 1.05;

export type HealthFactorBand = "none" | "safe" | "warning" | "at_risk" | "blocked";

export function getHealthFactorBand(healthFactor: number | null): HealthFactorBand {
  if (healthFactor === null || !Number.isFinite(healthFactor)) return "none";
  if (healthFactor <= HF_LIQUIDATION) return "blocked";
  if (healthFactor <= HF_AT_RISK_MAX) return "at_risk";
  if (healthFactor <= HF_WARNING_MAX) return "warning";
  return "safe";
}

/** Tailwind text color class for prominent HF values */
export function getHealthFactorTextColorClass(healthFactor: number | null): string {
  const band = getHealthFactorBand(healthFactor);
  switch (band) {
    case "none":
      return "text-muted-foreground";
    case "blocked":
    case "at_risk":
      return "text-destructive";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "safe":
    default:
      return "text-green-600 dark:text-green-400";
  }
}

/** Short status label under the numeric HF */
export function getHealthFactorStatusLabel(healthFactor: number | null): string {
  const band = getHealthFactorBand(healthFactor);
  switch (band) {
    case "none":
      return "—";
    case "blocked":
      return "Actions blocked";
    case "at_risk":
      return "At risk";
    case "warning":
      return "Warning";
    case "safe":
    default:
      return "Safe";
  }
}

/**
 * Distance from liquidation at HF = 1.0.
 * For HF > 1: "+N% buffer" where N = (HF - 1) * 100.
 * For HF <= 1: liquidation line copy.
 */
export function formatHealthFactorBuffer(healthFactor: number | null): string {
  if (healthFactor === null || !Number.isFinite(healthFactor)) {
    return "—";
  }
  if (healthFactor > HF_LIQUIDATION) {
    const pct = (healthFactor - HF_LIQUIDATION) * 100;
    const rounded = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
    return `+${rounded}% buffer`;
  }
  return "Liquidation at HF = 1.0";
}
