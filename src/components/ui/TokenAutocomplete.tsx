import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MimirApiService } from '@/services/mimirApi';
import { Token } from '@/types/mimirTypes';

interface TokenAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Token icon mapping
const TOKEN_ICONS: Record<string, string> = {
  'VOI': '/lovable-uploads/VOI.png',
  'UNIT': '/lovable-uploads/UNIT.png',
  'USDC': '/lovable-uploads/aUSDC.png',
  'BTC': '/lovable-uploads/WrappedBTC.png',
  'cbBTC': '/lovable-uploads/cbBTC.png',
  'ETH': '/lovable-uploads/ETH.jpg',
  'ALGO': '/lovable-uploads/Algo.webp',
  'POW': '/lovable-uploads/POW.png',
};

const getTokenIcon = (symbol: string): string => {
  return TOKEN_ICONS[symbol] || '/placeholder.svg';
};

export function TokenAutocomplete({
  value,
  onValueChange,
  placeholder = "Search tokens...",
  className
}: TokenAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tokens from Mimir API
  useEffect(() => {
    const loadTokens = async () => {
      setLoading(true);
      setError(null);
      try {
        const tokenData = await MimirApiService.getTokens();
        setTokens(tokenData);
      } catch (err) {
        console.error('Failed to load tokens:', err);
        setError('Failed to load tokens');
        // Set fallback tokens
        setTokens([
          { id: 'VOI', symbol: 'VOI', name: 'Voi Network', decimals: 6 },
          { id: 'UNIT', symbol: 'UNIT', name: 'Unit Protocol', decimals: 6 },
          { id: 'aUSDC', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
          { id: 'WBTC', symbol: 'BTC', name: 'Wrapped Bitcoin', decimals: 8 },
          { id: 'WETH', symbol: 'ETH', name: 'Wrapped Ethereum', decimals: 18 },
          { id: 'ALGO', symbol: 'ALGO', name: 'Algorand', decimals: 6 },
          { id: 'POW', symbol: 'POW', name: 'POW Token', decimals: 6 },
          { id: 'cbBTC', symbol: 'cbBTC', name: 'Coinbase Bitcoin', decimals: 8 },
          { id: 'USDT', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
          { id: 'DAI', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, []);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    return tokens.filter(token => 
      token.symbol.toLowerCase().includes(value.toLowerCase()) ||
      token.name.toLowerCase().includes(value.toLowerCase()) ||
      token.id.toLowerCase().includes(value.toLowerCase())
    );
  }, [tokens, value]);

  const selectedToken = tokens.find(token => token.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedToken ? (
            <div className="flex items-center gap-2">
              <img 
                src={getTokenIcon(selectedToken.symbol)} 
                alt={selectedToken.symbol}
                className="w-4 h-4 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              <span className="font-medium">{selectedToken.symbol}</span>
              <span className="text-muted-foreground text-sm">
                ({selectedToken.name})
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tokens..." />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <div className="text-sm text-muted-foreground">Loading tokens...</div>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-6">
                <div className="text-sm text-destructive">{error}</div>
              </div>
            )}
            {!loading && !error && (
              <>
                <CommandEmpty>No tokens found.</CommandEmpty>
                <CommandGroup>
                  {filteredTokens.map((token) => (
                    <CommandItem
                      key={token.id}
                      value={token.id}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue === value ? "" : currentValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === token.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <img 
                            src={getTokenIcon(token.symbol)} 
                            alt={token.symbol}
                            className="w-4 h-4 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground">
                            ({token.id})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {token.name} • {token.decimals} decimals
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
