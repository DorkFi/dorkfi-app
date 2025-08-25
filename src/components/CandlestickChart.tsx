import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCandlestickChart } from '@/hooks/useCandlestickChart';
import TokenPairSelector from '@/components/TokenPairSelector';
import ChartControls from '@/components/CandlestickChart/ChartControls';
import PriceDisplay from '@/components/CandlestickChart/PriceDisplay';
import ChartContent from '@/components/CandlestickChart/ChartContent';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TokenPair {
  from: string;
  to: string;
  label: string;
  popular?: boolean;
}

interface CandlestickChartProps {
  fromToken: string | null;
  toToken: string | null;
  onPriceClick?: (price: number) => void;
}

const CandlestickChart = ({ fromToken, toToken, onPriceClick }: CandlestickChartProps) => {
  const [selectedPair, setSelectedPair] = useState<TokenPair | null>(null);

  // Initialize or update selected pair based on props
  useEffect(() => {
    if (fromToken && toToken) {
      const newPair: TokenPair = {
        from: fromToken,
        to: toToken,
        label: `${fromToken}/${toToken}`
      };
      setSelectedPair(newPair);
    }
  }, [fromToken, toToken]);

  const { data, isLoading, error, timeRange, setTimeRange, retry } = useCandlestickChart({
    tokenPair: selectedPair
  });

  const formatPrice = (price: number) => {
    if (price < 0.001) return price.toExponential(3);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const handleCandleClick = (price: number) => {
    if (onPriceClick) {
      onPriceClick(price);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-blue-900 rounded-lg overflow-hidden relative">
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Top section - Token Pair Selector and Price Info */}
            <div className="flex flex-col gap-3 flex-1">
              <TokenPairSelector
                value={selectedPair}
                onValueChange={setSelectedPair}
              />
              
              {selectedPair && (
                <PriceDisplay data={data} formatPrice={formatPrice} />
              )}
            </div>
            
            {/* Time Range Controls - below on mobile, right side on desktop */}
            <ChartControls
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              isLoading={isLoading}
              onRefresh={retry}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedPair ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Select a trading pair to view chart</p>
            </div>
          ) : (
            <ChartContent
              data={data}
              timeRange={timeRange}
              isLoading={isLoading}
              error={error}
              formatPrice={formatPrice}
              onRetry={retry}
              onCandleClick={handleCandleClick}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CandlestickChart;
