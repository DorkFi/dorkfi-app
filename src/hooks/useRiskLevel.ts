import { useMemo } from "react";
import {
  getHealthFactorBand,
  getHealthFactorStatusLabel,
  getHealthFactorTextColorClass,
  type HealthFactorBand,
} from "@/utils/healthFactorUx";

export interface RiskLevel {
  label: string;
  color: string;
  bg: string;
  band: HealthFactorBand;
}

export const useRiskLevel = (healthFactor: number): RiskLevel => {
  return useMemo(() => {
    const band = getHealthFactorBand(healthFactor);
    const label = getHealthFactorStatusLabel(healthFactor);
    const color = getHealthFactorTextColorClass(healthFactor);
    const bg =
      band === "safe"
        ? "bg-green-500/20"
        : band === "warning"
          ? "bg-amber-500/20"
          : band === "at_risk" || band === "blocked"
            ? "bg-destructive/20"
            : "bg-muted/20";
    return { label, color, bg, band };
  }, [healthFactor]);
};

export const getDepthTransform = (healthFactor: number): string => {
  if (healthFactor > 2) return "translateY(40px)"; // Bottom - safest
  if (healthFactor > 1.2) return "translateY(20px)"; // Mid-low
  if (healthFactor > 1) return "translateY(0px)"; // Mid-high
  return "translateY(-20px)"; // Top - most dangerous
};

export const getRiskIndicatorPosition = (healthFactor: number): string => {
  if (healthFactor > 2) return "80%"; // Bottom (safe)
  if (healthFactor > 1.2) return "60%"; // Mid-low
  if (healthFactor > 1) return "40%"; // Mid-high
  return "20%"; // Top (critical)
};
