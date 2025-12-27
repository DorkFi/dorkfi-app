import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

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

  const getHealthFactorStatus = () => {
    if (healthFactor === null) return { text: 'N/A', color: 'text-gray-400' };
    if (healthFactor >= 2.0) return { text: 'Excellent', color: 'text-green-400' };
    if (healthFactor >= 1.5) return { text: 'Good', color: 'text-blue-400' };
    if (healthFactor >= 1.2) return { text: 'Fair', color: 'text-yellow-400' };
    return { text: 'At Risk', color: 'text-red-400' };
  };

  const status = getHealthFactorStatus();
  const [showShareView, setShowShareView] = useState(false);
  const confettiIntervalRef = useRef<number | null>(null);

  // Start continuous confetti when share view is shown
  useEffect(() => {
    if (showShareView && avatarImage) {
      // Add global style to position confetti canvas behind modal content
      const styleId = 'confetti-behind-modal';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          canvas[style*="pointer-events: none"] {
            z-index: 40 !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Style confetti canvas to be behind content
      const styleConfettiCanvas = () => {
        const canvases = document.querySelectorAll('canvas[style*="pointer-events: none"]');
        canvases.forEach((canvas) => {
          const htmlCanvas = canvas as HTMLCanvasElement;
          htmlCanvas.style.zIndex = '40';
          htmlCanvas.style.position = 'fixed';
        });
      };

      // Initial burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        gravity: 1.5, // Increased gravity for faster falling
        ticks: 200, // Particles last longer to see the effect
        scalar: 2, // Make confetti 2x bigger
        colors: ['#1DA1F2', '#00D4FF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      });
      
      // Style the canvas after it's created
      setTimeout(styleConfettiCanvas, 0);

      // Continuous confetti
      const interval = setInterval(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          gravity: 1.5, // Increased gravity for faster falling
          ticks: 200,
          scalar: 2, // Make confetti 2x bigger
          colors: ['#1DA1F2', '#00D4FF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          gravity: 1.5, // Increased gravity for faster falling
          ticks: 200,
          scalar: 2, // Make confetti 2x bigger
          colors: ['#1DA1F2', '#00D4FF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
        });
        // Re-style canvas in case new ones are created
        styleConfettiCanvas();
      }, 300);

      confettiIntervalRef.current = interval;

      return () => {
        if (confettiIntervalRef.current) {
          clearInterval(confettiIntervalRef.current);
          confettiIntervalRef.current = null;
        }
        // Remove style tag
        const styleTag = document.getElementById(styleId);
        if (styleTag) {
          styleTag.remove();
        }
        // Reset confetti
        confetti.reset();
      };
    } else {
      // Stop confetti when share view is closed
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      // Remove style tag
      const styleTag = document.getElementById('confetti-behind-modal');
      if (styleTag) {
        styleTag.remove();
      }
      confetti.reset();
    }
  }, [showShareView, avatarImage]);

  const handleShare = () => {
    // First show the enlarged view
    setShowShareView(true);
    
    // Then open Twitter after a brief delay
    setTimeout(() => {
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
    }, 300);
  };

  // Reset share view when modal closes
  useEffect(() => {
    if (!open) {
      setShowShareView(false);
      // Stop confetti when modal closes
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      confetti.reset();
    }
  }, [open]);

  // Render the enlarged share view
  if (showShareView && avatarImage) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl lg:max-w-3xl p-0 overflow-hidden [&>button:has(span.sr-only)]:hidden relative z-50">
          <div className="relative w-full aspect-square max-w-full z-10">
            <img
              src={avatarImage}
              alt="Profile NFT"
              className="absolute inset-0 w-full h-full object-cover opacity-95 z-0"
              loading="eager"
              decoding="sync"
              onError={(e) => {
                console.error('Failed to load avatar image:', avatarImage);
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
              onLoad={() => {
                console.log('Avatar image loaded successfully:', avatarImage);
              }}
            />
            
            {/* Overlay with Portfolio Summary */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 flex flex-col justify-between p-6 lg:p-8 z-20">
              {/* Name at top right */}
              {addressName && (
                <div className="flex justify-end">
                  <div className="text-white text-2xl lg:text-3xl font-bold drop-shadow-lg">
                    {addressName}
                  </div>
                </div>
              )}

              {/* Portfolio Highlights Grid */}
              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                {/* Health Factor */}
                <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/20">
                  <div className="text-xs lg:text-sm text-white/80 mb-0.5">Health Factor</div>
                  <div className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                    {healthFactor !== null ? healthFactor.toFixed(2) : 'N/A'}
                  </div>
                  <div className={`text-xs lg:text-sm font-medium leading-tight ${status.color === 'text-green-400' ? 'text-green-300' : status.color === 'text-blue-400' ? 'text-blue-300' : status.color === 'text-yellow-400' ? 'text-yellow-300' : status.color === 'text-red-400' ? 'text-red-300' : 'text-white/60'}`}>
                    {status.text}
                  </div>
                </div>

                {/* Net LTV */}
                <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/20">
                  <div className="text-xs lg:text-sm text-white/80 mb-0.5">Net LTV</div>
                  <div className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                    {netLTV.toFixed(1)}%
                  </div>
                  <div className="text-xs lg:text-sm text-white/60 leading-tight">
                    Loan-to-Value
                  </div>
                </div>

                {/* Favorite Deposit */}
                <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/20">
                  <div className="text-xs lg:text-sm text-white/80 mb-0.5">Favorite Deposit</div>
                  {selectedDeposit ? (
                    <div className="flex items-center gap-1.5">
                      {selectedDeposit.icon && (
                        <img
                          src={selectedDeposit.icon}
                          alt={selectedDeposit.asset}
                          className="w-6 h-6 lg:w-8 lg:h-8 rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="text-lg lg:text-xl font-semibold text-white leading-tight">{selectedDeposit.asset}</div>
                    </div>
                  ) : (
                    <div className="text-sm lg:text-base text-white/60 leading-tight">No deposits</div>
                  )}
                </div>

                {/* Favorite Borrow */}
                <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/20">
                  <div className="text-xs lg:text-sm text-white/80 mb-0.5">Favorite Borrow</div>
                  {selectedBorrow ? (
                    <div className="flex items-center gap-1.5">
                      {selectedBorrow.icon && (
                        <img
                          src={selectedBorrow.icon}
                          alt={selectedBorrow.asset}
                          className="w-6 h-6 lg:w-8 lg:h-8 rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="text-lg lg:text-xl font-semibold text-white leading-tight">{selectedBorrow.asset}</div>
                    </div>
                  ) : (
                    <div className="text-sm lg:text-base text-white/60 leading-tight">No borrows</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              className="relative w-full aspect-square max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-ocean-teal/30 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
            >
              <img
                src={avatarImage}
                alt="Profile NFT"
                className="absolute inset-0 w-full h-full object-cover opacity-95 z-0"
                loading="eager"
                decoding="sync"
                onError={(e) => {
                  console.error('Failed to load avatar image:', avatarImage);
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Avatar image loaded successfully:', avatarImage);
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

          {/* Share Button */}
          <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={handleShare}
                className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
                size="lg"
              >
                Share on X
              </Button>
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

