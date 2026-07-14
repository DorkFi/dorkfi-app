import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserNFTs, UserNFT } from '@/hooks/useUserNFTs';
import { useNameOwnership } from '@/hooks/useNameOwnership';
import { useNetwork } from '@/contexts/NetworkContext';
import { useWallet } from '@txnlab/use-wallet-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Image as ImageIcon, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { filterUserNfts } from '@/components/liquidation/filterUserNfts';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Algorand users set a Dork NFT PFP directly from their bridged ASAs — no enVoi (.voi) name required.
  const isAlgorand = currentNetwork === "algorand-mainnet";
  const requiresName = !isAlgorand;
  const isLoading = isLoadingNFTs || (requiresName && isLoadingName);
  const hasNFTs = nfts && nfts.length > 0;
  const meetsRequirements = (isAlgorand || ownsName) && hasNFTs;
  const marketplaceLinks = getDorkNftMarketplaceLinks(currentNetwork);
  const showNftPicker = !isLoading && meetsRequirements && !nftError && !!nfts?.length;

  const filteredNfts = useMemo(
    () => filterUserNfts(nfts ?? [], searchQuery),
    [nfts, searchQuery]
  );

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedNFT(null);
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery('');
      setSelectedNFT(null);
    }
    onOpenChange(nextOpen);
  };

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
        handleOpenChange(false);
      } catch (error) {
        console.error('Error confirming NFT selection:', error);
        // Don't close modal on error, let user try again
      } finally {
        setIsConfirming(false);
      }
    } else {
      // Fallback to direct selection if no transaction handler
      onSelectNFT(selectedNFT);
      handleOpenChange(false);
    }
  };

  const renderNftCard = (nft: UserNFT) => {
    const isSelected =
      selectedNFT?.contractId === nft.contractId &&
      selectedNFT?.tokenId === nft.tokenId;
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
                (e.currentTarget as HTMLImageElement).src =
                  '/lovable-uploads/dork_health_placeholder_v2.png';
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
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          showNftPicker
            ? 'flex max-w-2xl lg:max-w-3xl max-h-[80vh] flex-col overflow-hidden p-0 relative [&>button:has(span.sr-only)]:hidden'
            : 'max-w-2xl lg:max-w-3xl max-h-[80vh] overflow-y-auto p-6 relative [&>button:has(span.sr-only)]:hidden'
        }
      >
        <DialogHeader className={showNftPicker ? 'shrink-0 px-6 pb-4 pt-6' : 'pb-4'}>
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

        {showNftPicker ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2 touch-pan-y">
              {filteredNfts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground mb-1">No NFTs match your search.</p>
                  <p className="text-sm text-muted-foreground">
                    Try a different name, collection, or token ID.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredNfts.map(renderNftCard)}
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 flex-row items-center gap-3 border-t bg-background/95 px-6 py-4 sm:justify-between">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or ID..."
                className="h-9 min-w-0 flex-1 sm:max-w-xs"
                aria-label="Search NFTs by name or ID"
              />
              <div className="ml-auto flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
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
            </DialogFooter>
          </>
        ) : (
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
                <div className="space-y-2 text-left max-w-2xl mx-auto mb-6">
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
                      <div className="mt-3 flex flex-col gap-4 sm:gap-5 md:grid md:grid-cols-3 md:items-stretch md:gap-3 lg:gap-4">
                        {marketplaceLinks.map(({ id, label, url, imageUrl }) => (
                          <div
                            key={id}
                            className="flex min-w-0 flex-col items-center gap-2 md:h-full"
                          >
                            <div className="mx-auto aspect-square w-[min(100%,42vw,10rem)] overflow-hidden rounded-lg border border-border/50 bg-muted/30 sm:w-[min(100%,36vw,11rem)] md:mx-0 md:w-full lg:max-w-none">
                              <img
                                src={imageUrl}
                                alt={`${label} collection`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src =
                                    "/lovable-uploads/dork_health_placeholder_v2.png";
                                }}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 w-[min(100%,42vw,10rem)] whitespace-nowrap px-3 text-xs sm:w-[min(100%,36vw,11rem)] md:mt-auto md:w-full md:px-2"
                              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                            >
                              <span className="truncate">{label}</span>
                              <ExternalLink className="!size-3 shrink-0" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
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
            ) : (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No NFTs found in your wallet</p>
                <p className="text-sm text-muted-foreground">
                  NFTs you own will appear here
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NFTSelectionModal;
