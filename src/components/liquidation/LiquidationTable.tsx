import React from 'react';
import { LiquidationAccount } from '../../hooks/useLiquidationData';
import { formatRelativeTime } from '../../utils/liquidationUtils';
import { ComponentThemeProps, ThemeConfig } from '../../types/themeConfig';
import { getTheme } from '../../themes/liquidationThemes';
import { useRiskCalculations } from '../../hooks/useRiskCalculations';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '../../lib/utils';

interface LiquidationTableProps extends ComponentThemeProps {
  accounts: LiquidationAccount[];
  onSort?: (key: keyof LiquidationAccount) => void;
  sortConfig?: {
    key: keyof LiquidationAccount;
    direction: 'asc' | 'desc';
  };
  onAccountClick?: (account: LiquidationAccount) => void;
}

const LiquidationTable: React.FC<LiquidationTableProps> = ({
  accounts,
  onSort,
  sortConfig,
  onAccountClick,
  theme: customTheme,
  variant = 'default',
  className,
}) => {
  const theme = { ...getTheme(variant), ...customTheme };
  const { formatHealthFactor, formatCurrency, assessRisk } = useRiskCalculations();

  const getRiskColor = (level: string) => {
    const colors = theme.colors.risk;
    switch (level) {
      case 'liquidatable': return colors.liquidatable;
      case 'danger': return colors.danger;
      case 'moderate': return colors.moderate;
      case 'safe': return colors.safe;
      default: return colors.safe;
    }
  };

  const getRiskIcon = (level: string) => {
    if (theme.icons.type === 'emoji') {
      const icons = theme.icons.risk as Record<string, string>;
      return icons[level] || icons.safe;
    }
    
    const IconComponent = theme.icons.risk[level as keyof typeof theme.icons.risk] as React.ComponentType<any>;
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const handleSort = (key: keyof LiquidationAccount) => {
    if (onSort) onSort(key);
  };

  if (theme.layout.variant === 'table') {
    return (
      <div className={cn("w-full", className)} style={{ backgroundColor: theme.colors.background.primary }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: theme.colors.border }}>
              <TableHead 
                className={cn("cursor-pointer", theme.typography.fontFamily)}
                onClick={() => handleSort('walletAddress')}
                style={{ color: theme.colors.text.secondary }}
              >
                Account
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", theme.typography.fontFamily)}
                onClick={() => handleSort('healthFactor')}
                style={{ color: theme.colors.text.secondary }}
              >
                Health Factor
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", theme.typography.fontFamily)}
                onClick={() => handleSort('totalBorrowed')}
                style={{ color: theme.colors.text.secondary }}
              >
                Total Borrowed
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", theme.typography.fontFamily)}
                onClick={() => handleSort('ltv')}
                style={{ color: theme.colors.text.secondary }}
              >
                LTV
              </TableHead>
              <TableHead 
                className={cn(theme.typography.fontFamily)}
                style={{ color: theme.colors.text.secondary }}
              >
                Risk Level
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const risk = assessRisk(account);
              return (
                <TableRow 
                  key={account.id}
                  className="cursor-pointer hover:opacity-80"
                  style={{ borderColor: theme.colors.border }}
                  onClick={() => onAccountClick?.(account)}
                >
                  <TableCell className={cn(theme.typography.fontFamily, theme.typography.fontSize.sm)}>
                    <div className="flex items-center gap-2">
                      {theme.layout.showAvatars && (
                        <Avatar className="w-6 h-6">
                          <AvatarFallback>{account.walletAddress.slice(-2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <span style={{ color: theme.colors.text.primary }}>
                        {account.walletAddress.slice(0, 8)}...{account.walletAddress.slice(-6)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell 
                    className={cn(theme.typography.fontFamily, theme.typography.fontSize.sm)}
                    style={{ color: getRiskColor(risk.level) }}
                  >
                    {formatHealthFactor(account.healthFactor)}
                  </TableCell>
                  <TableCell 
                    className={cn(theme.typography.fontFamily, theme.typography.fontSize.sm)}
                    style={{ color: theme.colors.text.primary }}
                  >
                    {formatCurrency(account.totalBorrowed)}
                  </TableCell>
                  <TableCell 
                    className={cn(theme.typography.fontFamily, theme.typography.fontSize.sm)}
                    style={{ color: theme.colors.text.primary }}
                  >
                    {(account.ltv * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className={cn(theme.typography.fontFamily, theme.typography.fontSize.sm)}>
                    <div className="flex items-center gap-2">
                      {theme.layout.showIcons && getRiskIcon(risk.level)}
                      <span 
                        className={cn(theme.typography.fontWeight.medium)}
                        style={{ color: getRiskColor(risk.level) }}
                      >
                        {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Card layout (default)
  return (
    <div className={cn("grid gap-4", className)}>
      {accounts.map((account) => {
        const risk = assessRisk(account);
        return (
          <Card 
            key={account.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg",
              theme.borderRadius.md,
              theme.layout.compactMode ? "p-3" : "p-4"
            )}
            style={{ 
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border
            }}
            onClick={() => onAccountClick?.(account)}
          >
            <CardHeader className={cn("pb-2", theme.layout.compactMode && "pb-1")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme.layout.showAvatars && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>{account.walletAddress.slice(-2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <p 
                      className={cn(
                        theme.typography.fontFamily,
                        theme.typography.fontSize.md,
                        theme.typography.fontWeight.semibold
                      )}
                      style={{ color: theme.colors.text.primary }}
                    >
                      {account.walletAddress.slice(0, 8)}...{account.walletAddress.slice(-6)}
                    </p>
                    <p 
                      className={cn(
                        theme.typography.fontFamily,
                        theme.typography.fontSize.sm
                      )}
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Last updated: {formatRelativeTime(parseInt(account.lastUpdated))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {theme.layout.showIcons && getRiskIcon(risk.level)}
                  <span 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.sm,
                      theme.typography.fontWeight.medium
                    )}
                    style={{ color: getRiskColor(risk.level) }}
                  >
                    {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className={cn("pt-0", theme.layout.compactMode && "pt-1")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.xs
                    )}
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Health Factor
                  </p>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.lg,
                      theme.typography.fontWeight.semibold
                    )}
                    style={{ color: getRiskColor(risk.level) }}
                  >
                    {formatHealthFactor(account.healthFactor)}
                  </p>
                </div>
                <div>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.xs
                    )}
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Total Borrowed
                  </p>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.lg,
                      theme.typography.fontWeight.semibold
                    )}
                    style={{ color: theme.colors.text.primary }}
                  >
                    {formatCurrency(account.totalBorrowed)}
                  </p>
                </div>
                <div>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.xs
                    )}
                    style={{ color: theme.colors.text.secondary }}
                  >
                    LTV Ratio
                  </p>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.lg,
                      theme.typography.fontWeight.semibold
                    )}
                    style={{ color: theme.colors.text.primary }}
                  >
                    {(account.ltv * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.xs
                    )}
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Liquidation Margin
                  </p>
                  <p 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.lg,
                      theme.typography.fontWeight.semibold
                    )}
                    style={{ color: theme.colors.text.primary }}
                  >
                    {formatCurrency(account.liquidationMargin)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default LiquidationTable;
