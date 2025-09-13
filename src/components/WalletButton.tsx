
import { useWallet } from "@txnlab/use-wallet-react"
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wallet, Copy, LogOut, CheckCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "./WalletModal";
import AccountSelector from "./AccountSelector";

const WalletButton = () => {
  const { activeAccount, activeWallet, activeWalletAccounts } = useWallet();
  const [copied, setCopied] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
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

  const handleDisconnect = async () => {
    try {
      if (activeWallet) {
        await activeWallet.disconnect();
        toast({
          title: "Wallet Disconnected",
          description: "Your wallet has been disconnected",
        });
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  const handleOpenWalletModal = () => {
    setIsWalletModalOpen(true);
  };

  const handleCloseWalletModal = () => {
    setIsWalletModalOpen(false);
  };

  const handleAccountSelect = async (account: any) => {
    try {
      if (activeWallet) {
        await activeWallet.setActiveAccount(account.address);
        toast({
          title: "Account Switched",
          description: `Switched to ${account.name || 'account'}`,
        });
      }
    } catch (error) {
      console.error('Failed to switch account:', error);
      toast({
        title: "Switch Failed",
        description: "Failed to switch account",
        variant: "destructive",
      });
    }
  };

  const handleClearSiteData = async () => {
    try {
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear IndexedDB (if used)
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(db => {
            return new Promise((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!);
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onsuccess = () => resolve(deleteReq.result);
            });
          })
        );
      }
      
      // Clear cookies (if accessible)
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
      
      toast({
        title: "Site Data Cleared",
        description: "All local data has been cleared successfully",
      });
      
      // Optionally reload the page to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to clear site data:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear some site data",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (activeAccount) {
    return (
      <div className="flex items-center space-x-2">
        {activeWalletAccounts && activeWalletAccounts.length > 1 && (
          <AccountSelector
            accounts={activeWalletAccounts}
            activeAccount={activeAccount}
            onAccountSelect={handleAccountSelect}
          />
        )}
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
            <DropdownMenuItem onClick={handleClearSiteData} className="cursor-pointer text-orange-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Site Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-3">
      <Button 
        onClick={handleOpenWalletModal}
        className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
      
      <Button 
        onClick={handleClearSiteData}
        variant="outline"
        className="text-orange-600 border-orange-600 hover:bg-orange-50 transition-all hover:scale-105"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Clear Site Data
      </Button>
      
      <WalletModal 
        isOpen={isWalletModalOpen}
        onClose={handleCloseWalletModal}
      />
    </div>
  );
};

export default WalletButton;
