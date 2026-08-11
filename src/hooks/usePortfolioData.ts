import { useState, useEffect, useCallback } from "react";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  fetchUserGlobalData,
  fetchAllMarkets,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
} from "@/services/lendingService";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";
import {
  getTokenConfig,
  asTokenConfig,
  tokenStandardUsesNativeWalletBalance,
  getPortfolioVisibleTokens,
  getAllTokensWithDisplayInfo,
} from "@/config";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";

/** Wallet symbols we always check so undeposited cash (esp. USDC) can surface. */
const PRIORITY_WALLET_ASSETS = [
  "USDC",
  "ALGO",
  "WAD",
  "UNIT",
  "goBTC",
  "goETH",
  "tALGO",
  "xALGO",
] as const;

export interface PortfolioPosition {
  asset: string;
  icon: string;
  balance: number;
  nTokenBalance?: number;
  value: number;
  apy: number;
  tokenPrice: number;
  type: "deposit" | "borrow";
  /** Accrued interest: earned on deposits, owed on borrows */
  interest?: number;
}

export interface PortfolioData {
  userGlobalData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
    healthFactorIndex?: number;
  } | null;
  marketData: any[];
  userPositions: PortfolioPosition[];
  walletBalances: Record<string, { balance: number; balanceUSD: number }>;
  isLoading: boolean;
  isLoadingPositions: boolean;
  isLoadingWalletBalance: boolean;
  error: string | null;
}

export const usePortfolioData = () => {
  const { activeAccount } = useDorkFiWalletAdapter();
  const { currentNetwork } = useNetwork();

  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [userPositions, setUserPositions] = useState<PortfolioPosition[]>([]);
  const [walletBalances, setWalletBalances] = useState<
    Record<string, { balance: number; balanceUSD: number }>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isLoadingWalletBalance, setIsLoadingWalletBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch nToken balance for a specific token
  const fetchNTokenBalance = useCallback(
    async (userAddress: string, nTokenId: string, networkId: string) => {
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
    },
    []
  );

  // Function to fetch user positions (both deposits and borrows)
  const fetchUserPositions = useCallback(
    async (userAddress: string, networkId: string, markets: any[] = []) => {
      try {
        console.log("fetchUserPositions called with:", {
          userAddress,
          networkId,
          marketsCount: markets.length,
        });
        const tokens = getPortfolioVisibleTokens(networkId as any).filter(
          (token) => token.underlyingContractId && token.poolId
        );

        const positionLists = await Promise.all(
          tokens.map(async (token) => {
            const positions: PortfolioPosition[] = [];
            const market = markets.find((m) => m.symbol === token.symbol);

            const [depositData, borrowData] = await Promise.all([
              fetchUserDepositBalance(
                userAddress,
                token.poolId!,
                token.underlyingContractId!,
                networkId as any
              ),
              fetchUserBorrowBalance(
                userAddress,
                token.poolId!,
                token.underlyingContractId!,
                networkId as any
              ),
            ]);

            const depositBalance = depositData?.balance || 0;
            const depositInterest = depositData?.interest || 0;
            const borrowBalance = borrowData?.balance || 0;
            const borrowInterest = borrowData?.interest || 0;

            if (depositBalance && depositBalance > 0) {
              const originalTokenConfigRaw = getTokenConfig(
                networkId as any,
                token.symbol
              );
              const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
                ? originalTokenConfigRaw.find(
                    (tc) => String(tc.poolId) === String(token.poolId)
                  ) || originalTokenConfigRaw[0]
                : originalTokenConfigRaw;

              const nTokenBalance = await fetchNTokenBalance(
                userAddress,
                originalTokenConfig?.nTokenId || "",
                networkId
              );

              positions.push({
                asset: token.symbol,
                icon: token.logoPath,
                balance: depositBalance,
                nTokenBalance: nTokenBalance,
                value:
                  (depositBalance *
                    (market?.price ? parseFloat(market.price) : 1)) /
                  Math.pow(10, 6),
                apy:
                  market?.apyCalculation?.apy ||
                  (market?.supplyRate ? market.supplyRate * 100 : 0),
                tokenPrice: market?.price
                  ? parseFloat(market.price) / Math.pow(10, 6)
                  : 1,
                type: "deposit",
                interest: depositInterest,
              });
            }

            if (borrowBalance && borrowBalance > 0) {
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

            return positions;
          })
        );

        const positions = positionLists.flat();
        console.log("fetchUserPositions returning:", positions);
        return positions;
      } catch (error) {
        console.error("Error fetching user positions:", error);
        return [];
      }
    },
    [fetchNTokenBalance]
  );

  // Fetch wallet balance for a specific asset (config key or display symbol).
  const fetchWalletBalance = useCallback(
    async (asset: string, opts?: { force?: boolean }) => {
      if (!activeAccount?.address) {
        return { balance: 0, balanceUSD: 0 };
      }

      // Check if we already have this balance cached
      if (!opts?.force && walletBalances[asset]) {
        return walletBalances[asset];
      }

      try {
        const tokens = getAllTokensWithDisplayInfo(currentNetwork);
        const token =
          tokens.find((t) => t.configKey === asset) ??
          tokens.find((t) => t.originalSymbol === asset) ??
          tokens.find((t) => t.symbol === asset);

        if (!token) {
          console.error(`Token ${asset} not found in network config`);
          return { balance: 0, balanceUSD: 0 };
        }

        // Prefer config key so multi-market USDC resolves reliably.
        const originalSymbol =
          token.configKey ||
          ("originalSymbol" in token
            ? (token as { originalSymbol?: string }).originalSymbol
            : undefined) ||
          asset;
        const originalTokenConfig = asTokenConfig(
          getTokenConfig(currentNetwork, originalSymbol ?? asset),
          token.poolId
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
        const balanceKey = token.symbol || asset;

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
        } else if (
          tokenStandardUsesNativeWalletBalance(originalTokenConfig.tokenStandard)
        ) {
          // For network tokens (like VOI), fetch native balance
          console.log(`Fetching network token balance for ${asset}`);
          try {
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
          originalTokenConfig.tokenStandard === "asa-asa" &&
          originalTokenConfig.assetId != null &&
          String(originalTokenConfig.assetId).trim() !== ""
        ) {
          const assetId = parseInt(
            String(originalTokenConfig.assetId).trim(),
            10
          );
          console.log(
            `Fetching ASA balance for ${asset} (asa-asa asset ID: ${assetId})`
          );
          try {
            const accAssetInfo = await clients.algod
              .accountAssetInformation(activeAccount.address, assetId)
              .do();

            const atomic = getAccountAssetHoldingAmountAtomic(accAssetInfo);
            if (atomic != null) {
              balance =
                Number(atomic) /
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
        } else if (
          (originalTokenConfig.tokenStandard === "asa" ||
            originalTokenConfig.tokenStandard === "network-asa") &&
          (token.underlyingAssetId || originalTokenConfig.assetId)
        ) {
          // For ASA and Folks network-asa (e.g. fALGO): wallet holds the f-ASA.
          const assetIdStr =
            token.underlyingAssetId || String(originalTokenConfig.assetId);
          console.log(
            `Fetching ASA balance for ${asset} (asset ID: ${assetIdStr})`
          );
          try {
            const assetId = parseInt(String(assetIdStr), 10);
            const accAssetInfo = await clients.algod
              .accountAssetInformation(activeAccount.address, assetId)
              .do();

            const atomic = getAccountAssetHoldingAmountAtomic(accAssetInfo);
            if (atomic != null) {
              // Convert from smallest units to human readable format
              balance =
                Number(atomic) /
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

        // Calculate USD value using market data (oracle micro-USD scale).
        const market = marketData.find(
          (m) =>
            m.symbol === balanceKey ||
            m.symbol === asset ||
            m.asset === balanceKey
        );
        const tokenPrice = market?.price
          ? parseFloat(String(market.price)) / Math.pow(10, 6)
          : balanceKey === "USDC" || asset === "USDC"
            ? 1
            : 0;
        const balanceUSD = balance * (Number.isFinite(tokenPrice) ? tokenPrice : 0);
        const balanceData = {
          balance,
          balanceUSD,
        };

        setWalletBalances((prev) => ({
          ...prev,
          // Key by display symbol so Portfolio UI can merge with deposit rows.
          [balanceKey]: balanceData,
          ...(balanceKey !== asset ? { [asset]: balanceData } : {}),
        }));

        console.log(`Final balance data for ${asset}:`, balanceData);
        return balanceData;
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        return { balance: 0, balanceUSD: 0 };
      }
    },
    [activeAccount?.address, currentNetwork, marketData, walletBalances]
  );

  // Refresh wallet balance for a specific asset
  const refreshWalletBalance = useCallback(
    async (asset: string) => {
      if (!activeAccount?.address) return;

      try {
        // Clear cached balance
        setWalletBalances((prev) => {
          const newBalances = { ...prev };
          delete newBalances[asset];
          return newBalances;
        });

        // Fetch fresh balance
        await fetchWalletBalance(asset, { force: true });
      } catch (error) {
        console.error("Error refreshing wallet balance:", error);
      }
    },
    [activeAccount?.address, fetchWalletBalance]
  );

  // Function to refresh positions data
  const handleRefreshPositions = useCallback(async () => {
    if (!activeAccount?.address || !currentNetwork) {
      return;
    }

    setIsLoadingPositions(true);
    try {
      // Markets + global in parallel; positions need market rows for APY/price.
      const [freshMarketData, freshGlobalData] = await Promise.all([
        fetchAllMarkets(currentNetwork),
        fetchUserGlobalData(activeAccount.address, currentNetwork),
      ]);
      setMarketData(freshMarketData);
      setUserGlobalData(freshGlobalData);

      const freshPositions = await fetchUserPositions(
        activeAccount.address,
        currentNetwork,
        freshMarketData
      );
      setUserPositions(freshPositions);
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
      setIsLoadingPositions(true);
      setError(null);

      try {
        console.log(
          "Fetching user global data for:",
          activeAccount.address,
          "on network:",
          currentNetwork
        );

        // Global does not need markets — fetch both in parallel, then positions.
        const [markets, globalData] = await Promise.all([
          fetchAllMarkets(currentNetwork),
          fetchUserGlobalData(activeAccount.address, currentNetwork),
        ]);

        setMarketData(markets ?? []);
        setUserGlobalData(globalData ?? null);
        setIsLoading(false);

        const positions = await fetchUserPositions(
          activeAccount.address,
          currentNetwork,
          markets ?? []
        );
        setUserPositions(positions ?? []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch data"
        );
        setUserGlobalData(null);
        setMarketData([]);
        setUserPositions([]);
        setIsLoading(false);
      } finally {
        setIsLoadingPositions(false);
      }
    };

    fetchData();
  }, [activeAccount?.address, currentNetwork, fetchUserPositions]);

  // Always load wallet holdings (including undeposited USDC) for Supply / My Wallet.
  useEffect(() => {
    if (!activeAccount?.address || !currentNetwork) {
      setWalletBalances({});
      return;
    }

    let cancelled = false;

    const loadWalletBalances = async () => {
      setIsLoadingWalletBalance(true);
      try {
        const assets = new Set<string>(PRIORITY_WALLET_ASSETS);
        for (const p of userPositions) {
          if (p.asset) assets.add(p.asset);
        }
        // Include a few more visible ASA keys without loading every LP row.
        for (const t of getPortfolioVisibleTokens(currentNetwork as any)) {
          const key = t.configKey || t.symbol;
          if (
            key &&
            !key.startsWith("LP_") &&
            !String(t.symbol || "").startsWith("LP_")
          ) {
            // Prefer liquid singles only
            if (
              PRIORITY_WALLET_ASSETS.includes(
                key as (typeof PRIORITY_WALLET_ASSETS)[number]
              ) ||
              PRIORITY_WALLET_ASSETS.includes(
                t.symbol as (typeof PRIORITY_WALLET_ASSETS)[number]
              )
            ) {
              assets.add(key);
            }
          }
        }

        await Promise.all(
          [...assets].map((asset) =>
            fetchWalletBalance(asset, { force: true }).catch((err) => {
              console.error(`Wallet balance fetch failed for ${asset}:`, err);
              return { balance: 0, balanceUSD: 0 };
            })
          )
        );
      } finally {
        if (!cancelled) setIsLoadingWalletBalance(false);
      }
    };

    void loadWalletBalances();
    return () => {
      cancelled = true;
    };
    // Re-run when positions/markets refresh so prices and inventory stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchWalletBalance identity changes with cache; force path is intentional
  }, [
    activeAccount?.address,
    currentNetwork,
    userPositions,
    marketData,
  ]);

  // Separate deposits and borrows from user positions
  const deposits = userPositions.filter((pos) => pos.type === "deposit");
  const borrows = userPositions.filter((pos) => pos.type === "borrow");

  // Calculate totals from real data only
  const totalCollateral =
    userGlobalData?.totalCollateralValue ||
    deposits.reduce((sum, deposit) => sum + deposit.value, 0);
  // Derive totalBorrowed from per-position sums so it stays consistent
  // with the per-position accrued interest displayed alongside it.
  // Note: healthFactor / netLTV below also use this position-derived value.
  const totalBorrowed = borrows.reduce((sum, borrow) => sum + borrow.value, 0);

  // Reconciliation: warn when position-sum drifts from global contract value
  const globalBorrowed = userGlobalData?.totalBorrowValue || 0;
  if (globalBorrowed > 0 && Math.abs(totalBorrowed - globalBorrowed) / globalBorrowed > 0.01) {
    console.warn('[Portfolio] Borrow value mismatch between position sum and global data', {
      positionSum: totalBorrowed,
      globalValue: globalBorrowed,
      drift: totalBorrowed - globalBorrowed,
    });
  }

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
      : totalCollateral > 0
      ? 10.0
      : null; // Excellent health when no borrows, null when no collateral

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
