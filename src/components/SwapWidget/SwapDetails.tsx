
interface Token {
  symbol: string;
  name: string;
  icon: string;
  address: string;
  decimals: number;
  balance?: number;
}

interface SwapDetailsProps {
  fromAmount: string;
  toAmount: string;
  fromToken: Token | null;
  toToken: Token | null;
  priceImpact: string;
  slippage: string;
}

const SwapDetails = ({ fromAmount, toAmount, fromToken, toToken, priceImpact, slippage }: SwapDetailsProps) => {
  if (!fromAmount || !toAmount) return null;

  return (
    <div className="space-y-2 p-3 bg-ocean-teal/10 rounded-lg border border-ocean-teal/20">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Price Impact</span>
        <span className="text-whale-gold">{priceImpact}%</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Slippage Tolerance</span>
        <span>{slippage}%</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Network Fee</span>
        <span>~0.001 VOI</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Route</span>
        <span className="text-xs">{fromToken?.symbol} → {toToken?.symbol}</span>
      </div>
    </div>
  );
};

export default SwapDetails;
