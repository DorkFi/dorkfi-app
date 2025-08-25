
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BorrowFormProps {
  tokenSymbol: string;
  availableToBorrow: number;
  tokenPrice: number;
  onAmountChange: (amount: string, fiatValue: number) => void;
  onSubmit: () => void;
}

const BorrowForm = ({ 
  tokenSymbol, 
  availableToBorrow, 
  tokenPrice, 
  onAmountChange, 
  onSubmit 
}: BorrowFormProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);

  useEffect(() => {
    if (amount) {
      const numAmount = parseFloat(amount);
      setFiatValue(numAmount * tokenPrice);
    } else {
      setFiatValue(0);
    }
    onAmountChange(amount, fiatValue);
  }, [amount, tokenPrice, fiatValue, onAmountChange]);

  const handleMaxClick = () => {
    setAmount(availableToBorrow.toString());
  };

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= availableToBorrow;

  return (
    <div className="space-y-3">
      <Label htmlFor="amount" className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Amount
      </Label>
      <div className="relative">
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          placeholder="0.0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMaxClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-pink-400 hover:bg-pink-400/10 h-8 px-3"
        >
          MAX
        </Button>
      </div>
      {fiatValue > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          ≈ ${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Available to Borrow: {availableToBorrow.toLocaleString()} {tokenSymbol} 
        (${(availableToBorrow * tokenPrice).toLocaleString()})
      </p>
      
      <Button
        onClick={onSubmit}
        disabled={!isValidAmount}
        className="w-full font-semibold h-12 bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-6"
      >
        Borrow {tokenSymbol}
      </Button>
    </div>
  );
};

export default BorrowForm;
