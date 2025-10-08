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
  Calculator,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
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
  getNetworkConfig,
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
  APP_SPEC as LendingPoolAppSpec,
  DorkFiLendingPoolClient,
} from "@/clients/DorkFiLendingPoolClient";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { abi, CONTRACT } from "ulujs";
import { fetchMarketInfo } from "@/services/lendingService";
// import { fromBase } from "@/utils/fromBase"; // Commented out as it's not being used
import { useCallback, useMemo } from "react";
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
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { TokenAutocomplete } from "@/components/ui/TokenAutocomplete";
import { TokenContractModal } from "@/components/ui/TokenContractModal";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk, { waitForConfirmation } from "algosdk";
import { initializeAlgorandForCurrentNetwork } from "@/services/algorandExamples";
import BigNumber from "bignumber.js";
import envoiService, { type EnvoiNameResponse } from "@/services/envoiService";
import { fromBase } from "@/utils/calculationUtils";
import { ARC200Service } from "@/services/arc200Service";

// Get markets from configuration - now reactive to network changes
const getMarketsFromConfig = (networkId: NetworkId) => {
  const networkConfig = getNetworkConfig(networkId);
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
    decimals: token.decimals, // CRITICAL: Token decimals for proper calculations
    poolId: token.poolId, // Pool ID for this token
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

  // User Analysis state
  const [userAnalysisAddress, setUserAnalysisAddress] = useState("");
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [userMarketsState, setUserMarketsState] = useState<Record<string, any>>(
    {}
  );
  const [userMarketPrices, setUserMarketPrices] = useState<
    Record<string, number>
  >({});
  const [userGetUserData, setUserGetUserData] = useState<Record<string, any>>(
    {}
  );
  const [globalDataLoading, setGlobalDataLoading] = useState(false);
  const [globalDataError, setGlobalDataError] = useState<string | null>(null);

  // Envoi state
  const [envoiData, setEnvoiData] = useState<EnvoiNameResponse | null>(null);
  const [envoiLoading, setEnvoiLoading] = useState(false);
  const [envoiError, setEnvoiError] = useState<string | null>(null);
  const [envoiSearchQuery, setEnvoiSearchQuery] = useState("");
  const [envoiSearchResults, setEnvoiSearchResults] = useState<
    Array<{ name: string; address: string; tokenId: string }>
  >([]);
  const [envoiSearchLoading, setEnvoiSearchLoading] = useState(false);

  // Lending service state - using on-demand loading now

  // Create market form state
  const [marketType, setMarketType] = useState<"prefi" | "custom">("prefi");
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isMarketViewModalOpen, setIsMarketViewModalOpen] = useState(false);
  const [isPriceUpdateModalOpen, setIsPriceUpdateModalOpen] = useState(false);
  const [isMaxDepositsUpdateModalOpen, setIsMaxDepositsUpdateModalOpen] =
    useState(false);
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
        tokenId: Number(newMarket.tokenContractId),
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
        Number(newMarket.poolId),
        createMarketParams,
        activeAccount.address
      );

      if (createMarketResult.success) {
        console.log("Market creation result:", createMarketResult);

        if (isCurrentNetworkAlgorandCompatible()) {
          const algorandClients =
            await algorandService.getCurrentClientsForTransactions();
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
        ? (parseFloat(market.marketInfo.price) / Math.pow(10, 6)).toFixed(6)
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
        ? (
            parseFloat(market.marketInfo.maxTotalDeposits) /
            Math.pow(10, token?.decimals || 6)
          ).toFixed(0)
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
            .multipliedBy(BigNumber(10).pow(6))
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
        console.log("togglePauseResult", togglePauseResult);
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

  // User Analysis Functions
  const fetchUserGlobalData = useCallback(
    async (userAddress: string) => {
      console.log(
        "📊 fetchUserGlobalData called with:",
        userAddress,
        "on network:",
        currentNetwork
      );

      if (!userAddress || !currentNetwork) {
        console.warn("⚠️ Missing userAddress or currentNetwork:", {
          userAddress,
          currentNetwork,
        });
        setUserGlobalData(null);
        return;
      }

      console.log("🔄 Starting global data fetch...");
      setGlobalDataLoading(true);
      setGlobalDataError(null);

      try {
        const networkConfig = getCurrentNetworkConfig();
        const clients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );

        // Initialize aggregate values
        let totalCollateralValueUSD = 0;
        let totalBorrowValueUSD = 0;
        let lastUpdateTime = 0;

        for (const poolId of networkConfig.contracts.lendingPools) {
          const ci = new CONTRACT(
            Number(poolId),
            clients.algod,
            undefined,
            { ...LendingPoolAppSpec.contract, events: [] },
            {
              addr: algosdk.getApplicationAddress(Number(poolId)),
              sk: new Uint8Array(),
            }
          );

          const globalUserR = await ci.get_global_user(userAddress);
          console.log("globalUserR", globalUserR);
          if (globalUserR.success) {
            const globalUser = globalUserR.returnValue;
            // Contract stores totalCollateralValue with scaling: (deposit_amount * price) // SCALE
            // Where SCALE = 1e18, so we need to divide by 1e18 to get USD value
            const totalCollateralValueRaw = globalUser[0].toString();
            console.log("totalCollateralValueRaw", totalCollateralValueRaw);
            const poolCollateralValueUSD = new BigNumber(
              totalCollateralValueRaw
            )
              .div(1e14) // TODO likely not correct need to check
              .toNumber();
            console.log(
              "poolCollateralValueUSD",
              poolCollateralValueUSD,
              "type:",
              typeof poolCollateralValueUSD
            );
            const poolBorrowValueUSD = new BigNumber(
              globalUser[1].toString()
            ).toNumber();

            // Ensure we're working with numbers, not strings
            const collateralValue = Number(poolCollateralValueUSD) || 0;
            const borrowValue = Number(poolBorrowValueUSD) || 0;

            // Aggregate values from all pools
            totalCollateralValueUSD += collateralValue;
            totalBorrowValueUSD += borrowValue;
            // Use the latest update time from all pools
            lastUpdateTime = Math.max(lastUpdateTime, Number(globalUser[2]));

            console.log("✅ Pool data fetched:", {
              poolId,
              userAddress,
              poolCollateralValue: poolCollateralValueUSD,
              poolBorrowValue: poolBorrowValueUSD,
              poolLastUpdateTime: Number(globalUser[2]),
              rawValue: globalUser[0].toString(),
              scalingFactor: "1e18",
            });
          } else {
            throw new Error("Failed to get global user data");
          }
        }

        // Set aggregated data once after processing all pools
        console.log("🔍 Final aggregated values before setting state:", {
          totalCollateralValueUSD,
          totalBorrowValueUSD,
          "totalCollateralValueUSD type": typeof totalCollateralValueUSD,
          "totalBorrowValueUSD type": typeof totalBorrowValueUSD,
        });

        setUserGlobalData({
          totalCollateralValue: totalCollateralValueUSD,
          totalBorrowValue: totalBorrowValueUSD,
          lastUpdateTime: lastUpdateTime,
        });
        console.log("✅ Aggregated user global data:", {
          userAddress,
          totalCollateralValue: totalCollateralValueUSD,
          totalBorrowValue: totalBorrowValueUSD,
          lastUpdateTime: lastUpdateTime,
        });
      } catch (error) {
        console.error("❌ Error fetching user global data:", error);
        setGlobalDataError(
          error instanceof Error ? error.message : "Unknown error"
        );
        setUserGlobalData(null);
      } finally {
        setGlobalDataLoading(false);
      }
    },
    [currentNetwork]
  );

  const fetchUserGetUserData = useCallback(
    async (userAddress: string) => {
      console.log(
        "🔍 fetchUserGetUserData called with:",
        userAddress,
        "on network:",
        currentNetwork
      );

      if (!userAddress || !currentNetwork) {
        console.warn(
          "⚠️ Missing userAddress or currentNetwork for get_user data:",
          { userAddress, currentNetwork }
        );
        return {};
      }

      console.log("🔄 Starting get_user data fetch...");
      const userDataByMarket: Record<string, any> = {};

      try {
        const networkConfig = getCurrentNetworkConfig();
        const clients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        console.log(
          `🔍 Total tokens to process: ${tokens.length}`,
          tokens.map((t) => ({
            symbol: t.symbol,
            underlyingContractId: t.underlyingContractId,
            poolId: t.poolId,
          }))
        );

        // Fetch user data for each market using get_user
        for (const token of tokens) {
          try {
            const marketId = token.symbol.toLowerCase();
            console.log(`🔍 Processing token ${token.symbol}:`, {
              symbol: token.symbol,
              underlyingContractId: token.underlyingContractId,
              poolId: token.poolId,
              marketId,
            });

            // Get market info to determine the pool and token ID
            console.log(
              `🔄 Calling fetchMarketInfo for ${token.symbol} with:`,
              {
                poolId: token.poolId || "1",
                underlyingContractId:
                  token.underlyingContractId || token.symbol,
                currentNetwork,
              }
            );

            const marketInfo = await fetchMarketInfo(
              token.poolId || "1",
              token.underlyingContractId || token.symbol,
              currentNetwork
            );
            console.log(`📊 Market info for ${token.symbol}:`, marketInfo);
            console.log(`🔍 Condition check for ${token.symbol}:`, {
              hasMarketInfo: !!marketInfo,
              marketInfoType: typeof marketInfo,
              hasUnderlyingContractId: !!token.underlyingContractId,
              underlyingContractId: token.underlyingContractId,
              underlyingContractIdType: typeof token.underlyingContractId,
              conditionResult: !!(marketInfo && token.underlyingContractId),
            });

            if (marketInfo && token.underlyingContractId) {
              console.log(
                `✅ Conditions met for ${token.symbol}, calling get_user...`
              );
              const poolId = token.poolId || "1";
              console.log("poolId", poolId);
              const ci = new CONTRACT(
                Number(poolId),
                clients.algod,
                undefined,
                { ...LendingPoolAppSpec.contract, events: [] },
                {
                  addr: algosdk.getApplicationAddress(Number(poolId)),
                  sk: new Uint8Array(),
                }
              );

              console.log(`🔧 CONTRACT object created for ${token.symbol}:`, {
                poolId: Number(poolId),
                hasGetUser: typeof ci.get_user === "function",
                contractMethods: Object.getOwnPropertyNames(
                  Object.getPrototypeOf(ci)
                ),
              });

              // Call get_user method
              console.log(
                `🔄 About to call get_user for ${token.symbol} with:`,
                {
                  userAddress,
                  underlyingContractId: token.underlyingContractId,
                  underlyingContractIdType: typeof token.underlyingContractId,
                  poolId,
                }
              );

              // Validate the underlyingContractId parameter
              const marketId = token.underlyingContractId;
              if (!marketId) {
                throw new Error(
                  `No underlyingContractId for token ${token.symbol}`
                );
              }

              let getUserR, getMarketR;
              try {
                console.log(
                  `🚀 Calling ci.get_user(${userAddress}, ${marketId}) and ci.get_market(${marketId})`
                );
                [getUserR, getMarketR] = await Promise.all([
                  ci.get_user(userAddress, Number(marketId)),
                  ci.get_market(Number(marketId)),
                ]);
                console.log(
                  `✅ get_user and get_market calls completed for ${token.symbol}`
                );
                console.log({ getUserR, getMarketR });
                console.log(`get_user result for ${token.symbol}:`, getUserR);
                console.log(
                  `get_market result for ${token.symbol}:`,
                  getMarketR
                );
              } catch (getUserError) {
                console.error(
                  `❌ get_user call failed for ${token.symbol}:`,
                  getUserError
                );
                throw getUserError; // Re-throw to be caught by outer try-catch
              }

              if (getUserR.success && getMarketR.success) {
                const userData = getUserR.returnValue;
                const marketData = getMarketR.returnValue;

                console.log(`🔍 Raw userData for ${token.symbol}:`, {
                  userData,
                  userDataLength: userData?.length,
                  userDataType: typeof userData,
                  userDataArray: Array.isArray(userData),
                });

                console.log(`🔍 Raw marketData for ${token.symbol}:`, {
                  marketData,
                  marketDataLength: marketData?.length,
                  marketDataType: typeof marketData,
                  marketDataArray: Array.isArray(marketData),
                });

                // Log each field individually to see what we're getting
                console.log(`🔍 Individual user fields for ${token.symbol}:`, {
                  "[0] scaled_deposits": userData[0],
                  "[1] scaled_borrows": userData[1],
                  "[2] user_deposit_index": userData[2],
                  "[3] user_borrow_index": userData[3],
                  "[4] last_update_time": userData[4],
                  "[5] last_price": userData[5],
                });

                console.log(
                  `🔍 Individual market fields for ${token.symbol}:`,
                  {
                    "[8] current_deposit_index": marketData[8],
                    "[9] current_borrow_index": marketData[9],
                    "[13] current_price": marketData[13],
                  }
                );

                // Store data using both token symbol and contract ID as keys for flexibility
                // Use CURRENT market indices, not user's stored indices
                userDataByMarket[marketId] = {
                  scaled_deposits: userData[0].toString(),
                  scaled_borrows: userData[1].toString(),
                  user_deposit_index: userData[2].toString(), // User's stored index
                  user_borrow_index: userData[3].toString(), // User's stored index
                  current_deposit_index: marketData[8].toString(), // Current market index
                  current_borrow_index: marketData[9].toString(), // Current market index
                  last_update_time: Number(userData[4]),
                  last_price: userData[5].toString(),
                  current_price: marketData[13].toString(), // Current market price
                };

                // Also store using contract ID as key
                userDataByMarket[token.underlyingContractId] = {
                  scaled_deposits: userData[0].toString(),
                  scaled_borrows: userData[1].toString(),
                  user_deposit_index: userData[2].toString(), // User's stored index
                  user_borrow_index: userData[3].toString(), // User's stored index
                  current_deposit_index: marketData[8].toString(), // Current market index
                  current_borrow_index: marketData[9].toString(), // Current market index
                  last_update_time: Number(userData[4]),
                  last_price: userData[5].toString(),
                  current_price: marketData[13].toString(), // Current market price
                };

                console.log(`✅ Processed get_user data for ${token.symbol}:`, {
                  scaled_deposits: userData[0].toString(),
                  scaled_borrows: userData[1].toString(),
                  deposit_index: userData[2].toString(),
                  borrow_index: userData[3].toString(),
                  last_update_time: Number(userData[4]),
                  last_price: userData[5].toString(),
                  rawScaledDeposits: userData[0],
                  rawScaledDepositsType: typeof userData[0],
                });
              } else {
                console.warn(
                  `Failed to get user data for ${token.symbol}:`,
                  getUserR
                );
                // Set default values
                userDataByMarket[marketId] = {
                  scaled_deposits: "0",
                  scaled_borrows: "0",
                  deposit_index: "1000000000000000000", // 1e18
                  borrow_index: "1000000000000000000", // 1e18
                  last_update_time: 0,
                  last_price: "0",
                };
              }
            } else {
              console.warn(`❌ Conditions NOT met for ${token.symbol}:`, {
                hasMarketInfo: !!marketInfo,
                hasUnderlyingContractId: !!token.underlyingContractId,
                underlyingContractId: token.underlyingContractId,
              });
            }
          } catch (error) {
            console.warn(
              `Failed to fetch get_user data for ${token.symbol}:`,
              error
            );
            // Set default values on error
            const marketId = token.symbol.toLowerCase();
            userDataByMarket[marketId] = {
              scaled_deposits: "0",
              scaled_borrows: "0",
              deposit_index: "1000000000000000000", // 1e18
              borrow_index: "1000000000000000000", // 1e18
              last_update_time: 0,
              last_price: "0",
            };
          }
        }

        console.log("✅ get_user data fetch completed:", userDataByMarket);
        return userDataByMarket;
      } catch (error) {
        console.error("❌ Error fetching get_user data:", error);
        return {};
      }
    },
    [currentNetwork]
  );

  const fetchUserMarketData = useCallback(
    async (userAddress: string) => {
      console.log(
        "📈 fetchUserMarketData called with:",
        userAddress,
        "on network:",
        currentNetwork
      );

      if (!userAddress || !currentNetwork) {
        console.warn(
          "⚠️ Missing userAddress or currentNetwork for market data:",
          { userAddress, currentNetwork }
        );
        return;
      }

      console.log("🔄 Starting market data fetch...");
      try {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const marketsState: Record<string, any> = {};
        const marketPrices: Record<string, number> = {};

        // Fetch market data for each token
        for (const token of tokens) {
          try {
            // Get market info for price data
            const marketInfo = await fetchMarketInfo(
              token.poolId || "1",
              token.underlyingContractId || token.symbol,
              currentNetwork
            );

            if (marketInfo) {
              const marketId = token.symbol.toLowerCase();

              // Fetch user-specific market balance data
              let userMarketData = {
                depositedBase: BigInt(0),
                walletBalanceBase: BigInt(0),
                totalStakeSecondsBase: BigInt(0),
              };

              try {
                // Fetch REAL user balances from blockchain (mirroring PreFi.tsx getMarketBalance)
                const networkConfig = getCurrentNetworkConfig();
                const algorandClients = algorandService.initializeClients(
                  networkConfig.walletNetworkId as AlgorandNetwork
                );
                ARC200Service.initialize(algorandClients);

                // Determine asset type and token ID (same logic as PreFi.tsx)
                const assetId = token.underlyingAssetId || "0";
                const [assetType, tokenId] =
                  assetId === "0"
                    ? ["network", "0"]
                    : !isNaN(Number(assetId))
                    ? ["asa", assetId]
                    : ["arc200", token.underlyingContractId];

                // Get nTokenId for deposited balance
                const nTokenId = marketInfo.ntokenId;

                // Fetch wallet balance based on asset type
                let balance = 0n;
                if (assetType === "network") {
                  // For network VOI, get account balance minus minimum balance
                  const accInfo = await algorandClients.algod
                    .accountInformation(userAddress)
                    .do();
                  balance = BigInt(
                    Math.max(0, accInfo.amount - accInfo["min-balance"] - 1e6)
                  );
                } else if (assetType === "asa") {
                  const accAssetInfo = await algorandClients.algod
                    .accountAssetInformation(userAddress, Number(assetId))
                    .do();
                  balance = BigInt(accAssetInfo["asset-holding"].amount);
                } else if (assetType === "arc200") {
                  const tokenBalance = await ARC200Service.getBalance(
                    userAddress,
                    tokenId
                  );
                  balance = tokenBalance ? BigInt(tokenBalance) : 0n;
                }

                // Fetch deposited balance (nToken balance) - THIS IS THE KEY PART!
                let deposited = 0n;
                if (nTokenId) {
                  const nTokenBalance = await ARC200Service.getBalance(
                    userAddress,
                    nTokenId
                  );
                  deposited = nTokenBalance ? BigInt(nTokenBalance) : 0n;
                }

                userMarketData = {
                  depositedBase: deposited,
                  walletBalanceBase: balance,
                  totalStakeSecondsBase: BigInt(10_000_000), // Default value like in PreFi.tsx
                };

                console.log(`✅ REAL user market data for ${token.symbol}:`, {
                  assetType,
                  tokenId,
                  nTokenId,
                  deposited: fromBase(deposited, token.decimals || 6),
                  walletBalance: fromBase(balance, token.decimals || 6),
                  marketId,
                });
              } catch (userDataError) {
                console.warn(
                  `Failed to fetch REAL user data for ${token.symbol}:`,
                  userDataError
                );
                // Fallback to zero balances on error
                userMarketData = {
                  depositedBase: BigInt(0),
                  walletBalanceBase: BigInt(0),
                  totalStakeSecondsBase: BigInt(10_000_000),
                };
              }

              marketsState[marketId] = userMarketData;

              // Set market price (scaled properly like in PreFi.tsx)
              if (marketInfo.price) {
                const partiallyScaledPrice = parseFloat(marketInfo.price);
                const additionalScaling = Math.pow(10, 6); // Use consistent 6-decimal scaling for all tokens
                const finalPrice = partiallyScaledPrice / additionalScaling;
                marketPrices[marketId] = finalPrice;
                console.log(
                  `Market price for ${token.symbol}: $${finalPrice} (scaled by 10^6)`
                );
              }
            }
          } catch (error) {
            console.warn(
              `Failed to fetch market data for ${token.symbol}:`,
              error
            );
          }
        }

        setUserMarketsState(marketsState);
        setUserMarketPrices(marketPrices);
        console.log("✅ Market data fetch completed:", {
          marketsState,
          marketPrices,
        });
      } catch (error) {
        console.error("❌ Error fetching user market data:", error);
      }
    },
    [currentNetwork]
  );

  // Envoi Functions
  const fetchEnvoiData = useCallback(
    async (userAddress: string) => {
      console.log(
        "🔗 fetchEnvoiData called with:",
        userAddress,
        "on network:",
        currentNetwork
      );

      if (!userAddress || !currentNetwork) {
        console.warn(
          "⚠️ Missing userAddress or currentNetwork for Envoi data:",
          { userAddress, currentNetwork }
        );
        setEnvoiData(null);
        return;
      }

      console.log("🔄 Starting Envoi data fetch...");
      setEnvoiLoading(true);
      setEnvoiError(null);

      try {
        const nameData = await envoiService.resolveName(userAddress);
        setEnvoiData(nameData);

        if (nameData) {
          console.log("✅ Envoi data fetched:", {
            address: userAddress,
            name: nameData.name,
            tokenId: nameData.tokenId,
            owner: nameData.owner,
          });
        } else {
          console.log("ℹ️ No Envoi name found for address:", userAddress);
        }
      } catch (error) {
        console.error("❌ Error fetching Envoi data:", error);
        setEnvoiError(error instanceof Error ? error.message : "Unknown error");
        setEnvoiData(null);
      } finally {
        setEnvoiLoading(false);
      }
    },
    [currentNetwork]
  );

  const handleEnvoiSearch = useCallback(async (query: string) => {
    if (!query?.trim()) {
      setEnvoiSearchResults([]);
      return;
    }

    console.log("🔍 Searching Envoi names for:", query);
    setEnvoiSearchLoading(true);
    try {
      const results = await envoiService.searchNames(query);
      console.log("📋 Search results:", results);
      setEnvoiSearchResults(results?.results || []);
    } catch (error) {
      console.error("❌ Error searching Envoi names:", error);
      setEnvoiSearchResults([]);
    } finally {
      setEnvoiSearchLoading(false);
    }
  }, []);

  const handleEnvoiNameSelect = useCallback(
    async (name: string) => {
      console.log("🔍 Envoi name selected:", name);
      try {
        const addressData = await envoiService.resolveAddress(name);
        console.log("📍 Address data resolved:", addressData);

        if (addressData) {
          console.log(
            "✅ Setting address and starting analysis:",
            addressData.address
          );
          console.log("🔍 Full addressData object:", addressData);

          // The API should now return the correct format with address field
          const resolvedAddress = addressData.address;
          console.log("📍 Resolved address:", resolvedAddress);

          if (resolvedAddress) {
            setUserAnalysisAddress(resolvedAddress);
            setEnvoiSearchQuery(name);
            setEnvoiSearchResults([]);

            // Show success message
            console.log(`✅ Address resolved: ${name} → ${resolvedAddress}`);

            // Automatically analyze the user with the resolved address
            console.log("🚀 Starting analysis for address:", resolvedAddress);
            try {
              // Set loading state for both methods
              setGlobalDataLoading(true);

              await Promise.all([
                fetchUserGlobalData(resolvedAddress),
                fetchUserMarketData(resolvedAddress),
                fetchEnvoiData(resolvedAddress),
              ]);
              console.log(
                "✅ Analysis completed for address:",
                resolvedAddress
              );
            } catch (analysisError) {
              console.error(
                "❌ Error during automatic analysis:",
                analysisError
              );
              // Don't throw the error, just log it - the user can still manually analyze
            } finally {
              setGlobalDataLoading(false);
            }
          } else {
            console.error("❌ No address found in response:", addressData);
            alert(
              "Failed to resolve address from the API response. Please check the console for details."
            );
          }
        } else {
          console.warn("⚠️ No address data returned for name:", name);
          alert(
            "Failed to resolve address for this VOI name. Please try again."
          );
        }
      } catch (error) {
        console.error("❌ Error resolving Envoi name:", error);
        alert("Failed to resolve Envoi name. Please try again.");
      }
    },
    [
      fetchUserGlobalData,
      fetchUserMarketData,
      fetchUserGetUserData,
      fetchEnvoiData,
    ]
  );

  const handleAnalyzeUser = async () => {
    console.log(
      "🔍 handleAnalyzeUser called with address:",
      userAnalysisAddress
    );

    if (!userAnalysisAddress?.trim()) {
      console.warn("⚠️ No address provided for analysis");
      alert("Please enter a user address");
      return;
    }

    console.log(
      "🚀 Starting manual analysis for address:",
      userAnalysisAddress
    );
    try {
      // Set loading state for both methods
      setGlobalDataLoading(true);

      await Promise.all([
        fetchUserGlobalData(userAnalysisAddress),
        fetchUserMarketData(userAnalysisAddress),
        fetchUserGetUserData(userAnalysisAddress).then((data) => {
          setUserGetUserData(data);
        }),
        fetchEnvoiData(userAnalysisAddress),
      ]);
      console.log(
        "✅ Manual analysis completed for address:",
        userAnalysisAddress
      );
    } catch (error) {
      console.error("❌ Error in manual analysis:", error);
    } finally {
      setGlobalDataLoading(false);
    }
  };

  // Method 1: Sum individual market deposits (mirroring PreFi.tsx logic)
  const userGlobalDeposited = useMemo(() => {
    let sum = 0;
    const debugInfo: Array<{
      symbol: string;
      tokenAmount: number;
      price: number;
      usdValue: number;
      depositedBase: bigint;
    }> = [];

    // Get markets from configuration (similar to PreFi.tsx)
    const markets = getMarketsFromConfig(currentNetwork);

    for (const market of markets) {
      const marketId = market.symbol.toLowerCase();
      const marketState = userMarketsState[marketId];
      if (!marketState) continue;

      const tokenAmount = fromBase(
        marketState.depositedBase,
        market.decimals || 6
      ); // Use actual token decimals
      const price = userMarketPrices[marketId] || 0;
      const usdValue = tokenAmount * price;
      sum += usdValue;

      // Always include in breakdown for complete visibility
      debugInfo.push({
        symbol: market.symbol,
        tokenAmount,
        price,
        usdValue,
        depositedBase: marketState.depositedBase,
      });
    }

    // Debug logging (similar to PreFi.tsx)
    if (debugInfo.length > 0) {
      console.log("📊 Method 1 (Sum) calculation:", {
        totalUSD: sum,
        breakdown: debugInfo,
        marketsCount: markets.length,
        activeMarkets: debugInfo.filter((m) => m.usdValue > 0).length,
      });
    }

    return sum;
  }, [userMarketsState, userMarketPrices, currentNetwork]);

  // Store breakdown data for display
  const method1Breakdown = useMemo(() => {
    const markets = getMarketsFromConfig(currentNetwork);
    return markets.map((market) => {
      const marketId = market.symbol.toLowerCase();
      const marketState = userMarketsState[marketId];
      const price = userMarketPrices[marketId] || 0;

      if (!marketState) {
        return {
          symbol: market.symbol,
          tokenAmount: 0,
          price: 0,
          usdValue: 0,
          depositedBase: BigInt(0),
          decimals: market.decimals || 6,
          status: "No Data",
        };
      }

      const tokenAmount = fromBase(
        marketState.depositedBase,
        market.decimals || 6
      );
      const usdValue = tokenAmount * price;

      return {
        symbol: market.symbol,
        tokenAmount,
        price,
        usdValue,
        depositedBase: marketState.depositedBase,
        decimals: market.decimals || 6,
        status: usdValue > 0 ? "Active" : "No Deposits",
      };
    });
  }, [userMarketsState, userMarketPrices, currentNetwork]);

  // Method 2: Use totalCollateralValue from GlobalUserData
  const userGlobalDepositedFromContract = useMemo(() => {
    return userGlobalData?.totalCollateralValue || 0;
  }, [userGlobalData]);

  // Method 2 Breakdown - Show contract data details for each pool
  const method2Breakdown = useMemo(() => {
    if (!userGlobalData) {
      return {
        totalCollateralValue: 0,
        totalBorrowValue: 0,
        lastUpdateTime: 0,
        scalingFactor: "1e18",
        rawCollateralValue: "0",
        rawBorrowValue: "0",
        status: "No Data",
        pools: [],
      };
    }

    // Get lending pools for current network
    const lendingPools = getLendingPools(currentNetwork);
    const markets = getMarketsFromConfig(currentNetwork);

    // Group markets by pool
    const poolsData = lendingPools.map((poolId, index) => {
      const classLabel = String.fromCharCode(65 + index); // A, B, C, etc.
      const poolMarkets = markets.filter((market) => market.poolId === poolId);

      return {
        poolId,
        classLabel,
        markets: poolMarkets,
        totalCollateralValue: 0, // Will be calculated from individual markets
        totalBorrowValue: 0, // Will be calculated from individual markets
        status: "No Data",
      };
    });

    // Ensure we're working with numbers to prevent string concatenation
    const collateralValue = Number(userGlobalData.totalCollateralValue) || 0;
    const borrowValue = Number(userGlobalData.totalBorrowValue) || 0;

    return {
      totalCollateralValue: collateralValue,
      totalBorrowValue: borrowValue,
      lastUpdateTime: userGlobalData.lastUpdateTime,
      scalingFactor: "1e18",
      rawCollateralValue: (collateralValue * 1e18).toString(),
      rawBorrowValue: (borrowValue * 1e18).toString(),
      status: "Active",
      pools: poolsData,
    };
  }, [userGlobalData, currentNetwork]);

  // Method 3: Sum user market data (deposits + borrows from market state)
  const userGlobalMarketData = useMemo(() => {
    let totalDeposits = 0;
    let totalBorrows = 0;
    const debugInfo: Array<{
      symbol: string;
      depositedAmount: number;
      borrowedAmount: number;
      depositPrice: number;
      borrowPrice: number;
      depositUSD: number;
      borrowUSD: number;
      netPosition: number;
    }> = [];

    // Get markets from configuration
    const markets = getMarketsFromConfig(currentNetwork);

    for (const market of markets) {
      const marketId = market.symbol.toLowerCase();
      const marketState = userMarketsState[marketId];
      const price = userMarketPrices[marketId] || 0;

      if (!marketState) continue;

      // Calculate deposited amount and USD value
      const depositedAmount = fromBase(
        marketState.depositedBase,
        market.decimals || 6
      );
      const depositUSD = depositedAmount * price;

      // For borrows, we need to check if there's borrow data in marketState
      // This might need to be fetched separately or calculated differently
      const borrowedAmount = 0; // Placeholder - need to determine how borrows are stored
      const borrowUSD = borrowedAmount * price;

      totalDeposits += depositUSD;
      totalBorrows += borrowUSD;

      debugInfo.push({
        symbol: market.symbol,
        depositedAmount,
        borrowedAmount,
        depositPrice: price,
        borrowPrice: price,
        depositUSD,
        borrowUSD,
        netPosition: depositUSD - borrowUSD,
      });
    }

    // Debug logging
    if (debugInfo.length > 0) {
      console.log("📊 Method 3 (Market Data Sum) calculation:", {
        totalDeposits,
        totalBorrows,
        netPosition: totalDeposits - totalBorrows,
        breakdown: debugInfo,
        marketsCount: markets.length,
        activeMarkets: debugInfo.filter(
          (m) => m.depositUSD > 0 || m.borrowUSD > 0
        ).length,
      });
    }

    return {
      totalDeposits,
      totalBorrows,
      netPosition: totalDeposits - totalBorrows,
    };
  }, [userMarketsState, userMarketPrices, currentNetwork]);

  // Method 3 Breakdown - Show detailed market data
  const method3Breakdown = useMemo(() => {
    const markets = getMarketsFromConfig(currentNetwork);
    return markets.map((market) => {
      const marketId = market.symbol.toLowerCase();
      const marketState = userMarketsState[marketId];
      const price = userMarketPrices[marketId] || 0;

      if (!marketState) {
        return {
          symbol: market.symbol,
          depositedAmount: 0,
          borrowedAmount: 0,
          depositPrice: 0,
          borrowPrice: 0,
          depositUSD: 0,
          borrowUSD: 0,
          netPosition: 0,
          decimals: market.decimals || 6,
          status: "No Data",
        };
      }

      const depositedAmount = fromBase(
        marketState.depositedBase,
        market.decimals || 6
      );
      const depositUSD = depositedAmount * price;

      // Placeholder for borrows - this needs to be implemented based on actual borrow data structure
      const borrowedAmount = 0;
      const borrowUSD = borrowedAmount * price;
      const netPosition = depositUSD - borrowUSD;

      return {
        symbol: market.symbol,
        depositedAmount,
        borrowedAmount,
        depositPrice: price,
        borrowPrice: price,
        depositUSD,
        borrowUSD,
        netPosition,
        decimals: market.decimals || 6,
        status: netPosition !== 0 ? "Active" : "No Position",
      };
    });
  }, [userMarketsState, userMarketPrices, currentNetwork]);

  // Method 4: Use get_user method to fetch individual user position data for each market
  const userGlobalFromGetUser = useMemo(() => {
    let totalDeposits = 0;
    let totalBorrows = 0;
    const debugInfo: Array<{
      symbol: string;
      marketId: string;
      scaledDeposits: string;
      scaledBorrows: string;
      currentDepositIndex: string;
      currentBorrowIndex: string;
      actualDeposits: number;
      actualBorrows: number;
      currentPrice: number;
      depositUSD: number;
      borrowUSD: number;
      netPosition: number;
    }> = [];

    const markets = getMarketsFromConfig(currentNetwork);
    const SCALE = 1e18; // Precision scaling factor

    for (const market of markets) {
      const marketId = market.symbol.toLowerCase();
      const contractId = market.underlyingContractId;

      // Try to get data using both token symbol and contract ID
      let getUserData =
        userGetUserData[marketId] || userGetUserData[contractId];
      const currentPrice = userMarketPrices[marketId] || 0;

      console.log(
        `🔍 Method 4 Calculation - Looking for data for ${market.symbol}:`,
        {
          marketId,
          contractId,
          hasGetUserDataBySymbol: !!userGetUserData[marketId],
          hasGetUserDataByContractId: !!userGetUserData[contractId],
          hasGetUserData: !!getUserData,
          getUserDataKeys: Object.keys(userGetUserData),
          currentPrice,
        }
      );

      if (getUserData) {
        console.log(`🔍 Processing getUserData for ${market.symbol}:`, {
          getUserData,
          marketId,
        });

        const scaledDeposits = Number(getUserData.scaled_deposits || "0");
        const scaledBorrows = Number(getUserData.scaled_borrows || "0");
        // Use CURRENT market indices, not user's stored indices
        const currentDepositIndex =
          getUserData.current_deposit_index || "1000000000000000000"; // 1e18
        const currentBorrowIndex =
          getUserData.current_borrow_index || "1000000000000000000"; // 1e18
        const currentPrice =
          parseFloat(getUserData.current_price || "0") / SCALE;
        const lastPrice = parseFloat(getUserData.last_price || "0") / SCALE;

        console.log(`🔍 Raw values for ${market.symbol}:`, {
          scaledDeposits,
          scaledBorrows,
          currentDepositIndex,
          currentBorrowIndex,
          currentPrice,
          lastPrice,
          marketDecimals: market.decimals,
        });

        // Calculate actual amounts using the formula from the documentation:
        // actual_deposits = (scaled_deposits * current_deposit_index) // SCALE
        // actual_borrows = (scaled_borrows * current_borrow_index) // SCALE
        const actualDepositsRaw =
          (BigInt(scaledDeposits) * BigInt(currentDepositIndex)) /
          BigInt(SCALE);

        // Handle case where borrow_index is 0 (no borrows yet)
        const actualBorrowsRaw =
          BigInt(currentBorrowIndex) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(currentBorrowIndex)) /
              BigInt(SCALE);

        console.log(`🔍 BigInt calculations for ${market.symbol}:`, {
          actualDepositsRaw: actualDepositsRaw.toString(),
          actualBorrowsRaw: actualBorrowsRaw.toString(),
          SCALE,
          tokenDecimals: market.decimals || 0,
        });

        // Convert to numbers - the contract already returns amounts in correct units
        // No need to apply decimal normalization as get_user returns the actual token amounts
        const actualDepositsNum =
          Number(actualDepositsRaw) / 10 ** (market.decimals || 0);
        const actualBorrowsNum = Number(actualBorrowsRaw);

        console.log(`🔍 Converted amounts for ${market.symbol}:`, {
          actualDepositsNum,
          actualBorrowsNum,
          decimalsUsed: market.decimals || 6,
        });

        // Use last_price from contract if available, otherwise use current market price
        const priceToUse = lastPrice > 0 ? lastPrice : currentPrice;
        const depositUSD = actualDepositsNum * priceToUse;
        const borrowUSD = actualBorrowsNum * priceToUse;

        console.log(`🔍 USD calculations for ${market.symbol}:`, {
          priceToUse,
          depositUSD,
          borrowUSD,
        });

        totalDeposits += depositUSD / 1e6;
        totalBorrows += borrowUSD / 1e6;

        debugInfo.push({
          symbol: market.symbol,
          marketId: market.underlyingContractId || market.symbol,
          scaledDeposits: scaledDeposits.toString(),
          scaledBorrows: scaledBorrows.toString(),
          currentDepositIndex,
          currentBorrowIndex,
          actualDeposits: actualDepositsNum,
          actualBorrows: actualBorrowsNum,
          currentPrice: priceToUse,
          depositUSD,
          borrowUSD,
          netPosition: depositUSD - borrowUSD,
        });
      } else {
        // No data available for this market
        debugInfo.push({
          symbol: market.symbol,
          marketId: market.underlyingContractId || market.symbol,
          scaledDeposits: "0",
          scaledBorrows: "0",
          currentDepositIndex: "1000000000000000000",
          currentBorrowIndex: "1000000000000000000",
          actualDeposits: 0,
          actualBorrows: 0,
          currentPrice: currentPrice,
          depositUSD: 0,
          borrowUSD: 0,
          netPosition: 0,
        });
      }
    }

    // Debug logging
    if (debugInfo.length > 0) {
      console.log("📊 Method 4 (get_user) calculation:", {
        totalDeposits,
        totalBorrows,
        netPosition: totalDeposits - totalBorrows,
        breakdown: debugInfo,
        marketsCount: markets.length,
        activeMarkets: debugInfo.filter(
          (m) => m.depositUSD > 0 || m.borrowUSD > 0
        ).length,
        userGetUserData,
      });
    }

    return {
      totalDeposits,
      totalBorrows,
      netPosition: totalDeposits - totalBorrows,
    };
  }, [userGetUserData, userMarketPrices, currentNetwork]);

  // Method 4 Breakdown - Show detailed get_user data
  const method4Breakdown = useMemo(() => {
    const markets = getMarketsFromConfig(currentNetwork);
    const SCALE = 1e18; // Precision scaling factor

    return markets.map((market) => {
      const marketId = market.symbol.toLowerCase();
      const contractId = market.underlyingContractId;

      // Try to get data using both token symbol and contract ID
      let getUserData =
        userGetUserData[marketId] || userGetUserData[contractId];
      const currentPrice = userMarketPrices[marketId] || 0;

      console.log(
        `🔍 Method 4 Breakdown - Looking for data for ${market.symbol}:`,
        {
          marketId,
          contractId,
          hasGetUserDataBySymbol: !!userGetUserData[marketId],
          hasGetUserDataByContractId: !!userGetUserData[contractId],
          hasGetUserData: !!getUserData,
          getUserDataKeys: Object.keys(userGetUserData),
          currentPrice,
        }
      );

      if (getUserData) {
        const scaledDeposits = getUserData.scaled_deposits || "0";
        const scaledBorrows = getUserData.scaled_borrows || "0";
        const depositIndex = getUserData.deposit_index || "1000000000000000000"; // 1e18
        const borrowIndex = getUserData.borrow_index || "1000000000000000000"; // 1e18
        const lastPrice = parseFloat(getUserData.last_price || "0") / SCALE;
        const lastUpdateTime = getUserData.last_update_time || 0;

        // Calculate actual amounts using the formula from the documentation:
        // actual_deposits = (scaled_deposits * current_deposit_index) // SCALE
        // actual_borrows = (scaled_borrows * current_borrow_index) // SCALE
        const actualDepositsRaw =
          (BigInt(scaledDeposits) * BigInt(depositIndex)) / BigInt(SCALE);

        // Handle case where borrow_index is 0 (no borrows yet)
        const actualBorrowsRaw =
          BigInt(borrowIndex) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(borrowIndex)) / BigInt(SCALE);

        // Convert to numbers - the contract already returns amounts in correct units
        // No need to apply decimal normalization as get_user returns the actual token amounts
        const actualDepositsNum =
          Number(actualDepositsRaw) / 10 ** (market.decimals || 0);
        const actualBorrowsNum =
          Number(actualBorrowsRaw) / 10 ** (market.decimals || 0);

        // Use current market price for accurate USD calculations
        const priceToUse =
          currentPrice > 0
            ? currentPrice
            : lastPrice > 0
            ? lastPrice
            : currentPrice;
        const depositUSD = actualDepositsNum * priceToUse;
        const borrowUSD = actualBorrowsNum * priceToUse;
        const netPosition = depositUSD - borrowUSD;

        return {
          symbol: market.symbol,
          marketId: market.underlyingContractId || market.symbol,
          scaledDeposits: Number(scaledDeposits) / 10 ** (market.decimals || 0),
          scaledBorrows: Number(scaledBorrows) / 10 ** (market.decimals || 0),
          depositIndex,
          borrowIndex,
          actualDeposits: actualDepositsNum,
          actualBorrows: actualBorrowsNum,
          lastPrice: priceToUse,
          lastUpdateTime,
          depositUSD,
          borrowUSD,
          netPosition,
          status: netPosition !== 0 ? "Active" : "No Position",
        };
      } else {
        // No data available for this market
        return {
          symbol: market.symbol,
          marketId: market.underlyingContractId || market.symbol,
          scaledDeposits: "0",
          scaledBorrows: "0",
          depositIndex: "1000000000000000000",
          borrowIndex: "1000000000000000000",
          actualDeposits: 0,
          actualBorrows: 0,
          lastPrice: currentPrice,
          lastUpdateTime: 0,
          depositUSD: 0,
          borrowUSD: 0,
          netPosition: 0,
          status: "No Data",
        };
      }
    });
  }, [userGetUserData, userMarketPrices, currentNetwork]);

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
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
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
            <TabsTrigger
              value="user-analysis"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">User Analysis</span>
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
                                  const tokens =
                                    getAllTokensWithDisplayInfo(currentNetwork);
                                  const token = tokens.find(
                                    (t) =>
                                      t.symbol.toLowerCase() ===
                                      market.asset?.toLowerCase()
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
                                  const tokens =
                                    getAllTokensWithDisplayInfo(currentNetwork);
                                  const token = tokens.find(
                                    (t) =>
                                      t.symbol.toLowerCase() ===
                                      market.asset?.toLowerCase()
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

          {/* User Analysis Tab */}
          <TabsContent value="user-analysis" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>User Analysis</H2>
              <div className="flex items-center gap-2">
                <DorkFiButton
                  variant="secondary"
                  onClick={() => {
                    setUserAnalysisAddress("");
                    setUserGlobalData(null);
                    setUserMarketsState({});
                    setUserMarketPrices({});
                    setGlobalDataError(null);
                    setEnvoiData(null);
                    setEnvoiError(null);
                    setEnvoiSearchQuery("");
                    setEnvoiSearchResults([]);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </DorkFiButton>
              </div>
            </div>

            {/* User Address Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Analyze User
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="user-address">User Address</Label>
                    <Input
                      id="user-address"
                      placeholder="Enter user address to analyze..."
                      value={userAnalysisAddress}
                      onChange={(e) =>
                        setUserAnalysisAddress(e.target.value || "")
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <DorkFiButton
                      onClick={handleAnalyzeUser}
                      disabled={
                        globalDataLoading || !userAnalysisAddress?.trim()
                      }
                    >
                      {globalDataLoading ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Calculator className="h-4 w-4 mr-2" />
                          Analyze
                        </>
                      )}
                    </DorkFiButton>
                  </div>
                </div>

                {/* Envoi Name Search */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-4 w-4 text-blue-500" />
                    <Label className="text-sm font-medium">
                      Envoi Name Search
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      enVoi Naming Service
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Search for VOI names (e.g., en.voi, test.voi)..."
                        value={envoiSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value || "";
                          setEnvoiSearchQuery(value);
                          if (value.trim()) {
                            handleEnvoiSearch(value);
                          } else {
                            setEnvoiSearchResults([]);
                          }
                        }}
                        className="pr-8"
                      />
                      {envoiSearchLoading && (
                        <RefreshCcw className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}

                      {/* Search Results Dropdown */}
                      {envoiSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {envoiSearchResults.map((result, index) => (
                            <button
                              key={index}
                              className="w-full px-3 py-2 text-left hover:bg-muted/50 border-b border-border last:border-b-0"
                              onClick={() => {
                                console.log(
                                  "🖱️ Button clicked for result:",
                                  result
                                );
                                handleEnvoiNameSelect(result.name);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-sm">
                                    {result.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono truncate">
                                    {result.address}
                                  </div>
                                </div>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Search for VOI names to automatically resolve addresses.
                    Powered by enVoi Naming Service.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* User Analysis Results */}
            {userGlobalData && (
              <div className="space-y-6">
                {/* Method Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Method Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-sm dark-glow-card">
                      <div className="rounded-xl border border-orange-500/30 bg-slate-800/60 p-2">
                        <Calculator className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-300">
                          Total Deposits Comparison
                        </div>
                        <div className="text-xs text-slate-400">
                          Method 1 (Sum): $
                          {userGlobalDeposited.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          Method 2 (Contract): $
                          {userGlobalDepositedFromContract.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          Method 3 (Market Data): $
                          {userGlobalMarketData.totalDeposits.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          Method 4 (get_user): $
                          {userGlobalFromGetUser.totalDeposits.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Diff: $
                          {Math.abs(
                            userGlobalDeposited -
                              userGlobalDepositedFromContract
                          ).toLocaleString()}
                          (
                          {userGlobalDeposited > 0
                            ? (
                                (Math.abs(
                                  userGlobalDeposited -
                                    userGlobalDepositedFromContract
                                ) /
                                  userGlobalDeposited) *
                                100
                              ).toFixed(2)
                            : "0"}
                          %)
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Last Updated:{" "}
                          {new Date(
                            userGlobalData.lastUpdateTime * 1000
                          ).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <DorkFiButton
                          onClick={async () => {
                            if (!userAnalysisAddress) return;
                            await Promise.all([
                              fetchUserGlobalData(userAnalysisAddress),
                              fetchUserMarketData(userAnalysisAddress),
                            ]);
                          }}
                          disabled={globalDataLoading}
                          variant="secondary"
                          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                        >
                          {globalDataLoading ? (
                            <>
                              <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                              Loading
                            </>
                          ) : (
                            <>
                              <Activity className="h-3 w-3 mr-1" />
                              Refresh Both Methods
                            </>
                          )}
                        </DorkFiButton>
                        {globalDataError && (
                          <div
                            className="text-xs text-red-400 max-w-24 truncate"
                            title={globalDataError}
                          >
                            Error: {globalDataError}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Method 1 User Deposit Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Method 1: User Deposit Breakdown
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Individual market deposits contributing to the total
                      collateral value
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-400">
                            {method1Breakdown.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Markets
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {
                              method1Breakdown.filter(
                                (m) => m.status === "Active"
                              ).length
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Active Deposits
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            ${userGlobalDeposited.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Value
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">
                            {
                              method1Breakdown.filter(
                                (m) => m.status === "No Data"
                              ).length
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            No Data
                          </div>
                        </div>
                      </div>

                      {/* Market Breakdown Table */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Market Details
                        </h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {method1Breakdown.map((market, index) => (
                            <div
                              key={market.symbol}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                market.status === "Active"
                                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                                  : market.status === "No Deposits"
                                  ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/20"
                                  : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    market.status === "Active"
                                      ? "bg-green-500"
                                      : market.status === "No Deposits"
                                      ? "bg-gray-400"
                                      : "bg-red-500"
                                  }`}
                                />
                                <div>
                                  <div className="font-medium text-sm">
                                    {market.symbol}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {market.status}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right space-y-1">
                                <div className="text-sm font-medium">
                                  ${market.usdValue.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {market.tokenAmount.toLocaleString()} tokens (
                                  {market.decimals} decimals)
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  @ ${market.price.toFixed(6)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Raw Data Display */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                          Show Raw Data (Base Units)
                        </summary>
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                          <div className="space-y-2 text-xs font-mono">
                            {method1Breakdown.map((market) => (
                              <div
                                key={market.symbol}
                                className="flex justify-between"
                              >
                                <span className="text-muted-foreground">
                                  {market.symbol} ({market.decimals} decimals):
                                </span>
                                <span>
                                  {market.depositedBase.toString()} base units
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </Card>

                {/* Method 2 Contract Data Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Method 2: Contract Global Data Breakdown
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Global user data from the smart contract's global state
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Contract Data Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            $
                            {method2Breakdown.totalCollateralValue.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Collateral
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">
                            $
                            {method2Breakdown.totalBorrowValue.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Borrows
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {method2Breakdown.scalingFactor}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Scaling Factor
                          </div>
                        </div>
                        <div className="text-center">
                          <div
                            className={`text-2xl font-bold ${
                              method2Breakdown.status === "Active"
                                ? "text-green-400"
                                : "text-gray-400"
                            }`}
                          >
                            {method2Breakdown.status}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Status
                          </div>
                        </div>
                      </div>

                      {/* Pool-by-Pool Breakdown */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Pool-by-Pool Breakdown
                        </h4>

                        <div className="space-y-3">
                          {method2Breakdown.pools.map((pool) => (
                            <div
                              key={pool.poolId}
                              className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                                  <h5 className="font-medium text-sm">
                                    {pool.classLabel} Pool ({pool.poolId})
                                  </h5>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {pool.markets.length} markets
                                </Badge>
                              </div>

                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">
                                  Markets in this pool:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {pool.markets.map((market) => (
                                    <Badge
                                      key={market.symbol}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {market.symbol}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                  Note: This pool contributes to the global
                                  collateral value shown above. Individual pool
                                  breakdowns would require additional contract
                                  calls.
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Global Contract Data Summary */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Global Contract Data
                        </h4>

                        <div
                          className={`p-4 rounded-lg border ${
                            method2Breakdown.status === "Active"
                              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                              : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/20"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Total Collateral Value (USD)
                              </span>
                              <span className="text-sm font-mono">
                                $
                                {method2Breakdown.totalCollateralValue.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Total Borrow Value (USD)
                              </span>
                              <span className="text-sm font-mono">
                                $
                                {method2Breakdown.totalBorrowValue.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Last Updated
                              </span>
                              <span className="text-sm font-mono">
                                {method2Breakdown.lastUpdateTime > 0
                                  ? new Date(
                                      method2Breakdown.lastUpdateTime * 1000
                                    ).toLocaleString()
                                  : "Never"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Health Factor
                              </span>
                              <span className="text-sm font-mono">
                                {method2Breakdown.totalBorrowValue > 0
                                  ? (
                                      method2Breakdown.totalCollateralValue /
                                      method2Breakdown.totalBorrowValue
                                    ).toFixed(2)
                                  : "∞"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Raw Contract Data */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                          Show Raw Contract Data (Base Units)
                        </summary>
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Raw Collateral Value:
                              </span>
                              <span>
                                {method2Breakdown.rawCollateralValue} base units
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Raw Borrow Value:
                              </span>
                              <span>
                                {method2Breakdown.rawBorrowValue} base units
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Scaling Factor:
                              </span>
                              <span>{method2Breakdown.scalingFactor}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Calculation:
                              </span>
                              <span>
                                rawValue / {method2Breakdown.scalingFactor} =
                                USD
                              </span>
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Method 2 Explanation */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Method 2: Contract Global Data
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                              This method uses the smart contract's global user
                              data, which aggregates all user positions across
                              all markets into a single collateral and borrow
                              value. The contract stores these values scaled by
                              10^18, so we divide by 1e18 to get the USD
                              equivalent.
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              <strong>Formula:</strong> totalCollateralValue =
                              contract_value / 1e18
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Method 3 Market Data Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Method 3: Market Data Breakdown
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Detailed breakdown of deposits and borrows from market
                      state data
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-400">
                            {method3Breakdown.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Markets
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {
                              method3Breakdown.filter(
                                (m) => m.status === "Active"
                              ).length
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Active Positions
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            $
                            {userGlobalMarketData.totalDeposits.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Deposits
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">
                            $
                            {userGlobalMarketData.totalBorrows.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Borrows
                          </div>
                        </div>
                      </div>

                      {/* Net Position Summary */}
                      <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-300">
                              Net Position
                            </div>
                            <div className="text-xs text-slate-400">
                              Total Deposits - Total Borrows
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-2xl font-bold ${
                                userGlobalMarketData.netPosition >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              $
                              {userGlobalMarketData.netPosition.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400">
                              {userGlobalMarketData.netPosition >= 0
                                ? "Positive"
                                : "Negative"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Market Details Table */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Market Details</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left p-2">Market</th>
                                <th className="text-right p-2">Deposited</th>
                                <th className="text-right p-2">Borrowed</th>
                                <th className="text-right p-2">Deposit USD</th>
                                <th className="text-right p-2">Borrow USD</th>
                                <th className="text-right p-2">Net Position</th>
                                <th className="text-center p-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {method3Breakdown.map((market) => (
                                <tr
                                  key={market.symbol}
                                  className="border-b border-slate-800"
                                >
                                  <td className="p-2 font-medium">
                                    {market.symbol}
                                  </td>
                                  <td className="text-right p-2">
                                    {market.depositedAmount.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 6,
                                      }
                                    )}
                                  </td>
                                  <td className="text-right p-2">
                                    {market.borrowedAmount.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 6,
                                      }
                                    )}
                                  </td>
                                  <td className="text-right p-2">
                                    $
                                    {market.depositUSD.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </td>
                                  <td className="text-right p-2">
                                    $
                                    {market.borrowUSD.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </td>
                                  <td
                                    className={`text-right p-2 font-medium ${
                                      market.netPosition >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    $
                                    {market.netPosition.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </td>
                                  <td className="text-center p-2">
                                    <Badge
                                      variant={
                                        market.status === "Active"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {market.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Method 3 Explanation */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Calculator className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                              Method 3: Market Data Sum
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              This method calculates the total user position by
                              summing individual market data from the user's
                              market state. It includes both deposits and
                              borrows for each market, providing a comprehensive
                              view of the user's net position across all
                              markets.
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              <strong>Formula:</strong> Net Position =
                              Σ(Deposits × Price) - Σ(Borrows × Price)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Method 4 get_user Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Method 4: get_user Breakdown
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Individual user position data fetched using the get_user
                      contract method
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-400">
                            {method4Breakdown.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Markets
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {
                              method4Breakdown.filter(
                                (m) => m.status === "Active"
                              ).length
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Active Positions
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            $
                            {userGlobalFromGetUser.totalDeposits.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Deposits
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">
                            $
                            {userGlobalFromGetUser.totalBorrows.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Borrows
                          </div>
                        </div>
                      </div>

                      {/* Net Position Summary */}
                      <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-300">
                              Net Position (get_user)
                            </div>
                            <div className="text-xs text-slate-400">
                              Total Deposits - Total Borrows
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-2xl font-bold ${
                                userGlobalFromGetUser.netPosition >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              $
                              {userGlobalFromGetUser.netPosition.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400">
                              {userGlobalFromGetUser.netPosition >= 0
                                ? "Positive"
                                : "Negative"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Market Details Table */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                          Market Details (get_user)
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left p-2">Market</th>
                                <th className="text-right p-2">
                                  Scaled Deposits
                                </th>
                                <th className="text-right p-2">
                                  Scaled Borrows
                                </th>
                                <th className="text-right p-2">
                                  Deposit Index
                                </th>
                                <th className="text-right p-2">Borrow Index</th>
                                <th className="text-right p-2">
                                  Actual Deposits
                                </th>
                                <th className="text-right p-2">
                                  Actual Borrows
                                </th>
                                <th className="text-right p-2">Last Price</th>
                                <th className="text-right p-2">Net Position</th>
                                <th className="text-center p-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {method4Breakdown.map((market) => (
                                <tr
                                  key={market.symbol}
                                  className="border-b border-slate-800"
                                >
                                  <td className="p-2 font-medium">
                                    {market.symbol}
                                  </td>
                                  <td className="text-right p-2 text-xs">
                                    {market.scaledDeposits}
                                  </td>
                                  <td className="text-right p-2 text-xs">
                                    {market.scaledBorrows}
                                  </td>
                                  <td className="text-right p-2 text-xs">
                                    {market.depositIndex}
                                  </td>
                                  <td className="text-right p-2 text-xs">
                                    {market.borrowIndex}
                                  </td>
                                  <td className="text-right p-2">
                                    {market.actualDeposits.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 6,
                                      }
                                    )}
                                  </td>
                                  <td className="text-right p-2">
                                    {market.actualBorrows.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 6,
                                      }
                                    )}
                                  </td>
                                  <td className="text-right p-2">
                                    $
                                    {market.lastPrice.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 6,
                                      }
                                    )}
                                  </td>
                                  <td
                                    className={`text-right p-2 font-medium ${
                                      market.netPosition >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    $
                                    {market.netPosition.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </td>
                                  <td className="text-center p-2">
                                    <Badge
                                      variant={
                                        market.status === "Active"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {market.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Method 4 Explanation */}
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200">
                              Method 4: get_user Contract Method
                            </h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                              This method uses the smart contract's get_user
                              method to fetch individual user position data for
                              each market. It returns scaled deposits and
                              borrows along with their respective indices,
                              allowing for precise calculation of actual amounts
                              including accrued interest.
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                              <strong>Formula:</strong> actual_deposits =
                              (scaled_deposits × current_deposit_index) ÷ SCALE
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                              <strong>Note:</strong> This is currently a
                              placeholder implementation. Real implementation
                              would require contract calls to get_user for each
                              market.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Envoi Data Display */}
                {(envoiData || envoiLoading || envoiError) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Hash className="h-5 w-5 text-blue-500" />
                        Envoi Name Service
                        <Badge variant="outline" className="text-xs">
                          enVoi
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {envoiLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                          Loading Envoi data...
                        </div>
                      ) : envoiError ? (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          Error loading Envoi data: {envoiError}
                        </div>
                      ) : envoiData ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 p-4 shadow-sm">
                            <div className="rounded-xl border border-blue-500/30 bg-blue-100/60 dark:bg-blue-900/60 p-2">
                              <Hash className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                VOI Name Found
                              </div>
                              <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                {envoiData.name}
                              </div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                Token ID: {envoiData.tokenId}
                              </div>
                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                Owner: {envoiData.owner}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <DorkFiButton
                                onClick={() =>
                                  fetchEnvoiData(userAnalysisAddress)
                                }
                                disabled={envoiLoading}
                                variant="secondary"
                                className="border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                              >
                                {envoiLoading ? (
                                  <>
                                    <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                                    Loading
                                  </>
                                ) : (
                                  <>
                                    <RefreshCcw className="h-3 w-3 mr-1" />
                                    Refresh
                                  </>
                                )}
                              </DorkFiButton>
                            </div>
                          </div>

                          {envoiData.metadata && (
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                Metadata
                              </h4>
                              {envoiData.metadata.description && (
                                <div className="text-sm mb-2">
                                  <span className="font-medium">
                                    Description:
                                  </span>{" "}
                                  {envoiData.metadata.description}
                                </div>
                              )}
                              {envoiData.metadata.image && (
                                <div className="text-sm mb-2">
                                  <span className="font-medium">Image:</span>
                                  <a
                                    href={envoiData.metadata.image}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-600 hover:underline"
                                  >
                                    View Image
                                  </a>
                                </div>
                              )}
                              {envoiData.metadata.attributes &&
                                envoiData.metadata.attributes.length > 0 && (
                                  <div className="text-sm">
                                    <span className="font-medium">
                                      Attributes:
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {envoiData.metadata.attributes.map(
                                        (attr, index) => (
                                          <Badge
                                            key={index}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {attr.trait_type}: {attr.value}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">
                            No VOI name found for this address
                          </p>
                          <p className="text-xs">
                            This address doesn't have an associated enVoi name
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* User Global Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Total Collateral Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ${userGlobalData.totalCollateralValue.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total value of all user deposits across all markets
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Total Borrow Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        ${userGlobalData.totalBorrowValue.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total value of all user borrows across all markets
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* User Address Display */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      User Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Address</Label>
                        <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                          {userAnalysisAddress}
                        </p>
                      </div>
                      {envoiData && (
                        <div>
                          <Label className="text-sm font-medium">
                            VOI Name
                          </Label>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {envoiData.name}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              enVoi
                            </Badge>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-sm font-medium">Network</Label>
                        <p className="text-sm">{currentNetwork}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">
                          Last Updated
                        </Label>
                        <p className="text-sm">
                          {new Date(
                            userGlobalData.lastUpdateTime * 1000
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Error State */}
            {globalDataError && !userGlobalData && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-red-600">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-medium">Error Loading User Data</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {globalDataError}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!userGlobalData && !globalDataError && !globalDataLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-medium">No User Selected</p>
                    <p className="text-sm mt-1">
                      Enter a user address above to analyze their deposit data
                      and compare calculation methods.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
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
                  <div>
                    <p className="text-muted-foreground">Pool ID</p>
                    <p className="font-medium">{marketViewData.poolId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Token Contract ID</p>
                    <p className="font-medium">
                      {marketViewData.tokenContractId}
                    </p>
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
                          (parseFloat(marketViewData.price) /
                            Math.pow(10, marketViewData.decimals || 6));
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
                          (parseFloat(marketViewData.price) /
                            Math.pow(10, marketViewData.decimals || 6));
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
                      $
                      {(
                        parseFloat(marketViewData.price) / Math.pow(10, 6)
                      ).toFixed(6)}
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
                          (parseFloat(marketViewData.price) / Math.pow(10, 6));
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
            <DialogTitle className="text-xl">
              Update Market Max Deposits
            </DialogTitle>
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
            <Button onClick={handleUpdateMaxDeposits}>
              Update Max Deposits
            </Button>
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
