import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  fetchUserGlobalData,
  fetchAllMarkets,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
} from "@/services/lendingService";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";
import { getTokenConfig } from "@/config";
import { getAllTokensWithDisplayInfo } from "@/config";

export interface PortfolioPosition {
  asset: string;
  icon: string;
  balance: number;
  nTokenBalance?: number;
  value: number;
  apy: number;
  tokenPrice: number;
  type: 'deposit' | 'borrow';
}

export interface PortfolioData {
  userGlobalData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  marketData: any[];
  userPositions: PortfolioPosition[];
  walletBalances: Record<string, number>;
  isLoading: boolean;
  isLoadingPositions: boolean;
  isLoadingWalletBalance: boolean;
  error: string | null;
}

export const usePortfolioData = () => {
  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [userPositions, setUserPositions] = useState<PortfolioPosition[]>([]);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isLoadingWalletBalance, setIsLoadingWalletBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch nToken balance for a specific token
  const fetchNTokenBalance = useCallback(async (userAddress: string, nTokenId: string, networkId: string) => {
    try {
      if (!nTokenId) {
        console.log("No nTokenId provided, returning 0");
        return 0;
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      console.log(`Fetching nToken balance for contract: ${nTokenId}`);
      const nTokenBalance = await ARC200Service.getBalance(userAddress, nTokenId);
      
      if (nTokenBalance) {
        // Convert from smallest units to human readable format
        const balance = parseFloat(ARC200Service.formatBalance(nTokenBalance, 6)); // nTokens typically have 6 decimals
        console.log(`nToken balance: ${balance}`);
        return balance;
      } else {
        console.log(`No nToken balance found for contract: ${nTokenId}`);
        return 0;
      }
    } catch (error) {
      console.error("Error fetching nToken balance:", error);
      return 0;
    }
  }, []);

  // Function to fetch user positions (both deposits and borrows)
  const fetchUserPositions = useCallback(async (userAddress: string, networkId: string, markets: any[] = []) => {
    try {
      console.log("fetchUserPositions called with:", { userAddress, networkId, marketsCount: markets.length });
      const tokens = getAllTokensWithDisplayInfo(networkId as any);
      const positions: PortfolioPosition[] = [];

      for (const token of tokens) {
        if (token.underlyingContractId) {
          const market = markets.find((m) => m.symbol === token.symbol);
          
          // Fetch both deposit and borrow balances for this token
          const [depositBalance, borrowBalance] = await Promise.all([
            fetchUserDepositBalance(
              userAddress,
              "46505156", // Pool ID - should be dynamic
              token.underlyingContractId,
              networkId as any
            ),
            fetchUserBorrowBalance(
              userAddress,
              "46505156", // Pool ID - should be dynamic
              token.underlyingContractId,
              networkId as any
            )
          ]);

          // Add deposit position if user has deposits
          if (depositBalance && depositBalance > 0) {
            // Get the original token config to access nTokenId
            const originalTokenConfig = getTokenConfig(networkId as any, token.symbol);
            
            // Fetch ntoken balance for this deposit
            const nTokenBalance = await fetchNTokenBalance(
              userAddress,
              originalTokenConfig?.nTokenId || "",
              networkId
            );

            console.log(`Deposit position for ${token.symbol}:`, {
              depositBalance,
              nTokenBalance,
              marketPrice: market?.price,
              tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 1,
              calculatedValue: (depositBalance * (market?.price ? parseFloat(market.price) : 1)) / Math.pow(10, 6),
              marketFound: !!market,
            });
            
            positions.push({
              asset: token.symbol,
              icon: token.logoPath,
              balance: depositBalance,
              nTokenBalance: nTokenBalance,
              value: (depositBalance * (market?.price ? parseFloat(market.price) : 1)) / Math.pow(10, 6),
              apy: market?.apyCalculation?.apy || 
                   (market?.supplyRate ? market.supplyRate * 100 : 0),
              tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 1,
              type: 'deposit'
            });
          }

          // Add borrow position if user has borrows
          if (borrowBalance && borrowBalance > 0) {
            console.log(`Borrow position for ${token.symbol}:`, {
              borrowBalance,
              marketPrice: market?.price,
              tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 1,
              calculatedValue: (borrowBalance * (market?.price ? parseFloat(market.price) : 1)) / Math.pow(10, 6),
              marketFound: !!market,
            });
            
            positions.push({
              asset: token.symbol,
              icon: token.logoPath,
              balance: borrowBalance,
              value:
                (borrowBalance *
                  (market?.price ? parseFloat(market.price) : 1)) /
                Math.pow(10, 6),
              apy: market?.borrowApyCalculation?.apy || 
                   (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0),
              tokenPrice: market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 1,
              type: 'borrow'
            });
          }
        }
      }

      console.log("fetchUserPositions returning:", positions);
      return positions;
    } catch (error) {
      console.error("Error fetching user positions:", error);
      return [];
    }
  }, [fetchNTokenBalance]);

  // Fetch wallet balance for a specific asset
  const fetchWalletBalance = useCallback(async (asset: string) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Check if we already have this balance cached
    if (walletBalances[asset]) {
      return walletBalances[asset];
    }

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find(t => t.symbol === asset);
      
      if (!token) {
        console.error(`Token ${asset} not found in network config`);
        return { balance: 0, balanceUSD: 0 };
      }

      // Get the original token config to access tokenStandard
      const originalTokenConfig = getTokenConfig(currentNetwork, asset);
      if (!originalTokenConfig) {
        console.error(`Original token config not found for ${asset}`);
        return { balance: 0, balanceUSD: 0 };
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      let balance = 0;
      
      // Handle different token standards
      if (originalTokenConfig.tokenStandard === "arc200" && token.underlyingContractId) {
        // Fetch ARC200 token balance
        console.log(`Fetching ARC200 balance for ${asset} (contract: ${token.underlyingContractId})`);
        const arc200Balance = await ARC200Service.getBalance(
          activeAccount.address,
          token.underlyingContractId
        );
        
        if (arc200Balance) {
          // Convert from smallest units to human readable format
          balance = parseFloat(ARC200Service.formatBalance(arc200Balance, originalTokenConfig.decimals));
          console.log(`ARC200 balance for ${asset}: ${balance}`);
        } else {
          console.log(`No ARC200 balance found for ${asset}`);
          balance = 0;
        }
      } else if (originalTokenConfig.tokenStandard === "network") {
        // For network tokens (like VOI), fetch native balance
        console.log(`Fetching network token balance for ${asset}`);
        try {
          const clients = await algorandService.getCurrentClientsForReads();
          const accountInfo = await clients.algod.accountInformation(activeAccount.address).do();
          // Convert from micro-units to units (divide by 1,000,000)
          balance = accountInfo.amount / 1_000_000;
          console.log(`Network token balance for ${asset}: ${balance}`);
        } catch (error) {
          console.error(`Error fetching network token balance for ${asset}:`, error);
          balance = 0;
        }
      } else if (originalTokenConfig.tokenStandard === "asa" && token.underlyingAssetId) {
        // For ASA tokens, fetch asset balance
        console.log(`Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`);
        try {
          const clients = await algorandService.getCurrentClientsForReads();
          const accountInfo = await clients.algod.accountInformation(activeAccount.address).do();
          
          // Find the asset in the account's assets
          const assetId = parseInt(token.underlyingAssetId);
          const assetHolding = accountInfo.assets?.find((asset: any) => asset['asset-id'] === assetId);
          
          if (assetHolding) {
            // Convert from smallest units to human readable format
            balance = assetHolding.amount / Math.pow(10, originalTokenConfig.decimals);
            console.log(`ASA balance for ${asset}: ${balance}`);
          } else {
            console.log(`No ASA balance found for ${asset}`);
            balance = 0;
          }
        } catch (error) {
          console.error(`Error fetching ASA balance for ${asset}:`, error);
          balance = 0;
        }
      } else {
        console.log(`Unsupported token standard for ${asset}: ${originalTokenConfig.tokenStandard}`);
        balance = 0;
      }

      // Calculate USD value using market data
      const market = marketData.find(m => m.symbol === asset);
      const tokenPrice = market ? (market.price ? parseFloat(market.price) / Math.pow(10, 6) : 1) : 1;
      const balanceUSD = balance * tokenPrice;
      
      const balanceData = {
        balance,
        balanceUSD
      };

      setWalletBalances(prev => ({
        ...prev,
        [asset]: balanceData.balance // Store just the balance number for compatibility
      }));

      console.log(`Final balance data for ${asset}:`, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  }, [activeAccount?.address, currentNetwork, marketData, walletBalances]);

  // Refresh wallet balance for a specific asset
  const refreshWalletBalance = useCallback(async (asset: string) => {
    if (!activeAccount?.address) return;
    
    try {
      // Clear cached balance
      setWalletBalances(prev => {
        const newBalances = { ...prev };
        delete newBalances[asset];
        return newBalances;
      });
      
      // Fetch fresh balance
      await fetchWalletBalance(asset);
    } catch (error) {
      console.error("Error refreshing wallet balance:", error);
    }
  }, [activeAccount?.address, fetchWalletBalance]);

  // Function to refresh positions data
  const handleRefreshPositions = useCallback(async () => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingPositions(true);
    try {
      // Fetch fresh market data and global data first
      const [freshMarketData, freshGlobalData] = await Promise.all([
        fetchAllMarkets(currentNetwork),
        fetchUserGlobalData(activeAccount.address, currentNetwork),
      ]);

      // Then fetch fresh user positions with market data
      const freshPositions = await fetchUserPositions(activeAccount.address, currentNetwork, freshMarketData);

      setMarketData(freshMarketData);
      setUserPositions(freshPositions);
      setUserGlobalData(freshGlobalData);
    } catch (error) {
      console.error("Error refreshing positions:", error);
      setError("Failed to refresh positions data");
    } finally {
      setIsLoadingPositions(false);
    }
  }, [activeAccount?.address, currentNetwork, fetchUserPositions]);

  // Fetch user global data and market data when wallet connects
  useEffect(() => {
    const fetchData = async () => {
      if (!activeAccount?.address || !currentNetwork) {
        setUserGlobalData(null);
        setMarketData([]);
        setUserPositions([]);
        setWalletBalances({});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(
          "Fetching user global data for:",
          activeAccount.address,
          "on network:",
          currentNetwork
        );

        // Fetch global data and markets first
        const [globalData, markets] = await Promise.all([
          fetchUserGlobalData(activeAccount.address, currentNetwork),
          fetchAllMarkets(currentNetwork),
        ]);

        // Then fetch user positions with market data
        const positions = await fetchUserPositions(activeAccount.address, currentNetwork, markets);

        if (globalData) {
          console.log("User global data fetched:", globalData);
          setUserGlobalData(globalData);
        } else {
          console.log("No user global data found");
          setUserGlobalData(null);
        }

        if (markets) {
          console.log("Market data fetched:", markets);
          setMarketData(markets);
        } else {
          console.log("No market data found");
          setMarketData([]);
        }

        if (positions) {
          console.log("User positions fetched:", positions);
          setUserPositions(positions);
        } else {
          console.log("No user positions found");
          setUserPositions([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch data"
        );
        setUserGlobalData(null);
        setMarketData([]);
        setUserPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeAccount?.address, currentNetwork, fetchUserPositions]);

  // Separate deposits and borrows from user positions
  const deposits = userPositions.filter(pos => pos.type === 'deposit');
  const borrows = userPositions.filter(pos => pos.type === 'borrow');
  
  // Calculate totals from real data only
  const totalCollateral =
    userGlobalData?.totalCollateralValue ||
    deposits.reduce((sum, deposit) => sum + deposit.value, 0);
  const totalBorrowed =
    userGlobalData?.totalBorrowValue ||
    borrows.reduce((sum, borrow) => sum + borrow.value, 0);

  // Calculate weighted liquidation threshold based on borrowed assets only
  const calculateWeightedLiquidationThreshold = () => {
    if (marketData.length === 0) {
      // Fallback to standard threshold if no market data
      return 0.85; // 85% liquidation threshold
    }

    let weightedThreshold = 0;
    let totalBorrowWeight = 0;

    // Calculate weighted average liquidation threshold based on borrowed assets
    borrows.forEach((borrow) => {
      const market = marketData.find((m) => m.symbol === borrow.asset);
      if (market && borrow.value > 0) {
        const threshold = market.liquidationThreshold || 0.85;
        weightedThreshold += borrow.value * threshold;
        totalBorrowWeight += borrow.value;
      }
    });

    const result =
      totalBorrowWeight > 0 ? weightedThreshold / totalBorrowWeight : 0.85;
    return result;
  };

  // Temporarily use fixed threshold to debug the issue
  const weightedLiquidationThreshold = 0.85; // Fixed 85% threshold

  // Calculate health factor using collateral factor (80%) for borrowing power
  const collateralFactor = 0.8; // 80% collateral factor
  const healthFactor =
    totalCollateral > 0 && totalBorrowed > 0
      ? (totalCollateral * collateralFactor) / totalBorrowed
      : totalCollateral > 0 ? 10.0 : null; // Excellent health when no borrows, null when no collateral

  // Calculate Net LTV (Loan-to-Value ratio)
  const netLTV =
    totalCollateral > 0 ? (totalBorrowed / totalCollateral) * 100 : 0;

  // Liquidation margin = Liquidation Threshold - Net LTV
  const liquidationMargin =
    totalCollateral > 0 ? weightedLiquidationThreshold * 100 - netLTV : 0;

  // Calculate risk factor for each borrow position
  const calculatePositionRiskFactor = (borrow: PortfolioPosition) => {
    if (!borrow.value || borrow.value <= 0 || totalCollateral === 0) return 0;

    // Risk factor = (borrow value / total collateral) * (1 / health factor)
    const positionWeight = borrow.value / totalCollateral;
    const healthFactorContribution = healthFactor !== null && healthFactor > 0 ? 1 / healthFactor : 10; // High risk if HF is low or null
    return positionWeight * healthFactorContribution;
  };

  // Filter and sort borrows by risk factor
  const riskyBorrows = borrows
    .filter((borrow) => borrow.value > 0) // Only positions with actual borrows
    .map((borrow) => ({
      ...borrow,
      riskFactor: calculatePositionRiskFactor(borrow),
    }))
    .sort((a, b) => b.riskFactor - a.riskFactor); // Sort by risk factor descending

  const portfolioData: PortfolioData = {
    userGlobalData,
    marketData,
    userPositions,
    walletBalances,
    isLoading,
    isLoadingPositions,
    isLoadingWalletBalance,
    error,
  };

  return {
    ...portfolioData,
    deposits,
    borrows,
    totalCollateral,
    totalBorrowed,
    weightedLiquidationThreshold,
    healthFactor,
    netLTV,
    liquidationMargin,
    riskyBorrows,
    collateralFactor,
    fetchWalletBalance,
    refreshWalletBalance,
    handleRefreshPositions,
  };
};
