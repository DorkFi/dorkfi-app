import React, { useState, useEffect } from 'react';
import { Search, Hash, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { MimirApiService } from '@/services/mimirApi';
import { Token } from '@/types/mimirTypes';

interface TokenContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contractId: string, tokenInfo?: Token) => void;
  currentValue?: string;
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
  'INDEX': '/placeholder.svg',
  'LPT': '/placeholder.svg',
};

const getTokenIcon = (symbol: string): string => {
  return TOKEN_ICONS[symbol] || '/placeholder.svg';
};

export function TokenContractModal({
  open,
  onOpenChange,
  onSelect,
  currentValue = ''
}: TokenContractModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'custom'>('search');
  const [customContractId, setCustomContractId] = useState(currentValue);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load tokens from Mimir API
  useEffect(() => {
    if (open && activeTab === 'search') {
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
    }
  }, [open, activeTab]);

  // Filter tokens based on search
  const filteredTokens = tokens.filter(token => 
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectToken = (token: Token) => {
    onSelect(token.id, token);
    onOpenChange(false);
  };

  const handleCustomSubmit = () => {
    if (customContractId.trim()) {
      onSelect(customContractId.trim());
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setCustomContractId(currentValue);
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-8">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Select Token Contract ID
          </DialogTitle>
          <DialogDescription>
            Choose how you want to specify the token contract ID for your market.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'search' | 'custom')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Tokens
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Custom ID
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 mt-6">
            <div>
              <Label htmlFor="token-search">Search Tokens</Label>
              <Input
                id="token-search"
                placeholder="Search by symbol, name, or contract ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="border rounded-lg max-h-96 overflow-hidden">
              <Command>
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
                            onSelect={() => handleSelectToken(token)}
                            className="flex items-center gap-3 p-3"
                          >
                            <img 
                              src={getTokenIcon(token.symbol)} 
                              alt={token.symbol}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{token.symbol}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({token.id})
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {token.name} • {token.decimals} decimals
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-green-600" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-6">
            <div>
              <Label htmlFor="custom-contract-id">Contract ID</Label>
              <Input
                id="custom-contract-id"
                placeholder="Enter contract ID (e.g., 41403352)"
                value={customContractId}
                onChange={(e) => setCustomContractId(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Enter the specific contract ID for the token you want to create a market for.
                This should be a valid ARC-200 token contract address.
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Custom Contract ID</h4>
              <p className="text-sm text-muted-foreground">
                Use this option when you have a specific contract ID that may not be available 
                in the token search, or when creating a market for a new token that hasn't been 
                indexed yet.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-6">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {activeTab === 'custom' && (
            <Button 
              onClick={handleCustomSubmit}
              disabled={!customContractId.trim()}
            >
              Use Custom ID
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
