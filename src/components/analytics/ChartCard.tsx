import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  controls?: React.ReactNode;
  tooltip?: string;
}

const ChartCard = ({ title, subtitle, children, className = '', controls, tooltip }: ChartCardProps) => {
  const CardContent = (
    <div className={`dorkfi-card-bg rounded-xl border border-border/40 p-4 sm:p-6 card-hover ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
        <div>
          <h3 className="dorkfi-h3 text-base sm:text-lg">{title}</h3>
          {subtitle && <p className="dorkfi-caption mt-1 text-xs sm:text-sm">{subtitle}</p>}
        </div>
        {controls && (
          <div className="flex items-center gap-2">
            {controls}
          </div>
        )}
      </div>
      
      <div className={className.includes('h-auto') ? 'h-auto overflow-visible' : 'h-[280px] sm:h-[320px] overflow-visible'}>
        {children}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {CardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return CardContent;
};

export default ChartCard;

