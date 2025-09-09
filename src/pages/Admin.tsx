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
} from "@/config";
import {
  fetchPausedState,
  fetchSystemHealth,
  fetchAdminStats,
  togglePauseState,
  formatPauseDuration,
  type PausedState,
  type SystemHealth,
} from "@/services/adminService";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk, { waitForConfirmation } from "algosdk";
import { initializeAlgorandForCurrentNetwork } from "@/services/algorandExamples";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";

// Get markets from configuration
const getMarketsFromConfig = () => {
  const networkConfig = getCurrentNetworkConfig();
  const tokens = getAllTokens(networkConfig.networkId);

  return tokens.map((token) => ({
    id: token.symbol.toLowerCase(),
    name: token.name,
    symbol: token.symbol,
    status: "active" as const,
    totalDeposits: Math.floor(Math.random() * 1000000) + 50000, // Mock data
    users: Math.floor(Math.random() * 500) + 50, // Mock data
  }));
};

const mockMarkets = getMarketsFromConfig();

// Mock data for admin dashboard
const mockStats = {
  totalMarkets: mockMarkets.length,
  activeUsers: 1247,
  totalVolume: 2450000,
  systemHealth: 98.5,
  pendingOperations: 3,
  lastUpdate: new Date().toISOString(),
};

const mockOperations = [
  {
    id: 1,
    type: "market_creation",
    status: "pending",
    description: "Create new POW market",
    timestamp: "2025-01-27T10:30:00Z",
  },
  {
    id: 2,
    type: "parameter_update",
    status: "pending",
    description: "Update VOI minimum deposit",
    timestamp: "2025-01-27T09:15:00Z",
  },
  {
    id: 3,
    type: "emergency_pause",
    status: "pending",
    description: "Emergency pause for maintenance",
    timestamp: "2025-01-27T08:45:00Z",
  },
];

export default function AdminDashboard() {
  const { activeAccount, signTransactions } = useWallet();
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateMarketModalOpen, setIsCreateMarketModalOpen] = useState(false);
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

  // Create market form state
  const [newMarket, setNewMarket] = useState({
    name: "",
    symbol: "",
    minDeposit: "",
    tokenStandard: "native",
    assetId: "",
    contractAddress: "",
    decimals: "6",
    description: "",
  });

  const handleCreateMarket = () => {
    console.log("Creating market:", newMarket);
    // TODO: Implement actual market creation logic
    setIsCreateMarketModalOpen(false);
    setNewMarket({
      name: "",
      symbol: "",
      minDeposit: "",
      tokenStandard: "native",
      assetId: "",
      contractAddress: "",
      decimals: "6",
      description: "",
    });
  };

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
              <WalletNetworkButton />
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
              {mockMarkets.map((market) => (
                <Card
                  key={market.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{market.name}</CardTitle>
                      <Badge
                        variant={
                          market.status === "active" ? "default" : "secondary"
                        }
                      >
                        {market.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Deposits</p>
                        <p className="font-semibold">
                          ${market.totalDeposits.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Users</p>
                        <p className="font-semibold">{market.users}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
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
              ))}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Market</DialogTitle>
            <DialogDescription>
              Add a new token market to the PreFi platform. All fields are
              required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="market-name">Market Name</Label>
                <Input
                  id="market-name"
                  placeholder="e.g., Bitcoin"
                  value={newMarket.name}
                  onChange={(e) =>
                    setNewMarket((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="market-symbol">Symbol</Label>
                <Input
                  id="market-symbol"
                  placeholder="e.g., BTC"
                  value={newMarket.symbol}
                  onChange={(e) =>
                    setNewMarket((prev) => ({
                      ...prev,
                      symbol: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-deposit">Minimum Deposit</Label>
                <Input
                  id="min-deposit"
                  type="number"
                  placeholder="0"
                  value={newMarket.minDeposit}
                  onChange={(e) =>
                    setNewMarket((prev) => ({
                      ...prev,
                      minDeposit: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="decimals">Decimals</Label>
                <Input
                  id="decimals"
                  type="number"
                  placeholder="6"
                  value={newMarket.decimals}
                  onChange={(e) =>
                    setNewMarket((prev) => ({
                      ...prev,
                      decimals: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="token-standard">Token Standard</Label>
              <Select
                value={newMarket.tokenStandard}
                onValueChange={(value) =>
                  setNewMarket((prev) => ({ ...prev, tokenStandard: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native</SelectItem>
                  <SelectItem value="asa">ASA</SelectItem>
                  <SelectItem value="arc200">ARC-200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="asset-id">Asset ID (if applicable)</Label>
                <Input
                  id="asset-id"
                  placeholder="ASA_ID or ARC200_ID"
                  value={newMarket.assetId}
                  onChange={(e) =>
                    setNewMarket((prev) => ({
                      ...prev,
                      assetId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="contract-address">Contract Address</Label>
                <Input
                  id="contract-address"
                  placeholder="APP_ID_PREFUND"
                  value={newMarket.contractAddress}
                  onChange={(e) =>
                    setNewMarket((prev) => ({
                      ...prev,
                      contractAddress: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the market..."
                value={newMarket.description}
                onChange={(e) =>
                  setNewMarket((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateMarketModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateMarket}>
              <Save className="h-4 w-4 mr-2" />
              Create Market
            </Button>
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
    </div>
  );
}
