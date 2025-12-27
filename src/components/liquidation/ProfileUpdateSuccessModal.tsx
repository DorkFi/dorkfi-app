import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download } from 'lucide-react';

interface TopAsset {
  asset: string;
  icon: string;
  value: number;
  apy?: number;
}

interface ProfileUpdateSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarImage?: string;
  healthFactor: number | null;
  deposits?: TopAsset[];
  borrows?: TopAsset[];
  netLTV: number;
  addressName?: string | null;
}

const ProfileUpdateSuccessModal: React.FC<ProfileUpdateSuccessModalProps> = ({
  open,
  onOpenChange,
  avatarImage,
  healthFactor,
  deposits = [],
  borrows = [],
  netLTV,
  addressName,
}) => {
  // Sort deposits and borrows by value (descending) - get top asset
  const sortedDeposits = [...deposits].sort((a, b) => b.value - a.value);
  const sortedBorrows = [...borrows].sort((a, b) => b.value - a.value);

  // Get top assets (highest value)
  const selectedDeposit = sortedDeposits.length > 0 ? sortedDeposits[0] : null;
  const selectedBorrow = sortedBorrows.length > 0 ? sortedBorrows[0] : null;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleShare = () => {
    const healthFactorText = healthFactor !== null 
      ? healthFactor >= 2.0 
        ? 'Excellent' 
        : healthFactor >= 1.5 
        ? 'Good' 
        : healthFactor >= 1.2 
        ? 'Fair' 
        : 'At Risk'
      : 'N/A';
    
    const favoriteDepositText = selectedDeposit ? selectedDeposit.asset : 'N/A';
    const favoriteBorrowText = selectedBorrow ? selectedBorrow.asset : 'N/A';
    
    const text = `Just updated my DorkFi profile! 🐟\n\n` +
      `Health Factor: ${healthFactor !== null ? healthFactor.toFixed(2) : 'N/A'} (${healthFactorText})\n` +
      `Favorite Deposit: ${favoriteDepositText}\n` +
      `Favorite Borrow: ${favoriteBorrowText}\n` +
      `Net LTV: ${netLTV.toFixed(1)}%\n\n` +
      `Update your profile with Dork, DorkV2, or Chub NFTs today! 🚀\n\n` +
      `https://app.dork.fi/\n\n` +
      `#DorkFi #DeFi #Algorand #VOI`;
    
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getHealthFactorStatus = () => {
    if (healthFactor === null) return { text: 'N/A', color: 'text-gray-400' };
    if (healthFactor >= 2.0) return { text: 'Excellent', color: 'text-green-400' };
    if (healthFactor >= 1.5) return { text: 'Good', color: 'text-blue-400' };
    if (healthFactor >= 1.2) return { text: 'Fair', color: 'text-yellow-400' };
    return { text: 'At Risk', color: 'text-red-400' };
  };

  const status = getHealthFactorStatus();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageContainerRef.current || !avatarImage) return;

    setIsDownloading(true);
    try {
      // Load the avatar image first - try multiple approaches for CORS
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          
          // Try with CORS first
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            // Verify image actually loaded
            if (img.width > 0 && img.height > 0) {
              resolve(img);
            } else {
              reject(new Error('Image has zero dimensions'));
            }
          };
          
          img.onerror = () => {
            // Fallback: try without CORS
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              if (fallbackImg.width > 0 && fallbackImg.height > 0) {
                resolve(fallbackImg);
              } else {
                reject(new Error('Fallback image has zero dimensions'));
              }
            };
            fallbackImg.onerror = () => reject(new Error('Failed to load avatar image'));
            fallbackImg.src = src;
          };
          
          img.src = src;
        });
      };

      const avatarImg = await loadImage(avatarImage);
      console.log('Avatar image loaded:', avatarImg.width, 'x', avatarImg.height);

      // Get container dimensions
      const container = imageContainerRef.current;
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      const scale = 2; // Higher quality
      const canvasWidth = width * scale;
      const canvasHeight = height * scale;

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Fill with a fallback color first (in case image doesn't draw)
      ctx.fillStyle = '#1e293b'; // dark slate background
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw avatar image first (background) - ensure it fills the canvas
      try {
        ctx.drawImage(avatarImg, 0, 0, canvasWidth, canvasHeight);
        console.log('Avatar image drawn to canvas');
      } catch (drawError) {
        console.error('Error drawing avatar image:', drawError);
        // Continue anyway - we have the fallback background
      }

      // Draw gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Wait for the avatar image to be fully loaded in the DOM and ensure it's visible
      const avatarImgElement = container.querySelector('img') as HTMLImageElement;
      
      if (avatarImgElement) {
        // Ensure image is visible (in case onError hid it)
        avatarImgElement.style.display = 'block';
        avatarImgElement.style.opacity = '1';
        avatarImgElement.style.visibility = 'visible';
        
        await new Promise((resolve, reject) => {
          if (avatarImgElement.complete && avatarImgElement.naturalHeight > 0) {
            resolve(avatarImgElement);
          } else {
            avatarImgElement.onload = () => resolve(avatarImgElement);
            avatarImgElement.onerror = () => reject(new Error('Avatar image failed to load'));
            setTimeout(() => reject(new Error('Avatar image load timeout')), 10000);
          }
        });
      }

      // Now use html2canvas to capture only the overlay content (text/metrics)
      const html2canvas = (await import('html2canvas')).default;
      
      // Find the overlay element (the absolute positioned div with text)
      const overlayElement = container.querySelector('.absolute.inset-0') as HTMLElement;
      
      if (!overlayElement) {
        throw new Error('Overlay element not found');
      }

      // Capture only the overlay (text and metrics) - not the background image
      const overlayCanvas = await html2canvas(overlayElement, {
        backgroundColor: null,
        scale: scale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        width: width,
        height: height,
      });

      // Create final composite canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvasWidth;
      finalCanvas.height = canvasHeight;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) {
        throw new Error('Failed to get final canvas context');
      }

      // Draw the background (avatar + gradient) first - this is our manually drawn image
      finalCtx.drawImage(canvas, 0, 0);
      
      // Then draw only the overlay content on top (text, metrics, etc.) - no background
      finalCtx.drawImage(overlayCanvas, 0, 0);

      // Use the final composite canvas
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          setIsDownloading(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dorkfi-profile-${addressName || 'portfolio'}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloading(false);
      }, 'image/png');

    } catch (error) {
      console.error('Error downloading image:', error);
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <DialogTitle>Profile Updated Successfully!</DialogTitle>
          </div>
          <DialogDescription>
            Your profile NFT has been set. Share your portfolio with the community!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Health Factor Image with Overlay */}
          {avatarImage && (
            <div 
              ref={imageContainerRef}
              data-container="true"
              className="relative w-full aspect-square max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-ocean-teal/30 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
            >
              <img
                src={avatarImage}
                alt="Profile NFT"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                style={{ display: 'block' }}
                onError={(e) => {
                  console.error('Avatar image failed to load:', avatarImage);
                  // Don't hide it - keep it visible for download
                  // e.currentTarget.style.display = 'none';
                }}
                onLoad={(e) => {
                  // Image loaded successfully - ensure it's visible
                  const img = e.currentTarget;
                  img.style.display = 'block';
                  img.style.opacity = '1';
                  img.style.visibility = 'visible';
                }}
              />
              
              {/* Overlay with Portfolio Summary */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 flex flex-col justify-between p-6">
                {/* Name at top right */}
                {addressName && (
                  <div className="flex justify-end">
                    <div className="text-white text-xl font-bold drop-shadow-lg">
                      {addressName}
                    </div>
                  </div>
                )}

                {/* Portfolio Highlights Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Health Factor */}
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                    <div className="text-[10px] text-white/80 mb-0.5">Health Factor</div>
                    <div className="text-xl font-bold text-white leading-tight">
                      {healthFactor !== null ? healthFactor.toFixed(2) : 'N/A'}
                    </div>
                    <div className={`text-[10px] font-medium leading-tight ${status.color === 'text-green-400' ? 'text-green-300' : status.color === 'text-blue-400' ? 'text-blue-300' : status.color === 'text-yellow-400' ? 'text-yellow-300' : status.color === 'text-red-400' ? 'text-red-300' : 'text-white/60'}`}>
                      {status.text}
                    </div>
                  </div>

                  {/* Net LTV */}
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                    <div className="text-[10px] text-white/80 mb-0.5">Net LTV</div>
                    <div className="text-xl font-bold text-white leading-tight">
                      {netLTV.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-white/60 leading-tight">
                      Loan-to-Value
                    </div>
                  </div>

                  {/* Favorite Deposit */}
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                    <div className="text-[10px] text-white/80 mb-0.5">Favorite Deposit</div>
                    {selectedDeposit ? (
                      <div className="flex items-center gap-1">
                        {selectedDeposit.icon && (
                          <img
                            src={selectedDeposit.icon}
                            alt={selectedDeposit.asset}
                            className="w-5 h-5 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="text-sm font-semibold text-white leading-tight">{selectedDeposit.asset}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-white/60 leading-tight">No deposits</div>
                    )}
                  </div>

                  {/* Favorite Borrow */}
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                    <div className="text-[10px] text-white/80 mb-0.5">Favorite Borrow</div>
                    {selectedBorrow ? (
                      <div className="flex items-center gap-1">
                        {selectedBorrow.icon && (
                          <img
                            src={selectedBorrow.icon}
                            alt={selectedBorrow.asset}
                            className="w-5 h-5 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="text-sm font-semibold text-white leading-tight">{selectedBorrow.asset}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-white/60 leading-tight">No borrows</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Share and Download Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleShare}
                className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
                size="lg"
              >
                Share on X
              </Button>
              <Button
                onClick={handleDownload}
                disabled={!avatarImage || isDownloading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileUpdateSuccessModal;

