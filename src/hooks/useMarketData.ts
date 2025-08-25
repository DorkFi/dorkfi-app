import { useState, useMemo } from 'react';

export interface MarketData {
  asset: string;
  icon: string;
  totalSupply: number;
  totalSupplyUSD: number;
  supplyAPY: number;
  totalBorrow: number;
  totalBorrowUSD: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  walletBalance: number;
  supplyCap: number;
  supplyCapUSD: number;
  maxLTV: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  reserveFactor: number;
  collectorContract: string;
}

const mockMarketData: MarketData[] = [
  { 
    asset: "VOI", 
    icon: "/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png", 
    totalSupply: 2500000, 
    totalSupplyUSD: 2500000, 
    supplyAPY: 4.25, 
    totalBorrow: 1000000, 
    totalBorrowUSD: 1000000, 
    borrowAPY: 8.45, 
    utilization: 40, 
    collateralFactor: 75, 
    walletBalance: 2500,
    supplyCap: 3000000,
    supplyCapUSD: 3000000,
    maxLTV: 70,
    liquidationThreshold: 75,
    liquidationPenalty: 5,
    reserveFactor: 15,
    collectorContract: "0x1234...abcd"
  },
  { 
    asset: "UNIT", 
    icon: "/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png", 
    totalSupply: 1800000, 
    totalSupplyUSD: 1800000, 
    supplyAPY: 3.85, 
    totalBorrow: 900000, 
    totalBorrowUSD: 900000, 
    borrowAPY: 7.90, 
    utilization: 50, 
    collateralFactor: 80, 
    walletBalance: 1800,
    supplyCap: 2200000,
    supplyCapUSD: 2200000,
    maxLTV: 75,
    liquidationThreshold: 80,
    liquidationPenalty: 5,
    reserveFactor: 15,
    collectorContract: "0x5678...efgh"
  },
  { 
    asset: "USDC", 
    icon: "/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png", 
    totalSupply: 5000000, 
    totalSupplyUSD: 5000000, 
    supplyAPY: 2.15, 
    totalBorrow: 3000000, 
    totalBorrowUSD: 3000000, 
    borrowAPY: 4.85, 
    utilization: 60, 
    collateralFactor: 85, 
    walletBalance: 5000,
    supplyCap: 7680000,
    supplyCapUSD: 7680000,
    maxLTV: 80,
    liquidationThreshold: 85,
    liquidationPenalty: 4,
    reserveFactor: 15,
    collectorContract: "0x9abc...ijkl"
  },
  { 
    asset: "ALGO", 
    icon: "/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png", 
    totalSupply: 10000000, 
    totalSupplyUSD: 3200000, 
    supplyAPY: 3.45, 
    totalBorrow: 4000000, 
    totalBorrowUSD: 1280000, 
    borrowAPY: 6.75, 
    utilization: 40, 
    collateralFactor: 70, 
    walletBalance: 15000,
    supplyCap: 12000000,
    supplyCapUSD: 3840000,
    maxLTV: 65,
    liquidationThreshold: 70,
    liquidationPenalty: 8,
    reserveFactor: 20,
    collectorContract: "0xdef0...mnop"
  },
  { 
    asset: "ETH", 
    icon: "/lovable-uploads/0056095969b13247cc2220891bbf5caf.jpg", 
    totalSupply: 1000, 
    totalSupplyUSD: 3800000, 
    supplyAPY: 2.85, 
    totalBorrow: 600, 
    totalBorrowUSD: 2280000, 
    borrowAPY: 5.25, 
    utilization: 60, 
    collateralFactor: 82, 
    walletBalance: 2.5,
    supplyCap: 1200,
    supplyCapUSD: 4560000,
    maxLTV: 80,
    liquidationThreshold: 82,
    liquidationPenalty: 5,
    reserveFactor: 15,
    collectorContract: "0x1111...qrst"
  },
  { 
    asset: "BTC", 
    icon: "/lovable-uploads/e6939307-812a-4a73-b7e5-e159df44e40c.png", 
    totalSupply: 50, 
    totalSupplyUSD: 4500000, 
    supplyAPY: 1.95, 
    totalBorrow: 25, 
    totalBorrowUSD: 2250000, 
    borrowAPY: 4.15, 
    utilization: 50, 
    collateralFactor: 75, 
    walletBalance: 0.1,
    supplyCap: 60,
    supplyCapUSD: 5400000,
    maxLTV: 70,
    liquidationThreshold: 75,
    liquidationPenalty: 10,
    reserveFactor: 20,
    collectorContract: "0x2222...uvwx"
  }
];

export type SortField = 'asset' | 'totalSupplyUSD' | 'supplyAPY' | 'totalBorrowUSD' | 'borrowAPY' | 'utilization';
export type SortOrder = 'asc' | 'desc';

interface UseMarketDataProps {
  searchTerm?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  pageSize?: number;
}

export const useMarketData = ({
  searchTerm = '',
  sortField = 'totalSupplyUSD',
  sortOrder = 'desc',
  pageSize = 10
}: UseMarketDataProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const { filteredData, totalPages, paginatedData } = useMemo(() => {
    // Filter data based on search term
    let filtered = mockMarketData.filter(market =>
      market.asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: number | string = a[sortField];
      let bValue: number | string = b[sortField];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      filteredData: filtered,
      totalPages,
      paginatedData: paginated
    };
  }, [searchTerm, sortField, sortOrder, currentPage, pageSize]);

  const handleSearchChange = (newSearchTerm: string) => {
    setCurrentPage(1);
  };

  const handleSortChange = (newSortField: SortField, newSortOrder: SortOrder) => {
    setCurrentPage(1);
  };

  return {
    data: paginatedData,
    totalItems: filteredData.length,
    totalPages,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handleSortChange
  };
};
