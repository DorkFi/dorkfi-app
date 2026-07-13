import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserNFTs, UserNFT } from '@/hooks/useUserNFTs';
import { useNameOwnership } from '@/hooks/useNameOwnership';
import { useNetwork } from '@/contexts/NetworkContext';
import { useWallet } from '@txnlab/use-wallet-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Image as ImageIcon, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { getDorkNftMarketplaceLinks } from '@/config/dorkNftMarketplaceLinks';

interface NFTSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNFT: (nft: UserNFT) => void;
  onConfirmNFT?: (nft: UserNFT) => Promise<void>;
  currentImageUrl?: string;
}

const NFTSelectionModal: React.FC<NFTSelectionModalProps> = ({
  open,
  onOpenChange,
  onSelectNFT,
  onConfirmNFT,
  currentImageUrl,
}) => {
  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();
  const { nfts, isLoading: isLoadingNFTs, error: nftError, refetch: refetchNFTs } = useUserNFTs(activeAccount?.address || null);
  const { ownsName, isLoading: isLoadingName, refetch: refetchName } = useNameOwnership(activeAccount?.address);
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Algorand users set a Dork NFT PFP directly from their bridged ASAs — no enVoi (.voi) name required.
  const isAlgorand = currentNetwork === "algorand-mainnet";
  const requiresName = !isAlgorand;
  const isLoading = isLoadingNFTs || (requiresName && isLoadingName);
  const hasNFTs = nfts && nfts.length > 0;
  const meetsRequirements = (isAlgorand || ownsName) && hasNFTs;
  const marketplaceLinks = getDorkNftMarketplaceLinks(currentNetwork);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchNFTs(), refetchName()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelect = async () => {
    if (!selectedNFT) return;

    // If onConfirmNFT is provided, handle transaction flow
    if (onConfirmNFT) {
      setIsConfirming(true);
      try {
        // User will sign transaction in this handler
        await onConfirmNFT(selectedNFT);
        
        // After transaction is confirmed, update UI optimistically
        onSelectNFT(selectedNFT);
        onOpenChange(false);
        setSelectedNFT(null);
      } catch (error) {
        console.error('Error confirming NFT selection:', error);
        // Don't close modal on error, let user try again
      } finally {
        setIsConfirming(false);
      }
    } else {
      // Fallback to direct selection if no transaction handler
      onSelectNFT(selectedNFT);
      onOpenChange(false);
      setSelectedNFT(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl lg:max-w-3xl max-h-[80vh] overflow-y-auto p-6 relative [&>button:has(span.sr-only)]:hidden">
        <DialogHeader className="pb-4">
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Customize your profile image with an NFT from your collection
          </DialogDescription>
        </DialogHeader>
        
        {/* Refresh button in top-right corner */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="absolute top-4 right-4 h-8 w-8"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        <div className="px-2">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="w-full aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : !meetsRequirements ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-orange-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Requirements Not Met</h3>
              <p className="text-muted-foreground mb-4">
                To customize your profile, you need to meet the following requirements:
              </p>
              <div className="space-y-2 text-left max-w-md mx-auto mb-6">
                {requiresName && (
                <div className={`p-3 rounded-lg ${
                  ownsName ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {ownsName ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={ownsName ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      Own a name (enVoi naming service)
                    </span>
                  </div>
                  {!ownsName && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => window.open('https://app.envoi.sh/', '_blank', 'noopener,noreferrer')}
                      >
                        Claim Your Name
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
                )}
                <div className={`p-3 rounded-lg ${
                  hasNFTs ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {hasNFTs ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={hasNFTs ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      Have an NFT in a supported collection
                    </span>
                  </div>
                  {!hasNFTs && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {marketplaceLinks.map(({ id, label, url }) => (
                        <Button
                          key={id}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        >
                          {label}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : nftError ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">Error loading NFTs: {nftError}</p>
              <p className="text-sm text-muted-foreground">
                Make sure you have NFTs in your wallet
              </p>
            </div>
          ) : !nfts || nfts.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No NFTs found in your wallet</p>
              <p className="text-sm text-muted-foreground">
                NFTs you own will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                {nfts.map((nft) => {
                  const isSelected = selectedNFT?.contractId === nft.contractId && selectedNFT?.tokenId === nft.tokenId;
                  const isCurrent = currentImageUrl && nft.imageUrl === currentImageUrl;
                  
                  return (
                    <div
                      key={`${nft.contractId}-${nft.tokenId}`}
                      className={`relative rounded-lg border-2 transition-all ${
                        isConfirming
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary ring-offset-2'
                          : isCurrent
                          ? 'border-green-500'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                      }`}
                      onClick={() => !isConfirming && setSelectedNFT(nft)}
                    >
                      <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800">
                        {nft.imageUrl ? (
                          <img
                            src={nft.imageUrl}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to placeholder if image fails to load
                              (e.currentTarget as HTMLImageElement).src = '/lovable-uploads/dork_health_placeholder_v2.png';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                            Current
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-sm font-medium truncate">{nft.name}</p>
                        {nft.collectionName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {nft.collectionName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-6 mt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setSelectedNFT(null);
                  }}
                  disabled={isConfirming}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSelect}
                  disabled={!selectedNFT || isConfirming}
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Select NFT'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NFTSelectionModal;

