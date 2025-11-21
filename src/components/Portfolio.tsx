import { useState, useEffect } from "react";
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
import { getTokenConfig, isFeatureEnabled } from "@/config";
import { getAllTokensWithDisplayInfo } from "@/config";
import EnhancedHealthFactor from "./EnhancedHealthFactor";
import DepositsList from "./DepositsList";
import BorrowsList from "./BorrowsList";
import PortfolioModals from "./PortfolioModals";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";

const Portfolio = () => {
  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  const [depositModal, setDepositModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [withdrawModal, setWithdrawModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [borrowModal, setBorrowModal] = useState({
    isOpen: false,
    asset: null,
  });
  const [repayModal, setRepayModal] = useState({ isOpen: false, asset: null });

  // Real user data state
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [userPositions, setUserPositions] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<
    Record<string, { balance: number; balanceUSD: number }>
  >({});
  const [isLoadingWalletBalance, setIsLoadingWalletBalance] = useState(false);
  const [userBorrowBalance, setUserBorrowBalance] = useState<number>(0);
  const [isLoadingBorrowData, setIsLoadingBorrowData] = useState(false);

  console.log("marketData", marketData);

  // Function to fetch ntoken balance for a specific token
  const fetchNTokenBalance = async (
    userAddress: string,
    nTokenId: string,
    networkId: string
  ) => {
    try {
      if (!nTokenId) {
        console.log("No nTokenId provided, returning 0");
        return 0;
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      console.log(`Fetching nToken balance for contract: ${nTokenId}`);
      const nTokenBalance = await ARC200Service.getBalance(
        userAddress,
        nTokenId
      );

      if (nTokenBalance) {
        // Convert from smallest units to human readable format
        const balance = parseFloat(
          ARC200Service.formatBalance(nTokenBalance, 6)
        ); // nTokens typically have 6 decimals
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
  };

  // Function to fetch user positions (both deposits and borrows)
  const fetchUserPositions = async (
    userAddress: string,
    networkId: string,
    markets: any[] = []
  ) => {
    try {
      console.log("fetchUserPositions called with:", {
        userAddress,
        networkId,
        marketsCount: markets.length,
      });
      const tokens = getAllTokensWithDisplayInfo(networkId as any);
      const positions = [];

      for (const token of tokens) {
        if (token.underlyingContractId && token.poolId) {
          const market = markets.find((m) => m.symbol === token.symbol);

          // Fetch both deposit and borrow balances for this token
          const [depositBalance, borrowData] = await Promise.all([
            fetchUserDepositBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              networkId as any
            ),
            fetchUserBorrowBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              networkId as any
            ),
          ]);

          // Extract borrow balance and interest from the new return type
          const borrowBalance = borrowData?.balance || 0;
          const borrowInterest = borrowData?.interest || 0;

          // Add deposit position if user has deposits
          if (depositBalance && depositBalance > 0) {
            // Get the original token config to access nTokenId
            const originalTokenConfig = getTokenConfig(
              networkId as any,
              token.symbol
            );

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
              tokenPrice: market?.price
                ? (parseFloat(market.price) * 10 ** token.decimals) /
                  Math.pow(10, 6)
                : 1,
              calculatedValue:
                (depositBalance *
                  (market?.price ? parseFloat(market.price) : 1)) /
                Math.pow(10, 6),
              marketFound: !!market,
            });

            positions.push({
              asset: token.symbol,
              icon: token.logoPath,
              balance: depositBalance,
              nTokenBalance: nTokenBalance,
              value:
                ((depositBalance *
                  (market?.price ? parseFloat(market.price) : 1)) /
                  Math.pow(10, 6)) *
                (Math.pow(10, token.decimals) / Math.pow(10, 6)),
              apy:
                market?.apyCalculation?.apy ||
                (market?.supplyRate ? market.supplyRate * 100 : 0),
              tokenPrice: market?.price
                ? parseFloat(market.price) / Math.pow(10, 6)
                : 1,
              type: "deposit",
            });
          }

          // Add borrow position if user has borrows
          if (borrowBalance && borrowBalance > 0) {
            console.log(`Borrow position for ${token.symbol}:`, {
              borrowBalance,
              borrowInterest,
              marketPrice: market?.price,
              tokenPrice: market?.price
                ? parseFloat(market.price) / Math.pow(10, 6)
                : 1,
              calculatedValue:
                (borrowBalance *
                  (market?.price ? parseFloat(market.price) : 1)) /
                Math.pow(10, 6),
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
              apy:
                market?.borrowApyCalculation?.apy ||
                (market?.borrowRateCurrent
                  ? market.borrowRateCurrent * 100
                  : 0),
              tokenPrice: market?.price
                ? parseFloat(market.price) / Math.pow(10, 6)
                : 1,
              type: "borrow",
              interest: borrowInterest,
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
  };

  // Separate deposits and borrows from user positions
  const deposits = userPositions.filter((pos) => pos.type === "deposit");
  const borrows = userPositions.filter((pos) => pos.type === "borrow");

  // Calculate totals from real data only
  const totalCollateral =
    userGlobalData?.totalCollateralValue ||
    deposits.reduce((sum, deposit) => sum + deposit.value, 0);

  console.log({
    userGlobalData,
    deposits,
  });

  const totalBorrowed =
    userGlobalData?.totalBorrowValue ||
    borrows.reduce((sum, borrow) => sum + borrow.value, 0);

  // Calculate weighted liquidation threshold based on borrowed assets only
  // This is more accurate because liquidation risk only applies to markets with active debt
  const calculateWeightedLiquidationThreshold = () => {
    if (marketData.length === 0) {
      // Fallback to standard threshold if no market data
      return 0.85; // 85% liquidation threshold
    }

    let weightedThreshold = 0;
    let totalBorrowWeight = 0;

    // Calculate weighted average liquidation threshold based on borrowed assets
    // Only consider markets where the user has active borrows since:
    // 1. Liquidation only occurs when debt exists
    // 2. Collateral without debt doesn't create liquidation risk
    // 3. Each borrowed asset has its own liquidation threshold
    borrows.forEach((borrow) => {
      const market = marketData.find((m) => m.symbol === borrow.asset);
      console.log(
        `Borrow asset: ${borrow.asset}, value: ${borrow.value}, market found:`,
        !!market
      );
      if (market) {
        console.log(
          `Market liquidation threshold:`,
          market.liquidationThreshold
        );
      }
      if (market && borrow.value > 0) {
        const threshold = market.liquidationThreshold || 0.85;
        weightedThreshold += borrow.value * threshold;
        totalBorrowWeight += borrow.value;
        console.log(
          `Added to calculation: borrow=${borrow.value}, threshold=${threshold}`
        );
      }
    });

    const result =
      totalBorrowWeight > 0 ? weightedThreshold / totalBorrowWeight : 0.85;
    console.log(`Weighted liquidation threshold calculation:`, {
      weightedThreshold,
      totalBorrowWeight,
      result,
    });
    return result;
  };

  // Temporarily use fixed threshold to debug the issue
  const weightedLiquidationThreshold = 0.85; // Fixed 85% threshold
  // const weightedLiquidationThreshold = calculateWeightedLiquidationThreshold();

  // Calculate health factor using collateral factor (80%) for borrowing power
  // Health factor = (collateralValue * collateralFactor) / totalBorrowed
  // If no collateral, return null (no calculation possible)
  // If no borrows, return high value (excellent health - no liquidation risk)
  const collateralFactor = 0.8; // 80% collateral factor
  const healthFactor =
    totalCollateral > 0 && totalBorrowed > 0
      ? (totalCollateral * collateralFactor) / totalBorrowed
      : totalCollateral > 0
      ? 10.0
      : null; // Excellent health when no borrows, null when no collateral

  // Calculate Net LTV (Loan-to-Value ratio)
  const netLTV =
    totalCollateral > 0 ? (totalBorrowed / totalCollateral) * 100 : 0;

  // Liquidation margin = Liquidation Threshold - Net LTV
  // This represents the safety buffer before liquidation
  const liquidationMargin =
    totalCollateral > 0 ? weightedLiquidationThreshold * 100 - netLTV : 0;

  // Calculate risk factor for each borrow position
  const calculatePositionRiskFactor = (borrow: any) => {
    if (!borrow.value || borrow.value <= 0 || totalCollateral === 0) return 0;

    // Risk factor = (borrow value / total collateral) * (1 / health factor)
    // Higher risk factor = more dangerous position
    const positionWeight = borrow.value / totalCollateral;
    const healthFactorContribution =
      healthFactor !== null && healthFactor > 0 ? 1 / healthFactor : 10; // High risk if HF is low or null
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

  // Debug logging
  console.log("Portfolio Debug:", {
    totalCollateral,
    totalBorrowed,
    weightedLiquidationThreshold,
    netLTV,
    liquidationMargin,
    marketDataLength: marketData.length,
    riskyBorrows: riskyBorrows.map((b) => ({
      asset: b.asset,
      riskFactor: b.riskFactor.toFixed(3),
    })),
  });

  // Fetch wallet balance for a specific asset (same as MarketsTable)
  const fetchWalletBalance = async (asset: string) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Check if we already have this balance cached
    if (walletBalances[asset]) {
      return walletBalances[asset];
    }

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);

      if (!token) {
        console.error(`Token ${asset} not found in network config`);
        return { balance: 0, balanceUSD: 0 };
      }

      // Get the original token config to access tokenStandard
      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as any).originalSymbol : asset;
      const originalTokenConfig = getTokenConfig(
        currentNetwork,
        originalSymbol
      );
      if (!originalTokenConfig) {
        console.error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Initialize ARC200Service with current clients
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      let balance = 0;

      // Handle different token standards
      if (
        originalTokenConfig.tokenStandard === "arc200" &&
        token.underlyingContractId
      ) {
        // Fetch ARC200 token balance
        console.log(
          `Fetching ARC200 balance for ${asset} (contract: ${token.underlyingContractId})`
        );
        const arc200Balance = await ARC200Service.getBalance(
          activeAccount.address,
          token.underlyingContractId
        );

        if (arc200Balance) {
          // Convert from smallest units to human readable format
          balance = parseFloat(
            ARC200Service.formatBalance(
              arc200Balance,
              originalTokenConfig.decimals
            )
          );
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
          const accountInfo = await clients.algod
            .accountInformation(activeAccount.address)
            .do();
          // Convert from micro-units to units (divide by 1,000,000)
          balance = Number(accountInfo.amount) / 1_000_000;
          console.log(`Network token balance for ${asset}: ${balance}`);
        } catch (error) {
          console.error(
            `Error fetching network token balance for ${asset}:`,
            error
          );
          balance = 0;
        }
      } else if (
        originalTokenConfig.tokenStandard === "asa" &&
        token.underlyingAssetId
      ) {
        // For ASA tokens, fetch asset balance
        console.log(
          `Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`
        );
        try {
          const clients = await algorandService.getCurrentClientsForReads();
          const assetId = parseInt(token.underlyingAssetId);
          const accAssetInfo = await clients.algod
            .accountAssetInformation(activeAccount.address, assetId)
            .do();

          if (accAssetInfo["asset-holding"]) {
            // Convert from smallest units to human readable format
            balance =
              Number(accAssetInfo["asset-holding"].amount) /
              Math.pow(10, originalTokenConfig.decimals);
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
        console.log(
          `Unsupported token standard for ${asset}: ${originalTokenConfig.tokenStandard}`
        );
        balance = 0;
      }

      // Calculate USD value using market data
      const market = marketData.find((m) => m.symbol === asset);
      const tokenPrice = market
        ? market.price
          ? parseFloat(market.price) / Math.pow(10, 6)
          : 1
        : 1;
      const balanceUSD =
        balance * tokenPrice * (Math.pow(10, token.decimals) / Math.pow(10, 6));

      const balanceData = {
        balance,
        balanceUSD,
      };

      setWalletBalances((prev) => ({
        ...prev,
        [asset]: balanceData, // Store the full balance object with balance and balanceUSD
      }));

      console.log(`Final balance data for ${asset}:`, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  // Refresh wallet balance for a specific asset
  const refreshWalletBalance = async (asset: string) => {
    if (!activeAccount?.address) return;

    try {
      // Clear cached balance
      setWalletBalances((prev) => {
        const newBalances = { ...prev };
        delete newBalances[asset];
        return newBalances;
      });

      // Fetch fresh balance
      await fetchWalletBalance(asset);
    } catch (error) {
      console.error("Error refreshing wallet balance:", error);
    }
  };

  // Function to refresh positions data
  const handleRefreshPositions = async () => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingPositions(true);
    try {
      // Fetch fresh market data and global data first
      const freshMarketData = await fetchAllMarkets(currentNetwork);
      const freshGlobalData = await fetchUserGlobalData(
        activeAccount.address,
        currentNetwork,
        freshMarketData
      );

      // Then fetch fresh user positions with market data
      const freshPositions = await fetchUserPositions(
        activeAccount.address,
        currentNetwork,
        freshMarketData
      );

      setMarketData(freshMarketData);
      setUserPositions(freshPositions);
      setUserGlobalData(freshGlobalData);
    } catch (error) {
      console.error("Error refreshing positions:", error);
      setDataError("Failed to refresh positions data");
    } finally {
      setIsLoadingPositions(false);
    }
  };

  // Fetch user global data and market data when wallet connects
  useEffect(() => {
    const fetchData = async () => {
      if (!activeAccount?.address || !currentNetwork) {
        setUserGlobalData(null);
        setMarketData([]);
        return;
      }

      setIsLoadingData(true);
      setDataError(null);

      try {
        console.log(
          "Fetching user global data for:",
          activeAccount.address,
          "on network:",
          currentNetwork
        );

        // Fetch markets first, then global data (so we can pass marketData for healthFactorIndex calculation)
        const markets = await fetchAllMarkets(currentNetwork);
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork,
          markets
        );

        // Then fetch user positions with market data
        const positions = await fetchUserPositions(
          activeAccount.address,
          currentNetwork,
          markets
        );

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
        setDataError(
          error instanceof Error ? error.message : "Failed to fetch data"
        );
        setUserGlobalData(null);
        setMarketData([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [activeAccount?.address, currentNetwork]);

  const handleDepositClick = async (asset: string) => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingWalletBalance(true);

    try {
      // Fetch wallet balance before opening modal
      await fetchWalletBalance(asset);

      // Open modal after balance is fetched
      setDepositModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching wallet balance for deposit:", error);
      // Still open modal even if balance fetch fails
      setDepositModal({ isOpen: true, asset });
    } finally {
      setIsLoadingWalletBalance(false);
    }
  };

  const handleWithdrawClick = (asset: string) => {
    setWithdrawModal({ isOpen: true, asset });
  };

  const handleBorrowClick = async (asset: string) => {
    setIsLoadingBorrowData(true);

    try {
      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        // Fetch markets to pass for healthFactorIndex calculation
        const markets = await fetchAllMarkets(currentNetwork);
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork,
          markets
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token = tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          const borrowBalance = borrowData?.balance || 0;
          setUserBorrowBalance(borrowBalance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } else {
        // Not connected, set empty data
        setUserGlobalData(null);
        setUserBorrowBalance(0);
      }

      // Open modal regardless of connection status
      setBorrowModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching user data for borrow:", error);
      // Still open modal even if data fetch fails
      setBorrowModal({ isOpen: true, asset });
    } finally {
      setIsLoadingBorrowData(false);
    }
  };

  const handleRepayClick = async (asset: string) => {
    if (!activeAccount?.address) {
      console.error("No active account for repayment");
      return;
    }

    try {
      // Fetch wallet balance for the asset before opening modal
      await refreshWalletBalance(asset);

      // Open modal after wallet balance is fetched
      setRepayModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching wallet balance for repay:", error);
      // Still open modal even if wallet balance fetch fails
      setRepayModal({ isOpen: true, asset });
    }
  };

  const handleAddCollateral = () => {
    setDepositModal({ isOpen: true, asset: "VOI" });
  };

  const handleBuyVoi = () => {
    console.log("Redirect to VOI purchase");
  };

  // Show loading state
  if (isLoadingData) {
    return (
      <div className="space-y-6">
        {/* Hero Section Skeleton */}
        <DorkFiCard className="relative text-center overflow-hidden p-6 md:p-8">
          <div className="relative z-10">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
        </DorkFiCard>

        {/* Health Factor Skeleton */}
        <DorkFiCard className="p-8">
          <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-8 lg:gap-10">
            <div className="xl:border-r-2 xl:border-ocean-teal/20 xl:pr-8">
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        </DorkFiCard>
      </div>
    );
  }

  // Show no wallet connected state
  if (!activeAccount?.address) {
    return (
      <div className="space-y-6">
        {/* Hero Section */}
        <DorkFiCard
          hoverable
          className="relative text-center overflow-hidden p-6 md:p-8"
        >
          <div className="relative z-10">
            <H1 className="m-0 text-4xl md:text-5xl">
              <span className="hero-header">Portfolio Health</span>
            </H1>
            <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto">
              <span className="block md:inline md:whitespace-nowrap">
                Connect your wallet to view your portfolio health and manage
                your positions.
              </span>
            </Body>
          </div>
        </DorkFiCard>

        {/* Connect Wallet Card */}
        <DorkFiCard className="text-center p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              Connect Your Wallet
            </h2>
            <p className="text-muted-foreground">
              Connect your wallet to access your portfolio data and manage your
              lending positions.
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                Use the wallet button in the top navigation to connect.
              </p>
            </div>
          </div>
        </DorkFiCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <DorkFiCard
        hoverable
        className="relative text-center overflow-hidden p-6 md:p-8"
      >
        {/* Decorative elements */}
        {/* Birds - light mode only */}
        <div
          className="absolute top-6 left-10 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block"
          style={{ animationDelay: "0s" }}
        >
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - top left"
            className="w-8 h-8 md:w-10 md:h-10 -rotate-6 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div
          className="absolute top-14 right-12 opacity-70 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block"
          style={{ animationDelay: "0.5s" }}
        >
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - top right"
            className="w-7 h-7 md:w-9 md:h-9 rotate-3 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div
          className="absolute bottom-10 left-14 opacity-60 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block"
          style={{ animationDelay: "1s" }}
        >
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - bottom left"
            className="w-7 h-7 md:w-9 md:h-9 -rotate-2 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Dark mode gold fish */}
        <div
          className="absolute top-4 left-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block"
          style={{ animationDelay: "0s" }}
        >
          <img
            src="/lovable-uploads/DorkFi_gold_fish.png"
            alt="Decorative DorkFi gold fish - top left"
            className="w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div
          className="absolute top-12 right-12 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block"
          style={{ animationDelay: "0.5s" }}
        >
          <img
            src="/lovable-uploads/DorkFi_gold_fish.png"
            alt="Decorative DorkFi gold fish - top right"
            className="w-[1.896563rem] h-[1.896563rem] md:w-[2.844844rem] md:h-[2.844844rem] -scale-x-100 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="relative z-10">
          <H1 className="m-0 text-4xl md:text-5xl">
            <span className="hero-header">Portfolio Health</span>
          </H1>
          <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto">
            <span className="block md:inline md:whitespace-nowrap">
              Track Your Health Factor, Monitor Your Positions, and Manage Your
              Portfolio.
            </span>
            <br className="hidden md:block" />
            <span className="block md:inline md:whitespace-nowrap sm:hidden">
              Add collateral or repay if your health factor gets too low.
            </span>
          </Body>

          {/* Data Source Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div
              className={`w-2 h-2 rounded-full ${
                userGlobalData ? "bg-green-500" : "bg-gray-500"
              }`}
            ></div>
            <span>
              {userGlobalData ? "Live Data" : "No Data"} •{" "}
              {activeAccount?.address.slice(0, 8)}...
              {activeAccount?.address.slice(-8)}
            </span>
            {marketData.length > 0 && totalBorrowed > 0 && (
              <span className="ml-2">
                • Collateral Factor: {(collateralFactor * 100).toFixed(0)}% •
                Liquidation Threshold:{" "}
                {(weightedLiquidationThreshold * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {/* Error State */}
          {dataError && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-400 text-sm">
                  Error loading data: {dataError}
                </span>
              </div>
            </div>
          )}
        </div>
      </DorkFiCard>

      <EnhancedHealthFactor
        healthFactor={healthFactor}
        totalCollateral={totalCollateral}
        totalBorrowed={totalBorrowed}
        liquidationMargin={liquidationMargin}
        netLTV={netLTV}
        dorkNftImage="/lovable-uploads/c70b9b34-79c4-491a-b46d-c35bde947c37.png"
        underwaterBg="/lovable-uploads/44ebe994-a30e-4eb1-a4a1-776aa2978776.png"
        onAddCollateral={handleAddCollateral}
        onBuyVoi={handleBuyVoi}
      />

      {/* At Risk Positions Section - Show when health factor < 1.5 and there are borrows */}
      {isFeatureEnabled("enableLiquidations") &&
        healthFactor !== null &&
        healthFactor < 1.5 &&
        healthFactor > 0 &&
        totalBorrowed > 0 &&
        !isLoadingData && (
          <DorkFiCard className="border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <H1 className="text-xl text-red-500 m-0">At Risk Positions</H1>
              </div>
              <button
                onClick={handleRefreshPositions}
                disabled={isLoadingPositions}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh positions data"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    isLoadingPositions ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>
            </div>
            <Body className="text-red-400 mb-4">
              Your health factor is below 1.5, indicating elevated liquidation
              risk. Consider reducing your borrowed amount or adding more
              collateral.
            </Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-sm text-red-300 mb-2">Health Factor</div>
                <div className="text-2xl font-bold text-red-400">
                  {healthFactor.toFixed(3)}
                </div>
                <div className="text-xs text-red-300 mt-1">
                  Target: 1.5+ for safety
                </div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-sm text-red-300 mb-2">
                  Liquidation Margin
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {liquidationMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-red-300 mt-1">
                  Safety buffer remaining
                </div>
              </div>
            </div>

            {/* Risky Borrow Positions */}
            {riskyBorrows.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-red-300 mb-3 font-medium">
                  Risky Borrow Positions
                </div>
                <div className="space-y-2">
                  {riskyBorrows.map((borrow, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={borrow.icon}
                          alt={borrow.asset}
                          className="w-6 h-6 rounded-full"
                        />
                        <div>
                          <div className="text-sm font-medium text-red-400">
                            {borrow.asset}
                          </div>
                          <div className="text-xs text-red-300">
                            {borrow.balance.toFixed(2)} {borrow.asset}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-400">
                          {borrow.value.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })}
                        </div>
                        <div className="text-xs text-red-300">
                          {borrow.apy.toFixed(2)}% APY • Risk:{" "}
                          {(borrow.riskFactor * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DorkFiCard>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Stack lists vertically on mobile, keep two columns on desktop */}
        <DepositsList
          deposits={deposits}
          onDepositClick={handleDepositClick}
          onWithdrawClick={handleWithdrawClick}
          onRefresh={handleRefreshPositions}
          isLoading={isLoadingPositions}
        />
        <BorrowsList
          borrows={borrows}
          onBorrowClick={handleBorrowClick}
          onRepayClick={handleRepayClick}
          onRefresh={handleRefreshPositions}
          isLoading={isLoadingPositions}
        />
      </div>

      <PortfolioModals
        depositModal={depositModal}
        withdrawModal={withdrawModal}
        borrowModal={borrowModal}
        repayModal={repayModal}
        deposits={deposits}
        borrows={borrows}
        walletBalances={walletBalances}
        marketData={marketData}
        userGlobalData={userGlobalData}
        userBorrowBalance={userBorrowBalance}
        onCloseDepositModal={() =>
          setDepositModal({ isOpen: false, asset: null })
        }
        onCloseWithdrawModal={() =>
          setWithdrawModal({ isOpen: false, asset: null })
        }
        onCloseBorrowModal={() =>
          setBorrowModal({ isOpen: false, asset: null })
        }
        onCloseRepayModal={() => setRepayModal({ isOpen: false, asset: null })}
        onRefreshWalletBalance={refreshWalletBalance}
        onRefreshMarket={handleRefreshPositions}
      />
    </div>
  );
};

export default Portfolio;
