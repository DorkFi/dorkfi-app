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
  deposit,
  borrow,
  fetchUserGlobalData,
} from "@/services/lendingService";
import {
  getTokenConfig,
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  NetworkId,
} from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { useToast } from "@/hooks/use-toast";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import dorkfiAPIService from "@/services/dorkfiAPIService";

interface SupplyBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  poolId?: string; // Pool ID to identify specific market when multiple markets exist for same symbol
  network?: string; // Network ID for cross-network operations
  transactionId?: string;
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
    liquidationThreshold?: number;
    liquidity: number;
    liquidityUSD: number;
    maxTotalDeposits?: number;
    isSToken?: boolean;
  };
  walletBalance?: number;
  walletBalanceUSD?: number;
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  userBorrowBalance?: number;
  userDepositBalance?: number;
  onTransactionSuccess?: () => void;
  onRefreshWalletBalance?: () => void;
}

const SupplyBorrowModal = ({
  isOpen,
  onClose,
  asset,
  poolId,
  network,
  mode,
  assetData,
  walletBalance: propWalletBalance = 0,
  walletBalanceUSD: propWalletBalanceUSD = 0,
  userGlobalData,
  userBorrowBalance = 0,
  userDepositBalance = 0,
  onTransactionSuccess,
}: SupplyBorrowModalProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionNetworkId, setTransactionNetworkId] = useState<
    string | null
  >(null);
  const [retryCount, setRetryCount] = useState(0);
  const [calculatedMaxBorrow, setCalculatedMaxBorrow] = useState<number | null>(
    null
  );
  const [isLoadingMaxBorrow, setIsLoadingMaxBorrow] = useState(false);
  const [maxBorrowError, setMaxBorrowError] = useState<string | null>(null);

  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();

  // Use provided network or fallback to current network
  const networkToUse = network || currentNetwork;

  // Calculate max borrow amount when modal opens in borrow mode
  useEffect(() => {
    const fetchMaxBorrowAmount = async () => {
      // Only calculate for borrow mode
      if (mode !== "borrow" || !isOpen || !activeAccount?.address) {
        setCalculatedMaxBorrow(null);
        setIsLoadingMaxBorrow(false);
        setMaxBorrowError(null);
        return;
      }

      console.log("SupplyBorrowModal: Calculating max borrow amount", {
        isOpen,
        mode,
        address: activeAccount.address,
        asset,
        currentNetwork,
      });

      setIsLoadingMaxBorrow(true);
      setMaxBorrowError(null);

      try {
        const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
        // If poolId is provided, find the token that matches both symbol and poolId
        // Otherwise, fall back to finding by symbol only (for backward compatibility)
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (!token) {
          throw new Error(
            `Token ${asset} not found in network config${
              poolId ? ` with poolId ${poolId}` : ""
            }`
          );
        }

        if (!token.poolId || !token.underlyingContractId) {
          throw new Error(
            `Token ${asset} missing pool or contract configuration`
          );
        }

        // Use originalSymbol to look up the config, as asset might be a display symbol
        const originalSymbol =
          "originalSymbol" in token ? (token as any).originalSymbol : asset;
        const tokenConfigRaw = getTokenConfig(
          networkToUse as any,
          originalSymbol
        );
        if (!tokenConfigRaw) {
          throw new Error(
            `Token config not found for ${asset} (originalSymbol: ${originalSymbol})`
          );
        }

        // Handle case where tokenConfig might be an array (multiple markets)
        // Compare poolIds as strings to ensure exact match
        const tokenConfig = Array.isArray(tokenConfigRaw)
          ? tokenConfigRaw.find(
              (tc) => String(tc.poolId) === String(token.poolId)
            ) || tokenConfigRaw[0]
          : tokenConfigRaw;

        if (!tokenConfig) {
          throw new Error(
            `Token config not found for ${asset} (originalSymbol: ${originalSymbol})`
          );
        }

        const marketPoolId = token.poolId;
        const marketId = token.underlyingContractId;
        const decimals = tokenConfig.decimals;

        console.log("SupplyBorrowModal: Calling calculateMaxBorrowAmount", {
          poolId: marketPoolId,
          userId: activeAccount.address,
          marketId,
          asset,
        });

        const maxBorrowBigInt = await calculateMaxBorrowAmount(
          marketPoolId,
          activeAccount.address,
          marketId,
          47015119 // TODO get this from config
        );

        console.log("SupplyBorrowModal: maxBorrowBigInt result", {
          maxBorrowBigInt,
          isZero: maxBorrowBigInt === BigInt(0),
          isNull: maxBorrowBigInt === null,
        });

        // Get total deposits and total borrowed from assetData
        const totalDeposits = assetData.totalSupply;
        const totalBorrowed = assetData.totalBorrow;

        // Calculate total deposits - total borrowed
        const depositsMinusBorrowed = totalDeposits - totalBorrowed;

        console.log("SupplyBorrowModal: Market totals", {
          totalDeposits,
          totalBorrowed,
          depositsMinusBorrowed,
        });

        if (maxBorrowBigInt !== null && maxBorrowBigInt !== BigInt(0)) {
          // Convert from bigint (atomic units) to number (human-readable)
          const maxBorrowBN = new BigNumber(maxBorrowBigInt.toString());
          const divisor = new BigNumber(10).pow(decimals);
          const maxBorrowNumber = maxBorrowBN.dividedBy(divisor).toNumber();

          // Calculate buffer based on liquidation factor and collateral factor
          // If liquidation factor is 85 and collateral factor is 80, buffer is 5%
          // Add this buffer as 100% borrow value (multiply by 1 + buffer/100)
          let adjustedMaxBorrow = maxBorrowNumber;
          if (assetData.liquidationThreshold && assetData.collateralFactor) {
            const liquidationFactor = assetData.liquidationThreshold; // Already in percentage
            const collateralFactor = assetData.collateralFactor; // Already in percentage
            const buffer = liquidationFactor - collateralFactor; // e.g., 85 - 80 = 5
            if (buffer > 0) {
              // Add buffer as percentage: multiply by (1 + buffer/100)
              adjustedMaxBorrow = maxBorrowNumber * (1 + buffer / 100);
              console.log("SupplyBorrowModal: Buffer calculation", {
                liquidationFactor,
                collateralFactor,
                buffer,
                originalMaxBorrow: maxBorrowNumber,
                adjustedMaxBorrow,
              });
            }
          }

          // Take minimum of (total deposits - total borrowed) and current borrowable value
          const finalMaxBorrow = Math.max(
            0,
            Math.min(adjustedMaxBorrow, depositsMinusBorrowed)
          );

          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log("SupplyBorrowModal: Max borrow amount calculated:", {
            maxBorrowNumber,
            adjustedMaxBorrow,
            depositsMinusBorrowed,
            finalMaxBorrow,
          });
        } else {
          // Even if maxBorrowBigInt is 0, we should still check deposits - borrowed
          const finalMaxBorrow = Math.max(0, depositsMinusBorrowed);
          setCalculatedMaxBorrow(finalMaxBorrow);
          console.log(
            "SupplyBorrowModal: Max borrow amount (deposits - borrowed):",
            finalMaxBorrow
          );
        }
      } catch (error) {
        console.error(
          "SupplyBorrowModal: Error calculating max borrow amount:",
          error
        );
        setMaxBorrowError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        setCalculatedMaxBorrow(null);
      } finally {
        setIsLoadingMaxBorrow(false);
      }
    };

    fetchMaxBorrowAmount();
  }, [isOpen, mode, activeAccount?.address, asset, poolId, networkToUse]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setError(null);
      setTransactionId(null);
      setTransactionNetworkId(null);
      setRetryCount(0);
      if (mode !== "borrow") {
        setCalculatedMaxBorrow(null);
        setMaxBorrowError(null);
      }
    }
  }, [isOpen, mode]);

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

    // For deposits, check wallet balance
    if (mode === "deposit" && parseFloat(amount) > propWalletBalance) {
      setError("Insufficient wallet balance");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("=== SUPPLYBORROWMODAL HANDLESUBMIT DEBUG ===");
      console.log("Input params:", { asset, poolId, mode, amount });

      const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
      console.log(
        "All tokens for",
        asset,
        "on network",
        networkToUse,
        ":",
        tokens
          .filter((t) => t.symbol === asset)
          .map((t) => ({
            symbol: t.symbol,
            poolId: t.poolId,
            underlyingContractId: t.underlyingContractId,
          }))
      );

      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      let token = poolId
        ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
        : tokens.find((t) => t.symbol === asset);

      // If token not found in specified network, try other enabled networks
      let actualNetwork = networkToUse;
      if (!token && !network) {
        const { getEnabledNetworks } = await import("@/config");
        const enabledNetworks = getEnabledNetworks();

        for (const enabledNetwork of enabledNetworks) {
          if (enabledNetwork === networkToUse) continue;

          const otherTokens = getAllTokensWithDisplayInfo(
            enabledNetwork as any
          );
          const otherToken = poolId
            ? otherTokens.find((t) => t.symbol === asset && t.poolId === poolId)
            : otherTokens.find((t) => t.symbol === asset);

          if (otherToken) {
            // Found token in another network, use that network
            token = otherToken;
            actualNetwork = enabledNetwork;
            break;
          }
        }
      }

      console.log("Token lookup result:", {
        poolIdProvided: poolId,
        tokenFound: !!token,
        tokenPoolId: token?.poolId,
        tokenSymbol: token?.symbol,
        tokenUnderlyingContractId: token?.underlyingContractId,
        networkUsed: actualNetwork,
      });

      if (!token) {
        console.error("Token not found!", {
          asset,
          poolId,
          availableTokens: tokens.filter((t) => t.symbol === asset),
        });
        throw new Error(
          `Token ${asset} not found in network config${
            poolId ? ` with poolId ${poolId}` : ""
          }`
        );
      }

      if (!token.poolId || !token.underlyingContractId) {
        throw new Error(
          `Token ${asset} missing pool or contract configuration`
        );
      }

      // For borrows, check market liquidity only
      if (mode === "borrow") {
        const borrowAmount = parseFloat(amount);

        // Check market liquidity
        if (borrowAmount > assetData.liquidity) {
          setError("Insufficient liquidity available for borrowing");
          setIsLoading(false);
          return;
        }
      }

      // Get the original token config to access tokenStandard
      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as any).originalSymbol : asset;
      const tokenConfigRaw = getTokenConfig(
        actualNetwork as any,
        originalSymbol
      );
      if (!tokenConfigRaw) {
        throw new Error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      const originalTokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || tokenConfigRaw[0]
        : tokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
      }

      // Validate decimals exists
      if (
        typeof originalTokenConfig.decimals !== "number" ||
        isNaN(originalTokenConfig.decimals)
      ) {
        throw new Error(
          `Invalid decimals for token ${asset}: ${originalTokenConfig.decimals}`
        );
      }

      // Convert amount to atomic units (considering token decimals)
      const amountInAtomicUnits = new BigNumber(amount)
        .multipliedBy(10 ** originalTokenConfig.decimals)
        .toFixed(0);

      console.log(`=== ${mode.toUpperCase()} TRANSACTION PARAMS ===`);
      console.log("Final parameters:", {
        poolId: token.poolId,
        poolIdFromProp: poolId,
        poolIdMatch: token.poolId === poolId,
        marketId: token.underlyingContractId,
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amountInAtomicUnits,
        userAddress: activeAccount.address,
        networkId: actualNetwork,
      });

      if (poolId && token.poolId !== poolId) {
        console.error("⚠️ POOLID MISMATCH!", {
          expectedPoolId: poolId,
          actualTokenPoolId: token.poolId,
          asset,
        });
      }

      let result;

      if (mode === "deposit") {
        // Call the lending service deposit method
        result = await deposit(
          token.poolId,
          token.underlyingContractId,
          originalTokenConfig.tokenStandard,
          amountInAtomicUnits,
          activeAccount.address,
          actualNetwork as NetworkId
        );
      } else if (mode === "borrow") {
        // Call the lending service borrow method
        result = await borrow(
          token.poolId,
          token.underlyingContractId,
          originalTokenConfig.tokenStandard,
          amountInAtomicUnits,
          activeAccount.address,
          actualNetwork as NetworkId
        );
      } else {
        throw new Error(`Unsupported mode: ${mode}`);
      }

      if (!result.success) {
        throw new Error(result.error || `${mode} failed`);
      }

      console.log(`${mode} result:`, result);

      // Check if wallet is supported on the network for signing
      if (activeWallet) {
        //const walletId = activeWallet.id?.toLowerCase() || "";
        //const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
        const walletId = "pera" as any;
        const walletName = "Pera" as any;
        const networkId = actualNetwork as string;

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

        // Check if wallet supports the network
        const isSupported =
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
            `Your wallet (${
              activeWallet.metadata?.name || walletId
            }) does not support ${networkName}. Please switch to a compatible wallet or network.`
          );
        }
      }

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the transaction`,
        duration: 10000,
      });

      // Sign and send transactions
      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the asset's network (not currentNetwork)
      const finalNetwork = actualNetwork || network || currentNetwork;
      setTransactionNetworkId(finalNetwork);
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        finalNetwork as any
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${finalNetwork}`);
      }
      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      Promise.all([
        dorkfiAPIService.fetchFreshUserData(
          activeAccount.address,
          networkToUse,
          parseInt(token.poolId),
          parseInt(token.underlyingContractId)
        ),
        dorkfiAPIService.fetchFreshMarketData(
          networkToUse,
          parseInt(token.poolId),
          parseInt(token.underlyingContractId)
        ),
      ])
        .then(() => {
          setTimeout(() => {
            //onRefreshMarket();
          }, 1000);
        })
        .catch((error) => {
          console.error("Error calling fetchFreshUserData after repay:", error);
        });

      console.log("Transaction confirmed:", res);
      setTransactionId(res.txid);
      setShowSuccess(true);

      // Call the success callback to refresh data
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
    } catch (error) {
      console.error(`${mode} error:`, error);

      // Enhanced error handling with specific messages
      let errorMessage = `${mode} failed`;

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes("compatible wallet")) {
          errorMessage = error.message;
        } else if (message.includes("insufficient liquidity for withdraw")) {
          errorMessage =
            "Insufficient liquidity for withdraw. Please check your deposit and borrow balances, add collateral, or repay debt and try again.";
        } else if (message.includes("insufficient collateral for borrow")) {
          errorMessage =
            "Insufficient collateral for borrow. Please check your collateral balance, add collateral, or repay debt and try again.";
        } else if (message.includes("tried to spend")) {
          errorMessage = `Insufficient ${
            networkToUse === "algorand-mainnet" ? "Algorand" : "Voi"
          } Network balance for this transaction. Please check your wallet balance and try again.`;
        } else if (message.includes("insufficient")) {
          errorMessage =
            mode === "deposit"
              ? "Insufficient wallet balance for this transaction"
              : "Insufficient liquidity or collateral for this transaction";
        } else if (
          message.includes("network") ||
          message.includes("connection")
        ) {
          errorMessage =
            "Network connection issue. Please check your internet connection and try again.";
        } else if (message.includes("gas") || message.includes("fee")) {
          errorMessage =
            "Transaction failed due to insufficient gas fees. Please ensure you have enough tokens for gas.";
        } else if (message.includes("rejected") || message.includes("user")) {
          errorMessage = "Transaction was rejected or cancelled by user.";
        } else if (message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please try again.";
        } else if (
          message.includes("invalid") ||
          message.includes("malformed")
        ) {
          errorMessage =
            "Invalid transaction parameters. Please refresh and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransaction = () => {
    const networkToUse = network || currentNetwork;
    if (transactionId) {
      if (networkToUse === "voi-mainnet") {
        window.open(`https://voi.observer/tx/${transactionId}`, "_blank");
      }
      if (networkToUse === "algorand-mainnet") {
        window.open(`https://allo.info/tx/${transactionId}`, "_blank");
      }
    } else {
      throw new Error("Transaction ID not found");
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
    setTransactionId(null);
    setTransactionNetworkId(null);
  };

  const handleRetry = () => {
    setError(null);
    setRetryCount((prev) => prev + 1);
    handleSubmit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-[95vw] md:max-w-md h-[90vh] md:h-auto max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col p-0">
        {showSuccess ? (
          <div className="p-6 overflow-y-auto">
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
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0">
                <DialogTitle className="sr-only">
                  {mode === "deposit" ? "Deposit" : "Borrow"} {asset}
                </DialogTitle>
                <SupplyBorrowHeader
                  mode={mode}
                  asset={asset}
                  assetIcon={assetData.icon}
                />
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 md:pb-3 space-y-3 touch-pan-y min-h-0">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-1">
                        Transaction Failed
                      </p>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {error}
                      </p>
                      {retryCount > 0 && (
                        <p className="text-red-500 dark:text-red-500 text-xs mt-1">
                          Retry attempt: {retryCount}
                        </p>
                      )}
                    </div>
                    {retryCount < 3 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="ml-2 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {mode === "borrow" &&
                !userGlobalData &&
                activeAccount?.address && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                      Loading user data... Please wait before borrowing.
                    </p>
                  </div>
                )}

              <SupplyBorrowForm
                mode={mode}
                asset={asset}
                walletBalance={propWalletBalance}
                walletBalanceUSD={propWalletBalanceUSD}
                availableToSupplyOrBorrow={
                  mode === "borrow" && calculatedMaxBorrow !== null
                    ? calculatedMaxBorrow
                    : assetData.liquidity
                }
                supplyAPY={assetData.supplyAPY}
                totalSupply={assetData.totalSupply}
                maxTotalDeposits={assetData.maxTotalDeposits}
                userGlobalData={userGlobalData}
                collateralFactor={assetData.collateralFactor}
                onAmountChange={handleAmountChange}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                disabled={mode === "borrow" && !userGlobalData}
                hideButton={true}
                isLoadingMaxBorrow={isLoadingMaxBorrow}
                maxBorrowError={maxBorrowError}
              />

              <SupplyBorrowStats
                mode={mode}
                asset={asset}
                assetData={assetData}
                userGlobalData={userGlobalData}
                depositAmount={mode === "deposit" ? parseFloat(amount) || 0 : 0}
                userBorrowBalance={userBorrowBalance}
                userDepositBalance={userDepositBalance}
                isSToken={assetData.isSToken || false}
              />
            </div>

            {/* Action Buttons */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 flex gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  isLoading ||
                  (mode === "borrow" && !userGlobalData)
                }
                className={`flex-1 font-semibold h-11 ${
                  mode === "deposit"
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : "bg-whale-gold hover:bg-whale-gold/90 text-black"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  `${mode === "deposit" ? "Deposit" : "Borrow"} ${asset}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupplyBorrowModal; // Updated with userDepositBalance prop
