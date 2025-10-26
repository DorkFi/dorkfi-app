import React, { useEffect, useMemo, useState } from "react";
import { LiquidationAccount } from "@/hooks/useLiquidationData";
import { shortenAddress } from "@/utils/liquidationUtils";
import {
  getRiskColor,
  getRiskLevel,
  getRiskVariant,
} from "@/utils/riskCalculations";
import DorkFiButton from "@/components/ui/DorkFiButton";
import HealthFactorGauge from "./HealthFactorGauge";
import PositionSummary from "./PositionSummary";
import AssetList from "./AssetList";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Zap, RefreshCw, Copy, Check } from "lucide-react";
import { useUserAssets } from "@/hooks/useUserAssets";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentNetworkConfig } from "@/config";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { APP_SPEC as LendingPoolAppSpec } from "../../clients/DorkFiLendingPoolClient";
import { abi, CONTRACT } from "ulujs";
import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet-react";

interface AccountOverviewProps {
  account: LiquidationAccount;
  onInitiateLiquidation: () => void;
}

export default function AccountOverview({
  account,
  onInitiateLiquidation,
}: AccountOverviewProps) {
  // Fetch real user assets
  const {
    assets,
    totalDepositValue,
    totalBorrowValue,
    isLoading,
    error,
    refetch,
  } = useUserAssets(account.walletAddress);
  const { signTransactions } = useWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncedHealth, setLastSyncedHealth] = useState<number | null>(null);
  const [finalizeSyncOnData, setFinalizeSyncOnData] = useState(false);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    const address = account.walletAddress;
    console.log("Attempting to copy address:", address);
    
    // Simple, reliable copy function
    const copyToClipboard = (text: string) => {
      return new Promise<void>((resolve, reject) => {
        // Modern approach
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => {
              console.log("Successfully copied:", text);
              resolve();
            },
            (err) => {
              console.error("Clipboard API failed:", err);
              reject(err);
            }
          );
        } else {
          // Fallback
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.top = "0";
          textArea.style.left = "0";
          textArea.style.width = "2em";
          textArea.style.height = "2em";
          textArea.style.padding = "0";
          textArea.style.border = "none";
          textArea.style.outline = "none";
          textArea.style.boxShadow = "none";
          textArea.style.background = "transparent";
          textArea.readOnly = true;
          textArea.style.opacity = "0";
          textArea.setAttribute("readonly", "");
          
          document.body.appendChild(textArea);
          textArea.select();
          
          try {
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            
            if (successful) {
              console.log("Successfully copied via fallback:", text);
              resolve();
            } else {
              reject(new Error("execCommand failed"));
            }
          } catch (err) {
            document.body.removeChild(textArea);
            reject(err);
          }
        }
      });
    };

    copyToClipboard(address)
      .then(() => {
        setCopied(true);
        toast({
          title: "Address Copied",
          description: "Account address copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        toast({
          title: "Copy Failed",
          description: "Failed to copy address. Please copy manually.",
          variant: "destructive",
        });
      });
  };

  // Transform fetched assets into the format expected by AssetList
  const collateralAssets = assets
    .filter((asset) => asset.depositBalance > 0)
    .map((asset) => ({
      symbol: asset.symbol,
      amount: asset.depositBalance,
      valueUSD: asset.depositValueUSD,
      collateralFactor: asset.collateralFactor,
      liquidationThreshold: asset.liquidationThreshold,
    }));

  const borrowedAssets = assets
    .filter((asset) => asset.borrowBalance > 0)
    .map((asset) => ({
      symbol: asset.symbol,
      amount: asset.borrowBalance,
      valueUSD: asset.borrowValueUSD,
      collateralFactor: asset.collateralFactor,
      liquidationThreshold: asset.liquidationThreshold,
    }));

  // Calculate real health factor from actual asset data with weighted collateral factors
  const calculateWeightedHealthFactor = (
    assets: any[],
    totalCollateral: number,
    totalBorrowed: number
  ): number => {
    if (totalBorrowed === 0) return 3.0; // No borrows = infinite health
    if (totalCollateral === 0) return 0; // No collateral but has borrows = 0 health

    // Calculate weighted collateral value based on each asset's collateral factor
    let weightedCollateralValue = 0;

    assets.forEach((asset) => {
      if (asset.depositBalance > 0 && asset.collateralFactor) {
        weightedCollateralValue +=
          asset.depositValueUSD * asset.collateralFactor;
      }
    });

    // Health factor = weightedCollateralValue / totalBorrowed
    const healthFactor = weightedCollateralValue / totalBorrowed;

    // Cap at 3.0 for display purposes
    return Math.min(healthFactor, 3.0);
  };

  // Use real health factor if we have real data, otherwise fall back to account data
  const realHealthFactor =
    totalDepositValue > 0 || totalBorrowValue > 0
      ? calculateWeightedHealthFactor(
          assets,
          totalDepositValue,
          totalBorrowValue
        )
      : account.healthFactor;

  // Calculate weighted collateral value for LTV calculation
  const calculateWeightedCollateralValue = (assets: any[]): number => {
    let weightedValue = 0;

    assets.forEach((asset) => {
      if (asset.depositBalance > 0 && asset.collateralFactor) {
        weightedValue += asset.depositValueUSD * asset.collateralFactor;
      }
    });

    return weightedValue;
  };

  // Calculate weighted collateral value
  const weightedCollateralValue = calculateWeightedCollateralValue(assets);

  // Debug logging to verify asset data
  console.log("AccountOverview Debug:", {
    assets: assets.map((asset) => ({
      symbol: asset.symbol,
      depositValueUSD: asset.depositValueUSD,
      collateralFactor: asset.collateralFactor,
      weightedContribution:
        asset.depositValueUSD * (asset.collateralFactor || 0),
    })),
    totalDepositValue,
    weightedCollateralValue,
    totalBorrowValue,
  });

  // Calculate weighted liquidation threshold based on collateral composition
  const calculateWeightedLiquidationThreshold = (
    assets: any[],
    totalCollateral: number
  ): number => {
    if (totalCollateral === 0) return 85; // Default threshold

    let weightedThreshold = 0;

    assets.forEach((asset) => {
      if (asset.depositBalance > 0 && asset.liquidationThreshold) {
        const assetWeight = asset.depositValueUSD / totalCollateral;
        weightedThreshold += asset.liquidationThreshold * assetWeight;
      }
    });

    // Convert to percentage and return, default to 85% if no data
    return weightedThreshold > 0 ? weightedThreshold * 100 : 85;
  };

  // Calculate weighted liquidation threshold
  const weightedLiquidationThreshold =
    totalDepositValue > 0
      ? calculateWeightedLiquidationThreshold(assets, totalDepositValue)
      : 85;

  // Calculate risk levels based on real health factor
  const riskColor = getRiskColor(realHealthFactor);
  const riskLevel = getRiskLevel(realHealthFactor);
  const isLiquidatable = realHealthFactor <= 1.0;
  const isHighRisk = realHealthFactor <= 1.1;

  // Load persisted last sync info per account
  useEffect(() => {
    const key = `df:lastSync:${account.walletAddress}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.ts === 'number') setLastSyncAt(parsed.ts);
        if (parsed && typeof parsed.health === 'number') setLastSyncedHealth(parsed.health);
      }
    } catch (_) {}
  }, [account.walletAddress]);

  // After data loads, optionally finalize a pending sync and persist latest health
  useEffect(() => {
    if (finalizeSyncOnData && !isLoading) {
      const now = Date.now();
      setLastSyncAt(now);
      setLastSyncedHealth(realHealthFactor);
      try {
        localStorage.setItem(
          `df:lastSync:${account.walletAddress}`,
          JSON.stringify({ ts: now, health: realHealthFactor })
        );
      } catch (_) {}
      setFinalizeSyncOnData(false);
    }
  }, [finalizeSyncOnData, isLoading, realHealthFactor, account.walletAddress]);

  // Derive last sync time from account.lastUpdated (blockchain event time)
  const lastSyncTimeMs: number | null = useMemo(() => {
    if (!account.lastUpdated) return null;
    const t = Number(account.lastUpdated);
    if (Number.isNaN(t)) return null;
    return t < 1e12 ? t * 1000 : t; // seconds vs ms
  }, [account.lastUpdated]);

  // Base health for delta: prefer persisted lastSyncedHealth; fallback to initial snapshot (account.healthFactor)
  const baseHealthForDelta: number | null = useMemo(() => {
    return (lastSyncedHealth ?? account.healthFactor) ?? null;
  }, [lastSyncedHealth, account.healthFactor]);

  const healthDeltaSinceLastSync: number | null = useMemo(() => {
    if (baseHealthForDelta == null) return null;
    return Number((realHealthFactor - baseHealthForDelta).toFixed(3));
  }, [realHealthFactor, baseHealthForDelta]);

  // moved lastSyncTimeMs earlier

  // Dollar changes since last sync (compare live fetched values vs account snapshot)
  const collateralDeltaUsd = useMemo(() => {
    // Only show delta once we have a last sync time; otherwise avoid misleading negative deltas
    if (!lastSyncTimeMs) return 0;
    return Number((totalDepositValue - (account.totalSupplied || 0)).toFixed(2));
  }, [totalDepositValue, account.totalSupplied, lastSyncTimeMs]);

  const borrowDeltaUsd = useMemo(() => {
    if (!lastSyncTimeMs) return 0;
    return Number((totalBorrowValue - (account.totalBorrowed || 0)).toFixed(2));
  }, [totalBorrowValue, account.totalBorrowed, lastSyncTimeMs]);

  // Only show actions once assets are loaded
  const showActions = !isLoading && !error;

  // Determine if health changed after load vs initial account.healthFactor
  const hasHealthChanged = showActions && lastSyncedHealth != null && Math.abs(realHealthFactor - lastSyncedHealth) > 1e-6;

  // Sync function to update position via smart contract
  const handleSyncPosition = async () => {
    setIsSyncing(true);
    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );

      // Create contract instance
      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        clients.indexer,
        abi.custom,
        {
          addr:
            account.walletAddress ||
            algosdk.getApplicationAddress(
              Number(networkConfig.contracts.lendingPools[0])
            ),
          sk: new Uint8Array(),
        }
      );

      const builder = {
        lending: new CONTRACT(
          Number(networkConfig.contracts.lendingPools[0]),
          clients.algod,
          clients.indexer,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: account.walletAddress,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      // Sync all markets that the user has positions in
      const marketsToSync = new Set<string>();

      // Add markets for collateral assets
      assets.forEach((asset) => {
        if (asset.depositBalance > 0 && asset.contractId) {
          // For now, we'll sync a default market ID (1) - this should be dynamic based on the asset
          marketsToSync.add(asset.contractId);
        }
      });

      // Add markets for borrowed assets
      assets.forEach((asset) => {
        if (asset.borrowBalance > 0 && asset.contractId) {
          marketsToSync.add(asset.contractId);
        }
      });

      console.log("marketsToSync", { marketsToSync });

      // Sync each market
      const buildN = [];
      for (const marketId of marketsToSync) {
        try {
          const userAddress = account.walletAddress;
          const txnO = (
            await builder.lending.sync_user_market_for_price_change(
              userAddress,
              Number(marketId)
            )
          ).obj;
          buildN.push({
            ...txnO,
            note: new TextEncoder().encode(`lending sync_market ${marketId}`),
          });
        } catch (error) {
          console.warn(`Failed to sync market ${marketId}:`, error);
        }
      }
      console.log("buildN", { buildN });

      ci.setFee(10000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      const customR = await ci.custom();
      console.log("customR", { customR });

      const stxns = await signTransactions(
        customR.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await algosdk.waitForConfirmation(algorandClients.algod, res.txId, 4);

      // Refresh the user assets data after syncing
      await refetch();

      // Mark that we should finalize sync (persist latest health) once data reflects
      setFinalizeSyncOnData(true);

      toast({
        title: "Position Synced",
        description: "Your position data has been updated successfully.",
      });
    } catch (error) {
      console.error("Error syncing position:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync position data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Account Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">Account Address</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-semibold text-foreground">
                {shortenAddress(account.walletAddress, 8)}
              </p>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-secondary rounded-md transition-colors flex-shrink-0 group"
                title="Copy address to clipboard"
                aria-label="Copy address to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground mb-1">Health Factor</p>
            <p className={`text-2xl font-bold ${riskColor}`}>
              {realHealthFactor.toFixed(3)}
            </p>
            {showActions && (
              <div className="mt-1 text-xs text-muted-foreground">
                {lastSyncTimeMs ? (
                  <>
                    <span>Last sync: {new Date(lastSyncTimeMs).toLocaleString()}</span>
                    <span className="ml-2">HF Δ: {healthDeltaSinceLastSync != null ? `${healthDeltaSinceLastSync > 0 ? '+' : ''}${healthDeltaSinceLastSync.toFixed(3)}` : 'n/a'}</span>
                    <span className={`ml-2 ${collateralDeltaUsd === 0 ? '' : (collateralDeltaUsd > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}`}>Collateral Δ: {collateralDeltaUsd > 0 ? '+' : ''}{collateralDeltaUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`ml-2 ${borrowDeltaUsd === 0 ? '' : (borrowDeltaUsd > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}`}>Borrow Δ: {borrowDeltaUsd > 0 ? '+' : ''}{borrowDeltaUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </>
                ) : (
                  <span>Not synced yet</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            {showActions && (
              <DorkFiButton
                variant="secondary"
                onClick={handleSyncPosition}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing..." : "Sync Position"}
              </DorkFiButton>
            )}

            {showActions && (isLiquidatable || isHighRisk) && (
              <DorkFiButton
                variant={isLiquidatable ? "danger-outline" : "high"}
                onClick={onInitiateLiquidation}
                className="flex items-center gap-2 px-4 py-2 hover:scale-105 transition-all"
              >
                {isLiquidatable ? (
                  <Zap className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isLiquidatable ? "Liquidate Now" : "Monitor Position"}
              </DorkFiButton>
            )}
          </div>
        </div>
      </div>

      {/* Health Factor Gauge */}
      <HealthFactorGauge healthFactor={realHealthFactor} />

      {/* Position Summary */}
      <PositionSummary
        account={account}
        realTotalDepositValue={totalDepositValue}
        realTotalBorrowValue={totalBorrowValue}
        realRiskLevel={riskLevel}
        realLiquidationThreshold={weightedLiquidationThreshold}
        weightedCollateralValue={weightedCollateralValue}
      />

      {/* Asset Lists */}
      <div className="grid gap-3 lg:gap-4 grid-cols-1 xl:grid-cols-2">
        {isLoading ? (
          <>
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </>
        ) : error ? (
          <div className="col-span-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Assets</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <DorkFiButton
                  variant="secondary"
                  onClick={refetch}
                  className="ml-2 px-3 py-1.5 text-xs"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </DorkFiButton>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <AssetList
                title="Collateral Assets"
                assets={collateralAssets}
                colorScheme="collateral"
                totalBorrowed={totalBorrowValue}
                accountHealthFactor={realHealthFactor}
                weightedCollateralValue={weightedCollateralValue}
              />
            </div>
            <div className="min-w-0">
              <AssetList
                title="Borrowed Assets"
                assets={borrowedAssets}
                colorScheme="borrowed"
                totalBorrowed={totalBorrowValue}
                accountHealthFactor={realHealthFactor}
                weightedCollateralValue={weightedCollateralValue}
              />
            </div>
          </>
        )}
      </div>

      {/* Risk Warning for Liquidatable Positions */}
      {isLiquidatable && (
        <Alert
          variant="destructive"
          className="border-2 border-destructive/50 bg-destructive/20 shadow-lg shadow-destructive/10 animate-pulse relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-destructive"
        >
          <AlertTriangle className="h-5 w-5 animate-bounce" />
          <AlertTitle className="text-lg font-bold text-destructive">
            Critical Risk Warning
          </AlertTitle>
          <AlertDescription className="text-foreground font-medium">
            This position can be liquidated immediately. The health factor is
            below 1.0, making it eligible for liquidation by any user.
            Liquidators can claim up to 50% of the collateral with a 5% bonus.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
