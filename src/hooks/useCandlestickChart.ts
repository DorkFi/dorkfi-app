
import { useState, useEffect, useCallback } from 'react';
import { MimirApiService } from '@/services/mimirApi';

interface OHLCDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TokenPair {
  from: string;
  to: string;
  label: string;
  popular?: boolean;
}

type TimeRange = '1h' | '24h' | '7d';

interface UseCandlestickChartProps {
  tokenPair: TokenPair | null;
}

export const useCandlestickChart = ({ tokenPair }: UseCandlestickChartProps) => {
  const [data, setData] = useState<OHLCDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const fetchData = useCallback(async () => {
    if (!tokenPair) {
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const interval = timeRange === '1h' ? '1m' : timeRange === '24h' ? '1h' : '1d';
      const ohlcData = await MimirApiService.getOHLCData(
        tokenPair.from,
        tokenPair.to,
        interval,
        timeRange
      );
      
      setData(ohlcData);
    } catch (err) {
      console.error('Error fetching OHLC data:', err);
      setError('Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh data every 30 seconds for 1h range, every 5 minutes for others
  useEffect(() => {
    if (!tokenPair) return;

    const refreshInterval = timeRange === '1h' ? 30000 : 300000; // 30s or 5min
    const interval = setInterval(fetchData, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, tokenPair, timeRange]);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    retry
  };
};
