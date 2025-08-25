
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface RiskOverviewCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
}

export default function RiskOverviewCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  subtitle 
}: RiskOverviewCardProps) {
  const getValueColor = (colorName: string) => {
    switch (colorName) {
      case 'ocean-teal':
        return 'text-whale-gold';
      case 'whale-gold':
        return 'text-whale-gold';
      case 'destructive':
        return 'text-destructive';
      default:
        return 'text-whale-gold';
    }
  };

  return (
    <Card className="deep-sea text-white border-ocean-teal/20 transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-whale-gold" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <div className={`text-2xl font-bold ${getValueColor(color)}`}>
            {value.toLocaleString()}
          </div>
          {subtitle && (
            <Badge variant="outline" className="text-xs border-ocean-teal/30 text-muted-foreground">
              {subtitle}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
