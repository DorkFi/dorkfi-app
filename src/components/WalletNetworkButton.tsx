import { useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Wallet, Copy, LogOut, CheckCircle, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "./WalletModal";
import AccountSelector from "./AccountSelector";
import { config, NetworkId, getNetworkConfig, getEnabledNetworks } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";

interface WalletNetworkButtonProps {
  currentNetwork?: NetworkId;
  onNetworkChange?: (networkId: NetworkId) => void;
}

const WalletNetworkButton = ({
  currentNetwork = "voi-mainnet",
  onNetworkChange,
}: WalletNetworkButtonProps) => {
  const { activeAccount, activeWallet, activeWalletAccounts, setActiveNetwork } = useWallet();
  const { currentNetwork: contextNetwork, switchNetwork, isSwitchingNetwork } = useNetwork();
  const [copied, setCopied] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>(contextNetwork);
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

  const handleNetworkChange = async (networkId: NetworkId) => {
    if (isSwitchingNetwork) return; // Prevent multiple simultaneous switches
    
    try {
      setSelectedNetwork(networkId);
      
      // Use the network context to switch networks (this will handle wallet disconnection)
      await switchNetwork(networkId);
      
      // Get the new network configuration
      const networkConfig = getNetworkConfig(networkId);
      
      toast({
        title: "Network Switched",
        description: `Switched to ${networkConfig.name}. Please reconnect your wallet if needed.`,
      });
      
      // Notify parent component about network change
      onNetworkChange?.(networkId);
      
    } catch (error) {
      console.error('Failed to switch network:', error);
      toast({
        title: "Network Switch Failed",
        description: "Failed to switch network. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const currentConfig = getNetworkConfig(selectedNetwork);
  const isOnline = true; // You can implement actual network status checking here
  const enabledNetworks = getEnabledNetworks();
  const showNetworkSection = enabledNetworks.length > 1;

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
            <Button className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{formatAddress(activeAccount.address)}</span>
              <span className="sm:hidden">{formatAddress(activeAccount.address)}</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Wallet Section */}
            <div className="px-2 py-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wallet
              </div>
            </div>
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
            
            {showNetworkSection && (
              <>
                <DropdownMenuSeparator />
                
                {/* Network Section */}
                <div className="px-2 py-1.5">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Network
                  </div>
                </div>
                {enabledNetworks.map((networkId) => {
                  const networkConfig = getNetworkConfig(networkId);
                  return (
                    <DropdownMenuItem
                      key={networkId}
                      onClick={() => handleNetworkChange(networkId)}
                      className={`cursor-pointer flex items-center justify-between ${
                        selectedNetwork === networkId ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{networkConfig.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {networkConfig.networkType.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {selectedNetwork === networkId && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
            <ChevronDown className="w-4 h-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Connect Wallet Section */}
          <div className="px-2 py-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Wallet
            </div>
          </div>
          <DropdownMenuItem onClick={handleOpenWalletModal} className="cursor-pointer">
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </DropdownMenuItem>
          
          {showNetworkSection && (
            <>
              <DropdownMenuSeparator />
              
              {/* Network Section */}
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Network
                </div>
              </div>
              {enabledNetworks.map((networkId) => {
                const networkConfig = getNetworkConfig(networkId);
                const isCurrentlySwitching = isSwitchingNetwork && selectedNetwork === networkId;
                const isDisabled = isSwitchingNetwork;
                
                return (
                  <DropdownMenuItem
                    key={networkId}
                    onClick={() => !isDisabled && handleNetworkChange(networkId)}
                    className={`flex items-center justify-between ${
                      isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    } ${selectedNetwork === networkId ? "bg-accent" : ""}`}
                    disabled={isDisabled}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrentlySwitching ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : isOnline ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {networkConfig.name}
                          {isCurrentlySwitching && " (Switching...)"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {networkConfig.networkType.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {selectedNetwork === networkId && !isCurrentlySwitching && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <WalletModal 
        isOpen={isWalletModalOpen}
        onClose={handleCloseWalletModal}
      />
    </>
  );
};

export default WalletNetworkButton;
