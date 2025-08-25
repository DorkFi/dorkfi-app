
import React from "react";
import { Button } from "@/components/ui/button";
import { H1, Body } from "@/components/ui/Typography";
import { ArrowRight } from "lucide-react";
import NFTMintModal from "./NFTMintModal";

interface DashboardHeroProps {
  nftMintModalOpen: boolean;
  setNFTMintModalOpen: (open: boolean) => void;
  mockWalletConnected: boolean;
  mintedSupply: number;
  onMint: () => void;
  onLearnMore: () => void;
  onExploreMarkets: () => void;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  nftMintModalOpen,
  setNFTMintModalOpen,
  mockWalletConnected,
  mintedSupply,
  onMint,
  onLearnMore,
  onExploreMarkets,
}) => (
  <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-[hsl(var(--deep-sea-navy))] dark:to-[hsl(var(--ocean-floor))] rounded-xl p-6 md:p-8 text-center overflow-hidden min-h-[300px] md:min-h-[360px] flex flex-col items-center justify-center border border-gray-200/50 dark:border-ocean-teal/20 card-hover hover:border-ocean-teal/40 transition-all">
    {/* Background birds (light mode) and golden globes (dark mode) */}
    {/* Birds - light mode only */}
    <div className="absolute top-6 left-10 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden" style={{ animationDelay: '0s' }}>
      <img
        src="/lovable-uploads/bird_thinner.png"
        alt="Decorative DorkFi bird - top left"
        className="w-10 h-10 md:w-12 md:h-12 rotate-3 scale-[1.625] select-none"
        loading="lazy"
      />
    </div>
    <div className="absolute top-12 right-16 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden" style={{ animationDelay: '0.8s' }}>
      <img
        src="/lovable-uploads/bird_thinner.png"
        alt="Decorative DorkFi bird - top right"
        className="w-9 h-9 md:w-11 md:h-11 rotate-2 scale-[1.625] select-none"
        loading="lazy"
      />
    </div>

    {/* Additional birds for depth - light mode only */}
    <div className="absolute top-4 right-4 opacity-50 pointer-events-none z-0 animate-bubble-float dark:hidden" style={{ animationDelay: '2.4s' }}>
      <img
        src="/lovable-uploads/bird_thinner.png"
        alt="Decorative DorkFi bird - far top right"
        className="w-7 h-7 md:w-9 md:h-9 -rotate-2 scale-110 select-none"
        loading="lazy"
        decoding="async"
      />
    </div>

    {/* Original golden globes - dark mode only */}
      <img
        src="/lovable-uploads/DorkFi_gold_fish.png"
        alt="Decorative DorkFi gold fish - top left"
        className="absolute top-6 left-10 w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] opacity-90 pointer-events-none z-0 animate-bubble-float hidden dark:block"
        style={{ animationDelay: '0s' }}
        loading="lazy"
        decoding="async"
      />
      <div className="absolute top-12 right-16 scale-x-[-1]">
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt="Decorative DorkFi gold fish - top right"
          className="w-[1.896563rem] h-[1.896563rem] md:w-[2.844844rem] md:h-[2.844844rem] opacity-90 pointer-events-none z-0 animate-bubble-float hidden dark:block"
          style={{ animationDelay: '0.5s' }}
          loading="lazy"
          decoding="async"
        />
      </div>
    
      <div className="absolute top-4 right-4 scale-x-[-1]">
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt="Decorative DorkFi gold fish - far top right"
          className="w-[1.896563rem] h-[1.896563rem] md:w-[2.370703rem] md:h-[2.370703rem] opacity-90 pointer-events-none z-0 animate-bubble-float hidden dark:block"
          style={{ animationDelay: '2.4s' }}
          loading="lazy"
          decoding="async"
        />
      </div>

    {/* Main whale character - reduced size */}
    <div className="relative z-10 mb-4 md:mb-6">
      <img 
        src="/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png" 
        alt="DorkFi Whale with coins" 
        className="w-36 h-36 md:w-60 md:h-60 mx-auto animate-wave-motion"
      />
    </div>
    
    <div className="relative z-10 max-w-4xl mx-auto">
      <H1 className="m-0 mb-2 md:mb-3 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
        <span className="block text-navy-900 dark:text-bubble-white will-change-opacity">
          The Future of <span className="bg-black text-white px-2 py-1 rounded">Finance.</span>
        </span>
      </H1>
      <Body className="text-lg md:text-xl lg:text-2xl mb-4 md:mb-6 max-w-2xl mx-auto">
        Advanced DeFi Protocol on Voi Network
      </Body>
      {/* Action buttons - swapped order with tighter spacing */}
      <div className="flex flex-col sm:flex-row gap-4 md:gap-6 lg:gap-8 justify-center items-center mt-1">
        <Button
          size="lg"
          className="whale-button text-deep-navy font-bold px-6 py-3 sm:px-8 sm:py-3 md:px-10 md:py-4 lg:px-12 lg:py-4 text-base sm:text-lg md:text-xl rounded-xl sm:rounded-2xl shadow-whale hover:shadow-whale-hover transition-all duration-400 group will-change-transform focus-whale hover:scale-105 sm:hover:scale-110"
          onClick={onExploreMarkets}
        >
          Explore Markets
          <ArrowRight className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform duration-300" />
        </Button>
        <Button 
          size="lg" 
          className="whale-button text-deep-navy font-bold px-6 py-3 sm:px-8 sm:py-3 md:px-10 md:py-4 lg:px-12 lg:py-4 text-base sm:text-lg md:text-xl rounded-xl sm:rounded-2xl shadow-whale hover:shadow-whale-hover transition-all duration-400 group will-change-transform focus-whale hover:scale-105 sm:hover:scale-110"
          onClick={() => setNFTMintModalOpen(true)}
        >
          Mint a Free NFT
          <ArrowRight className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform duration-300" />
        </Button>
      </div>
    </div>
    {/* Background decorative elements - adjusted positions */}
    <div className="absolute bottom-6 left-6 w-8 h-8 md:w-12 md:h-12 rounded-full bg-highlight-aqua/20 animate-pulse"></div>
    <div className="absolute top-10 right-12 w-12 h-12 md:w-16 md:h-16 rounded-full bg-ocean-teal/10 animate-pulse" style={{ animationDelay: '1s' }}></div>
  </div>
);

export default DashboardHero;
