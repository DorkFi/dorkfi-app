
import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { LiquidationStats } from '../../hooks/useLiquidationStats';
import { ComponentThemeProps } from '../../types/themeConfig';
import { getTheme } from '../../themes/liquidationThemes';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { cn } from '../../lib/utils';

interface LiquidationChartProps extends ComponentThemeProps {
  stats: LiquidationStats;
  showPieChart?: boolean;
  showBarChart?: boolean;
  chartHeight?: number;
}

const LiquidationChart: React.FC<LiquidationChartProps> = ({
  stats,
  showPieChart = true,
  showBarChart = true,
  chartHeight = 300,
  theme: customTheme,
  variant = 'default',
  className,
}) => {
  const theme = { ...getTheme(variant), ...customTheme };

  const getRiskColor = (level: string) => {
    const colors = theme.colors.risk;
    switch (level.toLowerCase()) {
      case 'liquidatable': return colors.liquidatable;
      case 'danger zone': return colors.danger;
      case 'moderate risk': return colors.moderate;
      case 'safe harbor': return colors.safe;
      default: return colors.safe;
    }
  };

  const pieChartData = stats.riskDistribution.map(item => ({
    ...item,
    fill: getRiskColor(item.name),
  }));

  const barChartData = stats.riskDistribution.map(item => ({
    name: item.name,
    count: item.value,
    percentage: item.percentage,
    fill: getRiskColor(item.name),
  }));

  const chartConfig = {
    count: {
      label: "Accounts",
    },
    percentage: {
      label: "Percentage",
    },
  };

  return (
    <div className={cn("space-y-6", className)}>
      {showPieChart && (
        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader>
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.lg,
                theme.typography.fontWeight.semibold
              )}
              style={{ color: theme.colors.text.primary }}
            >
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
              </PieChart>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {stats.riskDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getRiskColor(item.name) }}
                  />
                  <span 
                    className={cn(
                      theme.typography.fontFamily,
                      theme.typography.fontSize.sm
                    )}
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {item.name}: {item.value} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showBarChart && (
        <Card 
          className={cn(theme.borderRadius.lg)}
          style={{ 
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border
          }}
        >
          <CardHeader>
            <CardTitle 
              className={cn(
                theme.typography.fontFamily,
                theme.typography.fontSize.lg,
                theme.typography.fontWeight.semibold
              )}
              style={{ color: theme.colors.text.primary }}
            >
              Account Distribution by Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={barChartData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme.colors.border}
                />
                <XAxis 
                  dataKey="name" 
                  tick={{ 
                    fill: theme.colors.text.secondary,
                    fontSize: 12,
                    fontFamily: theme.typography.fontFamily
                  }}
                />
                <YAxis 
                  tick={{ 
                    fill: theme.colors.text.secondary,
                    fontSize: 12,
                    fontFamily: theme.typography.fontFamily
                  }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiquidationChart;
