
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import BorrowHeader from "./BorrowHeader";
import BorrowForm from "./BorrowForm";
import BorrowStats from "./BorrowStats";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { getAllTokensWithDisplayInfo, getTokenConfig } from "@/config";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import { fetchMarketInfo } from "@/services/lendingService";
import BigNumber from "bignumber.js";

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  availableToBorrow: number;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number;
    currentLTV: number;
    tokenPrice: number;
  };
}

const BorrowModal = ({ isOpen, onClose, tokenSymbol, tokenIcon, availableToBorrow, marketStats }: BorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [calculatedMaxBorrow, setCalculatedMaxBorrow] = useState<number | null>(null);
  const [isLoadingMaxBorrow, setIsLoadingMaxBorrow] = useState(false);
  const [maxBorrowError, setMaxBorrowError] = useState<string | null>(null);

  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  // Calculate max borrow amount when modal opens
  useEffect(() => {
    console.log("useEffect triggered", { isOpen, hasAddress: !!activeAccount?.address, tokenSymbol, currentNetwork });
    
    const fetchMaxBorrowAmount = async () => {
      if (!isOpen || !activeAccount?.address) {
        console.log("Early return - conditions not met", { isOpen, hasAddress: !!activeAccount?.address });
        setCalculatedMaxBorrow(null);
        setIsLoadingMaxBorrow(false);
        return;
      }

      console.log("fetchMaxBorrowAmount called", { isOpen, address: activeAccount?.address, tokenSymbol, currentNetwork });

      setIsLoadingMaxBorrow(true);
      setMaxBorrowError(null);

      try {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === tokenSymbol);

        if (!token) {
          throw new Error(`Token ${tokenSymbol} not found in network config`);
        }

        if (!token.poolId || !token.underlyingContractId) {
          throw new Error(
            `Token ${tokenSymbol} missing pool or contract configuration`
          );
        }

        const tokenConfig = getTokenConfig(currentNetwork, tokenSymbol);
        if (!tokenConfig) {
          throw new Error(`Token config not found for ${tokenSymbol}`);
        }

        const poolId = token.poolId;
        const marketId = token.underlyingContractId;
        const decimals = tokenConfig.decimals;

        console.log("Calculating max borrow amount:", {
          poolId,
          userId: activeAccount.address,
          marketId,
          tokenSymbol,
        });

        const maxBorrowBigInt = await calculateMaxBorrowAmount(
          poolId,
          activeAccount.address,
          marketId,
          47015119 // TODO get this from config
        );

        console.log("maxBorrowBigInt", { maxBorrowBigInt });

        // Calculate total deposits - total borrowed from market data
        const marketInfo = await fetchMarketInfo(poolId, marketId, currentNetwork);
        
        let totalDeposits = 0;
        let totalBorrowed = 0;
        
        if (marketInfo) {
          // Convert from base units to human-readable
          totalDeposits = Number(marketInfo.totalDeposits) / Math.pow(10, decimals);
          totalBorrowed = Number(marketInfo.totalBorrows) / Math.pow(10, decimals);
        }

        console.log("Market info:", { totalDeposits, totalBorrowed });

        if (maxBorrowBigInt !== BigInt(0)) {
          // Convert from bigint (atomic units) to number (human-readable)
          const maxBorrowBN = new BigNumber(maxBorrowBigInt.toString());
          const divisor = new BigNumber(10).pow(decimals);
          const maxBorrowNumber = maxBorrowBN.dividedBy(divisor).toNumber();
          
          // Calculate total deposits - total borrowed
          const depositsMinusBorrowed = totalDeposits - totalBorrowed;
          
          // Take minimum of (total deposits - total borrowed) and current borrowable value
          const finalMaxBorrow = Math.max(0, Math.min(maxBorrowNumber, depositsMinusBorrowed));
          
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("Max borrow amount calculated:", {
            maxBorrowNumber,
            depositsMinusBorrowed,
            finalMaxBorrow
          });
        } else {
          // Even if maxBorrowBigInt is 0, we should still check deposits - borrowed
          const depositsMinusBorrowed = totalDeposits - totalBorrowed;
          const finalMaxBorrow = Math.max(0, depositsMinusBorrowed);
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("Max borrow amount (deposits - borrowed):", finalMaxBorrow);
        }
      } catch (error) {
        console.error("Error calculating max borrow amount:", error);
        setMaxBorrowError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        setCalculatedMaxBorrow(null);
      } finally {
        setIsLoadingMaxBorrow(false);
      }
    };

    fetchMaxBorrowAmount();
  }, [isOpen, activeAccount?.address, tokenSymbol, currentNetwork]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setCalculatedMaxBorrow(null);
      setMaxBorrowError(null);
    }
  }, [isOpen]);

  const handleAmountChange = (newAmount: string, newFiatValue: number) => {
    setAmount(newAmount);
    setFiatValue(newFiatValue);
  };

  const handleSubmit = () => {
    console.log(`Borrow ${amount} ${tokenSymbol}`);
    
    setTimeout(() => {
      setShowSuccess(true);
    }, 500);
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
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
        <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-[95vw] md:max-w-md h-[90vh] max-h-[90vh] overflow-hidden flex flex-col px-0 py-0">
          {showSuccess ? (
            <div className="p-6 overflow-y-auto">
              <SupplyBorrowCongrats
                transactionType="borrow"
                asset={tokenSymbol}
                assetIcon={tokenIcon}
                amount={amount}
                onViewTransaction={handleViewTransaction}
                onGoToPortfolio={handleGoToPortfolio}
                onMakeAnother={handleMakeAnother}
                onClose={onClose}
              />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="sticky top-0 z-20 bg-card dark:bg-slate-900 pt-6 px-8 pb-4">
                <DialogHeader className="pb-0">
                  <DialogTitle className="sr-only">Borrow {tokenSymbol}</DialogTitle>
                  <BorrowHeader 
                    tokenSymbol={tokenSymbol}
                    tokenIcon={tokenIcon}
                  />
                </DialogHeader>
              </div>
              
              <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 pt-2 px-8 pb-8 touch-pan-y">
                <BorrowForm
                  tokenSymbol={tokenSymbol}
                  availableToBorrow={
                    calculatedMaxBorrow !== null
                      ? calculatedMaxBorrow
                      : availableToBorrow
                  }
                  tokenPrice={marketStats.tokenPrice}
                  onAmountChange={handleAmountChange}
                  onSubmit={handleSubmit}
                  isLoadingMaxBorrow={isLoadingMaxBorrow}
                  maxBorrowError={maxBorrowError}
                />

                <BorrowStats
                  tokenSymbol={tokenSymbol}
                  marketStats={marketStats}
                />
              </div>
            </div>
          )}
        </DialogContent>
    </Dialog>
  );
};

export default BorrowModal;
