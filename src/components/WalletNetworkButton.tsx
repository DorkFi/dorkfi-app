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
import { Wallet, Copy, LogOut, CheckCircle, ChevronDown, Wifi, WifiOff, Trash2 } from "lucide-react";
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

  // Determine which networks are supported by the connected wallet
  const getSupportedNetworks = (): NetworkId[] => {
    if (!activeWallet) {
      // If no wallet connected, show all enabled networks
      return getEnabledNetworks();
    }

    const walletId = activeWallet.id.toLowerCase();
    const walletName = activeWallet.metadata?.name?.toLowerCase() || '';
    
    // Debug logging to see what we have
    console.log('Wallet Debug:', {
      walletId,
      walletName,
      metadata: activeWallet.metadata,
      fullWallet: activeWallet
    });
    
    // Universal wallets that work on both VOI and Algorand
    if (walletId === 'lute' || walletId === 'kibisis') {
      return getEnabledNetworks(); // Show all AVM networks
    }
    
    // VOI-specific wallets
    if (walletId === 'vera' || walletId === 'biatec' || walletName.includes('vera') || walletName.includes('biatec')) {
      return ['voi-mainnet']; // Only VOI Mainnet
    }
    
    // Algorand-specific wallets
    if (walletId === 'pera' || walletId === 'defly' || walletName.includes('pera') || walletName.includes('defly')) {
      return ['algorand-mainnet']; // Only Algorand Mainnet
    }
    
    // WalletConnect - check if it's a specific wallet
    if (walletId === 'walletconnect') {
      // If connected via WalletConnect, check the wallet name to determine restrictions
      if (walletName.includes('vera') || walletName.includes('biatec')) {
        return ['voi-mainnet']; // VOI-specific wallets via WalletConnect
      }
      if (walletName.includes('pera') || walletName.includes('defly')) {
        return ['algorand-mainnet']; // Algorand-specific wallets via WalletConnect
      }
      
      // Fallback: If WalletConnect on VOI Mainnet, assume it's a VOI-specific wallet
      // This handles cases where wallet name doesn't contain the specific wallet name
      if (currentNetwork === 'voi-mainnet') {
        return ['voi-mainnet']; // Assume VOI-specific wallet
      }
      
      // If WalletConnect but unknown wallet, show all networks
      return getEnabledNetworks();
    }
    
    // Default: show all networks if wallet type is unknown
    return getEnabledNetworks();
  };

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

  const handleNetworkChange = async (networkId: NetworkId) => {
    if (isSwitchingNetwork) return; // Prevent multiple simultaneous switches
    
    try {
      // Check if the target network is supported by the connected wallet
      const supportedNetworks = getSupportedNetworks();
      if (activeWallet && !supportedNetworks.includes(networkId)) {
        const networkConfig = getNetworkConfig(networkId);
        toast({
          title: "Network Not Supported",
          description: `Your ${activeWallet.name} wallet does not support ${networkConfig.name}. Please disconnect and connect a compatible wallet.`,
          variant: "destructive",
        });
        return;
      }
      
      setSelectedNetwork(networkId);
      
      // Check if the connected wallet supports seamless network switching
      const isUniversalWallet = activeWallet && 
        (activeWallet.id.toLowerCase() === 'lute' || activeWallet.id.toLowerCase() === 'kibisis');
      
      if (isUniversalWallet && activeAccount) {
        // For universal wallets, switch network without disconnecting
        await switchNetwork(networkId);
        
        // Get the new network configuration
        const networkConfig = getNetworkConfig(networkId);
        
        toast({
          title: "Network Switched",
          description: `Switched to ${networkConfig.name}. Wallet remains connected.`,
        });
      } else {
        // For other wallets or when not connected, use standard switching
        await switchNetwork(networkId);
        
        // Get the new network configuration
        const networkConfig = getNetworkConfig(networkId);
        
        // If no wallet is connected, open wallet modal after switching network
        if (!activeAccount) {
          setIsWalletModalOpen(true);
          toast({
            title: "Network Switched",
            description: `Switched to ${networkConfig.name}. Please connect your wallet.`,
          });
        } else {
          // If wallet is connected but not universal, show reconnection message
          toast({
            title: "Network Switched",
            description: `Switched to ${networkConfig.name}. Please reconnect your wallet if needed.`,
          });
        }
      }
      
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
  const supportedNetworks = getSupportedNetworks();
  const showNetworkSection = supportedNetworks.length > 1;

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
                {getSupportedNetworks().map((networkId) => {
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
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearSiteData} className="cursor-pointer text-orange-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Site Data
            </DropdownMenuItem>
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
              {getSupportedNetworks().map((networkId) => {
                const networkConfig = getNetworkConfig(networkId);
                const isCurrentlySwitching = isSwitchingNetwork && selectedNetwork === networkId;
                const isDisabled = isSwitchingNetwork;
                const isCurrentNetwork = selectedNetwork === networkId;
                
                return (
                  <DropdownMenuItem
                    key={networkId}
                    onClick={() => !isDisabled && handleNetworkChange(networkId)}
                    className={`flex items-center justify-between ${
                      isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    } ${isCurrentNetwork ? "bg-accent" : ""}`}
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
                          {!activeAccount && !isCurrentNetwork && " • Connect wallet"}
                        </span>
                      </div>
                    </div>
                    {isCurrentNetwork && !isCurrentlySwitching && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleClearSiteData} className="cursor-pointer text-orange-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Site Data
          </DropdownMenuItem>
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
