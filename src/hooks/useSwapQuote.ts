
import { useState, useEffect, useCallback } from 'react';
import { PriceService } from '@/services/mimirApi/priceService';

interface Token {
  symbol: string;
  name: string;
  decimals: number;
}

interface SwapQuote {
  expectedOutput: string;
  slippage: string;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export const useSwapQuote = (
  fromToken: Token | null,
  toToken: Token | null,
  fromAmount: string
) => {
  const [quote, setQuote] = useState<SwapQuote>({
    expectedOutput: '0.00',
    slippage: '0.00',
    isLoading: false,
    lastUpdated: null,
    error: null
  });

  const calculateQuote = useCallback(async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(prev => ({ ...prev, expectedOutput: '0.00', slippage: '0.00' }));
      return;
    }

    setQuote(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try to get current price from Mimir API
      const simulatedOutput = await PriceService.simulateSwap(
        fromToken.symbol,
        toToken.symbol,
        parseFloat(fromAmount)
      );

      setQuote({
        expectedOutput: simulatedOutput.expectedOutput,
        slippage: simulatedOutput.slippage,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      });
    } catch (error) {
      console.error('Error calculating swap quote:', error);
      
      // Fallback to mock calculation
      const mockOutput = calculateMockQuote(fromToken, toToken, parseFloat(fromAmount));
      
      setQuote({
        expectedOutput: mockOutput.expectedOutput,
        slippage: mockOutput.slippage,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      });
    }
  }, [fromToken, toToken, fromAmount]);

  const calculateMockQuote = (fromToken: Token, toToken: Token, amount: number) => {
    // Mock exchange rates
    const rates: Record<string, number> = {
      'VOI': 7.0,
      'UNIT': 7.0,
      'USDC': 1.0
    };

    const fromRate = rates[fromToken.symbol] || 1.0;
    const toRate = rates[toToken.symbol] || 1.0;
    
    const baseOutput = (amount * fromRate) / toRate;
    
    // Calculate slippage based on trade size (larger trades = higher slippage)
    const tradeSize = amount * fromRate; // USD value
    let slippagePercent = 0.05; // Base 0.05%
    
    if (tradeSize > 10000) slippagePercent = 0.25;
    else if (tradeSize > 5000) slippagePercent = 0.15;
    else if (tradeSize > 1000) slippagePercent = 0.10;
    
    const slippageAmount = baseOutput * (slippagePercent / 100);
    const expectedOutput = baseOutput - slippageAmount;

    return {
      expectedOutput: expectedOutput.toFixed(6),
      slippage: slippagePercent.toFixed(2)
    };
  };

  // Calculate quote when inputs change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateQuote();
    }, 500); // Debounce by 500ms

    return () => clearTimeout(timeoutId);
  }, [calculateQuote]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
        calculateQuote();
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [calculateQuote, fromToken, toToken, fromAmount]);

  return quote;
};
