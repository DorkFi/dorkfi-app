import { OHLCDataPoint, PriceDataPoint, MimirOHLCResponse, MimirPriceResponse, MIMIR_BASE_URL, TOKEN_MAP } from '@/types/mimirTypes';
import { TokenService } from './tokenService';
import { MockDataService } from './mockDataService';

interface SwapSimulationResult {
  expectedOutput: string;
  slippage: string;
  priceImpact: string;
}

export class PriceService {
  static async getCurrentPrice(tokenA: string, tokenB: string): Promise<number> {
    try {
      const tokens = await TokenService.getTokens();
      const tokenAId = tokens.find(t => t.symbol === tokenA)?.id || TOKEN_MAP[tokenA] || tokenA;
      const tokenBId = tokens.find(t => t.symbol === tokenB)?.id || TOKEN_MAP[tokenB] || tokenB;

      const url = `${MIMIR_BASE_URL}/prices/current?tokenA=${tokenAId}&tokenB=${tokenBId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch current price: ${response.status}`);
      }
      
      const data = await response.json();
      return data.price || 0;
    } catch (error) {
      console.error('Error fetching current price:', error);
      // Return mock price if API fails
      const mockRates: Record<string, number> = { 'VOI': 7.0, 'UNIT': 7.0, 'USDC': 1.0 };
      const fromRate = mockRates[tokenA] || 1.0;
      const toRate = mockRates[tokenB] || 1.0;
      return fromRate / toRate;
    }
  }

  static async simulateSwap(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<SwapSimulationResult> {
    try {
      const tokens = await TokenService.getTokens();
      const fromTokenId = tokens.find(t => t.symbol === fromToken)?.id || TOKEN_MAP[fromToken] || fromToken;
      const toTokenId = tokens.find(t => t.symbol === toToken)?.id || TOKEN_MAP[toToken] || toToken;

      const url = `${MIMIR_BASE_URL}/swap/simulate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromToken: fromTokenId,
          toToken: toTokenId,
          amount: amount
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to simulate swap: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        expectedOutput: data.expectedOutput?.toFixed(6) || '0.000000',
        slippage: data.slippage?.toFixed(2) || '0.00',
        priceImpact: data.priceImpact?.toFixed(2) || '0.00'
      };
    } catch (error) {
      console.error('Error simulating swap:', error);
      
      // Fallback to mock calculation
      const mockRates: Record<string, number> = { 'VOI': 7.0, 'UNIT': 7.0, 'USDC': 1.0 };
      const fromRate = mockRates[fromToken] || 1.0;
      const toRate = mockRates[toToken] || 1.0;
      
      const baseOutput = (amount * fromRate) / toRate;
      
      // Calculate slippage based on trade size
      const tradeSize = amount * fromRate;
      let slippagePercent = 0.05;
      
      if (tradeSize > 10000) slippagePercent = 0.25;
      else if (tradeSize > 5000) slippagePercent = 0.15;
      else if (tradeSize > 1000) slippagePercent = 0.10;
      
      const slippageAmount = baseOutput * (slippagePercent / 100);
      const expectedOutput = baseOutput - slippageAmount;

      return {
        expectedOutput: expectedOutput.toFixed(6),
        slippage: slippagePercent.toFixed(2),
        priceImpact: (slippagePercent * 0.8).toFixed(2) // Mock price impact
      };
    }
  }

  static async getOHLCData(
    tokenA: string,
    tokenB: string,
    interval: '1m' | '1h' | '1d' = '1h',
    range: '1h' | '24h' | '7d' = '24h'
  ): Promise<OHLCDataPoint[]> {
    try {
      const tokens = await TokenService.getTokens();
      const tokenAId = tokens.find(t => t.symbol === tokenA)?.id || TOKEN_MAP[tokenA] || tokenA;
      const tokenBId = tokens.find(t => t.symbol === tokenB)?.id || TOKEN_MAP[tokenB] || tokenB;

      const url = `${MIMIR_BASE_URL}/prices/ohlc?tokenA=${tokenAId}&tokenB=${tokenBId}&interval=${interval}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch OHLC data: ${response.status}`);
      }
      
      const data: MimirOHLCResponse[] = await response.json();
      
      return data.map(item => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      }));
    } catch (error) {
      console.error('Error fetching OHLC data:', error);
      return MockDataService.generateMockOHLCData(tokenA, tokenB, range);
    }
  }

  static async getPriceHistory(
    tokenA: string,
    tokenB: string,
    interval: '1m' | '5m' | '1h' = '5m',
    range: '1h' | '24h' | '7d' = '24h'
  ): Promise<PriceDataPoint[]> {
    try {
      const tokens = await TokenService.getTokens();
      const tokenAId = tokens.find(t => t.symbol === tokenA)?.id || TOKEN_MAP[tokenA] || tokenA;
      const tokenBId = tokens.find(t => t.symbol === tokenB)?.id || TOKEN_MAP[tokenB] || tokenB;

      const url = `${MIMIR_BASE_URL}/prices/history?tokenA=${tokenAId}&tokenB=${tokenBId}&interval=${interval}&range=${range}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch price history: ${response.status}`);
      }
      
      const data: MimirPriceResponse[] = await response.json();
      
      return data.map(item => ({
        timestamp: item.timestamp,
        price: item.price
      }));
    } catch (error) {
      console.error('Error fetching price history:', error);
      return MockDataService.generateMockData(tokenA, tokenB, range);
    }
  }
}
