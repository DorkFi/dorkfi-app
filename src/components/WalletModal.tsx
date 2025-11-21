import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle, ExternalLink } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/contexts/NetworkContext";
import { getNetworkConfig, isAVMNetwork, isEVMNetwork } from "@/config";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  isInstalled?: boolean;
  downloadUrl?: string;
}

// Connection timeout in milliseconds (60 seconds)
const CONNECTION_TIMEOUT = 60000;

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { wallets, activeAccount } = useWallet();
  const { toast } = useToast();
  const { currentNetwork } = useNetwork();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAbortRef = useRef<AbortController | null>(null);

  // Get network configuration
  const networkConfig = getNetworkConfig(currentNetwork);
  const isAVM = isAVMNetwork(currentNetwork);
  const isEVM = isEVMNetwork(currentNetwork);

  // Define wallet providers based on network type
  const getWalletProviders = (): WalletProvider[] => {
    if (isAVM) {
      // AVM networks (VOI, Algorand) - show Algorand-compatible wallets
      console.log({ wallets });

      const baseWallets = [
        {
          id: "kibisis",
          name: "Kibisis",
          icon: wallets.find((w) => w.id === "kibisis")?.metadata.icon || "🔗",
          description: "Connect with Kibisis wallet (Algorand/VOI)",
          isInstalled: true,
        },
        {
          id: "lute",
          name: "Lute",
          icon: wallets.find((w) => w.id === "lute")?.metadata.icon || "🔗",
          description: "Connect with Lute wallet (Algorand/VOI)",
          isInstalled: true,
        },
        {
          id: "vera",
          name: "VOI Wallet",
          icon: "/lovable-uploads/verwallet.png",
          description: "Connect with VOI Wallet (Algorand/VOI)",
          isInstalled: true,
        },
      ];

      // Add VOI-specific wallets
      if (currentNetwork === "voi-mainnet") {
        baseWallets.push({
          id: "biatec",
          name: "Biatec Wallet",
          icon: wallets.find((w) => w.id === "biatec")?.metadata.icon || "🔗",
          description: "Connect with Biatec wallet (VOI Network)",
          isInstalled: true,
        });
      }

      // Add other wallets based on network
      if (currentNetwork === "algorand-mainnet") {
        baseWallets.push(
          {
            id: "pera",
            name: "Pera Wallet",
            icon: wallets.find((w) => w.id === "pera")?.metadata.icon || "🔗",
            description: "Connect with Pera wallet (Algorand)",
            isInstalled: true,
          },
          {
            id: "defly",
            name: "Defly Wallet",
            icon: wallets.find((w) => w.id === "defly")?.metadata.icon || "🔗",
            description: "Connect with Defly wallet (Algorand)",
            isInstalled: true,
          }
        );
      }

      // Add WalletConnect for all AVM networks
      baseWallets.push({
        id: "walletconnect",
        name: "WalletConnect",
        icon: "🔗",
        description: "Connect with WalletConnect (Multi-chain)",
        isInstalled: true,
      });

      return baseWallets;
    } else if (isEVM) {
      // EVM networks (Ethereum, Base) - show Ethereum-compatible wallets
      return [
        {
          id: "metamask",
          name: "MetaMask",
          icon: "🦊",
          description: "Connect with MetaMask wallet (Ethereum/Base)",
          isInstalled: false,
          downloadUrl: "https://metamask.io/",
        },
        {
          id: "coinbase",
          name: "Coinbase Wallet",
          icon: "🔵",
          description: "Connect with Coinbase wallet (Ethereum/Base)",
          isInstalled: false,
          downloadUrl: "https://www.coinbase.com/wallet",
        },
        {
          id: "walletconnect",
          name: "WalletConnect",
          icon: "🔗",
          description: "Connect with WalletConnect (Multi-chain)",
          isInstalled: true,
        },
      ];
    }

    // Fallback for unknown network types
    return [
      {
        id: "kibisis",
        name: "Kibisis",
        icon: "🔗",
        description: "Connect with Kibisis wallet",
        isInstalled: true,
      },
    ];
  };

  // Filter wallet providers based on what's actually available
  const getAvailableWalletProviders = (): WalletProvider[] => {
    const allProviders = getWalletProviders();

    if (isAVM) {
      // For AVM networks, only show wallets that are actually available in the WalletManager
      const availableWalletIds = wallets.map((w) => w.id);
      return allProviders.filter((provider) => {
        // Always show Vera Wallet if WalletConnect is available and we're on VOI Mainnet
        if (
          provider.id === "vera" &&
          currentNetwork === "voi-mainnet" &&
          availableWalletIds.includes("walletconnect")
        ) {
          return true;
        }
        // Show Biatec wallet if it's available in the WalletManager
        if (provider.id === "biatec" && availableWalletIds.includes("biatec")) {
          return true;
        }
        // Show other wallets if they're available or not installed
        return (
          availableWalletIds.includes(provider.id) || !provider.isInstalled
        );
      });
    }

    // For EVM networks, show all providers (they'll show "coming soon" message)
    return allProviders;
  };

  const walletProviders = getAvailableWalletProviders();

  // Reset connecting state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear any ongoing connection state when modal closes
      setIsConnecting(null);
      // Clear timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Abort any ongoing connection attempts
      if (connectionAbortRef.current) {
        connectionAbortRef.current.abort();
        connectionAbortRef.current = null;
      }
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (connectionAbortRef.current) {
        connectionAbortRef.current.abort();
      }
    };
  }, []);

  const handleConnectWallet = async (providerId: string) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create abort controller for this connection attempt
    const abortController = new AbortController();
    connectionAbortRef.current = abortController;

    try {
      setIsConnecting(providerId);

      // Set timeout to cancel loading after CONNECTION_TIMEOUT
      // Use closure to capture the providerId at the time of timeout creation
      timeoutRef.current = setTimeout(() => {
        // Check if we're still connecting this specific provider
        setIsConnecting((current) => {
          if (current === providerId && !abortController.signal.aborted) {
            connectionAbortRef.current = null;
            toast({
              title: "Connection Timeout",
              description: "Wallet connection timed out. Please try again.",
              variant: "destructive",
            });
            return null;
          }
          return current;
        });
      }, CONNECTION_TIMEOUT);

      // For AVM networks, find the wallet from the wallets array
      if (isAVM) {
        // Handle Vera Wallet specifically (uses WalletConnect)
        if (providerId === "vera") {
          const walletConnectWallet = wallets.find(
            (w) => w.id === "walletconnect"
          );

          if (!walletConnectWallet) {
            throw new Error("WalletConnect wallet not found");
          }

          // Check if connection was aborted
          if (abortController.signal.aborted) {
            return;
          }

          // Connect to WalletConnect (which will show Vera Wallet in the modal)
          await walletConnectWallet.connect();

          // Check again after connection
          if (abortController.signal.aborted) {
            return;
          }

          // Clear timeout on success
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          toast({
            title: "Vera Wallet Connected",
            description:
              "Successfully connected to Vera Wallet via WalletConnect",
          });
        } else {
          const wallet = wallets.find((w) => w.id === providerId);

          if (!wallet) {
            throw new Error("Wallet provider not found");
          }

          // Check if connection was aborted
          if (abortController.signal.aborted) {
            return;
          }

          // Connect to the wallet
          await wallet.connect();

          // Check again after connection
          if (abortController.signal.aborted) {
            return;
          }

          // Clear timeout on success
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          toast({
            title: "Wallet Connected",
            description: `Successfully connected to ${wallet.metadata.name}`,
          });
        }
      } else if (isEVM) {
        // For EVM networks, we would need to implement EVM wallet connection
        // For now, show a message that EVM wallets are not yet implemented
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        toast({
          title: "EVM Wallets Coming Soon",
          description:
            "EVM wallet integration is not yet implemented. Please switch to an AVM network.",
          variant: "destructive",
        });
        setIsConnecting(null);
        connectionAbortRef.current = null;
        return;
      }

      // Only close modal if connection wasn't aborted
      if (!abortController.signal.aborted) {
        onClose();
      }
    } catch (error) {
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Only show error if connection wasn't aborted
      if (!abortController.signal.aborted) {
        console.error("Failed to connect wallet:", error);
        toast({
          title: "Connection Failed",
          description:
            error instanceof Error ? error.message : "Failed to connect wallet",
          variant: "destructive",
        });
      }
    } finally {
      // Only reset connecting state if it's still for this provider
      setIsConnecting((current) => {
        if (current === providerId && !abortController.signal.aborted) {
          return null;
        }
        return current;
      });
      connectionAbortRef.current = null;
    }
  };

  const handleDownloadWallet = (downloadUrl: string) => {
    window.open(downloadUrl, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 rounded-full bg-white/90 hover:bg-white"
          aria-label="Close"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-center">
            Connect Wallet
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Choose a wallet to connect to DorkFi on {networkConfig.name}
          </p>
          <div className="flex items-center justify-center mt-2">
            <div className="px-3 py-1 rounded-full bg-ocean-teal/20 text-ocean-teal text-xs font-medium">
              {isAVM
                ? "AVM Network"
                : isEVM
                ? "EVM Network"
                : "Unknown Network"}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {walletProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50 hover:border-ocean-teal/40 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold">
                  {provider.icon.startsWith("data:") ? (
                    <img
                      src={provider.icon}
                      alt={provider.name}
                      className="w-25 h-25 rounded-full"
                    />
                  ) : provider.icon.startsWith("/") ? (
                    <img
                      src={provider.icon}
                      alt={provider.name}
                      className="w-25 h-25 rounded-full"
                    />
                  ) : (
                    provider.icon
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {provider.isInstalled ? (
                  <Button
                    onClick={() => handleConnectWallet(provider.id)}
                    disabled={isConnecting === provider.id}
                    className="bg-whale-gold hover:bg-whale-gold/90 text-black font-semibold transition-all hover:scale-105"
                    size="sm"
                  >
                    {isConnecting === provider.id ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-1" />
                        Connect
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      provider.downloadUrl &&
                      handleDownloadWallet(provider.downloadUrl)
                    }
                    variant="outline"
                    size="sm"
                    className="border-ocean-teal/40 hover:border-ocean-teal hover:bg-ocean-teal/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Install
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 mt-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <p className="text-xs text-muted-foreground text-center">
            By connecting a wallet, you agree to our Terms of Service and
            Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;
