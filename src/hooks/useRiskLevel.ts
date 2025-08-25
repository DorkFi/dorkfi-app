
import { useMemo } from 'react';

interface RiskLevel {
  label: string;
  color: string;
  bg: string;
}

export const useRiskLevel = (healthFactor: number) => {
  return useMemo(() => {
    if (healthFactor > 2) return { label: "Low Risk", color: "text-green-500", bg: "bg-green-500/20" };
    if (healthFactor > 1.2) return { label: "Moderate", color: "text-yellow-500", bg: "bg-yellow-500/20" };
    if (healthFactor > 1) return { label: "High Risk", color: "text-orange-500", bg: "bg-orange-500/20" };
    return { label: "Critical!", color: "text-destructive", bg: "bg-destructive/20" };
  }, [healthFactor]);
};

export const getDepthTransform = (healthFactor: number): string => {
  if (healthFactor > 2) return "translateY(40px)";   // Bottom - safest
  if (healthFactor > 1.2) return "translateY(20px)"; // Mid-low
  if (healthFactor > 1) return "translateY(0px)";    // Mid-high
  return "translateY(-20px)";                        // Top - most dangerous
};

export const getRiskIndicatorPosition = (healthFactor: number): string => {
  if (healthFactor > 2) return '80%';      // Bottom (safe)
  if (healthFactor > 1.2) return '60%';    // Mid-low
  if (healthFactor > 1) return '40%';      // Mid-high  
  return '20%';                            // Top (critical)
};
