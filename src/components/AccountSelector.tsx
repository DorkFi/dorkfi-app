import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { CheckCircle, ChevronDown, User, Search } from 'lucide-react';
import { WalletAccount } from '@txnlab/use-wallet-react';

interface AccountSelectorProps {
  accounts: WalletAccount[];
  activeAccount: WalletAccount | null;
  onAccountSelect: (account: WalletAccount) => void;
  className?: string;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  activeAccount,
  onAccountSelect,
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAccountName = (account: WalletAccount) => {
    return account.name || formatAddress(account.address);
  };

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return accounts;
    }

    const query = searchQuery.toLowerCase();
    return accounts.filter(account => {
      const name = account.name?.toLowerCase() || '';
      const address = account.address.toLowerCase();
      const shortAddress = formatAddress(account.address).toLowerCase();
      
      return name.includes(query) || 
             address.includes(query) || 
             shortAddress.includes(query);
    });
  }, [accounts, searchQuery]);

  const handleAccountSelect = (account: WalletAccount) => {
    onAccountSelect(account);
    setIsOpen(false);
    setSearchQuery(''); // Clear search when account is selected
    setHighlightedIndex(0);
  };

  // Reset highlighted index when search query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredAccounts.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredAccounts.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredAccounts[highlightedIndex]) {
          handleAccountSelect(filteredAccounts[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(0);
        break;
    }
  };

  if (accounts.length <= 1) {
    return null; // Don't show selector if only one account
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center space-x-2 ${className}`}
        >
          <User className="w-4 h-4" />
          <span className="text-sm">
            {activeAccount ? formatAccountName(activeAccount) : 'Select Account'}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Select Account
        </div>
        <DropdownMenuSeparator />
        
        {/* Search Input */}
        <div className="px-2 py-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Account List */}
        <div className="max-h-60 overflow-y-auto">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account, index) => (
              <DropdownMenuItem
                key={account.address}
                onClick={() => handleAccountSelect(account)}
                className={`cursor-pointer flex items-center justify-between px-2 py-2 ${
                  index === highlightedIndex ? 'bg-accent' : ''
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {account.name || 'Unnamed Account'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatAddress(account.address)}
                  </span>
                </div>
                {activeAccount?.address === account.address && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No accounts found
            </div>
          )}
        </div>
        
        {/* Account Count */}
        {searchQuery && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-xs text-muted-foreground text-center">
              {filteredAccounts.length} of {accounts.length} accounts
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountSelector;
