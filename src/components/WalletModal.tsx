import React, { useState } from "react";
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

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { wallets, activeAccount } = useWallet();
  const { toast } = useToast();
  const { currentNetwork } = useNetwork();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

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
          name: "Voi Wallet",
          icon: "/lovable-uploads/verwallet.png",
          description: "Connect with Voi Wallet (Algorand/VOI)",
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

  const handleConnectWallet = async (providerId: string) => {
    try {
      setIsConnecting(providerId);

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

          // Connect to WalletConnect (which will show Vera Wallet in the modal)
          await walletConnectWallet.connect();

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

          // Connect to the wallet
          await wallet.connect();

          toast({
            title: "Wallet Connected",
            description: `Successfully connected to ${wallet.metadata.name}`,
          });
        }
      } else if (isEVM) {
        // For EVM networks, we would need to implement EVM wallet connection
        // For now, show a message that EVM wallets are not yet implemented
        toast({
          title: "EVM Wallets Coming Soon",
          description:
            "EVM wallet integration is not yet implemented. Please switch to an AVM network.",
          variant: "destructive",
        });
        return;
      }

      onClose();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDownloadWallet = (downloadUrl: string) => {
    window.open(downloadUrl, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-md p-6">
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
