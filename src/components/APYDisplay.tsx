/**
 * APY Display Component
 * 
 * This component displays APY with tooltips showing the calculation breakdown
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { APYCalculationResult, formatAPY, getAPYColorClass } from '@/utils/apyCalculations';

interface APYDisplayProps {
  apyCalculation?: APYCalculationResult;
  fallbackAPY?: number;
  showTooltip?: boolean;
  className?: string;
}

export const APYDisplay: React.FC<APYDisplayProps> = ({
  apyCalculation,
  fallbackAPY = 0,
  showTooltip = true,
  className = ''
}) => {
  const apy = apyCalculation?.apy ?? fallbackAPY;
  const formattedAPY = formatAPY(apy);
  const colorClass = getAPYColorClass(apy);

  if (!showTooltip || !apyCalculation) {
    return (
      <span className={`font-medium ${colorClass} ${className}`}>
        {formattedAPY}
      </span>
    );
  }

  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-white mb-2">APY Calculation Breakdown</div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-300">Utilization Rate:</span>
          <span className="text-white font-mono">
            {(apyCalculation.utilizationRate * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-300">Borrow Rate:</span>
          <span className="text-white font-mono">
            {(apyCalculation.borrowRate * 100).toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-300">Supply Rate:</span>
          <span className="text-white font-mono">
            {(apyCalculation.supplyRate * 100).toFixed(4)}%
          </span>
        </div>
        
        <div className="border-t border-gray-600 pt-1 mt-2">
          <div className="flex justify-between font-semibold">
            <span className="text-white">Final APY:</span>
            <span className="text-green-400 font-mono">{formattedAPY}</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 mt-2">
        APY = (1 + daily_supply_rate)^365 - 1
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <span className={`font-medium ${colorClass} ${className}`}>
              {formattedAPY}
            </span>
            <Info className="h-3 w-3 text-gray-400 hover:text-gray-600" />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-gray-900 border-gray-700 text-white p-3"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default APYDisplay;
