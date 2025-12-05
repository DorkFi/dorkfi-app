import React from 'react';

interface UtilizationRatePanelProps {
  utilization: number; // percent, e.g. 40 for 40%
}

export const UtilizationRatePanel: React.FC<UtilizationRatePanelProps> = ({ utilization }) => (
  <div className="p-4 bg-[#111b32] rounded-lg mb-4">
    <div className="flex justify-between items-center mb-1">
      <span className="font-semibold text-white">Utilization Rate</span>
      <span className="font-bold text-green-400 text-lg">
        {utilization?.toFixed(1) ?? 0}%
      </span>
    </div>
    <div className="relative h-3 w-full rounded-full bg-[#222c3f] mb-2 overflow-hidden">
      <div
        className="absolute left-0 top-0 h-3 rounded-full bg-green-400 transition-all"
        style={{ width: `${utilization ?? 0}%` }}
      ></div>
    </div>
    <div className="flex flex-row justify-between items-center text-xs">
      <span className="text-white/70">0%</span>
      <span className="text-yellow-400 font-semibold">Optimal: 80%</span>
      <span className="text-white/70">100%</span>
    </div>
  </div>
);

