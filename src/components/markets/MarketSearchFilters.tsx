
import { useState } from "react";
import { Search, SortAsc, SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortField, SortOrder } from "@/hooks/useMarketData";

interface MarketSearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
}

const MarketSearchFilters = ({
  searchTerm,
  onSearchChange,
  sortField,
  sortOrder,
  onSortChange
}: MarketSearchFiltersProps) => {
  const handleSortFieldChange = (field: SortField) => {
    onSortChange(field, sortOrder);
  };

  const toggleSortOrder = () => {
    onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 md:p-6 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-600 dark:text-ocean-teal h-4 w-4" />
          <Input
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30 focus:border-ocean-teal text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-muted-foreground w-full"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={sortField} onValueChange={handleSortFieldChange}>
            <SelectTrigger className="w-full md:w-48 bg-white dark:bg-slate-800/50 border-gray-300 dark:border-ocean-teal/30 text-slate-800 dark:text-white">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="totalSupplyUSD">Total Deposits</SelectItem>
              <SelectItem value="supplyAPY">Deposit APY</SelectItem>
              <SelectItem value="totalBorrowUSD">Total Borrow</SelectItem>
              <SelectItem value="borrowAPY">Borrow APY</SelectItem>
              <SelectItem value="utilization">Utilization</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            className="border-gray-300 dark:border-ocean-teal/30 hover:bg-ocean-teal/10 text-slate-700 dark:text-ocean-teal"
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketSearchFilters;
