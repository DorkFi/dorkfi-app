import React from 'react';

interface UtilizationRatePanelProps {
  utilization: number;
}

export const UtilizationRatePanel: React.FC<UtilizationRatePanelProps> = ({ utilization }) => (
  <div className="p-0 rounded-lg mb-0 min-w-0 w-full max-w-full overflow-x-hidden">
    <div className="flex justify-between items-center mb-1">
      <span className="font-semibold text-foreground">Utilization rate</span>
      <span className="font-bold text-ocean-teal text-lg">
        {utilization?.toFixed(1) ?? 0}%
      </span>
    </div>
    <div className="relative h-3 w-full rounded-full bg-muted mb-2 overflow-hidden">
      <div
        className="absolute left-0 top-0 h-3 rounded-full bg-ocean-teal/90 transition-all"
        style={{ width: `${Math.min(100, utilization ?? 0)}%` }}
      />
    </div>
    <div className="flex flex-row flex-wrap justify-between items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
      <span className="shrink-0">0%</span>
      <span className="text-whale-gold font-semibold text-center min-w-0">Optimal: 80%</span>
      <span className="shrink-0">100%</span>
    </div>
  </div>
);
