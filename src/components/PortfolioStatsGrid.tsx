
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, Coins, TrendingUp, DollarSign } from "lucide-react";

interface PortfolioStatsGridProps {
  userStats: {
    totalDeposits: number;
    totalBorrows: number;
    healthFactor: number;
    netWorth: number;
    netAPY: number;
  }
}

const PortfolioStatsGrid: React.FC<PortfolioStatsGridProps> = ({ userStats }) => (
  <TooltipProvider>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 hover:border-ocean-teal/40 transition-all hover:scale-105 shadow-md">
      <CardHeader className="pb-2 md:pb-3 text-center">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-center gap-2 text-slate-600 dark:text-muted-foreground">
          <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-whale-gold" />
          <span className="hidden sm:inline">Total Deposits</span>
          <span className="sm:hidden">Deposits</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-lg md:text-2xl font-bold text-slate-800 dark:text-white">${userStats.totalDeposits >= 1 ? Math.round(userStats.totalDeposits).toLocaleString() : userStats.totalDeposits.toFixed(2)}</div>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Latest</p>
      </CardContent>
    </Card>
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 hover:border-ocean-teal/40 transition-all hover:scale-105 shadow-md">
      <CardHeader className="pb-2 md:pb-3 text-center">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-center gap-2 text-slate-600 dark:text-muted-foreground">
          <ArrowUp className="w-3 h-3 md:w-4 md:h-4 text-whale-gold" />
          <span className="hidden sm:inline">Total Borrows</span>
          <span className="sm:hidden">Borrows</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-lg md:text-2xl font-bold text-slate-800 dark:text-white">${userStats.totalBorrows >= 1 ? Math.round(userStats.totalBorrows).toLocaleString() : userStats.totalBorrows.toFixed(2)}</div>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Latest</p>
      </CardContent>
    </Card>
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 hover:border-ocean-teal/40 transition-all hover:scale-105 shadow-md">
      <CardHeader className="pb-2 md:pb-3 text-center">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-center gap-2 text-slate-600 dark:text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <Coins className="w-3 h-3 md:w-4 md:h-4 text-whale-gold" />
                <span className="hidden sm:inline">Health Factor</span>
                <span className="sm:hidden">Health</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Measures your position's safety. Values above 1 are safe, below 1 risk liquidation. Higher is safer.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-lg md:text-2xl font-bold text-whale-gold">{userStats.healthFactor.toFixed(2)}</div>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Safe</p>
      </CardContent>
    </Card>
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 hover:border-ocean-teal/40 transition-all hover:scale-105 shadow-md">
      <CardHeader className="pb-2 md:pb-3 text-center">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-center gap-2 text-slate-600 dark:text-muted-foreground">
          <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-whale-gold" />
          <span className="hidden sm:inline">Net APY</span>
          <span className="sm:hidden">APY</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-lg md:text-2xl font-bold text-whale-gold">{userStats.netAPY.toFixed(2)}%</div>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Current rate</p>
      </CardContent>
    </Card>
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 hover:border-ocean-teal/40 transition-all hover:scale-105 shadow-md col-span-2 lg:col-span-1">
      <CardHeader className="pb-2 md:pb-3 text-center">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-center gap-2 text-slate-600 dark:text-muted-foreground">
          <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-whale-gold" />
          <span className="hidden sm:inline">Net Worth</span>
          <span className="sm:hidden">Worth</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-lg md:text-2xl font-bold text-whale-gold">${userStats.netWorth >= 1 ? Math.round(userStats.netWorth).toLocaleString() : userStats.netWorth.toFixed(2)}</div>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Portfolio value</p>
      </CardContent>
    </Card>
    </div>
  </TooltipProvider>
);

export default PortfolioStatsGrid;
