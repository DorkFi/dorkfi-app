import React from 'react';
import { formatPercentageChange } from '@/utils/analyticsUtils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  refining?: boolean;
}

const KPICard = ({ title, value, change, subtitle, refining }: KPICardProps) => {
  const changeData =
    change != null && Number.isFinite(change)
      ? formatPercentageChange(change)
      : null;

  return (
    <div className="dorkfi-card-bg rounded-xl border border-border/40 p-4 card-hover transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="dorkfi-caption text-muted-foreground">
            {title}
            {subtitle && <span className="ml-1">({subtitle})</span>}
          </h3>
        </div>
        {changeData && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            changeData.isNeutral
              ? 'text-muted-foreground'
              : changeData.isPositive
                ? 'text-green-600'
                : 'text-red-600'
          }`}>
            {changeData.isNeutral ? null : changeData.isPositive ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {changeData.formatted}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <p
          className={`text-2xl font-bold dorkfi-text-primary transition-opacity ${
            refining ? 'opacity-60 animate-pulse' : ''
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
};

export default KPICard;

