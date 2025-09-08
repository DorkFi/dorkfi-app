import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, CheckCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';
import { useToast } from '@/hooks/use-toast';

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
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Define wallet providers with their details
  const walletProviders: WalletProvider[] = [
    {
      id: 'kibisis',
      name: 'Kibisis',
      icon: '🔗',
      description: 'Connect with Kibisis wallet',
      isInstalled: true,
    },
    {
      id: 'lute',
      name: 'Lute',
      icon: '🔗',
      description: 'Connect with Lute wallet',
      isInstalled: true,
    },
  ];

  const handleConnectWallet = async (providerId: string) => {
    try {
      setIsConnecting(providerId);
      
      // Find the wallet from the wallets array
      const wallet = wallets.find(w => w.id === providerId);
      
      if (!wallet) {
        throw new Error('Wallet provider not found');
      }

      // Connect to the wallet
      await wallet.connect();
      
      toast({
        title: 'Wallet Connected',
        description: `Successfully connected to ${wallet.metadata.name}`,
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDownloadWallet = (downloadUrl: string) => {
    window.open(downloadUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-center">
            Connect Wallet
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Choose a wallet to connect to DorkFi
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {walletProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50 hover:border-ocean-teal/40 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ocean-teal to-whale-gold flex items-center justify-center text-white font-bold">
                  {provider.icon}
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
                    onClick={() => provider.downloadUrl && handleDownloadWallet(provider.downloadUrl)}
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

        <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <p className="text-xs text-muted-foreground text-center">
            By connecting a wallet, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;
