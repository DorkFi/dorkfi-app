
import React from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Clock, Calendar } from 'lucide-react';

type TimeRange = '1h' | '24h' | '7d';

interface ChartControlsProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

const ChartControls = ({ timeRange, setTimeRange, isLoading, onRefresh }: ChartControlsProps) => {
  const timeRanges = [
    { 
      label: '1H', 
      value: '1h' as const, 
      icon: Clock,
      tooltip: 'Last 1 hour - Short-term price movements with 1-minute intervals'
    },
    { 
      label: '24H', 
      value: '24h' as const, 
      icon: Calendar,
      tooltip: 'Last 24 hours - Daily price trends with 1-hour intervals'
    },
    { 
      label: '7D', 
      value: '7d' as const, 
      icon: Calendar,
      tooltip: 'Last 7 days - Weekly price patterns with daily intervals'
    },
  ];

  return (
    <div className="lg:absolute lg:top-4 lg:right-4 z-10 flex flex-col gap-2 w-full lg:w-auto">
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <ToggleGroup 
          type="single" 
          value={timeRange} 
          onValueChange={(value) => value && setTimeRange(value as TimeRange)}
          className="bg-white/50 dark:bg-slate-800/50 p-1 rounded-lg border border-gray-300/50 dark:border-ocean-teal/20 flex-shrink-0"
        >
          {timeRanges.map((range) => (
            <Tooltip key={range.value}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={range.value}
                  className={`
                    relative px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all duration-200 font-medium
                    text-xs sm:text-sm flex items-center gap-1 sm:gap-2 min-w-[48px] sm:min-w-[60px] justify-center
                    data-[state=on]:bg-ocean-teal data-[state=on]:text-white 
                    data-[state=on]:font-bold data-[state=on]:shadow-lg
                    data-[state=off]:text-slate-600 data-[state=off]:hover:text-slate-800
                    data-[state=off]:dark:text-slate-300 data-[state=off]:dark:hover:text-white
                    data-[state=off]:hover:bg-gray-200/50 data-[state=off]:dark:hover:bg-ocean-teal/20
                    border-0 h-auto
                  `}
                >
                  <range.icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{range.label}</span>
                  <span className="sm:hidden">{range.label.replace('H', 'h').replace('D', 'd')}</span>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent 
                side="bottom" 
                className="max-w-xs text-center bg-popover border-ocean-teal/20"
              >
                <p className="text-sm">{range.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="hover:bg-gray-200/50 dark:hover:bg-ocean-teal/20 border border-gray-300/50 dark:border-ocean-teal/20 rounded-md flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-sm">Refresh chart data</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default ChartControls;
