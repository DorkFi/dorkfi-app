import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import SupplyBorrowHeader from "./SupplyBorrowHeader";
import SupplyBorrowForm from "./SupplyBorrowForm";
import SupplyBorrowStats from "./SupplyBorrowStats";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { borrow, fetchUserGlobalData } from "@/services/lendingService";
import { getTokenConfig, getAllTokensWithDisplayInfo } from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { useToast } from "@/hooks/use-toast";
import { calculateMaxBorrowAmount } from "@/services/adminService";

interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
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
    maxTotalDeposits?: number;
    isSToken?: boolean;
  };
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  userBorrowBalance?: number;
  onTransactionSuccess?: () => void;
}

const MintModal = ({
  isOpen,
  onClose,
  asset,
  assetData,
  userGlobalData,
  userBorrowBalance = 0,
  onTransactionSuccess,
}: MintModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [calculatedMaxBorrow, setCalculatedMaxBorrow] = useState<number | null>(null);
  const [isLoadingMaxBorrow, setIsLoadingMaxBorrow] = useState(false);
  const [maxBorrowError, setMaxBorrowError] = useState<string | null>(null);

  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();

  // Calculate max borrow amount when modal opens
  useEffect(() => {
    console.log("useEffect triggered", { isOpen, hasAddress: !!activeAccount?.address, asset, currentNetwork });
    
    const fetchMaxBorrowAmount = async () => {
      if (!isOpen || !activeAccount?.address) {
        console.log("Early return - conditions not met", { isOpen, hasAddress: !!activeAccount?.address });
        setCalculatedMaxBorrow(null);
        setIsLoadingMaxBorrow(false);
        return;
      }

      console.log("fetchMaxBorrowAmount called", { isOpen, address: activeAccount?.address, asset, currentNetwork });

      setIsLoadingMaxBorrow(true);
      setMaxBorrowError(null);

      try {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === asset);

        if (!token) {
          throw new Error(`Token ${asset} not found in network config`);
        }

        if (!token.poolId || !token.underlyingContractId) {
          throw new Error(
            `Token ${asset} missing pool or contract configuration`
          );
        }

        const tokenConfig = getTokenConfig(currentNetwork, asset);
        if (!tokenConfig) {
          throw new Error(`Token config not found for ${asset}`);
        }

        const poolId = token.poolId;
        const marketId = token.underlyingContractId;
        const decimals = tokenConfig.decimals;

        console.log("Calculating max borrow amount:", {
          poolId,
          userId: activeAccount.address,
          marketId,
          asset,
        });

        const maxBorrowBigInt = await calculateMaxBorrowAmount(
          poolId,
          activeAccount.address,
          marketId,
          47015119 // TODO get this from config
        );

        console.log("maxBorrowBigInt", { maxBorrowBigInt });

        if (maxBorrowBigInt !== null && maxBorrowBigInt !== BigInt(0)) {
          // Convert from bigint (atomic units) to number (human-readable)
          const maxBorrowBN = new BigNumber(maxBorrowBigInt.toString());
          const divisor = new BigNumber(10).pow(decimals);
          const maxBorrowNumber = maxBorrowBN.dividedBy(divisor).toNumber();
          
          setCalculatedMaxBorrow(Math.max(0, maxBorrowNumber));
          console.log("Max borrow amount calculated:", maxBorrowNumber);
        } else {
          setCalculatedMaxBorrow(0);
          console.log("Max borrow amount is 0");
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
  }, [isOpen, activeAccount?.address, asset, currentNetwork]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setError(null);
      setTransactionId(null);
      setRetryCount(0);
      setCalculatedMaxBorrow(null);
      setMaxBorrowError(null);
    }
  }, [isOpen]);

  const handleAmountChange = (newAmount: string, newFiatValue: number) => {
    setAmount(newAmount);
    setFiatValue(newFiatValue);
  };

  const handleSubmit = async () => {
    if (!activeAccount?.address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);

      if (!token) {
        throw new Error(`Token ${asset} not found in network config`);
      }

      if (!token.poolId || !token.underlyingContractId) {
        throw new Error(
          `Token ${asset} missing pool or contract configuration`
        );
      }

      // Get the original token config to access tokenStandard
      const originalTokenConfig = getTokenConfig(currentNetwork, asset);
      if (!originalTokenConfig) {
        throw new Error(`Token config not found for ${asset}`);
      }

      // Initialize clients
      const clients = await algorandService.getCurrentClientsForReads();

      // Convert amount to smallest units
      const amountInSmallestUnits = new BigNumber(amount)
        .multipliedBy(Math.pow(10, originalTokenConfig.decimals))
        .toFixed(0);

      console.log(
        `Minting ${amount} ${asset} (${amountInSmallestUnits} smallest units)`
      );

      // Call borrow function (which handles minting for s-tokens)
      const result = await borrow(
        token.poolId,
        token.underlyingContractId,
        originalTokenConfig.tokenStandard,
        amountInSmallestUnits,
        activeAccount.address,
        currentNetwork
      );

      if (result.success && "txns" in result) {
        // Show toast notification to prompt user to open wallet
        const walletName = activeWallet?.metadata?.name || "your wallet";
        toast({
          title: "Please Sign Transaction",
          description: `Please open ${walletName} and sign the transaction`,
          duration: 10000,
        });

        const stxns = await signTransactions(
          result.txns.map((txn: string) =>
            Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
          )
        );
        const algorandClients =
          await algorandService.getCurrentClientsForTransactions();
        const res = await algorandClients.algod.sendRawTransaction(stxns).do();
        await waitForConfirmation(algorandClients.algod, res.txid, 4);

        setTransactionId(res.txid || "Unknown");
        setIsLoading(false); // Set loading to false before showing success modal
        setShowSuccess(true);
        // Call onTransactionSuccess after a brief delay to ensure success modal is displayed
        setTimeout(() => {
          onTransactionSuccess();
        }, 100);
      } else {
        const errorMsg =
          "error" in result ? result.error : "Transaction failed";
        throw new Error(errorMsg || "Minting failed");
      }
    } catch (err: any) {
      console.error("Minting error:", err);
      setError(err.message || "An error occurred during minting");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    setError(null);
    handleSubmit();
  };

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center gap-4 animate-fade-in p-6">
            {/* Success Icon */}
            <div className="relative flex flex-col items-center justify-center mb-2">
              <div className="w-16 h-16 text-green-500 drop-shadow-xl bg-white dark:bg-slate-800 rounded-full p-1 border-4 border-purple-500 z-10 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <img
                src={assetData.icon}
                alt={`${asset} icon`}
                className="mt-[-30px] w-32 h-32 rounded-xl shadow-md border-4 border-purple-500 mx-auto bg-bubble-white dark:bg-slate-800 object-cover"
              />
            </div>

            <h2 className="text-xl font-bold text-center mb-1">
              Minting Successful!
            </h2>

            <div className="text-center text-base text-slate-700 dark:text-slate-200 mb-2 font-medium">
              You successfully minted{" "}
              <span className="text-purple-600">
                {amount} {asset}
              </span>{" "}
              tokens.
            </div>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuccess(false);
                  setAmount("");
                  setFiatValue(0);
                  setError(null);
                  setTransactionId(null);
                }}
                className="flex-1"
              >
                Mint More
              </Button>
              <Button
                onClick={() => {
                  setShowSuccess(false);
                  handleClose();
                }}
                className="flex-1 bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] md:max-w-md h-[90vh] md:h-auto max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="flex flex-col h-full">
          <div className="bg-card dark:bg-slate-900 px-6 pt-4 pb-2 shrink-0">
            <DialogHeader className="pt-0">
              <DialogTitle className="text-center">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-center text-slate-800 dark:text-white capitalize">
                    Mint
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={assetData.icon}
                      alt={asset}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                      {asset}
                    </span>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 md:pb-3 space-y-3 touch-pan-y min-h-0">
            <SupplyBorrowForm
              mode="borrow"
              asset={asset}
              walletBalance={0}
              walletBalanceUSD={0}
              availableToSupplyOrBorrow={
                calculatedMaxBorrow !== null
                  ? calculatedMaxBorrow
                  : (() => {
                      if (!userGlobalData) return 0;
                      // Calculate max borrowable: max(0, collateral * cf - borrows)
                      const collateralFactorDecimal = assetData.collateralFactor / 100;
                      return Math.max(0, (userGlobalData.totalCollateralValue * collateralFactorDecimal) - userGlobalData.totalBorrowValue);
                    })()
              }
              supplyAPY={assetData.supplyAPY}
              totalSupply={assetData.totalSupply}
              maxTotalDeposits={assetData.maxTotalDeposits}
              userGlobalData={userGlobalData}
              collateralFactor={assetData.collateralFactor}
              onAmountChange={handleAmountChange}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={!userGlobalData}
              hideButton={true}
              isLoadingMaxBorrow={isLoadingMaxBorrow}
              maxBorrowError={maxBorrowError}
            />

            <SupplyBorrowStats
              mode="borrow"
              asset={asset}
              assetData={assetData}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              depositAmount={0}
              isSToken={assetData.isSToken || false}
            />
          </div>

          {/* Action Buttons */}
          <div className="bg-card dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-6 py-3 flex gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !amount || parseFloat(amount) <= 0 || !userGlobalData}
              className="flex-1 font-semibold h-11 bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : `Mint ${asset}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MintModal;
