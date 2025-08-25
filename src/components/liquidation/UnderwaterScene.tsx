
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import RiskMeterTooltip from './RiskMeterTooltip';
import { useRiskLevel, getDepthTransform, getRiskIndicatorPosition } from '@/hooks/useRiskLevel';

interface UnderwaterSceneProps {
  healthFactor: number;
  dorkNftImage: string;
  underwaterBg: string;
}

const UnderwaterScene = ({
  healthFactor,
  dorkNftImage,
  underwaterBg
}: UnderwaterSceneProps) => {
  const riskLevel = useRiskLevel(healthFactor);

  return (
    <div className="relative">
      <div className="text-xl font-bold mb-4 text-center">
        Health Factor: 
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${riskLevel.color} cursor-help inline-flex items-center gap-1 ml-2`}>
              {healthFactor.toFixed(2)}
              <Info className="w-4 h-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Health Factor measures your position's safety. Values above 1.0 are safe, below 1.0 risk liquidation. Calculated as: (Collateral × Liquidation Threshold) ÷ Total Debt</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Underwater Scene Container */}
      <div className="relative h-80 rounded-lg overflow-hidden border border-ocean-teal/30">
        {/* Underwater Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${underwaterBg})`,
            transform: getDepthTransform(healthFactor)
          }}
        />
        
        {/* NFT Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative transition-transform duration-1000 ease-in-out">
            <img 
              src={dorkNftImage}
              alt="Dork NFT"
              className="w-32 h-32 rounded-full border-4 border-whale-gold shadow-lg"
              style={{
                transform: getDepthTransform(healthFactor)
              }}
            />
            
            {/* Underwater particles effect */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-4 w-1 h-1 bg-white/50 rounded-full animate-pulse"></div>
              <div className="absolute top-8 right-6 w-1 h-1 bg-white/30 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
              <div className="absolute bottom-4 left-8 w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Risk Level Indicator - FLIPPED */}
        <RiskMeterTooltip healthFactor={healthFactor}>
          <div className="absolute right-4 top-4 bottom-4 w-8 cursor-help">
            {/* Gradient bar - flipped so red is at top, green at bottom */}
            <div className="w-6 h-full bg-gradient-to-b from-red-500 via-orange-500 via-yellow-500 to-green-500 rounded-full relative">
              {/* Zone markers */}
              <div className="absolute right-7 top-[20%] text-xs text-red-400 font-bold">CRITICAL</div>
              <div className="absolute right-7 top-[40%] text-xs text-orange-400">DANGER</div>
              <div className="absolute right-7 top-[60%] text-xs text-yellow-400">MODERATE</div>
              <div className="absolute right-9 top-[80%] text-xs text-green-400 font-semibold">SAFE</div>
              
              {/* Moving indicator */}
              <div 
                className={`absolute w-10 h-3 -left-2 rounded-full border-2 border-white ${riskLevel.bg} transition-all duration-1000 ${healthFactor <= 1.0 ? 'animate-pulse' : ''}`}
                style={{
                  top: getRiskIndicatorPosition(healthFactor)
                }}
              >
                <div className={`w-full h-full rounded-full ${riskLevel.color.replace('text-', 'bg-')}`}></div>
              </div>
            </div>
          </div>
        </RiskMeterTooltip>
      </div>
      
      {/* Risk Label */}
      <div className="text-center mt-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${riskLevel.bg} ${riskLevel.color} ${healthFactor <= 1.0 ? 'animate-pulse' : ''}`}>
          {riskLevel.label}
        </span>
      </div>
    </div>
  );
};

export default UnderwaterScene;
