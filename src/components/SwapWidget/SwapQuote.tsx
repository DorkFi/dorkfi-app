
import { Loader2, RefreshCw } from "lucide-react";

interface SwapQuoteProps {
  fromAmount: string;
  fromToken: { symbol: string } | null;
  toToken: { symbol: string } | null;
  expectedOutput: string;
  slippage: string;
  isLoading: boolean;
  lastUpdated?: Date;
}

const SwapQuote = ({ 
  fromAmount, 
  fromToken, 
  toToken, 
  expectedOutput, 
  slippage, 
  isLoading,
  lastUpdated 
}: SwapQuoteProps) => {
  if (!fromAmount || !fromToken || !toToken || parseFloat(fromAmount) <= 0) {
    return null;
  }

  return (
    <div className="p-3 bg-ocean-teal/5 rounded-lg border border-ocean-teal/10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-whale-gold" />
            ) : (
              <RefreshCw className="h-3 w-3 text-whale-gold" />
            )}
            <span className="text-sm text-white">
              You receive ≈ {expectedOutput} {toToken.symbol}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Slippage: {slippage}%
            {lastUpdated && (
              <span className="ml-2">
                • Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapQuote;
