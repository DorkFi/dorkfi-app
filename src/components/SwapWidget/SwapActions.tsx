
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, Zap, ExternalLink } from "lucide-react";

interface SwapActionsProps {
  isWalletConnected: boolean;
  canSwap: boolean;
  isSwapping: boolean;
  onConnectWallet: () => void;
  onSwap: () => void;
}

const SwapActions = ({ 
  isWalletConnected, 
  canSwap, 
  isSwapping, 
  onConnectWallet, 
  onSwap 
}: SwapActionsProps) => {
  if (!isWalletConnected) {
    return (
      <div className="space-y-3">
        <Button 
          onClick={onConnectWallet}
          className="w-full bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
        
        <Button
          onClick={() => window.open('https://ibuyvoi.com', '_blank')}
          variant="outline"
          className="w-full border-ocean-teal/40 text-ocean-teal hover:bg-ocean-teal/10 transition-all"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Buy VOI
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={onSwap}
        disabled={!canSwap || isSwapping}
        className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold disabled:opacity-50 transition-all hover:scale-105"
      >
        {isSwapping ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Swapping...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Execute Swap
          </>
        )}
      </Button>
      
      <Button
        onClick={() => window.open('https://ibuyvoi.com', '_blank')}
        variant="outline"
        className="w-full border-ocean-teal/40 text-ocean-teal hover:bg-ocean-teal/10 transition-all"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Buy VOI
      </Button>
    </div>
  );
};

export default SwapActions;
