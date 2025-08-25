import { useState, useMemo, useEffect } from 'react';
import SimpleBubbleChart from './SimpleBubbleChart';

interface LiquidatedAssetData {
  symbol: string;
  name: string;
  icon: string;
  totalUSDLiquidated: number;
  liquidationCount: number;
  successRate: number;
  change24h: number;
  lastLiquidation: string;
  borrowPoolPercentage: number;
}

interface TopLiquidatedAssetsProps {
  className?: string;
  onTokenSelect?: (token: any) => void;
  selectedTokenId?: string;
}

const mockLiquidationData: LiquidatedAssetData[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '/lovable-uploads/e6939307-812a-4a73-b7e5-e159df44e40c.png',
    totalUSDLiquidated: 1400000,
    liquidationCount: 134,
    successRate: 94.2,
    change24h: 6.3,
    lastLiquidation: '25 minutes ago',
    borrowPoolPercentage: 22.1
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png',
    totalUSDLiquidated: 1200000,
    liquidationCount: 203,
    successRate: 95.8,
    change24h: 8.9,
    lastLiquidation: '12 minutes ago',
    borrowPoolPercentage: 15.7
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/lovable-uploads/0056095969b13247cc2220891bbf5caf.jpg',
    totalUSDLiquidated: 980000,
    liquidationCount: 156,
    successRate: 91.7,
    change24h: 12.1,
    lastLiquidation: '1 hour ago',
    borrowPoolPercentage: 18.9
  },
  {
    symbol: 'VOI',
    name: 'Voi',
    icon: '/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png',
    totalUSDLiquidated: 850000,
    liquidationCount: 127,
    successRate: 92.3,
    change24h: 15.7,
    lastLiquidation: '2 hours ago',
    borrowPoolPercentage: 8.5
  },
  {
    symbol: 'UNIT',
    name: 'Unit',
    icon: '/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png',
    totalUSDLiquidated: 650000,
    liquidationCount: 89,
    successRate: 88.1,
    change24h: -3.2,
    lastLiquidation: '45 minutes ago',
    borrowPoolPercentage: 12.3
  },
  {
    symbol: 'ALGO',
    name: 'Algorand',
    icon: '/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png',
    totalUSDLiquidated: 420000,
    liquidationCount: 76,
    successRate: 79.2,
    change24h: -8.4,
    lastLiquidation: '3 hours ago',
    borrowPoolPercentage: 6.8
  }
];

export default function TopLiquidatedAssets({ className, onTokenSelect, selectedTokenId }: TopLiquidatedAssetsProps) {
  const [isVolumeView, setIsVolumeView] = useState(true);

  const bubbleData = useMemo(() => {
    // Sort by liquidation volume (highest first) to ensure consistent ordering
    const sortedData = [...mockLiquidationData].sort((a, b) => b.totalUSDLiquidated - a.totalUSDLiquidated);
    
    return sortedData.map(asset => ({
      id: asset.symbol,
      symbol: asset.symbol,
      name: asset.name,
      icon: asset.icon,
      value: asset.totalUSDLiquidated,
      count: asset.liquidationCount,
      successRate: asset.successRate,
      change24h: asset.change24h,
      lastLiquidation: asset.lastLiquidation,
      borrowPoolPercentage: asset.borrowPoolPercentage
    }));
  }, []);

  // Auto-select the top liquidated token on mount
  useEffect(() => {
    if (bubbleData.length > 0 && onTokenSelect && !selectedTokenId) {
      const topToken = bubbleData[0]; // First item is highest volume due to sorting
      onTokenSelect(topToken);
    }
  }, [bubbleData, onTokenSelect, selectedTokenId]);

  return (
    <SimpleBubbleChart
      data={bubbleData}
      isVolumeView={isVolumeView}
      onViewChange={setIsVolumeView}
      onTokenSelect={onTokenSelect}
      selectedTokenId={selectedTokenId}
      className={className}
    />
  );
}
