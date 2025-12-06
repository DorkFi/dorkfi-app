import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { getAllTokensWithDisplayInfo, getTokenConfig } from "@/config";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

import {
  useOnDemandMarketData,
  SortField,
  SortOrder,
} from "@/hooks/useOnDemandMarketData";
import MarketSearchFilters from "@/components/markets/MarketSearchFilters";
import MarketPagination from "@/components/markets/MarketPagination";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import WithdrawModal from "@/components/WithdrawModal";
import { PremiumMarketModal } from "@/components/market-modal/PremiumMarketModal";
import MintModal from "@/components/MintModal";
import MarketsHeroSection from "@/components/markets/MarketsHeroSection";
import MarketsTableContent from "@/components/markets/MarketsTableContent";
import {
  fetchUserGlobalData,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  migrate,
} from "@/services/lendingService";
import { useToast } from "@/hooks/use-toast";
import algosdk, { waitForConfirmation } from "algosdk";
import { abi, CONTRACT } from "ulujs";

function normalizeMarketData(md) {
  return {
    icon: md.icon || "",
    name: md.asset ?? md.name ?? "Unknown",
    symbol: md.asset ?? md.symbol ?? "???",
    price: md.price ?? 1,
    priceChange24h: md.priceChange24h ?? 0,
    priceHistory: md.priceHistory ?? [],
    totalSupply: md.totalSupply ?? 0,
    totalBorrow: md.totalBorrow ?? 0,
    availableLiquidity: md.availableLiquidity ?? 0,
    utilization: md.utilization ?? 0,
    supplyAPY: md.supplyAPY ?? 0,
    borrowAPY: md.borrowAPY ?? 0,
    maxLTV: md.maxLTV ?? 0,
    liquidationThreshold: md.liquidationThreshold ?? 0,
    liquidationBonus: md.liquidationBonus ?? 0,
    reserveFactor: md.reserveFactor ?? 0,
    supplyCap: md.supplyCap ?? 0,
    borrowCap: md.borrowCap ?? 0,
    oracleStatus: md.oracleStatus ?? "live",
    auditProvider: md.auditProvider ?? "N/A",
  };
}

const MarketsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalSupplyUSD");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
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
  const [mintModal, setMintModal] = useState<{
    isOpen: boolean;
    asset: string | null;
    poolId?: string;
  }>({ isOpen: false, asset: null });
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    asset: null,
    marketData: null,
  });
  const [walletBalances, setWalletBalances] = useState<
    Record<string, { balance: number; balanceUSD: number }>
  >({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [userBorrowBalance, setUserBorrowBalance] = useState<number>(0);
  const [userDepositBalance, setUserDepositBalance] = useState<number>(0);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(false);

  // Mock user deposits - in real app, this would come from user's wallet/backend
  const [userDeposits] = useState<Record<string, number>>({});
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimConfirmed, setClaimConfirmed] = useState(false);
  const [claimableRewards, setClaimableRewards] = useState<
    Record<string, { amount: number; formatted: string }>
  >({});
  const [isCountingRewards, setIsCountingRewards] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();

  const rewards = [
    {
      id: 1,
      name: "Prefi Incentive",
      description: "5M VOI DorkFi Prefi Incentive",
      reward: 5_000_000,
      icon: "/lovable-uploads/VOI.png",
      airdropAccount:
        "PORY6TDWT5B7YIJY36NSMY3DKIIH4TAEY35NUFCQRT7QMU66NUSZHLP6VA",
      tokenStandard: "network",
      networks: {
        "algorand-mainnet": {
          contractId: "3210709899",
        },
        "voi-mainnet": {
          contractId: "41877720",
        },
      },
      symbol: "VOI",
      decimals: 6,
    },
    // add more rewards here
  ];

  const {
    data: markets,
    totalItems,
    totalPages,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handleSortChange,
    loadMarketData,
    loadMarketDataWithBypass,
    loadVisibleMarkets,
    loadAllMarkets,
    isLoading,
    marketsData,
  } = useOnDemandMarketData({
    searchTerm,
    sortField,
    sortOrder,
    pageSize: 10,
    autoLoad: true,
  });

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    handleSearchChange(value);
  };

  const handleSortFieldChange = (field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
    handleSortChange(field, order);
  };

  const handleDepositClick = async (asset: string, poolId?: string) => {
    console.log("=== HANDLE DEPOSIT CLICK DEBUG ===");
    console.log("Received params:", { asset, poolId });

    setIsLoadingBalance(true);

    try {
      // Fetch wallet balance before opening modal
      await fetchWalletBalance(asset, poolId);

      // Fetch user's existing deposit balance for this asset
      if (activeAccount?.address) {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        // If poolId is provided, find the token that matches both symbol and poolId
        // Otherwise, fall back to finding by symbol only (for backward compatibility)
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const depositBalance = await fetchUserDepositBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserDepositBalance(depositBalance || 0);
        } else {
          setUserDepositBalance(0);
        }
      } else {
        setUserDepositBalance(0);
      }

      // Open modal after balance is fetched
      console.log("Opening deposit modal with:", { asset, poolId });
      setDepositModal({ isOpen: true, asset, poolId });
    } catch (error) {
      console.error("Error fetching wallet balance for deposit:", error);
      // Still open modal even if balance fetch fails
      setDepositModal({ isOpen: true, asset, poolId });
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleWithdrawClick = (asset: string) => {
    setWithdrawModal({ isOpen: true, asset });
  };

  const handleBorrowClick = async (asset: string, poolId?: string) => {
    setIsLoadingGlobalData(true);

    try {
      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        // If poolId is provided, find the token that matches both symbol and poolId
        // Otherwise, fall back to finding by symbol only (for backward compatibility)
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } else {
        // Not connected, set empty data
        setUserGlobalData(null);
        setUserBorrowBalance(0);
      }

      // Open modal regardless of connection status
      setBorrowModal({ isOpen: true, asset, poolId });
    } catch (error) {
      console.error("Error fetching user data for borrow:", error);
      // Still open modal even if data fetch fails
      setBorrowModal({ isOpen: true, asset, poolId });
    } finally {
      setIsLoadingGlobalData(false);
    }
  };

  const handleMintClick = async (asset: string, poolId?: string) => {
    setIsLoadingGlobalData(true);

    try {
      // Fetch user global data before opening modal (only if wallet is connected)
      if (activeAccount?.address) {
        const globalData = await fetchUserGlobalData(
          activeAccount.address,
          currentNetwork
        );
        setUserGlobalData(globalData);

        // Fetch user's current borrow balance for this specific asset
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        // If poolId is provided, find the token that matches both symbol and poolId
        // Otherwise, fall back to finding by symbol only (for backward compatibility)
        const token = poolId
          ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
          : tokens.find((t) => t.symbol === asset);

        if (token && token.poolId && token.underlyingContractId) {
          const borrowData = await fetchUserBorrowBalance(
            activeAccount.address,
            token.poolId,
            token.underlyingContractId,
            currentNetwork
          );
          setUserBorrowBalance(borrowData?.balance || 0);
        } else {
          setUserBorrowBalance(0);
        }
      } else {
        // Not connected, set empty data
        setUserGlobalData(null);
        setUserBorrowBalance(0);
      }

      // Open modal regardless of connection status, pass poolId if available
      setMintModal({ isOpen: true, asset, poolId });
    } catch (error) {
      console.error("Error fetching user data for mint:", error);
      // Still open modal even if data fetch fails
      setMintModal({ isOpen: true, asset, poolId });
    } finally {
      setIsLoadingGlobalData(false);
    }
  };

  const handleMigrateClick = async (asset: string) => {
    if (!activeAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to migrate tokens",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get token configuration
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);

      if (!token) {
        throw new Error(`Token not found for ${asset}`);
      }

      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as any).originalSymbol : asset;
      const tokenConfig = getTokenConfig(currentNetwork, originalSymbol);

      if (!tokenConfig) {
        throw new Error(`Token config not found for ${asset}`);
      }

      if (!tokenConfig.migration) {
        throw new Error(`No migration config found for ${asset}`);
      }

      // Get the migration balance (already formatted)
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      const migrationBalance = await ARC200Service.getBalance(
        activeAccount.address,
        tokenConfig.migration.nTokenId
      );

      if (!migrationBalance || BigInt(migrationBalance) === 0n) {
        throw new Error("No balance to migrate");
      }

      // Format balance for withdraw/deposit (convert from base units to human readable)
      const formattedBalance = ARC200Service.formatBalance(
        migrationBalance,
        tokenConfig.decimals
      );

      toast({
        title: "Starting Migration",
        description: `Migrating ${formattedBalance} ${asset}...`,
      });

      // Call migrate function which combines withdraw and deposit
      const migrateResult = await migrate(
        tokenConfig.migration.poolId, // Old pool ID
        tokenConfig.migration.contractId, // Old contract ID
        tokenConfig.migration.nTokenId, // Old nToken ID
        token.poolId!, // New pool ID
        token.underlyingContractId!, // New contract ID
        tokenConfig.tokenStandard,
        formattedBalance, // Amount in human readable format
        activeAccount.address,
        currentNetwork,
        tokenConfig.assetId // Asset ID for network/ASA tokens
      );

      if (!migrateResult.success) {
        throw new Error((migrateResult as any).error || "Migration failed");
      }

      // Sign and send migration transaction
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Migration Transaction",
        description: `Please open ${walletName} and sign the migration transaction`,
        duration: 10000,
      });

      let migrateTxns: Uint8Array[];
      if ("txns" in migrateResult && migrateResult.txns) {
        migrateTxns = migrateResult.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        );
      } else if ("txId" in migrateResult && migrateResult.txId) {
        migrateTxns = [
          Uint8Array.from(atob(migrateResult.txId), (c) => c.charCodeAt(0)),
        ];
      } else {
        throw new Error("No transaction data in migrate result");
      }

      const signedMigrateTxns = await signTransactions(migrateTxns);
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const migrateRes = await algorandClients.algod
        .sendRawTransaction(signedMigrateTxns)
        .do();
      await waitForConfirmation(algorandClients.algod, migrateRes.txid, 4);

      toast({
        title: "Migration Successful",
        description: `Successfully migrated ${formattedBalance} ${asset} to new pool`,
      });

      // Wait a bit for the blockchain state to update, then refresh
      setTimeout(() => {
        loadMarketDataWithBypass(asset.toLowerCase());
        refreshWalletBalance(asset);
      }, 2000);
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        title: "Migration Failed",
        description:
          error instanceof Error ? error.message : "Migration failed",
        variant: "destructive",
      });
    }
  };

  const handleCloseDepositModal = () => {
    const asset = depositModal.asset;
    setDepositModal({ isOpen: false, asset: null, poolId: undefined });

    // Refresh market data and wallet balance after deposit
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh wallet balance to show updated amount after deposit
      refreshWalletBalance(asset);
    }
  };

  const handleCloseWithdrawModal = () => {
    setWithdrawModal({ isOpen: false, asset: null });
  };

  const handleCloseBorrowModal = () => {
    const asset = borrowModal.asset;
    setBorrowModal({ isOpen: false, asset: null, poolId: undefined });

    // Refresh market data and user global data after borrow
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  // Fetch user data when wallet connects while borrow modal is open
  useEffect(() => {
    if (borrowModal.isOpen && borrowModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(
            activeAccount.address,
            currentNetwork
          );
          setUserGlobalData(globalData);

          const tokens = getAllTokensWithDisplayInfo(currentNetwork);
          // If poolId is provided, find the token that matches both symbol and poolId
          // Otherwise, fall back to finding by symbol only (for backward compatibility)
          const token = borrowModal.poolId
            ? tokens.find(
                (t) =>
                  t.symbol === borrowModal.asset &&
                  t.poolId === borrowModal.poolId
              )
            : tokens.find((t) => t.symbol === borrowModal.asset);

          if (token && token.poolId && token.underlyingContractId) {
            const borrowData = await fetchUserBorrowBalance(
              activeAccount.address,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            );
            setUserBorrowBalance(borrowData?.balance || 0);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };

      fetchData();
    }
  }, [
    activeAccount?.address,
    borrowModal.isOpen,
    borrowModal.asset,
    borrowModal.poolId,
    currentNetwork,
  ]);

  // Fetch user data when wallet connects while mint modal is open
  useEffect(() => {
    if (mintModal.isOpen && mintModal.asset && activeAccount?.address) {
      const fetchData = async () => {
        try {
          const globalData = await fetchUserGlobalData(
            activeAccount.address,
            currentNetwork
          );
          setUserGlobalData(globalData);

          const tokens = getAllTokensWithDisplayInfo(currentNetwork);
          const token = tokens.find((t) => t.symbol === mintModal.asset);

          if (token && token.poolId && token.underlyingContractId) {
            const borrowData = await fetchUserBorrowBalance(
              activeAccount.address,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            );
            setUserBorrowBalance(borrowData?.balance || 0);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };

      fetchData();
    }
  }, [
    activeAccount?.address,
    mintModal.isOpen,
    mintModal.asset,
    currentNetwork,
  ]);

  const handleCloseMintModal = () => {
    const asset = mintModal.asset;
    setMintModal({ isOpen: false, asset: null, poolId: undefined });

    // Refresh market data and user global data after mint
    if (asset) {
      loadMarketDataWithBypass(asset.toLowerCase());
      // Refresh user global data to show updated collateral/borrow values
      if (activeAccount?.address) {
        refreshUserGlobalData();
      }
    }
  };

  const handleRowClick = (market: any) => {
    //setDetailModal({ isOpen: true, asset: market.asset, marketData: market });
  };

  const handleInfoClick = (e: React.MouseEvent, market: any) => {
    e.stopPropagation();
    setDetailModal({ isOpen: true, asset: market.asset, marketData: market });
  };

  const handleCloseDetailModal = () => {
    setDetailModal({ isOpen: false, asset: null, marketData: null });
  };

  // Load all markets when component mounts
  useEffect(() => {
    loadAllMarkets();
  }, [loadAllMarkets]);

  // Clear wallet balance cache and user global data when wallet address changes
  useEffect(() => {
    setWalletBalances({});
    setUserGlobalData(null);
    setClaimableRewards({});
  }, [activeAccount?.address]);

  // Check for rewards using arc200_approval method simulation
  useEffect(() => {
    const countRewards = async () => {
      if (!activeAccount?.address) {
        return;
      }

      // Prevent multiple simultaneous checks
      if (isCountingRewards) {
        return;
      }

      setIsCountingRewards(true);

      try {
        const clients = await algorandService.getCurrentClientsForReads();
        ARC200Service.initialize(clients);

        const rewardsData: Record<
          string,
          { amount: number; formatted: string }
        > = {};

        for (const reward of rewards) {
          try {
            // Get the contract ID for the current network
            const networkKey = currentNetwork as keyof typeof reward.networks;
            const networkReward = reward.networks[networkKey];

            if (!networkReward?.contractId) {
              console.log(
                `No contract ID found for reward ${reward.id} on network ${currentNetwork}`
              );
              continue;
            }

            const contractId = networkReward.contractId;

            // Check balance of reward token in airdrop account using ARC200Service
            let claimableBalance = 0n;
            try {
              const balance = await ARC200Service.getAllowance(
                reward.airdropAccount,
                activeAccount.address,
                contractId
              );
              claimableBalance = balance ? BigInt(balance) : 0n;
            } catch (error) {
              console.error(
                `Error fetching balance for reward ${reward.id}:`,
                error
              );
              continue;
            }

            // Count rewards if there's a claimable balance
            if (claimableBalance > 0n) {
              const formattedAmount = ARC200Service.formatBalance(
                claimableBalance.toString(),
                reward.decimals
              );

              rewardsData[reward.id.toString()] = {
                amount: Number(claimableBalance),
                formatted: formattedAmount,
              };

              console.log(
                `Reward ${reward.id} is claimable: ${formattedAmount} ${reward.symbol}`
              );
            }
          } catch (error) {
            console.error(`Error checking reward ${reward.id}:`, error);
          }
        }

        setClaimableRewards(rewardsData);
      } catch (error) {
        console.error("Error counting rewards:", error);
      } finally {
        setIsCountingRewards(false);
      }
    };

    countRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.address, currentNetwork]);

  // Check if there are any claimable rewards
  const hasClaimableRewards = Object.values(claimableRewards).some(
    (reward) => reward.amount > 0
  );

  // Calculate total claimable rewards (sum of all amounts)
  const totalClaimableAmount = Object.values(claimableRewards).reduce(
    (sum, reward) => sum + reward.amount,
    0
  );

  // Get reward symbol and decimals (assuming all rewards use the same symbol)
  const rewardSymbol = rewards.length > 0 ? rewards[0].symbol : "VOI";
  const rewardDecimals = rewards.length > 0 ? rewards[0].decimals : 6;

  // Format total claimable amount
  const formattedTotalClaimable =
    totalClaimableAmount > 0
      ? ARC200Service.formatBalance(
          totalClaimableAmount.toString(),
          rewardDecimals
        )
      : "0";

  // Get VOI token config to find poolId for deposit
  const getVOITokenConfig = () => {
    const tokens = getAllTokensWithDisplayInfo(currentNetwork);
    return tokens.find((t) => t.symbol === "VOI");
  };

  const voiToken = getVOITokenConfig();

  // Handle claim VOI rewards
  const handleClaimVoi = async () => {
    if (!activeAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      });
      return;
    }

    if (!hasClaimableRewards || totalClaimableAmount === 0) {
      toast({
        title: "No Rewards Available",
        description: "You don't have any rewards to claim",
        variant: "destructive",
      });
      return;
    }

    if (isClaiming) {
      return; // Prevent multiple simultaneous claims
    }

    setIsClaiming(true);

    try {
      const clients = await algorandService.getCurrentClientsForReads();
      ARC200Service.initialize(clients);

      const allTxns: Uint8Array[] = [];

      // Process each claimable reward
      let ci: any;
      let customR: any;
      let buildN: any[] = [];
      for (const [rewardId, rewardData] of Object.entries(claimableRewards)) {
        if (rewardData.amount <= 0) continue;

        const reward = rewards.find((r) => r.id.toString() === rewardId);
        if (!reward) continue;

        // Get the contract ID for the current network
        const networkKey = currentNetwork as keyof typeof reward.networks;
        const networkReward = reward.networks[networkKey];

        if (!networkReward?.contractId) {
          console.log(
            `No contract ID found for reward ${reward.id} on network ${currentNetwork}`
          );
          continue;
        }

        const contractId = networkReward.contractId;

        try {
          // Create CONTRACT instance for the reward token

          if (!ci) {
            ci = new CONTRACT(
              Number(contractId),
              clients.algod,
              undefined,
              abi.custom,
              {
                addr: activeAccount.address,
                sk: new Uint8Array(),
              }
            );
          }
          const ciTok = new CONTRACT(
            Number(contractId),
            clients.algod,
            undefined,
            abi.nt200,
            {
              addr: activeAccount.address,
              sk: new Uint8Array(),
            }
          );
          const builder = {
            token: new CONTRACT(
              Number(contractId),
              clients.algod,
              undefined,
              abi.nt200,
              {
                addr: activeAccount.address,
                sk: new Uint8Array(),
              },
              true,
              false,
              true
            ),
          };
          // check allowance
          const arc200_allowanceR = await ciTok.arc200_allowance(
            reward.airdropAccount,
            activeAccount.address
          );
          if (!arc200_allowanceR.success) {
            throw new Error(
              arc200_allowanceR.error || `Failed to claim reward ${reward.id}`
            );
          }
          const allowance = arc200_allowanceR.returnValue;
          if (allowance == BigInt(0)) {
            continue;
          }
          // Call arc200_transferFrom to transfer from airdrop account to user
          {
            console.log("arc200_transferFrom", {
              from: reward.airdropAccount,
              to: activeAccount.address,
              allowance: allowance.toString(),
            });
            const txnO = (
              await builder.token.arc200_transferFrom(
                reward.airdropAccount,
                activeAccount.address,
                allowance
              )
            ).obj;
            buildN.push({
              ...txnO,
            });
          }
        } catch (error) {
          console.error(`Error claiming reward ${reward.id}:`, error);
          toast({
            title: "Claim Error",
            description: `Failed to claim ${reward.name}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            variant: "destructive",
          });
          // Continue with other rewards even if one fails
        }
      }

      console.log({ buildN });

      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      customR = await ci.custom();

      if (!customR.success) {
        throw new Error(customR.error || "Failed to claim rewards");
      }

      const stxns = customR.txns.map((txn: string) =>
        Uint8Array.from(Buffer.from(txn, "base64"))
      );

      // Sign all transactions
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Claim Transaction",
        description: `Please open ${walletName} and sign the claim transaction`,
        duration: 10000,
      });

      const signedTxns = await signTransactions(stxns);
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();

      // Send all transactions
      const sendResults = await Promise.all(
        signedTxns.map((txn) =>
          algorandClients.algod.sendRawTransaction(txn).do()
        )
      );

      // Wait for all confirmations
      await Promise.all(
        sendResults.map((result) =>
          waitForConfirmation(algorandClients.algod, result.txid, 4)
        )
      );

      toast({
        title: "Claim Successful",
        description: `Successfully claimed ${formattedTotalClaimable} ${rewardSymbol}`,
      });

      // Clear claimable rewards - the useEffect will refresh them automatically
      setClaimableRewards({});

      // Show success confirmation
      setClaimConfirmed(true);
    } catch (error) {
      console.error("Claim error:", error);
      toast({
        title: "Claim Failed",
        description:
          error instanceof Error ? error.message : "Failed to claim rewards",
        variant: "destructive",
      });
      setClaimConfirmed(false);
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = () => {
    loadAllMarkets();
  };

  // Refresh wallet balance for a specific asset (clears cache and refetches)
  const refreshWalletBalance = async (asset: string) => {
    // Clear the cached balance for this asset
    setWalletBalances((prev) => {
      const newBalances = { ...prev };
      delete newBalances[asset];
      return newBalances;
    });

    // Fetch fresh balance
    await fetchWalletBalance(asset);
  };

  // Refresh user global data (clears cache and refetches)
  const refreshUserGlobalData = async () => {
    if (!activeAccount?.address) return;

    try {
      const globalData = await fetchUserGlobalData(
        activeAccount.address,
        currentNetwork
      );
      setUserGlobalData(globalData);
    } catch (error) {
      console.error("Error refreshing user global data:", error);
    }
  };

  // Fetch wallet balance for a specific asset
  const fetchWalletBalance = async (asset: string, poolId?: string) => {
    if (!activeAccount?.address) {
      return { balance: 0, balanceUSD: 0 };
    }

    // Check if we already have this balance cached (use asset as key since wallet balance is same for all markets)
    if (walletBalances[asset]) {
      return walletBalances[asset];
    }

    try {
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      // If poolId is provided, find the token that matches both symbol and poolId
      // Otherwise, fall back to finding by symbol only (for backward compatibility)
      const token = poolId
        ? tokens.find((t) => t.symbol === asset && t.poolId === poolId)
        : tokens.find((t) => t.symbol === asset);

      if (!token) {
        console.error(
          `Token ${asset} not found in network config${
            poolId ? ` with poolId ${poolId}` : ""
          }`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Get the original token config to access tokenStandard
      // Use originalSymbol to look up the config, as asset might be a display symbol
      const originalSymbol =
        "originalSymbol" in token ? (token as any).originalSymbol : asset;
      const tokenConfigRaw = getTokenConfig(currentNetwork, originalSymbol);
      if (!tokenConfigRaw) {
        console.error(
          `Original token config not found for ${asset} (originalSymbol: ${originalSymbol})`
        );
        return { balance: 0, balanceUSD: 0 };
      }

      // Handle case where tokenConfig might be an array (multiple markets)
      // Compare poolIds as strings to ensure exact match
      const originalTokenConfig = Array.isArray(tokenConfigRaw)
        ? tokenConfigRaw.find(
            (tc) => String(tc.poolId) === String(token.poolId)
          ) || tokenConfigRaw[0]
        : tokenConfigRaw;

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
          const clients = await algorandService.getCurrentClientsForReads();
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

      // Calculate USD value
      const market = markets.find((m) => m.asset === asset);
      const tokenPrice = market
        ? (market.totalSupplyUSD / market.totalSupply || 1) / 10 ** 6
        : 1;
      const balanceUSD = balance * tokenPrice;

      console.log({
        balance,
        tokenPrice,
        balanceUSD,
      });

      const balanceData = {
        balance,
        balanceUSD,
      };

      setWalletBalances((prev) => ({
        ...prev,
        [asset]: balanceData,
      }));

      console.log(`Final balance data for ${asset}:`, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  const getAssetData = (asset: string, poolId?: string) => {
    // Find matching markets - prefer poolId match if provided
    let market;
    if (poolId) {
      // If poolId is provided, match by both asset and poolId
      market = markets.find((m) => m.asset === asset && m.poolId === poolId);
    }

    // If no poolId match or poolId not provided, find by asset
    // For tokens with multiple markets, prefer the one with higher totalSupply (more active market)
    if (!market) {
      const matchingMarkets = markets.filter((m) => m.asset === asset);
      if (matchingMarkets.length > 1) {
        // Multiple markets found - prefer the one with higher totalSupply
        market = matchingMarkets.reduce((prev, current) => {
          return (current.totalSupply || 0) > (prev.totalSupply || 0)
            ? current
            : prev;
        });
      } else {
        market = matchingMarkets[0];
      }
    }

    if (!market) return null;

    return {
      icon: market.icon,
      totalSupply: market.totalSupply,
      totalSupplyUSD: market.totalSupplyUSD,
      supplyAPY: market.supplyAPY,
      totalBorrow: market.totalBorrow,
      totalBorrowUSD: market.totalBorrowUSD,
      borrowAPY: market.borrowAPY,
      utilization: market.utilization,
      collateralFactor: market.collateralFactor,
      liquidity: market.totalSupply - market.totalBorrow,
      liquidityUSD: market.totalSupplyUSD - market.totalBorrowUSD,
      reserveFactor: market.reserveFactor,
      apyCalculation: market.apyCalculation,
      maxTotalDeposits: market.supplyCap,
      isSToken: market.isSToken,
    };
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4">
      <div className="space-y-4">
        {/* Hero Section */}
        <MarketsHeroSection />

        {/* Search and Filters */}
        <MarketSearchFilters
          searchTerm={searchTerm}
          onSearchChange={handleSearchTermChange}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleSortFieldChange}
        />

        {/* Markets Table */}
        <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-gray-200/50 dark:border-ocean-teal/20 p-4 card-hover overflow-visible">
          <div className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                Market Overview
                {isLoading && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Loading...)
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600 dark:bg-blue-950 dark:border-blue-800 dark:hover:bg-blue-900 dark:text-blue-400"
                    aria-label="Refresh market data"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        "https://docs.dork.fi",
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="flex items-center gap-2 border-ocean-teal/20 text-ocean-teal hover:bg-ocean-teal/10"
                    aria-label="Learn more about markets (opens in new tab)"
                  >
                    Learn More
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                {hasClaimableRewards && (
                  <Button
                    size="sm"
                    onClick={() => setShowClaimModal(true)}
                    className="flex items-center gap-2 bg-yellow-400 border-2 border-yellow-400 text-slate-900 font-bold rounded-lg py-2 px-4 shadow hover:bg-yellow-300 focus:bg-yellow-300 active:bg-yellow-400"
                    style={{ minWidth: 170 }}
                    aria-label="Claim Rewards"
                  >
                    <svg
                      className="h-4 w-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-3V7a2 2 0 00-2-2h-3.28a2 2 0 01-1.95-2.58 2 2 0 00-2.58 2.58H6a2 2 0 00-2 2v2m16 0H4"
                      />
                    </svg>
                    Claim Rewards
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* Informational guidance - matches Liquidations Queue styles */}
          <section
            aria-label="What you can do here"
            className="mb-4 hidden md:block"
          >
            <p className="text-sm text-muted-foreground mt-1">
              What You Can Do Here:
            </p>
            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <p>
                • Deposit Assets: Earn interest with interest bearing tokens
                that grow in value over time.
              </p>
              <p>
                • Borrow Against Collateral: Access liquidity without selling
                your holdings.
              </p>
              <p>
                • Track Utilization: See how much of each market is borrowed vs.
                supplied — a key signal for demand and interest rates.
              </p>
              <p>
                • Compare Risk Profiles: Different assets have different
                Loan-to-Value (LTV) limits and liquidation thresholds.
              </p>
            </div>
          </section>

          {markets.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No markets found. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <MarketsTableContent
              markets={markets}
              onRowClick={handleRowClick}
              onInfoClick={handleInfoClick}
              onDepositClick={handleDepositClick}
              onWithdrawClick={handleWithdrawClick}
              onBorrowClick={handleBorrowClick}
              onMintClick={handleMintClick}
              onMigrateClick={handleMigrateClick}
              isLoadingBalance={isLoadingBalance}
            />
          )}
        </div>

        {/* Pagination */}
        <MarketPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
        />

        {/* Market Detail Modal */}
        {detailModal.isOpen && detailModal.asset && detailModal.marketData && (
          <PremiumMarketModal
            isOpen={detailModal.isOpen}
            onClose={handleCloseDetailModal}
            asset={detailModal.asset}
            marketData={
              detailModal.marketData
                ? normalizeMarketData(detailModal.marketData)
                : undefined
            }
            userPosition={{
              supplied: 100,
              borrowed: 0,
              withdrawable: 100,
              borrowable: 1000,
              healthFactor: 2.5,
              earnings: 5.25,
            }}
            onDeposit={() => handleDepositClick(detailModal.asset!)}
            onWithdraw={() => handleWithdrawClick(detailModal.asset!)}
            onBorrow={() => handleBorrowClick(detailModal.asset!)}
            onRepay={() => {}}
          />
        )}

        {/* Deposit Modal */}
        {depositModal.isOpen &&
          depositModal.asset &&
          getAssetData(depositModal.asset) && (
            <SupplyBorrowModal
              isOpen={depositModal.isOpen}
              onClose={handleCloseDepositModal}
              asset={depositModal.asset}
              poolId={depositModal.poolId}
              mode="deposit"
              assetData={getAssetData(depositModal.asset)}
              walletBalance={walletBalances[depositModal.asset]?.balance || 0}
              walletBalanceUSD={
                walletBalances[depositModal.asset]?.balanceUSD || 0
              }
              userDepositBalance={userDepositBalance}
              onTransactionSuccess={() => {
                // Refresh wallet balance immediately after successful transaction
                if (depositModal.asset) {
                  refreshWalletBalance(depositModal.asset);
                }
              }}
            />
          )}

        {/* Withdraw Modal */}
        {withdrawModal.isOpen &&
          withdrawModal.asset &&
          getAssetData(withdrawModal.asset) && (
            <WithdrawModal
              isOpen={withdrawModal.isOpen}
              onClose={handleCloseWithdrawModal}
              tokenSymbol={withdrawModal.asset}
              tokenIcon={getAssetData(withdrawModal.asset).icon}
              currentlyDeposited={1000}
              marketStats={{
                supplyAPY: getAssetData(withdrawModal.asset).supplyAPY,
                utilization: getAssetData(withdrawModal.asset).utilization,
                collateralFactor: getAssetData(withdrawModal.asset)
                  .collateralFactor,
                tokenPrice: 1.0,
              }}
            />
          )}

        {/* Borrow Modal */}
        {borrowModal.isOpen &&
          borrowModal.asset &&
          getAssetData(borrowModal.asset, borrowModal.poolId) && (
            <SupplyBorrowModal
              isOpen={borrowModal.isOpen}
              onClose={handleCloseBorrowModal}
              asset={borrowModal.asset}
              poolId={borrowModal.poolId}
              mode="borrow"
              assetData={getAssetData(borrowModal.asset, borrowModal.poolId)}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              onTransactionSuccess={() => {
                // Refresh market data after successful borrow
                if (borrowModal.asset) {
                  loadMarketDataWithBypass(borrowModal.asset.toLowerCase());
                }
              }}
            />
          )}

        {/* Mint Modal */}
        {mintModal.isOpen &&
          mintModal.asset &&
          getAssetData(mintModal.asset, mintModal.poolId) && (
            <MintModal
              isOpen={mintModal.isOpen}
              onClose={handleCloseMintModal}
              asset={mintModal.asset}
              poolId={mintModal.poolId}
              assetData={getAssetData(mintModal.asset, mintModal.poolId)}
              userGlobalData={userGlobalData}
              userBorrowBalance={userBorrowBalance}
              onTransactionSuccess={() => {
                // Refresh market data after successful mint
                if (mintModal.asset) {
                  loadMarketDataWithBypass(mintModal.asset.toLowerCase());
                }
              }}
            />
          )}

        {/* Claim Rewards Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl p-6 w-full max-w-sm relative">
              <button
                className="absolute top-3 right-3 text-white/60 hover:text-white"
                onClick={() => {
                  setShowClaimModal(false);
                  setClaimConfirmed(false);
                }}
                aria-label="Close"
              >
                ✕
              </button>

              {!claimConfirmed ? (
                <>
                  <h2 className="text-2xl font-bold mb-1 text-center">
                    Claim Rewards
                  </h2>
                  <p className="mb-5 text-center text-white/70">
                    Claim your accumulated rewards.
                  </p>
                  <div className="rounded-xl bg-[#131A2A] border border-yellow-400/30 flex flex-col items-center py-5 mb-5">
                    <svg
                      className="h-8 w-8 mb-3 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-3V7a2 2 0 00-2-2h-3.28a2 2 0 01-1.95-2.58 2 2 0 00-2.58 2.58H6a2 2 0 00-2 2v2m16 0H4"
                      />
                    </svg>
                    <div className="text-lg mb-1 text-white/70">
                      Available to Claim
                    </div>
                    <div className="text-3xl font-extrabold text-yellow-300 mb-2">
                      {formattedTotalClaimable || "0"} {rewardSymbol}
                    </div>
                  </div>
                  {Object.keys(claimableRewards).length > 0 && (
                    <div className="mb-3 px-1">
                      <div className="text-sm text-white/50 mb-2">
                        Breakdown:
                      </div>
                      <div className="space-y-1">
                        {Object.entries(claimableRewards).map(
                          ([rewardId, reward]) => {
                            const rewardInfo = rewards.find(
                              (r) => r.id.toString() === rewardId
                            );
                            return (
                              <div
                                key={rewardId}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-white/70">
                                  {rewardInfo?.name || `Reward ${rewardId}`}:
                                </span>
                                <span className="font-medium text-white">
                                  {reward.formatted}{" "}
                                  {rewardInfo?.symbol || rewardSymbol}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      className="w-full py-3 rounded-lg bg-yellow-400 text-slate-900 font-bold text-lg hover:bg-yellow-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleClaimVoi}
                      disabled={
                        !hasClaimableRewards ||
                        totalClaimableAmount === 0 ||
                        isClaiming
                      }
                    >
                      {isClaiming
                        ? "Claiming..."
                        : `Claim ${
                            formattedTotalClaimable || "0"
                          } ${rewardSymbol}`}
                    </button>
                    {/*<div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-white/20"></div>
                      <span className="text-sm text-white/50">or</span>
                      <div className="flex-1 h-px bg-white/20"></div>
                    </div>
                    <button
                      className="w-full py-3 rounded-lg border-2 border-green-600 hover:border-green-700 text-green-600 hover:text-green-700 font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-green-50 dark:hover:bg-green-900/20"
                      onClick={() => {
                        setShowClaimModal(false);
                        setClaimConfirmed(false);
                        handleDepositClick("VOI", voiToken.poolId);
                      }}
                      disabled={
                        !hasClaimableRewards || totalClaimableAmount === 0
                      }
                    >
                      Deposit Rewards into Market
                    </button>*/}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center pt-6 pb-8">
                  {/* Sparkles Decorative */}
                  <div className="relative flex flex-col items-center mb-2">
                    {/* Top Left Sparkle */}
                    <svg
                      className="absolute -top-7 -left-7 text-yellow-300 w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* Top Right Sparkle */}
                    <svg
                      className="absolute -top-7 -right-7 text-cyan-400 w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* VOI Logo with Green Check in Box */}
                    <div className="relative">
                      <div className="rounded-2xl border-4 border-yellow-400 p-4 bg-[#182237] shadow-lg flex flex-col items-center">
                        <img
                          src="/lovable-uploads/VOI.png"
                          alt="VOI token"
                          className="w-20 h-20 rounded-full"
                        />
                        {/* Green Check */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 rounded-full p-1.5 border-4 border-[#182237]">
                          <svg
                            className="w-6 h-6 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-center mt-4 mb-2 text-white">
                    Transaction Successful!
                  </h2>
                  <div className="text-md md:text-lg text-white text-center mb-5">
                    You successfully claimed{" "}
                    <span className="text-yellow-400 font-bold">
                      {formattedTotalClaimable} {rewardSymbol}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {voiToken?.poolId && (
                      <button
                        className="w-full py-3 rounded-lg border-2 border-green-600 hover:border-green-700 text-green-600 hover:text-green-700 font-bold text-lg transition bg-transparent hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => {
                          setShowClaimModal(false);
                          setClaimConfirmed(false);
                          handleDepositClick("VOI", voiToken.poolId);
                        }}
                      >
                        Deposit into Market
                      </button>
                    )}
                    <a
                      href="/portfolio"
                      className="w-full block py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-center"
                      onClick={() => {
                        setShowClaimModal(false);
                        setClaimConfirmed(false);
                      }}
                    >
                      View Portfolio
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketsTable;
