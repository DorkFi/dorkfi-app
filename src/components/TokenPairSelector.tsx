
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenPair {
  from: string;
  to: string;
  label: string;
  popular?: boolean;
}

interface TokenPairSelectorProps {
  value: TokenPair | null;
  onValueChange: (pair: TokenPair | null) => void;
  className?: string;
}

const TokenPairSelector = ({ value, onValueChange, className }: TokenPairSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Available trading pairs with popular ones marked
  const availablePairs: TokenPair[] = [
    { from: 'VOI', to: 'USDC', label: 'VOI/USDC', popular: true },
    { from: 'VOI', to: 'UNIT', label: 'VOI/UNIT', popular: true },
    { from: 'UNIT', to: 'USDC', label: 'UNIT/USDC', popular: true },
    { from: 'UNIT', to: 'VOI', label: 'UNIT/VOI' },
    { from: 'USDC', to: 'VOI', label: 'USDC/VOI' },
    { from: 'USDC', to: 'UNIT', label: 'USDC/UNIT' },
  ];

  const filteredPairs = availablePairs.filter(pair =>
    pair.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pair.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pair.to.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort popular pairs first
  const sortedPairs = [...filteredPairs].sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return 0;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full sm:w-48 justify-between bg-white/50 dark:bg-ocean-teal/10 border-gray-300/50 dark:border-ocean-teal/30 hover:bg-gray-200/50 dark:hover:bg-ocean-teal/20 text-slate-800 dark:text-white",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-whale-gold" />
            {value ? value.label : "Select pair..."}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,16rem)] sm:w-48 p-0 bg-white dark:bg-gray-900 border-gray-300/50 dark:border-ocean-teal/30 shadow-lg z-50">
        <Command className="bg-white dark:bg-gray-900">
          <CommandInput
            placeholder="Search pairs..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-slate-800 dark:text-white"
          />
          <CommandList>
            <CommandEmpty>No pairs found.</CommandEmpty>
            <CommandGroup>
              {sortedPairs.map((pair) => (
                <CommandItem
                  key={pair.label}
                  value={pair.label}
                  onSelect={() => {
                    onValueChange(pair);
                    setOpen(false);
                  }}
                  className="text-slate-800 dark:text-white hover:bg-gray-200/50 dark:hover:bg-ocean-teal/20"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.label === pair.label ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center justify-between w-full">
                    <span>{pair.label}</span>
                    {pair.popular && (
                      <span className="text-xs text-whale-gold">Popular</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TokenPairSelector;
