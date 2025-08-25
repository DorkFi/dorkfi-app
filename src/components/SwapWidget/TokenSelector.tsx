
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import DorkFiButton from "@/components/ui/DorkFiButton";
import React from "react";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  address: string;
  decimals: number;
  balance?: number;
}

interface TokenSelectorProps {
  label: string;
  token: Token | null;
  amount: string;
  tokens: Token[];
  onTokenChange: (value: string) => void;
  onAmountChange?: (value: string) => void;
  onMaxClick?: () => void;
  readOnly?: boolean;
}

const TokenSelector = ({ 
  label, 
  token, 
  amount, 
  tokens, 
  onTokenChange, 
  onAmountChange, 
  onMaxClick,
  readOnly = false 
}: TokenSelectorProps) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {token && (
          <span>Balance: {token.balance?.toLocaleString()} {token.symbol}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Select 
          value={token?.symbol} 
          onValueChange={onTokenChange}
        >
          <SelectTrigger className="w-32 bg-ocean-teal/10 border-ocean-teal/30 hover:bg-ocean-teal/20 transition-colors">
            <SelectValue>
              {token && (
                <div className="flex items-center gap-2">
                  <span>{token.icon}</span>
                  <span>{token.symbol}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-50 bg-white dark:bg-gray-900">
            {tokens.map((tokenOption) => (
              <SelectItem key={tokenOption.symbol} value={tokenOption.symbol}>
                <div className="flex items-center gap-2">
                  <span>{tokenOption.icon}</span>
                  <span>{tokenOption.symbol}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
            readOnly={readOnly}
            className="w-full bg-ocean-teal/10 border-ocean-teal/30 text-white placeholder:text-muted-foreground focus:border-ocean-teal pr-16"
            // padding right for the button
          />
          {/* Show Max button only when not readOnly, token is present, and handler is provided */}
          {!readOnly && onMaxClick && token && typeof token.balance === "number" && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 rounded-md bg-ocean-teal/40 text-white border border-ocean-teal/50 hover:bg-ocean-teal/60 shadow transition font-medium text-xs focus:outline-none focus:ring-2 focus:ring-ocean-teal/50"
              style={{ minWidth: 44 }}
              tabIndex={0}
              onClick={onMaxClick}
            >
              Max
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenSelector;

