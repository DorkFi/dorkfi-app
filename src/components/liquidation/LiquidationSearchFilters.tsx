import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface LiquidationSearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'liquidationMargin' | 'healthFactor';
  onSortChange: (value: 'liquidationMargin' | 'healthFactor') => void;
}

export default function LiquidationSearchFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange
}: LiquidationSearchFiltersProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by wallet address..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-slate-800/50 border-gray-300/50 dark:border-ocean-teal/30 text-slate-800 dark:text-white placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'liquidationMargin' ? 'default' : 'outline'}
              onClick={() => onSortChange('liquidationMargin')}
              className="flex-1 md:flex-none"
            >
              Sort by Margin
            </Button>
            <Button
              variant={sortBy === 'healthFactor' ? 'default' : 'outline'}
              onClick={() => onSortChange('healthFactor')}
              className="flex-1 md:flex-none"
            >
              Sort by Health
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
