
import { OHLCDataPoint, PriceDataPoint } from '@/types/mimirTypes';

export class MockDataService {
  static generateMockOHLCData(tokenA: string, tokenB: string, range: string): OHLCDataPoint[] {
    const now = new Date();
    const dataPoints: OHLCDataPoint[] = [];
    const basePrice = tokenA === 'VOI' ? 7.0 : 1.0;
    
    let intervals = 24; // 24 hours of hourly data
    if (range === '1h') intervals = 12; // 12 intervals of 5min each
    if (range === '7d') intervals = 168; // 7 days of hourly data
    
    let currentPrice = basePrice;
    
    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * (range === '1h' ? 5 : 60) * 60 * 1000));
      
      // Generate realistic OHLC data
      const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
      const open = currentPrice;
      const volatility = 0.02; // 2% volatility
      
      const high = open * (1 + Math.random() * volatility);
      const low = open * (1 - Math.random() * volatility);
      const close = open * (1 + variation);
      
      currentPrice = close; // Use close as next open
      
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        open: Math.max(0.001, open),
        high: Math.max(0.001, high),
        low: Math.max(0.001, low),
        close: Math.max(0.001, close)
      });
    }
    
    return dataPoints;
  }

  static generateMockData(tokenA: string, tokenB: string, range: string): PriceDataPoint[] {
    const now = new Date();
    const dataPoints: PriceDataPoint[] = [];
    const basePrice = tokenA === 'VOI' ? 7.0 : 1.0;
    
    let intervals = 24; // 24 hours of hourly data
    if (range === '1h') intervals = 12; // 12 intervals of 5min each
    if (range === '7d') intervals = 168; // 7 days of hourly data
    
    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * (range === '1h' ? 5 : 60) * 60 * 1000));
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      const price = basePrice * (1 + variation);
      
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        price: Math.max(0.001, price) // Ensure positive price
      });
    }
    
    return dataPoints;
  }
}
