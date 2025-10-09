
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import SupplyBorrowHeader from "./SupplyBorrowHeader";
import SupplyBorrowForm from "./SupplyBorrowForm";
import SupplyBorrowStats from "./SupplyBorrowStats";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { deposit } from "@/services/lendingService";
import { getTokenConfig, getAllTokensWithDisplayInfo } from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";

interface SupplyBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  mode: "deposit" | "borrow";
  assetData: {
    icon: string;
    totalSupply: number;
    totalSupplyUSD: number;
    supplyAPY: number;
    totalBorrow: number;
    totalBorrowUSD: number;
    borrowAPY: number;
    utilization: number;
    collateralFactor: number;
    liquidity: number;
    liquidityUSD: number;
  };
  walletBalance?: number;
  walletBalanceUSD?: number;
  onTransactionSuccess?: () => void;
}

const SupplyBorrowModal = ({ 
  isOpen, 
  onClose, 
  asset, 
  mode, 
  assetData, 
  walletBalance: propWalletBalance = 0, 
  walletBalanceUSD: propWalletBalanceUSD = 0,
  onTransactionSuccess
}: SupplyBorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  const { activeAccount, signTransactions } = useWallet();
  const { currentNetwork } = useNetwork();

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setError(null);
      setTransactionId(null);
    }
  }, [isOpen]);

  const handleAmountChange = (newAmount: string, newFiatValue: number) => {
    setAmount(newAmount);
    setFiatValue(newFiatValue);
  };

  const handleSubmit = async () => {
    if (mode !== "deposit") {
      console.log(`${mode} ${amount} ${asset} - Borrow functionality not implemented yet`);
      return;
    }

    if (!activeAccount?.address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > propWalletBalance) {
      setError("Insufficient wallet balance");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find(t => t.symbol === asset);
      
      if (!token) {
        throw new Error(`Token ${asset} not found in network config`);
      }

      if (!token.poolId || !token.underlyingContractId) {
        throw new Error(`Token ${asset} missing pool or contract configuration`);
      }

      // Convert amount to atomic units (considering token decimals)
      const amountInAtomicUnits = new BigNumber(amount)
        .multipliedBy(10 ** token.decimals)
        .toFixed(0);

      console.log("Deposit parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId,
        tokenStandard: token.tokenStandard,
        amount: amountInAtomicUnits,
        userAddress: activeAccount.address,
        networkId: currentNetwork,
      });

      // Call the lending service deposit method
      const depositResult = await deposit(
        token.poolId,
        token.underlyingContractId,
        token.tokenStandard,
        amountInAtomicUnits,
        activeAccount.address,
        currentNetwork
      );

      if (!depositResult.success) {
        throw new Error(depositResult.error || "Deposit failed");
      }

      console.log("Deposit result:", depositResult);

      // Sign and send transactions
      const stxns = await signTransactions(
        depositResult.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      const algorandClients = await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txId, 4);

      console.log("Transaction confirmed:", res);
      setTransactionId(res.txId);
      setShowSuccess(true);
      
      // Call the success callback to refresh data
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
      
    } catch (error) {
      console.error("Deposit error:", error);
      setError(error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransaction = () => {
    if (transactionId) {
      const explorerUrl = currentNetwork === "voi-mainnet" 
        ? "https://voi.observer" 
        : "https://testnet.voi.observer";
      window.open(`${explorerUrl}/tx/${transactionId}`, "_blank");
    } else {
      window.open("https://testnet.voi.observer", "_blank");
    }
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-md p-6">
          {showSuccess ? (
            <SupplyBorrowCongrats
              transactionType={mode}
              asset={asset}
              assetIcon={assetData.icon}
              amount={amount}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
            />
          ) : (
            <>
              <DialogHeader className="pb-4">
                <DialogTitle className="sr-only">{mode === 'deposit' ? 'Deposit' : 'Borrow'} {asset}</DialogTitle>
                <SupplyBorrowHeader 
                  mode={mode}
                  asset={asset}
                  assetIcon={assetData.icon}
                />
              </DialogHeader>
              
              <div className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              <SupplyBorrowForm 
                mode={mode}
                asset={asset}
                walletBalance={propWalletBalance}
                walletBalanceUSD={propWalletBalanceUSD}
                availableToSupplyOrBorrow={assetData.liquidity}
                onAmountChange={handleAmountChange}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />

                <SupplyBorrowStats
                  mode={mode}
                  asset={asset}
                  assetData={assetData}
                />
              </div>
            </>
          )}
        </DialogContent>
    </Dialog>
  );
};

export default SupplyBorrowModal;
