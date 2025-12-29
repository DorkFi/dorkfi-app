import { useEffect, useRef } from "react";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import BorrowModal from "./BorrowModal";
import RepayModal from "./RepayModal";
import SupplyBorrowModal from "./SupplyBorrowModal";
import MintModal from "./MintModal"; // Added MintModal import
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  withdraw,
  repay,
  fetchUserWalletBalance,
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
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/utils/errorUtils";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { updateTransactionMetadata } from "@/utils/transactionUtils";

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
  nTokenBalance?: number;
}

interface Borrow {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
  interest?: number; // Accrued interest for borrow positions
}

interface PortfolioModalsProps {
  depositModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  };
  withdrawModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  };
  borrowModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  };
  repayModal: {
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  };
  deposits: Deposit[];
  borrows: Borrow[];
  walletBalances: Record<string, { balance: number; balanceUSD: number }>;
  marketData: any[];
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
    healthFactorIndex?: number;
  } | null;
  userBorrowBalance?: number;
  onCloseDepositModal: () => void;
  onCloseWithdrawModal: () => void;
  onCloseBorrowModal: () => void;
  onCloseRepayModal: () => void;
  onRefreshWalletBalance?: (asset: string, networkId?: string) => void;
  onRefreshMarket?: () => void;
}

const PortfolioModals = ({
  depositModal,
  withdrawModal,
  borrowModal,
  repayModal,
  deposits,
  borrows,
  walletBalances,
  marketData,
  userGlobalData,
  userBorrowBalance,
  onCloseDepositModal,
  onCloseWithdrawModal,
  onCloseBorrowModal,
  onCloseRepayModal,
  onRefreshWalletBalance,
  onRefreshMarket,
}: PortfolioModalsProps) => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();
  const getMarketStatsForDeposit = (asset: string, poolId?: string) => {
    // Find matching markets - prefer poolId match if provided
    let market;
    if (poolId) {
      // If poolId is provided, match by both symbol and poolId
      market = marketData.find(
        (m) => m.symbol === asset && m.poolId === poolId
      );
    }

    // If no poolId match or poolId not provided, find by symbol
    // For tokens with multiple markets, prefer the one with higher totalDeposits (more active market)
    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        // Multiple markets found - prefer the one with higher totalDeposits
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    // Find matching deposit - prefer poolId match if provided
    let deposit;
    if (poolId) {
      // If poolId is provided, match by both asset and poolId
      deposit = deposits.find((d) => d.asset === asset && d.poolId === poolId);
    }

    // If no poolId match or poolId not provided, find by asset only
    if (!deposit) {
      deposit = deposits.find((d) => d.asset === asset);
    }

    return {
      supplyAPY:
        market?.apyCalculation?.apy ||
        (market?.supplyRate ? market.supplyRate * 100 : 0) ||
        deposit?.apy ||
        0,
      utilization: market?.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market?.collateralFactor
        ? market.collateralFactor * 100
        : 0,
      tokenPrice: market?.price
        ? parseFloat(market.price) / Math.pow(10, 6)
        : deposit?.tokenPrice || 1,
      accruedInterest:
        deposit?.accruedInterest !== undefined
          ? deposit.accruedInterest
          : undefined,
    };
  };

  const getMarketStatsForBorrow = (asset: string, poolId?: string) => {
    // Find matching markets - prefer poolId match if provided
    let market;
    if (poolId) {
      // If poolId is provided, match by both symbol and poolId
      market = marketData.find(
        (m) => m.symbol === asset && m.poolId === poolId
      );
    }

    // If no poolId match or poolId not provided, find by symbol
    // For tokens with multiple markets, prefer the one with higher totalDeposits (more active market)
    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        // Multiple markets found - prefer the one with higher totalDeposits
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    // Find matching borrow - prefer poolId match if provided
    let borrow;
    if (poolId) {
      // If poolId is provided, match by both asset and poolId
      borrow = borrows.find((b) => b.asset === asset && b.poolId === poolId);
    }

    // If no poolId match or poolId not provided, find by asset only
    if (!borrow) {
      borrow = borrows.find((b) => b.asset === asset);
    }

    // Calculate health factor from userGlobalData
    // Use healthFactorIndex if available (calculated with individual market collateral factors)
    // Otherwise calculate from totalCollateral and totalBorrowed with 80% collateral factor
    let healthFactor = 0;
    if (userGlobalData) {
      if (userGlobalData.healthFactorIndex !== undefined) {
        healthFactor = userGlobalData.healthFactorIndex;
        // healthFactorIndex is already capped at 3.0 in the calculation
      } else if (userGlobalData.totalBorrowValue > 0) {
        // Fallback: calculate with standard 80% collateral factor
        const collateralFactor = 0.8;
        healthFactor =
          (userGlobalData.totalCollateralValue * collateralFactor) /
          userGlobalData.totalBorrowValue;
        healthFactor = Math.min(healthFactor, 3.0); // Cap at 3.0 for display (consistent with Portfolio)
      } else if (userGlobalData.totalCollateralValue > 0) {
        // No borrows = excellent health (capped at 3.0)
        healthFactor = 3.0;
      }
    }

    // Calculate current LTV (Loan-to-Value ratio)
    const currentLTV =
      userGlobalData && userGlobalData.totalCollateralValue > 0
        ? (userGlobalData.totalBorrowValue /
            userGlobalData.totalCollateralValue) *
          100
        : 0;

    // Calculate liquidation margin
    // Liquidation margin = Liquidation Threshold - Current LTV
    // Use weighted liquidation threshold from borrowed assets, or market's threshold, or default 85%
    const liquidationThreshold = market?.liquidationThreshold
      ? market.liquidationThreshold * 100
      : 85; // Default 85%
    const liquidationMargin = Math.max(0, liquidationThreshold - currentLTV);

    const stats = {
      borrowAPY:
        market?.borrowApyCalculation?.apy ||
        (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0) ||
        borrow?.apy ||
        0,
      liquidationMargin: liquidationMargin,
      healthFactor: healthFactor,
      currentLTV: currentLTV,
      tokenPrice: market?.price
        ? parseFloat(market.price) / Math.pow(10, 6)
        : borrow?.tokenPrice || 1,
    };

    // Debug logging for health factor calculation
    console.log("[PortfolioModals] getMarketStatsForBorrow Debug:", {
      asset,
      marketFound: !!market,
      borrowFound: !!borrow,
      userGlobalData: userGlobalData
        ? {
            totalCollateralValue: userGlobalData.totalCollateralValue,
            totalBorrowValue: userGlobalData.totalBorrowValue,
            healthFactorIndex: userGlobalData.healthFactorIndex,
          }
        : null,
      marketData: market
        ? {
            liquidationThreshold: market.liquidationThreshold,
            price: market.price,
            borrowRateCurrent: market.borrowRateCurrent,
            borrowApyCalculation: market.borrowApyCalculation,
          }
        : null,
      calculatedStats: stats,
      calculation: {
        healthFactor: {
          source:
            userGlobalData?.healthFactorIndex !== undefined
              ? "userGlobalData.healthFactorIndex"
              : userGlobalData
              ? "calculated from userGlobalData (80% collateral factor)"
              : "fallback (0)",
          value: healthFactor,
        },
        currentLTV: {
          source: userGlobalData
            ? "calculated from userGlobalData"
            : "fallback (0)",
          value: currentLTV,
        },
        liquidationMargin: {
          source: market?.liquidationThreshold
            ? `market.liquidationThreshold (${liquidationThreshold}%) - currentLTV (${currentLTV}%)`
            : "fallback calculation",
          value: liquidationMargin,
        },
      },
    });

    return stats;
  };

  const getAssetData = (asset: string, poolId?: string, networkId?: string) => {
    // Find matching markets - prefer poolId match if provided
    let market;
    if (poolId) {
      // If poolId is provided, match by both symbol and poolId
      market = marketData.find(
        (m) => m.symbol === asset && m.poolId === poolId
      );
    }

    // If no poolId match or poolId not provided, find by symbol
    // For tokens with multiple markets, prefer the one with higher totalDeposits (more active market)
    if (!market) {
      const matchingMarkets = marketData.filter((m) => m.symbol === asset);
      if (matchingMarkets.length > 1) {
        // Multiple markets found - prefer the one with higher totalDeposits
        market = matchingMarkets.reduce((prev, current) => {
          const prevDeposits = parseFloat(prev.totalDeposits || "0");
          const currentDeposits = parseFloat(current.totalDeposits || "0");
          return currentDeposits > prevDeposits ? current : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    // Find matching deposit - prefer poolId match if provided
    let deposit;
    if (poolId) {
      // If poolId is provided, match by both asset and poolId
      deposit = deposits.find((d) => d.asset === asset && d.poolId === poolId);
    }

    // If no poolId match or poolId not provided, find by asset only
    if (!deposit) {
      deposit = deposits.find((d) => d.asset === asset);
    }

    // If no market found but we have deposit data, create minimal asset data from deposit
    // This allows the modal to open even when market data isn't available for cross-network assets
    if (!market && deposit) {
      const tokenPrice = deposit.tokenPrice || 1;
      return {
        icon: getTokenImagePath(asset),
        totalSupply: 0,
        totalSupplyUSD: 0,
        totalBorrow: 0,
        totalBorrowUSD: 0,
        supplyAPY: deposit.apy || 0,
        borrowAPY: 0,
        utilization: 0,
        collateralFactor: 80, // Default 80%
        liquidationThreshold: 85, // Default 85%
        tokenPrice: tokenPrice,
        walletBalance: 0,
        walletBalanceUSD: 0,
      };
    }

    if (!market) return null;

    const tokenPrice = market.price
      ? parseFloat(market.price) / Math.pow(10, 6)
      : 1;
    const totalSupply = parseFloat(market.totalDeposits) || 0;
    const totalBorrow = parseFloat(market.totalBorrows) || 0;

    return {
      icon: getTokenImagePath(asset),
      totalSupply,
      totalSupplyUSD: totalSupply * tokenPrice,
      supplyAPY:
        market.apyCalculation?.apy ||
        (market.supplyRate ? market.supplyRate * 100 : 0),
      totalBorrow,
      totalBorrowUSD: totalBorrow * tokenPrice,
      borrowAPY:
        market.borrowApyCalculation?.apy ||
        (market.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0),
      utilization: market.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market.collateralFactor
        ? market.collateralFactor * 100
        : 0,
      liquidity: totalSupply - totalBorrow,
      liquidityUSD: (totalSupply - totalBorrow) * tokenPrice,
      maxTotalDeposits: parseFloat(market.maxTotalDeposits) || 0,
    };
  };

  const handleWithdrawSubmit = async (amount: string) => {
    if (!activeAccount?.address || !withdrawModal.asset) {
      console.error("No active account or asset for withdrawal");
      return;
    }

    try {
      console.log(`Withdrawing ${amount} ${withdrawModal.asset}`);

      // Find the deposit to get its network
      const deposit = withdrawModal.poolId
        ? deposits.find(
            (d) =>
              d.asset === withdrawModal.asset &&
              d.poolId === withdrawModal.poolId
          )
        : deposits.find((d) => d.asset === withdrawModal.asset);

      // Use the deposit's network if available, otherwise fall back to currentNetwork
      const networkToUse =
        withdrawModal.network || (deposit as any)?.network || currentNetwork;

      // Get token configuration using the deposit's network
      const tokens = getAllTokensWithDisplayInfo(networkToUse);
      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      const token = withdrawModal.poolId
        ? tokens.find(
            (t) =>
              t.symbol === withdrawModal.asset &&
              t.poolId === withdrawModal.poolId
          )
        : tokens.find((t) => t.symbol === withdrawModal.asset);

      if (!token) {
        throw new Error(
          `Token not found for ${withdrawModal.asset}${
            withdrawModal.poolId ? ` with poolId ${withdrawModal.poolId}` : ""
          } on network ${networkToUse}`
        );
      }

      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token
          ? (token as any).originalSymbol
          : withdrawModal.asset;
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse,
        originalSymbol
      );
      if (!originalTokenConfigRaw) {
        throw new Error(
          `Token config not found for ${withdrawModal.asset} (originalSymbol: ${originalSymbol}) on network ${networkToUse}`
        );
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Token config not found for ${withdrawModal.asset} with poolId ${token.poolId} on network ${networkToUse}`
        );
      }

      console.log("Withdraw parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId,
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount,
        userAddress: activeAccount.address,
        networkId: networkToUse,
      });

      // Call the lending service withdraw method (pass amount as string like PreFi)
      const result = await withdraw(
        token.poolId,
        token.underlyingContractId,
        originalTokenConfig.tokenStandard,
        amount,
        activeAccount.address,
        networkToUse
      );

      if (!result.success) {
        if ((result as any).error) {
          const message = (result as any).error.toLowerCase();
          if (message.includes("insufficient liquidity for withdraw")) {
            throw new Error(message);
          }
          throw new Error((result as any).error || "Withdraw failed");
        }
      }

      console.log("Withdraw result:", result);

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
        (result as any).txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the deposit's network (not currentNetwork)
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as any
      );
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
      const poolTxnID = decodedStxns.reverse().find((txn: any) => txn.txn.type === "appl" && Number(txn.txn.applicationCall.appIndex) === parseInt(token.poolId))?.txn.txID();
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

      console.log("Withdraw transaction confirmed:", res);

      // Refresh wallet balance after successful withdrawal
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(withdrawModal.asset);
      }

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
          if (onRefreshMarket) {
            setTimeout(() => {
              onRefreshMarket();
            }, 1000);
          }
        })
        .catch((error) => {
          console.error(
            "Error calling fetchFreshUserData after withdraw:",
            error
          );
        });

      // Close the modal
      onCloseWithdrawModal();
    } catch (error) {
      console.error("Withdraw error:", error);
      const errorMessage = getUserFriendlyError(error);

      // Show error toast to the user
      toast({
        title: "Withdraw Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // Re-throw the error so WithdrawModal can catch it and not show success modal
      throw error;
    }
  };

  // Track if we've already fetched balance for this modal open/asset combination
  const lastFetchedRef = useRef<{ isOpen: boolean; asset: string | null }>({
    isOpen: false,
    asset: null,
  });

  // Fetch wallet balance when repay modal opens
  useEffect(() => {
    if (
      repayModal.isOpen &&
      repayModal.asset &&
      activeAccount?.address &&
      onRefreshWalletBalance &&
      // Only fetch if modal just opened or asset changed
      (!lastFetchedRef.current.isOpen ||
        lastFetchedRef.current.asset !== repayModal.asset)
    ) {
      console.log(
        `[PortfolioModals] Fetching wallet balance for ${repayModal.asset} when repay modal opens`
      );
      onRefreshWalletBalance(repayModal.asset, repayModal.network);
      lastFetchedRef.current = { isOpen: true, asset: repayModal.asset };
    } else if (!repayModal.isOpen) {
      // Reset when modal closes
      lastFetchedRef.current = { isOpen: false, asset: null };
    }
  }, [
    repayModal.isOpen,
    repayModal.asset,
    activeAccount?.address,
    onRefreshWalletBalance,
  ]);

  const handleRepaySubmit = async (amount: string) => {
    if (!activeAccount?.address || !repayModal.asset) {
      console.error("No active account or asset for repayment");
      return;
    }

    try {
      console.log(`Repaying ${amount} ${repayModal.asset}`);

      // Find the borrow to get its network
      const borrow = repayModal.poolId
        ? borrows.find(
            (b) =>
              b.asset === repayModal.asset && b.poolId === repayModal.poolId
          )
        : borrows.find((b) => b.asset === repayModal.asset);

      // Use the borrow's network if available, otherwise fall back to currentNetwork
      const networkToUse =
        repayModal.network || (borrow as any)?.network || currentNetwork;

      // Get token configuration using the borrow's network
      const tokens = getAllTokensWithDisplayInfo(networkToUse);
      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      const token = repayModal.poolId
        ? tokens.find(
            (t) =>
              t.symbol === repayModal.asset && t.poolId === repayModal.poolId
          )
        : tokens.find((t) => t.symbol === repayModal.asset);

      if (!token) {
        throw new Error(
          `Token not found for ${repayModal.asset}${
            repayModal.poolId ? ` with poolId ${repayModal.poolId}` : ""
          } on network ${networkToUse}`
        );
      }

      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token
          ? (token as any).originalSymbol
          : repayModal.asset;
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse,
        originalSymbol
      );
      if (!originalTokenConfigRaw) {
        throw new Error(
          `Token config not found for ${repayModal.asset} (originalSymbol: ${originalSymbol}) on network ${networkToUse}`
        );
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      if (!originalTokenConfig) {
        throw new Error(
          `Token config not found for ${repayModal.asset} with poolId ${token.poolId} on network ${networkToUse}`
        );
      }

      console.log("Repay parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId, // Use marketId first like PreFi
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount, // Pass amount as string (not atomic units)
        userAddress: activeAccount.address,
        networkId: networkToUse,
      });

      // Call the lending service repay method (pass amount as string like PreFi)
      const result = await repay(
        token.poolId,
        token.underlyingContractId, // Use underlyingContractId
        originalTokenConfig.tokenStandard,
        amount, // Pass amount as string
        activeAccount.address,
        networkToUse
      );

      if (!result.success) {
        throw new Error((result as any).error || "Repay failed");
      }

      console.log("Repay result:", result);

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the transaction`,
        duration: 10000,
      });

      // Sign and send transactions
      const stxns = await signTransactions(
        (result as any).txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the borrow's network (not currentNetwork)
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as any
      );
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
      const poolTxnID = decodedStxns.reverse().find((txn: any) => txn.txn.type === "appl" && Number(txn.txn.applicationCall.appIndex) === parseInt(token.poolId))?.txn.txID();
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

      console.log("Repay transaction confirmed:", res);

      // Refresh wallet balance after successful repayment
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(repayModal.asset, networkToUse);
      }

      dorkfiAPIService
        .fetchFreshUserData(
          activeAccount.address,
          networkToUse,
          parseInt(token.poolId),
          parseInt(token.underlyingContractId)
        )
        .then(() => {
          setTimeout(() => {
            onRefreshMarket();
          }, 1000);
        })
        .catch((error) => {
          console.error("Error calling fetchFreshUserData after repay:", error);
        });

      // Return the transaction ID so RepayModal can use it
      return res.txid;
    } catch (error) {
      console.error("Repay error:", error);
      const errorMessage = getUserFriendlyError(error);

      // Show error toast to the user
      toast({
        title: "Repay Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // Re-throw the error so RepayModal can catch it and not show success modal
      throw error;
    }
  };

  return (
    <>
      {depositModal.isOpen &&
        depositModal.asset &&
        getAssetData(
          depositModal.asset,
          depositModal.poolId,
          depositModal.network
        ) && (
          <SupplyBorrowModal
            isOpen={depositModal.isOpen}
            onClose={onCloseDepositModal}
            asset={depositModal.asset}
            poolId={depositModal.poolId}
            network={depositModal.network}
            mode="deposit"
            assetData={getAssetData(
              depositModal.asset,
              depositModal.poolId,
              depositModal.network
            )}
            walletBalance={
              depositModal.network
                ? walletBalances[
                    `${depositModal.network}-${depositModal.asset}`
                  ]?.balance ||
                  walletBalances[depositModal.asset]?.balance ||
                  0
                : walletBalances[depositModal.asset]?.balance || 0
            }
            walletBalanceUSD={
              depositModal.network
                ? walletBalances[
                    `${depositModal.network}-${depositModal.asset}`
                  ]?.balanceUSD ||
                  walletBalances[depositModal.asset]?.balanceUSD ||
                  0
                : walletBalances[depositModal.asset]?.balanceUSD || 0
            }
            onTransactionSuccess={async () => {
              // Refresh wallet balance immediately after successful transaction
              if (depositModal.asset && onRefreshWalletBalance) {
                onRefreshWalletBalance(depositModal.asset);
              }

              // Call fetchFreshUserData after deposit
              if (activeAccount?.address && depositModal.asset) {
                try {
                  // Find the market to get appId and marketId
                  const networkToUse = depositModal.network || currentNetwork;
                  let market;
                  if (depositModal.poolId) {
                    market = marketData.find(
                      (m) =>
                        m.symbol === depositModal.asset &&
                        m.poolId === depositModal.poolId
                    );
                  } else {
                    const matchingMarkets = marketData.filter(
                      (m) => m.symbol === depositModal.asset
                    );
                    if (matchingMarkets.length > 1) {
                      market = matchingMarkets.reduce((prev, current) => {
                        const prevDeposits = parseFloat(
                          prev.totalDeposits || "0"
                        );
                        const currentDeposits = parseFloat(
                          current.totalDeposits || "0"
                        );
                        return currentDeposits > prevDeposits ? current : prev;
                      });
                    } else {
                      market = matchingMarkets[0];
                    }
                  }

                  // Get appId from market (poolId or appId field)
                  const appId =
                    market?.appId || market?.poolId || depositModal.poolId;
                  // Get marketId from marketInfo or token config
                  let marketId =
                    market?.marketInfo?.marketId || market?.marketId;

                  // If marketId not found in market, try to get it from token config
                  if (!marketId) {
                    const tokens = getAllTokensWithDisplayInfo(networkToUse);
                    const token = depositModal.poolId
                      ? tokens.find(
                          (t) =>
                            t.symbol === depositModal.asset &&
                            t.poolId === depositModal.poolId
                        )
                      : tokens.find((t) => t.symbol === depositModal.asset);
                    marketId = token?.underlyingContractId;
                  }

                  if (appId && marketId) {
                    const appIdNum =
                      typeof appId === "string" ? parseInt(appId) : appId;
                    const marketIdNum =
                      typeof marketId === "string"
                        ? parseInt(marketId)
                        : marketId;

                    console.log("Calling fetchFreshUserData after deposit:", {
                      userAddress: activeAccount.address,
                      network: networkToUse,
                      appId: appIdNum,
                      marketId: marketIdNum,
                    });

                    dorkfiAPIService
                      .fetchFreshUserData(
                        activeAccount.address,
                        networkToUse,
                        appIdNum,
                        marketIdNum
                      )
                      .then(() => {
                        onRefreshMarket();
                      })
                      .catch((error) => {
                        console.error(
                          "Error calling fetchFreshUserData after deposit:",
                          error
                        );
                      });
                  } else {
                    console.warn(
                      "Could not find appId or marketId for fetchFreshUserData:",
                      {
                        asset: depositModal.asset,
                        poolId: depositModal.poolId,
                        network: networkToUse,
                        appId,
                        marketId,
                      }
                    );
                  }
                } catch (error) {
                  console.error(
                    "Error calling fetchFreshUserData after deposit:",
                    error
                  );
                  // Don't throw - this is a background refresh, shouldn't block the UI
                }

                // Refresh market data after successful deposit
                if (onRefreshMarket) {
                  setTimeout(() => {
                    onRefreshMarket();
                  }, 1000); // Small delay to ensure transaction is fully processed
                }
              }
            }}
          />
        )}

      {withdrawModal.isOpen &&
        withdrawModal.asset &&
        (() => {
          // Find the correct deposit - prefer poolId match if provided
          const deposit = withdrawModal.poolId
            ? deposits.find(
                (d) =>
                  d.asset === withdrawModal.asset &&
                  d.poolId === withdrawModal.poolId
              )
            : deposits.find((d) => d.asset === withdrawModal.asset);

          return (
            <WithdrawModal
              isOpen={withdrawModal.isOpen}
              onClose={onCloseWithdrawModal}
              tokenSymbol={withdrawModal.asset}
              tokenIcon={getTokenImagePath(withdrawModal.asset)}
              currentlyDeposited={deposit?.balance || 0}
              nTokenBalance={deposit?.nTokenBalance}
              marketStats={getMarketStatsForDeposit(
                withdrawModal.asset,
                withdrawModal.poolId
              )}
              onSubmit={handleWithdrawSubmit}
              onRefreshBalance={() => {
                // Refresh market data to update nToken balance
                if (onRefreshMarket) {
                  onRefreshMarket();
                }
              }}
            />
          );
        })()}

      {borrowModal.isOpen &&
        borrowModal.asset &&
        getAssetData(borrowModal.asset, borrowModal.poolId) &&
        (borrowModal.asset === "WAD" ? (
          <MintModal
            isOpen={borrowModal.isOpen}
            onClose={onCloseBorrowModal}
            asset={borrowModal.asset}
            poolId={borrowModal.poolId}
            network={borrowModal.network}
            assetData={getAssetData(borrowModal.asset, borrowModal.poolId)}
            userGlobalData={userGlobalData}
            userBorrowBalance={userBorrowBalance || 0}
            onTransactionSuccess={() => {
              if (onRefreshMarket) {
                setTimeout(() => {
                  onRefreshMarket();
                }, 1000);
              }
            }}
          />
        ) : (
          <SupplyBorrowModal
            isOpen={borrowModal.isOpen}
            onClose={onCloseBorrowModal}
            asset={borrowModal.asset}
            poolId={borrowModal.poolId}
            network={borrowModal.network}
            mode="borrow"
            assetData={getAssetData(borrowModal.asset, borrowModal.poolId)}
            userGlobalData={userGlobalData}
            userBorrowBalance={userBorrowBalance || 0}
            onTransactionSuccess={() => {
              if (onRefreshMarket) {
                setTimeout(() => {
                  onRefreshMarket();
                }, 1000);
              }
            }}
          />
        ))}

      {repayModal.isOpen &&
        repayModal.asset &&
        (() => {
          // Find the correct borrow - prefer poolId match if provided
          const borrow = repayModal.poolId
            ? borrows.find(
                (b) =>
                  b.asset === repayModal.asset && b.poolId === repayModal.poolId
              )
            : borrows.find((b) => b.asset === repayModal.asset);

          return (
            <RepayModal
              isOpen={repayModal.isOpen}
              onClose={onCloseRepayModal}
              tokenSymbol={repayModal.asset}
              tokenIcon={getTokenImagePath(repayModal.asset)}
              currentBorrow={borrow?.balance || 0}
              accruedInterest={borrow?.interest || 0}
              walletBalance={walletBalances[repayModal.asset]?.balance || 0}
              marketStats={getMarketStatsForBorrow(
                repayModal.asset,
                repayModal.poolId
              )}
              lastUpdateTime={userGlobalData?.lastUpdateTime}
              network={
                repayModal.network || (borrow as any)?.network || currentNetwork
              }
              onSubmit={handleRepaySubmit}
            />
          );
        })()}
    </>
  );
};

export default PortfolioModals;
