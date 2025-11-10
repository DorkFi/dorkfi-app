import React, { act, useState, useEffect, useCallback, useRef } from "react";
import {
  ATokenClient,
  APP_SPEC as ATokenAppSpec,
} from "@/clients/ATokenClient";
import {
  STokenClient,
  APP_SPEC as STokenAppSpec,
} from "@/clients/STokenClient";

// Import Buffer polyfill for browser environment
import "@/utils/bufferPolyfill";
import {
  Settings,
  Plus,
  BarChart3,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  RefreshCw,
  ExternalLink,
  InfoIcon,
  Coins,
  TrendingUp,
  Activity,
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
  Wrench,
  UserCheck,
  UserPlus,
  Crown,
  Key,
  Loader2,
  DollarSign,
  Database,
  Download,
} from "lucide-react";
import { Link } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CanvasBubbles from "@/components/CanvasBubbles";
import VersionDisplay from "@/components/VersionDisplay";
import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  isCurrentNetworkAlgorandCompatible,
  isCurrentNetworkEVM,
  NetworkId,
  getLendingPools,
  getAllTokensWithDisplayInfo,
  getPreFiParameters,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import { APP_SPEC as PriceOracleAppSpec } from "@/clients/PriceOracleClient";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { CONTRACT } from "ulujs";
import {
  decodeMarket,
  decodeUser,
  fetchUserBorrowBalance,
} from "@/services/lendingService";
import { useMemo } from "react";
import { toast } from "sonner";
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
  updateMarketMaxBorrows,
} from "@/services/adminService";
import {
  fetchAllMarkets,
  fetchMarketInfo,
  type MarketInfo,
} from "@/services/lendingService";
import { useOnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk, { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import envoiService, { type EnvoiNameResponse } from "@/services/envoiService";
import { fromBase } from "@/utils/calculationUtils";
import { ARC200Service } from "@/services/arc200Service";
import { TokenContractModal } from "@/components/ui/TokenContractModal";
import {
  ROLE_PRICE_ORACLE,
  ROLE_MARKET_CONTROLLER,
  ROLE_PRICE_FEED_MANAGER,
} from "@/constants/roles";

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
  const { activeAccount, signTransactions, transactionSigner } = useWallet();
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
  const markets = useMemo(
    () => getMarketsFromConfig(currentNetwork),
    [currentNetwork]
  );

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

  // Mint AToken state
  const [mintName, setMintName] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  // SToken state
  const [stokenInfo, setStokenInfo] = useState<any>(null);
  const [isLoadingStokenInfo, setIsLoadingStokenInfo] = useState(false);
  const [stokenError, setStokenError] = useState<string | null>(null);
  const [minterAddress, setMinterAddress] = useState("");
  const [isApprovingMinter, setIsApprovingMinter] = useState(false);
  const [isRevokingMinter, setIsRevokingMinter] = useState(false);
  const [minterApprovalResult, setMinterApprovalResult] = useState<
    string | null
  >(null);
  const [minterRevocationResult, setMinterRevocationResult] = useState<
    string | null
  >(null);
  const [minterApprovalError, setMinterApprovalError] = useState<string | null>(
    null
  );
  const [minterRevocationError, setMinterRevocationError] = useState<
    string | null
  >(null);
  const [approvedMinters, setApprovedMinters] = useState<string[]>([]);
  const [isSettingStoken, setIsSettingStoken] = useState(false);
  const [setStokenResult, setSetStokenResult] = useState<string | null>(null);
  const [setStokenOperationError, setSetStokenOperationError] = useState<
    string | null
  >(null);
  const [isCreatingStokenMarket, setIsCreatingStokenMarket] = useState(false);
  const [stokenMarketCreationResult, setStokenMarketCreationResult] = useState<
    string | null
  >(null);
  const [stokenMarketCreationError, setStokenMarketCreationError] = useState<
    string | null
  >(null);
  const [stokenMarketExists, setStokenMarketExists] = useState<boolean | null>(
    null
  );
  const [stokenMarketInfo, setStokenMarketInfo] = useState<any>(null);

  // Market Analysis state
  const [marketAnalysisData, setMarketAnalysisData] = useState<any>(null);
  const [isLoadingMarketAnalysis, setIsLoadingMarketAnalysis] = useState(false);
  const [marketAnalysisError, setMarketAnalysisError] = useState<string | null>(
    null
  );
  const [selectedTimeRange, setSelectedTimeRange] = useState("7d");
  const [selectedMarketForAnalysis, setSelectedMarketForAnalysis] =
    useState<string>("all");
  const marketAnalysisFetchRef = useRef<boolean>(false);

  // Individual Market View state
  const [selectedMarketDetails, setSelectedMarketDetails] = useState<any>(null);
  const [isMarketDetailsModalOpen, setIsMarketDetailsModalOpen] =
    useState(false);
  const [isLoadingMarketDetails, setIsLoadingMarketDetails] = useState(false);

  // Role management state
  interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    color: string;
    icon: string;
  }

  interface UserRole {
    userId: string;
    userAddress: string;
    userName: string;
    roleId: string;
    assignedAt: string;
    assignedBy: string;
  }

  const [roles, setRoles] = useState<Role[]>([
    {
      id: "price-oracle",
      name: "PriceOracle",
      description: "Manages price data and oracle operations for markets",
      permissions: [],
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: "database",
    },
    {
      id: "price-feed-manager",
      name: "PriceFeedManager",
      description: "Manages price feeds and data sources for the oracle",
      permissions: [],
      color:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: "trending-up",
    },
    {
      id: "market-controller",
      name: "MarketController",
      description:
        "Controls market operations, parameters, and lifecycle management",
      permissions: [],
      color:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      icon: "settings",
    },
  ]);

  // Mapping between role IDs and role constants
  const roleConstantsMap: Record<string, string> = {
    "price-oracle": ROLE_PRICE_ORACLE,
    "price-feed-manager": ROLE_PRICE_FEED_MANAGER,
    "market-controller": ROLE_MARKET_CONTROLLER,
  };

  const [userRoles, setUserRoles] = useState<UserRole[]>([
    {
      userId: "user1",
      userAddress: "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ",
      userName: "Price Oracle Admin",
      roleId: "price-oracle",
      assignedAt: "2025-01-20T10:00:00Z",
      assignedBy: "system",
    },
    {
      userId: "user2",
      userAddress:
        "ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ5678901234",
      userName: "Price Feed Manager",
      roleId: "price-feed-manager",
      assignedAt: "2025-01-22T14:30:00Z",
      assignedBy: "Price Oracle Admin",
    },
    {
      userId: "user3",
      userAddress: "DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ5678901234ABC",
      userName: "Market Controller",
      roleId: "market-controller",
      assignedAt: "2025-01-25T09:15:00Z",
      assignedBy: "Price Oracle Admin",
    },
  ]);

  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [isRevokeRoleModalOpen, setIsRevokeRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [assignAddress, setAssignAddress] = useState("");
  const [envoiName, setEnvoiName] = useState("");
  const [currentUserEnvoiName, setCurrentUserEnvoiName] = useState<
    string | null
  >(null);
  const [showEnvoiSearch, setShowEnvoiSearch] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Separate Envoi state for revoke modal
  const [revokeEnvoiName, setRevokeEnvoiName] = useState("");
  const [revokeEnvoiSearchQuery, setRevokeEnvoiSearchQuery] = useState("");
  const [revokeEnvoiSearchResults, setRevokeEnvoiSearchResults] = useState<
    any[]
  >([]);
  const [revokeEnvoiLoading, setRevokeEnvoiLoading] = useState(false);
  const [revokeEnvoiError, setRevokeEnvoiError] = useState<string | null>(null);
  const [showRevokeEnvoiSearch, setShowRevokeEnvoiSearch] = useState(false);
  const [revokeDebouncedSearchQuery, setRevokeDebouncedSearchQuery] =
    useState("");
  const [roleCheckAddress, setRoleCheckAddress] = useState("");
  const [isCheckingRoles, setIsCheckingRoles] = useState(false);
  const [currentUserRoles, setCurrentUserRoles] = useState<any[]>([]);
  const [isLoadingCurrentUserRoles, setIsLoadingCurrentUserRoles] =
    useState(false);

  // Role management functions

  // Function to check current user's roles
  const checkCurrentUserRoles = async () => {
    if (!activeAccount?.address) {
      setCurrentUserRoles([]);
      return;
    }

    setIsLoadingCurrentUserRoles(true);
    try {
      const roleChecks = await checkAllRoles(activeAccount.address);
      setCurrentUserRoles(roleChecks);
    } catch (error) {
      console.error("Error checking current user roles:", error);
      setCurrentUserRoles([]);
    } finally {
      setIsLoadingCurrentUserRoles(false);
    }
  };

  // Function to revoke a role from an address
  const revokeRole = async (address: string, roleId: string) => {
    if (!address.trim()) {
      toast.error("Please provide an address to revoke role from");
      return;
    }

    try {
      // get network clients
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      // get lending pool id from network config
      const lendingPoolId = networkConfig.contracts.lendingPools[0];
      // get lending pool contract
      const ci = new CONTRACT(
        Number(lendingPoolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );
      // get role key
      ci.setEnableRawBytes(true);
      const roleConstant = roleConstantsMap[roleId] || ROLE_PRICE_ORACLE;
      const role_keyR = await ci.get_role_key(
        address,
        new Uint8Array(Buffer.from(roleConstant))
      );
      if (!role_keyR.success) {
        toast.error("Failed to get role key", {
          description: `Could not retrieve role key for ${
            roles.find((r) => r.id === roleId)?.name || "selected role"
          }. Please try again.`,
        });
        return;
      }
      // revoke role (set to false)
      const set_roleR = await ci.set_role(role_keyR.returnValue, false);
      if (!set_roleR.success) {
        toast.error("Failed to revoke role", {
          description: `Could not revoke role for ${
            roles.find((r) => r.id === roleId)?.name || "selected role"
          }. Please try again.`,
        });
        return;
      }
      const stxns = await signTransactions(
        set_roleR.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);
      toast.success("Role revoked successfully", {
        description: `Successfully revoked ${
          roles.find((r) => r.id === roleId)?.name || "selected role"
        } role from ${address}.`,
      });

      // Refresh current user roles if the revoked role was for the current user
      if (address === activeAccount?.address) {
        await checkCurrentUserRoles();
      }
    } catch (error) {
      console.error("Error revoking role:", error);
      toast.error("Failed to revoke role", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Function to check all predefined roles for a given address
  const checkAllRoles = async (address: string) => {
    if (!address.trim()) {
      toast.error("Please provide an address to check roles");
      return;
    }

    setIsCheckingRoles(true);
    try {
      // get network clients
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      // get lending pool id from network config
      const lendingPoolId = networkConfig.contracts.lendingPools[0];
      // get lending pool contract
      const ci = new CONTRACT(
        Number(lendingPoolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: address, sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      const roleChecks = [];
      const roleNames = [];

      // Check each predefined role
      for (const [roleId, roleConstant] of Object.entries(roleConstantsMap)) {
        try {
          // Get role key for this role
          const role_keyR = await ci.get_role_key(
            address,
            new Uint8Array(Buffer.from(roleConstant))
          );

          if (role_keyR.success) {
            // Check if user has this role
            const hasRoleResult = await ci.has_role(role_keyR.returnValue);

            if (hasRoleResult.success) {
              roleChecks.push({
                roleId,
                roleConstant,
                roleName: roles.find((r) => r.id === roleId)?.name || roleId,
                hasRole: hasRoleResult.returnValue,
              });
              roleNames.push(roleId);
            }
          }
        } catch (error) {
          console.error(`Error checking role ${roleId}:`, error);
          roleChecks.push({
            roleId,
            roleConstant,
            roleName: roles.find((r) => r.id === roleId)?.name || roleId,
            hasRole: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Display results
      const hasAnyRole = roleChecks.some((check) => check.hasRole);
      const roleSummary = roleChecks
        .filter((check) => check.hasRole)
        .map((check) => check.roleName)
        .join(", ");

      if (hasAnyRole) {
        toast.success("Role Check Complete", {
          description: `${address} has the following roles: ${roleSummary}`,
        });
      } else {
        toast.info("Role Check Complete", {
          description: `${address} does not have any of the predefined roles.`,
        });
      }

      // Log detailed results to console for debugging
      console.log("Detailed Role Check Results:", {
        address,
        roleChecks,
      });

      return roleChecks;
    } catch (error) {
      console.error("Error checking roles:", error);
      toast.error("Failed to check roles", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
      return [];
    } finally {
      setIsCheckingRoles(false);
    }
  };

  const handleEnvoiNameChange = async (name: string) => {
    setEnvoiName(name);
    setEnvoiError(null);

    if (name.trim() && envoiService.isValidNameFormat(name)) {
      setEnvoiLoading(true);
      try {
        const addressData = await envoiService.resolveAddress(name);
        if (addressData) {
          setAssignAddress(
            addressData.address || addressData.addr || addressData.wallet || ""
          );
        } else {
          setEnvoiError("Name not found in Envoi registry");
        }
      } catch (error) {
        setEnvoiError("Failed to resolve Envoi name");
        console.error("Envoi resolution error:", error);
      } finally {
        setEnvoiLoading(false);
      }
    } else if (name.trim()) {
      setEnvoiError("Invalid Envoi name format");
    }
  };

  const handleRevokeEnvoiNameChange = async (name: string) => {
    setRevokeEnvoiName(name);
    setRevokeEnvoiError(null);

    if (name.trim() && envoiService.isValidNameFormat(name)) {
      setRevokeEnvoiLoading(true);
      try {
        const addressData = await envoiService.resolveAddress(name);
        if (addressData) {
          setAssignAddress(
            addressData.address || addressData.addr || addressData.wallet || ""
          );
        } else {
          setRevokeEnvoiError("Name not found in Envoi registry");
        }
      } catch (error) {
        setRevokeEnvoiError("Failed to resolve Envoi name");
        console.error("Envoi resolution error:", error);
      } finally {
        setRevokeEnvoiLoading(false);
      }
    } else if (name.trim()) {
      setRevokeEnvoiError("Invalid Envoi name format");
    }
  };

  const handleAddressChange = async (address: string) => {
    // Convert to uppercase for Algorand addresses
    const upperAddress = address.toUpperCase();
    setAssignAddress(upperAddress);
    setEnvoiError(null);

    if (
      upperAddress.trim() &&
      envoiService.isValidAddressFormat(upperAddress)
    ) {
      setEnvoiLoading(true);
      try {
        const nameData = await envoiService.resolveName(upperAddress);
        if (nameData) {
          setEnvoiName(nameData.name);
        } else {
          setEnvoiName("");
        }
      } catch (error) {
        console.error("Envoi name resolution error:", error);
      } finally {
        setEnvoiLoading(false);
      }
    } else if (address.trim()) {
      setEnvoiName("");
    }
  };

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case "database":
        return <Database className="h-4 w-4" />;
      case "trending-up":
        return <TrendingUp className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      case "crown":
        return <Crown className="h-4 w-4" />;
      case "shield":
        return <Shield className="h-4 w-4" />;
      case "eye":
        return <Eye className="h-4 w-4" />;
      default:
        return <UserCheck className="h-4 w-4" />;
    }
  };

  const getRoleById = (roleId: string) => {
    return roles.find((role) => role.id === roleId);
  };

  // Role-based access control functions
  const getCurrentUserRole = () => {
    if (!activeAccount?.address) return null;
    const userRole = userRoles.find(
      (ur) => ur.userAddress === activeAccount.address
    );
    return userRole ? getRoleById(userRole.roleId) : null;
  };

  const hasPermission = (permission: string) => {
    const currentRole = getCurrentUserRole();
    return currentRole?.permissions.includes(permission) || false;
  };

  const canPerformAction = (action: string) => {
    return hasPermission(action);
  };

  // Permission checks for UI elements
  const canCreateMarkets = () => canPerformAction("market.create");
  const canEditMarkets = () => canPerformAction("market.edit");
  const canPauseSystem = () => canPerformAction("market.pause");
  const canManageUsers = () => canPerformAction("user.manage");
  const canAssignRoles = () => canPerformAction("role.assign");
  const canUpdatePrices = () => canPerformAction("price.update");
  const canViewAudit = () => canPerformAction("audit.view");
  const canManageFeeds = () => canPerformAction("feed.manage");
  const canConfigureOracle = () => canPerformAction("oracle.configure");
  const canPauseOracle = () => canPerformAction("oracle.pause");

  // Check if current user has price feed manager role
  const hasPriceFeedManagerRole = () => {
    return currentUserRoles.some(
      (role) => role.roleId === "price-feed-manager" && role.hasRole
    );
  };

  // Check if current user has price oracle role using the price oracle contract address
  const hasPriceOracleRole = async () => {
    if (!activeAccount?.address || !oracleContractInfo.contractId) {
      return false;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Use the price oracle contract address for role checking
      const priceOracleAddress = algosdk.encodeAddress(
        algosdk.getApplicationAddress(Number(oracleContractInfo.contractId))
          .publicKey
      );

      const ci = new CONTRACT(
        Number(oracleContractInfo.contractId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: priceOracleAddress, sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      // Check if the current user has the price oracle role
      const role_keyR = await ci.get_role_key(
        activeAccount.address,
        new Uint8Array(Buffer.from(ROLE_PRICE_ORACLE))
      );

      if (role_keyR.success) {
        const hasRoleResult = await ci.has_role(role_keyR.returnValue);
        return hasRoleResult.success && hasRoleResult.returnValue;
      }
      return false;
    } catch (error) {
      console.error("Error checking price oracle role:", error);
      return false;
    }
  };

  // Check if a price feed is attached for a given token
  const checkPriceFeedStatus = async (
    tokenId: string | number,
    poolId?: string
  ) => {
    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      const lendingPoolId =
        poolId ||
        selectedLendingPool ||
        networkConfig.contracts.lendingPools[0];

      const ci = new CONTRACT(
        Number(lendingPoolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      const result = await ci.get_price_feed(Number(tokenId));
      if (result.success) {
        // providerAppId of 0 means no price feed is attached
        return result.returnValue.providerAppId !== 0n;
      }
      return false;
    } catch (error) {
      console.error(`Error checking price feed for token ${tokenId}:`, error);
      return false;
    }
  };

  // Load price feed status for all markets
  const loadPriceFeedStatus = async () => {
    if (!selectedLendingPool) return;

    try {
      const markets = getMarketsFromConfig(currentNetwork);
      const statusPromises = markets.map(async (market) => {
        const tokenId = market.underlyingAssetId || market.underlyingContractId;
        if (tokenId) {
          const hasPriceFeed = await checkPriceFeedStatus(
            tokenId,
            selectedLendingPool
          );
          return { marketId: market.id, hasPriceFeed };
        }
        return { marketId: market.id, hasPriceFeed: false };
      });

      const results = await Promise.all(statusPromises);
      const statusMap: Record<string, boolean> = {};
      results.forEach(({ marketId, hasPriceFeed }) => {
        statusMap[marketId] = hasPriceFeed;
      });

      setPriceFeedStatus(statusMap);
    } catch (error) {
      console.error("Error loading price feed status:", error);
    }
  };

  // Load price data for each asset from the oracle contract
  const loadAssetPrices = async () => {
    if (!oracleContractInfo.contractId || !oracleContractInfo.isDeployed) {
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create oracle contract instance
      const ci = new CONTRACT(
        Number(oracleContractInfo.contractId),
        clients.algod,
        undefined,
        { ...PriceOracleAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      const markets = getMarketsFromConfig(currentNetwork);
      const pricePromises = markets.map(async (market) => {
        const tokenId = market.underlyingAssetId || market.underlyingContractId;
        if (tokenId) {
          try {
            const result = await ci.get_price_with_timestamp(Number(tokenId));
            console.log(
              `get_price_with_timestamp result for token ${tokenId}:`,
              { result }
            );
            if (result.success) {
              // Return value is [price, timestamp] array
              const [price, timestamp] = result.returnValue;
              console.log(`Parsed values for token ${tokenId}:`, {
                price: price.toString(),
                timestamp: timestamp.toString(),
                priceUSD: (Number(price) / 1e6).toFixed(6),
                timestampDate: new Date(
                  Number(timestamp) * 1000
                ).toLocaleString(),
              });

              // Check if both values are zero (no price data)
              if (price === 0n && timestamp === 0n) {
                console.log(
                  `No price data available for token ${tokenId} - both values are zero`
                );
                return { marketId: market.id, priceData: null };
              }

              return {
                marketId: market.id,
                priceData: {
                  price: price,
                  timestamp: timestamp,
                },
              };
            }
          } catch (error) {
            console.error(`Error getting price for token ${tokenId}:`, error);
          }
        }
        return { marketId: market.id, priceData: null };
      });

      const results = await Promise.all(pricePromises);
      const priceMap: Record<
        string,
        { price: bigint; timestamp: bigint } | null
      > = {};
      results.forEach(({ marketId, priceData }) => {
        priceMap[marketId] = priceData;
      });

      setAssetPrices(priceMap);
    } catch (error) {
      console.error("Error loading asset prices:", error);
    }
  };

  // Load market data for each asset from the lending pool
  const loadMarketData = async () => {
    console.log("🔄 loadMarketData called", { selectedLendingPool });
    if (!selectedLendingPool) {
      console.log("❌ No lending pool selected, skipping market data load");
      return;
    }

    try {
      console.log(
        "✅ Starting market data load for lending pool:",
        selectedLendingPool
      );
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const markets = getMarketsFromConfig(currentNetwork);
      console.log("📊 Markets to process:", markets.length);
      const results = await Promise.all(
        markets.map(async (market) => {
          try {
            const ci = new CONTRACT(
              Number(selectedLendingPool),
              clients.algod,
              undefined,
              { ...LendingPoolAppSpec.contract, events: [] },
              { addr: activeAccount?.address || "", sk: new Uint8Array() }
            );

            const tokenId =
              market.underlyingAssetId || market.underlyingContractId;

            console.log(`🔍 Processing market ${market.id}:`, {
              marketId: market.id,
              underlyingAssetId: market.underlyingAssetId,
              underlyingContractId: market.underlyingContractId,
              tokenId: tokenId,
              tokenIdNumber: Number(tokenId),
              marketName: market.name,
              marketSymbol: market.symbol,
            });

            // Check if tokenId is valid
            if (!tokenId || isNaN(Number(tokenId))) {
              console.error(
                `❌ Invalid tokenId for market ${market.id}:`,
                tokenId
              );
              return { marketId: market.id, marketData: null };
            }

            const result = await ci.get_market(Number(tokenId));
            console.log(`get_market result for token ${tokenId}:`, { result });

            if (result.success) {
              const marketData = decodeMarket(result.returnValue);
              console.log("marketData", marketData);
              console.log(`Market data for token ${tokenId}:`, {
                price: marketData.price.toString(),
                paused: marketData.paused,
                lastUpdateTime: marketData.lastUpdateTime.toString(),
                priceUSD: (Number(marketData.price) / 1e24).toFixed(6),
                lastUpdateDate: new Date(
                  Number(marketData.lastUpdateTime) * 1000
                ).toLocaleString(),
              });

              return {
                marketId: market.id,
                marketData: {
                  price: BigInt(marketData.price.toString()),
                  paused: marketData.paused,
                  lastUpdateTime: BigInt(marketData.lastUpdateTime.toString()),
                },
              };
            }
            console.log(
              `❌ No market data found for token ${tokenId} (market ${market.id})`
            );
            return { marketId: market.id, marketData: null };
          } catch (error) {
            console.error(
              `❌ Error loading market data for ${market.id}:`,
              error
            );
            return { marketId: market.id, marketData: null };
          }
        })
      );

      const marketMap: Record<
        string,
        { price: bigint; paused: boolean; lastUpdateTime: bigint } | null
      > = {};
      results.forEach(({ marketId, marketData }) => {
        marketMap[marketId] = marketData;
      });

      console.log("📈 Market data results:", marketMap);
      setMarketData(marketMap);
      console.log("✅ Market data state updated");
    } catch (error) {
      console.error("❌ Error loading market data:", error);
    }
  };

  // Load price feed data from lending pool
  const loadLendingPoolPriceFeeds = async () => {
    if (!selectedLendingPool) {
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create lending pool contract instance
      const ci = new CONTRACT(
        Number(selectedLendingPool),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      const markets = getMarketsFromConfig(currentNetwork);
      const priceFeedPromises = markets.map(async (market) => {
        const tokenId = market.underlyingAssetId || market.underlyingContractId;
        if (tokenId) {
          try {
            const result = await ci.get_price_feed(Number(tokenId));
            if (result.success) {
              console.log("get_price_feed result", result);
              const [marketId, providerAppId, [price, timestamp]] =
                result.returnValue;
              return {
                marketId: market.id,
                priceFeedData: {
                  marketId: Number(marketId),
                  providerAppId: Number(providerAppId),
                  priceWithTimestamp: {
                    price: BigInt(Number(price)),
                    timestamp: BigInt(Number(timestamp)),
                  },
                },
              };
            }
          } catch (error) {
            console.error(
              `Error getting price feed for token ${tokenId}:`,
              error
            );
          }
        }
        return { marketId: market.id, priceFeedData: null };
      });

      const results = await Promise.all(priceFeedPromises);
      const priceFeedMap: Record<
        string,
        {
          marketId: bigint;
          providerAppId: bigint;
          priceWithTimestamp: { price: bigint; timestamp: bigint };
        } | null
      > = {};
      results.forEach(({ marketId, priceFeedData }) => {
        priceFeedMap[marketId] = priceFeedData;
      });

      setLendingPoolPriceFeeds(priceFeedMap);
    } catch (error) {
      console.error("Error loading lending pool price feeds:", error);
    }
  };

  // Approve or revoke feeder permissions
  const handleApproveFeeder = async () => {
    if (!oracleContractInfo.contractId || !oracleContractInfo.isDeployed) {
      toast.error("Oracle contract not available", {
        description: "Cannot approve feeder: Oracle contract is not deployed.",
      });
      return;
    }

    if (!feederAddress.trim() || !selectedTokenForFeeder) {
      toast.error("Missing information", {
        description: "Please provide both feeder address and token selection.",
      });
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create oracle contract instance
      const ci = new CONTRACT(
        Number(oracleContractInfo.contractId),
        clients.algod,
        undefined,
        { ...PriceOracleAppSpec.contract, events: [] }, // NOTE: Should be PriceOracleAppSpec when available
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      // Get token ID from selected market
      const markets = getMarketsFromConfig(currentNetwork);
      const selectedMarket = markets.find(
        (market) => market.id === selectedTokenForFeeder
      );
      const tokenId =
        selectedMarket?.underlyingAssetId ||
        selectedMarket?.underlyingContractId;

      if (!tokenId) {
        toast.error("Invalid token selection", {
          description: "Could not find token ID for selected market.",
        });
        return;
      }

      ci.setPaymentAmount(124500);
      const result = await ci.approve_feeder(
        Number(tokenId),
        feederAddress,
        feederApproval
      );

      console.log("approve_feeder result", { result });

      if (!result.success) {
        toast.error("Failed to approve feeder", {
          description: `Could not ${
            feederApproval ? "approve" : "revoke"
          } feeder permissions. Please try again.`,
        });
        return;
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);

      toast.success("Feeder permissions updated", {
        description: `Successfully ${
          feederApproval ? "approved" : "revoked"
        } feeder permissions for ${feederAddress} on token ${tokenId}.`,
      });

      // Reset form
      setFeederAddress("");
      setSelectedTokenForFeeder("");
      setFeederApproval(true);
      setIsApproveFeederModalOpen(false);
    } catch (error) {
      console.error("Error approving feeder:", error);
      toast.error("Failed to approve feeder", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Set price for a specific token
  const handleSetPrice = async () => {
    if (!oracleContractInfo.contractId || !oracleContractInfo.isDeployed) {
      toast.error("Oracle contract not available", {
        description: "Cannot set price: Oracle contract is not deployed.",
      });
      return;
    }

    if (!selectedTokenForPrice || !priceValue.trim()) {
      toast.error("Missing information", {
        description: "Please provide both token selection and price value.",
      });
      return;
    }

    const price = parseFloat(priceValue);
    if (isNaN(price) || price <= 0) {
      toast.error("Invalid price", {
        description: "Please enter a valid positive price value.",
      });
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create oracle contract instance
      const ci = new CONTRACT(
        Number(oracleContractInfo.contractId),
        clients.algod,
        undefined,
        { ...PriceOracleAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      // Get token ID from selected market
      const markets = getMarketsFromConfig(currentNetwork);
      const selectedMarket = markets.find(
        (market) => market.id === selectedTokenForPrice
      );
      const tokenId =
        selectedMarket?.underlyingAssetId ||
        selectedMarket?.underlyingContractId;

      if (!tokenId) {
        toast.error("Invalid token selection", {
          description: "Could not find token ID for selected market.",
        });
        return;
      }

      // Convert price to micro-units (multiply by 1e6)
      const priceInMicroUnits = BigInt(Math.floor(price * 1e6));

      // Call post_price method
      ci.setPaymentAmount(124500);
      const result = await ci.post_price(Number(tokenId), priceInMicroUnits);

      console.log("post_price result", { result });

      if (!result.success) {
        toast.error("Failed to set price", {
          description:
            "Could not set price. Please check if you have feeder permissions and try again.",
        });
        return;
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);

      toast.success("Price updated successfully", {
        description: `Successfully set price for ${
          selectedMarket?.symbol
        } to $${price.toFixed(6)}.`,
      });

      // Refresh price data
      await loadAssetPrices();

      // Reset form
      setSelectedTokenForPrice("");
      setPriceValue("");
      setIsSetPriceModalOpen(false);
    } catch (error) {
      console.error("Error setting price:", error);
      toast.error("Failed to set price", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Attach price feed to lending pool
  const handleAttachPriceFeed = async () => {
    if (!selectedLendingPool) {
      toast.error("No lending pool selected", {
        description: "Please select a lending pool first.",
      });
      return;
    }

    if (!selectedTokenForAttach) {
      toast.error("No token selected", {
        description: "Please select a token to attach price feed for.",
      });
      return;
    }

    if (!oracleContractInfo.contractId || !oracleContractInfo.isDeployed) {
      toast.error("Oracle contract not available", {
        description:
          "Cannot attach price feed: Oracle contract is not deployed.",
      });
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create lending pool contract instance
      const ci = new CONTRACT(
        Number(selectedLendingPool),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      // Get token ID from selected market
      const markets = getMarketsFromConfig(currentNetwork);
      const selectedMarket = markets.find(
        (market) => market.id === selectedTokenForAttach
      );
      const tokenId =
        selectedMarket?.underlyingAssetId ||
        selectedMarket?.underlyingContractId;

      if (!tokenId) {
        toast.error("Invalid token selection", {
          description: "Could not find token ID for selected market.",
        });
        return;
      }

      // Call attach_price_feed method
      //ci.setPaymentAmount(124500);
      const result = await ci.attach_price_feed(
        Number(tokenId),
        Number(oracleContractInfo.contractId)
      );

      console.log("attach_price_feed result", { result });

      if (!result.success) {
        toast.error("Failed to attach price feed", {
          description:
            "Could not attach price feed. Please check if you have the required role and try again.",
        });
        return;
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);

      toast.success("Price feed attached successfully", {
        description: `Successfully attached price feed for ${selectedMarket?.symbol} to oracle contract.`,
      });

      // Refresh price feed status
      await loadPriceFeedStatus();
      await loadLendingPoolPriceFeeds();

      // Reset form
      setSelectedTokenForAttach("");
      setIsAttachPriceFeedModalOpen(false);
    } catch (error) {
      console.error("Error attaching price feed:", error);
      toast.error("Failed to attach price feed", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Export oracle data to JSON
  const handleExportOracleData = () => {
    try {
      const markets = getMarketsFromConfig(currentNetwork);
      const networkConfig = getCurrentNetworkConfig();
      const exportData = {
        metadata: {
          network: currentNetwork,
          exportDate: new Date().toISOString(),
          contractId: oracleContractInfo.contractId,
          isDeployed: oracleContractInfo.isDeployed,
          hasPriceOracleRole: oracleContractInfo.hasPriceOracleRole,
        },
        networkConfig: networkConfig,
        supportedAssets: markets.map((market) => ({
          id: market.id,
          symbol: market.symbol,
          name: market.name,
          underlyingAssetId: market.underlyingAssetId,
          decimals: market.decimals,
          icon: market.icon,
          color: market.color,
        })),
        contractState: oracleContractInfo.contractState,
        assetPrices: Object.keys(assetPrices).reduce((acc, marketId) => {
          const market = markets.find((m) => m.id === marketId);
          const priceData = assetPrices[marketId];
          if (market && priceData) {
            acc[marketId] = {
              symbol: market.symbol,
              name: market.name,
              underlyingAssetId: market.underlyingAssetId,
              price: Number(priceData.price) / 1e6, // Convert from micro units
              timestamp: Number(priceData.timestamp),
              lastUpdated: new Date(
                Number(priceData.timestamp) * 1000
              ).toISOString(),
            };
          }
          return acc;
        }, {} as Record<string, any>),
        priceFeedStatus: Object.keys(priceFeedStatus).reduce(
          (acc, marketId) => {
            const market = markets.find((m) => m.id === marketId);
            const isAttached = priceFeedStatus[marketId];
            if (market) {
              acc[marketId] = {
                symbol: market.symbol,
                name: market.name,
                underlyingAssetId: market.underlyingAssetId,
                isAttached: isAttached,
              };
            }
            return acc;
          },
          {} as Record<string, any>
        ),
      };

      // Create and download the JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `oracle-data-${currentNetwork}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success("Oracle data exported successfully", {
        description: "Oracle data has been downloaded as JSON file.",
      });
    } catch (error) {
      console.error("Error exporting oracle data:", error);
      toast.error("Failed to export oracle data", {
        description: "An unexpected error occurred while exporting data.",
      });
    }
  };

  // Fetch price feed for a specific token
  const handleFetchPriceFeed = async (marketId: string) => {
    if (!selectedLendingPool) {
      toast.error("No lending pool selected", {
        description: "Please select a lending pool first.",
      });
      return;
    }

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create lending pool contract instance
      const ci = new CONTRACT(
        Number(selectedLendingPool),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount?.address || "", sk: new Uint8Array() }
      );
      ci.setEnableRawBytes(true);

      // Get token ID from market
      const markets = getMarketsFromConfig(currentNetwork);
      const selectedMarket = markets.find((market) => market.id === marketId);
      const tokenId =
        selectedMarket?.underlyingAssetId ||
        selectedMarket?.underlyingContractId;

      console.log(`🔄 Fetching price feed for market ${marketId}:`, {
        selectedMarket,
        tokenId,
        tokenIdNumber: Number(tokenId),
        marketsCount: markets.length,
        allMarketIds: markets.map((m) => m.id),
      });

      if (!tokenId) {
        console.error(`❌ No tokenId found for market ${marketId}`);
        toast.error("Invalid market selection", {
          description: "Could not find token ID for selected market.",
        });
        return;
      }

      if (isNaN(Number(tokenId))) {
        console.error(`❌ Invalid tokenId for market ${marketId}:`, tokenId);
        toast.error("Invalid token ID", {
          description: `Invalid token ID: ${tokenId}`,
        });
        return;
      }

      ci.setFee(3000);
      ci.setPaymentAmount(1e5);
      const result = await ci.fetch_price_feed(Number(tokenId));

      console.log("fetch_price_feed result", { result });

      if (!result.success) {
        toast.error("Failed to fetch price feed", {
          description:
            "Could not fetch price feed. Please check if price feed is attached and try again.",
        });
        return;
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);

      toast.success("Price feed fetched successfully", {
        description: `Successfully fetched latest price for ${selectedMarket?.symbol}.`,
      });

      // Refresh price feed data
      await loadPriceFeedStatus();
      await loadLendingPoolPriceFeeds();
    } catch (error) {
      console.error("Error fetching price feed:", error);
      toast.error("Failed to fetch price feed", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Load current user's Envoi name
  const loadCurrentUserEnvoiName = async () => {
    if (!activeAccount?.address) return;

    try {
      const nameData = await envoiService.resolveName(activeAccount.address);
      setCurrentUserEnvoiName(nameData?.name || null);
    } catch (error) {
      console.error("Failed to load current user's Envoi name:", error);
    }
  };

  // Load Envoi name when component mounts or account changes
  React.useEffect(() => {
    loadCurrentUserEnvoiName();
  }, [activeAccount?.address]);

  // Check current user's roles when component mounts or account changes
  React.useEffect(() => {
    checkCurrentUserRoles();
  }, [activeAccount?.address]);

  // Debounced search for revoke modal Envoi names
  React.useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (revokeDebouncedSearchQuery.trim()) {
        setRevokeEnvoiLoading(true);
        try {
          const results = await envoiService.searchNames(
            revokeDebouncedSearchQuery
          );
          setRevokeEnvoiSearchResults(results?.results || []);
        } catch (error) {
          console.error("Error searching Envoi names:", error);
          setRevokeEnvoiSearchResults([]);
        } finally {
          setRevokeEnvoiLoading(false);
        }
      } else {
        setRevokeEnvoiSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [revokeDebouncedSearchQuery]);

  // Mint AToken function
  const handleMintAToken = async () => {
    if (!mintName.trim()) {
      setMintError("Please provide a name for the AToken");
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintResult(null);

    try {
      const clients = await algorandService.getCurrentClientsForTransactions();
      const clientParams: any = {
        resolveBy: "creatorAndName",
        findExistingUsing: clients.indexer,
        creatorAddress: activeAccount.address,
        name: `AToken-${mintName.trim()}`,
        sender: {
          addr: activeAccount.address,
          signer: transactionSigner,
        },
      };
      // let appId = 46504436;
      // const clientParams = {
      //   resolveBy: "id",
      //   id: 46504436,
      //   sender: {
      //     addr: activeAccount.address,
      //     signer: transactionSigner,
      //   },
      // };
      const appClient = new ATokenClient(clientParams, clients.algod);
      console.log("appClient", { appClient });

      // Call mint function
      const result = await appClient.deploy({
        deployTimeParams: {},
        onUpdate: "update",
        onSchemaBreak: "fail",
      });
      const appId = result.appId;

      const ci = new CONTRACT(
        Number(appId),
        clients.algod,
        undefined,
        {
          ...ATokenAppSpec.contract,
          events: [],
        },
        {
          addr: activeAccount.address,
          sk: new Uint8Array(),
        }
      );

      ci.setPaymentAmount(121300);
      const bootstrapResult = await ci.bootstrap();

      console.log("Bootstrap result:", bootstrapResult);

      if (!bootstrapResult.success) {
        throw new Error("Failed to bootstrap AToken");
      }

      const stxns = await signTransactions(
        bootstrapResult.txns.map((txn: string) => {
          const binaryString = atob(txn);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        }) as any
      );

      console.log("STXNS:", stxns);

      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);

      setMintResult(
        `Successfully minted AToken "${mintName}". Transaction ID: ${res.txid}`
      );
    } catch (error) {
      console.error("Mint error:", error);
      setMintError(
        error instanceof Error ? error.message : "Failed to mint AToken"
      );
    } finally {
      setIsMinting(false);
    }
  };

  // SToken functions
  const loadStokenInfo = async () => {
    setIsLoadingStokenInfo(true);
    setStokenError(null);

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Get SToken contract ID from network config
      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        throw new Error("SToken contract not configured for this network");
      }

      const ci = new CONTRACT(
        Number(stokenContractId),
        clients.algod,
        undefined,
        { ...STokenAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );

      // Get SToken info
      const nameR = await ci.arc200_name();
      const symbolR = await ci.arc200_symbol();
      const decimalsR = await ci.arc200_decimals();
      const totalSupplyR = await ci.arc200_totalSupply();
      const pausedR = await ci.is_paused();

      if (
        !nameR.success ||
        !symbolR.success ||
        !decimalsR.success ||
        !totalSupplyR.success ||
        !pausedR.success
      ) {
        throw new Error("Failed to fetch SToken information");
      }

      console.log("SToken info:", {
        nameR,
        symbolR,
        decimalsR,
        totalSupplyR,
        pausedR,
      });

      setStokenInfo({
        name: Buffer.from(nameR.returnValue).toString(),
        symbol: Buffer.from(symbolR.returnValue).toString(),
        decimals: decimalsR.returnValue.toString(),
        totalSupply: totalSupplyR.returnValue.toString(),
        paused: pausedR.returnValue,
        contractId: stokenContractId,
        contractAddress: algosdk.encodeAddress(
          algosdk.getApplicationAddress(Number(stokenContractId)).publicKey
        ),
      });

      // Load approved minters
      await loadApprovedMinters();
    } catch (error) {
      console.error("Error loading SToken info:", error);
      setStokenError(
        error instanceof Error ? error.message : "Failed to load SToken info"
      );
    } finally {
      setIsLoadingStokenInfo(false);
    }
  };

  const loadApprovedMinters = async () => {
    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        return;
      }

      const ci = new CONTRACT(
        Number(stokenContractId),
        clients.algod,
        undefined,
        { ...STokenAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );

      // Get lending pools to check which ones are approved minters
      const lendingPools = getLendingPools(currentNetwork);
      const approvedMinters: string[] = [];

      for (const poolId of lendingPools) {
        try {
          // Convert pool ID to application address
          const poolAddress = algosdk.encodeAddress(
            algosdk.getApplicationAddress(Number(poolId)).publicKey
          );
          const isMinterR = await ci.is_minter(poolAddress);
          if (isMinterR.success && isMinterR.returnValue) {
            approvedMinters.push(poolId);
          }
        } catch (error) {
          console.error(
            `Error checking minter status for pool ${poolId}:`,
            error
          );
        }
      }

      setApprovedMinters(approvedMinters);
    } catch (error) {
      console.error("Error loading approved minters:", error);
    }
  };

  const handleApproveMinter = async () => {
    if (!minterAddress.trim()) {
      setMinterApprovalError("Please provide a minter address");
      return;
    }

    setIsApprovingMinter(true);
    setMinterApprovalError(null);
    setMinterApprovalResult(null);

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        throw new Error("SToken contract not configured for this network");
      }

      const ci = new CONTRACT(
        Number(stokenContractId),
        clients.algod,
        undefined,
        { ...STokenAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );

      // Check if minterAddress is a number (application ID) and convert to address
      let actualMinterAddress = minterAddress.trim();
      const appId = parseInt(minterAddress.trim());

      if (!isNaN(appId) && appId > 0) {
        // Convert application ID to application address
        actualMinterAddress = algosdk.encodeAddress(
          algosdk.getApplicationAddress(appId).publicKey
        );
        console.log(
          `Converted app ID ${appId} to address: ${actualMinterAddress}`
        );
      }

      ci.setPaymentAmount(1000);
      const result = await ci.approve_minter(actualMinterAddress);
      if (!result.success) {
        console.log({ approve_minterR: result });
        throw new Error("Failed to approve minter");
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      setMinterApprovalResult(
        `Minter approval successful! Transaction ID: ${res.txid}${
          !isNaN(appId) && appId > 0
            ? ` (App ID ${appId} → ${actualMinterAddress})`
            : ""
        }`
      );
      setMinterAddress("");

      // Reload approved minters
      await loadApprovedMinters();

      toast.success("Minter approved successfully");
    } catch (error) {
      console.error("Error approving minter:", error);
      setMinterApprovalError(
        error instanceof Error ? error.message : "Failed to approve minter"
      );
    } finally {
      setIsApprovingMinter(false);
    }
  };

  const handleRevokeMinter = async (minterAddress: string) => {
    setIsRevokingMinter(true);
    setMinterRevocationError(null);
    setMinterRevocationResult(null);

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        throw new Error("SToken contract not configured for this network");
      }

      const ci = new CONTRACT(
        Number(stokenContractId!),
        clients.algod,
        undefined,
        { ...STokenAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );

      // Check if minterAddress is a number (application ID) and convert to address
      let actualMinterAddress = minterAddress.trim();
      const appId = parseInt(minterAddress.trim());

      if (!isNaN(appId) && appId > 0) {
        // Convert application ID to application address
        actualMinterAddress = algosdk.encodeAddress(
          algosdk.getApplicationAddress(appId).publicKey
        );
        console.log(
          `Converted app ID ${appId} to address: ${actualMinterAddress}`
        );
      }

      ci.setPaymentAmount(1000);
      const result = await ci.revoke_minter(actualMinterAddress);
      if (!result.success) {
        console.log({ revoke_minterR: result });
        throw new Error("Failed to revoke minter");
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      setMinterRevocationResult(
        `Minter revocation successful! Transaction ID: ${res.txid}${
          !isNaN(appId) && appId > 0
            ? ` (App ID ${appId} → ${actualMinterAddress})`
            : ""
        }`
      );

      // Reload approved minters
      await loadApprovedMinters();

      toast.success("Minter revoked successfully");
    } catch (error) {
      console.error("Error revoking minter:", error);
      setMinterRevocationError(
        error instanceof Error ? error.message : "Failed to revoke minter"
      );
    } finally {
      setIsRevokingMinter(false);
    }
  };

  const handleSetStoken = async (poolId: string) => {
    setIsSettingStoken(true);
    setSetStokenOperationError(null);
    setSetStokenResult(null);

    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        throw new Error("SToken contract not configured for this network");
      }

      const ci = new CONTRACT(
        Number(poolId),
        clients.algod,
        undefined,
        { ...LendingPoolAppSpec.contract, events: [] },
        { addr: activeAccount.address, sk: new Uint8Array() }
      );

      // Convert SToken contract ID to address
      const stokenAddress = algosdk.encodeAddress(
        algosdk.getApplicationAddress(Number(stokenContractId)).publicKey
      );

      ci.setFee(2000);
      ci.setPaymentAmount(1000);
      const result = await ci.set_stoken_app_id(Number(stokenContractId));
      if (!result.success) {
        console.log({ set_stoken_app_idR: result });
        throw new Error("Failed to set SToken for lending pool");
      }

      const stxns = await signTransactions(
        result.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(algorandClients.algod, res.txid, 4);

      setSetStokenResult(
        `SToken set successfully! Transaction ID: ${res.txid} (Pool ${poolId} → SToken ${stokenContractId})`
      );

      toast.success("SToken set successfully for lending pool");
    } catch (error) {
      console.error("Error setting SToken:", error);
      setSetStokenOperationError(
        error instanceof Error ? error.message : "Failed to set SToken"
      );
    } finally {
      setIsSettingStoken(false);
    }
  };

  const checkStokenMarketExists = async () => {
    try {
      const networkConfig = getCurrentNetworkConfig();
      const stokenContractId = networkConfig.contracts.sToken;
      if (!stokenContractId) {
        setStokenMarketExists(false);
        return;
      }

      // Get all markets for the current network
      const markets = getMarketsFromConfig(currentNetwork);

      // Check if any market has the SToken contract ID as its token contract
      const stokenMarket = markets.find(
        (market) => market.underlyingContractId === stokenContractId
      );

      setStokenMarketExists(!!stokenMarket);

      if (stokenMarket) {
        // Fetch detailed market information
        try {
          const marketInfo = await fetchMarketInfo(
            stokenMarket.poolId || "1",
            stokenContractId,
            currentNetwork
          );
          setStokenMarketInfo({
            ...stokenMarket,
            marketInfo: marketInfo,
          });
        } catch (error) {
          console.error("Error fetching SToken market info:", error);
          setStokenMarketInfo(stokenMarket);
        }
      } else {
        setStokenMarketInfo(null);
      }
    } catch (error) {
      console.error("Error checking SToken market:", error);
      setStokenMarketExists(false);
    }
  };

  const handleCreateStokenMarket = async () => {
    if (!activeAccount) {
      alert("Please connect your wallet first");
      return;
    }

    setIsCreatingStokenMarket(true);
    setStokenMarketCreationError(null);
    setStokenMarketCreationResult(null);

    try {
      const networkConfig = getCurrentNetworkConfig();
      const stokenContractId = networkConfig.contracts.sToken;
      const lendingPools = getLendingPools(currentNetwork);

      if (!stokenContractId || lendingPools.length === 0) {
        throw new Error(
          "SToken contract or lending pools not configured for this network"
        );
      }

      // Use the first lending pool for the market
      const poolId = lendingPools[0];
      const decimals = Number(stokenInfo?.decimals) || 6;

      const createMarketParams: CreateMarketParams = {
        tokenId: Number(stokenContractId),
        collateralFactor: BigInt(8000), // 0.8 (80%)
        liquidationThreshold: BigInt(8500), // 0.85 (85%)
        reserveFactor: BigInt(1000), // 0.1 (10%)
        borrowRate: BigInt(500), // 0.05 (5%)
        slope: BigInt(1000), // 0.1 (10%)
        maxTotalDeposits: BigInt(1000000 * 10 ** decimals), // 1M tokens
        maxTotalBorrows: BigInt(800000 * 10 ** decimals), // 800K tokens
        liquidationBonus: BigInt(500), // 0.05 (5%)
        closeFactor: BigInt(5000), // 0.5 (50%)
      };

      const createMarketResult = await createMarket(
        Number(poolId),
        createMarketParams,
        activeAccount.address
      );

      if (createMarketResult.success) {
        const stxns = await signTransactions(
          createMarketResult.txns.map((txn: string) =>
            Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
          )
        );
        const algorandClients =
          await algorandService.getCurrentClientsForTransactions();
        const res = await algorandClients.algod.sendRawTransaction(stxns).do();
        await waitForConfirmation(algorandClients.algod, res.txid, 4);
        setStokenMarketCreationResult(
          `SToken market created successfully! Market ID: ${createMarketResult.marketId}`
        );
        setStokenMarketExists(true);
        toast.success("SToken market created successfully");
      } else {
        throw new Error("Failed to create SToken market");
      }
    } catch (error) {
      console.error("Error creating SToken market:", error);
      setStokenMarketCreationError(
        error instanceof Error
          ? error.message
          : "Failed to create SToken market"
      );
    } finally {
      setIsCreatingStokenMarket(false);
    }
  };

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
  const [userMarketIndices, setUserMarketIndices] = useState<
    Record<string, { depositIndex: string; borrowIndex: string }>
  >({});
  const [showRawData, setShowRawData] = useState(false);
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

  // Price Oracle state
  const [oracleContractInfo, setOracleContractInfo] = useState<{
    contractId: string | undefined;
    isDeployed: boolean;
    hasPriceOracleRole: boolean;
    contractState: any;
  }>({
    contractId: undefined,
    isDeployed: false,
    hasPriceOracleRole: false,
    contractState: null,
  });
  const [oracleLoading, setOracleLoading] = useState(false);

  // State to track price feed status for each market
  const [priceFeedStatus, setPriceFeedStatus] = useState<
    Record<string, boolean>
  >({});

  // State to store price data for each asset
  const [assetPrices, setAssetPrices] = useState<
    Record<string, { price: bigint; timestamp: bigint } | null>
  >({});

  // State to store market data for each asset
  const [marketData, setMarketData] = useState<
    Record<
      string,
      { price: bigint; paused: boolean; lastUpdateTime: bigint } | null
    >
  >({});

  // State to store price feed data from lending pool
  const [lendingPoolPriceFeeds, setLendingPoolPriceFeeds] = useState<
    Record<
      string,
      {
        marketId: bigint;
        providerAppId: bigint;
        priceWithTimestamp: { price: bigint; timestamp: bigint };
      } | null
    >
  >({});

  // State for approve feeder modal
  const [isApproveFeederModalOpen, setIsApproveFeederModalOpen] =
    useState(false);
  const [feederAddress, setFeederAddress] = useState("");
  const [selectedTokenForFeeder, setSelectedTokenForFeeder] =
    useState<string>("");
  const [feederApproval, setFeederApproval] = useState<boolean>(true);

  // State for set price modal
  const [isSetPriceModalOpen, setIsSetPriceModalOpen] = useState(false);
  const [selectedTokenForPrice, setSelectedTokenForPrice] =
    useState<string>("");
  const [priceValue, setPriceValue] = useState<string>("");

  // State for attach price feed modal
  const [isAttachPriceFeedModalOpen, setIsAttachPriceFeedModalOpen] =
    useState(false);
  const [selectedTokenForAttach, setSelectedTokenForAttach] =
    useState<string>("");

  // State for selected lending pool
  const [selectedLendingPool, setSelectedLendingPool] = useState<string>("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(envoiSearchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [envoiSearchQuery]);

  // Handle debounced search
  useEffect(() => {
    if (
      debouncedSearchQuery.trim().length >= 2 &&
      !debouncedSearchQuery.includes(".")
    ) {
      handleEnvoiSearch(debouncedSearchQuery);
    } else {
      setEnvoiSearchResults([]);
      setShowEnvoiSearch(false);
    }
  }, [debouncedSearchQuery]);

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
  const [isMaxBorrowsUpdateModalOpen, setIsMaxBorrowsUpdateModalOpen] =
    useState(false);
  const [maxBorrowsUpdateData, setMaxBorrowsUpdateData] = useState<{
    marketId: string;
    poolId: string;
    currentMaxBorrows: string;
    newMaxBorrows: string;
  }>({
    marketId: "",
    poolId: "",
    currentMaxBorrows: "",
    newMaxBorrows: "",
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

          await waitForConfirmation(algorandClients.algod, res.txid, 4);

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

    // Format the current max deposits to show human-readable value
    // Note: maxTotalDeposits is already scaled by token decimals in lendingService.ts
    const currentMaxDepositsRaw = market.marketInfo?.maxTotalDeposits || "0";
    const currentMaxDepositsFormatted = (() => {
      const value = parseFloat(currentMaxDepositsRaw);
      if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(2)}B`;
      } else if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      } else {
        return value.toFixed(0);
      }
    })();

    setMaxDepositsUpdateData({
      marketId: contractId, // Use the token's contract ID, not the market's tokenContractId
      poolId: market.marketInfo?.poolId || "",
      currentMaxDeposits: currentMaxDepositsFormatted,
      newMaxDeposits: "",
    });
    setIsMaxDepositsUpdateModalOpen(true);
  };

  const handleEditMaxBorrows = (market: any) => {
    setSelectedMarket(market);

    // Get the correct contract ID from the token configuration
    const tokens = getAllTokensWithDisplayInfo(currentNetwork);
    const token = tokens.find(
      (t) => t.symbol.toLowerCase() === market.asset?.toLowerCase()
    );
    const contractId = token?.underlyingContractId || "";

    // Format the current max borrows to show human-readable value
    // Note: maxTotalBorrows is already scaled by token decimals in lendingService.ts
    const currentMaxBorrowsRaw = market.marketInfo?.maxTotalBorrows || "0";
    const currentMaxBorrowsFormatted = (() => {
      const value = parseFloat(currentMaxBorrowsRaw);
      if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(2)}B`;
      } else if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      } else {
        return value.toFixed(0);
      }
    })();

    setMaxBorrowsUpdateData({
      marketId: contractId, // Use the token's contract ID, not the market's tokenContractId
      poolId: market.marketInfo?.poolId || "",
      currentMaxBorrows: currentMaxBorrowsFormatted,
      newMaxBorrows: "",
    });
    setIsMaxBorrowsUpdateModalOpen(true);
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
          await waitForConfirmation(algorandClients.algod, res.txid, 4);
          alert(`Price updated successfully! Transaction ID: ${res.txid}`);
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

          await waitForConfirmation(algorandClients.algod, res.txid, 4);

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

  const handleUpdateMaxBorrows = async () => {
    if (!activeAccount) {
      alert("Please connect your wallet first");
      return;
    }

    if (
      !maxBorrowsUpdateData.newMaxBorrows ||
      parseFloat(maxBorrowsUpdateData.newMaxBorrows) <= 0
    ) {
      alert("Please enter a valid max borrows amount");
      return;
    }

    try {
      if (isCurrentNetworkAlgorandCompatible()) {
        console.log("maxBorrowsUpdateData", maxBorrowsUpdateData);
        const result = await updateMarketMaxBorrows({
          poolId: maxBorrowsUpdateData.poolId,
          marketId: maxBorrowsUpdateData.marketId,
          newMaxBorrows: BigNumber(maxBorrowsUpdateData.newMaxBorrows)
            .multipliedBy(
              BigNumber(10).pow(selectedMarket.marketInfo?.decimals || 6)
            )
            .toFixed(0),
          userAddress: activeAccount.address,
          signer: transactionSigner,
        });
        console.log("result", result);
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

          await waitForConfirmation(algorandClients.algod, res.txid, 4);

          console.log("Transaction confirmed:", res);
          alert("Max borrows updated successfully!");
          setIsMaxBorrowsUpdateModalOpen(false);
          setMaxBorrowsUpdateData({
            marketId: "",
            poolId: "",
            currentMaxBorrows: "",
            newMaxBorrows: "",
          });
          // Refresh markets data
          loadAllMarkets();
        } else {
          alert(`Failed to update max borrows: ${(result as any).error}`);
        }
      } else if (isCurrentNetworkEVM()) {
        throw new Error("EVM networks are not supported yet");
      } else {
        throw new Error("Unsupported network");
      }
    } catch (error) {
      console.error("Error updating max borrows:", error);
      alert("Failed to update max borrows. Please try again.");
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

          await waitForConfirmation(algorandClients.algod, res.txid, 4);

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
              addr: algosdk.encodeAddress(
                algosdk.getApplicationAddress(Number(poolId)).publicKey
              ),
              sk: new Uint8Array(),
            }
          );

          ci.setFee(2000);
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
              .div(1e12)
              .toNumber();
            console.log(
              "poolCollateralValueUSD",
              poolCollateralValueUSD,
              "type:",
              typeof poolCollateralValueUSD
            );
            const poolBorrowValueUSD = new BigNumber(globalUser[1].toString())
              .div(1e12)
              .toNumber();

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
                  addr: algosdk.encodeAddress(
                    algosdk.getApplicationAddress(Number(poolId)).publicKey
                  ),
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
                const userData = decodeUser(getUserR.returnValue);
                const marketData = decodeMarket(getMarketR.returnValue);

                console.log(`🔍 Raw userData for ${token.symbol}:`, {
                  userData,
                  userDataType: typeof userData,
                  userDataArray: Array.isArray(userData),
                });

                console.log(`🔍 Raw marketData for ${token.symbol}:`, {
                  marketData,
                  marketDataType: typeof marketData,
                  marketDataArray: Array.isArray(marketData),
                });

                // Log each field individually to see what we're getting
                console.log(`🔍 Individual user fields for ${token.symbol}:`, {
                  "[0] scaled_deposits": userData.scaledDeposits,
                  "[1] scaled_borrows": userData.scaledBorrows,
                  "[2] user_deposit_index": userData.depositIndex,
                  "[3] user_borrow_index": userData.borrowIndex,
                  "[4] last_update_time": userData.lastUpdateTime,
                  "[5] last_price": userData.lastPrice,
                });

                console.log(
                  `🔍 Individual market fields for ${token.symbol}:`,
                  {
                    "[8] current_deposit_index": marketData.depositIndex,
                    "[9] current_borrow_index": marketData.borrowIndex,
                    "[13] current_price": marketData.price,
                  }
                );

                // Store data using both token symbol and contract ID as keys for flexibility
                // Use CURRENT market indices, not user's stored indices
                userDataByMarket[marketId] = {
                  scaled_deposits: userData.scaledDeposits.toString(),
                  scaled_borrows: userData.scaledBorrows.toString(),
                  user_deposit_index: userData.depositIndex.toString(), // User's stored index
                  user_borrow_index: userData.borrowIndex.toString(), // User's stored index
                  current_deposit_index: marketData.depositIndex.toString(), // Current market index
                  current_borrow_index: marketData.borrowIndex.toString(), // Current market index
                  last_update_time: Number(userData.lastUpdateTime),
                  last_price: userData.lastPrice.toString(),
                  current_price: marketData.price.toString(),
                };

                // Also store using contract ID as key
                userDataByMarket[token.underlyingContractId] = {
                  scaled_deposits: userData.scaledDeposits.toString(),
                  scaled_borrows: userData.scaledBorrows.toString(),
                  user_deposit_index: userData.depositIndex.toString(), // User's stored index
                  user_borrow_index: userData.borrowIndex.toString(), // User's stored index
                  current_deposit_index: marketData.depositIndex.toString(), // Current market index
                  current_borrow_index: marketData.borrowIndex.toString(), // Current market index
                  last_update_time: Number(userData.lastUpdateTime),
                  last_price: userData.lastPrice.toString(),
                  current_price: marketData.price.toString(),
                };

                console.log(`✅ Processed get_user data for ${token.symbol}:`, {
                  scaled_deposits: userData.scaledDeposits.toString(),
                  scaled_borrows: userData.scaledBorrows.toString(),
                  deposit_index: userData.depositIndex.toString(),
                  borrow_index: userData.borrowIndex.toString(),
                  last_update_time: Number(userData.lastUpdateTime),
                  last_price: userData.lastPrice.toString(),
                  rawScaledDeposits: userData.scaledDeposits,
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
        const marketIndices: Record<
          string,
          { depositIndex: string; borrowIndex: string }
        > = {};

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

              // Store current market indices for Method 4 calculations
              marketIndices[marketId] = {
                depositIndex: marketInfo.depositIndex,
                borrowIndex: marketInfo.borrowIndex,
              };

              // Fetch user-specific market balance data
              let userMarketData = {
                depositedBase: BigInt(0),
                walletBalanceBase: BigInt(0),
                totalStakeSecondsBase: BigInt(0),
                borrowedBase: BigInt(0),
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

                // Fetch borrowed balance using the lending service
                let borrowed = 0n;
                try {
                  const borrowData = await fetchUserBorrowBalance(
                    userAddress,
                    token.poolId || "1",
                    token.underlyingContractId || token.symbol,
                    currentNetwork
                  );
                  const borrowBalance = borrowData?.balance || 0;
                  console.log("borrowBalance", borrowBalance);
                  if (borrowBalance !== null && borrowBalance !== undefined) {
                    // Convert to base units (considering token decimals)
                    borrowed = BigInt(
                      Math.floor(
                        borrowBalance * Math.pow(10, token.decimals || 6)
                      )
                    );
                  }
                } catch (borrowError) {
                  console.warn(
                    `Failed to fetch borrow balance for ${token.symbol}:`,
                    borrowError
                  );
                }

                userMarketData = {
                  depositedBase: deposited,
                  walletBalanceBase: balance,
                  totalStakeSecondsBase: BigInt(10_000_000), // Default value like in PreFi.tsx
                  borrowedBase: borrowed,
                };

                console.log(`✅ REAL user market data for ${token.symbol}:`, {
                  assetType,
                  tokenId,
                  nTokenId,
                  deposited: fromBase(deposited, token.decimals || 6),
                  walletBalance: fromBase(balance, token.decimals || 6),
                  borrowed: fromBase(borrowed, token.decimals || 6),
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
                  borrowedBase: BigInt(0),
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
        setUserMarketIndices(marketIndices);
        console.log("✅ Market data fetch completed:", {
          marketsState,
          marketPrices,
          marketIndices,
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

  // Load Oracle Contract Information
  const loadOracleContractInfo = async () => {
    if (!activeAccount) return;

    setOracleLoading(true);
    try {
      const networkConfig = getCurrentNetworkConfig();
      const contractId = networkConfig.contracts.priceOracle;

      if (!contractId) {
        setOracleContractInfo({
          contractId: undefined,
          isDeployed: false,
          hasPriceOracleRole: false,
          contractState: null,
        });
        return;
      }

      // Check if user has PriceOracle role using the price oracle contract
      const userHasPriceOracleRole = await hasPriceOracleRole();

      // Try to get contract state (if deployed)
      let contractState = null;
      let isDeployed = false;

      if (isCurrentNetworkAlgorandCompatible()) {
        try {
          const clients = algorandService.initializeClients(
            networkConfig.walletNetworkId as AlgorandNetwork
          );

          // Try to get application info to check if deployed
          const appInfo = await clients.algod
            .getApplicationByID(Number(contractId))
            .do();
          console.log("appInfo", appInfo);
          isDeployed = true;
          contractState = {
            appId: appInfo.id,
            creator: algosdk.encodeAddress(appInfo.params.creator.publicKey),
            globalState: appInfo.params.globalState,
          };
        } catch (error) {
          console.log("Contract not deployed or error fetching:", error);
          isDeployed = false;
        }
      }

      setOracleContractInfo({
        contractId,
        isDeployed,
        hasPriceOracleRole: userHasPriceOracleRole,
        contractState,
      });
    } catch (error) {
      console.error("Error loading oracle contract info:", error);
    } finally {
      setOracleLoading(false);
    }
  };

  console.log("🔍 userGetUserData:", userGetUserData);

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

      // Calculate borrowed amount and USD value from marketState
      const borrowedAmount = fromBase(
        marketState.borrowedBase || BigInt(0),
        market.decimals || 6
      );
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

      // Calculate borrowed amount from marketState
      const borrowedAmount = fromBase(
        marketState.borrowedBase || BigInt(0),
        market.decimals || 6
      );
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

        const userDepositIndex =
          getUserData.user_deposit_index || "1000000000000000000"; // 1e18
        const userBorrowIndex =
          getUserData.user_borrow_index || "1000000000000000000"; // 1e18

        const currentDepositIndex =
          getUserData.deposit_index || "1000000000000000000"; // 1e18
        const currentBorrowIndex =
          getUserData.borrow_index || "1000000000000000000"; // 1e18
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
          BigInt(userDepositIndex) === 0n
            ? 0n
            : (BigInt(scaledDeposits) * BigInt(currentDepositIndex)) /
              BigInt(userDepositIndex);

        // Handle case where borrow_index is 0 (no borrows yet)
        const actualBorrowsRaw =
          BigInt(userBorrowIndex) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(currentBorrowIndex)) /
              BigInt(userBorrowIndex);

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

        const actualBorrowsNum =
          Number(actualBorrowsRaw) / 10 ** (market.decimals || 0);

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

  // Method 4 Breakdown - Show detailed get_user data with current market indices
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

      console.log(`getUserData ${market.symbol}`, getUserData);

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

        // User's stored indices (snapshot from last interaction)
        const userDepositIndex =
          getUserData.user_deposit_index || "1000000000000000000"; // 1e18

        const userBorrowIndex =
          getUserData.user_borrow_index || "1000000000000000000"; // 1e18

        // Current market indices (should be used for calculations)
        // Get from market data, not user data
        const marketIndices =
          userMarketIndices[marketId] || userMarketIndices[contractId];

        const currentDepositIndex =
          marketIndices?.depositIndex || userDepositIndex;

        const currentBorrowIndex =
          marketIndices?.borrowIndex || userBorrowIndex;

        const lastPrice = parseFloat(getUserData.last_price || "0") / SCALE;
        const lastUpdateTime = getUserData.last_update_time || 0;

        // Calculate actual amounts using CURRENT market indices (correct approach):
        // actual_deposits = (scaled_deposits * current_deposit_index) // SCALE
        // actual_borrows = (scaled_borrows * current_borrow_index) // SCALE
        const actualDepositsRaw =
          BigInt(userDepositIndex) === 0n
            ? 0n
            : (BigInt(scaledDeposits) * BigInt(currentDepositIndex)) /
              BigInt(userDepositIndex);

        // Handle case where borrow_index is 0 (no borrows yet)
        const actualBorrowsRaw =
          BigInt(userBorrowIndex) === 0n
            ? 0n
            : (BigInt(scaledBorrows) * BigInt(currentBorrowIndex)) /
              BigInt(userBorrowIndex);

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

        console.log(`🔍 Net position for ${market.symbol}:`, {
          depositUSD,
          borrowUSD,
          netPosition,
        });

        // Calculate interest earned/owed since last update
        const depositInterestRaw =
          BigInt(userDepositIndex) > 0n
            ? (BigInt(scaledDeposits) *
                (BigInt(currentDepositIndex) - BigInt(userDepositIndex))) /
              BigInt(userDepositIndex)
            : 0n;

        const borrowInterestRaw =
          BigInt(userBorrowIndex) > 0n
            ? (BigInt(scaledBorrows) *
                (BigInt(currentBorrowIndex) - BigInt(userBorrowIndex))) /
              BigInt(userBorrowIndex)
            : 0n;

        const depositInterestNum =
          Number(depositInterestRaw) / 10 ** (market.decimals || 0);
        const borrowInterestNum =
          Number(borrowInterestRaw) / 10 ** (market.decimals || 0);

        // Calculate scaled deposits/borrows in USD for display
        const scaledDepositsNum =
          Number(scaledDeposits) / 10 ** (market.decimals || 0);
        const scaledBorrowsNum =
          Number(scaledBorrows) / 10 ** (market.decimals || 0);
        const scaledDepositsUSD = scaledDepositsNum * priceToUse;
        const scaledBorrowsUSD = scaledBorrowsNum * priceToUse;

        return {
          symbol: market.symbol,
          marketId: market.underlyingContractId || market.symbol,
          scaledDeposits: scaledDepositsNum,
          scaledBorrows: scaledBorrowsNum,
          scaledDepositsUSD,
          scaledBorrowsUSD,
          userDepositIndex,
          userBorrowIndex,
          currentDepositIndex,
          currentBorrowIndex,
          actualDeposits: actualDepositsNum,
          actualBorrows: actualBorrowsNum,
          depositInterest: depositInterestNum,
          borrowInterest: borrowInterestNum,
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
          scaledDeposits: 0,
          scaledBorrows: 0,
          scaledDepositsUSD: 0,
          scaledBorrowsUSD: 0,
          userDepositIndex: "1000000000000000000",
          userBorrowIndex: "1000000000000000000",
          currentDepositIndex: "1000000000000000000",
          currentBorrowIndex: "1000000000000000000",
          actualDeposits: 0,
          actualBorrows: 0,
          depositInterest: 0,
          borrowInterest: 0,
          lastPrice: currentPrice,
          lastUpdateTime: 0,
          depositUSD: 0,
          borrowUSD: 0,
          netPosition: 0,
          status: "No Data",
        };
      }
    });
  }, [userGetUserData, userMarketPrices, userMarketIndices, currentNetwork]);

  // Market Analysis Functions
  const fetchMarketAnalysisData = useCallback(async () => {
    console.log("📊 Fetching market analysis data for:", {
      timeRange: selectedTimeRange,
      market: selectedMarketForAnalysis,
      network: currentNetwork,
    });

    if (!currentNetwork) {
      console.warn("⚠️ No network selected for market analysis");
      setMarketAnalysisError("No network selected");
      return;
    }

    // Prevent multiple simultaneous fetches
    if (marketAnalysisFetchRef.current) {
      console.log("🔄 Market analysis fetch already in progress, skipping...");
      return;
    }

    marketAnalysisFetchRef.current = true;
    setIsLoadingMarketAnalysis(true);
    setMarketAnalysisError(null);

    try {
      console.log("🔄 Fetching real market data from blockchain...");

      // Fetch real market data from the blockchain
      const realMarkets = await fetchAllMarkets(currentNetwork);
      console.log("📊 Fetched real market data:", realMarkets);

      if (!realMarkets || realMarkets.length === 0) {
        throw new Error("No market data available");
      }

      // Calculate overview metrics from real data
      const totalTVL = realMarkets.reduce((sum, market) => {
        const scaledPrice = parseFloat(market.price) / Math.pow(10, 6);
        const tvl = parseFloat(market.totalDeposits) * scaledPrice;
        return sum + tvl;
      }, 0);

      const totalBorrowed = realMarkets.reduce((sum, market) => {
        const scaledPrice = parseFloat(market.price) / Math.pow(10, 6);
        const borrowed = parseFloat(market.totalBorrows) * scaledPrice;
        return sum + borrowed;
      }, 0);

      const avgUtilizationRate =
        realMarkets.reduce((sum, market) => sum + market.utilizationRate, 0) /
        realMarkets.length;

      const avgAPY =
        realMarkets.reduce((sum, market) => {
          const depositAPY = market.apyCalculation?.apy || 0;
          return sum + depositAPY;
        }, 0) / realMarkets.length;

      // Debug overview calculations
      console.log("📊 Overview Calculations Debug:", {
        totalMarkets: realMarkets.length,
        totalTVL: totalTVL,
        totalBorrowed: totalBorrowed,
        avgUtilizationRate: avgUtilizationRate,
        avgUtilizationRatePercent: Math.round(avgUtilizationRate * 100),
        avgAPY: avgAPY,
        liquidityUtilization: Math.round((totalBorrowed / totalTVL) * 100),
        marketBreakdown: realMarkets.map((market) => ({
          symbol: market.symbol,
          tvl:
            parseFloat(market.totalDeposits) *
            (parseFloat(market.price) / Math.pow(10, 6)),
          borrowed:
            parseFloat(market.totalBorrows) *
            (parseFloat(market.price) / Math.pow(10, 6)),
          utilizationRate: market.utilizationRate,
          depositAPY: market.apyCalculation?.apy || 0,
        })),
      });

      // Process market performance data
      const marketPerformance = realMarkets.map((market) => {
        const scaledPrice = parseFloat(market.price) / Math.pow(10, 6);
        const tvl = parseFloat(market.totalDeposits) * scaledPrice;
        const borrowed = parseFloat(market.totalBorrows) * scaledPrice;

        // Determine risk level based on utilization rate
        let riskLevel: "High" | "Medium" | "Low" = "Low";
        if (market.utilizationRate > 0.8) {
          riskLevel = "High";
        } else if (market.utilizationRate > 0.6) {
          riskLevel = "Medium";
        }

        // Debug information for each market
        console.log(`🔍 Market Debug Info for ${market.symbol}:`, {
          basicInfo: {
            symbol: market.symbol,
            name: market.name,
            poolId: market.poolId,
            marketId: market.marketId,
            decimals: market.decimals,
          },
          rawData: {
            rawPrice: market.price,
            totalDeposits: market.totalDeposits,
            totalBorrows: market.totalBorrows,
            utilizationRate: market.utilizationRate,
            collateralFactor: market.collateralFactor,
            liquidationThreshold: market.liquidationThreshold,
            reserveFactor: market.reserveFactor,
            borrowRate: market.borrowRate,
            slope: market.slope,
          },
          calculatedValues: {
            scaledPrice: scaledPrice,
            tvl: tvl,
            borrowed: borrowed,
            utilizationRatePercent: Math.round(market.utilizationRate * 100),
            depositAPY: market.apyCalculation?.apy || 0,
            borrowAPY: market.borrowApyCalculation?.apy || 0,
            healthFactor: 1 - market.utilizationRate,
            riskLevel: riskLevel,
          },
          apyCalculations: {
            depositAPYCalculation: market.apyCalculation,
            borrowAPYCalculation: market.borrowApyCalculation,
          },
          contractInfo: {
            tokenId: market.tokenId,
            tokenContractId: market.tokenContractId,
            ntokenId: market.ntokenId,
            isActive: market.isActive,
            isPaused: market.isPaused,
            lastUpdated: market.lastUpdated,
          },
        });

        return {
          symbol: market.symbol,
          name: market.name,
          tvl: tvl,
          borrowed: borrowed,
          utilizationRate: Math.round(market.utilizationRate * 100),
          depositAPY: market.apyCalculation?.apy || 0,
          borrowAPY: market.borrowApyCalculation?.apy || 0,
          price: parseFloat(
            (parseFloat(market.price) / Math.pow(10, 6)).toFixed(6)
          ),
          priceChange24h: 0, // TODO: Implement price change tracking
          volume24h: 0, // TODO: Implement volume tracking
          users: 0, // TODO: Implement user count tracking
          healthFactor: 1 - market.utilizationRate, // Simplified health factor
          riskLevel: riskLevel,
          marketInfo: market, // Store full market info for details
        };
      });

      // Categorize markets by risk
      const highRiskMarkets = marketPerformance
        .filter((m) => m.riskLevel === "High")
        .map((m) => m.symbol);
      const mediumRiskMarkets = marketPerformance
        .filter((m) => m.riskLevel === "Medium")
        .map((m) => m.symbol);
      const lowRiskMarkets = marketPerformance
        .filter((m) => m.riskLevel === "Low")
        .map((m) => m.symbol);

      // Calculate overall risk score (0-10 scale)
      const overallRiskScore = Math.min(
        10,
        ((highRiskMarkets.length * 3 + mediumRiskMarkets.length * 1.5) /
          realMarkets.length) *
          10
      );

      // Debug risk analysis
      console.log("⚠️ Risk Analysis Debug:", {
        riskCategorization: {
          highRiskMarkets: highRiskMarkets,
          mediumRiskMarkets: mediumRiskMarkets,
          lowRiskMarkets: lowRiskMarkets,
          highRiskCount: highRiskMarkets.length,
          mediumRiskCount: mediumRiskMarkets.length,
          lowRiskCount: lowRiskMarkets.length,
        },
        riskScoreCalculation: {
          overallRiskScore: overallRiskScore,
          calculation: `(${highRiskMarkets.length} * 3 + ${mediumRiskMarkets.length} * 1.5) / ${realMarkets.length} * 10`,
          maxScore: 10,
        },
        marketRiskBreakdown: marketPerformance.map((market) => ({
          symbol: market.symbol,
          utilizationRate: market.utilizationRate,
          riskLevel: market.riskLevel,
          healthFactor: market.healthFactor,
        })),
      });

      const realAnalysisData = {
        overview: {
          totalMarkets: realMarkets.length,
          totalTVL: totalTVL,
          totalBorrowed: totalBorrowed,
          utilizationRate: Math.round(avgUtilizationRate * 100),
          avgAPY: Math.round(avgAPY * 100) / 100,
          activeUsers: 0, // TODO: Implement user tracking
          dailyVolume: 0, // TODO: Implement volume tracking
        },
        marketPerformance: marketPerformance,
        trends: {
          // TODO: Implement historical data tracking
          tvlGrowth: [
            {
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.9,
            },
            {
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.92,
            },
            {
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.95,
            },
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.97,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.98,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: totalTVL * 0.99,
            },
            { date: new Date().toISOString().split("T")[0], value: totalTVL },
          ],
          utilizationRate: [
            {
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.9,
            },
            {
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.92,
            },
            {
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.95,
            },
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.97,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.98,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgUtilizationRate * 100 * 0.99,
            },
            {
              date: new Date().toISOString().split("T")[0],
              value: avgUtilizationRate * 100,
            },
          ],
          avgAPY: [
            {
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.9,
            },
            {
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.92,
            },
            {
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.95,
            },
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.97,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.98,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: avgAPY * 0.99,
            },
            { date: new Date().toISOString().split("T")[0], value: avgAPY },
          ],
        },
        riskAnalysis: {
          highRiskMarkets: highRiskMarkets,
          mediumRiskMarkets: mediumRiskMarkets,
          lowRiskMarkets: lowRiskMarkets,
          overallRiskScore: Math.round(overallRiskScore * 10) / 10,
          recommendations: [
            highRiskMarkets.length > 0
              ? `Monitor ${highRiskMarkets.join(
                  ", "
                )} markets closely due to high utilization rates`
              : "All markets have healthy utilization rates",
            avgUtilizationRate > 0.7
              ? "Consider increasing interest rates to manage high utilization"
              : "Utilization rates are within normal ranges",
            "Regularly review collateral factors and liquidation thresholds",
          ],
        },
        liquidityAnalysis: {
          totalLiquidity: totalTVL,
          availableLiquidity: totalTVL - totalBorrowed,
          lockedLiquidity: totalBorrowed,
          liquidityUtilization: Math.round((totalBorrowed / totalTVL) * 100),
          liquidityProviders: 0, // TODO: Implement provider tracking
          avgLiquidityPerProvider: 0, // TODO: Implement provider tracking
        },
        lastUpdated: new Date().toISOString(),
      };

      setMarketAnalysisData(realAnalysisData);

      // Final debug summary
      console.log("✅ Market Analysis Data Processing Complete:", {
        summary: {
          totalMarkets: realMarkets.length,
          totalTVL: totalTVL,
          totalBorrowed: totalBorrowed,
          avgUtilizationRate: Math.round(avgUtilizationRate * 100) + "%",
          avgAPY: Math.round(avgAPY * 100) / 100 + "%",
          overallRiskScore: overallRiskScore + "/10",
          highRiskMarkets: highRiskMarkets.length,
          mediumRiskMarkets: mediumRiskMarkets.length,
          lowRiskMarkets: lowRiskMarkets.length,
        },
        dataStructure: {
          overview: Object.keys(realAnalysisData.overview),
          marketPerformance:
            realAnalysisData.marketPerformance.length + " markets",
          riskAnalysis: Object.keys(realAnalysisData.riskAnalysis),
          liquidityAnalysis: Object.keys(realAnalysisData.liquidityAnalysis),
        },
        timestamp: new Date().toISOString(),
      });

      console.log("✅ Real market analysis data loaded successfully");
    } catch (error) {
      console.error("❌ Failed to fetch market analysis data:", error);
      setMarketAnalysisError("Failed to load market analysis data");
    } finally {
      setIsLoadingMarketAnalysis(false);
      marketAnalysisFetchRef.current = false;
    }
  }, [selectedTimeRange, selectedMarketForAnalysis, currentNetwork, markets]);

  const refreshMarketAnalysis = useCallback(() => {
    // Reset the ref to allow manual refresh even if fetch is in progress
    marketAnalysisFetchRef.current = false;
    fetchMarketAnalysisData();
  }, [fetchMarketAnalysisData]);

  // Individual Market Details Functions
  const fetchMarketDetails = useCallback(
    async (marketSymbol: string) => {
      console.log("📊 Fetching detailed data for market:", marketSymbol);

      setIsLoadingMarketDetails(true);
      setSelectedMarketDetails(null);

      try {
        // Find the market in the current analysis data
        const marketPerformance = marketAnalysisData?.marketPerformance;
        const marketData = marketPerformance?.find(
          (m: any) => m.symbol === marketSymbol
        );

        if (!marketData || !marketData.marketInfo) {
          throw new Error(`Market ${marketSymbol} not found in current data`);
        }

        const marketInfo: MarketInfo = marketData.marketInfo;
        const configMarket = markets.find((m) => m.symbol === marketSymbol);

        if (!configMarket) {
          throw new Error(`Market ${marketSymbol} not found in configuration`);
        }

        // Calculate real metrics
        const scaledPrice = parseFloat(marketInfo.price) / Math.pow(10, 6);
        const tvl = parseFloat(marketInfo.totalDeposits) * scaledPrice;
        const borrowed = parseFloat(marketInfo.totalBorrows) * scaledPrice;
        const utilizationRate = marketInfo.utilizationRate * 100;

        // Debug individual market details
        console.log(`🔍 Individual Market Details Debug for ${marketSymbol}:`, {
          marketSymbol: marketSymbol,
          configMarket: configMarket,
          marketInfo: {
            symbol: marketInfo.symbol,
            name: marketInfo.name,
            poolId: marketInfo.poolId,
            marketId: marketInfo.marketId,
            decimals: marketInfo.decimals,
            price: marketInfo.price,
            totalDeposits: marketInfo.totalDeposits,
            totalBorrows: marketInfo.totalBorrows,
            utilizationRate: marketInfo.utilizationRate,
            collateralFactor: marketInfo.collateralFactor,
            liquidationThreshold: marketInfo.liquidationThreshold,
            reserveFactor: marketInfo.reserveFactor,
            borrowRate: marketInfo.borrowRate,
            slope: marketInfo.slope,
            isActive: marketInfo.isActive,
            isPaused: marketInfo.isPaused,
            lastUpdated: marketInfo.lastUpdated,
          },
          calculations: {
            scaledPrice: scaledPrice,
            tvl: tvl,
            borrowed: borrowed,
            utilizationRatePercent: utilizationRate,
            healthFactor: 1 - marketInfo.utilizationRate,
          },
          apyCalculations: {
            depositAPY: marketInfo.apyCalculation?.apy || 0,
            borrowAPY: marketInfo.borrowApyCalculation?.apy || 0,
            depositAPYCalculation: marketInfo.apyCalculation,
            borrowAPYCalculation: marketInfo.borrowApyCalculation,
          },
        });

        // Determine risk level
        let riskLevel: "High" | "Medium" | "Low" = "Low";
        if (marketInfo.utilizationRate > 0.8) {
          riskLevel = "High";
        } else if (marketInfo.utilizationRate > 0.6) {
          riskLevel = "Medium";
        }

        const detailedMarketData = {
          basicInfo: {
            symbol: marketInfo.symbol,
            name: marketInfo.name,
            contractId: configMarket.underlyingContractId,
            assetId: configMarket.underlyingAssetId,
            decimals: marketInfo.decimals,
            isSmartContract: configMarket.isSmartContract,
            poolId: marketInfo.poolId,
          },
          currentMetrics: {
            tvl: tvl,
            borrowed: borrowed,
            utilizationRate: Math.round(utilizationRate),
            depositAPY: marketInfo.apyCalculation?.apy || 0,
            borrowAPY: marketInfo.borrowApyCalculation?.apy || 0,
            price: parseFloat(
              (parseFloat(marketInfo.price) / Math.pow(10, 6)).toFixed(6)
            ),
            priceChange24h: 0, // TODO: Implement price change tracking
            volume24h: 0, // TODO: Implement volume tracking
            users: 0, // TODO: Implement user tracking
            healthFactor: 1 - marketInfo.utilizationRate,
            riskLevel: riskLevel,
          },
          historicalData: {
            // TODO: Implement real historical data tracking
            tvlHistory: Array.from({ length: 30 }, (_, i) => ({
              date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: tvl * (0.8 + Math.random() * 0.4), // Simulate historical variation
            })),
            utilizationHistory: Array.from({ length: 30 }, (_, i) => ({
              date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: utilizationRate * (0.7 + Math.random() * 0.6), // Simulate historical variation
            })),
            apyHistory: Array.from({ length: 30 }, (_, i) => ({
              date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              depositAPY:
                (marketInfo.apyCalculation?.apy || 0) *
                (0.8 + Math.random() * 0.4),
              borrowAPY:
                (marketInfo.borrowApyCalculation?.apy || 0) *
                (0.8 + Math.random() * 0.4),
            })),
            priceHistory: Array.from({ length: 30 }, (_, i) => ({
              date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              value: scaledPrice * (0.9 + Math.random() * 0.2), // Simulate historical variation
            })),
          },
          userActivity: {
            // TODO: Implement real user activity tracking
            totalUsers: 0,
            activeUsers24h: 0,
            newUsers7d: 0,
            topDepositors: [], // TODO: Implement real depositor tracking
            topBorrowers: [], // TODO: Implement real borrower tracking
          },
          riskMetrics: {
            liquidationThreshold: marketInfo.liquidationThreshold * 100,
            currentLiquidationRisk:
              marketInfo.utilizationRate > 0.8
                ? marketInfo.utilizationRate * 100
                : 0,
            collateralFactor: marketInfo.collateralFactor * 100,
            maxLTV: marketInfo.collateralFactor * 100, // Using collateral factor as max LTV
            volatility: 0, // TODO: Implement volatility calculation
            correlationWithETH: 0, // TODO: Implement correlation calculation
          },
          protocolParameters: {
            reserveFactor: marketInfo.reserveFactor * 100,
            interestRateModel: "Jump Rate Model", // TODO: Get from contract
            kinkUtilizationRate: 80, // TODO: Get from contract
            baseRate: marketInfo.borrowRate * 100,
            multiplier: marketInfo.slope * 100,
            jumpMultiplier: 10, // TODO: Get from contract
          },
          lastUpdated: marketInfo.lastUpdated,
        };

        setSelectedMarketDetails(detailedMarketData);
        console.log(
          "✅ Real market details loaded successfully for:",
          marketSymbol
        );
      } catch (error) {
        console.error("❌ Failed to fetch market details:", error);
        toast.error(`Failed to load details for ${marketSymbol}`);
      } finally {
        setIsLoadingMarketDetails(false);
      }
    },
    [markets, marketAnalysisData]
  );

  const handleViewMarketDetails = useCallback(
    (marketSymbol: string) => {
      setIsMarketDetailsModalOpen(true);
      fetchMarketDetails(marketSymbol);
    },
    [fetchMarketDetails]
  );

  // Load market analysis data when component mounts or dependencies change
  React.useEffect(() => {
    if (activeTab === "market-analysis") {
      fetchMarketAnalysisData();
    }
  }, [activeTab, selectedTimeRange, selectedMarketForAnalysis, currentNetwork]);

  // Load SToken info when SToken tab is active
  React.useEffect(() => {
    if (activeTab === "stoken") {
      loadStokenInfo();
      checkStokenMarketExists();
    }
  }, [activeTab, currentNetwork]);

  // Initialize selected lending pool when network changes
  React.useEffect(() => {
    const lendingPools = getLendingPools(currentNetwork);
    if (lendingPools.length > 0 && !selectedLendingPool) {
      setSelectedLendingPool(lendingPools[0]);
    }
  }, [currentNetwork, selectedLendingPool]);

  // Load Oracle contract info when PriceOracle or PriceFeedManager tab is active
  React.useEffect(() => {
    if (activeTab === "price-oracle" || activeTab === "price-feed-manager") {
      loadOracleContractInfo();
      if (selectedLendingPool && activeTab === "price-feed-manager") {
        loadPriceFeedStatus();
        loadLendingPoolPriceFeeds();
        loadMarketData();
      }
      // Load asset prices when oracle contract is available
      if (oracleContractInfo.contractId && oracleContractInfo.isDeployed) {
        loadAssetPrices();
      }
    }
  }, [
    activeTab,
    currentNetwork,
    activeAccount?.address,
    selectedLendingPool,
    oracleContractInfo.contractId,
    oracleContractInfo.isDeployed,
  ]);

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
          <div className="space-y-0">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="markets" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                <span className="hidden sm:inline">Markets</span>
              </TabsTrigger>
              <TabsTrigger
                value="operations"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Operations</span>
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Roles</span>
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Second row for Market Analysis, User Analysis, SToken, Price Feed Manager and Price Oracle */}
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
              <TabsTrigger
                value="market-analysis"
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Market Analysis</span>
              </TabsTrigger>
              <TabsTrigger
                value="user-analysis"
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                <span>User Analysis</span>
              </TabsTrigger>
              <TabsTrigger value="stoken" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>SToken</span>
              </TabsTrigger>
              <TabsTrigger
                value="price-feed-manager"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                <span>Price Feed Manager</span>
              </TabsTrigger>
              <TabsTrigger
                value="price-oracle"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                <span>Price Oracle</span>
              </TabsTrigger>
            </TabsList>
          </div>

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

                      <div className="space-y-2">
                        {/* First row: Main actions */}
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
                        </div>

                        {/* Second row: Max limits and delete */}
                        <div className="flex gap-2">
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
                            className="flex-1"
                            onClick={() => handleEditMaxBorrows(market)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Max Borrows
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive flex-1"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
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

          {/* Market Analysis Tab */}
          <TabsContent value="market-analysis" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Market Analysis</H2>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedTimeRange}
                  onValueChange={setSelectedTimeRange}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24h</SelectItem>
                    <SelectItem value="7d">7d</SelectItem>
                    <SelectItem value="30d">30d</SelectItem>
                    <SelectItem value="90d">90d</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedMarketForAnalysis}
                  onValueChange={setSelectedMarketForAnalysis}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Markets</SelectItem>
                    {markets.map((market) => (
                      <SelectItem key={market.symbol} value={market.symbol}>
                        {market.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DorkFiButton
                  onClick={refreshMarketAnalysis}
                  disabled={isLoadingMarketAnalysis}
                  className="flex items-center gap-2"
                >
                  {isLoadingMarketAnalysis ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Refresh</span>
                </DorkFiButton>
              </div>
            </div>

            {isLoadingMarketAnalysis ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading market analysis...</span>
                </div>
              </div>
            ) : marketAnalysisError ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 dark:text-red-400">
                    {marketAnalysisError}
                  </p>
                  <DorkFiButton
                    onClick={refreshMarketAnalysis}
                    className="mt-4"
                  >
                    Try Again
                  </DorkFiButton>
                </div>
              </div>
            ) : marketAnalysisData ? (
              <div className="space-y-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total TVL
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        $
                        {(
                          marketAnalysisData.overview.totalTVL / 1000000
                        ).toFixed(2)}
                        M
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +12.5% from last period
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Borrowed
                      </CardTitle>
                      <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        $
                        {(
                          marketAnalysisData.overview.totalBorrowed / 1000000
                        ).toFixed(2)}
                        M
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Utilization:{" "}
                        {marketAnalysisData.overview.utilizationRate}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Avg APY
                      </CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {marketAnalysisData.overview.avgAPY}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Across all markets
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Active Users
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {marketAnalysisData.overview.activeUsers.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Daily volume: $
                        {(
                          marketAnalysisData.overview.dailyVolume / 1000000
                        ).toFixed(1)}
                        M
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Market Performance Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Market Performance</CardTitle>
                    <CardDescription>
                      Detailed analysis of all markets in the protocol
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Market</th>
                            <th className="text-right p-2">TVL</th>
                            <th className="text-right p-2">Borrowed</th>
                            <th className="text-right p-2">Utilization</th>
                            <th className="text-right p-2">Deposit APY</th>
                            <th className="text-right p-2">Borrow APY</th>
                            <th className="text-right p-2">Price</th>
                            <th className="text-right p-2">24h Change</th>
                            <th className="text-right p-2">Volume</th>
                            <th className="text-center p-2">Risk</th>
                            <th className="text-center p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketAnalysisData.marketPerformance.map(
                            (market: any, index: number) => (
                              <tr
                                key={market.symbol}
                                className="border-b hover:bg-muted/50"
                              >
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                      {market.symbol.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {market.symbol}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {market.name}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  ${(market.tvl / 1000000).toFixed(2)}M
                                </td>
                                <td className="text-right p-2">
                                  ${(market.borrowed / 1000000).toFixed(2)}M
                                </td>
                                <td className="text-right p-2">
                                  <div className="flex items-center justify-end gap-1">
                                    <span>{market.utilizationRate}%</span>
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        market.utilizationRate > 80
                                          ? "bg-red-500"
                                          : market.utilizationRate > 60
                                          ? "bg-yellow-500"
                                          : "bg-green-500"
                                      }`}
                                    />
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <span className="text-green-600 dark:text-green-400">
                                    {market.depositAPY.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="text-right p-2">
                                  <span className="text-red-600 dark:text-red-400">
                                    {market.borrowAPY.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="text-right p-2">
                                  ${market.price.toFixed(6)}
                                </td>
                                <td className="text-right p-2">
                                  <span
                                    className={`${
                                      market.priceChange24h >= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {market.priceChange24h >= 0 ? "+" : ""}
                                    {market.priceChange24h.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="text-right p-2">
                                  ${(market.volume24h / 1000).toFixed(0)}K
                                </td>
                                <td className="text-center p-2">
                                  <Badge
                                    variant={
                                      market.riskLevel === "High"
                                        ? "destructive"
                                        : market.riskLevel === "Medium"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {market.riskLevel}
                                  </Badge>
                                </td>
                                <td className="text-center p-2">
                                  <DorkFiButton
                                    onClick={() =>
                                      handleViewMarketDetails(market.symbol)
                                    }
                                    className="flex items-center gap-1 text-xs px-2 py-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span className="hidden sm:inline">
                                      Details
                                    </span>
                                  </DorkFiButton>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Analysis</CardTitle>
                      <CardDescription>
                        Overall risk assessment and recommendations
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Overall Risk Score
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  (marketAnalysisData.riskAnalysis
                                    .overallRiskScore /
                                    10) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold">
                            {marketAnalysisData.riskAnalysis.overallRiskScore}
                            /10
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">High Risk Markets</span>
                          <Badge variant="destructive" className="text-xs">
                            {
                              marketAnalysisData.riskAnalysis.highRiskMarkets
                                .length
                            }
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Medium Risk Markets</span>
                          <Badge variant="default" className="text-xs">
                            {
                              marketAnalysisData.riskAnalysis.mediumRiskMarkets
                                .length
                            }
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Low Risk Markets</span>
                          <Badge variant="secondary" className="text-xs">
                            {
                              marketAnalysisData.riskAnalysis.lowRiskMarkets
                                .length
                            }
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Recommendations</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {marketAnalysisData.riskAnalysis.recommendations.map(
                            (rec: string, index: number) => (
                              <li
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <span className="text-primary">•</span>
                                <span>{rec}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Liquidity Analysis</CardTitle>
                      <CardDescription>
                        Current liquidity distribution and utilization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Total Liquidity</span>
                          <span className="font-medium">
                            $
                            {(
                              marketAnalysisData.liquidityAnalysis
                                .totalLiquidity / 1000000
                            ).toFixed(2)}
                            M
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Available Liquidity</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            $
                            {(
                              marketAnalysisData.liquidityAnalysis
                                .availableLiquidity / 1000000
                            ).toFixed(2)}
                            M
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Locked Liquidity</span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">
                            $
                            {(
                              marketAnalysisData.liquidityAnalysis
                                .lockedLiquidity / 1000000
                            ).toFixed(2)}
                            M
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Liquidity Utilization
                          </span>
                          <span className="font-bold">
                            {
                              marketAnalysisData.liquidityAnalysis
                                .liquidityUtilization
                            }
                            %
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${marketAnalysisData.liquidityAnalysis.liquidityUtilization}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {
                              marketAnalysisData.liquidityAnalysis
                                .liquidityProviders
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Providers
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            $
                            {(
                              marketAnalysisData.liquidityAnalysis
                                .avgLiquidityPerProvider / 1000
                            ).toFixed(0)}
                            K
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg per Provider
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Last Updated */}
                <div className="text-center text-sm text-muted-foreground">
                  Last updated:{" "}
                  {new Date(marketAnalysisData.lastUpdated).toLocaleString()}
                </div>
              </div>
            ) : null}

            {/* Individual Market Details Modal */}
            <Dialog
              open={isMarketDetailsModalOpen}
              onOpenChange={setIsMarketDetailsModalOpen}
            >
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {selectedMarketDetails?.basicInfo?.symbol?.charAt(0) ||
                        "?"}
                    </div>
                    {selectedMarketDetails?.basicInfo?.symbol} Market Details
                  </DialogTitle>
                  <DialogDescription>
                    Comprehensive analysis and metrics for{" "}
                    {selectedMarketDetails?.basicInfo?.name}
                  </DialogDescription>
                </DialogHeader>

                {isLoadingMarketDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Loading market details...</span>
                    </div>
                  </div>
                ) : selectedMarketDetails ? (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-sm font-medium">
                              Symbol
                            </Label>
                            <p className="text-lg font-bold">
                              {selectedMarketDetails.basicInfo.symbol}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Name</Label>
                            <p className="text-lg">
                              {selectedMarketDetails.basicInfo.name}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">
                              Decimals
                            </Label>
                            <p className="text-lg">
                              {selectedMarketDetails.basicInfo.decimals}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">
                              Pool ID
                            </Label>
                            <p className="text-lg">
                              {selectedMarketDetails.basicInfo.poolId}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div>
                            <Label className="text-sm font-medium">
                              Contract ID
                            </Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">
                              {selectedMarketDetails.basicInfo.contractId}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">
                              Asset ID
                            </Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">
                              {selectedMarketDetails.basicInfo.assetId}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Current Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Total Value Locked
                          </CardTitle>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            $
                            {(
                              selectedMarketDetails.currentMetrics.tvl / 1000000
                            ).toFixed(2)}
                            M
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Utilization:{" "}
                            {
                              selectedMarketDetails.currentMetrics
                                .utilizationRate
                            }
                            %
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Total Borrowed
                          </CardTitle>
                          <Coins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            $
                            {(
                              selectedMarketDetails.currentMetrics.borrowed /
                              1000000
                            ).toFixed(2)}
                            M
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Health Factor:{" "}
                            {selectedMarketDetails.currentMetrics.healthFactor.toFixed(
                              2
                            )}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Deposit APY
                          </CardTitle>
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {selectedMarketDetails.currentMetrics.depositAPY.toFixed(
                              2
                            )}
                            %
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Borrow APY:{" "}
                            {selectedMarketDetails.currentMetrics.borrowAPY.toFixed(
                              2
                            )}
                            %
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Current Price
                          </CardTitle>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            $
                            {selectedMarketDetails.currentMetrics.price.toFixed(
                              6
                            )}
                          </div>
                          <p
                            className={`text-xs ${
                              selectedMarketDetails.currentMetrics
                                .priceChange24h >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {selectedMarketDetails.currentMetrics
                              .priceChange24h >= 0
                              ? "+"
                              : ""}
                            {selectedMarketDetails.currentMetrics.priceChange24h.toFixed(
                              2
                            )}
                            % (24h)
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Risk Metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Risk Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">
                                Liquidation Threshold
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.riskMetrics
                                    .liquidationThreshold
                                }
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Current Liquidation Risk
                              </Label>
                              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                {selectedMarketDetails.riskMetrics.currentLiquidationRisk.toFixed(
                                  1
                                )}
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Collateral Factor
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.riskMetrics
                                    .collateralFactor
                                }
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Max LTV
                              </Label>
                              <p className="text-lg font-bold">
                                {selectedMarketDetails.riskMetrics.maxLTV}%
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Volatility
                              </Label>
                              <span className="font-bold">
                                {selectedMarketDetails.riskMetrics.volatility.toFixed(
                                  1
                                )}
                                %
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-yellow-500 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    selectedMarketDetails.riskMetrics
                                      .volatility,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Correlation with ETH
                              </Label>
                              <span className="font-bold">
                                {(
                                  selectedMarketDetails.riskMetrics
                                    .correlationWithETH * 100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{
                                  width: `${
                                    selectedMarketDetails.riskMetrics
                                      .correlationWithETH * 100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Protocol Parameters</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">
                                Reserve Factor
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.protocolParameters
                                    .reserveFactor
                                }
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Kink Utilization
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.protocolParameters
                                    .kinkUtilizationRate
                                }
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Base Rate
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.protocolParameters
                                    .baseRate
                                }
                                %
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                Multiplier
                              </Label>
                              <p className="text-lg font-bold">
                                {
                                  selectedMarketDetails.protocolParameters
                                    .multiplier
                                }
                                x
                              </p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">
                              Interest Rate Model
                            </Label>
                            <p className="text-sm bg-muted p-2 rounded">
                              {
                                selectedMarketDetails.protocolParameters
                                  .interestRateModel
                              }
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* User Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>User Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold">
                                {selectedMarketDetails.userActivity.totalUsers}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total Users
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold">
                                {
                                  selectedMarketDetails.userActivity
                                    .activeUsers24h
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Active (24h)
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold">
                                {selectedMarketDetails.userActivity.newUsers7d}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                New (7d)
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Top Depositors</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedMarketDetails.userActivity.topDepositors.map(
                              (depositor: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      #{index + 1}
                                    </span>
                                    <span className="text-xs font-mono">
                                      {depositor.address.slice(0, 6)}...
                                      {depositor.address.slice(-4)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold">
                                      ${(depositor.amount / 1000).toFixed(0)}K
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {depositor.percentage.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Last Updated */}
                    <div className="text-center text-sm text-muted-foreground">
                      Last updated:{" "}
                      {new Date(
                        selectedMarketDetails.lastUpdated
                      ).toLocaleString()}
                    </div>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
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
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-muted/30 rounded-lg">
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
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">
                            {method4Breakdown
                              .reduce((sum, m) => sum + m.depositInterest, 0)
                              .toFixed(6)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Deposit Interest
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-400">
                            {method4Breakdown
                              .reduce((sum, m) => sum + m.borrowInterest, 0)
                              .toFixed(6)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Borrow Interest
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

                      {/* Index Discrepancy Alert */}
                      {method4Breakdown.some(
                        (market) =>
                          market.userDepositIndex !==
                            market.currentDepositIndex ||
                          market.userBorrowIndex !== market.currentBorrowIndex
                      ) && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                Index Discrepancies Detected
                              </h4>
                              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                                Some markets show differences between user's
                                stored indices and current market indices. This
                                indicates accrued interest since the user's last
                                interaction.
                              </p>
                              <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                                <p>
                                  <strong>Markets with discrepancies:</strong>
                                </p>
                                <ul className="list-disc list-inside mt-1">
                                  {method4Breakdown
                                    .filter(
                                      (market) =>
                                        market.userDepositIndex !==
                                          market.currentDepositIndex ||
                                        market.userBorrowIndex !==
                                          market.currentBorrowIndex
                                    )
                                    .map((market) => (
                                      <li key={market.symbol}>
                                        {market.symbol}: Deposit{" "}
                                        {market.depositInterest > 0
                                          ? `+${market.depositInterest.toFixed(
                                              6
                                            )}`
                                          : "0"}
                                        , Borrow{" "}
                                        {market.borrowInterest > 0
                                          ? `+${market.borrowInterest.toFixed(
                                              6
                                            )}`
                                          : "0"}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Market Details Table */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                          Market Details (get_user) - Index Inspection
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left p-2">Market</th>
                                <th className="text-right p-2">
                                  Scaled Deposits (USD)
                                </th>
                                <th className="text-right p-2">
                                  Scaled Borrows (USD)
                                </th>
                                <th className="text-right p-2">
                                  User Deposit Index
                                </th>
                                <th className="text-right p-2">
                                  Current Deposit Index
                                </th>
                                <th className="text-right p-2">
                                  User Borrow Index
                                </th>
                                <th className="text-right p-2">
                                  Current Borrow Index
                                </th>
                                <th className="text-right p-2">
                                  Deposit Interest
                                </th>
                                <th className="text-right p-2">
                                  Borrow Interest
                                </th>
                                <th className="text-right p-2">
                                  Actual Deposits
                                </th>
                                <th className="text-right p-2">
                                  Actual Borrows
                                </th>
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
                                    $
                                    {market.scaledDepositsUSD?.toFixed(2) ||
                                      "0.00"}
                                  </td>
                                  <td className="text-right p-2 text-xs">
                                    $
                                    {market.scaledBorrowsUSD?.toFixed(2) ||
                                      "0.00"}
                                  </td>
                                  <td className="text-right p-2 text-xs font-mono">
                                    {market.userDepositIndex}
                                  </td>
                                  <td className="text-right p-2 text-xs font-mono text-green-400">
                                    {market.currentDepositIndex}
                                  </td>
                                  <td className="text-right p-2 text-xs font-mono">
                                    {market.userBorrowIndex}
                                  </td>
                                  <td className="text-right p-2 text-xs font-mono text-green-400">
                                    {market.currentBorrowIndex}
                                  </td>
                                  <td className="text-right p-2 text-xs text-green-400">
                                    {market.depositInterest > 0
                                      ? `+${market.depositInterest.toFixed(6)}`
                                      : "0"}
                                  </td>
                                  <td className="text-right p-2 text-xs text-red-400">
                                    {market.borrowInterest > 0
                                      ? `+${market.borrowInterest.toFixed(6)}`
                                      : "0"}
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

                      {/* Raw Data Inspection */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              Raw Data Inspection
                            </h4>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRawData(!showRawData)}
                            className="text-xs"
                          >
                            {showRawData ? "Hide" : "Show"} Raw Data
                          </Button>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Raw contract data for debugging and verification
                        </p>

                        {/* Quick Summary */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            <div className="font-medium text-gray-600 dark:text-gray-400">
                              User Markets
                            </div>
                            <div className="text-gray-800 dark:text-gray-200">
                              {Object.keys(userGetUserData).length} markets
                            </div>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            <div className="font-medium text-gray-600 dark:text-gray-400">
                              Market Indices
                            </div>
                            <div className="text-gray-800 dark:text-gray-200">
                              {Object.keys(userMarketIndices).length} markets
                            </div>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            <div className="font-medium text-gray-600 dark:text-gray-400">
                              Market Prices
                            </div>
                            <div className="text-gray-800 dark:text-gray-200">
                              {Object.keys(userMarketPrices).length} markets
                            </div>
                          </div>
                        </div>

                        {showRawData && (
                          <div className="mt-4 space-y-4">
                            {/* User Data */}
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                User Data (get_user):
                              </h5>
                              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto max-h-64">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(userGetUserData, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Market Indices */}
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Current Market Indices (get_market):
                              </h5>
                              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto max-h-64">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(userMarketIndices, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Market Prices */}
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Market Prices:
                              </h5>
                              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto max-h-64">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(userMarketPrices, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Method 4 Breakdown Raw */}
                            <div>
                              <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Method 4 Breakdown (Calculated):
                              </h5>
                              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto max-h-96">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(method4Breakdown, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Method 4 Explanation */}
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200">
                              Method 4: get_user Contract Method - Index
                              Inspection
                            </h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                              This method uses the smart contract's get_user
                              method to fetch individual user position data for
                              each market. It shows both user's stored indices
                              (snapshot from last interaction) and current
                              market indices to inspect potential index
                              calculation issues.
                            </p>
                            <div className="text-xs text-purple-600 dark:text-purple-400 mt-2 space-y-1">
                              <p>
                                <strong>Correct Formula:</strong>{" "}
                                actual_deposits = (scaled_deposits ×
                                current_deposit_index) ÷ SCALE
                              </p>
                              <p>
                                <strong>Previous Issue:</strong> Used user's
                                stored indices instead of current market indices
                              </p>
                              <p>
                                <strong>Interest Calculation:</strong>{" "}
                                deposit_interest = scaled_deposits ×
                                (current_index - user_index) ÷ SCALE
                              </p>
                            </div>
                            <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                              <p className="text-xs text-green-800 dark:text-green-200">
                                <strong>✅ Index Issue Fixed:</strong> Method 4
                                now fetches current market indices from the
                                contract's get_market method and uses them for
                                calculations instead of user's stored indices,
                                ensuring accurate position values including
                                accrued interest.
                              </p>
                            </div>
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

          {/* SToken Tab */}
          <TabsContent value="stoken" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>SToken Management</H2>
              <DorkFiButton
                onClick={loadStokenInfo}
                disabled={isLoadingStokenInfo}
                className="flex items-center gap-2"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${
                    isLoadingStokenInfo ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </DorkFiButton>
            </div>

            {/* SToken Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  SToken Information
                </CardTitle>
                <CardDescription>
                  View SToken contract details and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStokenInfo ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading SToken info...</span>
                  </div>
                ) : stokenError ? (
                  <div className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 inline mr-2" />
                    {stokenError}
                  </div>
                ) : stokenInfo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Name
                      </Label>
                      <div className="text-lg font-semibold">
                        {stokenInfo.name}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Symbol
                      </Label>
                      <div className="text-lg font-semibold">
                        {stokenInfo.symbol}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Decimals
                      </Label>
                      <div className="text-lg font-semibold">
                        {stokenInfo.decimals}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Total Supply
                      </Label>
                      <div className="text-lg font-semibold">
                        {new BigNumber(stokenInfo.totalSupply)
                          .dividedBy(Math.pow(10, Number(stokenInfo.decimals)))
                          .toFixed(2)}{" "}
                        {stokenInfo.symbol}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Contract ID
                      </Label>
                      <div className="text-sm font-mono break-all">
                        {stokenInfo.contractId}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Contract Address
                      </Label>
                      <div className="text-sm font-mono break-all">
                        {stokenInfo.contractAddress}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Status
                      </Label>
                      <Badge
                        variant={stokenInfo.paused ? "destructive" : "default"}
                      >
                        {stokenInfo.paused ? "Paused" : "Active"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No SToken information available. Click refresh to load.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Minter Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Minter Management
                </CardTitle>
                <CardDescription>
                  Approve or revoke minter permissions for lending pools
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Approve Minter */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="minter-address">
                      Minter Address or Application ID
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="minter-address"
                        placeholder="Enter lending pool contract ID or application ID"
                        value={minterAddress}
                        onChange={(e) => setMinterAddress(e.target.value)}
                        className="flex-1"
                      />
                      <DorkFiButton
                        onClick={handleApproveMinter}
                        disabled={isApprovingMinter || !minterAddress.trim()}
                        className="flex items-center gap-2"
                      >
                        {isApprovingMinter ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve Minter
                      </DorkFiButton>
                    </div>
                    {minterApprovalError && (
                      <div className="text-red-500 text-sm mt-2">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        {minterApprovalError}
                      </div>
                    )}
                    {minterApprovalResult && (
                      <div className="text-green-500 text-sm mt-2">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        {minterApprovalResult}
                      </div>
                    )}
                  </div>
                </div>

                {/* Approved Minters List */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">
                    Approved Minters
                  </Label>
                  {approvedMinters.length > 0 ? (
                    <div className="space-y-2">
                      {approvedMinters.map((minter, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{minter}</span>
                            <Badge variant="default">Approved</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <DorkFiButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleSetStoken(minter)}
                              disabled={isSettingStoken}
                              className="flex items-center gap-1"
                            >
                              {isSettingStoken ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Settings className="h-3 w-3" />
                              )}
                              Set SToken
                            </DorkFiButton>
                            <DorkFiButton
                              variant="critical"
                              size="sm"
                              onClick={() => handleRevokeMinter(minter)}
                              disabled={isRevokingMinter}
                              className="flex items-center gap-1"
                            >
                              {isRevokingMinter ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              Revoke
                            </DorkFiButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No approved minters found
                    </div>
                  )}
                  {minterRevocationError && (
                    <div className="text-red-500 text-sm">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {minterRevocationError}
                    </div>
                  )}
                  {minterRevocationResult && (
                    <div className="text-green-500 text-sm">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      {minterRevocationResult}
                    </div>
                  )}
                  {setStokenOperationError && (
                    <div className="text-red-500 text-sm">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {setStokenOperationError}
                    </div>
                  )}
                  {setStokenResult && (
                    <div className="text-green-500 text-sm">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      {setStokenResult}
                    </div>
                  )}
                </div>

                {/* Available Lending Pools */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">
                    Available Lending Pools
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {poolOptions.map((pool) => (
                      <div
                        key={pool.value}
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{pool.label}</span>
                        </div>
                        <Badge
                          variant={
                            approvedMinters.includes(pool.value)
                              ? "default"
                              : "secondary"
                          }
                        >
                          {approvedMinters.includes(pool.value)
                            ? "Approved"
                            : "Not Approved"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SToken Market Creation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  SToken Market
                </CardTitle>
                <CardDescription>
                  Create a market for the SToken if it doesn't exist yet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stokenMarketExists === null ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Checking if SToken market exists...
                  </div>
                ) : stokenMarketExists ? (
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">
                          SToken Market Active
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        A market for the SToken is configured and available for
                        trading.
                      </p>
                    </div>

                    {stokenMarketInfo && (
                      <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                        <h4 className="font-medium">Market Information</h4>

                        {/* Basic Market Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Market ID:
                            </span>
                            <span className="ml-2 font-mono">
                              {stokenMarketInfo.id}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Pool ID:
                            </span>
                            <span className="ml-2 font-mono">
                              {stokenMarketInfo.poolId}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Symbol:
                            </span>
                            <span className="ml-2 font-medium">
                              {stokenMarketInfo.symbol}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Status:
                            </span>
                            <Badge variant="default" className="ml-2">
                              {stokenMarketInfo.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Market Parameters */}
                        {stokenMarketInfo.marketInfo && (
                          <>
                            <div className="border-t pt-4">
                              <h5 className="font-medium mb-2">
                                Market Parameters
                              </h5>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Collateral Factor:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo
                                      .collateralFactor
                                      ? `${(
                                          (Number(
                                            stokenMarketInfo.marketInfo
                                              .collateralFactor
                                          ) /
                                            10000) *
                                          100
                                        ).toFixed(1)}%`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Liquidation Threshold:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo
                                      .liquidationThreshold
                                      ? `${(
                                          (Number(
                                            stokenMarketInfo.marketInfo
                                              .liquidationThreshold
                                          ) /
                                            10000) *
                                          100
                                        ).toFixed(1)}%`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Reserve Factor:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.reserveFactor
                                      ? `${(
                                          (Number(
                                            stokenMarketInfo.marketInfo
                                              .reserveFactor
                                          ) /
                                            10000) *
                                          100
                                        ).toFixed(1)}%`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Borrow Rate:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.borrowRate
                                      ? `${(
                                          (Number(
                                            stokenMarketInfo.marketInfo
                                              .borrowRate
                                          ) /
                                            10000) *
                                          100
                                        ).toFixed(2)}%`
                                      : "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Market Limits */}
                            <div className="border-t pt-4">
                              <h5 className="font-medium mb-2">
                                Market Limits
                              </h5>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Max Total Deposits:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo
                                      .maxTotalDeposits
                                      ? `${new BigNumber(
                                          stokenMarketInfo.marketInfo.maxTotalDeposits
                                        )
                                          .dividedBy(
                                            Math.pow(
                                              10,
                                              Number(stokenInfo?.decimals) || 6
                                            )
                                          )
                                          .toFixed(0)} ${
                                          stokenInfo?.symbol || "SToken"
                                        }`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Max Total Borrows:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.maxTotalBorrows
                                      ? `${new BigNumber(
                                          stokenMarketInfo.marketInfo.maxTotalBorrows
                                        )
                                          .dividedBy(
                                            Math.pow(
                                              10,
                                              Number(stokenInfo?.decimals) || 6
                                            )
                                          )
                                          .toFixed(0)} ${
                                          stokenInfo?.symbol || "SToken"
                                        }`
                                      : "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Market Statistics */}
                            <div className="border-t pt-4">
                              <h5 className="font-medium mb-2">
                                Market Statistics
                              </h5>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Total Deposits:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.totalDeposits
                                      ? `${new BigNumber(
                                          stokenMarketInfo.marketInfo.totalDeposits
                                        )
                                          .dividedBy(
                                            Math.pow(
                                              10,
                                              Number(stokenInfo?.decimals) || 6
                                            )
                                          )
                                          .toFixed(2)} ${
                                          stokenInfo?.symbol || "SToken"
                                        }`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Total Borrows:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.totalBorrows
                                      ? `${new BigNumber(
                                          stokenMarketInfo.marketInfo.totalBorrows
                                        )
                                          .dividedBy(
                                            Math.pow(
                                              10,
                                              Number(stokenInfo?.decimals) || 6
                                            )
                                          )
                                          .toFixed(2)} ${
                                          stokenInfo?.symbol || "SToken"
                                        }`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Utilization Rate:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo
                                      .totalDeposits &&
                                    stokenMarketInfo.marketInfo.totalBorrows
                                      ? `${(
                                          (Number(
                                            stokenMarketInfo.marketInfo
                                              .totalBorrows
                                          ) /
                                            Number(
                                              stokenMarketInfo.marketInfo
                                                .totalDeposits
                                            )) *
                                          100
                                        ).toFixed(2)}%`
                                      : "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Price:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {stokenMarketInfo.marketInfo.price
                                      ? `$${Number(
                                          stokenMarketInfo.marketInfo.price
                                        ).toFixed(4)}`
                                      : "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-orange-500 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">
                          No SToken Market Found
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        No market exists for the SToken yet. Create one to
                        enable SToken trading.
                      </p>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Market Parameters</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Collateral Factor:
                          </span>
                          <span className="ml-2 font-mono">80%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Liquidation Threshold:
                          </span>
                          <span className="ml-2 font-mono">85%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Reserve Factor:
                          </span>
                          <span className="ml-2 font-mono">10%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Borrow Rate:
                          </span>
                          <span className="ml-2 font-mono">5%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Max Deposits:
                          </span>
                          <span className="ml-2 font-mono">
                            1M {stokenInfo?.symbol || "SToken"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Max Borrows:
                          </span>
                          <span className="ml-2 font-mono">
                            800K {stokenInfo?.symbol || "SToken"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <DorkFiButton
                      onClick={handleCreateStokenMarket}
                      disabled={isCreatingStokenMarket || !activeAccount}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {isCreatingStokenMarket ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Create SToken Market
                    </DorkFiButton>

                    {stokenMarketCreationError && (
                      <div className="text-red-500 text-sm">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        {stokenMarketCreationError}
                      </div>
                    )}
                    {stokenMarketCreationResult && (
                      <div className="text-green-500 text-sm">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        {stokenMarketCreationResult}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Role Management</H2>
            </div>

            {/* Role Checker */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Check All Predefined Roles
                </CardTitle>
                <CardDescription>
                  Enter an address to check which of the predefined roles they
                  have: Price Oracle, Market Controller, and Price Feed Manager.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter address to check roles..."
                    value={roleCheckAddress}
                    onChange={(e) => setRoleCheckAddress(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => checkAllRoles(roleCheckAddress)}
                    disabled={!roleCheckAddress.trim() || isCheckingRoles}
                    className="min-w-[120px]"
                  >
                    {isCheckingRoles ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Check Roles
                      </>
                    )}
                  </Button>
                  {activeAccount?.address && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRoleCheckAddress(activeAccount.address);
                        checkCurrentUserRoles();
                      }}
                      disabled={isCheckingRoles || isLoadingCurrentUserRoles}
                      className="min-w-[140px]"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Check My Roles
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>Predefined Roles:</strong>
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>
                      <strong>Price Oracle (rpo):</strong> Manages price feeds
                      and oracle data
                    </li>
                    <li>
                      <strong>Market Controller (rmc):</strong> Controls market
                      parameters and settings
                    </li>
                    <li>
                      <strong>Price Feed Manager (rpm):</strong> Manages price
                      feed configurations
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Current User Role Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Your Current Roles
                  </CardTitle>
                  {activeAccount?.address && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkCurrentUserRoles}
                      disabled={isLoadingCurrentUserRoles}
                    >
                      {isLoadingCurrentUserRoles ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Your actual roles from the smart contract
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeAccount?.address ? (
                  <div className="space-y-4">
                    {/* User Info */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Connected Account</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {currentUserEnvoiName && (
                            <span className="text-blue-600 dark:text-blue-400 font-mono">
                              {currentUserEnvoiName}
                            </span>
                          )}
                          <span className="font-mono">
                            {activeAccount.address.slice(0, 8)}...
                            {activeAccount.address.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Roles Display */}
                    {isLoadingCurrentUserRoles ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span className="text-muted-foreground">
                          Checking roles...
                        </span>
                      </div>
                    ) : currentUserRoles.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">
                          Smart Contract Roles:
                        </h4>
                        <div className="grid gap-2">
                          {currentUserRoles
                            .filter((role) => role.hasRole)
                            .map((role) => (
                              <div
                                key={role.roleId}
                                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  <div>
                                    <p className="font-medium text-green-800 dark:text-green-200">
                                      {role.roleName}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      {role.roleConstant} • Smart Contract Role
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Active
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                        <p className="font-medium text-orange-600 dark:text-orange-400">
                          No Smart Contract Roles
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          You don't have any of the predefined roles assigned
                        </p>
                      </div>
                    )}

                    {/* Role Summary */}
                    {currentUserRoles.length > 0 && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Role Summary:</strong> You have{" "}
                          {
                            currentUserRoles.filter((role) => role.hasRole)
                              .length
                          }{" "}
                          of {currentUserRoles.length} predefined roles
                          assigned.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <UserCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Connect your wallet to view roles
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Predefined Roles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Predefined Roles
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  System roles with predefined permissions
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map((role) => (
                    <Card key={role.id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role.icon)}
                            <CardTitle className="text-lg">
                              {role.name}
                            </CardTitle>
                          </div>
                          <Badge className={role.color}>System Role</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setAssignAddress("");
                              setEnvoiName("");
                              setEnvoiError(null);
                              setEnvoiSearchQuery("");
                              setDebouncedSearchQuery("");
                              setEnvoiSearchResults([]);
                              setShowEnvoiSearch(false);
                              setIsAssignRoleModalOpen(true);
                            }}
                            className="flex-1"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign Role
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setAssignAddress("");
                              setRevokeEnvoiName("");
                              setRevokeEnvoiError(null);
                              setRevokeEnvoiSearchQuery("");
                              setRevokeDebouncedSearchQuery("");
                              setRevokeEnvoiSearchResults([]);
                              setShowRevokeEnvoiSearch(false);
                              setIsRevokeRoleModalOpen(true);
                            }}
                            className="flex-1"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Revoke Role
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Admin Tools</H2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mint AToken Tool */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Mint AToken
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Mint aToken for testing and development purposes
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      placeholder="Enter AToken name"
                      className="w-full"
                      value={mintName}
                      onChange={(e) => setMintName(e.target.value)}
                    />
                  </div>
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Enter a name for the AToken and click the button below to
                      mint it.
                    </p>
                  </div>

                  {/* Success Message */}
                  {mintResult && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-green-800 dark:text-green-200">
                            Mint Successful
                          </p>
                          <p className="text-green-700 dark:text-green-300 break-all">
                            {mintResult}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {mintError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-red-800 dark:text-red-200">
                            Mint Failed
                          </p>
                          <p className="text-red-700 dark:text-red-300">
                            {mintError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <DorkFiButton
                      variant="primary"
                      className="flex-1"
                      onClick={handleMintAToken}
                      disabled={isMinting || !mintName.trim()}
                    >
                      {isMinting ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Minting...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Mint AToken
                        </>
                      )}
                    </DorkFiButton>
                    <DorkFiButton
                      variant="secondary"
                      onClick={() => {
                        setMintName("");
                        setMintResult(null);
                        setMintError(null);
                      }}
                      disabled={isMinting}
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Clear
                    </DorkFiButton>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          Development Tool
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-300">
                          This tool is for development and testing purposes
                          only. Use with caution.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Tools Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Additional Tools
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    More admin tools will be added here
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">
                      More Tools Coming Soon
                    </p>
                    <p className="text-sm">
                      Additional admin tools will be available here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Price Feed Manager Tab */}
          <TabsContent value="price-feed-manager" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Price Feed Manager</H2>
              <div className="flex items-center gap-2">
                {oracleLoading ? (
                  <Badge
                    variant="outline"
                    className="text-blue-600 border-blue-600"
                  >
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading...
                  </Badge>
                ) : oracleContractInfo.isDeployed ? (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Deployed
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-red-600 border-red-600"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Not Deployed
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contract Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Contract Information
                  </CardTitle>
                  <CardDescription>
                    Price oracle contract details and deployment status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Contract ID</span>
                    <div className="flex items-center gap-2">
                      {oracleContractInfo.contractId ? (
                        <>
                          <span className="text-sm font-mono text-muted-foreground">
                            {oracleContractInfo.contractId}
                          </span>
                          <ExternalLink
                            className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => {
                              const explorerUrl =
                                getCurrentNetworkConfig().explorerUrl;
                              window.open(
                                `${explorerUrl}/application/${oracleContractInfo.contractId}`,
                                "_blank"
                              );
                            }}
                          />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Not configured
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Network</span>
                    <span className="text-sm text-muted-foreground">
                      {currentNetwork.includes("mainnet")
                        ? "Mainnet"
                        : "Testnet"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Deployment Status
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        oracleContractInfo.isDeployed
                          ? "text-green-600 border-green-600"
                          : "text-red-600 border-red-600"
                      }
                    >
                      {oracleContractInfo.isDeployed ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Deployed
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Deployed
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Role</span>
                    <Badge
                      variant="outline"
                      className={
                        hasPriceFeedManagerRole()
                          ? "text-green-600 border-green-600"
                          : "text-orange-600 border-orange-600"
                      }
                    >
                      {hasPriceFeedManagerRole() ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Price Feed Manager
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          No Role
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Price Oracle Role
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          oracleContractInfo.hasPriceOracleRole
                            ? "text-green-600 border-green-600"
                            : "text-orange-600 border-orange-600"
                        }
                      >
                        {oracleContractInfo.hasPriceOracleRole ? (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Price Oracle
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            No Role
                          </>
                        )}
                      </Badge>
                      {/*<Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Set the role to assign to Price Oracle
                          const priceOracleRole = roles.find(role => role.id === "price-oracle");
                          if (priceOracleRole) {
                            setSelectedRole(priceOracleRole);
                            setIsAssignRoleModalOpen(true);
                          }
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Assign Role
                      </Button>
                      */}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contract State Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Contract State
                  </CardTitle>
                  <CardDescription>
                    Current state and configuration of the price oracle
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {oracleContractInfo.contractState ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">App ID</span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {oracleContractInfo.contractState.appId}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Creator</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-muted-foreground">
                            {oracleContractInfo.contractState.creator?.slice(
                              0,
                              8
                            )}
                            ...
                          </span>
                          <ExternalLink
                            className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => {
                              const explorerUrl =
                                getCurrentNetworkConfig().explorerUrl;
                              window.open(
                                `${explorerUrl}/address/${oracleContractInfo.contractState.creator}`,
                                "_blank"
                              );
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Global State Keys
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {oracleContractInfo.contractState.globalState
                            ?.length || 0}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        {oracleContractInfo.contractId
                          ? "Contract Not Deployed"
                          : "No Contract Configured"}
                      </p>
                      <p className="text-sm">
                        {oracleContractInfo.contractId
                          ? "The price oracle contract is not deployed on this network"
                          : "Price oracle contract ID is not configured for this network"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lending Pool Selector */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Lending Pool Selection
                  </CardTitle>
                  <CardDescription>
                    Select a lending pool to check price feed status for its
                    markets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="lending-pool-select">Lending Pool</Label>
                      <Select
                        value={selectedLendingPool}
                        onValueChange={(value) => {
                          setSelectedLendingPool(value);
                          setPriceFeedStatus({}); // Clear previous status
                        }}
                      >
                        <SelectTrigger id="lending-pool-select">
                          <SelectValue placeholder="Select a lending pool" />
                        </SelectTrigger>
                        <SelectContent>
                          {getLendingPools(currentNetwork).map(
                            (poolId, index) => {
                              const classLabel = String.fromCharCode(
                                65 + index
                              ); // A, B, C, etc.
                              return (
                                <SelectItem key={poolId} value={poolId}>
                                  Pool {classLabel} ({poolId})
                                </SelectItem>
                              );
                            }
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={loadPriceFeedStatus}
                      disabled={!selectedLendingPool}
                      className="mt-6"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check Price Feeds
                    </Button>
                    <Button
                      onClick={loadAssetPrices}
                      disabled={
                        !oracleContractInfo.contractId ||
                        !oracleContractInfo.isDeployed
                      }
                      variant="outline"
                      className="mt-6 ml-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Prices
                    </Button>
                    <Button
                      onClick={loadLendingPoolPriceFeeds}
                      disabled={!selectedLendingPool}
                      variant="outline"
                      className="mt-6 ml-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Price Feeds
                    </Button>
                    <Button
                      onClick={() => {
                        console.log("🔄 Refresh Market Data button clicked");
                        loadMarketData();
                      }}
                      disabled={!selectedLendingPool}
                      variant="outline"
                      className="mt-6 ml-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Market Data
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Supported Assets Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Supported Assets
                  </CardTitle>
                  <CardDescription>
                    Assets currently tracked by the price oracle
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getMarketsFromConfig(currentNetwork).map((market) => {
                      const hasPriceFeed = priceFeedStatus[market.id] || false;
                      const priceData = assetPrices[market.id];
                      const lendingPoolPriceFeed =
                        lendingPoolPriceFeeds[market.id];
                      const currentMarketData = marketData[market.id];

                      console.log(`🔍 Market ${market.id} data:`, {
                        hasPriceFeed,
                        priceData,
                        lendingPoolPriceFeed,
                        currentMarketData,
                        marketDataKeys: Object.keys(marketData),
                      });

                      return (
                        <div
                          key={market.id}
                          className="p-3 bg-muted/50 rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {market.symbol.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {market.symbol}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {market.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-blue-600 border-blue-600"
                              >
                                <Hash className="h-3 w-3 mr-1" />
                                {market.underlyingAssetId || "Native"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  hasPriceFeed
                                    ? "text-green-600 border-green-600"
                                    : "text-gray-600 border-gray-600"
                                }
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {hasPriceFeed ? "Feed Attached" : "No Feed"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  priceData
                                    ? "text-blue-600 border-blue-600"
                                    : "text-orange-600 border-orange-600"
                                }
                              >
                                <Database className="h-3 w-3 mr-1" />
                                {priceData
                                  ? "Price Available"
                                  : "No Price Data"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  marketData[market.id]?.price &&
                                  marketData[market.id]!.price > 0n
                                    ? "text-purple-600 border-purple-600"
                                    : "text-gray-600 border-gray-600"
                                }
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                {marketData[market.id]?.price &&
                                marketData[market.id]!.price > 0n
                                  ? `$${(
                                      Number(marketData[market.id]!.price) /
                                      1e24
                                    ).toFixed(6)}`
                                  : "No Market Price"}
                              </Badge>
                              {!hasPriceFeed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTokenForAttach(market.id);
                                    setIsAttachPriceFeedModalOpen(true);
                                  }}
                                  className="h-6 px-2 text-xs"
                                  disabled={
                                    !selectedLendingPool ||
                                    !oracleContractInfo.contractId ||
                                    !oracleContractInfo.isDeployed
                                  }
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Attach Feed
                                </Button>
                              )}
                              {hasPriceFeed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleFetchPriceFeed(market.id)
                                  }
                                  className="h-6 px-2 text-xs"
                                  disabled={!selectedLendingPool}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Fetch Feed
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Price Feed Attachment Status */}
                          {lendingPoolPriceFeed && (
                            <div className="border-t pt-3">
                              <h4 className="text-sm font-medium text-green-600 mb-2">
                                Price Feed Configuration
                              </h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Provider App ID:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {lendingPoolPriceFeed.providerAppId.toString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Market ID:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {lendingPoolPriceFeed.marketId.toString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Status:
                                  </span>
                                  <span className="ml-2">
                                    {lendingPoolPriceFeed.providerAppId ===
                                    0n ? (
                                      <Badge
                                        variant="outline"
                                        className="text-gray-600 border-gray-600"
                                      >
                                        No Feed Attached
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-green-600 border-green-600"
                                      >
                                        Feed Attached
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Feed Price:
                                  </span>
                                  <span className="ml-2 font-mono font-medium">
                                    $
                                    {(
                                      Number(
                                        lendingPoolPriceFeed.priceWithTimestamp
                                          .price
                                      ) / 1e6
                                    ).toFixed(6)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Feed Last Updated:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {new Date(
                                      Number(
                                        lendingPoolPriceFeed.priceWithTimestamp
                                          .timestamp
                                      ) * 1000
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Price Data Section */}
                          {priceData && (
                            <div className="border-t pt-3">
                              <h4 className="text-sm font-medium text-blue-600 mb-2">
                                Oracle Contract Price Data
                              </h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Price:
                                  </span>
                                  <span className="ml-2 font-mono font-medium">
                                    $
                                    {(Number(priceData.price) / 1e6).toFixed(6)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Last Updated:
                                  </span>
                                  <span className="ml-2 font-mono">
                                    {new Date(
                                      Number(priceData.timestamp) * 1000
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {!priceData && !lendingPoolPriceFeed && (
                            <div className="border-t pt-3">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm">
                                  No price feed or price data available
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          Price Feed Manager Status
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {oracleContractInfo.contractId &&
                          oracleContractInfo.isDeployed
                            ? `The price oracle contract (${oracleContractInfo.contractId}) is deployed and operational. ` +
                              `It automatically aggregates price data from multiple sources to ensure accurate pricing. ` +
                              `${
                                hasPriceFeedManagerRole()
                                  ? "You have Price Feed Manager role permissions."
                                  : "You do not have Price Feed Manager role permissions."
                              }`
                            : oracleContractInfo.contractId
                            ? `The price oracle contract (${oracleContractInfo.contractId}) is configured but not deployed on this network.`
                            : "No price oracle contract is configured for this network. Price updates are handled directly through the lending pool contracts."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Price Oracle Tab */}
          <TabsContent value="price-oracle" className="space-y-6">
            <div className="flex justify-between items-center">
              <H2>Price Oracle</H2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportOracleData}
                  className="h-8 px-3 text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                {oracleLoading ? (
                  <Badge
                    variant="outline"
                    className="text-blue-600 border-blue-600"
                  >
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading...
                  </Badge>
                ) : oracleContractInfo.isDeployed ? (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Deployed
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-red-600 border-red-600"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Not Deployed
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contract Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Contract Information
                  </CardTitle>
                  <CardDescription>
                    Oracle contract deployment and configuration details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Contract ID</span>
                    {oracleContractInfo.contractId ? (
                      <>
                        <span className="text-sm font-mono">
                          {oracleContractInfo.contractId}
                        </span>
                        <ExternalLink
                          className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer"
                          onClick={() => {
                            const explorerUrl =
                              getCurrentNetworkConfig().explorerUrl;
                            window.open(
                              `${explorerUrl}/application/${oracleContractInfo.contractId}`,
                              "_blank"
                            );
                          }}
                        />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Network</span>
                    <span className="text-sm text-muted-foreground">
                      {currentNetwork.includes("mainnet")
                        ? "Mainnet"
                        : "Testnet"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Deployment Status
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        oracleContractInfo.isDeployed
                          ? "text-green-600 border-green-600"
                          : "text-red-600 border-red-600"
                      }
                    >
                      {oracleContractInfo.isDeployed ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Deployed
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Deployed
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Role</span>
                    <Badge
                      variant="outline"
                      className={
                        hasPriceFeedManagerRole()
                          ? "text-green-600 border-green-600"
                          : "text-orange-600 border-orange-600"
                      }
                    >
                      {hasPriceFeedManagerRole() ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Price Feed Manager
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          No Role
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Price Oracle Role
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          oracleContractInfo.hasPriceOracleRole
                            ? "text-green-600 border-green-600"
                            : "text-orange-600 border-orange-600"
                        }
                      >
                        {oracleContractInfo.hasPriceOracleRole ? (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Price Oracle
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            No Role
                          </>
                        )}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Set the role to assign to Price Oracle
                          const priceOracleRole = roles.find(
                            (role) => role.id === "price-oracle"
                          );
                          if (priceOracleRole) {
                            setSelectedRole(priceOracleRole);
                            setIsAssignRoleModalOpen(true);
                          }
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Assign Role
                      </Button>
                    </div>
                  </div>

                  {/* Approve Feeder Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        Feeder Management
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsApproveFeederModalOpen(true)}
                        className="h-6 px-2 text-xs"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Approve Feeder
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Manage price feeder permissions for specific tokens
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contract State Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Contract State
                  </CardTitle>
                  <CardDescription>
                    Oracle contract state and configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {oracleContractInfo.contractState ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">App ID</span>
                        <span className="text-sm font-mono">
                          {oracleContractInfo.contractState.appId}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Creator</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-muted-foreground">
                            {oracleContractInfo.contractState.creator?.slice(
                              0,
                              8
                            )}
                            ...
                          </span>
                          <ExternalLink
                            className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => {
                              const explorerUrl =
                                getCurrentNetworkConfig().explorerUrl;
                              window.open(
                                `${explorerUrl}/address/${oracleContractInfo.contractState.creator}`,
                                "_blank"
                              );
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Global State Keys
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {oracleContractInfo.contractState.globalState
                            ?.length || 0}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        {oracleContractInfo.contractId
                          ? "Contract Not Deployed"
                          : "No Contract Configured"}
                      </p>
                      <p className="text-sm">
                        {oracleContractInfo.contractId
                          ? "The price oracle contract is not deployed on this network"
                          : "Price oracle contract ID is not configured for this network"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Supported Assets Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Supported Assets
                </CardTitle>
                <CardDescription>
                  Assets currently tracked by the price oracle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getMarketsFromConfig(currentNetwork).map((market) => {
                    const priceData = assetPrices[market.id];

                    return (
                      <div
                        key={market.id}
                        className="p-3 bg-muted/50 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {market.symbol.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {market.symbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {market.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-blue-600 border-blue-600"
                            >
                              <Hash className="h-3 w-3 mr-1" />
                              {market.underlyingAssetId || "Native"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                priceData
                                  ? "text-blue-600 border-blue-600"
                                  : "text-orange-600 border-orange-600"
                              }
                            >
                              <Database className="h-3 w-3 mr-1" />
                              {priceData ? "Price Available" : "No Price Data"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTokenForPrice(market.id);
                                setIsSetPriceModalOpen(true);
                              }}
                              className="h-6 px-2 text-xs"
                              disabled={
                                !oracleContractInfo.contractId ||
                                !oracleContractInfo.isDeployed
                              }
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Set Price
                            </Button>
                          </div>
                        </div>

                        {/* Price Data Section */}
                        {priceData && (
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium text-blue-600 mb-2">
                              Oracle Contract Price Data
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">
                                  Price:
                                </span>
                                <span className="ml-2 font-mono font-medium">
                                  ${(Number(priceData.price) / 1e6).toFixed(6)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Last Updated:
                                </span>
                                <span className="ml-2 font-mono">
                                  {new Date(
                                    Number(priceData.timestamp) * 1000
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {!priceData && oracleContractInfo.isDeployed && (
                          <div className="border-t pt-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">
                                No price data available
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-2">
                  <Button
                    onClick={loadAssetPrices}
                    disabled={
                      !oracleContractInfo.contractId ||
                      !oracleContractInfo.isDeployed
                    }
                    className="mt-6"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Prices
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Price Oracle Status
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        {oracleContractInfo.contractId &&
                        oracleContractInfo.isDeployed
                          ? `The price oracle contract (${oracleContractInfo.contractId}) is deployed and operational. ` +
                            `It provides centralized price data for all supported assets. ` +
                            `${
                              hasPriceFeedManagerRole()
                                ? "You have Price Feed Manager role permissions."
                                : "You do not have Price Feed Manager role permissions."
                            }`
                          : oracleContractInfo.contractId
                          ? `The price oracle contract (${oracleContractInfo.contractId}) is configured but not deployed on this network.`
                          : "No price oracle contract is configured for this network."}
                      </p>
                    </div>
                  </div>
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
                        <div className="flex gap-2">
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
                            className="flex-1"
                          />
                          <div className="flex gap-1">
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
                              className="px-2"
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
                                  maxTotalDeposits: "10000000",
                                }))
                              }
                              className="px-2"
                            >
                              10M
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
                              className="px-2"
                            >
                              100M
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="max-total-borrows">
                          Max Total Borrows
                        </Label>
                        <div className="flex gap-2">
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
                            className="flex-1"
                          />
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setNewMarket((prev) => ({
                                  ...prev,
                                  maxTotalBorrows: "800000",
                                }))
                              }
                              className="px-2"
                            >
                              800K
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setNewMarket((prev) => ({
                                  ...prev,
                                  maxTotalBorrows: "8000000",
                                }))
                              }
                              className="px-2"
                            >
                              8M
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setNewMarket((prev) => ({
                                  ...prev,
                                  maxTotalBorrows: "80000000",
                                }))
                              }
                              className="px-2"
                            >
                              80M
                            </Button>
                          </div>
                        </div>
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
                      {(() => {
                        const value = parseFloat(
                          marketViewData.maxTotalDeposits
                        );
                        if (value >= 1000000000) {
                          return `${(value / 1000000000).toFixed(2)}B`;
                        } else if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(2)}K`;
                        } else {
                          return value.toFixed(0);
                        }
                      })()}{" "}
                      {marketViewData.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Max Total Borrows:
                    </span>
                    <span>
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
                          return value.toFixed(0);
                        }
                      })()}{" "}
                      {marketViewData.symbol}
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
                  className="w-full"
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: "1000000",
                      }))
                    }
                    className="px-3"
                  >
                    1M
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: "10000000",
                      }))
                    }
                    className="px-3"
                  >
                    10M
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: "100000000",
                      }))
                    }
                    className="px-3"
                  >
                    100M
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentValue =
                        parseFloat(maxDepositsUpdateData.newMaxDeposits) || 0;
                      const newValue = Math.floor(currentValue * 1.01);
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: newValue.toString(),
                      }));
                    }}
                    className="px-3"
                  >
                    +1%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentValue =
                        parseFloat(maxDepositsUpdateData.newMaxDeposits) || 0;
                      const newValue = Math.floor(currentValue * 1.03);
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: newValue.toString(),
                      }));
                    }}
                    className="px-3"
                  >
                    +3%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentValue =
                        parseFloat(maxDepositsUpdateData.newMaxDeposits) || 0;
                      const newValue = Math.floor(currentValue * 1.05);
                      setMaxDepositsUpdateData((prev) => ({
                        ...prev,
                        newMaxDeposits: newValue.toString(),
                      }));
                    }}
                    className="px-3"
                  >
                    +5%
                  </Button>
                </div>
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

      {/* Max Borrows Update Modal */}
      <Dialog
        open={isMaxBorrowsUpdateModalOpen}
        onOpenChange={setIsMaxBorrowsUpdateModalOpen}
      >
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-xl">
              Update Market Max Borrows
            </DialogTitle>
            <DialogDescription>
              Update the maximum total borrows allowed for the selected market.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentMaxBorrows">Current Max Borrows</Label>
                <Input
                  id="currentMaxBorrows"
                  value={maxBorrowsUpdateData.currentMaxBorrows}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="newMaxBorrows">New Max Borrows</Label>
                <Input
                  id="newMaxBorrows"
                  type="number"
                  step="1"
                  placeholder="Enter new max borrows amount"
                  value={maxBorrowsUpdateData.newMaxBorrows}
                  onChange={(e) =>
                    setMaxBorrowsUpdateData((prev) => ({
                      ...prev,
                      newMaxBorrows: e.target.value,
                    }))
                  }
                  className="w-full"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxBorrowsUpdateData((prev) => ({
                        ...prev,
                        newMaxBorrows: "800000",
                      }))
                    }
                    className="px-3"
                  >
                    800K
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxBorrowsUpdateData((prev) => ({
                        ...prev,
                        newMaxBorrows: "8000000",
                      }))
                    }
                    className="px-3"
                  >
                    8M
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxBorrowsUpdateData((prev) => ({
                        ...prev,
                        newMaxBorrows: "80000000",
                      }))
                    }
                    className="px-3"
                  >
                    80M
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Market ID: {maxBorrowsUpdateData.marketId}</p>
                <p>Pool ID: {maxBorrowsUpdateData.poolId}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button
              variant="outline"
              onClick={() => setIsMaxBorrowsUpdateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateMaxBorrows}>Update Max Borrows</Button>
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

      {/* Assign Role Modal */}
      <Dialog
        open={isAssignRoleModalOpen}
        onOpenChange={setIsAssignRoleModalOpen}
      >
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRole && getRoleIcon(selectedRole.icon)}
              Assign {selectedRole?.name} Role
            </DialogTitle>
            <DialogDescription>
              Grant this role to an address to provide system permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">
                  {selectedRole.description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="envoi-name">VOI Name (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="envoi-name"
                      placeholder="Search or enter VOI name (e.g., en.voi)"
                      value={envoiSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEnvoiSearchQuery(value);

                        if (value.includes(".")) {
                          // Direct name input - resolve immediately
                          handleEnvoiNameChange(value);
                        }
                        // For search mode, the debounced effect will handle the search
                      }}
                      className="font-mono text-sm mt-2"
                    />
                    {(envoiLoading || envoiSearchLoading) && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showEnvoiSearch && envoiSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {envoiSearchResults.map((result, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          onClick={() => {
                            handleEnvoiNameSelect(result.name);
                            setAssignAddress(result.address);
                            setEnvoiName(result.name);
                            setShowEnvoiSearch(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                              {result.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.address.slice(0, 8)}...
                              {result.address.slice(-8)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    Search for VOI names or enter a complete name to resolve the
                    address
                  </p>
                </div>

                {selectedRole?.id !== "price-oracle" && (
                  <div>
                    <Label htmlFor="assign-address">User Address</Label>
                    <div className="relative">
                      <Input
                        id="assign-address"
                        placeholder="Enter user's wallet address"
                        value={assignAddress}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        className="font-mono text-sm mt-2"
                      />
                      {envoiLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the wallet address of the user you want to assign
                      this role to
                    </p>
                    {assignAddress.trim() &&
                      !envoiService.isValidAddressFormat(assignAddress) && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Invalid address format. Please enter a valid Algorand
                          address.
                        </p>
                      )}
                  </div>
                )}

                {selectedRole?.id === "price-oracle" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Price Oracle Role Assignment
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      This role will be assigned to the Oracle Contract address:{" "}
                      {oracleContractInfo.contractId
                        ? algosdk
                            .encodeAddress(
                              algosdk.getApplicationAddress(
                                Number(oracleContractInfo.contractId)
                              ).publicKey
                            )
                            .slice(0, 8) +
                          "..." +
                          algosdk
                            .encodeAddress(
                              algosdk.getApplicationAddress(
                                Number(oracleContractInfo.contractId)
                              ).publicKey
                            )
                            .slice(-8)
                        : "N/A"}
                    </p>
                  </div>
                )}

                {selectedRole?.id !== "price-oracle" &&
                  envoiName &&
                  assignAddress && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          Envoi Resolution Successful
                        </span>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        {envoiName} → {assignAddress.slice(0, 8)}...
                        {assignAddress.slice(-8)}
                      </p>
                    </div>
                  )}

                {selectedRole?.id !== "price-oracle" && envoiError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        Envoi Error
                      </span>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {envoiError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignRoleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  // get network clients
                  const networkConfig = getCurrentNetworkConfig();
                  const clients = algorandService.initializeClients(
                    networkConfig.walletNetworkId as AlgorandNetwork
                  );

                  // Check if this is a Price Oracle role assignment
                  const isPriceOracleRole = selectedRole?.id === "price-oracle";

                  let contractId: number;
                  let targetAddress: string;
                  let contractSpec: any;

                  if (isPriceOracleRole) {
                    // For Price Oracle role, use the oracle contract and assign to oracle contract address
                    if (!oracleContractInfo.contractId) {
                      toast.error("Oracle contract not deployed", {
                        description:
                          "Cannot assign Price Oracle role: Oracle contract is not deployed.",
                      });
                      return;
                    }
                    contractId = Number(oracleContractInfo.contractId);
                    targetAddress = algosdk.encodeAddress(
                      algosdk.getApplicationAddress(contractId).publicKey
                    );
                    contractSpec = {
                      ...LendingPoolAppSpec.contract,
                      events: [],
                    }; // NOTE: Should be PriceOracleAppSpec when available
                  } else {
                    // For other roles, use the lending pool contract and assign to user address
                    contractId = Number(
                      networkConfig.contracts.lendingPools[0]
                    );
                    targetAddress = assignAddress;
                    contractSpec = {
                      ...LendingPoolAppSpec.contract,
                      events: [],
                    };
                  }

                  // get contract instance
                  const ci = new CONTRACT(
                    contractId,
                    clients.algod,
                    undefined,
                    contractSpec,
                    { addr: activeAccount.address, sk: new Uint8Array() }
                  );
                  ci.setEnableRawBytes(true);

                  // get role key
                  const roleConstant = selectedRole
                    ? roleConstantsMap[selectedRole.id]
                    : ROLE_PRICE_ORACLE;
                  const role_keyR = await ci.get_role_key(
                    targetAddress,
                    new Uint8Array(Buffer.from(roleConstant))
                  );

                  console.log("role_keyR", role_keyR);
                  if (!role_keyR.success) {
                    toast.error("Failed to get role key", {
                      description: `Could not retrieve role key for ${
                        selectedRole?.name || "selected role"
                      }. Please try again.`,
                    });
                    return;
                  }

                  // assign role
                  const set_roleR = await ci.set_role(
                    role_keyR.returnValue,
                    true
                  );
                  if (!set_roleR.success) {
                    toast.error("Failed to set role", {
                      description: `Could not set role for ${
                        selectedRole?.name || "selected role"
                      }. Please try again.`,
                    });
                    return;
                  }

                  const stxns = await signTransactions(
                    set_roleR.txns.map((txn: string) =>
                      Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
                    )
                  );
                  const res = await clients.algod
                    .sendRawTransaction(stxns)
                    .do();
                  await waitForConfirmation(clients.algod, res.txid, 4);

                  toast.success("Role assigned successfully", {
                    description: `Successfully assigned ${
                      selectedRole?.name || "selected role"
                    } role to ${
                      isPriceOracleRole ? "Oracle Contract" : targetAddress
                    }.`,
                  });

                  // Refresh oracle contract info if this was a Price Oracle role assignment
                  if (isPriceOracleRole) {
                    await loadOracleContractInfo();
                  }

                  // Reset form state
                  setAssignAddress("");
                  setEnvoiName("");
                  setEnvoiError(null);
                  setEnvoiSearchQuery("");
                  setDebouncedSearchQuery("");
                  setEnvoiSearchResults([]);
                  setShowEnvoiSearch(false);
                  setIsAssignRoleModalOpen(false);
                } catch (error) {
                  console.error("Error assigning role:", error);
                  toast.error("Failed to assign role", {
                    description:
                      "An unexpected error occurred. Please try again.",
                  });
                }
              }}
              disabled={
                selectedRole?.id === "price-oracle"
                  ? !oracleContractInfo.contractId // For Price Oracle role, only need oracle contract to be deployed
                  : !assignAddress.trim() ||
                    !envoiService.isValidAddressFormat(assignAddress) // For other roles, need valid user address
              }
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Role Modal */}
      <Dialog
        open={isRevokeRoleModalOpen}
        onOpenChange={setIsRevokeRoleModalOpen}
      >
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRole && getRoleIcon(selectedRole.icon)}
              Revoke {selectedRole?.name} Role
            </DialogTitle>
            <DialogDescription>
              Remove this role from an address to revoke system permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">
                  {selectedRole.description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="envoi-name-revoke">VOI Name (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="envoi-name-revoke"
                      placeholder="Search or enter VOI name (e.g., en.voi)"
                      value={revokeEnvoiSearchQuery}
                      onChange={(e) => {
                        setRevokeEnvoiSearchQuery(e.target.value);
                        setRevokeDebouncedSearchQuery(e.target.value);
                      }}
                      onFocus={() => setShowRevokeEnvoiSearch(true)}
                      className="pr-10"
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {showRevokeEnvoiSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                      {revokeEnvoiLoading ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          Searching...
                        </div>
                      ) : revokeEnvoiSearchResults.length > 0 ? (
                        revokeEnvoiSearchResults.map((result) => (
                          <div
                            key={result.name}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                            onClick={() => {
                              setRevokeEnvoiSearchQuery(result.name);
                              setRevokeDebouncedSearchQuery(result.name);
                              setAssignAddress(result.address);
                              setShowRevokeEnvoiSearch(false);
                            }}
                          >
                            <div className="font-medium text-sm">
                              {result.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {result.address.slice(0, 8)}...
                              {result.address.slice(-8)}
                            </div>
                          </div>
                        ))
                      ) : revokeDebouncedSearchQuery ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          No results found
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="revoke-address">Address</Label>
                  <Input
                    id="revoke-address"
                    placeholder="Enter address or use VOI name above"
                    value={assignAddress}
                    onChange={(e) =>
                      setAssignAddress(e.target.value.toUpperCase())
                    }
                  />
                  {assignAddress.trim() &&
                    !envoiService.isValidAddressFormat(assignAddress) && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Invalid address format. Please enter a valid Algorand
                        address.
                      </p>
                    )}
                </div>

                {revokeEnvoiError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        Envoi Error
                      </span>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {revokeEnvoiError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRevokeRoleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!selectedRole) return;
                await revokeRole(assignAddress, selectedRole.id);
                setAssignAddress("");
                setRevokeEnvoiName("");
                setRevokeEnvoiError(null);
                setRevokeEnvoiSearchQuery("");
                setRevokeDebouncedSearchQuery("");
                setRevokeEnvoiSearchResults([]);
                setShowRevokeEnvoiSearch(false);
                setIsRevokeRoleModalOpen(false);
              }}
              disabled={
                !assignAddress.trim() ||
                !selectedRole ||
                !envoiService.isValidAddressFormat(assignAddress)
              }
            >
              <X className="h-4 w-4 mr-2" />
              Revoke Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Feeder Modal */}
      <Dialog
        open={isApproveFeederModalOpen}
        onOpenChange={setIsApproveFeederModalOpen}
      >
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Approve Price Feeder
            </DialogTitle>
            <DialogDescription>
              Approve or revoke price feeder permissions for specific tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Feeder Management</h3>
              <p className="text-muted-foreground">
                Authorize addresses to post price data for specific tokens in
                the Price Oracle contract.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="feeder-address">Feeder Address</Label>
                <Input
                  id="feeder-address"
                  placeholder="Enter feeder wallet address"
                  value={feederAddress}
                  onChange={(e) =>
                    setFeederAddress(e.target.value.toUpperCase())
                  }
                  className="font-mono text-sm mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the wallet address of the price feeder
                </p>
                {feederAddress.trim() &&
                  !envoiService.isValidAddressFormat(feederAddress) && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Invalid address format. Please enter a valid Algorand
                      address.
                    </p>
                  )}
              </div>

              <div>
                <Label htmlFor="token-selection">Token Selection</Label>
                <Select
                  value={selectedTokenForFeeder}
                  onValueChange={setSelectedTokenForFeeder}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a token" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMarketsFromConfig(currentNetwork).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.symbol} - {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the token this feeder will provide prices for
                </p>
              </div>

              <div>
                <Label htmlFor="approval-status">Approval Status</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="approve-true"
                      name="approval"
                      checked={feederApproval === true}
                      onChange={() => setFeederApproval(true)}
                    />
                    <Label htmlFor="approve-true">Approve</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="approve-false"
                      name="approval"
                      checked={feederApproval === false}
                      onChange={() => setFeederApproval(false)}
                    />
                    <Label htmlFor="approve-false">Revoke</Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {feederApproval ? "Grant" : "Remove"} feeder permissions for
                  this token
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveFeederModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveFeeder}
              disabled={
                !feederAddress.trim() ||
                !selectedTokenForFeeder ||
                !envoiService.isValidAddressFormat(feederAddress) ||
                !oracleContractInfo.contractId ||
                !oracleContractInfo.isDeployed
              }
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {feederApproval ? "Approve" : "Revoke"} Feeder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Price Modal */}
      <Dialog open={isSetPriceModalOpen} onOpenChange={setIsSetPriceModalOpen}>
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Set Asset Price
            </DialogTitle>
            <DialogDescription>
              Set the current price for a specific asset in the Price Oracle
              contract.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Price Management</h3>
              <p className="text-muted-foreground">
                Update the price for an asset. This will be validated against
                rate limits and price deviation rules.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="price-token-selection">Asset Selection</Label>
                <Select
                  value={selectedTokenForPrice}
                  onValueChange={setSelectedTokenForPrice}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMarketsFromConfig(currentNetwork).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.symbol} - {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the asset to set the price for
                </p>
              </div>

              <div>
                <Label htmlFor="price-value">Price (USD)</Label>
                <Input
                  id="price-value"
                  type="number"
                  step="0.000001"
                  placeholder="Enter price in USD (e.g., 1.234567)"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the current price in USD. Supports up to 6 decimal
                  places.
                </p>
                {priceValue.trim() &&
                  (isNaN(parseFloat(priceValue)) ||
                    parseFloat(priceValue) <= 0) && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Please enter a valid positive price value.
                    </p>
                  )}
              </div>

              {selectedTokenForPrice && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-medium text-blue-600 mb-2">
                    Current Price Information
                  </h4>
                  {assetPrices[selectedTokenForPrice] ? (
                    <div className="text-sm">
                      <p className="text-muted-foreground">
                        Current Price:{" "}
                        <span className="font-mono font-medium text-blue-600">
                          $
                          {(
                            Number(assetPrices[selectedTokenForPrice]!.price) /
                            1e6
                          ).toFixed(6)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Last Updated:{" "}
                        <span className="font-mono">
                          {new Date(
                            Number(
                              assetPrices[selectedTokenForPrice]!.timestamp
                            ) * 1000
                          ).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-orange-600">
                      No current price data available
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSetPriceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPrice}
              disabled={
                !selectedTokenForPrice ||
                !priceValue.trim() ||
                isNaN(parseFloat(priceValue)) ||
                parseFloat(priceValue) <= 0 ||
                !oracleContractInfo.contractId ||
                !oracleContractInfo.isDeployed
              }
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Set Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach Price Feed Modal */}
      <Dialog
        open={isAttachPriceFeedModalOpen}
        onOpenChange={setIsAttachPriceFeedModalOpen}
      >
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Attach Price Feed
            </DialogTitle>
            <DialogDescription>
              Attach a price feed from the Price Oracle to a lending pool
              market.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Price Feed Attachment
              </h3>
              <p className="text-muted-foreground">
                Connect a market in the lending pool to the Price Oracle
                contract for automated price updates.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="attach-token-selection">Market Selection</Label>
                <Select
                  value={selectedTokenForAttach}
                  onValueChange={setSelectedTokenForAttach}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a market" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMarketsFromConfig(currentNetwork).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.symbol} - {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the market to attach price feed for
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-600 mb-2">
                  Configuration Details
                </h4>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    <span className="font-medium">Lending Pool:</span>{" "}
                    {selectedLendingPool}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Price Oracle:</span>{" "}
                    {oracleContractInfo.contractId}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Required Role:</span> Price
                    Feed Manager
                  </p>
                </div>
              </div>

              {selectedTokenForAttach && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="text-sm font-medium text-green-600 mb-2">
                    Market Information
                  </h4>
                  {(() => {
                    const markets = getMarketsFromConfig(currentNetwork);
                    const selectedMarket = markets.find(
                      (market) => market.id === selectedTokenForAttach
                    );
                    const tokenId =
                      selectedMarket?.underlyingAssetId ||
                      selectedMarket?.underlyingContractId;
                    const priceData = assetPrices[selectedTokenForAttach];
                    return (
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Symbol:</span>{" "}
                          {selectedMarket?.symbol}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Name:</span>{" "}
                          {selectedMarket?.name}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Token ID:</span>{" "}
                          {tokenId || "Native"}
                        </p>
                        {priceData ? (
                          <>
                            <p className="text-muted-foreground">
                              <span className="font-medium">
                                Current Price:
                              </span>{" "}
                              <span className="font-mono font-medium text-green-600">
                                ${(Number(priceData.price) / 1e6).toFixed(6)}
                              </span>
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Last Updated:</span>{" "}
                              <span className="font-mono">
                                {new Date(
                                  Number(priceData.timestamp) * 1000
                                ).toLocaleString()}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-orange-600">
                            <span className="font-medium">Price Status:</span>{" "}
                            No price data available
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAttachPriceFeedModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachPriceFeed}
              disabled={
                !selectedTokenForAttach ||
                !selectedLendingPool ||
                !oracleContractInfo.contractId ||
                !oracleContractInfo.isDeployed
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Attach Price Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
