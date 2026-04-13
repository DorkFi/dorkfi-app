import React, { useMemo, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import { formatHealthFactorBuffer } from "@/utils/healthFactorUx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Edit, HelpCircle } from "lucide-react";

type Props = {
  healthFactor: number | null;
  /** e.g. "Algorand · Market A" */
  marketContextLine?: string | null;
  avatarSrc?: string;
  onEdit?: () => void;
};

/** Map HF to water fill height % (matches gauge scale). */
function mapHfToGaugeHeightPct(thresholdHf: number): number {
  if (thresholdHf <= 0.8) {
    const t = (thresholdHf - 0.1) / (0.8 - 0.1);
    return Math.round(5 + t * 5);
  }
  const t = (thresholdHf - 0.8) / (3.0 - 0.8);
  return Math.round(10 + t * 82);
}

export default function HealthWaterGauge({
  healthFactor,
  marketContextLine,
  avatarSrc,
  onEdit,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate health factor value (use 0 as default for null to avoid hook order issues)
  const hf = healthFactor === null ? 0 : Math.max(0.1, Math.min(3.0, healthFactor));
  
  // ALWAYS call ALL hooks before any conditional returns
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

  /** Single protocol line: liquidation at HF = 1.0 (no per-asset priority in UI). */
  const thresholds = useMemo(() => {
    const hf = 1.0;
    const position = mapHfToGaugeHeightPct(hf);
    return [{ hf, label: "Liquidation (HF = 1.0)", color: "bg-red-500/70", position }];
  }, []);
  
  // Handle null health factor (no collateral) - AFTER all hooks are called
  if (healthFactor === null) {
    return (
      <div className="relative w-full max-w-sm mx-auto">
        <div className="text-center py-8 px-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
          <div className="text-sm text-muted-foreground mb-1 font-medium">Health Factor</div>
          {marketContextLine ? (
            <p className="text-xs font-medium text-ocean-teal dark:text-cyan-400 mb-2">
              {marketContextLine}
            </p>
          ) : null}
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

  return (
    <TooltipProvider>
      <div className="w-full space-y-4 animate-fade-in">
        {/* Header with prominent risk display */}
        <div className="space-y-1">
          <CardTitle className="text-2xl">Health Factor</CardTitle>
          {marketContextLine ? (
            <p className="text-sm font-medium text-ocean-teal dark:text-cyan-400">
              {marketContextLine}
            </p>
          ) : null}
        </div>

      {/* Water gauge with threshold markers */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="relative h-72 w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#0e1f29] to-[#061218] border-2 border-white/10 shadow-xl cursor-help hover:border-white/20 transition-all duration-300"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
          {/* Optional avatar below the mask */}
          {avatarSrc && (
            <img
              src={avatarSrc}
              alt="avatar"
              className="absolute inset-0 w-full h-full object-cover opacity-95 z-0"
              loading="eager"
              decoding="sync"
              onError={(e) => {
                console.error("Failed to load avatar image:", avatarSrc);
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              onLoad={() => {
                console.log("Avatar image loaded successfully:", avatarSrc);
              }}
            />
          )}

          {/* Base placeholder image - only show if no avatar or as a fallback */}
          {!avatarSrc && (
            <img
              src="/lovable-uploads/dork_health_placeholder_v2.png"
              alt="Health placeholder"
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )}

          {/* Question mark icon in top corner - only show when using placeholder image */}
          {onEdit && !avatarSrc && (
            <div className="absolute top-2 right-2 z-40">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-lg hover:shadow-xl transition-all duration-200 ring-2 ring-ocean-teal/50 ring-offset-2 ring-offset-transparent"
                    aria-label="Edit profile image"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                  <p className="text-sm">
                    Click to customize your profile image
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Hover overlay with edit button */}
          {onEdit && isHovered && (
            <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center transition-opacity duration-300">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex items-center gap-2 bg-white text-black hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>
          )}

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
            <p className="font-medium mb-2">Health factor gauge</p>
            <p className="text-sm">Water height reflects your health factor. The red line is liquidation (HF = 1.0).</p>
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
        <div className={`mt-2 text-sm font-medium ${riskLevel.color}`}>
          {formatHealthFactorBuffer(healthFactor)}
        </div>
        {hf <= 1.2 && hf > 1 && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            Limited room before HF reaches 1.0
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
