
import React, { useState } from 'react';
import { useLiquidationData, LiquidationAccount } from '../../hooks/useLiquidationData';
import { useLiquidationStats } from '../../hooks/useLiquidationStats';
import { ComponentThemeProps } from '../../types/themeConfig';
import { getTheme } from '../../themes/liquidationThemes';
import LiquidationTable from './LiquidationTable';
import LiquidationChart from './LiquidationChart';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../ui/pagination';
import { cn } from '../../lib/utils';

interface LiquidationMonitorProps extends ComponentThemeProps {
  accounts: LiquidationAccount[];
  onAccountClick?: (account: LiquidationAccount) => void;
  showCharts?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  pageSize?: number;
}

const LiquidationMonitor: React.FC<LiquidationMonitorProps> = ({
  accounts,
  onAccountClick,
  showCharts = true,
  showSearch = true,
  showPagination = true,
  pageSize = 10,
  theme: customTheme,
  variant = 'default',
  className,
}) => {
  const theme = { ...getTheme(variant), ...customTheme };
  
  const {
    data: paginatedAccounts,
    allData: filteredAccounts,
    searchTerm,
    sortConfig,
    currentPage,
    totalPages,
    totalCount,
    handleSort,
    handleSearch,
    handlePageChange,
  } = useLiquidationData(accounts, {
    riskThresholds: { liquidatable: 1.05, danger: 1.2, moderate: 1.5 },
    pageSize,
    enableSearch: showSearch,
    enableSorting: true,
  });

  const stats = useLiquidationStats(filteredAccounts, {
    riskThresholds: { liquidatable: 1.05, danger: 1.2, moderate: 1.5 },
  });

  return (
    <div 
      className={cn("space-y-6", className)}
      style={{ backgroundColor: theme.colors.background.primary }}
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.sm
              )}
              style={{ color: theme.colors.text.secondary }}
            >
              Total Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.xl,
                theme.typography.fontWeight.bold
              )}
              style={{ color: theme.colors.text.primary }}
            >
              {stats.totalAccounts}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.sm
              )}
              style={{ color: theme.colors.text.secondary }}
            >
              Liquidatable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.xl,
                theme.typography.fontWeight.bold
              )}
              style={{ color: theme.colors.risk.liquidatable }}
            >
              {stats.liquidatableAccounts}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.sm
              )}
              style={{ color: theme.colors.text.secondary }}
            >
              At Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.xl,
                theme.typography.fontWeight.bold
              )}
              style={{ color: theme.colors.risk.danger }}
            >
              {stats.dangerZoneAccounts + stats.moderateRiskAccounts}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.sm
              )}
              style={{ color: theme.colors.text.secondary }}
            >
              Avg Health Factor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.xl,
                theme.typography.fontWeight.bold
              )}
              style={{ color: theme.colors.text.primary }}
            >
              {stats.averageHealthFactor.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {showCharts && (
        <LiquidationChart 
          stats={stats}
          theme={customTheme}
          variant={variant}
        />
      )}

      {/* Search */}
      {showSearch && (
        <div className="flex gap-4">
          <Input
            placeholder="Search by wallet address..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className={cn(
              theme.typography.fontFamily,
              "max-w-sm"
            )}
            style={{ 
              backgroundColor: theme.colors.background.secondary,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
          />
        </div>
      )}

      {/* Table */}
      <LiquidationTable
        accounts={paginatedAccounts}
        onSort={handleSort}
        sortConfig={sortConfig}
        onAccountClick={onAccountClick}
        theme={customTheme}
        variant={variant}
      />

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => handlePageChange(currentPage - 1)}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    onClick={() => handlePageChange(pageNumber)}
                    isActive={pageNumber === currentPage}
                    className="cursor-pointer"
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default LiquidationMonitor;
