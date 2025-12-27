import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

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
  const [celebrationParticles, setCelebrationParticles] = useState<Array<{
    id: number;
    type: 'bubble' | 'coin' | 'fish';
    x: number;
    y: number;
    size: number;
    speed: number;
    delay: number;
    driftX: number;
    icon?: string;
  }>>([]);

  // Generate ocean/DeFi themed celebration particles when modal opens
  useEffect(() => {
    if (open) {
      const particles: Array<{
        id: number;
        type: 'bubble' | 'coin' | 'fish';
        x: number;
        y: number;
        size: number;
        speed: number;
        delay: number;
        driftX: number;
        icon?: string;
      }> = [];

      // Generate bubbles
      for (let i = 0; i < 15; i++) {
        particles.push({
          id: i,
          type: 'bubble',
          x: Math.random() * 100,
          y: 100 + Math.random() * 20,
          size: 8 + Math.random() * 12,
          speed: 0.3 + Math.random() * 0.4,
          delay: Math.random() * 2,
          driftX: (Math.random() - 0.5) * 100,
        });
      }

      // Generate floating coins/tokens (use deposit/borrow icons)
      const allAssets = [...deposits, ...borrows].filter(asset => asset.icon);
      for (let i = 0; i < Math.min(8, allAssets.length); i++) {
        const asset = allAssets[i];
        particles.push({
          id: 100 + i,
          type: 'coin',
          x: Math.random() * 100,
          y: 100 + Math.random() * 20,
          size: 24 + Math.random() * 16,
          speed: 0.2 + Math.random() * 0.3,
          delay: Math.random() * 2,
          driftX: (Math.random() - 0.5) * 100,
          icon: asset.icon,
        });
      }

      // Generate fish emojis
      for (let i = 0; i < 5; i++) {
        particles.push({
          id: 200 + i,
          type: 'fish',
          x: Math.random() * 100,
          y: 100 + Math.random() * 20,
          size: 20 + Math.random() * 10,
          speed: 0.25 + Math.random() * 0.25,
          delay: Math.random() * 2,
          driftX: (Math.random() - 0.5) * 100,
        });
      }

      setCelebrationParticles(particles);

      // Clear particles after animation completes
      const timer = setTimeout(() => {
        setCelebrationParticles([]);
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setCelebrationParticles([]);
    }
  }, [open, deposits, borrows]);

  // Add ocean/DeFi themed celebration animations
  useEffect(() => {
    if (open) {
      const styleId = 'ocean-defi-celebration-animations';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes ripple {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }
            100% {
              transform: scale(2.5);
              opacity: 0;
            }
          }
          
          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(29, 161, 242, 0.4),
                          0 0 40px rgba(0, 212, 255, 0.3),
                          0 0 60px rgba(79, 205, 196, 0.2);
            }
            50% {
              box-shadow: 0 0 30px rgba(29, 161, 242, 0.6),
                          0 0 60px rgba(0, 212, 255, 0.5),
                          0 0 90px rgba(79, 205, 196, 0.4);
            }
          }
          
          @keyframes pulse-scale {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.02);
            }
          }

          @keyframes bubble-rise {
            0% {
              transform: translateY(0) translateX(0) scale(0.8);
              opacity: 0.6;
            }
            50% {
              transform: translateY(-50vh) translateX(var(--drift-x, 0)) scale(1);
              opacity: 0.8;
            }
            100% {
              transform: translateY(-100vh) translateX(var(--drift-x, 0)) scale(0.6);
              opacity: 0;
            }
          }

          @keyframes coin-float {
            0% {
              transform: translateY(0) translateX(0) rotate(0deg) scale(0.8);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            50% {
              transform: translateY(-50vh) translateX(var(--drift-x, 0)) rotate(180deg) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateY(-100vh) translateX(var(--drift-x, 0)) rotate(360deg) scale(0.6);
              opacity: 0;
            }
          }

          @keyframes fish-swim {
            0% {
              transform: translateY(0) translateX(0) scaleX(1);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            50% {
              transform: translateY(-50vh) translateX(var(--drift-x, 0)) scaleX(1);
              opacity: 1;
            }
            51% {
              transform: translateY(-50vh) translateX(var(--drift-x, 0)) scaleX(-1);
            }
            100% {
              transform: translateY(-100vh) translateX(var(--drift-x, 0)) scaleX(-1);
              opacity: 0;
            }
          }

          @keyframes wave {
            0%, 100% {
              transform: translateX(0) translateY(0);
            }
            50% {
              transform: translateX(10px) translateY(-5px);
            }
          }
          
          .ripple-circle {
            position: absolute;
            border-radius: 50%;
            border: 2px solid;
            pointer-events: none;
            animation: ripple 2s ease-out infinite;
          }
          
          .ripple-circle-1 {
            border-color: rgba(29, 161, 242, 0.6);
            animation-delay: 0s;
          }
          
          .ripple-circle-2 {
            border-color: rgba(0, 212, 255, 0.5);
            animation-delay: 0.4s;
          }
          
          .ripple-circle-3 {
            border-color: rgba(79, 205, 196, 0.4);
            animation-delay: 0.8s;
          }
          
          .pulse-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          
          .pulse-scale {
            animation: pulse-scale 3s ease-in-out infinite;
          }

          .celebration-bubble {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(173, 216, 230, 0.6));
            border: 1px solid rgba(255, 255, 255, 0.3);
            pointer-events: none;
            animation: bubble-rise var(--duration, 4s) ease-out forwards;
            animation-delay: var(--delay, 0s);
            box-shadow: 0 0 10px rgba(173, 216, 230, 0.5);
          }

          .celebration-coin {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
            animation: coin-float var(--duration, 5s) ease-in-out forwards;
            animation-delay: var(--delay, 0s);
            filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.4));
          }

          .celebration-fish {
            position: absolute;
            pointer-events: none;
            animation: fish-swim var(--duration, 6s) ease-in-out forwards;
            animation-delay: var(--delay, 0s);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
          }

          .wave-effect {
            animation: wave 3s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }

      return () => {
        // Cleanup: remove style tag when component unmounts
        const styleTag = document.getElementById(styleId);
        if (styleTag && !open) {
          styleTag.remove();
        }
      };
    }
  }, [open]);

  const handleShare = () => {
    // First show the enlarged view
    setShowShareView(true);
    
    // Then open Twitter after a 2 second delay
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
    }, 3000);
  };

  // Reset share view when modal closes
  useEffect(() => {
    if (!open) {
      setShowShareView(false);
    }
  }, [open]);

  // Render the enlarged share view
  if (showShareView && avatarImage) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl lg:max-w-3xl p-0 overflow-hidden [&>button:has(span.sr-only)]:hidden relative z-50 pulse-glow">
          <div className="relative w-full aspect-square max-w-full z-10 pulse-scale overflow-hidden">
            {/* Ocean/DeFi Celebration Particles */}
            {celebrationParticles.map((particle) => {
              const duration = particle.type === 'bubble' ? 4 : particle.type === 'coin' ? 5 : 6;
              
              if (particle.type === 'bubble') {
                return (
                  <div
                    key={particle.id}
                    className="celebration-bubble"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  />
                );
              } else if (particle.type === 'coin' && particle.icon) {
                return (
                  <div
                    key={particle.id}
                    className="celebration-coin"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  >
                    <img
                      src={particle.icon}
                      alt="Token"
                      className="w-full h-full rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              } else if (particle.type === 'fish') {
                return (
                  <div
                    key={particle.id}
                    className="celebration-fish"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      fontSize: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  >
                    🐟
                  </div>
                );
              }
              return null;
            })}
            
            {/* Ripple effects */}
            <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
              <div className="ripple-circle ripple-circle-1 w-32 h-32 lg:w-40 lg:h-40"></div>
              <div className="ripple-circle ripple-circle-2 w-32 h-32 lg:w-40 lg:h-40"></div>
              <div className="ripple-circle ripple-circle-3 w-32 h-32 lg:w-40 lg:h-40"></div>
            </div>
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
          {/* Ocean/DeFi Celebration Particles */}
          <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {celebrationParticles.map((particle) => {
              const duration = particle.type === 'bubble' ? 4 : particle.type === 'coin' ? 5 : 6;
              
              if (particle.type === 'bubble') {
                return (
                  <div
                    key={particle.id}
                    className="celebration-bubble"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  />
                );
              } else if (particle.type === 'coin' && particle.icon) {
                return (
                  <div
                    key={particle.id}
                    className="celebration-coin"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  >
                    <img
                      src={particle.icon}
                      alt="Token"
                      className="w-full h-full rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              } else if (particle.type === 'fish') {
                return (
                  <div
                    key={particle.id}
                    className="celebration-fish"
                    style={{
                      left: `${particle.x}%`,
                      bottom: '0%',
                      fontSize: `${particle.size}px`,
                      '--duration': `${duration}s`,
                      '--delay': `${particle.delay}s`,
                      '--drift-x': `${particle.driftX}px`,
                    } as React.CSSProperties}
                  >
                    🐟
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Health Factor Image with Overlay */}
          {avatarImage && (
            <div 
              className="relative w-full aspect-square max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-ocean-teal/30 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 wave-effect"
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

