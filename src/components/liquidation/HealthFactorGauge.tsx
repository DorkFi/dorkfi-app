
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import RiskMeterTooltip from './RiskMeterTooltip';

interface HealthFactorGaugeProps {
  healthFactor: number;
}

const getHealthFactorColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'text-destructive';
  if (healthFactor <= 1.1) return 'text-orange-500';
  if (healthFactor <= 1.2) return 'text-yellow-500';
  return 'text-green-500';
};

const getProgressColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'bg-destructive';
  if (healthFactor <= 1.1) return 'bg-orange-500';
  if (healthFactor <= 1.2) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getHealthFactorProgress = (healthFactor: number) => {
  // Map health factor to 0-100 scale with better distribution
  if (healthFactor <= 1.0) return Math.min(25, healthFactor * 25);
  if (healthFactor <= 1.1) return 25 + ((healthFactor - 1.0) / 0.1) * 25;
  if (healthFactor <= 1.2) return 50 + ((healthFactor - 1.1) / 0.1) * 25;
  return Math.min(100, 75 + ((healthFactor - 1.2) / 0.8) * 25);
};

const getRiskZoneMarkers = () => [
  { position: 25, label: '1.0', color: 'border-red-500' },
  { position: 50, label: '1.1', color: 'border-orange-500' },
  { position: 75, label: '1.2', color: 'border-yellow-500' },
];

export default function HealthFactorGauge({ healthFactor }: HealthFactorGaugeProps) {
  const progressValue = getHealthFactorProgress(healthFactor);
  const markers = getRiskZoneMarkers();
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Health Factor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RiskMeterTooltip healthFactor={healthFactor}>
          <div className="cursor-help">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                <span className={`${getHealthFactorColor(healthFactor)} ${healthFactor <= 1.0 ? 'animate-pulse' : ''}`}>
                  {healthFactor.toFixed(3)}
                </span>
              </span>
              <span className="text-sm font-medium">
                {healthFactor <= 1.0 ? 'CRITICAL' : 
                 healthFactor <= 1.1 ? 'DANGER' : 
                 healthFactor <= 1.2 ? 'MODERATE' : 'SAFE'}
              </span>
            </div>
            
            {/* Enhanced Progress Bar with Zone Indicators */}
            <div className="relative">
              <div className="h-4 w-full bg-gradient-to-r from-red-200 via-orange-200 via-yellow-200 to-green-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${getProgressColor(healthFactor)}`}
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              
              {/* Zone Markers */}
              {markers.map((marker, index) => (
                <div
                  key={index}
                  className={`absolute top-0 h-4 w-0.5 ${marker.color}`}
                  style={{ left: `${marker.position}%` }}
                />
              ))}
            </div>
            
            {/* Zone Labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span className="text-destructive">0.0 Critical</span>
              <span className="text-orange-500">1.0</span>
              <span className="text-yellow-500">1.2</span>
              <span className="text-green-500">2.0+ Safe</span>
            </div>
          </div>
        </RiskMeterTooltip>
      </CardContent>
    </Card>
  );
}
