
import { H1, Body } from "@/components/ui/Typography";
import DorkFiCard from "@/components/ui/DorkFiCard";
import React from "react";

const MarketsHeroSection = () => {
  return (
    <DorkFiCard 
      hoverable
      className="relative text-center overflow-hidden p-6 md:p-8"
    >
      {/* Decorative elements */}
      {/* Birds - light mode only */}
      <div className="absolute top-6 left-10 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0s' }}>
        <img
           src="/lovable-uploads/bird_thinner.png"
          alt="Decorative DorkFi bird - top left"
          className="w-8 h-8 md:w-10 md:h-10 -rotate-6 select-none"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="absolute top-14 right-12 opacity-70 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0.5s' }}>
        <img
         src="/lovable-uploads/bird_thinner.png"
          alt="Decorative DorkFi bird - top right"
          className="w-7 h-7 md:w-9 md:h-9 rotate-3 select-none"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="absolute bottom-10 left-14 opacity-60 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '1s' }}>
        <img
          src="/lovable-uploads/bird_thinner.png"
          alt="Decorative DorkFi bird - bottom left"
          className="w-7 h-7 md:w-9 md:h-9 -rotate-2 select-none"
          loading="lazy"
          decoding="async"
        />
      </div>
      {/* Dark mode gold fish */}
      <div className="absolute top-4 left-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0s' }}>
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt="Decorative DorkFi gold fish - top left"
          className="w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] select-none"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="absolute top-12 right-12 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0.5s' }}>
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt="Decorative DorkFi gold fish - top right"
          className="w-[1.896563rem] h-[1.896563rem] md:w-[2.844844rem] md:h-[2.844844rem] -scale-x-100 select-none"
          loading="lazy"
          decoding="async"
        />
      </div>

      
      <div className="relative z-10">
        <H1 className="m-0 text-4xl md:text-5xl">
          <span className="hero-header">Markets</span>
        </H1>
        <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto">
          <span className="block md:inline md:whitespace-nowrap">
            Deposit tokens to earn interest. Need cash? Borrow without selling your crypto.
          </span>
          <br className="hidden md:block" />
          <span className="hidden sm:inline md:whitespace-nowrap">
            No banks. No middlemen. Just you and your wallet.
          </span>
        </Body>
      </div>
    </DorkFiCard>
  );
};

export default MarketsHeroSection;
