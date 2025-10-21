
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketOverviewCardProps {
  marketStats: {
    totalValueLocked: number;
    totalBorrowed: number;
    availableLiquidity: number;
    activeUsers: number;
  };
  isLoading?: boolean;
  error?: string | null;
}

// Utility function to format large numbers with appropriate suffixes
const formatLargeNumber = (value: number): string => {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
};

const MarketOverviewCard: React.FC<MarketOverviewCardProps> = ({ 
  marketStats, 
  isLoading = false, 
  error = null 
}) => {
  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200/50 dark:border-red-800/20 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2 text-red-800 dark:text-red-200">
            <Users className="w-5 h-5 text-red-600" />
            Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 dark:text-red-400">Failed to load market data</p>
            <p className="text-sm text-red-500 dark:text-red-500 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
    <CardHeader>
      <CardTitle className="text-lg md:text-xl flex items-center gap-2 text-slate-800 dark:text-white">
        <Users className="w-5 h-5 text-whale-gold" />
        Market Overview
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center gap-1">
            <DollarSign className="w-3 h-3" />
            Total Value Locked
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mx-auto mt-2" />
          ) : (
            <p className="text-xl md:text-2xl font-bold text-whale-gold">
              {formatLargeNumber(marketStats.totalValueLocked)}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Total Borrowed
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mx-auto mt-2" />
          ) : (
            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
              {formatLargeNumber(marketStats.totalBorrowed)}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center gap-1">
            <TrendingDown className="w-3 h-3" />
            Available Liquidity
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mx-auto mt-2" />
          ) : (
            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
              {formatLargeNumber(marketStats.availableLiquidity)}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center gap-1">
            <Users className="w-3 h-3" />
            Active Users
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-16 mx-auto mt-2" />
          ) : (
            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
              {marketStats.activeUsers.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
  );
};

export default MarketOverviewCard;
