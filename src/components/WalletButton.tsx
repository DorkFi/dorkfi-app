
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wallet, Copy, LogOut, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const WalletButton = () => {
  const { activeAccount, openWalletModal, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyAddress = () => {
    if (activeAccount?.address) {
      navigator.clipboard.writeText(activeAccount.address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (activeAccount) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105">
            <CheckCircle className="w-4 h-4 mr-2" />
            {formatAddress(activeAccount.address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer">
            {copied ? (
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? "Copied!" : "Copy Address"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-red-600">
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button 
      onClick={openWalletModal}
      className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105"
    >
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
};

export default WalletButton;
