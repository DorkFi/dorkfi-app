
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface OHLCDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceDisplayProps {
  data: OHLCDataPoint[];
  formatPrice: (price: number) => string;
}

const PriceDisplay = ({ data, formatPrice }: PriceDisplayProps) => {
  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const previousPrice = data.length > 1 ? data[data.length - 2].close : currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice !== 0 ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  if (data.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold">
        {formatPrice(currentPrice)}
      </span>
      <Badge 
        variant={isPositive ? "default" : "destructive"}
        className={isPositive ? "bg-green-600" : "bg-red-600"}
      >
        {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
      </Badge>
    </div>
  );
};

export default PriceDisplay;
