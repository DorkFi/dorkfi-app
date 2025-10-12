/**
 * Borrow APY Display Component
 * 
 * This component displays Borrow APY with tooltips showing the calculation breakdown
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { APYCalculationResult, formatAPY, getAPYColorClass } from '@/utils/apyCalculations';

interface BorrowAPYDisplayProps {
  apyCalculation?: APYCalculationResult;
  fallbackAPY?: number;
  showTooltip?: boolean;
  className?: string;
}

export const BorrowAPYDisplay: React.FC<BorrowAPYDisplayProps> = ({
  apyCalculation,
  fallbackAPY = 0,
  showTooltip = true,
  className = ''
}) => {
  // Use the fallbackAPY which should contain the proper borrow APY calculation
  // The apyCalculation.borrowRate is just the raw rate, not the APY
  const borrowAPY = fallbackAPY;
  const formattedAPY = formatAPY(borrowAPY);
  const colorClass = getAPYColorClass(borrowAPY);

  if (!showTooltip || !apyCalculation) {
    return (
      <span className={`font-medium ${colorClass} ${className}`}>
        {formattedAPY}
      </span>
    );
  }

  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-white mb-2">Borrow APY Calculation Breakdown</div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-300">Utilization Rate:</span>
          <span className="text-white font-mono">
            {(apyCalculation.utilizationRate * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-300">Base Borrow Rate:</span>
          <span className="text-white font-mono">
            {(apyCalculation.borrowRate * 100).toFixed(2)}%
          </span>
        </div>
        
        <div className="border-t border-gray-600 pt-1 mt-2">
          <div className="flex justify-between font-semibold">
            <span className="text-white">Borrow APY:</span>
            <span className="text-red-400 font-mono">{formattedAPY}</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 mt-2">
        Borrow APY = (1 + Borrow Rate)^365 - 1
      </div>
      
      <div className="text-xs text-gray-400">
        Compound interest calculation for annual yield
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

export default BorrowAPYDisplay;
