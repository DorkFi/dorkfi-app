import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Plus,
  BarChart3,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  ExternalLink,
  InfoIcon,
  Coins,
  TrendingUp,
  Activity,
  Database,
  Zap,
  Eye,
  Edit,
  Trash2,
  Save,
  X,
  Hash,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import WalletButton from "@/components/WalletButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { H1, H2, H3, Body } from "@/components/ui/Typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CanvasBubbles from "@/components/CanvasBubbles";
import VersionDisplay from "@/components/VersionDisplay";
import {
  getCurrentNetworkConfig,
  getAllTokens,
  getContractAddress,
  isCurrentNetworkAlgorandCompatible,
  isCurrentNetworkEVM,
  NetworkId,
  getLendingPools,
  getAllTokensWithDisplayInfo,
  getPreFiParameters,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  fetchPausedState,
  fetchSystemHealth,
  fetchAdminStats,
  togglePauseState,
  formatPauseDuration,
  type PausedState,
  type SystemHealth,
  createMarket,
  CreateMarketParams,
  updateMarketPrice,
  updateMarketMaxDeposits,
} from "@/services/adminService";
import { useOnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import { fetchMarketInfo } from "@/services/lendingService";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { TokenAutocomplete } from "@/components/ui/TokenAutocomplete";
import { TokenContractModal } from "@/components/ui/TokenContractModal";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk, { waitForConfirmation } from "algosdk";
import { initializeAlgorandForCurrentNetwork } from "@/services/algorandExamples";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import BigNumber from "bignumber.js";

// Get markets from configuration - now reactive to network changes
const getMarketsFromConfig = (networkId: NetworkId) => {
  const networkConfig = getCurrentNetworkConfig();
  const tokens = getAllTokensWithDisplayInfo(networkId);

  return tokens.map((token) => ({
    id: token.symbol.toLowerCase(),
    name: token.name, // This will be "Voi" or "Algo" if override is configured
    symbol: token.symbol, // This will be "Voi" or "Algo" if override is configured
    originalName: token.originalName, // The original token name
    originalSymbol: token.originalSymbol, // The original token symbol
    underlyingAssetId: token.underlyingAssetId, // The actual asset ID to use
    underlyingContractId: token.underlyingContractId, // The actual contract ID to use
    originalContractId: token.originalContractId, // The original contract ID
    isSmartContract: token.isSmartContract, // Whether this is a smart contract-based asset
    status: "active" as const,
    totalDeposits: Math.floor(Math.random() * 1000000) + 50000, // Mock data
    users: Math.floor(Math.random() * 500) + 50, // Mock data
  }));
};

export default function AdminDashboard() {
  const { activeAccount, signTransactions } = useWallet();
  const { currentNetwork } = useNetwork();

  // Use on-demand market loading
  const {
    data: onDemandMarkets,
    loadAllMarkets,
    loadMarketDataWithBypass,
    isLoading: isLoadingMarkets,
    marketsData,
  } = useOnDemandMarketData({
    autoLoad: true,
    pageSize: 50, // Load more markets for admin view
    throttleMs: 60 * 1000, // 1 minute throttle
  });

  // Get markets for current network (for backward compatibility with existing UI)
  const markets = getMarketsFromConfig(currentNetwork);

  // Generate pool options with class labels
  const getPoolOptions = () => {
    const lendingPools = getLendingPools(currentNetwork);
    return lendingPools.map((poolId, index) => {
      const classLabel = String.fromCharCode(65 + index); // A, B, C, etc.
      return {
        value: poolId,
        label: `${classLabel} Market (${poolId})`,
        poolId: poolId,
        class: classLabel,
      };
    });
  };

  const poolOptions = getPoolOptions();

  // Dynamic stats based on current network
  const mockStats = {
    totalMarkets: markets.length,
    activeUsers: 1247,
    totalVolume: 2450000,
    systemHealth: 98.5,
    pendingOperations: 3,
    lastUpdate: new Date().toISOString(),
  };

  // Handle network changes
  const handleNetworkChange = (networkId: NetworkId) => {
    console.log("Admin: Network changed to:", networkId);
    // The network context will handle the actual switching
    // This component will automatically react via the useNetwork hook
  };

  // Mock operations - could be made network-specific in the future
  const mockOperations = [
    {
      id: 1,
      type: "market_creation",
      status: "pending",
      description: `Create new market on ${currentNetwork}`,
      timestamp: "2025-01-27T10:30:00Z",
    },
    {
      id: 2,
      type: "parameter_update",
      status: "pending",
      description: `Update market parameters on ${currentNetwork}`,
      timestamp: "2025-01-27T09:15:00Z",
    },
    {
      id: 3,
      type: "emergency_pause",
      status: "pending",
      description: `Emergency pause for ${currentNetwork}`,
      timestamp: "2025-01-27T08:45:00Z",
    },
  ];

  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateMarketModalOpen, setIsCreateMarketModalOpen] = useState(false);
  const [isTokenContractModalOpen, setIsTokenContractModalOpen] =
    useState(false);
  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any>(null);

  // Admin data state
  const [pausedState, setPausedState] = useState<PausedState | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoadingPausedState, setIsLoadingPausedState] = useState(false);
  const [isLoadingSystemHealth, setIsLoadingSystemHealth] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // Test transaction state
  const [isTestTxLoading, setIsTestTxLoading] = useState(false);

  // Lending service state - using on-demand loading now

  // Create market form state
  const [marketType, setMarketType] = useState<"prefi" | "custom">("prefi");
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isMarketViewModalOpen, setIsMarketViewModalOpen] = useState(false);
  const [isPriceUpdateModalOpen, setIsPriceUpdateModalOpen] = useState(false);
  const [isMaxDepositsUpdateModalOpen, setIsMaxDepositsUpdateModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [priceUpdateData, setPriceUpdateData] = useState<{
    marketId: string;
    poolId: string;
    currentPrice: string;
    newPrice: string;
  }>({
    marketId: "",
    poolId: "",
    currentPrice: "",
    newPrice: "",
  });
  const [maxDepositsUpdateData, setMaxDepositsUpdateData] = useState<{
    marketId: string;
    poolId: string;
    currentMaxDeposits: string;
    newMaxDeposits: string;
  }>({
    marketId: "",
    poolId: "",
    currentMaxDeposits: "",
    newMaxDeposits: "",
  });
  const [isLoadingMarketView, setIsLoadingMarketView] = useState(false);
  const [marketViewData, setMarketViewData] = useState<any>(null);
  const [createdMarketData, setCreatedMarketData] = useState<{
    marketId: string;
    marketType: string;
    marketClass: string;
    tokenContractId: string;
    maxTotalDeposits: string;
    maxTotalBorrows: string;
  } | null>(null);
  const [newMarket, setNewMarket] = useState({
    // Basic market info
    tokenContractId: "",

    // PreFi specific fields
    poolId: "",

    // CreateMarketParams fields
    tokenId: "",
    collateralFactor: "0.8",
    liquidationThreshold: "0.85",
    reserveFactor: "0.1",
    borrowRate: "0.05",
    slope: "0.1",
    maxTotalDeposits: "1000000",
    maxTotalBorrows: "800000",
    liquidationBonus: "0.05",
    closeFactor: "0.5",
  });

  // Step navigation helpers
  const totalSteps = 3; // Configuration, Parameters, Confirmation

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      // Step 1: Market Configuration - same for both market types
      return newMarket.poolId && newMarket.tokenContractId;
    }
    if (currentStep === 2) {
      // Step 2: Market Parameters - all fields have defaults, so always can proceed
      return true;
    }
    return false;
  };

  const handleNextStep = () => {
    if (canProceedToNextStep() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepChange = (step: number) => {
    if (
      step <= currentStep ||
      (step === currentStep + 1 && canProceedToNextStep())
    ) {
      setCurrentStep(step);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setMarketType("prefi");
    setNewMarket({
      tokenContractId: "",
      poolId: "",
      tokenId: "",
      collateralFactor: "0.8",
      liquidationThreshold: "0.85",
      reserveFactor: "0.1",
      borrowRate: "0.05",
      slope: "0.1",
      maxTotalDeposits: "1000000",
      maxTotalBorrows: "800000",
      liquidationBonus: "0.05",
      closeFactor: "0.5",
    });
  };

  const handleCreateMarket = async () => {
    if (!activeAccount) {
      alert("Please connect your wallet first");
      return;
    }

    // Validation for required fields based on market type
    if (marketType === "prefi") {
      if (!newMarket.poolId || !newMarket.tokenContractId) {
        alert(
          "Please fill in all required PreFi market fields (Pool Class, Token Contract ID)"
        );
        return;
      }
    } else if (marketType === "custom") {
      if (!newMarket.tokenId || !newMarket.tokenContractId) {
        alert(
          "Please fill in all required custom market fields (Token ID, Token Contract ID)"
        );
        return;
      }
    }

    try {
      const decimals = 6; // TODO: Get decimals from token contract

      console.log({ newMarket });

      const createMarketParams: CreateMarketParams = {
        tokenId:
          marketType === "prefi"
            ? Number(newMarket.tokenContractId)
            : Number(newMarket.tokenId),
        collateralFactor: BigInt(
          BigNumber(newMarket.collateralFactor).multipliedBy(10000).toFixed(0)
        ),
        liquidationThreshold: BigInt(
          BigNumber(newMarket.liquidationThreshold)
            .multipliedBy(10000)
            .toFixed(0)
        ),
        reserveFactor: BigInt(
          BigNumber(newMarket.reserveFactor).multipliedBy(10000).toFixed(0)
        ),
        borrowRate: BigInt(
          BigNumber(newMarket.borrowRate).multipliedBy(10000).toFixed(0)
        ),
        slope: BigInt(
          BigNumber(newMarket.slope).multipliedBy(10000).toFixed(0)
        ),
        maxTotalDeposits: BigInt(
          new BigNumber(newMarket.maxTotalDeposits)
            .multipliedBy(10 ** decimals)
            .toFixed(0)
        ),
        maxTotalBorrows:
          marketType === "prefi"
            ? BigInt(0)
            : BigInt(
                new BigNumber(newMarket.maxTotalBorrows)
                  .multipliedBy(10 ** decimals)
                  .toFixed(0)
              ),
        liquidationBonus: BigInt(
          BigNumber(newMarket.liquidationBonus).multipliedBy(10000).toFixed(0)
        ),
        closeFactor: BigInt(
          BigNumber(newMarket.closeFactor).multipliedBy(10000).toFixed(0)
        ),
      };

      const createMarketResult = await createMarket(
        marketType === "prefi"
          ? Number(newMarket.poolId)
          : Number(newMarket.tokenContractId),
        createMarketParams,
        activeAccount.address
      );

      if (createMarketResult.success) {
        console.log("Market creation result:", createMarketResult);

        if (isCurrentNetworkAlgorandCompatible()) {
          const networkConfig = getCurrentNetworkConfig();
          const algorandClients = algorandService.initializeClients(
            networkConfig.walletNetworkId as AlgorandNetwork
          );
          const stxn = await signTransactions(
            createMarketResult.txns.map((txn) =>
              Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
            )
          );

          const res = await algorandClients.algod.sendRawTransaction(stxn).do();

          console.log("Transaction sent:", res);

          await waitForConfirmation(algorandClients.algod, res.txId, 4);

          console.log("Transaction confirmed:", res);
        }

        // Set success modal data
        setCreatedMarketData({
          marketId: String(createMarketResult.marketId),
          marketType: marketType === "prefi" ? "PreFi Market" : "Custom Market",
          marketClass: newMarket.poolId,
          tokenContractId: newMarket.tokenContractId,
          maxTotalDeposits: newMarket.maxTotalDeposits,
          maxTotalBorrows:
            marketType === "prefi" ? "0" : newMarket.maxTotalBorrows,
        });

        // Reset form
        resetForm();
        setIsCreateMarketModalOpen(false);
        setIsSuccessModalOpen(true);
      } else {
        alert(`Failed to create market: ${(createMarketResult as any).error}`);
        console.error("Market creation failed:", createMarketResult);
      }
    } catch (error) {
      console.error("Error creating market:", error);
      alert(`Error creating market: ${error}`);
    }
  };

  const handleTokenContractSelect = (contractId: string, tokenInfo?: any) => {
    setNewMarket((prev) => ({ ...prev, tokenContractId: contractId }));
    setIsTokenContractModalOpen(false);
  };

  const handleViewMarket = async (market: any) => {
    setSelectedMarket(market);
    setIsMarketViewModalOpen(true);
    setIsLoadingMarketView(true);

    try {
      // Get the market data from on-demand loading
      const marketKey = market.asset?.toLowerCase();
      const marketData = marketsData[marketKey];

      if (marketData?.marketInfo) {
        setMarketViewData(marketData.marketInfo);
      } else {
        // Use cache bypass to get fresh data for the view modal
        await loadMarketDataWithBypass(marketKey);

        // Wait a moment for the data to be loaded, then get it
        setTimeout(() => {
          const updatedMarketData = marketsData[marketKey];
          if (updatedMarketData?.marketInfo) {
            setMarketViewData(updatedMarketData.marketInfo);
          } else {
            setMarketViewData(null);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error fetching market view data:", error);
      setMarketViewData(null);
    } finally {
      setIsLoadingMarketView(false);
    }
  };

  const handleEditMarket = (market: any) => {
    setSelectedMarket(market);

    // Get the correct contract ID from the token configuration
    const tokens = getAllTokensWithDisplayInfo(currentNetwork);
    const token = tokens.find(
      (t) => t.symbol.toLowerCase() === market.asset?.toLowerCase()
    );
    const contractId = token?.underlyingContractId || "";

    setPriceUpdateData({
      marketId: contractId, // Use the token's contract ID, not the market's tokenContractId
      poolId: market.marketInfo?.poolId || "",
      currentPrice: market.marketInfo?.price
        ? (parseFloat(market.marketInfo.price) / Math.pow(10, token?.decimals || 6)).toFixed(6)
        : "0",
      newPrice: "",
    });
    setIsPriceUpdateModalOpen(true);
  };

  const handleEditMaxDeposits = (market: any) => {
    setSelectedMarket(market);

    // Get the correct contract ID from the token configuration
    const tokens = getAllTokensWithDisplayInfo(currentNetwork);
    const token = tokens.find(
      (t) => t.symbol.toLowerCase() === market.asset?.toLowerCase()
    );
    const contractId = token?.underlyingContractId || "";

    setMaxDepositsUpdateData({
      marketId: contractId, // Use the token's contract ID, not the market's tokenContractId
      poolId: market.marketInfo?.poolId || "",
      currentMaxDeposits: market.marketInfo?.maxTotalDeposits
        ? (parseFloat(market.marketInfo.maxTotalDeposits) / Math.pow(10, token?.decimals || 6)).toFixed(0)
        : "0",
      newMaxDeposits: "",
    });
    setIsMaxDepositsUpdateModalOpen(true);
  };

  const handleUpdatePrice = async () => {
    if (!activeAccount) {
      alert("Please connect your wallet first");
      return;
    }

    if (
      !priceUpdateData.newPrice ||
      parseFloat(priceUpdateData.newPrice) <= 0
    ) {
      alert("Please enter a valid price");
      return;
    }

    try {
      if (isCurrentNetworkAlgorandCompatible()) {
        console.log("priceUpdateData", priceUpdateData);
        const result = await updateMarketPrice(
          priceUpdateData.poolId,
          priceUpdateData.marketId,
          BigNumber(priceUpdateData.newPrice)
            .multipliedBy(
              BigNumber(10).pow(selectedMarket.marketInfo?.decimals || 6)
            )
            .toFixed(0),
          activeAccount.address
        );
        if (result.success) {
          const networkConfig = getCurrentNetworkConfig();
          const algorandClients = algorandService.initializeClients(
            networkConfig.walletNetworkId as AlgorandNetwork
          );
          const stxns = await signTransactions([
            result.txns.map((txn) =>
              Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
            ),
          ]);
          const res = await algorandClients.algod
            .sendRawTransaction(stxns)
            .do();
          await waitForConfirmation(algorandClients.algod, res.txId, 4);
          alert(`Price updated successfully! Transaction ID: ${res.txId}`);
          setIsPriceUpdateModalOpen(false);
          setPriceUpdateData({
            marketId: "",
            poolId: "",
            currentPrice: "",
            newPrice: "",
          });
          // Refresh market data
          loadAllMarkets();
        } else {
          alert(`Failed to update price: ${(result as any).error}`);
        }
      } else if (isCurrentNetworkEVM()) {
        throw new Error("EVM networks are not supported yet");
      } else {
        throw new Error("Unsupported network");
      }
    } catch (error) {
      console.error("Error updating price:", error);
      alert("Failed to update price. Please try again.");
    }
  };

  const handleUpdateMaxDeposits = async () => {
    if (!activeAccount) {
      alert("Please connect your wallet first");
      return;
    }

    if (
      !maxDepositsUpdateData.newMaxDeposits ||
      parseFloat(maxDepositsUpdateData.newMaxDeposits) <= 0
    ) {
      alert("Please enter a valid max deposits amount");
      return;
    }

    try {
      if (isCurrentNetworkAlgorandCompatible()) {
        console.log("maxDepositsUpdateData", maxDepositsUpdateData);
        const result = await updateMarketMaxDeposits(
          maxDepositsUpdateData.poolId,
          maxDepositsUpdateData.marketId,
          BigNumber(maxDepositsUpdateData.newMaxDeposits)
            .multipliedBy(
              BigNumber(10).pow(selectedMarket.marketInfo?.decimals || 6)
            )
            .toFixed(0),
          activeAccount.address
        );
        if (result.success) {
          const networkConfig = getCurrentNetworkConfig();
          const algorandClients = algorandService.initializeClients(
            networkConfig.walletNetworkId as AlgorandNetwork
          );
          const stxn = await signTransactions(
            result.txns.map((txn) =>
              Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
            )
          );

          const res = await algorandClients.algod.sendRawTransaction(stxn).do();

          await waitForConfirmation(algorandClients.algod, res.txId, 4);

          console.log("Transaction confirmed:", res);
          alert("Max deposits updated successfully!");
          setIsMaxDepositsUpdateModalOpen(false);
          setMaxDepositsUpdateData({
            marketId: "",
            poolId: "",
            currentMaxDeposits: "",
            newMaxDeposits: "",
          });
          // Refresh markets data
          loadAllMarkets();
        } else {
          alert(`Failed to update max deposits: ${(result as any).error}`);
        }
      } else if (isCurrentNetworkEVM()) {
        throw new Error("EVM networks are not supported yet");
      } else {
        throw new Error("Unsupported network");
      }
    } catch (error) {
      console.error("Error updating max deposits:", error);
      alert("Failed to update max deposits. Please try again.");
    }
  };

  // Load all markets when component mounts or network changes
  React.useEffect(() => {
    loadAllMarkets();
  }, [currentNetwork, loadAllMarkets]);

  const handleApproveOperation = (operationId: number) => {
    console.log("Approving operation:", operationId);
    // TODO: Implement operation approval logic
    setIsOperationModalOpen(false);
    setSelectedOperation(null);
  };

  const handleRejectOperation = (operationId: number) => {
    console.log("Rejecting operation:", operationId);
    // TODO: Implement operation rejection logic
    setIsOperationModalOpen(false);
    setSelectedOperation(null);
  };

  const openOperationModal = (operation: any) => {
    setSelectedOperation(operation);
    setIsOperationModalOpen(true);
  };

  // Data fetching functions
  const loadPausedState = async () => {
    if (!activeAccount) return;
    setIsLoadingPausedState(true);
    try {
      const state = await fetchPausedState(activeAccount?.address);
      setPausedState(state);
    } catch (error) {
      console.error("Failed to load paused state:", error);
    } finally {
      setIsLoadingPausedState(false);
    }
  };

  const loadSystemHealth = async () => {
    setIsLoadingSystemHealth(true);
    try {
      const health = await fetchSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      console.error("Failed to load system health:", error);
    } finally {
      setIsLoadingSystemHealth(false);
    }
  };

  const handleTogglePause = async () => {
    if (!pausedState) return;

    setIsTogglingPause(true);
    try {
      if (isCurrentNetworkAlgorandCompatible()) {
        const networkConfig = getCurrentNetworkConfig();
        const algorandClients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );
        const togglePauseResult = await togglePauseState(
          !pausedState.isPaused,
          activeAccount?.address
        );
        if (togglePauseResult.success) {
          // Reload paused state after successful toggle
          const stxns = await signTransactions(
            togglePauseResult.txns.map(
              (txn: string) =>
                new Uint8Array(
                  Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
                )
            )
          );
          console.log("Transaction signed:", stxns);
          const res = await algorandClients.algod
            .sendRawTransaction(stxns)
            .do();

          console.log("Transaction sent:", res);

          await waitForConfirmation(algorandClients.algod, res.txId, 4);

          console.log("Transaction confirmed:", res);

          await loadPausedState();
        }
      } else if (isCurrentNetworkEVM()) {
        throw new Error("EVM networks are not supported yet");
      } else {
        throw new Error("Unsupported network");
      }
    } catch (error) {
      console.error("Failed to toggle pause state:", error);
    } finally {
      setIsTogglingPause(false);
    }
  };

  const handleTestTransaction = async () => {
    setIsTestTxLoading(true);
    try {
      // Simulate a test transaction
      console.log("Executing test transaction...");

      if (isCurrentNetworkAlgorandCompatible()) {
        if (!activeAccount) {
          console.error("No active account found");
          return;
        }

        const networkConfig = getCurrentNetworkConfig();
        const algorandClients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );
        const suggestedParams = await algorandClients.algod
          .getTransactionParams()
          .do();
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: activeAccount.address,
          to: activeAccount.address,
          amount: 0,
          suggestedParams,
        });
        console.log("Transaction created:", txn);

        // Sign the transaction
        const stxns = await signTransactions([txn.toByte()]);
        console.log("Transaction signed:", stxns);
      } else {
        console.error("Not supported");
        return;
      }

      // Mock transaction delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock successful transaction
      const mockTxId = `TEST_TX_${Date.now()}`;
      console.log(`Test transaction successful: ${mockTxId}`);

      // You could add a toast notification here
      alert(`Test transaction successful!\nTransaction ID: ${mockTxId}`);
    } catch (error) {
      console.error("Test transaction failed:", error);
      alert("Test transaction failed. Check console for details.");
    } finally {
      setIsTestTxLoading(false);
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    loadPausedState();
    loadSystemHealth();
  }, []);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />

      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      {/* Advanced Canvas Bubble System - Dark Mode Only */}
      <div className="hidden dark:block">
        <CanvasBubbles />
      </div>

      {/* Admin Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:header-nav-bg backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-6">
              <Link
                to="/"
                className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                aria-label="Go to DorkFi dashboard"
              >
                <div className="flex flex-col">
                  <img
                    src="/lovable-uploads/dork_fi_logo_edit1_light.png"
                    alt="DorkFi logo"
                    className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain flex-shrink-0"
                    fetchPriority="high"
                    decoding="async"
                    onError={(e) => {
                      console.error("Logo failed to load, using placeholder");
                      (e.currentTarget as HTMLImageElement).src =
                        "/placeholder.svg";
                    }}
                  />
                </div>
              </Link>

              {/* Admin Badge */}
              <Badge variant="destructive" className="text-xs font-semibold">
                <Shield className="h-3 w-3 mr-1" />
                ADMIN PANEL
              </Badge>
            </div>

            {/* Theme Toggle and Wallet */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <WalletNetworkButton onNetworkChange={handleNetworkChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Admin Hero Section */}
      <div className="mx-auto max-w-7xl px-4 pt-8 relative z-10">
        <DorkFiCard
          hoverable
          className="relative text-center overflow-hidden p-6 md:p-8 mb-8"
        >
          <div className="relative z-10 text-center">
            <H1 className="m-0 text-4xl md:text-5xl text-center">
              <span className="hero-header">Admin Dashboard</span>
            </H1>
            <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto text-center">
              <span className="block md:inline md:whitespace-nowrap">
                Operator Controls & Market Management
              </span>
              <br className="hidden md:block" />
              <span className="block md:inline md:whitespace-nowrap">
                Manage markets, monitor system health, and execute operations.
              </span>
            </Body>
          </div>
        </DorkFiCard>
      </div>

      {/* Admin Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 relative z-10">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="markets" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Markets</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Operations</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Markets
                      </p>
                      <p className="text-2xl font-bold text-card-foreground">
                        {mockStats.totalMarkets}
                      </p>
                    </div>
                    <Coins className="h-8 w-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Active Users
                      </p>
                      <p className="text-2xl font-bold text-card-foreground">
                        {mockStats.activeUsers.toLocaleString()}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Volume
                      </p>
                      <p className="text-2xl font-bold text-card-foreground">
                        ${mockStats.totalVolume.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        System Health
                      </p>
                      <p className="text-2xl font-bold text-card-foreground">
                        {mockStats.systemHealth}%
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Paused State Display */}
            <Card
              className={`${
                pausedState?.isPaused
                  ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                  : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pausedState?.isPaused ? (
                      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    )}
                    <div>
                      <h3
                        className={`font-semibold ${
                          pausedState?.isPaused
                            ? "text-red-800 dark:text-red-200"
                            : "text-green-800 dark:text-green-200"
                        }`}
                      >
                        {pausedState?.isPaused
                          ? "Protocol Paused"
                          : "Protocol Active"}
                      </h3>
                      {pausedState?.isPaused && pausedState.pausedAt && (
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Paused for {formatPauseDuration(pausedState.pausedAt)}{" "}
                          • By: {pausedState.pausedBy}
                        </p>
                      )}
                      {pausedState?.pauseReason && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Reason: {pausedState.pauseReason}
                        </p>
                      )}
                      {pausedState?.pausedContracts.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                            Paused Contracts:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pausedState.pausedContracts.map((contract) => (
                              <Badge
                                key={contract}
                                variant="destructive"
                                className="text-xs"
                              >
                                {contract}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoadingPausedState ? (
                      <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPausedState}
                        className="text-xs"
                      >
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    )}
                    <Button
                      variant={
                        pausedState?.isPaused ? "default" : "destructive"
                      }
                      size="sm"
                      onClick={handleTogglePause}
                      disabled={isTogglingPause || isLoadingPausedState}
                      className="text-xs"
                    >
                      {isTogglingPause ? (
                        <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                      ) : pausedState?.isPaused ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {pausedState?.isPaused ? "Unpause" : "Pause"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Health Display */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Health
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isLoadingSystemHealth ? (
                      <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadSystemHealth}
                        className="text-xs"
                      >
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Overall Health */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overall Health</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (systemHealth?.overall || 0) >= 90
                              ? "bg-green-500"
                              : (systemHealth?.overall || 0) >= 70
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${systemHealth?.overall || 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">
                        {systemHealth?.overall || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Contract Health */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Contract Status</span>
                    <div className="grid grid-cols-2 gap-2">
                      {systemHealth?.contracts &&
                        Object.entries(systemHealth.contracts).map(
                          ([contract, isHealthy]) => (
                            <div
                              key={contract}
                              className="flex items-center justify-between p-2 rounded border border-border bg-card/50"
                            >
                              <span className="text-xs capitalize">
                                {contract.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              <div className="flex items-center gap-1">
                                {isHealthy ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {isHealthy ? "Healthy" : "Issues"}
                                </span>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>

                  {systemHealth?.lastChecked && (
                    <p className="text-xs text-muted-foreground">
                      Last checked:{" "}
                      {new Date(systemHealth.lastChecked).toLocaleString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pending Operations Alert */}
            {mockStats.pendingOperations > 0 && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                        {mockStats.pendingOperations} Pending Operations
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Review and approve pending administrative operations.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("operations")}
                      className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOperations.slice(0, 3).map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <div>
                          <p className="font-medium text-sm">
                            {op.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(op.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {op.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Market Management</H2>
              <DorkFiButton
                onClick={() => setIsCreateMarketModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Market
              </DorkFiButton>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoadingMarkets ? (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Loading markets...
                  </div>
                </div>
              ) : Object.keys(marketsData).length > 0 ? (
                Object.values(marketsData).map((market) => (
                  <Card
                    key={market.asset}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {market.asset}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              market.isLoaded && !market.error
                                ? "default"
                                : "secondary"
                            }
                          >
                            {market.isLoaded && !market.error
                              ? "Active"
                              : market.isLoading
                              ? "Loading..."
                              : "Error"}
                          </Badge>
                          {market.isLoading && (
                            <Badge variant="outline" className="text-xs">
                              Loading...
                            </Badge>
                          )}
                          {market.error && (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {market.asset} •{" "}
                        {market.isLoaded ? "Loaded" : "Not loaded"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {market.isLoaded && market.marketInfo
                          ? `Contract: ${market.marketInfo.tokenContractId}`
                          : "Contract: Not available"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">
                            Total Deposits
                          </p>
                          <p className="font-semibold">
                            {market.isLoaded && market.marketInfo
                              ? `$${(() => {
                                  // Get token decimals for proper price scaling
                                  const tokens = getAllTokensWithDisplayInfo(currentNetwork);
                                  const token = tokens.find(
                                    (t) => t.symbol.toLowerCase() === market.asset?.toLowerCase()
                                  );
                                  const tokenDecimals = token?.decimals || 6;
                                  
                                  const value =
                                    parseFloat(
                                      market.marketInfo.totalDeposits
                                    ) *
                                    (parseFloat(market.marketInfo.price) /
                                      Math.pow(10, tokenDecimals));
                                  if (value >= 1000000000) {
                                    return `${(value / 1000000000).toFixed(
                                      2
                                    )}B`;
                                  } else if (value >= 1000000) {
                                    return `${(value / 1000000).toFixed(2)}M`;
                                  } else if (value >= 1000) {
                                    return `${(value / 1000).toFixed(2)}K`;
                                  } else {
                                    return value.toFixed(2);
                                  }
                                })()}`
                              : "Loading..."}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Borrows</p>
                          <p className="font-semibold">
                            {market.isLoaded && market.marketInfo
                              ? `$${(() => {
                                  // Get token decimals for proper price scaling
                                  const tokens = getAllTokensWithDisplayInfo(currentNetwork);
                                  const token = tokens.find(
                                    (t) => t.symbol.toLowerCase() === market.asset?.toLowerCase()
                                  );
                                  const tokenDecimals = token?.decimals || 6;
                                  
                                  const value =
                                    parseFloat(market.marketInfo.totalBorrows) *
                                    (parseFloat(market.marketInfo.price) /
                                      Math.pow(10, tokenDecimals));
                                  if (value >= 1000000000) {
                                    return `${(value / 1000000000).toFixed(
                                      2
                                    )}B`;
                                  } else if (value >= 1000000) {
                                    return `${(value / 1000000).toFixed(2)}M`;
                                  } else if (value >= 1000) {
                                    return `${(value / 1000).toFixed(2)}K`;
                                  } else {
                                    return value.toFixed(2);
                                  }
                                })()}`
                              : "Loading..."}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Supply Rate</p>
                          <p className="font-semibold">
                            {market.isLoaded && market.marketInfo
                              ? `${(market.marketInfo.supplyRate * 100).toFixed(
                                  2
                                )}%`
                              : "Loading..."}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Borrow Rate</p>
                          <p className="font-semibold">
                            {market.isLoaded && market.marketInfo
                              ? `${(
                                  market.marketInfo.borrowRateCurrent * 100
                                ).toFixed(2)}%`
                              : "Loading..."}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          Utilization Rate
                        </p>
                        <p className="font-semibold">
                          {market.isLoaded && market.marketInfo
                            ? `${(
                                market.marketInfo.utilizationRate * 100
                              ).toFixed(1)}%`
                            : "Loading..."}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleViewMarket(market)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditMarket(market)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Price
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditMaxDeposits(market)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Max Deposits
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div className="text-center text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No markets found</p>
                    <p className="text-sm">
                      Create your first market to get started
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Pending Operations</H2>
              <div className="flex items-center gap-2">
                <DorkFiButton
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </DorkFiButton>
                <DorkFiButton
                  variant="primary"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={handleTestTransaction}
                  disabled={isTestTxLoading}
                >
                  {isTestTxLoading ? (
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Test Transaction
                </DorkFiButton>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="space-y-0">
                  {mockOperations.map((operation) => (
                    <div
                      key={operation.id}
                      className="flex items-center justify-between p-6 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <div>
                          <p className="font-medium">{operation.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {operation.type.replace("_", " ").toUpperCase()} •{" "}
                            {new Date(operation.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{operation.status}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOperationModal(operation)}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <H2>System Settings</H2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable maintenance mode to pause all operations
                      </p>
                    </div>
                    <Switch id="maintenance-mode" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-approve">
                        Auto-approve Operations
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically approve low-risk operations
                      </p>
                    </div>
                    <Switch id="auto-approve" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email alerts for critical events
                      </p>
                    </div>
                    <Switch id="notifications" defaultChecked />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="two-factor">
                        Two-Factor Authentication
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Require 2FA for all admin operations
                      </p>
                    </div>
                    <Switch id="two-factor" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="session-timeout">Session Timeout</Label>
                      <p className="text-sm text-muted-foreground">
                        Auto-logout after inactivity
                      </p>
                    </div>
                    <Switch id="session-timeout" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="audit-log">Audit Logging</Label>
                      <p className="text-sm text-muted-foreground">
                        Log all administrative actions
                      </p>
                    </div>
                    <Switch id="audit-log" defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-4 relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="text-muted-foreground text-sm">
              <p>© 2025 DorkFi Protocol. Admin Panel - Operator Controls.</p>
            </div>
            <VersionDisplay />
          </div>
        </div>
      </footer>

      {/* Create Market Modal */}
      <Dialog
        open={isCreateMarketModalOpen}
        onOpenChange={setIsCreateMarketModalOpen}
      >
        <DialogContent className="max-w-2xl p-8">
          <DialogHeader className="pb-6">
            <DialogTitle>Create New Market</DialogTitle>
            <DialogDescription>
              Add a new token market to the PreFi platform. Complete all steps
              to create the market.
            </DialogDescription>

            {/* Step Progress Indicator */}
            <div className="flex items-center justify-center space-x-4 mt-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => handleStepChange(step)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step === currentStep
                        ? "bg-primary text-primary-foreground"
                        : step < currentStep
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    } ${
                      step <= currentStep ||
                      (step === currentStep + 1 && canProceedToNextStep())
                        ? "cursor-pointer hover:bg-primary/80"
                        : "cursor-not-allowed"
                    }`}
                  >
                    {step < currentStep ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </button>
                  {step < 3 && (
                    <div
                      className={`w-8 h-0.5 mx-2 ${
                        step < currentStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step Labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Configuration</span>
              <span>Parameters</span>
              <span>Confirmation</span>
            </div>
          </DialogHeader>

          <div className="space-y-8">
            {/* Step 1: Market Configuration */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="market-type">Market Type</Label>
                  <Select
                    value={marketType}
                    onValueChange={(value: "prefi" | "custom") =>
                      setMarketType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prefi">PreFi Market</SelectItem>
                      <SelectItem value="custom">Custom Market</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    {marketType === "prefi"
                      ? "PreFi markets use predefined pools with optimized parameters"
                      : "Custom markets allow full control over all market parameters"}
                  </p>
                </div>

                {/* Common Market Configuration */}
                <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                  <h3 className="text-lg font-semibold">
                    Market Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="market-class">Market Class *</Label>
                      <Select
                        value={newMarket.poolId}
                        onValueChange={(value) =>
                          setNewMarket((prev) => ({ ...prev, poolId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select market class" />
                        </SelectTrigger>
                        <SelectContent>
                          {poolOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose the market class for this token
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="token-contract-id">
                        Token Contract ID *
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsTokenContractModalOpen(true)}
                        className="w-full justify-between h-10"
                      >
                        {newMarket.tokenContractId ? (
                          <span className="text-left">
                            {newMarket.tokenContractId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Select or enter contract ID
                          </span>
                        )}
                        <Hash className="h-4 w-4 opacity-50" />
                      </Button>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click to search tokens or enter a custom contract ID
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Market Parameters */}
            {currentStep === 2 && (
              <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                <h3 className="text-lg font-semibold">
                  {marketType === "prefi"
                    ? "PreFi Market Parameters"
                    : "Custom Market Parameters"}
                </h3>

                {marketType === "prefi" ? (
                  /* PreFi Market - Simplified Parameters */
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            PreFi Optimized Parameters
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            PreFi markets use predefined, optimized parameters
                            based on the selected pool class. These parameters
                            are tested and proven for optimal performance.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="max-total-deposits">
                        Max Total Deposits
                      </Label>
                      <Input
                        id="max-total-deposits"
                        type="number"
                        placeholder="1000000"
                        value={newMarket.maxTotalDeposits}
                        onChange={(e) =>
                          setNewMarket((prev) => ({
                            ...prev,
                            maxTotalDeposits: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "1000",
                            }))
                          }
                        >
                          1K
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "10000",
                            }))
                          }
                        >
                          10K
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "100000",
                            }))
                          }
                        >
                          100K
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "1000000",
                            }))
                          }
                        >
                          1M
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "100000000",
                            }))
                          }
                        >
                          100M
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: "1000000000",
                            }))
                          }
                        >
                          1B
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Maximum total deposits allowed for this market
                      </p>
                    </div>

                    <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      <p>
                        <strong>PreFi Default Parameters:</strong>
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li>
                          • Collateral Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.collateral_factor || 780) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Liquidation Threshold:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.liquidation_threshold || 825) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Reserve Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.reserve_factor || 100) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Borrow Rate Base:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.borrow_rate_base || 50) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Slope:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)?.slope || 100) /
                            10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Liquidation Bonus:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.liquidation_bonus || 50) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Close Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)?.close_factor ||
                              350) / 10
                          ).toFixed(1)}
                          %
                        </li>
                        <li>
                          • Max Total Borrows: 0 (PreFi markets do not allow
                          borrowing)
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* Custom Market - Full Parameter Control */
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                            Custom Market Parameters
                          </h4>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                            You have full control over all market parameters.
                            Please ensure these values are appropriate for your
                            use case.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="collateral-factor">
                          Collateral Factor
                        </Label>
                        <Input
                          id="collateral-factor"
                          type="number"
                          step="0.01"
                          placeholder="0.8"
                          value={newMarket.collateralFactor}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              collateralFactor: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="liquidation-threshold">
                          Liquidation Threshold
                        </Label>
                        <Input
                          id="liquidation-threshold"
                          type="number"
                          step="0.01"
                          placeholder="0.85"
                          value={newMarket.liquidationThreshold}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              liquidationThreshold: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="reserve-factor">Reserve Factor</Label>
                        <Input
                          id="reserve-factor"
                          type="number"
                          step="0.01"
                          placeholder="0.1"
                          value={newMarket.reserveFactor}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              reserveFactor: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="borrow-rate">Borrow Rate</Label>
                        <Input
                          id="borrow-rate"
                          type="number"
                          step="0.01"
                          placeholder="0.05"
                          value={newMarket.borrowRate}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              borrowRate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="slope">Slope</Label>
                        <Input
                          id="slope"
                          type="number"
                          step="0.01"
                          placeholder="0.1"
                          value={newMarket.slope}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              slope: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="liquidation-bonus">
                          Liquidation Bonus
                        </Label>
                        <Input
                          id="liquidation-bonus"
                          type="number"
                          step="0.01"
                          placeholder="0.05"
                          value={newMarket.liquidationBonus}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              liquidationBonus: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max-total-deposits">
                          Max Total Deposits
                        </Label>
                        <Input
                          id="max-total-deposits"
                          type="number"
                          placeholder="1000000"
                          value={newMarket.maxTotalDeposits}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalDeposits: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-total-borrows">
                          Max Total Borrows
                        </Label>
                        <Input
                          id="max-total-borrows"
                          type="number"
                          placeholder="800000"
                          value={newMarket.maxTotalBorrows}
                          onChange={(e) =>
                            setNewMarket((prev) => ({
                              ...prev,
                              maxTotalBorrows: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="close-factor">Close Factor</Label>
                      <Input
                        id="close-factor"
                        type="number"
                        step="0.01"
                        placeholder="0.5"
                        value={newMarket.closeFactor}
                        onChange={(e) =>
                          setNewMarket((prev) => ({
                            ...prev,
                            closeFactor: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && (
              <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                <h3 className="text-lg font-semibold">
                  Confirm Market Creation
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Market Type
                      </Label>
                      <p className="text-sm font-medium">
                        {marketType === "prefi"
                          ? "PreFi Market"
                          : "Custom Market"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Market Class
                      </Label>
                      <p className="text-sm">{newMarket.poolId}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Token Contract ID
                    </Label>
                    <p className="text-sm font-mono">
                      {newMarket.tokenContractId}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Max Total Deposits
                      </Label>
                      <p className="text-sm">
                        {Number(newMarket.maxTotalDeposits).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Max Total Borrows
                      </Label>
                      <p className="text-sm">
                        {marketType === "prefi"
                          ? "0"
                          : Number(newMarket.maxTotalBorrows).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {marketType === "prefi" ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        PreFi Optimized Parameters
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <div>
                          • Collateral Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.collateral_factor || 780) / 10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Liquidation Threshold:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.liquidation_threshold || 825) / 10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Reserve Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.reserve_factor || 100) / 10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Borrow Rate Base:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.borrow_rate_base || 50) / 10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Slope:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)?.slope || 100) /
                            10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Liquidation Bonus:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)
                              ?.liquidation_bonus || 50) / 10
                          ).toFixed(1)}
                          %
                        </div>
                        <div>
                          • Close Factor:{" "}
                          {(
                            (getPreFiParameters(currentNetwork)?.close_factor ||
                              350) / 10
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Collateral Factor
                        </Label>
                        <p className="text-sm">{newMarket.collateralFactor}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Liquidation Threshold
                        </Label>
                        <p className="text-sm">
                          {newMarket.liquidationThreshold}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Reserve Factor
                        </Label>
                        <p className="text-sm">{newMarket.reserveFactor}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Borrow Rate
                        </Label>
                        <p className="text-sm">{newMarket.borrowRate}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Slope
                        </Label>
                        <p className="text-sm">{newMarket.slope}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Liquidation Bonus
                        </Label>
                        <p className="text-sm">{newMarket.liquidationBonus}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Close Factor
                        </Label>
                        <p className="text-sm">{newMarket.closeFactor}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`p-4 border rounded-lg ${
                    marketType === "prefi"
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {marketType === "prefi" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    )}
                    <div>
                      <h4
                        className={`text-sm font-medium ${
                          marketType === "prefi"
                            ? "text-green-800 dark:text-green-200"
                            : "text-yellow-800 dark:text-yellow-200"
                        }`}
                      >
                        {marketType === "prefi"
                          ? "PreFi Market Ready"
                          : "Confirm Market Creation"}
                      </h4>
                      <p
                        className={`text-sm mt-1 ${
                          marketType === "prefi"
                            ? "text-green-700 dark:text-green-300"
                            : "text-yellow-700 dark:text-yellow-300"
                        }`}
                      >
                        {marketType === "prefi"
                          ? "This PreFi market uses optimized parameters for reliable performance. Ready to create!"
                          : "Please review all parameters carefully. Once created, these parameters will be set on the blockchain and cannot be easily changed."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsCreateMarketModalOpen(false);
                  }}
                >
                  Cancel
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNextStep}
                    disabled={!canProceedToNextStep()}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateMarket}
                    disabled={!activeAccount}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create Market
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Operation Review Modal */}
      <Dialog
        open={isOperationModalOpen}
        onOpenChange={setIsOperationModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Operation</DialogTitle>
            <DialogDescription>
              Review and approve or reject this administrative operation.
            </DialogDescription>
          </DialogHeader>

          {selectedOperation && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card/50">
                <h4 className="font-medium mb-2">
                  {selectedOperation.description}
                </h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    <strong>Type:</strong>{" "}
                    {selectedOperation.type.replace("_", " ").toUpperCase()}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedOperation.status}
                  </p>
                  <p>
                    <strong>Timestamp:</strong>{" "}
                    {new Date(selectedOperation.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="operation-notes">Notes (optional)</Label>
                <Textarea
                  id="operation-notes"
                  placeholder="Add any notes about this operation..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOperationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedOperation && handleRejectOperation(selectedOperation.id)
              }
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() =>
                selectedOperation &&
                handleApproveOperation(selectedOperation.id)
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Contract ID Modal */}
      <TokenContractModal
        open={isTokenContractModalOpen}
        onOpenChange={setIsTokenContractModalOpen}
        onSelect={handleTokenContractSelect}
        currentValue={newMarket.tokenContractId}
      />

      {/* Market View Modal */}
      <Dialog
        open={isMarketViewModalOpen}
        onOpenChange={setIsMarketViewModalOpen}
      >
        <DialogContent className="max-w-2xl p-8">
          <DialogHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Market Details</DialogTitle>
                <DialogDescription>
                  View detailed information about the selected market.
                </DialogDescription>
              </div>
              {marketViewData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!selectedMarket) return;
                    setIsLoadingMarketView(true);
                    try {
                      const marketKey = selectedMarket.asset?.toLowerCase();
                      await loadMarketDataWithBypass(marketKey);

                      // Wait for data to be updated
                      setTimeout(() => {
                        const updatedMarketData = marketsData[marketKey];
                        if (updatedMarketData?.marketInfo) {
                          setMarketViewData(updatedMarketData.marketInfo);
                        }
                      }, 100);
                    } catch (error) {
                      console.error("Error refreshing market data:", error);
                    } finally {
                      setIsLoadingMarketView(false);
                    }
                  }}
                  disabled={isLoadingMarketView}
                >
                  <RefreshCcw
                    className={`h-4 w-4 mr-2 ${
                      isLoadingMarketView ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              )}
            </div>
          </DialogHeader>

          {isLoadingMarketView ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Loading market details...
              </div>
            </div>
          ) : marketViewData ? (
            <div className="space-y-6">
              {/* Market Header */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      {marketViewData.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          marketViewData.isActive ? "default" : "secondary"
                        }
                      >
                        {marketViewData.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {marketViewData.isPaused && (
                        <Badge variant="destructive" className="text-xs">
                          Paused
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Symbol</p>
                    <p className="font-medium">{marketViewData.symbol}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Market ID</p>
                    <p className="font-medium">{marketViewData.marketId}</p>
                  </div>
                </div>
              </div>

              {/* Market Statistics */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Market Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Deposits
                    </p>
                    <p className="text-lg font-semibold">
                      $
                      {(() => {
                        const value =
                          parseFloat(marketViewData.totalDeposits) *
                          (parseFloat(marketViewData.price) / Math.pow(10, marketViewData.decimals || 6));
                        if (value >= 1000000000) {
                          return `${(value / 1000000000).toFixed(2)}B`;
                        } else if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(2)}K`;
                        } else {
                          return value.toFixed(2);
                        }
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Borrows
                    </p>
                    <p className="text-lg font-semibold">
                      $
                      {(() => {
                        const value =
                          parseFloat(marketViewData.totalBorrows) *
                          (parseFloat(marketViewData.price) / Math.pow(10, marketViewData.decimals || 6));
                        if (value >= 1000000000) {
                          return `${(value / 1000000000).toFixed(2)}B`;
                        } else if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(2)}K`;
                        } else {
                          return value.toFixed(2);
                        }
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Utilization Rate
                    </p>
                    <p className="text-lg font-semibold">
                      {(marketViewData.utilizationRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supply Rate</p>
                    <p className="text-lg font-semibold">
                      {(marketViewData.supplyRate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Market Price
                    </p>
                    <p className="text-lg font-semibold">
                      ${(parseFloat(marketViewData.price) / Math.pow(10, marketViewData.decimals || 6)).toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Technical Details
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Token ID:
                    </span>
                    <span className="text-sm font-mono">
                      {marketViewData.tokenId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Decimals:
                    </span>
                    <span className="text-sm font-mono">
                      {marketViewData.decimals}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Updated:
                    </span>
                    <span className="text-sm font-mono">
                      {new Date(marketViewData.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Market Parameters */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Market Parameters
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Collateral Factor:
                    </span>
                    <span>
                      {(marketViewData.collateralFactor * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Liquidation Threshold:
                    </span>
                    <span>
                      {(marketViewData.liquidationThreshold * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Reserve Factor:
                    </span>
                    <span>
                      {(marketViewData.reserveFactor * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Borrow Rate Base:
                    </span>
                    <span>{(marketViewData.borrowRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slope:</span>
                    <span>{(marketViewData.slope * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Liquidation Bonus:
                    </span>
                    <span>
                      {(marketViewData.liquidationBonus * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Close Factor:</span>
                    <span>
                      {(marketViewData.closeFactor * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Current Borrow Rate:
                    </span>
                    <span>
                      {(marketViewData.borrowRateCurrent * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Market Limits
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Max Total Deposits:
                    </span>
                    <span>
                      $
                      {(() => {
                        const value =
                          parseFloat(marketViewData.maxTotalDeposits) *
                          (parseFloat(marketViewData.price) / Math.pow(10, marketViewData.decimals || 6));
                        if (value >= 1000000000) {
                          return `${(value / 1000000000).toFixed(2)}B`;
                        } else if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(2)}K`;
                        } else {
                          return value.toFixed(2);
                        }
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Max Total Borrows:
                    </span>
                    <span>
                      $
                      {(() => {
                        const value = parseFloat(
                          marketViewData.maxTotalBorrows
                        );
                        if (value >= 1000000000) {
                          return `${(value / 1000000000).toFixed(2)}B`;
                        } else if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(2)}K`;
                        } else {
                          return value.toFixed(2);
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  Failed to load market data
                </p>
                <p className="text-sm">Please try again later</p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-6">
            <Button
              variant="outline"
              onClick={() => setIsMarketViewModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Update Modal */}
      <Dialog
        open={isPriceUpdateModalOpen}
        onOpenChange={setIsPriceUpdateModalOpen}
      >
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-xl">Update Market Price</DialogTitle>
            <DialogDescription>
              Update the price for the selected market.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPrice">Current Price</Label>
                <Input
                  id="currentPrice"
                  value={priceUpdateData.currentPrice}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="newPrice">New Price</Label>
                <Input
                  id="newPrice"
                  type="number"
                  step="0.000001"
                  placeholder="Enter new price"
                  value={priceUpdateData.newPrice}
                  onChange={(e) =>
                    setPriceUpdateData((prev) => ({
                      ...prev,
                      newPrice: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Market ID: {priceUpdateData.marketId}</p>
                <p>Pool ID: {priceUpdateData.poolId}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button
              variant="outline"
              onClick={() => setIsPriceUpdateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdatePrice}>Update Price</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Max Deposits Update Modal */}
      <Dialog
        open={isMaxDepositsUpdateModalOpen}
        onOpenChange={setIsMaxDepositsUpdateModalOpen}
      >
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-xl">Update Market Max Deposits</DialogTitle>
            <DialogDescription>
              Update the maximum total deposits allowed for the selected market.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentMaxDeposits">Current Max Deposits</Label>
                <Input
                  id="currentMaxDeposits"
                  value={maxDepositsUpdateData.currentMaxDeposits}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="newMaxDeposits">New Max Deposits</Label>
                <Input
                  id="newMaxDeposits"
                  type="number"
                  step="1"
                  placeholder="Enter new max deposits amount"
                  value={maxDepositsUpdateData.newMaxDeposits}
                  onChange={(e) =>
                    setMaxDepositsUpdateData((prev) => ({
                      ...prev,
                      newMaxDeposits: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Market ID: {maxDepositsUpdateData.marketId}</p>
                <p>Pool ID: {maxDepositsUpdateData.poolId}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button
              variant="outline"
              onClick={() => setIsMaxDepositsUpdateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateMaxDeposits}>Update Max Deposits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="pb-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center text-xl">
              Market Created Successfully!
            </DialogTitle>
            <DialogDescription className="text-center">
              Your new market has been created and is now active on the
              blockchain.
            </DialogDescription>
          </DialogHeader>

          {createdMarketData && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground">
                Market Details
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Market ID:
                  </span>
                  <span className="text-sm font-mono">
                    {createdMarketData.marketId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Market Type:
                  </span>
                  <span className="text-sm">
                    {createdMarketData.marketType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Market Class:
                  </span>
                  <span className="text-sm">
                    {createdMarketData.marketClass}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Token Contract ID:
                  </span>
                  <span className="text-sm font-mono">
                    {createdMarketData.tokenContractId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Max Total Deposits:
                  </span>
                  <span className="text-sm">
                    {Number(
                      createdMarketData.maxTotalDeposits
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Max Total Borrows:
                  </span>
                  <span className="text-sm">
                    {Number(createdMarketData.maxTotalBorrows).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-6">
            <Button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
