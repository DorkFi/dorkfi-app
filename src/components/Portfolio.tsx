import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useAddressName } from "@/hooks/useAddressName";
import { useAvatarImage } from "@/hooks/useAvatarImage";
import { useToast } from "@/hooks/use-toast";
import algosdk, { waitForConfirmation } from "algosdk";
import { ResolverService } from "@/services/resolverService";
import {
  fetchUserGlobalData,
  fetchAllMarkets,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  enhanceAVMMarketInfo,
  fetchMarketInfo,
} from "@/services/lendingService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";
import {
  getAllTokens,
  getTokenConfig,
  isFeatureEnabled,
  getEnabledNetworks,
  getAlgorandNetworkFromNetworkId,
} from "@/config";
import { getAllTokensWithDisplayInfo } from "@/config";
import EnhancedHealthFactor from "./EnhancedHealthFactor";
import DepositsList from "./DepositsList";
import BorrowsList from "./BorrowsList";
import PortfolioModals from "./PortfolioModals";
import NFTSelectionModal from "./liquidation/NFTSelectionModal";
import ProfileUpdateSuccessModal from "./liquidation/ProfileUpdateSuccessModal";
import { UserNFT } from "@/hooks/useUserNFTs";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Portfolio = () => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { name: addressName } = useAddressName(activeAccount?.address);
  const { avatarImage, isResolved: isAvatarResolved, refetch: refetchAvatar } = useAvatarImage(activeAccount?.address);
  const { toast } = useToast();

  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [withdrawModal, setWithdrawModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [borrowModal, setBorrowModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  }>({
    isOpen: false,
    asset: null,
  });
  const [repayModal, setRepayModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
    network?: string;
  }>({
    isOpen: false,
    asset: null,
  });

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
  const [user, setUser] = useState<any>(null);
  const [selectedNetworkFilter, setSelectedNetworkFilter] =
    useState<string>("all");
  const [suppliedAssetsSort, setSuppliedAssetsSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "apy", direction: "desc" });
  const [suppliedAssetsSearchTerm, setSuppliedAssetsSearchTerm] =
    useState<string>("");
  const [showAllSuppliedAssets, setShowAllSuppliedAssets] =
    useState<boolean>(false);
  const suppliedAssetsTableRef = useRef<HTMLDivElement>(null);
  const [borrowedAssetsSearchTerm, setBorrowedAssetsSearchTerm] =
    useState<string>("");
  const [showAllBorrowedAssets, setShowAllBorrowedAssets] =
    useState<boolean>(false);
  const borrowedAssetsTableRef = useRef<HTMLDivElement>(null);
  const [borrowedAssetsSort, setBorrowedAssetsSort] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: "apy", direction: "asc" });
  
  // NFT selection state
  const [nftModalOpen, setNftModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  console.log("marketData", marketData);

  // Helper function to format price from contract using decimal adjustment
  // The price oracle contract stores prices in a 12-decimal scale
  // This converts from contract format back to token's native decimal format
  const formatPriceFromContract = (
    contractPrice: string | number,
    tokenDecimals: number
  ): number => {
    const price =
      typeof contractPrice === "string"
        ? parseFloat(contractPrice)
        : contractPrice;

    if (!price || price === 0) return 1;

    // Calculate adjustment: 12 (oracle decimals) - token decimals
    const targetAdjustment = 12 - tokenDecimals;
    const divisor = Math.pow(10, targetAdjustment);

    return price / divisor;
  };

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
          // Find matching market by both symbol and poolId to handle multiple markets for same token
          let market = markets.find(
            (m) => m.symbol === token.symbol && m.poolId === token.poolId
          );

          console.log({
            fetchUserPositions: {
              token,
              markets,
              market,
            },
          });

          // Fallback to symbol-only match if poolId match not found (for backward compatibility)
          if (!market) {
            market = markets.find((m) => m.symbol === token.symbol);
          }

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
            // For multi-market tokens (array), find the one matching the token's poolId
            const originalTokenConfigRaw = getTokenConfig(
              networkId as any,
              token.symbol
            );

            // Handle array of token configs (multiple markets)
            // Compare poolIds as strings to ensure exact match
            const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
              ? originalTokenConfigRaw.find(
                  (tc) => String(tc.poolId) === String(token.poolId)
                ) || originalTokenConfigRaw[0]
              : originalTokenConfigRaw;

            // Fetch ntoken balance for this deposit
            const nTokenBalance = await fetchNTokenBalance(
              userAddress,
              originalTokenConfig?.nTokenId || "",
              networkId
            );

            const tokenPrice = market?.price
              ? formatPriceFromContract(market.price, token.decimals)
              : 1;

            console.log(`Deposit position for ${token.symbol}:`, {
              depositBalance,
              nTokenBalance,
              marketPrice: market?.price,
              tokenPrice: tokenPrice,
              calculatedValue: depositBalance * tokenPrice,
              marketFound: !!market,
            });

            positions.push({
              asset: token.symbol,
              icon: token.logoPath,
              balance: depositBalance,
              nTokenBalance: nTokenBalance,
              value: depositBalance * tokenPrice,
              apy:
                market?.apyCalculation?.apy ||
                (market?.supplyRate ? market.supplyRate * 100 : 0),
              tokenPrice: tokenPrice,
              type: "deposit",
              poolId: token.poolId,
              network: networkId, // Add network information
            });
          }

          // Add borrow position if user has borrows
          if (borrowBalance && borrowBalance > 0) {
            const tokenPrice = market?.price
              ? formatPriceFromContract(market.price, token.decimals)
              : 1;

            console.log(`Borrow position for ${token.symbol}:`, {
              borrowBalance,
              borrowInterest,
              marketPrice: market?.price,
              tokenPrice: tokenPrice,
              calculatedValue: borrowBalance * tokenPrice,
              marketFound: !!market,
            });

            positions.push({
              asset: token.symbol,
              icon: token.logoPath,
              balance: borrowBalance,
              value: borrowBalance * tokenPrice,
              apy:
                market?.borrowApyCalculation?.apy ||
                (market?.borrowRateCurrent
                  ? market.borrowRateCurrent * 100
                  : 0),
              tokenPrice: tokenPrice,
              type: "borrow",
              interest: borrowInterest,
              poolId: token.poolId,
              network: networkId, // Add network information
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

  // Transform user.computed.deposits and user.computed.borrows into table format
  const transformedDepositsAndBorrows = useMemo(() => {
    const transformedDeposits: any[] = [];
    const transformedBorrows: any[] = [];

    if (user?.computed?.deposits && Array.isArray(user.computed.deposits)) {
      user.computed.deposits.forEach((item: any) => {
        try {
          const networkId = item.network;
          const marketId =
            item.marketId?.toString() || item.underlyingContractId?.toString();
          const appId = item.appId?.toString() || item.poolId?.toString();

          if (!networkId || !marketId || !appId) {
            console.warn("Missing required fields for deposit item:", item);
            return;
          }

          // Get tokens for this network
          const tokens = getAllTokensWithDisplayInfo(networkId as any);

          // Find token matching marketId and poolId
          const token = tokens.find(
            (t) =>
              (t.underlyingContractId === marketId ||
                t.originalContractId === marketId) &&
              t.poolId === appId
          );

          if (!token) {
            console.warn(
              `Token not found for marketId ${marketId}, appId ${appId} on network ${networkId}`
            );
            return;
          }

          // Find market data
          const market = marketData.find(
            (m) =>
              m.symbol === token.symbol &&
              (m.poolId === appId || m.appId === appId)
          );

          console.log("[Portfolio] Market data:", {
            market,
            marketDataLength: marketData.length,
            symbol: token.symbol,
            appId,
            marketId,
          });

          // Calculate actual balance from scaled deposits
          // Formula: actual_deposits = (scaled_deposits * current_deposit_index) / SCALE
          // SCALE = 1e18
          const SCALE = BigInt(1e18);
          // Handle scaledDeposits as string or number from API
          const scaledDepositsValue =
            typeof item.scaledDeposits === "string"
              ? item.scaledDeposits
              : (item.scaledDeposits || 0).toString();
          const scaledDeposits = BigInt(scaledDepositsValue);

          // Get depositIndex from market data - it should be a string representation of BigInt
          // If not available, use default SCALE (1e18) as fallback to still show the item
          let depositIndex: bigint;
          let depositIndexStr: string;
          if (!market?.depositIndex) {
            console.warn(
              `[Portfolio] depositIndex not found for ${token.symbol} (poolId: ${appId}), using default SCALE`
            );
            depositIndex = SCALE;
            depositIndexStr = SCALE.toString();
          } else {
            depositIndexStr = market.depositIndex.toString();
            depositIndex = BigInt(depositIndexStr);
          }

          const actualDepositsRaw =
            scaledDeposits === 0n
              ? 0n
              : (scaledDeposits * depositIndex) / SCALE;

          // actualDepositsRaw is in the smallest unit (e.g., micro-units for 6 decimals)
          // Divide by token decimals to get human-readable amount
          const actualBalance =
            Number(actualDepositsRaw) / Math.pow(10, token.decimals);

          // Sanity check: if balance seems unreasonably high (> 1e10), there might be a conversion issue
          if (actualBalance > 1e10) {
            console.error(
              `[Portfolio] Unreasonably high balance calculated for ${token.symbol}:`,
              {
                scaledDeposits: scaledDepositsValue,
                depositIndex: depositIndexStr,
                actualDepositsRaw: actualDepositsRaw.toString(),
                tokenDecimals: token.decimals,
                actualBalance,
                item: item,
              }
            );
            return; // Skip this item if calculation seems wrong
          }

          // Debug logging
          console.log(
            `[Portfolio] Deposit transformation for ${token.symbol}:`,
            {
              scaledDeposits: scaledDepositsValue,
              depositIndex: depositIndexStr,
              actualDepositsRaw: actualDepositsRaw.toString(),
              tokenDecimals: token.decimals,
              actualBalance,
              marketFound: !!market,
            }
          );

          if (actualBalance <= 0) {
            return; // Skip zero balances
          }

          // Get token price
          const tokenPrice = market?.price
            ? formatPriceFromContract(market.price, token.decimals)
            : 1;

          // Get APY
          const apy =
            market?.apyCalculation?.apy ||
            (market?.supplyRate ? market.supplyRate * 100 : 0);

          transformedDeposits.push({
            asset: token.symbol,
            icon: token.logoPath,
            balance: actualBalance,
            value: actualBalance * tokenPrice,
            apy: apy,
            tokenPrice: tokenPrice,
            poolId: appId,
            network: networkId,
            type: "deposit",
          });
        } catch (error) {
          console.error("Error transforming deposit item:", error, item);
        }
      });
    }

    if (user?.computed?.borrows && Array.isArray(user.computed.borrows)) {
      user.computed.borrows.forEach((item: any) => {
        try {
          const networkId = item.network;
          const marketId =
            item.marketId?.toString() || item.underlyingContractId?.toString();
          const appId = item.appId?.toString() || item.poolId?.toString();

          if (!networkId || !marketId || !appId) {
            console.warn("Missing required fields for borrow item:", item);
            return;
          }

          // Get tokens for this network
          const tokens = getAllTokensWithDisplayInfo(networkId as any);

          // Find token matching marketId and poolId
          const token = tokens.find(
            (t) =>
              (t.underlyingContractId === marketId ||
                t.originalContractId === marketId) &&
              t.poolId === appId
          );

          if (!token) {
            console.warn(
              `Token not found for marketId ${marketId}, appId ${appId} on network ${networkId}`
            );
            return;
          }

          // Find market data
          const market = marketData.find(
            (m) =>
              m.symbol === token.symbol &&
              (m.poolId === appId || m.appId === appId)
          );

          // Calculate actual balance from scaled borrows
          // Formula: actual_borrows = (scaled_borrows * current_borrow_index) / SCALE
          // SCALE = 1e18
          const SCALE = BigInt(1e18);
          // Handle scaledBorrows as string or number from API
          const scaledBorrowsValue =
            typeof item.scaledBorrows === "string"
              ? item.scaledBorrows
              : (item.scaledBorrows || 0).toString();
          const scaledBorrows = BigInt(scaledBorrowsValue);

          // Get borrowIndex from market data - it should be a string representation of BigInt
          // If not available, use default SCALE (1e18) as fallback to still show the item
          let borrowIndex: bigint;
          let borrowIndexStr: string;
          if (!market?.borrowIndex) {
            console.warn(
              `[Portfolio] borrowIndex not found for ${token.symbol} (poolId: ${appId}), using default SCALE`
            );
            borrowIndex = SCALE;
            borrowIndexStr = SCALE.toString();
          } else {
            borrowIndexStr = market.borrowIndex.toString();
            borrowIndex = BigInt(borrowIndexStr);
          }

          const actualBorrowsRaw =
            scaledBorrows === 0n ? 0n : (scaledBorrows * borrowIndex) / SCALE;

          // actualBorrowsRaw is in the smallest unit (e.g., micro-units for 6 decimals)
          // Divide by token decimals to get human-readable amount
          const actualBalance =
            Number(actualBorrowsRaw) / Math.pow(10, token.decimals);

          // Sanity check: if balance seems unreasonably high (> 1e10), there might be a conversion issue
          if (actualBalance > 1e10) {
            console.error(
              `[Portfolio] Unreasonably high balance calculated for ${token.symbol}:`,
              {
                scaledBorrows: scaledBorrowsValue,
                borrowIndex: borrowIndexStr,
                actualBorrowsRaw: actualBorrowsRaw.toString(),
                tokenDecimals: token.decimals,
                actualBalance,
                item: item,
              }
            );
            return; // Skip this item if calculation seems wrong
          }

          // Debug logging
          console.log(
            `[Portfolio] Borrow transformation for ${token.symbol}:`,
            {
              scaledBorrows: scaledBorrowsValue,
              borrowIndex: borrowIndexStr,
              actualBorrowsRaw: actualBorrowsRaw.toString(),
              tokenDecimals: token.decimals,
              actualBalance,
              marketFound: !!market,
            }
          );

          if (actualBalance <= 0) {
            return; // Skip zero balances
          }

          // Get token price
          const tokenPrice = market?.price
            ? formatPriceFromContract(market.price, token.decimals)
            : 1;

          // Get APY
          const apy =
            market?.borrowApyCalculation?.apy ||
            (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0);

          transformedBorrows.push({
            asset: token.symbol,
            icon: token.logoPath,
            balance: actualBalance,
            value: actualBalance * tokenPrice,
            apy: apy,
            tokenPrice: tokenPrice,
            poolId: appId,
            network: networkId,
            type: "borrow",
          });
        } catch (error) {
          console.error("Error transforming borrow item:", error, item);
        }
      });
    }

    return { deposits: transformedDeposits, borrows: transformedBorrows };
  }, [user?.computed?.deposits, user?.computed?.borrows, marketData]);

  // Use transformed deposits and borrows from user.computed, fallback to userPositions
  // If user.computed exists but transformation resulted in empty arrays, fall back to userPositions
  const hasComputedData = user?.computed?.deposits || user?.computed?.borrows;
  const deposits =
    hasComputedData && transformedDepositsAndBorrows.deposits.length > 0
      ? transformedDepositsAndBorrows.deposits
      : userPositions.filter((pos) => pos.type === "deposit");
  const borrows =
    hasComputedData && transformedDepositsAndBorrows.borrows.length > 0
      ? transformedDepositsAndBorrows.borrows
      : userPositions.filter((pos) => pos.type === "borrow");

  // Debug logging
  console.log("[Portfolio] Final deposits and borrows:", {
    hasComputedData,
    transformedDepositsCount: transformedDepositsAndBorrows.deposits.length,
    transformedBorrowsCount: transformedDepositsAndBorrows.borrows.length,
    userPositionsDepositsCount: userPositions.filter(
      (pos) => pos.type === "deposit"
    ).length,
    userPositionsBorrowsCount: userPositions.filter(
      (pos) => pos.type === "borrow"
    ).length,
    finalDepositsCount: deposits.length,
    finalBorrowsCount: borrows.length,
  });

  // Calculate totals - prioritize computed global values from API, then fallback to local calculations
  const totalCollateral =
    user?.computed?.globalCollateralValue !== undefined
      ? Number(user.computed.globalCollateralValue)
      : userGlobalData?.totalCollateralValue ||
        deposits.reduce((sum, deposit) => sum + deposit.value, 0);

  console.log({
    userGlobalData,
    userComputed: user?.computed,
    deposits,
  });

  const totalBorrowed =
    user?.computed?.globalBorrowValue !== undefined
      ? Number(user.computed.globalBorrowValue)
      : userGlobalData?.totalBorrowValue ||
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

  // Helper function to calculate health factor for given collateral and borrow values
  const calculateHealthFactor = (
    collateral: number,
    borrowed: number
  ): number | null => {
    if (collateral > 0 && borrowed > 0) {
      return (collateral * collateralFactor) / borrowed;
    } else if (collateral > 0) {
      return 10.0; // Excellent health when no borrows
    }
    return null; // No calculation possible when no collateral
  };

  // Helper function to saturate health factor values at 3.00 for display
  const saturateHealthFactor = (healthFactor: number | null): number | null => {
    if (healthFactor === null) return null;
    return Math.min(healthFactor, 3.0);
  };

  const healthFactor = calculateHealthFactor(totalCollateral, totalBorrowed);
  const displayHealthFactor = saturateHealthFactor(healthFactor);

  // Calculate Net LTV (Loan-to-Value ratio)
  const netLTV =
    totalCollateral > 0 ? (totalBorrowed / totalCollateral) * 100 : 0;

  // Liquidation margin = Liquidation Threshold - Net LTV
  // This represents the safety buffer before liquidation
  const liquidationMargin =
    totalCollateral > 0 ? weightedLiquidationThreshold * 100 - netLTV : 0;

  // Transform deposits and borrows for the success modal
  const modalDeposits = useMemo(() => {
    return deposits
      .filter((deposit) => deposit.value > 0)
      .map((deposit) => ({
        asset: deposit.asset,
        icon: deposit.icon,
        value: deposit.value,
        apy: deposit.apy,
      }));
  }, [deposits]);

  const modalBorrows = useMemo(() => {
    return borrows
      .filter((borrow) => borrow.value > 0)
      .map((borrow) => ({
        asset: borrow.asset,
        icon: borrow.icon,
        value: borrow.value,
        apy: borrow.apy,
      }));
  }, [borrows]);

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
    usingComputedValues: user?.computed !== undefined,
    globalNetPortfolioValue: user?.computed?.globalNetPortfolioValue,
    networkValues: user?.computed?.networkValues,
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
  const fetchWalletBalance = async (
    asset: string,
    networkId?: string,
    doFetch?: boolean
  ) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Use provided network or fallback to current network
    const networkToUse = networkId || currentNetwork;

    if (!networkToUse) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Check if we already have this balance cached (with network-specific key)
    const cacheKey = `${networkToUse}-${asset}`;
    console.log("[Portfolio] fetchWalletBalance cache check:", {
      asset,
      networkId,
      networkToUse,
      cacheKey,
      cached: !!walletBalances[cacheKey],
    });
    if (walletBalances[cacheKey] && !doFetch) {
      console.log(
        "[Portfolio] Using cached balance:",
        walletBalances[cacheKey]
      );
      return walletBalances[cacheKey];
    }

    try {
      console.log("[Portfolio] Fetching fresh balance for:", {
        asset,
        networkToUse,
      });
      const tokens = getAllTokensWithDisplayInfo(networkToUse as any);
      const token = tokens.find((t) => t.symbol === asset);

      console.log("token", token);

      if (!token) {
        console.error(
          `Token ${asset} not found in network config for network: ${networkToUse}`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Get the original token config to access tokenStandard
      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as any).originalSymbol : asset;
      const originalTokenConfigRaw = getTokenConfig(
        networkToUse as any,
        originalSymbol
      );
      console.log("originalTokenConfigRaw", { originalTokenConfigRaw, token });
      if (!originalTokenConfigRaw) {
        console.error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Handle array of token configs (multiple markets)
      // For multi-market tokens, find the one matching the token's poolId
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
        ? originalTokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || originalTokenConfigRaw[0]
        : originalTokenConfigRaw;

      // Initialize ARC200Service with clients for the specific network
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkToUse as any
      );
      let clients;
      if (algorandNetwork) {
        // Use the specific network's clients
        clients = await algorandService.initializeClientsForReads(
          algorandNetwork
        );
      } else {
        // Fallback to current network if conversion fails
        console.warn(
          `Could not convert networkId ${networkToUse} to AlgorandNetwork, using current network`
        );
        clients = await algorandService.getCurrentClientsForReads();
      }
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
        console.log("arc200Balance", { arc200Balance });

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
          // Use the same clients we initialized earlier for this network
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
          // Use the same clients we initialized earlier for this network
          const assetId = parseInt(token.underlyingAssetId);
          const accAssetInfo = await clients.algod
            .accountAssetInformation(activeAccount.address, assetId)
            .do();

          if (accAssetInfo.assetHolding) {
            // Convert from smallest units to human readable format
            balance =
              Number(accAssetInfo.assetHolding.amount) /
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
      } else if (originalTokenConfig.tokenStandard === "arc200-exchange") {
        // For ASA tokens, fetch asset balance
        console.log(
          `Fetching ASA balance for ${asset} (asset ID: ${token.underlyingAssetId})`
        );
        try {
          // Use the same clients we initialized earlier for this network
          const assetId = parseInt(token.underlyingAssetId);
          const accAssetInfo = await clients.algod
            .accountAssetInformation(activeAccount.address, assetId)
            .do();

          if (accAssetInfo.assetHolding) {
            // Convert from smallest units to human readable format
            balance =
              Number(accAssetInfo.assetHolding.amount) /
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
      // Note: marketData might only contain current network's data
      // For cross-network balances, we might need to fetch market data separately
      const market = marketData.find((m) => m.symbol === asset);
      let tokenPrice = 1;

      if (market?.price) {
        tokenPrice = formatPriceFromContract(market.price, token.decimals);
      } else if (networkToUse !== currentNetwork) {
        // If market not found and we're on a different network, try to get price from token config or use default
        console.warn(
          `Market data not found for ${asset} on ${networkToUse}, using default price`
        );
        tokenPrice = 1;
      }

      console.log({ market, tokenPrice, marketData, asset });

      const balanceUSD = balance * tokenPrice;

      const balanceData = {
        balance,
        balanceUSD,
      };

      setWalletBalances((prev) => ({
        ...prev,
        [cacheKey]: balanceData, // Store with network-specific key
        [asset]: balanceData, // Also store with asset key for backward compatibility
      }));

      console.log(
        `[Portfolio] Final balance data for ${asset} on ${networkToUse}:`,
        {
          balanceData,
          cacheKey,
          stored: true,
        }
      );
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  // Refresh wallet balance for a specific asset
  const refreshWalletBalance = useCallback(
    async (asset: string, networkId?: string) => {
      if (!activeAccount?.address) return;

      try {
        // Clear cached balance
        setWalletBalances((prev) => {
          const newBalances = { ...prev };
          delete newBalances[asset];
          return newBalances;
        });

        // Fetch fresh balance using the provided network
        await fetchWalletBalance(asset, networkId, true);
      } catch (error) {
        console.error("Error refreshing wallet balance:", error);
      }
    },
    [activeAccount?.address, currentNetwork]
  );

  // Function to refresh positions data
  const handleRefreshPositions = async () => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingPositions(true);
    try {
      // fetch market from node api for accurate position info
      // Fetch fresh market data and global data first
      const markets = await fetchAllMarkets(currentNetwork);
      // const marketDataResponse =
      //   await dorkfiAPIService.getAllMarketDataByNetwork(currentNetwork);
      // const freshMarketData = marketDataResponse.success
      //   ? marketDataResponse.data
      //   : [];
      const marketData = markets;

      const freshGlobalData = await fetchUserGlobalData(
        activeAccount.address,
        currentNetwork,
        marketData
      );

      // Fetch user positions from all enabled networks (not just currentNetwork)
      // This ensures VOI items don't disappear when doing Algorand transactions
      const enabledNetworks = getEnabledNetworks();
      const allPositions = [];

      for (const networkId of enabledNetworks) {
        try {
          const networkMarkets = await fetchAllMarkets(networkId);
          const networkPositions = await fetchUserPositions(
            activeAccount.address,
            networkId,
            networkMarkets
          );
          allPositions.push(...networkPositions);
        } catch (error) {
          console.error(
            `Error fetching positions for network ${networkId}:`,
            error
          );
        }
      }

      setMarketData(marketData);
      setUserPositions(allPositions);
      setUserGlobalData(freshGlobalData);
    } catch (error) {
      console.error("Error refreshing positions:", error);
      setDataError("Failed to refresh positions data");
    } finally {
      setIsLoadingPositions(false);
    }
  };

  const fetchUser = async (userAddress: string) => {
    try {
      // Try API endpoint first for faster loading
      console.log(
        `[Portfolio] Attempting to fetch user data from API for ${userAddress}`
      );
      const apiResponse = await dorkfiAPIService.getUser(userAddress);

      console.log("[Portfolio] API response:", apiResponse);

      if (apiResponse.success && apiResponse.data) {
        const user = apiResponse.data;
        console.log("[Portfolio] User data fetched from API:", user);
        const networks = user.networks;
        console.log(
          "[Portfolio] User data globalUserData:",
          user.globalUserData
        );
        const globalCollateralValue =
          user.globalUserData
            .map((item: any) => BigInt(item.totalCollateralValue))
            .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
          BigInt(1e12);
        console.log(
          "[Portfolio] Global collateral value:",
          globalCollateralValue
        );
        const globalBorrowValue =
          user.globalUserData
            .map((item: any) => BigInt(item.totalBorrowValue))
            .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
          BigInt(1e12);
        console.log("[Portfolio] Global borrow value:", globalBorrowValue);
        const globalNetPortfolioValue =
          globalCollateralValue - globalBorrowValue;
        console.log(
          "[Portfolio] Global net portfolio value:",
          globalNetPortfolioValue
        );

        // Calculate collateral, borrow, and net value for each network
        const networkValues: Record<
          string,
          {
            collateral: number;
            borrow: number;
            netValue: number;
          }
        > = {};

        if (user.globalUserData && Array.isArray(user.globalUserData)) {
          user.globalUserData.forEach((item: any) => {
            const network = item.network || "unknown";
            const collateralValue = Number(
              BigInt(item.totalCollateralValue) / BigInt(1e12)
            );
            const borrowValue = Number(
              BigInt(item.totalBorrowValue) / BigInt(1e12)
            );
            const netValue = collateralValue - borrowValue;

            if (!networkValues[network]) {
              networkValues[network] = {
                collateral: 0,
                borrow: 0,
                netValue: 0,
              };
            }

            networkValues[network].collateral += collateralValue;
            networkValues[network].borrow += borrowValue;
            networkValues[network].netValue += netValue;
          });
          const deposits = [];
          const borrows = [];
          if (user.userData && Array.isArray(user.userData)) {
            user.userData.forEach((item: any) => {
              if (BigInt(item.scaledDeposits) > BigInt(0)) deposits.push(item);
              if (BigInt(item.scaledBorrows) > BigInt(0)) borrows.push(item);
            });
          }
          const computedUser = {
            ...user,
            computed: {
              globalCollateralValue: Number(globalCollateralValue),
              globalBorrowValue: Number(globalBorrowValue),
              globalNetPortfolioValue: Number(globalNetPortfolioValue),
              networkValues: networkValues,
              deposits,
              borrows,
            },
          };
          console.log("[Portfolio] User:", computedUser);
          setUser(computedUser);
        }

        console.log("[Portfolio] Network values:", networkValues);
      } else {
        console.error("Error fetching user data:", apiResponse);
      }
    } catch (error) {
      console.error("Error fetching user global data:", error);
    }
  };

  useEffect(() => {
    if (activeAccount?.address) {
      fetchUser(activeAccount.address);
    }
  }, [activeAccount?.address]);

  // Fetch market data for all enabled networks when user data is available
  useEffect(() => {
    const fetchMarketDataForAllNetworks = async () => {
      if (!user?.computed) {
        return; // Wait for user data to be available
      }

      try {
        const enabledNetworks = getEnabledNetworks();
        const allMarketData: any[] = [];

        // Fetch market data for each enabled network
        for (const networkId of enabledNetworks) {
          try {
            const markets = await fetchAllMarkets(networkId as any);
            allMarketData.push(...markets);
          } catch (error) {
            console.error(
              `Error fetching market data for network ${networkId}:`,
              error
            );
          }
        }

        console.log("[Portfolio] Fetched market data for all networks:", {
          count: allMarketData.length,
          networks: enabledNetworks,
        });

        setMarketData(allMarketData);
      } catch (error) {
        console.error("Error fetching market data:", error);
      }
    };

    fetchMarketDataForAllNetworks();
  }, [user?.computed, activeAccount?.address]);

  // Fetch user global data and market data when wallet connects
  // useEffect(() => {
  //   const fetchData = async () => {
  //     if (!activeAccount?.address || !currentNetwork) {
  //       setUserGlobalData(null);
  //       setMarketData([]);
  //       return;
  //     }

  //     setIsLoadingData(true);
  //     setDataError(null);

  //     try {
  //       console.log(
  //         "Fetching user global data for:",
  //         activeAccount.address,
  //         "on network:",
  //         currentNetwork
  //       );

  //       // fetch market data from api for faster response on page load
  //       // Fetch markets first, then global data (so we can pass marketData for healthFactorIndex calculation)
  //       const markets = await fetchAllMarkets(currentNetwork);
  //       const tokens = getAllTokensWithDisplayInfo(currentNetwork);
  //       const marketDataResponse =
  //         await dorkfiAPIService.getAllMarketDataByNetwork(currentNetwork);
  //       const freshMarketData = marketDataResponse.success
  //         ? marketDataResponse.data.map((item: any) => {
  //             // Try multiple matching strategies to find the correct token
  //             let token = tokens.find(
  //               (t) =>
  //                 t.originalContractId === `${item.marketId}` &&
  //                 t.poolId === `${item.appId}`
  //             );

  //             // If not found, try matching by underlyingContractId
  //             if (!token) {
  //               token = tokens.find(
  //                 (t) =>
  //                   t.underlyingContractId === `${item.marketId}` &&
  //                   t.poolId === `${item.appId}`
  //               );
  //             }

  //             // If still not found, try matching by poolId and marketId "0" (for network tokens like VOI)
  //             if (!token && item.marketId === "0") {
  //               token = tokens.find(
  //                 (t) =>
  //                   t.poolId === `${item.appId}` &&
  //                   (t.assetId === "0" || t.originalContractId === "0")
  //               );
  //             }

  //             // Log if token not found for debugging
  //             if (!token) {
  //               console.warn(
  //                 `Token not found for marketId ${item.marketId}, appId ${item.appId}`,
  //                 {
  //                   availableTokens: tokens.map((t) => ({
  //                     symbol: t.symbol,
  //                     originalContractId: t.originalContractId,
  //                     underlyingContractId: t.underlyingContractId,
  //                     poolId: t.poolId,
  //                   })),
  //                 }
  //               );
  //             }

  //             return enhanceAVMMarketInfo(item, token as any);
  //           })
  //         : [];
  //       const marketData = markets;

  //       const globalData = await fetchUserGlobalData(
  //         activeAccount.address,
  //         currentNetwork,
  //         marketData
  //       );

  //       // Fetch user positions from all enabled networks
  //       const enabledNetworks = getEnabledNetworks();
  //       const allPositions = [];

  //       for (const networkId of enabledNetworks) {
  //         try {
  //           const networkMarkets = await fetchAllMarkets(networkId);
  //           const networkPositions = await fetchUserPositions(
  //             activeAccount.address,
  //             networkId,
  //             networkMarkets
  //           );
  //           allPositions.push(...networkPositions);
  //         } catch (error) {
  //           console.error(
  //             `Error fetching positions for network ${networkId}:`,
  //             error
  //           );
  //         }
  //       }

  //       console.log({
  //         markets,
  //         freshMarketData,
  //         marketData,
  //         globalData: globalData,
  //         positions: allPositions,
  //       });

  //       if (globalData) {
  //         console.log("User global data fetched:", globalData);
  //         setUserGlobalData(globalData);
  //       } else {
  //         console.log("No user global data found");
  //         setUserGlobalData(null);
  //       }

  //       if (freshMarketData) {
  //         console.log("Market data fetched:", freshMarketData);
  //         setMarketData(freshMarketData);
  //       } else {
  //         console.log("No market data found");
  //         setMarketData([]);
  //       }

  //       if (allPositions && allPositions.length > 0) {
  //         console.log(
  //           "User positions fetched from all networks:",
  //           allPositions
  //         );
  //         setUserPositions(allPositions);
  //       } else {
  //         console.log("No user positions found");
  //         setUserPositions([]);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching data:", error);
  //       setDataError(
  //         error instanceof Error ? error.message : "Failed to fetch data"
  //       );
  //       setUserGlobalData(null);
  //       setMarketData([]);
  //     } finally {
  //       setIsLoadingData(false);
  //     }
  //   };

  //   fetchData();
  // }, [activeAccount?.address, currentNetwork]);

  // Reset showAllSuppliedAssets when filters change
  useEffect(() => {
    setShowAllSuppliedAssets(false);
  }, [suppliedAssetsSearchTerm, selectedNetworkFilter]);

  // Reset showAllBorrowedAssets when filters change
  useEffect(() => {
    setShowAllBorrowedAssets(false);
  }, [borrowedAssetsSearchTerm, selectedNetworkFilter]);

  const handleDepositClick = async (
    asset: string,
    poolId?: string,
    networkId?: string
  ) => {
    if (!activeAccount?.address) {
      return;
    }

    console.log("[Portfolio] handleDepositClick called with:", {
      asset,
      poolId,
      networkId,
      currentNetwork,
    });

    setIsLoadingWalletBalance(true);

    try {
      // Fetch wallet balance before opening modal using the deposit's network
      console.log("[Portfolio] Fetching wallet balance for:", {
        asset,
        networkId,
        currentNetwork,
      });
      const balanceResult = await fetchWalletBalance(asset, networkId, true);
      console.log("[Portfolio] Wallet balance fetched:", {
        asset,
        networkId,
        balance: balanceResult,
      });

      // Open modal after balance is fetched
      setDepositModal({ isOpen: true, asset, poolId, network: networkId });
    } catch (error) {
      console.error("Error fetching wallet balance for deposit:", error);
      // Still open modal even if balance fetch fails
      setDepositModal({ isOpen: true, asset, poolId, network: networkId });
    } finally {
      setIsLoadingWalletBalance(false);
    }
  };

  const handleWithdrawClick = (
    asset: string,
    poolId?: string,
    networkId?: string
  ) => {
    setWithdrawModal({ isOpen: true, asset, poolId, network: networkId });
  };

  const handleBorrowClick = async (
    asset: string,
    poolId?: string,
    networkId?: string
  ) => {
    setIsLoadingBorrowData(true);

    try {
      // Use the asset's network if provided, otherwise fall back to currentNetwork
      const networkToUse = (networkId || currentNetwork) as any;

      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        // fetch markets from node api for accurate healthFactorIndex calculation
        // Fetch markets to pass for healthFactorIndex calculation
        const markets = await fetchAllMarkets(networkToUse);
        // const marketDataResponse =
        //   await dorkfiAPIService.getAllMarketDataByNetwork(networkToUse);
        // const markets = marketDataResponse.success
        //   ? marketDataResponse.data
        //   : [];
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          networkToUse,
          markets
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(networkToUse);
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            networkToUse
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
      setBorrowModal({ isOpen: true, asset, poolId, network: networkToUse });
    } catch (error) {
      console.error("Error fetching user data for borrow:", error);
      // Still open modal even if data fetch fails
      setBorrowModal({
        isOpen: true,
        asset,
        poolId,
        network: networkId || currentNetwork,
      });
    } finally {
      setIsLoadingBorrowData(false);
    }
  };

  const handleRepayClick = async (
    asset: string,
    poolId?: string,
    networkId?: string
  ) => {
    if (!activeAccount?.address) {
      console.error("No active account for repayment");
      return;
    }

    try {
      // Fetch wallet balance for the asset before opening modal using the asset's network
      await refreshWalletBalance(asset, networkId);

      // Open modal after wallet balance is fetched
      setRepayModal({ isOpen: true, asset, poolId, network: networkId });
    } catch (error) {
      console.error("Error fetching wallet balance for repay:", error);
      // Still open modal even if wallet balance fetch fails
      setRepayModal({ isOpen: true, asset, poolId, network: networkId });
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

  // Show loading state while avatar check is in progress
  if (!isAvatarResolved) {
    return (
      <div className="space-y-6">
        {/* Hero Section Skeleton */}
        <DorkFiCard className="relative text-center overflow-hidden p-6 md:p-8">
          <div className="space-y-4">
            <Skeleton className="h-12 w-64 mx-auto" />
            <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
        </DorkFiCard>

        {/* Health Factor Skeleton */}
        <DorkFiCard className="p-6 md:p-8">
          <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-8 lg:gap-10">
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-40" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
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
                user?.computed || userGlobalData
                  ? "bg-green-500"
                  : "bg-gray-500"
              }`}
            ></div>
            <span>
              {user?.computed
                ? "Global Portfolio Data"
                : userGlobalData
                ? "Live Data"
                : "No Data"}{" "}
              • {addressName || `${activeAccount?.address.slice(0, 8)}...${activeAccount?.address.slice(-8)}`}
            </span>
            {user?.computed?.globalNetPortfolioValue !== undefined && (
              <span className="ml-2">
                • Net Value:{" "}
                {Number(user.computed.globalNetPortfolioValue).toLocaleString(
                  "en-US",
                  {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </span>
            )}
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

      {/* Render health factor section after avatar check is complete */}
      {isAvatarResolved && (
      <EnhancedHealthFactor
        healthFactor={displayHealthFactor}
        totalCollateral={totalCollateral}
        totalBorrowed={totalBorrowed}
        liquidationMargin={liquidationMargin}
        netLTV={netLTV}
          dorkNftImage={avatarImage || undefined}
        underwaterBg="/lovable-uploads/44ebe994-a30e-4eb1-a4a1-776aa2978776.png"
        onAddCollateral={handleAddCollateral}
        onBuyVoi={handleBuyVoi}
        onEditProfile={() => setNftModalOpen(true)}
      />
      )}

      {/* Network Portfolio Breakdown */}
      {user?.computed?.networkValues &&
        Object.keys(user.computed.networkValues).length > 0 && (
          <DorkFiCard className="p-6 md:p-8">
            <div className="mb-6">
              <H1 className="text-2xl md:text-3xl mb-2">Network Portfolio</H1>
              <Body className="text-sm text-muted-foreground">
                View your portfolio breakdown by network. These values sum up to
                your global portfolio.
              </Body>
            </div>

            {/* Network Filter Tabs */}
            <Tabs
              value={selectedNetworkFilter}
              onValueChange={setSelectedNetworkFilter}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="all" className="text-sm">
                  All Networks
                </TabsTrigger>
                <TabsTrigger value="algorand" className="text-sm">
                  Algorand
                </TabsTrigger>
                <TabsTrigger value="voi" className="text-sm">
                  VOI
                </TabsTrigger>
              </TabsList>

              {/* Visual Slice: Allocation + Risk */}
              {(() => {
                // Calculate allocation data
                const allocationData = (() => {
                  if (selectedNetworkFilter === "all") {
                    // Show allocation by network
                    return Object.entries(user.computed.networkValues)
                      .map(([network, values]: [string, any]) => {
                        const networkDisplayName = network
                          .split("-")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                          )
                          .join(" ");
                        return {
                          name: networkDisplayName,
                          value: values.collateral || 0,
                          network: network.toLowerCase(),
                        };
                      })
                      .filter((item) => item.value > 0)
                      .sort((a, b) => b.value - a.value);
                  } else {
                    // Show allocation by asset for selected network
                    const filteredDeposits = deposits.filter((deposit) => {
                      // This is a simplified filter - in a real scenario, you'd match by network
                      return true; // For now, show all deposits
                    });

                    const assetMap = new Map<string, number>();
                    filteredDeposits.forEach((deposit) => {
                      const current = assetMap.get(deposit.asset) || 0;
                      assetMap.set(deposit.asset, current + deposit.value);
                    });

                    return Array.from(assetMap.entries())
                      .map(([asset, value]) => ({
                        name: asset,
                        value,
                        asset,
                      }))
                      .filter((item) => item.value > 0)
                      .sort((a, b) => b.value - a.value);
                  }
                })();

                const totalAllocation = allocationData.reduce(
                  (sum, item) => sum + item.value,
                  0
                );

                // Calculate risk metrics
                const topBorrowedAsset =
                  borrows.length > 0
                    ? borrows.reduce((top, current) =>
                        current.value > (top?.value || 0) ? current : top
                      )
                    : null;

                const topBorrowedPercentage =
                  topBorrowedAsset && totalBorrowed > 0
                    ? (topBorrowedAsset.value / totalBorrowed) * 100
                    : 0;

                // Find position closest to liquidation (lowest health factor)
                const positionsWithHealth = deposits
                  .map((deposit) => {
                    // For each deposit, calculate a simplified health factor
                    // This is a simplified calculation - in reality, you'd need network-specific data
                    const depositHealthFactor = calculateHealthFactor(
                      deposit.value,
                      0
                    );
                    return {
                      ...deposit,
                      healthFactor: depositHealthFactor,
                    };
                  })
                  .filter((pos) => pos.healthFactor !== null);

                const closestToLiquidation =
                  borrows.length > 0 &&
                  healthFactor !== null &&
                  healthFactor < 2.0
                    ? {
                        asset: "Portfolio",
                        healthFactor: healthFactor,
                      }
                    : null;

                // Chart colors
                const COLORS = [
                  "#0ea5e9", // sky-500
                  "#8b5cf6", // violet-500
                  "#10b981", // emerald-500
                  "#f59e0b", // amber-500
                  "#ef4444", // red-500
                  "#06b6d4", // cyan-500
                  "#a855f7", // purple-500
                  "#14b8a6", // teal-500
                ];

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Left: Allocation Chart */}
                    <DorkFiCard className="p-5">
                      <h3 className="text-lg font-semibold mb-4">
                        Collateral Allocation
                      </h3>
                      {totalAllocation > 0 && allocationData.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={allocationData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {allocationData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => [
                                  `$${value.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`,
                                  "Collateral",
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="mt-4 w-full space-y-2">
                            {allocationData.slice(0, 5).map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor:
                                        COLORS[index % COLORS.length],
                                    }}
                                  />
                                  <span className="text-muted-foreground">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-semibold">
                                  {(
                                    (item.value / totalAllocation) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                          <p>No collateral data available</p>
                        </div>
                      )}
                    </DorkFiCard>

                    {/* Right: Risk Cards */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">
                        Risk Overview
                      </h3>

                      {/* Top Borrowed Asset Card */}
                      {topBorrowedAsset && topBorrowedPercentage > 0 && (
                        <DorkFiCard className="p-4 border-l-4 border-amber-500">
                          <div className="flex items-start gap-3">
                            <TrendingDown className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">
                                Top Borrowed Asset
                              </div>
                              <div className="text-base font-bold">
                                {topBorrowedAsset.asset}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {topBorrowedPercentage.toFixed(1)}% of total
                                borrows
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                $
                                {topBorrowedAsset.value.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                        </DorkFiCard>
                      )}

                      {/* Closest to Liquidation Card */}
                      {closestToLiquidation && (
                        <DorkFiCard className="p-4 border-l-4 border-red-500">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                                Closest to Liquidation
                              </div>
                              <div className="text-base font-bold">
                                {closestToLiquidation.asset}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Health Factor:{" "}
                                <span
                                  className={`font-semibold ${
                                    closestToLiquidation.healthFactor >= 1.5
                                      ? "text-green-600 dark:text-green-400"
                                      : closestToLiquidation.healthFactor >= 1.0
                                      ? "text-yellow-600 dark:text-yellow-400"
                                      : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {closestToLiquidation.healthFactor.toFixed(2)}
                                </span>
                              </div>
                              {closestToLiquidation.healthFactor < 1.5 && (
                                <div className="text-xs text-red-500 mt-1">
                                  Consider adding collateral or repaying debt
                                </div>
                              )}
                            </div>
                          </div>
                        </DorkFiCard>
                      )}

                      {/* Risk Score Card */}
                      {healthFactor !== null && (
                        <DorkFiCard className="p-4 border-l-4 border-ocean-teal">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-ocean-teal mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-ocean-teal mb-1">
                                Portfolio Risk Score
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex-1">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                      className={`h-2.5 rounded-full transition-all ${
                                        healthFactor >= 2.0
                                          ? "bg-green-500"
                                          : healthFactor >= 1.5
                                          ? "bg-yellow-500"
                                          : healthFactor >= 1.0
                                          ? "bg-orange-500"
                                          : "bg-red-500"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          ((displayHealthFactor || 0) / 3.0) *
                                            100,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="text-sm font-semibold">
                                  {displayHealthFactor !== null
                                    ? displayHealthFactor.toFixed(2)
                                    : "N/A"}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                {healthFactor >= 2.0
                                  ? "Low Risk"
                                  : healthFactor >= 1.5
                                  ? "Moderate Risk"
                                  : healthFactor >= 1.0
                                  ? "High Risk"
                                  : "Critical Risk"}
                              </div>
                            </div>
                          </div>
                        </DorkFiCard>
                      )}

                      {/* Empty state if no risk data */}
                      {!topBorrowedAsset &&
                        !closestToLiquidation &&
                        healthFactor === null && (
                          <DorkFiCard className="p-4">
                            <div className="text-center text-muted-foreground">
                              <p className="text-sm">No risk data available</p>
                            </div>
                          </DorkFiCard>
                        )}
                    </div>
                  </div>
                );
              })()}

              {/* Network Portfolio Cards */}
              {(() => {
                const filteredNetworks = Object.entries(
                  user.computed.networkValues
                ).filter(([network, values]: [string, any]) => {
                  // Filter by network type
                  if (selectedNetworkFilter !== "all") {
                    const normalizedNetwork = network.toLowerCase();
                    if (selectedNetworkFilter === "algorand") {
                      if (!normalizedNetwork.includes("algorand")) return false;
                    } else if (selectedNetworkFilter === "voi") {
                      if (!normalizedNetwork.includes("voi")) return false;
                    }
                  }

                  // Only show networks with activity
                  const networkCollateral = values.collateral || 0;
                  const networkBorrow = values.borrow || 0;
                  return networkCollateral > 0 || networkBorrow > 0;
                });

                if (filteredNetworks.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No networks found for the selected filter.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNetworks.map(
                      ([network, values]: [string, any]) => {
                        const networkDisplayName = network
                          .split("-")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                          )
                          .join(" ");

                        const networkCollateral = values.collateral || 0;
                        const networkBorrow = values.borrow || 0;
                        const networkNetValue = values.netValue || 0;
                        const networkHealthFactorRaw = calculateHealthFactor(
                          networkCollateral,
                          networkBorrow
                        );
                        const networkHealthFactor = saturateHealthFactor(
                          networkHealthFactorRaw
                        );

                        return (
                          <DorkFiCard
                            key={network}
                            className="p-5 border-2 hover:border-ocean-teal/50 transition-all"
                          >
                            <div className="space-y-4">
                              <div>
                                <h3 className="text-lg font-semibold mb-1">
                                  {networkDisplayName} Portfolio
                                </h3>
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">
                                    Collateral:
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {networkCollateral.toLocaleString("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">
                                    Borrowed:
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {networkBorrow.toLocaleString("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">
                                    Net Value:
                                  </span>
                                  <span
                                    className={`text-sm font-semibold ${
                                      networkNetValue >= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {networkNetValue.toLocaleString("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>

                                <div className="pt-2 border-t border-border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">
                                      Health Factor:
                                    </span>
                                    <span
                                      className={`text-sm font-semibold ${
                                        networkHealthFactor === null
                                          ? "text-muted-foreground"
                                          : networkHealthFactor >= 1.5
                                          ? "text-green-600 dark:text-green-400"
                                          : networkHealthFactor >= 1.0
                                          ? "text-yellow-600 dark:text-yellow-400"
                                          : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {networkHealthFactor === null
                                        ? "N/A"
                                        : networkHealthFactor.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DorkFiCard>
                        );
                      }
                    )}
                  </div>
                );
              })()}
            </Tabs>
          </DorkFiCard>
        )}

      {/* Per-Network Asset Tables */}
      {user?.computed?.networkValues &&
        Object.keys(user.computed.networkValues).length > 0 && (
          <TooltipProvider>
            <div className="space-y-6">
              {/* Supplied Assets Table */}
              {deposits.length > 0 && (
                <DorkFiCard className="p-6 md:p-8">
                  <div ref={suppliedAssetsTableRef} className="mb-4">
                    <H1 className="text-xl md:text-2xl mb-2">
                      Supplied Assets
                      {selectedNetworkFilter !== "all" && (
                        <span className="text-lg text-muted-foreground ml-2">
                          (
                          {selectedNetworkFilter.charAt(0).toUpperCase() +
                            selectedNetworkFilter.slice(1)}
                          )
                        </span>
                      )}
                    </H1>
                  </div>
                  <div className="mb-4">
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search assets..."
                        value={suppliedAssetsSearchTerm}
                        onChange={(e) =>
                          setSuppliedAssetsSearchTerm(e.target.value)
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (suppliedAssetsSort.column === "asset") {
                                  setSuppliedAssetsSort({
                                    column: "asset",
                                    direction:
                                      suppliedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setSuppliedAssetsSort({
                                    column: "asset",
                                    direction: "asc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Asset
                              {suppliedAssetsSort.column === "asset" ? (
                                suppliedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          {selectedNetworkFilter === "all" && (
                            <TableHead>
                              <button
                                onClick={() => {
                                  if (suppliedAssetsSort.column === "network") {
                                    setSuppliedAssetsSort({
                                      column: "network",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "network",
                                      direction: "asc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Network
                                {suppliedAssetsSort.column === "network" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            </TableHead>
                          )}
                          <TableHead>
                            <button
                              onClick={() => {
                                if (suppliedAssetsSort.column === "supplied") {
                                  setSuppliedAssetsSort({
                                    column: "supplied",
                                    direction:
                                      suppliedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setSuppliedAssetsSort({
                                    column: "supplied",
                                    direction: "desc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Supplied
                              {suppliedAssetsSort.column === "supplied" ? (
                                suppliedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (suppliedAssetsSort.column === "value") {
                                  setSuppliedAssetsSort({
                                    column: "value",
                                    direction:
                                      suppliedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setSuppliedAssetsSort({
                                    column: "value",
                                    direction: "desc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Value (USD)
                              {suppliedAssetsSort.column === "value" ? (
                                suppliedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (suppliedAssetsSort.column === "apy") {
                                  setSuppliedAssetsSort({
                                    column: "apy",
                                    direction:
                                      suppliedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setSuppliedAssetsSort({
                                    column: "apy",
                                    direction: "desc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              APY
                              {suppliedAssetsSort.column === "apy" ? (
                                suppliedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (
                                    suppliedAssetsSort.column ===
                                    "borrowingPower"
                                  ) {
                                    setSuppliedAssetsSort({
                                      column: "borrowingPower",
                                      direction:
                                        suppliedAssetsSort.direction === "asc"
                                          ? "desc"
                                          : "asc",
                                    });
                                  } else {
                                    setSuppliedAssetsSort({
                                      column: "borrowingPower",
                                      direction: "desc",
                                    });
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                Borrow Power
                                {suppliedAssetsSort.column ===
                                "borrowingPower" ? (
                                  suppliedAssetsSort.direction === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Maximum amount you can borrow against this
                                    collateral (80% of collateral value)
                                  </p>
                                </TooltipContent>
                              </UITooltip>
                            </div>
                          </TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredAndSorted = deposits
                            .filter((deposit) => {
                              // Filter by search term
                              if (suppliedAssetsSearchTerm) {
                                const searchLower =
                                  suppliedAssetsSearchTerm.toLowerCase();
                                const assetMatch = deposit.asset
                                  .toLowerCase()
                                  .includes(searchLower);
                                if (!assetMatch) {
                                  return false;
                                }
                              }

                              // Filter by network
                              if (selectedNetworkFilter === "all") {
                                return true; // Show all deposits
                              }

                              // Get network from deposit (if available) or infer from networkValues
                              const depositNetwork = (deposit as any).network;
                              if (depositNetwork) {
                                const normalizedNetwork =
                                  depositNetwork.toLowerCase();
                                if (selectedNetworkFilter === "algorand") {
                                  return normalizedNetwork.includes("algorand");
                                } else if (selectedNetworkFilter === "voi") {
                                  return normalizedNetwork.includes("voi");
                                }
                              }

                              // Fallback: try to match by network values
                              const matchingNetwork = Object.entries(
                                user.computed.networkValues
                              ).find(([network, values]: [string, any]) => {
                                const normalizedNetwork = network.toLowerCase();
                                if (selectedNetworkFilter === "algorand") {
                                  return normalizedNetwork.includes("algorand");
                                } else if (selectedNetworkFilter === "voi") {
                                  return normalizedNetwork.includes("voi");
                                }
                                return false;
                              });

                              // If we can't determine, show it (better to show than hide)
                              return true;
                            })
                            .sort((a, b) => {
                              let comparison = 0;

                              switch (suppliedAssetsSort.column) {
                                case "network":
                                  const networkA = (
                                    (a as any).network || "Unknown"
                                  ).toLowerCase();
                                  const networkB = (
                                    (b as any).network || "Unknown"
                                  ).toLowerCase();
                                  comparison = networkA.localeCompare(networkB);
                                  break;
                                case "asset":
                                  comparison = a.asset.localeCompare(b.asset);
                                  break;
                                case "supplied":
                                  comparison = a.balance - b.balance;
                                  break;
                                case "value":
                                  comparison = a.value - b.value;
                                  break;
                                case "apy":
                                  comparison = a.apy - b.apy;
                                  break;
                                case "borrowingPower":
                                default:
                                  // Default sort by borrowing power
                                  const borrowingPowerA =
                                    a.value * collateralFactor;
                                  const borrowingPowerB =
                                    b.value * collateralFactor;
                                  comparison =
                                    borrowingPowerB - borrowingPowerA;
                                  break;
                              }

                              return suppliedAssetsSort.direction === "asc"
                                ? comparison
                                : -comparison;
                            });

                          const displayDeposits = showAllSuppliedAssets
                            ? filteredAndSorted
                            : filteredAndSorted.slice(0, 5);
                          const hasMore = filteredAndSorted.length > 5;

                          return displayDeposits.map((deposit, index) => {
                            const market = marketData.find(
                              (m) => m.symbol === deposit.asset
                            );
                            const isCollateral = deposit.value > 0; // Simplified - in reality, check if it's enabled as collateral

                            // Get network name from deposit or infer
                            let networkName = "Unknown";
                            const depositNetwork = (deposit as any).network;
                            if (depositNetwork) {
                              // Format network name: "algorand-mainnet" -> "Algorand", "voi-mainnet" -> "VOI"
                              const normalized = depositNetwork.toLowerCase();
                              if (normalized.includes("algorand")) {
                                networkName = "Algorand";
                              } else if (normalized.includes("voi")) {
                                networkName = "VOI";
                              } else {
                                // Fallback to formatted name
                                networkName = depositNetwork
                                  .split("-")
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() +
                                      word.slice(1)
                                  )
                                  .join(" ");
                              }
                            } else if (selectedNetworkFilter === "all") {
                              // Fallback: try to infer from networkValues
                              const matchingNetwork = Object.entries(
                                user.computed.networkValues
                              ).find(([network, values]: [string, any]) => {
                                // Simple heuristic: if deposit value is close to network collateral, it might belong there
                                return (
                                  Math.abs(values.collateral - deposit.value) <
                                  values.collateral * 0.1
                                );
                              });
                              if (matchingNetwork) {
                                const network = matchingNetwork[0];
                                const normalized = network.toLowerCase();
                                if (normalized.includes("algorand")) {
                                  networkName = "Algorand";
                                } else if (normalized.includes("voi")) {
                                  networkName = "VOI";
                                } else {
                                  // Fallback to formatted name
                                  networkName = network
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1)
                                    )
                                    .join(" ");
                                }
                              }
                            }

                            return (
                              <TableRow
                                key={index}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() =>
                                  handleDepositClick(
                                    deposit.asset,
                                    deposit.poolId,
                                    (deposit as any).network
                                  )
                                }
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={deposit.icon}
                                      alt={deposit.asset}
                                      className="w-6 h-6 rounded-full"
                                    />
                                    <span className="font-medium">
                                      {deposit.asset}
                                    </span>
                                  </div>
                                </TableCell>
                                {selectedNetworkFilter === "all" && (
                                  <TableCell className="font-medium">
                                    {networkName}
                                  </TableCell>
                                )}
                                <TableCell>
                                  {deposit.balance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}
                                </TableCell>
                                <TableCell>
                                  {deposit.value.toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell>
                                  <span className="text-green-600 dark:text-green-400">
                                    {deposit.apy.toFixed(2)}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {isCollateral ? (
                                    <span className="font-semibold">
                                      {(
                                        deposit.value * collateralFactor
                                      ).toLocaleString("en-US", {
                                        style: "currency",
                                        currency: "USD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDepositClick(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as any).network
                                        );
                                      }}
                                      title="Deposit"
                                    >
                                      +
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWithdrawClick(
                                          deposit.asset,
                                          deposit.poolId,
                                          (deposit as any).network
                                        );
                                      }}
                                      title="Withdraw"
                                    >
                                      −
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                        {deposits.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={selectedNetworkFilter === "all" ? 7 : 6}
                              className="text-center text-muted-foreground py-8"
                            >
                              No supplied assets
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {(() => {
                    const filteredAndSorted = deposits
                      .filter((deposit) => {
                        // Filter by search term
                        if (suppliedAssetsSearchTerm) {
                          const searchLower =
                            suppliedAssetsSearchTerm.toLowerCase();
                          const assetMatch = deposit.asset
                            .toLowerCase()
                            .includes(searchLower);
                          if (!assetMatch) {
                            return false;
                          }
                        }

                        // Filter by network
                        if (selectedNetworkFilter === "all") {
                          return true;
                        }

                        const depositNetwork = (deposit as any).network;
                        if (depositNetwork) {
                          const normalizedNetwork =
                            depositNetwork.toLowerCase();
                          if (selectedNetworkFilter === "algorand") {
                            return normalizedNetwork.includes("algorand");
                          } else if (selectedNetworkFilter === "voi") {
                            return normalizedNetwork.includes("voi");
                          }
                        }

                        const matchingNetwork = Object.entries(
                          user?.computed?.networkValues || {}
                        ).find(([network, values]: [string, any]) => {
                          const normalizedNetwork = network.toLowerCase();
                          if (selectedNetworkFilter === "algorand") {
                            return normalizedNetwork.includes("algorand");
                          } else if (selectedNetworkFilter === "voi") {
                            return normalizedNetwork.includes("voi");
                          }
                          return false;
                        });

                        return true;
                      })
                      .sort((a, b) => {
                        let comparison = 0;

                        switch (suppliedAssetsSort.column) {
                          case "network":
                            const networkA = (
                              (a as any).network || "Unknown"
                            ).toLowerCase();
                            const networkB = (
                              (b as any).network || "Unknown"
                            ).toLowerCase();
                            comparison = networkA.localeCompare(networkB);
                            break;
                          case "asset":
                            comparison = a.asset.localeCompare(b.asset);
                            break;
                          case "supplied":
                            comparison = a.balance - b.balance;
                            break;
                          case "value":
                            comparison = a.value - b.value;
                            break;
                          case "apy":
                            comparison = a.apy - b.apy;
                            break;
                          case "borrowingPower":
                          default:
                            const borrowingPowerA = a.value * collateralFactor;
                            const borrowingPowerB = b.value * collateralFactor;
                            comparison = borrowingPowerB - borrowingPowerA;
                            break;
                        }

                        return suppliedAssetsSort.direction === "asc"
                          ? comparison
                          : -comparison;
                      });

                    const hasMore = filteredAndSorted.length > 5;

                    return hasMore ? (
                      <div className="mt-4 text-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const wasExpanded = showAllSuppliedAssets;
                            setShowAllSuppliedAssets(!showAllSuppliedAssets);
                            // Scroll to top when collapsing
                            if (wasExpanded && suppliedAssetsTableRef.current) {
                              setTimeout(() => {
                                suppliedAssetsTableRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }, 0);
                            }
                          }}
                          className="w-full"
                        >
                          {showAllSuppliedAssets ? "Show Less" : "Show More"}
                        </Button>
                      </div>
                    ) : null;
                  })()}
                </DorkFiCard>
              )}

              {/* Borrowed Assets Table */}
              {borrows.length > 0 && (
                <DorkFiCard className="p-6 md:p-8">
                  <div ref={borrowedAssetsTableRef} className="mb-4">
                    <H1 className="text-xl md:text-2xl mb-2">
                      Borrowed Assets
                      {selectedNetworkFilter !== "all" && (
                        <span className="text-lg text-muted-foreground ml-2">
                          (
                          {selectedNetworkFilter.charAt(0).toUpperCase() +
                            selectedNetworkFilter.slice(1)}
                          )
                        </span>
                      )}
                    </H1>
                  </div>
                  <div className="mb-4">
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search assets..."
                        value={borrowedAssetsSearchTerm}
                        onChange={(e) =>
                          setBorrowedAssetsSearchTerm(e.target.value)
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedNetworkFilter === "all" && (
                            <TableHead>Network</TableHead>
                          )}
                          <TableHead>
                            <button
                              onClick={() => {
                                if (borrowedAssetsSort.column === "asset") {
                                  setBorrowedAssetsSort({
                                    column: "asset",
                                    direction:
                                      borrowedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setBorrowedAssetsSort({
                                    column: "asset",
                                    direction: "asc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Asset
                              {borrowedAssetsSort.column === "asset" ? (
                                borrowedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (borrowedAssetsSort.column === "borrowed") {
                                  setBorrowedAssetsSort({
                                    column: "borrowed",
                                    direction:
                                      borrowedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setBorrowedAssetsSort({
                                    column: "borrowed",
                                    direction: "desc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Borrowed
                              {borrowedAssetsSort.column === "borrowed" ? (
                                borrowedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (borrowedAssetsSort.column === "value") {
                                  setBorrowedAssetsSort({
                                    column: "value",
                                    direction:
                                      borrowedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setBorrowedAssetsSort({
                                    column: "value",
                                    direction: "desc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Value (USD)
                              {borrowedAssetsSort.column === "value" ? (
                                borrowedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => {
                                if (borrowedAssetsSort.column === "apy") {
                                  setBorrowedAssetsSort({
                                    column: "apy",
                                    direction:
                                      borrowedAssetsSort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                } else {
                                  setBorrowedAssetsSort({
                                    column: "apy",
                                    direction: "asc",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              APY
                              {borrowedAssetsSort.column === "apy" ? (
                                borrowedAssetsSort.direction === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              LTV Usage
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Loan-to-Value ratio: Borrowed value /
                                    Collateral value
                                  </p>
                                </TooltipContent>
                              </UITooltip>
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              Liquidation Price
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">
                                    Liquidation Price
                                  </p>
                                  <p className="text-sm mb-2">
                                    The estimated price at which your collateral
                                    would need to drop to trigger liquidation
                                    for this borrowed position.
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Liquidation occurs when: Collateral Value ×
                                    Liquidation Threshold &lt; Borrowed Value
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    This is calculated based on your total
                                    collateral and the asset's liquidation
                                    threshold (typically 85%).
                                  </p>
                                </TooltipContent>
                              </UITooltip>
                            </div>
                          </TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredAndSorted = borrows
                            .filter((borrow) => {
                              // Filter by search term
                              if (borrowedAssetsSearchTerm) {
                                const searchLower =
                                  borrowedAssetsSearchTerm.toLowerCase();
                                const assetMatch = borrow.asset
                                  .toLowerCase()
                                  .includes(searchLower);
                                if (!assetMatch) {
                                  return false;
                                }
                              }

                              // Filter by network
                              if (selectedNetworkFilter === "all") {
                                return true;
                              }

                              const borrowNetwork = (borrow as any).network;
                              if (borrowNetwork) {
                                const normalizedNetwork =
                                  borrowNetwork.toLowerCase();
                                if (selectedNetworkFilter === "algorand") {
                                  return normalizedNetwork.includes("algorand");
                                } else if (selectedNetworkFilter === "voi") {
                                  return normalizedNetwork.includes("voi");
                                }
                              }

                              const matchingNetwork = Object.entries(
                                user?.computed?.networkValues || {}
                              ).find(([network, values]: [string, any]) => {
                                const normalizedNetwork = network.toLowerCase();
                                if (selectedNetworkFilter === "algorand") {
                                  return normalizedNetwork.includes("algorand");
                                } else if (selectedNetworkFilter === "voi") {
                                  return normalizedNetwork.includes("voi");
                                }
                                return false;
                              });

                              return true;
                            })
                            .sort((a, b) => {
                              let comparison = 0;

                              switch (borrowedAssetsSort.column) {
                                case "network":
                                  const networkA = (
                                    (a as any).network || "Unknown"
                                  ).toLowerCase();
                                  const networkB = (
                                    (b as any).network || "Unknown"
                                  ).toLowerCase();
                                  comparison = networkA.localeCompare(networkB);
                                  break;
                                case "asset":
                                  comparison = a.asset.localeCompare(b.asset);
                                  break;
                                case "borrowed":
                                  comparison = a.balance - b.balance;
                                  break;
                                case "value":
                                  comparison = a.value - b.value;
                                  break;
                                case "apy":
                                default:
                                  comparison = a.apy - b.apy;
                                  break;
                              }

                              return borrowedAssetsSort.direction === "asc"
                                ? comparison
                                : -comparison;
                            });

                          const displayBorrows = showAllBorrowedAssets
                            ? filteredAndSorted
                            : filteredAndSorted.slice(0, 5);

                          return displayBorrows.map((borrow, index) => {
                            const market = marketData.find(
                              (m) => m.symbol === borrow.asset
                            );
                            const liquidationThreshold =
                              market?.liquidationThreshold || 0.85;

                            // Calculate LTV Usage
                            const ltvUsage =
                              totalCollateral > 0
                                ? (borrow.value / totalCollateral) * 100
                                : 0;

                            // Calculate Liquidation Price
                            // Liquidation occurs when: Collateral Value × Liquidation Threshold < Borrowed Value
                            // For a borrowed asset, we calculate: what would the average collateral price need to be?
                            // Simplified: If total borrowed = B, and we need collateral C where C × threshold = B
                            // Then C = B / threshold, and if current collateral is C_current at price P_current,
                            // liquidation price ≈ P_current × (B / threshold) / C_current
                            // For per-asset display, we use a simplified approximation
                            const currentPrice = borrow.tokenPrice || 1;
                            // More accurate: liquidation price is the price at which collateral would need to drop
                            // For this specific borrow: if this borrow represents X% of total borrows,
                            // and collateral needs to maintain threshold, then:
                            const borrowRatio =
                              totalBorrowed > 0
                                ? borrow.value / totalBorrowed
                                : 0;
                            const requiredCollateralForThisBorrow =
                              borrow.value / liquidationThreshold;
                            // If we assume collateral is proportional, liquidation price would be:
                            // current collateral price × (required collateral / current collateral)
                            // Simplified version: show price that would trigger liquidation for this borrow amount
                            const liquidationPrice =
                              totalCollateral > 0
                                ? currentPrice *
                                  (requiredCollateralForThisBorrow /
                                    (totalCollateral * borrowRatio || 1))
                                : currentPrice / liquidationThreshold;

                            // Get network name from borrow or infer
                            let networkName = "Unknown";
                            const borrowNetwork = (borrow as any).network;
                            if (borrowNetwork) {
                              // Format network name: "algorand-mainnet" -> "Algorand", "voi-mainnet" -> "VOI"
                              const normalized = borrowNetwork.toLowerCase();
                              if (normalized.includes("algorand")) {
                                networkName = "Algorand";
                              } else if (normalized.includes("voi")) {
                                networkName = "VOI";
                              } else {
                                // Fallback to formatted name
                                networkName = borrowNetwork
                                  .split("-")
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() +
                                      word.slice(1)
                                  )
                                  .join(" ");
                              }
                            } else if (selectedNetworkFilter === "all") {
                              // Fallback: try to infer from networkValues
                              const matchingNetwork = Object.entries(
                                user.computed.networkValues
                              ).find(([network, values]: [string, any]) => {
                                return (
                                  Math.abs(values.borrow - borrow.value) <
                                  values.borrow * 0.1
                                );
                              });
                              if (matchingNetwork) {
                                const network = matchingNetwork[0];
                                const normalized = network.toLowerCase();
                                if (normalized.includes("algorand")) {
                                  networkName = "Algorand";
                                } else if (normalized.includes("voi")) {
                                  networkName = "VOI";
                                } else {
                                  // Fallback to formatted name
                                  networkName = network
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1)
                                    )
                                    .join(" ");
                                }
                              }
                            }

                            // Color code LTV usage
                            const getLTVColor = (ltv: number) => {
                              if (ltv >= 80) return "bg-red-500";
                              if (ltv >= 60) return "bg-orange-500";
                              if (ltv >= 40) return "bg-yellow-500";
                              return "bg-green-500";
                            };

                            return (
                              <TableRow key={index}>
                                {selectedNetworkFilter === "all" && (
                                  <TableCell className="font-medium">
                                    {networkName}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={borrow.icon}
                                      alt={borrow.asset}
                                      className="w-6 h-6 rounded-full"
                                    />
                                    <span className="font-medium">
                                      {borrow.asset}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {borrow.balance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}
                                </TableCell>
                                <TableCell>
                                  {borrow.value.toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell>
                                  <span className="text-red-600 dark:text-red-400">
                                    {borrow.apy.toFixed(2)}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                                      <div
                                        className={`h-2 rounded-full ${getLTVColor(
                                          ltvUsage
                                        )}`}
                                        style={{
                                          width: `${Math.min(ltvUsage, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium min-w-[50px]">
                                      {ltvUsage.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    $
                                    {liquidationPrice.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 4,
                                    })}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBorrowClick(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as any).network
                                        );
                                      }}
                                      title="Borrow"
                                    >
                                      +
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRepayClick(
                                          borrow.asset,
                                          borrow.poolId,
                                          (borrow as any).network
                                        );
                                      }}
                                      title="Repay"
                                    >
                                      −
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                        {borrows.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={selectedNetworkFilter === "all" ? 8 : 7}
                              className="text-center text-muted-foreground py-8"
                            >
                              No borrowed assets
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {(() => {
                    const filteredAndSorted = borrows
                      .filter((borrow) => {
                        // Filter by search term
                        if (borrowedAssetsSearchTerm) {
                          const searchLower =
                            borrowedAssetsSearchTerm.toLowerCase();
                          const assetMatch = borrow.asset
                            .toLowerCase()
                            .includes(searchLower);
                          if (!assetMatch) {
                            return false;
                          }
                        }

                        // Filter by network
                        if (selectedNetworkFilter === "all") {
                          return true;
                        }

                        const borrowNetwork = (borrow as any).network;
                        if (borrowNetwork) {
                          const normalizedNetwork = borrowNetwork.toLowerCase();
                          if (selectedNetworkFilter === "algorand") {
                            return normalizedNetwork.includes("algorand");
                          } else if (selectedNetworkFilter === "voi") {
                            return normalizedNetwork.includes("voi");
                          }
                        }

                        const matchingNetwork = Object.entries(
                          user?.computed?.networkValues || {}
                        ).find(([network, values]: [string, any]) => {
                          const normalizedNetwork = network.toLowerCase();
                          if (selectedNetworkFilter === "algorand") {
                            return normalizedNetwork.includes("algorand");
                          } else if (selectedNetworkFilter === "voi") {
                            return normalizedNetwork.includes("voi");
                          }
                          return false;
                        });

                        return true;
                      })
                      .sort((a, b) => {
                        let comparison = 0;

                        switch (borrowedAssetsSort.column) {
                          case "network":
                            const networkA = (
                              (a as any).network || "Unknown"
                            ).toLowerCase();
                            const networkB = (
                              (b as any).network || "Unknown"
                            ).toLowerCase();
                            comparison = networkA.localeCompare(networkB);
                            break;
                          case "asset":
                            comparison = a.asset.localeCompare(b.asset);
                            break;
                          case "borrowed":
                            comparison = a.balance - b.balance;
                            break;
                          case "value":
                            comparison = a.value - b.value;
                            break;
                          case "apy":
                          default:
                            comparison = a.apy - b.apy;
                            break;
                        }

                        return borrowedAssetsSort.direction === "asc"
                          ? comparison
                          : -comparison;
                      });

                    const hasMore = filteredAndSorted.length > 5;

                    return hasMore ? (
                      <div className="mt-4 text-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const wasExpanded = showAllBorrowedAssets;
                            setShowAllBorrowedAssets(!showAllBorrowedAssets);
                            // Scroll to top when collapsing
                            if (wasExpanded && borrowedAssetsTableRef.current) {
                              setTimeout(() => {
                                borrowedAssetsTableRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }, 0);
                            }
                          }}
                          className="w-full"
                        >
                          {showAllBorrowedAssets ? "Show Less" : "Show More"}
                        </Button>
                      </div>
                    ) : null;
                  })()}
                </DorkFiCard>
              )}
            </div>
          </TooltipProvider>
        )}

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
                onClick={() => fetchUser(activeAccount.address)}
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
                  {displayHealthFactor !== null
                    ? displayHealthFactor.toFixed(3)
                    : "N/A"}
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

      {/*<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DepositsList
          deposits={deposits}
          onDepositClick={handleDepositClick}
          onWithdrawClick={handleWithdrawClick}
          onRefresh={() => {} handleRefreshPositions}
          isLoading={isLoadingPositions}
        />
        <BorrowsList
          borrows={borrows}
          onBorrowClick={handleBorrowClick}
          onRepayClick={handleRepayClick}
          onRefresh={() => {} andleRefreshPositions}
          isLoading={isLoadingPositions}
        />
      </div>*/}

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
          setDepositModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
          })
        }
        onCloseWithdrawModal={() =>
          setWithdrawModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
          })
        }
        onCloseBorrowModal={() =>
          setBorrowModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
          })
        }
        onCloseRepayModal={() =>
          setRepayModal({
            isOpen: false,
            asset: null,
            poolId: undefined,
            network: undefined,
          })
        }
        onRefreshWalletBalance={refreshWalletBalance}
        onRefreshMarket={() => fetchUser(activeAccount.address)}
      />
      
      {/* NFT Selection Modal */}
      <NFTSelectionModal
        open={nftModalOpen}
        onOpenChange={setNftModalOpen}
        onSelectNFT={(nft: UserNFT) => {
          // Avatar will be updated via useAvatarImage hook after transaction
        }}
        onConfirmNFT={async (nft: UserNFT) => {
          if (!activeAccount?.address || !signTransactions || !activeWallet) {
            throw new Error("Wallet not connected");
          }

          if (!addressName) {
            throw new Error("You must own an Envoi name to set a profile NFT");
          }

          try {
            // Only supported on voi-mainnet
            if (currentNetwork !== "voi-mainnet") {
              throw new Error("Profile NFTs are only supported on Voi Mainnet");
            }

            const resolverNetwork = "mainnet";
            
            // Initialize resolver service
            const resolver = new ResolverService(
              resolverNetwork,
              activeAccount.address
            );

            // Construct arc72 format: arc72:<app_id>:<token_id>
            const avatarValue = `arc72:${nft.contractId}:${nft.tokenId}`;

            console.log("addressName", addressName);
            console.log("avatarValue", avatarValue);

            // Set avatar text record using resolver service
            const setTextResult = await resolver.setText(addressName, "avatar_dorkfi", avatarValue);

            console.log("setTextResult", setTextResult);
            
            if (!setTextResult.success) {
              throw new Error("Failed to prepare transaction");
            }

            // Show toast notification to prompt user to open wallet
            const walletName = activeWallet?.metadata?.name || "your wallet";
            toast({
              title: "Please Sign Transaction",
              description: `Please open ${walletName} and sign the transaction`,
              duration: 10000,
            });

            // Sign transactions
            const stxns = await signTransactions(
              setTextResult.txns.map((txn: string) =>
                Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
              )
            );

            // Get the correct algod client for the network
            const algorandNetwork = getAlgorandNetworkFromNetworkId(
              currentNetwork as any
            );
            if (!algorandNetwork) {
              throw new Error(`Invalid network: ${currentNetwork}`);
            }
            const algorandClients =
              await algorandService.initializeClientsForTransactions(algorandNetwork);
            
            // Send transaction
            const res = await algorandClients.algod.sendRawTransaction(stxns).do();
            
            // Wait for confirmation
            await waitForConfirmation(algorandClients.algod, res.txid, 4);
            
            // Poll the resolver until the new value is reflected or timeout
            let newAvatarText = await resolver.text(addressName, "avatar_dorkfi");
            let attempts = 0;
            while (newAvatarText !== avatarValue && attempts < 10) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              newAvatarText = await resolver.text(addressName, "avatar_dorkfi");
              attempts++;
            }

            // Refetch the avatar image to update the UI
            refetchAvatar();

            // Close NFT selection modal and show success modal
            setNftModalOpen(false);
            setSuccessModalOpen(true);
          } catch (error) {
            console.error("Error updating profile NFT:", error);
            toast({
              title: "Transaction Failed",
              description: error instanceof Error ? error.message : "Failed to update profile NFT",
              variant: "destructive",
            });
            throw error; // Re-throw to let the modal handle the error
          }
        }}
        currentImageUrl={avatarImage || undefined}
      />

      {/* Profile Update Success Modal */}
      <ProfileUpdateSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        avatarImage={avatarImage || undefined}
        healthFactor={displayHealthFactor}
        deposits={modalDeposits}
        borrows={modalBorrows}
        netLTV={netLTV}
        addressName={addressName}
      />
    </div>
  );
};

export default Portfolio;
