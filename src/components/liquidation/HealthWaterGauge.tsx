import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  healthFactor: number | null;
  avatarSrc?: string;
};

export default function HealthWaterGauge({ healthFactor, avatarSrc }: Props) {
  // Handle null health factor (no collateral)
  if (healthFactor === null) {
    return (
      <div className="relative w-full max-w-sm mx-auto">
        <div className="text-center py-8 px-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
          <div className="text-sm text-muted-foreground mb-1 font-medium">Health Factor</div>
          <div className="text-5xl font-bold text-gray-500 tracking-tight transition-all duration-300 mb-2">
            N/A
          </div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            No Collateral
          </div>
          <div className="mt-2 text-xs text-gray-400 font-medium">
            💡 Add assets to start earning and borrowing
          </div>
        </div>
      </div>
    );
  }

  // Allow health factor to go below 0.8 to show critical states accurately
  const hf = Math.max(0.1, Math.min(3.0, healthFactor));
  const riskLevel = useRiskLevel(hf);

  // Map HF -> water height (lower HF = less water = higher risk)
  // 0.1 -> 5%, 0.8 -> 10%, 1.2 -> ~25%, 3.0 -> 92%
  const waterPct = useMemo(() => {
    if (hf <= 0.8) {
      // Linear mapping from 0.1 to 0.8 -> 5% to 10%
      const t = (hf - 0.1) / (0.8 - 0.1);
      return Math.round(5 + t * 5);
    } else {
      // Original mapping from 0.8 to 3.0 -> 10% to 92%
      const t = (hf - 0.8) / (3.0 - 0.8);
      return Math.round(10 + t * 82);
    }
  }, [hf]);

  // Threshold markers for risk levels
  const thresholds = useMemo(() => [
    { hf: 0.5, label: "Liquidatable", color: "bg-red-600/80", position: 8 },
    { hf: 1.0, label: "Critical", color: "bg-red-500/60", position: 15 },
    { hf: 1.2, label: "Caution", color: "bg-orange-500/60", position: 37 },
    { hf: 1.5, label: "Moderate", color: "bg-yellow-500/60", position: 59 },
    { hf: 3.0, label: "Safe", color: "bg-green-500/60", position: 81 },
  ], []);

  const getThresholdPosition = (thresholdHf: number) => {
    if (thresholdHf <= 0.8) {
      // Linear mapping from 0.1 to 0.8 -> 5% to 10%
      const t = (thresholdHf - 0.1) / (0.8 - 0.1);
      return Math.round(5 + t * 5);
    } else {
      // Original mapping from 0.8 to 3.0 -> 10% to 92%
      const t = (thresholdHf - 0.8) / (3.0 - 0.8);
      return Math.round(10 + t * 82);
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full space-y-4 animate-fade-in">
        {/* Header with prominent risk display */}
        <CardTitle className="text-2xl">Health Factor</CardTitle>
        
      {/* Water gauge with threshold markers */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative h-72 w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#0e1f29] to-[#061218] border-2 border-white/10 shadow-xl cursor-help hover:border-white/20 transition-all duration-300">
          {/* Optional avatar below the mask */}
          {avatarSrc && (
            <img
              src={avatarSrc}
              alt="avatar"
              className="absolute inset-0 w-full h-full object-cover opacity-95"
            />
          )}

          {/* Base placeholder image */}
          <img
            src="/lovable-uploads/dork_health_placeholder_v2.png"
            alt="Health placeholder"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* WATER OVERLAY — masked to the placeholder silhouette */}
          <div
            className="absolute inset-x-0 bottom-0 transition-all duration-500 ease-out"
            style={{ height: `${waterPct}%` }}
          >
            <div
              className="relative w-full h-full opacity-95"
              style={{
                backgroundImage: "url('/lovable-uploads/underwater_full.png')",
                backgroundSize: "cover",
                backgroundPosition: "top",
                WebkitMaskImage: "url('/lovable-uploads/dork_health_placeholder_v2.png')",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskSize: "cover",
                maskImage: "url('/lovable-uploads/dork_health_placeholder_v2.png')",
                maskRepeat: "no-repeat",
                maskSize: "cover",
                animation: "hf-drift 8s linear infinite",
              }}
            />
            {/* Subtle brand tint over water */}
            <div className="pointer-events-none absolute inset-0 bg-ocean-teal/25" />
          </div>

          {/* Surface line with glow */}
          <div
            className="absolute left-0 right-0 h-[3px] bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-500 z-10"
            style={{ bottom: `${waterPct}%` }}
            aria-hidden
          />

          {/* Risk threshold markers */}
          {thresholds.map((threshold, idx) => {
            return (
              <div
                key={idx}
                className="absolute left-0 right-0 flex items-center z-20 transition-all duration-500"
                style={{ bottom: `${threshold.position}%` }}
              >
                <div className={`h-[2px] w-8 ${threshold.color}`} />
                <span className="text-[10px] text-white/70 ml-2 font-medium whitespace-nowrap">
                  ({threshold.hf}) {threshold.label}
                </span>
              </div>
            );
          })}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] sm:max-w-xs" sideOffset={5}>
            <p className="font-medium mb-2">Interactive Risk Gauge</p>
            <p className="text-sm">The water level represents your liquidation risk. Lower water means closer to liquidation.</p>
            <p className="mt-2 text-xs text-muted-foreground">Threshold markers show critical risk levels.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Enhanced Risk Score Display */}
      <div className="text-center py-4 px-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/50 dark:border-slate-700/50 animate-scale-in">
        <div className="text-sm text-muted-foreground mb-1 font-medium">Health Factor</div>
        <div className={`text-5xl font-bold ${riskLevel.color} tracking-tight transition-all duration-300 mb-2`}>
          {hf.toFixed(2)}
        </div>
        <div className={`text-sm font-semibold ${riskLevel.color} uppercase tracking-wide`}>
          {riskLevel.label}
        </div>
        {hf <= 1.2 && (
          <div className="mt-2 text-xs text-red-500 font-medium animate-pulse">
            ⚠️ Monitor Position Closely
          </div>
        )}
      </div>

      <style>{`
        @keyframes hf-drift {
          from { background-position-x: 0; }
          to   { background-position-x: -50%; }
        }
      `}</style>
      </div>
    </TooltipProvider>
  );
}
