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
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { borrow, fetchUserGlobalData } from "@/services/lendingService";
import { getTokenConfig, getAllTokensWithDisplayInfo, getAlgorandNetworkFromNetworkId, getNetworkConfig, NetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { useToast } from "@/hooks/use-toast";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import { updateTransactionMetadata } from "@/utils/transactionUtils";

interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  poolId?: string; // Pool ID to identify specific market when multiple markets exist for same symbol
  network?: string;
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
    liquidationThreshold?: number;
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
  poolId,
  network,
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
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setRainbowkitSignDialogSuppressed(false);
    }
  }, [isOpen]);

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
        // If poolId is provided, find the token that matches both symbol and poolId (e.g. 2 WAD markets)
        // Compare as string so "123" and 123 match
        const token = poolId != null && poolId !== ""
          ? tokens.find(
              (t) => t.symbol === asset && String(t.poolId) === String(poolId)
            )
          : tokens.find((t) => t.symbol === asset);

        if (!token) {
          throw new Error(`Token ${asset} not found in network config${poolId ? ` with poolId ${poolId}` : ''}`);
        }

        if (!token.poolId || !token.underlyingContractId) {
          throw new Error(
            `Token ${asset} missing pool or contract configuration`
          );
        }

        const tokenConfigRaw = getTokenConfig(currentNetwork, asset);
        if (!tokenConfigRaw) {
          throw new Error(`Token config not found for ${asset}`);
        }

        // Handle case where tokenConfig might be an array (multiple markets)
        const tokenConfig = Array.isArray(tokenConfigRaw)
          ? tokenConfigRaw.find((tc) => String(tc.poolId) === String(token.poolId)) || tokenConfigRaw[0]
          : tokenConfigRaw;

        if (!tokenConfig) {
          throw new Error(`Token config not found for ${asset}`);
        }

        const marketPoolId = token.poolId;
        const marketId = token.underlyingContractId;
        const decimals = tokenConfig.decimals;

        console.log("Calculating max borrow amount:", {
          poolId: marketPoolId,
          userId: activeAccount.address,
          marketId,
          asset,
        });

        const networkToUse = network || currentNetwork;
        const storageAppId = getNetworkConfig(networkToUse as NetworkId)?.contracts?.appStorageId;

        const maxBorrowBigInt = await calculateMaxBorrowAmount(
          marketPoolId,
          activeAccount.address,
          marketId,
          storageAppId ? Number(storageAppId) : undefined
        );

        // Available supply cap: for sToken/mint markets treat as unlimited
        const totalDeposits = assetData.totalSupply;
        const totalBorrowed = assetData.totalBorrow;
        const depositsMinusBorrowed = totalDeposits - totalBorrowed;
        const effectiveSupplyCap = assetData.isSToken
          ? Number.MAX_SAFE_INTEGER
          : depositsMinusBorrowed;

        if (maxBorrowBigInt !== null && maxBorrowBigInt !== BigInt(0)) {
          // Convert from bigint (atomic units) to number (human-readable)
          const maxBorrowBN = new BigNumber(maxBorrowBigInt.toString());
          const divisor = new BigNumber(10).pow(decimals);
          const maxBorrowNumber = maxBorrowBN.dividedBy(divisor).toNumber();

          // Optional buffer: liquidation threshold - collateral factor (e.g. 85 - 80 = 5%)
          let adjustedMaxBorrow = maxBorrowNumber;
          if (assetData.liquidationThreshold != null && assetData.collateralFactor != null) {
            const buffer = assetData.liquidationThreshold - assetData.collateralFactor;
            if (buffer > 0) {
              adjustedMaxBorrow = maxBorrowNumber * (1 + buffer / 100);
            }
          }

          // Cap by available supply (sToken markets use unlimited cap)
          const finalMaxBorrow = Math.max(
            0,
            Math.min(adjustedMaxBorrow, effectiveSupplyCap)
          );
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("MintModal: Max borrow calculated:", {
            maxBorrowNumber,
            adjustedMaxBorrow,
            effectiveSupplyCap: assetData.isSToken ? "(sToken: unlimited)" : effectiveSupplyCap,
            finalMaxBorrow,
          });
        } else if (!assetData.isSToken) {
          const finalMaxBorrow = Math.max(0, depositsMinusBorrowed);
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("Max borrow amount (fallback):", finalMaxBorrow);
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
  }, [
    isOpen,
    activeAccount?.address,
    asset,
    poolId,
    currentNetwork,
    network,
    assetData.totalSupply,
    assetData.totalBorrow,
    assetData.isSToken,
    assetData.collateralFactor,
    assetData.liquidationThreshold,
  ]);

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
      // Use the asset's network if provided, otherwise fall back to currentNetwork
      const networkToUse = (network || currentNetwork) as string;
      const tokens = getAllTokensWithDisplayInfo(networkToUse);
      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      const token = poolId
        ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
        : tokens.find((t) => t.symbol === asset);

      if (!token) {
        throw new Error(`Token ${asset} not found in network config${poolId ? ` with poolId ${poolId}` : ''}`);
      }

      if (!token.poolId || !token.underlyingContractId) {
        throw new Error(
          `Token ${asset} missing pool or contract configuration`
        );
      }

      // Get the original token config to access tokenStandard
      const tokenConfigRaw = getTokenConfig(networkToUse, asset);
      if (!tokenConfigRaw) {
        throw new Error(`Token config not found for ${asset}`);
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      const originalTokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw.find((tc) => tc.poolId === token.poolId) || tokenConfigRaw[0]
        : tokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(`Token config not found for ${asset}`);
      }

      // Validate decimals exists and is valid
      if (typeof originalTokenConfig.decimals !== 'number' || isNaN(originalTokenConfig.decimals)) {
        throw new Error(`Invalid decimals for token ${asset}: ${originalTokenConfig.decimals}`);
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

      // Check if wallet is supported on the network for signing
      if (activeWallet) {
        const walletId = activeWallet.id?.toLowerCase() || "";
        const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const networkId = networkToUse as string;

        // Universal wallets support all AVM networks
        const isUniversalWallet =
          walletId === "lute" ||
          walletId === "kibisis" ||
          walletId === "vera" ||
          walletId === "biatec";

        // VOI-specific wallets only support VOI Mainnet
        const isVOIWallet = false;

        // Algorand-specific wallets only support Algorand Mainnet
        const isAlgorandWallet =
          walletId === "pera" ||
          walletId === "defly" ||
          walletName.includes("pera") ||
          walletName.includes("defly");

        // WalletConnect - check wallet name for specific restrictions
        const isWalletConnect = walletId === "walletconnect";
        let isWalletConnectVOI = false;
        let isWalletConnectAlgorand = false;

        if (isWalletConnect) {
          isWalletConnectVOI =
            walletName.includes("vera") || walletName.includes("biatec");
          isWalletConnectAlgorand =
            walletName.includes("pera") || walletName.includes("defly");
        }

        const isXchainRainbowkit =
          walletId === "rainbowkit" && networkId === "algorand-mainnet";

        // Check if wallet supports the network
        const isSupported =
          isXchainRainbowkit ||
          isUniversalWallet ||
          (isVOIWallet && networkId === "voi-mainnet") ||
          (isAlgorandWallet && networkId === "algorand-mainnet") ||
          (isWalletConnect &&
            ((isWalletConnectVOI && networkId === "voi-mainnet") ||
              (isWalletConnectAlgorand && networkId === "algorand-mainnet") ||
              (!isWalletConnectVOI &&
                !isWalletConnectAlgorand &&
                currentNetwork === "voi-mainnet" &&
                networkId === "voi-mainnet") ||
              (!isWalletConnectVOI && !isWalletConnectAlgorand))) ||
          (!isVOIWallet && !isAlgorandWallet && !isWalletConnect); // Unknown wallet types allow all networks

        if (!isSupported) {
          const networkName =
            networkId === "voi-mainnet" ? "VOI Mainnet" : "Algorand Mainnet";
          throw new Error(
            `Your wallet (${activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      if (result.success && "txns" in result) {
        // Show toast notification to prompt user to open wallet
        const walletName = activeWallet?.metadata?.name || "your wallet";
        toast({
          title: "Please Sign Transaction",
          description: `Please open ${walletName} and sign the transaction`,
          duration: 10000,
        });

        const stxns = await withRainbowkitHostDialogDismissed({
          wallet: activeWallet,
          setSuppressed: setRainbowkitSignDialogSuppressed,
          leaveOverlayDismissedOnSuccess: true,
          run: () =>
            signTransactions(
              result.txns.map((txn: string) =>
                Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
              )
            ),
        });
        // Get the correct algod client for the asset's network (not currentNetwork)
        const algorandNetwork = getAlgorandNetworkFromNetworkId(networkToUse);
        if (!algorandNetwork) {
          throw new Error(`Invalid network: ${networkToUse}`);
        }
        const algorandClients =
          await algorandService.initializeClientsForTransactions(algorandNetwork);
        const res = await algorandClients.algod.sendRawTransaction(stxns).do();
        await waitForConfirmation(algorandClients.algod, res.txid, 4);

        // Decode transactions to find the pool transaction ID
        const decodedStxns = stxns.map((txn: Uint8Array) => {
          return algosdk.decodeSignedTransaction(txn);
        });
        type DecodedAppTxn = { txn: { type: string; applicationCall?: { appIndex: number }; txID(): string } };
        const poolTxn = decodedStxns.reverse().find((txn): txn is DecodedAppTxn => (txn as DecodedAppTxn).txn?.type === "appl" && typeof (txn as DecodedAppTxn).txn?.applicationCall?.appIndex === "number" && Number((txn as DecodedAppTxn).txn.applicationCall!.appIndex) === parseInt(token.poolId));
        const poolTxnID = poolTxn?.txn?.txID?.();
        if (poolTxnID) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          // Retry until metadata update succeeds
          let metadataUpdated = false;
          let retryCount = 0;
          const maxRetries = 10;
          const apiBaseUrl = import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";
          const networkParam = networkToUse ? `?network=${networkToUse}` : "";

          while (!metadataUpdated && retryCount < maxRetries) {
            try {
              const response = await fetch(
                `${apiBaseUrl}/transaction-metadata/${poolTxnID}${networkParam}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              if (response.ok) {
                const result = await response.json();
                console.log("Transaction metadata successfully updated:", result.data);
                metadataUpdated = true;
              } else {
                const error = await response.json();
                throw new Error(error.error || "Failed to update transaction metadata");
              }
            } catch (error) {
              retryCount++;
              if (retryCount < maxRetries) {
                const delay = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
                console.warn(`Metadata update attempt ${retryCount} failed, retrying in ${delay}ms:`, error);
                await new Promise((resolve) => setTimeout(resolve, delay));
              } else {
                console.error("Failed to update transaction metadata after all retries:", error);
              }
            }
          }
        }

        setTransactionId(res.txid || "Unknown");
        setIsLoading(false);
        if (isRainbowkitXchainWallet(activeWallet)) {
          toast({
            title: "Mint successful",
            description: `Transaction ${(res.txid || "").slice(0, 10)}… submitted.`,
          });
          setTimeout(() => {
            onTransactionSuccess?.();
          }, 100);
          onClose();
        } else {
          setShowSuccess(true);
          setTimeout(() => {
            onTransactionSuccess?.();
          }, 100);
        }
      } else {
        const errorMsg =
          "error" in result ? result.error : "Transaction failed";
        throw new Error(errorMsg || "Minting failed");
      }
    } catch (err: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      console.error("Minting error:", err);
      setError(err instanceof Error ? err.message : "An error occurred during minting");
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
      <Dialog
        open={isOpen && !rainbowkitSignDialogSuppressed}
        onOpenChange={handleClose}
      >
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
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={handleClose}
    >
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
              network={network || currentNetwork}
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
