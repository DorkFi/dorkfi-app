
import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function ScrollTransitionCue() {
  return (
    <div className="relative w-full h-12 flex items-center justify-center">
      {/* Fade gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />
      
      {/* Scroll indicator */}
      <div className="relative z-10 flex flex-col items-center space-y-1 animate-bounce">
        <div className="text-xs text-muted-foreground font-medium">
          Liquidation Queue
        </div>
        <ChevronDown className="h-5 w-5 text-ocean-teal opacity-60" />
      </div>
    </div>
  );
}
