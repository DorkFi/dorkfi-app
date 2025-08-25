import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Zap, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSwapQuote } from "@/hooks/useSwapQuote";
import TokenSelector from "./SwapWidget/TokenSelector";
import SwapDetails from "./SwapWidget/SwapDetails";
import SwapActions from "./SwapWidget/SwapActions";
import SwapQuote from "./SwapWidget/SwapQuote";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  address: string;
  decimals: number;
  balance?: number;
}

interface SwapWidgetProps {
  onTokenChange?: (fromToken: Token | null, toToken: Token | null) => void;
  selectedPrice?: number;
}

const SwapWidget = ({ onTokenChange, selectedPrice }: SwapWidgetProps) => {
  const { toast } = useToast();
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [priceImpact, setPriceImpact] = useState("0.12");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Get real-time swap quote
  const swapQuote = useSwapQuote(fromToken, toToken, fromAmount);

  // Mock ARC-200 tokens - in real implementation, these would come from Humble SDK
  const tokens: Token[] = [
    {
      symbol: "VOI",
      name: "Voi Network",
      icon: "🌊",
      address: "0x...",
      decimals: 6,
      balance: 1250.5
    },
    {
      symbol: "UNIT",
      name: "Unit Protocol",
      icon: "⚡",
      address: "0x...",
      decimals: 6,
      balance: 890.3
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      icon: "💵",
      address: "0x...",
      decimals: 6,
      balance: 5000.0
    }
  ];

  useEffect(() => {
    // Mock wallet connection check
    setIsWalletConnected(true);
    // Set default tokens
    const defaultFromToken = tokens[0];
    const defaultToToken = tokens[2];
    setFromToken(defaultFromToken);
    setToToken(defaultToToken);
    
    // Notify parent component about token selection
    if (onTokenChange) {
      onTokenChange(defaultFromToken, defaultToToken);
    }
  }, []);

  useEffect(() => {
    // Notify parent component when tokens change
    if (onTokenChange) {
      onTokenChange(fromToken, toToken);
    }
  }, [fromToken, toToken, onTokenChange]);

  // Handle price selection from chart
  useEffect(() => {
    if (selectedPrice && fromToken && toToken) {
      // Calculate a reasonable trade amount based on the price
      const targetUSDValue = 100;
      let tradeAmount: number;
      
      if (toToken.symbol === 'USDC') {
        // If trading to USDC, calculate how much fromToken to get $100 worth
        tradeAmount = targetUSDValue / selectedPrice;
      } else {
        // For other pairs, use the price directly with some scaling
        tradeAmount = targetUSDValue / selectedPrice;
      }
      
      // Format to appropriate decimals
      const formattedAmount = tradeAmount.toFixed(fromToken.decimals);
      setFromAmount(formattedAmount);
      
      toast({
        title: "Price Selected",
        description: `Set amount to trade at ${selectedPrice.toFixed(4)} ${toToken.symbol}`,
      });
    }
  }, [selectedPrice, fromToken, toToken, toast]);

  // Update toAmount when swap quote changes
  useEffect(() => {
    if (swapQuote.expectedOutput && parseFloat(swapQuote.expectedOutput) > 0) {
      setToAmount(swapQuote.expectedOutput);
      setPriceImpact(swapQuote.slippage); // Use real slippage as price impact
    }
  }, [swapQuote]);

  // Handler for "Max" click for 'From' token
  const handleFromMaxClick = () => {
    if (!fromToken || typeof fromToken.balance !== "number") return;
    // Set balance, formatted with token decimals
    setFromAmount(fromToken.balance.toFixed(fromToken.decimals));
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleFromTokenChange = (value: string) => {
    const newToken = tokens.find(t => t.symbol === value) || null;
    setFromToken(newToken);
  };

  const handleToTokenChange = (value: string) => {
    const newToken = tokens.find(t => t.symbol === value) || null;
    setToToken(newToken);
  };

  const handleConnectWallet = () => {
    toast({
      title: "Wallet Connection",
      description: "Connect your Defly or Pera wallet to continue",
    });
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) return;
    
    setIsSwapping(true);
    
    try {
      // Mock swap transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Swap Successful!",
        description: `Swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
      });
      
      // Reset form
      setFromAmount("");
      setToAmount("");
    } catch (error) {
      toast({
        title: "Swap Failed",
        description: "Transaction failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const canSwap = fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0 && isWalletConnected;

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:border-ocean-teal/40 transition-all">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2 text-slate-800 dark:text-white">
              <Zap className="w-5 h-5 text-whale-gold" />
              Whale Swap
            </CardTitle>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* From Token */}
          <TokenSelector
            label="From"
            token={fromToken}
            amount={fromAmount}
            tokens={tokens}
            onTokenChange={handleFromTokenChange}
            onAmountChange={setFromAmount}
            onMaxClick={handleFromMaxClick}
          />

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapTokens}
              className="rounded-full bg-ocean-teal/20 hover:bg-ocean-teal/30 border border-ocean-teal/40 bubble-float transition-all hover:scale-110"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {/* To Token */}
          <TokenSelector
            label="To"
            token={toToken}
            amount={toAmount}
            tokens={tokens}
            onTokenChange={handleToTokenChange}
            readOnly
          />

          {/* Swap Details */}
          <SwapDetails
            fromAmount={fromAmount}
            toAmount={toAmount}
            fromToken={fromToken}
            toToken={toToken}
            priceImpact={priceImpact}
            slippage={slippage}
          />

          {/* Swap Quote */}
          <SwapQuote
            fromAmount={fromAmount}
            fromToken={fromToken}
            toToken={toToken}
            expectedOutput={swapQuote.expectedOutput}
            slippage={swapQuote.slippage}
            isLoading={swapQuote.isLoading}
            lastUpdated={swapQuote.lastUpdated}
          />

          {/* Action Button */}
          <SwapActions
            isWalletConnected={isWalletConnected}
            canSwap={canSwap}
            isSwapping={isSwapping}
            onConnectWallet={handleConnectWallet}
            onSwap={handleSwap}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default SwapWidget;
