
import { useState, useMemo } from 'react';

export interface LiquidationAccount {
  id: string;
  walletAddress: string;
  healthFactor: number;
  liquidationMargin: number;
  totalSupplied: number;
  totalBorrowed: number;
  ltv: number;
  riskLevel: 'liquidatable' | 'danger' | 'moderate' | 'safe';
  collateralAssets: Array<{
    symbol: string;
    amount: number;
    valueUSD: number;
  }>;
  borrowedAssets: Array<{
    symbol: string;
    amount: number;
    valueUSD: number;
  }>;
  lastUpdated: string;
}

export interface LiquidationDataConfig {
  riskThresholds: {
    liquidatable: number;
    danger: number;
    moderate: number;
  };
  pageSize?: number;
  enableSearch?: boolean;
  enableSorting?: boolean;
}

export interface SortConfig {
  key: keyof LiquidationAccount;
  direction: 'asc' | 'desc';
}

export const useLiquidationData = (
  initialData: LiquidationAccount[],
  config: LiquidationDataConfig = {
    riskThresholds: { liquidatable: 1.05, danger: 1.2, moderate: 1.5 },
    pageSize: 10,
    enableSearch: true,
    enableSorting: true,
  }
) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'healthFactor', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    return initialData.filter(account =>
      account.walletAddress.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [initialData, searchTerm]);

  const sortedData = useMemo(() => {
    if (!config.enableSorting) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  }, [filteredData, sortConfig, config.enableSorting]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * (config.pageSize || 10);
    const endIndex = startIndex + (config.pageSize || 10);
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, config.pageSize]);

  const totalPages = Math.ceil(sortedData.length / (config.pageSize || 10));

  const handleSort = (key: keyof LiquidationAccount) => {
    if (!config.enableSorting) return;
    
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const handleSearch = (term: string) => {
    if (!config.enableSearch) return;
    
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return {
    data: paginatedData,
    allData: sortedData,
    searchTerm,
    sortConfig,
    currentPage,
    totalPages,
    totalCount: sortedData.length,
    handleSort,
    handleSearch,
    handlePageChange,
  };
};
