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
import {
  Wallet,
  Copy,
  LogOut,
  CheckCircle,
  ChevronDown,
  Trash2,
  Mail,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAddressName } from "@/hooks/useAddressName";
import WalletModal from "./WalletModal";
import AccountSelector from "./AccountSelector";
import {
  NetworkId,
  getNetworkConfig,
  getEnabledNetworks,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { getNetworkLogoPath } from "@/utils/tokenImageUtils";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { EasyStartConnectMenu } from "@/components/easy-start/EasyStartAuthControls";
import { useEasyStartLogin } from "@/hooks/useEasyStartLogin";
import { AppSettingsMenuSection } from "@/components/AppSettingsMenuSection";

interface WalletNetworkButtonProps {
  currentNetwork?: NetworkId;
  onNetworkChange?: (networkId: NetworkId) => void;
}

const WalletNetworkButton = ({
  currentNetwork = "algorand-mainnet",
  onNetworkChange,
}: WalletNetworkButtonProps) => {
  const {
    activeAccount,
    activeWallet,
    activeWalletAccounts,
    setActiveNetwork,
  } = useWallet();
  const {
    currentNetwork: contextNetwork,
    switchNetwork,
    isSwitchingNetwork,
  } = useNetwork();
  const [copied, setCopied] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] =
    useState<NetworkId>(contextNetwork);
  const { toast } = useToast();
  const { name: addressName } = useAddressName(activeAccount?.address);
  const privyEasyStart = usePrivyEasyStart();
  const showEasyStartEntry =
    privyEasyStart.enabled && privyEasyStart.configured;
  const openEasyStartLogin = useEasyStartLogin();

  const handlePrivyEmailLogin = () => {
    void openEasyStartLogin();
  };

  // Determine which networks are supported by the connected wallet
  const getSupportedNetworks = (): NetworkId[] => {
    if (!activeWallet) {
      // If no wallet connected, show all enabled networks
      return getEnabledNetworks();
    }

    const walletId = activeWallet.id.toLowerCase();
    const walletName = activeWallet.metadata?.name?.toLowerCase() || "";

    // Debug logging to see what we have
    console.log("Wallet Debug:", {
      walletId,
      walletName,
      metadata: activeWallet.metadata,
      fullWallet: activeWallet,
    });

    // xChain (RainbowKit): Algorand Mainnet only
    if (walletId === "rainbowkit") {
      return ["algorand-mainnet"];
    }

    // Universal wallets that work on both VOI and Algorand
    if (
      walletId === "lute" ||
      walletId === "kibisis" ||
      walletId === "walletconnect" ||
      walletId === "vera" ||
      walletId === "biatec" ||
      walletName.includes("vera") ||
      walletName.includes("biatec")
    ) {
      return getEnabledNetworks(); // Show all AVM networks
    }

    // Algorand-specific wallets
    if (
      walletId === "pera" ||
      walletId === "defly" ||
      walletName.includes("pera") ||
      walletName.includes("defly")
    ) {
      return ["algorand-mainnet"]; // Only Algorand Mainnet
    }

    // WalletConnect - check if it's a specific wallet
    if (walletId === "walletconnect") {
      // If connected via WalletConnect, check the wallet name to determine restrictions
      if (walletName.includes("vera") || walletName.includes("biatec")) {
        return ["voi-mainnet"]; // VOI-specific wallets via WalletConnect
      }
      if (walletName.includes("pera") || walletName.includes("defly")) {
        return ["algorand-mainnet"]; // Algorand-specific wallets via WalletConnect
      }

      // Fallback: If WalletConnect on VOI Mainnet, assume it's a VOI-specific wallet
      // This handles cases where wallet name doesn't contain the specific wallet name
      if (contextNetwork === "voi-mainnet") {
        return ["voi-mainnet"]; // Assume VOI-specific wallet
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
      console.error("Failed to disconnect wallet:", error);
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

  const handleAccountSelect = async (account: { address: string; name?: string }) => {
    try {
      if (activeWallet) {
        await activeWallet.setActiveAccount(account.address);
        toast({
          title: "Account Switched",
          description: `Switched to ${account.name || "account"}`,
        });
      }
    } catch (error) {
      console.error("Failed to switch account:", error);
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
      if ("indexedDB" in window) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map((db) => {
            return new Promise((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!);
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onsuccess = () => resolve(deleteReq.result);
            });
          })
        );
      }

      // Clear cookies (if accessible)
      document.cookie.split(";").forEach((cookie) => {
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
      console.error("Failed to clear site data:", error);
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
      // const supportedNetworks = getSupportedNetworks();
      // if (activeWallet && !supportedNetworks.includes(networkId)) {
      //   const networkConfig = getNetworkConfig(networkId);
      //   toast({
      //     title: "Network Not Supported",
      //     description: `Your ${activeWallet.name} wallet does not support ${networkConfig.name}. Please disconnect and connect a compatible wallet.`,
      //     variant: "destructive",
      //   });
      //   return;
      // }

      setSelectedNetwork(networkId);

      // Switch network - all wallets stay connected
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
        // Wallet remains connected
        toast({
          title: "Network Switched",
          description: `Switched to ${networkConfig.name}. Wallet remains connected.`,
        });
      }

      // Notify parent component about network change
      onNetworkChange?.(networkId);
    } catch (error) {
      console.error("Failed to switch network:", error);
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

  if (
    !activeAccount &&
    showEasyStartEntry &&
    privyEasyStart.authenticated
  ) {
    return <EasyStartConnectMenu />;
  }

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
              <span className="hidden sm:inline">
                {addressName || formatAddress(activeAccount.address)}
              </span>
              <span className="sm:hidden">
                {addressName || formatAddress(activeAccount.address)}
              </span>
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
            <DropdownMenuItem
              onClick={handleCopyAddress}
              className="cursor-pointer"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDisconnect}
              className="cursor-pointer text-red-600"
            >
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
                        <img
                          src={getNetworkLogoPath(networkId)}
                          alt={`${networkConfig.name} logo`}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/placeholder.svg";
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {networkConfig.name}
                          </span>
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
            <DropdownMenuItem
              onClick={handleClearSiteData}
              className="cursor-pointer text-orange-600"
            >
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
            {showEasyStartEntry ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {showEasyStartEntry ? "Get Started" : "Connect Wallet"}
            </span>
            <span className="sm:hidden">
              {showEasyStartEntry ? "Start" : "Connect"}
            </span>
            <ChevronDown className="w-4 h-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {showEasyStartEntry ? (
            <>
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Get started
                </div>
              </div>
              <DropdownMenuItem
                onSelect={() => {
                  handlePrivyEmailLogin();
                }}
                disabled={!privyEasyStart.login && !privyEasyStart.configured}
                className="cursor-pointer"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="px-2 py-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Wallet
                </div>
              </div>
            </>
          ) : (
            <div className="px-2 py-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wallet
              </div>
            </div>
          )}
          <DropdownMenuItem
            onClick={handleOpenWalletModal}
            className="cursor-pointer"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </DropdownMenuItem>

          <AppSettingsMenuSection />

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleClearSiteData}
            className="cursor-pointer text-orange-600"
          >
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
