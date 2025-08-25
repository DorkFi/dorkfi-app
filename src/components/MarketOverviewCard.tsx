
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface MarketOverviewCardProps {
  marketStats: {
    totalValueLocked: number;
    totalBorrowed: number;
    availableLiquidity: number;
    activeUsers: number;
  }
}

const MarketOverviewCard: React.FC<MarketOverviewCardProps> = ({ marketStats }) => (
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
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Total Value Locked</p>
          <p className="text-xl md:text-2xl font-bold text-whale-gold">
            ${marketStats.totalValueLocked.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Total Borrowed</p>
          <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
            ${marketStats.totalBorrowed.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Available Liquidity</p>
          <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
            ${marketStats.availableLiquidity.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Active Users</p>
          <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
            {marketStats.activeUsers.toLocaleString()}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default MarketOverviewCard;
