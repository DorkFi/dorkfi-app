
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import BorrowModal from "./BorrowModal";
import RepayModal from "./RepayModal";
import SupplyBorrowModal from "./SupplyBorrowModal";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { withdraw, repay, fetchUserWalletBalance } from "@/services/lendingService";
import { getTokenConfig, getAllTokensWithDisplayInfo } from "@/config";
import algorandService from "@/services/algorandService";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/utils/errorUtils";

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
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
  depositModal: { isOpen: boolean; asset: string | null };
  withdrawModal: { isOpen: boolean; asset: string | null };
  borrowModal: { isOpen: boolean; asset: string | null };
  repayModal: { isOpen: boolean; asset: string | null };
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
  onRefreshWalletBalance?: (asset: string) => void;
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
  onRefreshMarket
}: PortfolioModalsProps) => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();
  const getMarketStatsForDeposit = (asset: string) => {
    const market = marketData.find(m => m.symbol === asset);
    const deposit = deposits.find(d => d.asset === asset);
    
    return {
      supplyAPY: market?.apyCalculation?.apy || 
                 (market?.supplyRate ? market.supplyRate * 100 : 0) ||
                 deposit?.apy || 0,
      utilization: market?.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market?.collateralFactor ? market.collateralFactor * 100 : 0,
      tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 
                  deposit?.tokenPrice || 1
    };
  };

  const getMarketStatsForBorrow = (asset: string) => {
    const market = marketData.find(m => m.symbol === asset);
    const borrow = borrows.find(b => b.asset === asset);
    
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
        healthFactor = (userGlobalData.totalCollateralValue * collateralFactor) / userGlobalData.totalBorrowValue;
        healthFactor = Math.min(healthFactor, 3.0); // Cap at 3.0 for display (consistent with Portfolio)
      } else if (userGlobalData.totalCollateralValue > 0) {
        // No borrows = excellent health (capped at 3.0)
        healthFactor = 3.0;
      }
    }
    
    // Calculate current LTV (Loan-to-Value ratio)
    const currentLTV = userGlobalData && userGlobalData.totalCollateralValue > 0
      ? (userGlobalData.totalBorrowValue / userGlobalData.totalCollateralValue) * 100
      : 0;
    
    // Calculate liquidation margin
    // Liquidation margin = Liquidation Threshold - Current LTV
    // Use weighted liquidation threshold from borrowed assets, or market's threshold, or default 85%
    const liquidationThreshold = market?.liquidationThreshold 
      ? market.liquidationThreshold * 100 
      : 85; // Default 85%
    const liquidationMargin = Math.max(0, liquidationThreshold - currentLTV);
    
    const stats = {
      borrowAPY: market?.borrowApyCalculation?.apy || 
                 (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0) ||
                 borrow?.apy || 0,
      liquidationMargin: liquidationMargin,
      healthFactor: healthFactor,
      currentLTV: currentLTV,
      tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 
                  borrow?.tokenPrice || 1
    };

    // Debug logging for health factor calculation
    console.log("[PortfolioModals] getMarketStatsForBorrow Debug:", {
      asset,
      marketFound: !!market,
      borrowFound: !!borrow,
      userGlobalData: userGlobalData ? {
        totalCollateralValue: userGlobalData.totalCollateralValue,
        totalBorrowValue: userGlobalData.totalBorrowValue,
        healthFactorIndex: userGlobalData.healthFactorIndex,
      } : null,
      marketData: market ? {
        liquidationThreshold: market.liquidationThreshold,
        price: market.price,
        borrowRateCurrent: market.borrowRateCurrent,
        borrowApyCalculation: market.borrowApyCalculation
      } : null,
      calculatedStats: stats,
      calculation: {
        healthFactor: {
          source: userGlobalData?.healthFactorIndex !== undefined 
            ? "userGlobalData.healthFactorIndex" 
            : userGlobalData 
            ? "calculated from userGlobalData (80% collateral factor)"
            : "fallback (0)",
          value: healthFactor,
        },
        currentLTV: {
          source: userGlobalData ? "calculated from userGlobalData" : "fallback (0)",
          value: currentLTV,
        },
        liquidationMargin: {
          source: market?.liquidationThreshold 
            ? `market.liquidationThreshold (${liquidationThreshold}%) - currentLTV (${currentLTV}%)`
            : "fallback calculation",
          value: liquidationMargin,
        }
      }
    });

    return stats;
  };

  const getAssetData = (asset: string) => {
    const market = marketData.find(m => m.symbol === asset);
    const deposit = deposits.find(d => d.asset === asset);
    
    if (!market) return null;
    
    const tokenPrice = market.price ? parseFloat(market.price) / Math.pow(10, 6) : 1;
    const totalSupply = parseFloat(market.totalDeposits) || 0;
    const totalBorrow = parseFloat(market.totalBorrows) || 0;
    
    return {
      icon: getTokenImagePath(asset),
      totalSupply,
      totalSupplyUSD: totalSupply * tokenPrice,
      supplyAPY: market.apyCalculation?.apy || (market.supplyRate ? market.supplyRate * 100 : 0),
      totalBorrow,
      totalBorrowUSD: totalBorrow * tokenPrice,
      borrowAPY: market.borrowApyCalculation?.apy || (market.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0),
      utilization: market.utilizationRate ? market.utilizationRate * 100 : 0,
      collateralFactor: market.collateralFactor ? market.collateralFactor * 100 : 0,
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

      // Get token configuration
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === withdrawModal.asset);
      
      if (!token) {
        throw new Error(`Token not found for ${withdrawModal.asset}`);
      }

      const originalTokenConfig = getTokenConfig(currentNetwork, withdrawModal.asset);
      if (!originalTokenConfig) {
        throw new Error(`Token config not found for ${withdrawModal.asset}`);
      }

      console.log("Withdraw parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId,
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount,
        userAddress: activeAccount.address,
        networkId: currentNetwork,
      });

      // Call the lending service withdraw method (pass amount as string like PreFi)
      const result = await withdraw(
        token.poolId,
        token.underlyingContractId,
        originalTokenConfig.tokenStandard,
        amount,
        activeAccount.address,
        currentNetwork
      );

      if (!result.success) {
        throw new Error((result as any).error || "Withdraw failed");
      }

      console.log("Withdraw result:", result);

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

      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      console.log("Withdraw transaction confirmed:", res);

      // Refresh wallet balance after successful withdrawal
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(withdrawModal.asset);
      }

      // Refresh market data after successful withdrawal (like PreFi)
      if (onRefreshMarket) {
        setTimeout(() => {
          onRefreshMarket();
        }, 1000); // Small delay to ensure transaction is fully processed
      }

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

  const handleRepaySubmit = async (amount: string) => {
    if (!activeAccount?.address || !repayModal.asset) {
      console.error("No active account or asset for repayment");
      return;
    }

    try {
      console.log(`Repaying ${amount} ${repayModal.asset}`);

      // Get token configuration
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === repayModal.asset);
      
      if (!token) {
        throw new Error(`Token not found for ${repayModal.asset}`);
      }

      const originalTokenConfig = getTokenConfig(currentNetwork, repayModal.asset);
      if (!originalTokenConfig) {
        throw new Error(`Token config not found for ${repayModal.asset}`);
      }

      console.log("Repay parameters:", {
        poolId: token.poolId,
        marketId: token.underlyingContractId, // Use marketId first like PreFi
        tokenStandard: originalTokenConfig.tokenStandard,
        amount: amount, // Pass amount as string (not atomic units)
        userAddress: activeAccount.address,
        networkId: currentNetwork,
      });

      // Call the lending service repay method (pass amount as string like PreFi)
      const result = await repay(
        token.poolId,
        token.underlyingContractId, // Use underlyingContractId
        originalTokenConfig.tokenStandard,
        amount, // Pass amount as string
        activeAccount.address,
        currentNetwork
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

      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      console.log("Repay transaction confirmed:", res);

      // Refresh wallet balance after successful repayment
      if (onRefreshWalletBalance) {
        onRefreshWalletBalance(repayModal.asset);
      }

      // Refresh market data after successful repayment (like PreFi)
      if (onRefreshMarket) {
        setTimeout(() => {
          onRefreshMarket();
        }, 1000); // Small delay to ensure transaction is fully processed
      }

      // Don't close the modal here - let RepayModal handle the success state
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
      {depositModal.isOpen && depositModal.asset && getAssetData(depositModal.asset) && (
        <SupplyBorrowModal
          isOpen={depositModal.isOpen}
          onClose={onCloseDepositModal}
          asset={depositModal.asset}
          mode="deposit"
          assetData={getAssetData(depositModal.asset)}
          walletBalance={walletBalances[depositModal.asset]?.balance || 0}
          walletBalanceUSD={walletBalances[depositModal.asset]?.balanceUSD || 0}
          onTransactionSuccess={() => {
            // Refresh wallet balance immediately after successful transaction
            if (depositModal.asset && onRefreshWalletBalance) {
              onRefreshWalletBalance(depositModal.asset);
            }
            // Refresh market data after successful deposit
            if (onRefreshMarket) {
              setTimeout(() => {
                onRefreshMarket();
              }, 1000); // Small delay to ensure transaction is fully processed
            }
          }}
        />
      )}

      {withdrawModal.isOpen && withdrawModal.asset && (
        <WithdrawModal
          isOpen={withdrawModal.isOpen}
          onClose={onCloseWithdrawModal}
          tokenSymbol={withdrawModal.asset}
          tokenIcon={getTokenImagePath(withdrawModal.asset)}
          currentlyDeposited={deposits.find(d => d.asset === withdrawModal.asset)?.balance || 0}
          marketStats={getMarketStatsForDeposit(withdrawModal.asset)}
          onSubmit={handleWithdrawSubmit}
          onRefreshBalance={() => {
            // Refresh market data to update nToken balance
            if (onRefreshMarket) {
              onRefreshMarket();
            }
          }}
        />
      )}

      {borrowModal.isOpen && borrowModal.asset && getAssetData(borrowModal.asset) && (
        <SupplyBorrowModal
          isOpen={borrowModal.isOpen}
          onClose={onCloseBorrowModal}
          asset={borrowModal.asset}
          mode="borrow"
          assetData={getAssetData(borrowModal.asset)}
          userGlobalData={userGlobalData}
          userBorrowBalance={userBorrowBalance || 0}
          onTransactionSuccess={() => {
            // Refresh market data after successful borrow
            if (onRefreshMarket) {
              setTimeout(() => {
                onRefreshMarket();
              }, 1000); // Small delay to ensure transaction is fully processed
            }
          }}
        />
      )}

      {repayModal.isOpen && repayModal.asset && (
        <RepayModal
          isOpen={repayModal.isOpen}
          onClose={onCloseRepayModal}
          tokenSymbol={repayModal.asset}
          tokenIcon={getTokenImagePath(repayModal.asset)}
          currentBorrow={borrows.find(b => b.asset === repayModal.asset)?.balance || 0}
          accruedInterest={borrows.find(b => b.asset === repayModal.asset)?.interest || 0}
          walletBalance={walletBalances[repayModal.asset]?.balance || 0}
          marketStats={getMarketStatsForBorrow(repayModal.asset)}
          lastUpdateTime={userGlobalData?.lastUpdateTime}
          onSubmit={handleRepaySubmit}
        />
      )}
    </>
  );
};

export default PortfolioModals;
