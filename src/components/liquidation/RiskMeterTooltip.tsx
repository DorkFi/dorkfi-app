
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, TrendingUp, Info } from 'lucide-react';

interface RiskMeterTooltipProps {
  healthFactor: number;
  children: React.ReactNode;
}

const getRiskZoneInfo = (healthFactor: number) => {
  if (healthFactor <= 1.0) {
    return {
      zone: 'CRITICAL',
      color: 'text-red-400',
      bgColor: 'bg-red-500/30',
      borderColor: 'border-red-400/50',
      icon: AlertTriangle,
      description: 'Position can be liquidated immediately',
      recommendations: [
        'Add collateral immediately',
        'Repay debt to improve health factor',
        'Consider emergency liquidation prevention'
      ],
      nextThreshold: 1.05,
      nextThresholdLabel: 'Danger Zone'
    };
  } else if (healthFactor <= 1.1) {
    return {
      zone: 'DANGER',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/30',
      borderColor: 'border-orange-400/50',
      icon: AlertTriangle,
      description: 'High risk of liquidation within 24 hours',
      recommendations: [
        'Monitor position closely',
        'Prepare to add collateral',
        'Consider reducing leverage'
      ],
      nextThreshold: 1.2,
      nextThresholdLabel: 'Moderate Risk'
    };
  } else if (healthFactor <= 1.2) {
    return {
      zone: 'MODERATE',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/30',
      borderColor: 'border-yellow-400/50',
      icon: TrendingUp,
      description: 'Moderate risk - monitor regularly',
      recommendations: [
        'Review position weekly',
        'Set up health factor alerts',
        'Consider risk management strategies'
      ],
      nextThreshold: 1.5,
      nextThresholdLabel: 'Safe Harbors'
    };
  } else {
    return {
      zone: 'SAFE',
      color: 'text-green-400',
      bgColor: 'bg-green-500/30',
      borderColor: 'border-green-400/50',
      icon: Shield,
      description: 'Position is healthy and well-collateralized',
      recommendations: [
        'Position is secure',
        'Monitor for market changes',
        'Consider optimization opportunities'
      ],
      nextThreshold: null,
      nextThresholdLabel: null
    };
  }
};

export default function RiskMeterTooltip({ healthFactor, children }: RiskMeterTooltipProps) {
  const riskInfo = getRiskZoneInfo(healthFactor);
  const Icon = riskInfo.icon;
  
  const distanceToNext = riskInfo.nextThreshold 
    ? ((riskInfo.nextThreshold - healthFactor) / riskInfo.nextThreshold * 100).toFixed(1)
    : null;

  return (
    <div className="relative w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          className={`max-w-xs p-5 bg-popover text-popover-foreground border shadow-xl ring-1 ${riskInfo.borderColor.replace('border-', 'ring-')}`}
          side="right"
          align="center"
        >
          
          <div className="space-y-4 relative">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${riskInfo.color}`} />
              <Badge variant="outline" className={`${riskInfo.color} border-current font-semibold`}>
                {riskInfo.zone}
              </Badge>
            </div>
            
            {/* Health Factor */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Health Factor</span>
              </div>
              <div className={`text-2xl font-bold ${riskInfo.color}`}>
                {healthFactor.toFixed(3)}
              </div>
            </div>
            
            {/* Description */}
            <div className="bg-muted border border-border rounded-md p-3 -mx-1">
              <p className="text-sm text-foreground font-medium">
                {riskInfo.description}
              </p>
            </div>
            
            {/* Distance to next threshold */}
            {distanceToNext && riskInfo.nextThresholdLabel && (
              <div className="text-sm bg-muted border border-border rounded-md p-3 -mx-1">
                <span className="text-muted-foreground">To reach </span>
                <span className="font-semibold text-foreground">{riskInfo.nextThresholdLabel}</span>
                <span className="text-muted-foreground">: </span>
                <span className="font-semibold text-foreground">{distanceToNext}% improvement needed</span>
              </div>
            )}
            
            {/* Recommendations */}
            <div>
              <div className="text-sm font-semibold mb-2 text-foreground">Recommendations:</div>
              <ul className="text-sm space-y-2">
                {riskInfo.recommendations.map((rec, index) => (
                  <li key={index} className="text-muted-foreground flex items-start">
                    <span className="text-foreground mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
