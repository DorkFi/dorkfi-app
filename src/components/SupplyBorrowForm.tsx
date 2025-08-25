
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SupplyBorrowFormProps {
  mode: "deposit" | "borrow";
  asset: string;
  walletBalance: number;
  walletBalanceUSD: number;
  availableToSupplyOrBorrow: number;
  onAmountChange: (amount: string, fiatValue: number) => void;
  onSubmit: () => void;
}

const SupplyBorrowForm = ({ 
  mode, 
  asset, 
  walletBalance, 
  walletBalanceUSD, 
  availableToSupplyOrBorrow,
  onAmountChange, 
  onSubmit 
}: SupplyBorrowFormProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);

  // Calculate USD value based on amount
  useEffect(() => {
    if (amount) {
      const numAmount = parseFloat(amount);
      if (asset === "USDC") {
        setFiatValue(numAmount);
      } else {
        const exchangeRate = asset === "VOI" ? 7 : 7; // $7 per token
        setFiatValue(numAmount * exchangeRate);
      }
    } else {
      setFiatValue(0);
    }
    onAmountChange(amount, fiatValue);
  }, [amount, asset, fiatValue, onAmountChange]);

  const handleMaxClick = () => {
    if (mode === "deposit") {
      setAmount(walletBalance.toString());
    } else {
      const maxBorrowAmount = Math.floor(availableToSupplyOrBorrow * 0.8);
      setAmount(maxBorrowAmount.toString());
    }
  };

  const isValidAmount = amount && parseFloat(amount) > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="amount" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Amount
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-white/70 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMaxClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:bg-teal-400/10 h-8 px-3"
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
          Wallet Balance: {walletBalance.toLocaleString()} {asset} 
          (${walletBalanceUSD.toLocaleString()})
        </p>
      </div>

      <Button
        onClick={onSubmit}
        disabled={!isValidAmount}
        className={`w-full font-semibold text-white h-12 transition-all hover:scale-105 ${
          mode === "deposit" 
            ? "bg-teal-600 hover:bg-teal-700" 
            : "bg-whale-gold hover:bg-whale-gold/90 text-black"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {mode === "deposit" ? "Deposit" : "Borrow"} {asset}
      </Button>
    </div>
  );
};

export default SupplyBorrowForm;
