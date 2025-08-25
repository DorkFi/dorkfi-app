
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { shortenAddress } from '@/utils/addressUtils';

interface LiquidatorData {
  rank: number;
  walletAddress: string;
  totalUSDLiquidated: number;
  liquidationCount: number;
  successRate: number;
  weeklyChange: number;
}

const mockLiquidatorData: LiquidatorData[] = [
  {
    rank: 1,
    walletAddress: '0x742d35Cc6634C0532925a3b8D4Cc3d0102B2cF4b',
    totalUSDLiquidated: 1250000,
    liquidationCount: 87,
    successRate: 94.3,
    weeklyChange: 23.4
  },
  {
    rank: 2,
    walletAddress: '0x8ba1f109551bD432803012645Hac136c22C32F95',
    totalUSDLiquidated: 980000,
    liquidationCount: 64,
    successRate: 91.2,
    weeklyChange: 18.7
  },
  {
    rank: 3,
    walletAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    totalUSDLiquidated: 750000,
    liquidationCount: 52,
    successRate: 88.9,
    weeklyChange: -4.3
  },
  {
    rank: 4,
    walletAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    totalUSDLiquidated: 620000,
    liquidationCount: 41,
    successRate: 85.7,
    weeklyChange: 9.8
  },
  {
    rank: 5,
    walletAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    totalUSDLiquidated: 490000,
    liquidationCount: 33,
    successRate: 82.4,
    weeklyChange: 15.2
  }
];

export default function LiquidatorLeaderboard() {

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };


  const viewWallet = (address: string) => {
    // Open in a new tab - could be blockchain explorer
    window.open(`https://etherscan.io/address/${address}`, '_blank');
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800 dark:text-white mb-1">
          Whale Hunters
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top Liquidators by volume this week
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {mockLiquidatorData.map((liquidator) => (
          <div 
            key={liquidator.rank}
            className="group relative flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-200/50 dark:border-ocean-teal/10 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground">
                  #{liquidator.rank}
                </span>
                {liquidator.rank === 1 && (
                  <img 
                    src="/lovable-uploads/d649d920-5b9b-4eec-ae8e-682cb9223334.png" 
                    alt="DorkFi Whale" 
                    className="w-6 h-6 animate-wave-motion"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground">
                    {shortenAddress(liquidator.walletAddress)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(liquidator.totalUSDLiquidated)} • {liquidator.liquidationCount} liquidations
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className={`text-xs font-medium ${
                  liquidator.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {liquidator.weeklyChange >= 0 ? '+' : ''}{liquidator.weeklyChange.toFixed(1)}%
                </div>
              </div>
              
              {/* Action buttons - show on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => viewWallet(liquidator.walletAddress)}
                  className="h-7 w-7 p-0 hover:bg-ocean-teal/20"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
