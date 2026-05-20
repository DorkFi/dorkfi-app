
import { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import STokenCard from "./STokenCard";
import { MarketRowTokenIcon } from "./MarketRowTokenIcon";
import { ArrowRightLeft } from "lucide-react";
import { getTokenConfig, getAllTokensWithDisplayInfo, getMarketLabel } from "@/config";
import { isAtDepositCap, isAtBorrowCap } from "@/constants/lendingCaps";
import {
  borrowApyBadgeClassName,
  BORROW_APY_BADGE_DEFAULT,
  depositApyBadgeClassName,
  isIntrinsicDepositApyBadge,
} from "@/constants/marketUi";
import { ARC200Service } from "@/services/arc200Service";
import { migrationBalanceEffectKey } from "./migrationBalanceEffectKey";
import algorandService from "@/services/algorandService";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";

interface MarketCardViewProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onBorrowClick: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onMintClick?: (asset: string, poolId?: string, marketRowKey?: string) => void;
  onMigrateClick?: (asset: string) => void;
  getMarketActionHoverHandlers?: (
    asset: string,
    poolId?: string,
    marketRowKey?: string
  ) => {
    onDepositMouseEnter?: (e: React.MouseEvent) => void;
    onBorrowMouseEnter?: (e: React.MouseEvent) => void;
    onMintMouseEnter?: (e: React.MouseEvent) => void;
  };
  onRowMouseEnter?: (market: OnDemandMarketData) => void;
}

const MarketCardView = ({ 
  markets, 
  onRowClick, 
  onInfoClick, 
  onDepositClick, 
  onBorrowClick,
  onMintClick,
  onMigrateClick,
  getMarketActionHoverHandlers,
  onRowMouseEnter,
}: MarketCardViewProps) => {
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();
  const { formatNumber, formatCurrency, formatPercent } = useNumberI18n();
  const [migrationBalances, setMigrationBalances] = useState<
    Record<string, string | null>
  >({});
  const marketsMigrationKey = migrationBalanceEffectKey(markets);
  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  // Check migration balances for markets that have migration property
  useEffect(() => {
    const checkMigrationBalances = async () => {
      if (!activeAccount?.address) {
        setMigrationBalances({});
        return;
      }

      const balances: Record<string, string | null> = {};
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);

      // Initialize ARC200Service
      try {
        const clients = await algorandService.getCurrentClientsForReads();
        ARC200Service.initialize(clients);

        // Check balance for each market that has migration
        for (const market of marketsRef.current) {
          if (market.isSToken) continue;

          const token = tokens.find((t) => t.symbol === market.asset);
          const originalSymbol =
            token && "originalSymbol" in token
              ? (token as any).originalSymbol
              : market.asset;
          const tokenConfigRaw = getTokenConfig(currentNetwork, originalSymbol);
          
          // Handle case where tokenConfig might be an array (multiple markets)
          let tokenConfig: any;
          if (Array.isArray(tokenConfigRaw)) {
            // Try to find matching config by poolId
            const marketPoolId = market.marketInfo?.poolId || market.poolId;
            if (marketPoolId) {
              tokenConfig = tokenConfigRaw.find(tc => String(tc.poolId) === String(marketPoolId)) || tokenConfigRaw[0];
            } else {
              tokenConfig = tokenConfigRaw[0];
            }
          } else {
            tokenConfig = tokenConfigRaw;
          }

          if (tokenConfig?.migration?.nTokenId) {
            try {
              const balance = await ARC200Service.getBalance(
                activeAccount.address,
                tokenConfig.migration.nTokenId
              );
              // Format balance if > 0 (balance is returned as string in base units)
              if (balance && BigInt(balance) > 0n) {
                const formattedBalance = ARC200Service.formatBalance(
                  balance,
                  tokenConfig.decimals
                );
                // Format to 2 decimal places
                balances[market.asset] = parseFloat(formattedBalance).toFixed(2);
              } else {
                balances[market.asset] = null;
              }
            } catch (error) {
              console.error(
                `Error checking migration balance for ${market.asset}:`,
                error
              );
              balances[market.asset] = null;
            }
          }
        }

        setMigrationBalances(balances);
      } catch (error) {
        console.error("Error initializing ARC200Service:", error);
      }
    };

    checkMigrationBalances();
  }, [marketsMigrationKey, activeAccount?.address, currentNetwork]);

  // One card per asset+pool so A and B markets both appear on mobile
  const deduplicatedMarkets = useMemo(() => {
    const marketMap = new Map<string, OnDemandMarketData>();
    markets.forEach((market) => {
      const poolId = market.marketInfo?.poolId || market.poolId || "default";
      const key =
        (market as { _sortKey?: string })._sortKey ??
        `${market.asset}-${poolId}`;
      const existing = marketMap.get(key);
      if (!existing) {
        marketMap.set(key, market);
      } else if (market.isSToken && !existing.isSToken) {
        marketMap.set(key, market);
      }
    });
    return Array.from(marketMap.values());
  }, [markets]);

  if (deduplicatedMarkets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-ink-blue">No markets found matching your search criteria.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {deduplicatedMarkets.map((market) => {
        const poolIdForLabel =
          market.marketInfo?.poolId || market.poolId || undefined;
        const marketLabel = getMarketLabel(currentNetwork, poolIdForLabel);

        // Render special card for s-tokens
        if (market.isSToken) {
          // Use poolId in key to ensure uniqueness even if multiple markets exist
          const marketKey = `${market.asset}-${market.marketInfo?.poolId || market.poolId || 'stoken'}`;
          return (
            <STokenCard
              key={marketKey}
              market={market}
              marketLabel={marketLabel}
              onRowClick={onRowClick}
              onInfoClick={onInfoClick}
              onDepositClick={onDepositClick}
              onBorrowClick={onBorrowClick}
              onMintClick={onMintClick}
            />
          );
        }

        // Render regular card for non-s-tokens
        // Use poolId in key to ensure uniqueness even if multiple markets exist
        const marketKey = `${market.asset}-${market.marketInfo?.poolId || market.poolId || 'default'}`;
        return (
          <DorkFiCard
            key={marketKey}
            className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-6"
            onClick={() => onRowClick(market)}
            onMouseEnter={() => onRowMouseEnter?.(market)}
          >
            {/* Header with logo, asset info, and info button */}
            <div className="flex flex-col items-center text-center md:flex-col-reverse md:items-start md:text-left md:justify-normal">
              <div className="flex items-center gap-3 flex-1">
                <MarketRowTokenIcon
                  market={market}
                  poolLetterLabel={marketLabel}
                  imgClassName="w-10 h-10 md:w-8 md:h-8 flex-shrink-0 rounded-full object-contain"
                />
                <div className="flex flex-col items-center justify-center gap-1 text-center flex-1">
                  <div className="font-semibold text-lg leading-tight">{market.asset}</div>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 h-4 flex items-center justify-center whitespace-nowrap">
                    CF {market.collateralFactor}%
                  </Badge>
                </div>
              </div>
              {/* Removed info icon */}
            </div>

            {/* APY and Supply/Borrow Info */}
            <div className="grid grid-cols-2 gap-4 sm:gap-2 md:grid-cols-2 text-center">
              <div className="flex flex-col items-center md:items-start">
                <div className="text-sm text-muted-foreground mb-1">Deposit APY</div>
                <Badge
                  className={depositApyBadgeClassName(
                    market.hasRewards,
                    market.intrinsicSupplyApyPercent
                  )}
                >
                  <APYDisplay 
                    apyCalculation={market.apyCalculation}
                    fallbackAPY={market.supplyAPY}
                    intrinsicApyPercent={market.intrinsicSupplyApyPercent}
                    bonusRewardsAprPercent={market.rewardsBonusSupplyAprPercent}
                    hasRewardsProgram={!!market.hasRewards}
                    hasIntrinsicApy={isIntrinsicDepositApyBadge(
                      market.hasRewards,
                      market.intrinsicSupplyApyPercent
                    )}
                    showTooltip={true}
                  />
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(Math.round(market.totalSupplyUSD / 1_000_000), "USD", { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <div className="text-sm text-muted-foreground mb-1">Borrow APY</div>
                <Badge
                  className={borrowApyBadgeClassName(
                    market.intrinsicBorrowApyPercent,
                    BORROW_APY_BADGE_DEFAULT
                  )}
                >
                  <BorrowAPYDisplay 
                    apyCalculation={market.apyCalculation}
                    borrowApyCalculation={market.borrowApyCalculation}
                    fallbackAPY={market.borrowAPY}
                    intrinsicBorrowApyPercent={market.intrinsicBorrowApyPercent}
                    showTooltip={true}
                    networkId={currentNetwork}
                    asset={market.asset}
                    poolId={market.marketInfo?.poolId ?? market.poolId}
                    market={market}
                  />
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(Math.round(market.totalBorrowUSD / 1_000_000), "USD", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {market.asset !== "WAD" && (
              <div className="text-center">
                <div className="flex items-center justify-center md:justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Utilization</span>
                  <span className="text-sm font-medium ml-2 md:ml-0">{formatPercent(market.utilization / 100, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-center md:justify-start">
                  <Progress value={market.utilization} className="h-2 w-full max-w-[200px] md:max-w-none" />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2 justify-center md:justify-start">
                <DorkFiButton
                  variant="secondary"
                  onMouseEnter={
                    getMarketActionHoverHandlers?.(
                      market.asset,
                      market.marketInfo?.poolId || market.poolId,
                      (market as { _sortKey?: string })._sortKey
                    )?.onDepositMouseEnter
                  }
                  onClick={e => {
                    e.stopPropagation();
                    onDepositClick(
                      market.asset,
                      market.marketInfo?.poolId || market.poolId,
                      (market as { _sortKey?: string })._sortKey
                    );
                  }}
                  disabled={isAtDepositCap(Number(market.totalSupply ?? 0), Number(market.supplyCap ?? 0))}
                  title={
                    isAtDepositCap(Number(market.totalSupply ?? 0), Number(market.supplyCap ?? 0))
                      ? "Market at supply cap"
                      : undefined
                  }
                >Supply</DorkFiButton>
                <DorkFiButton
                  variant="borrow-outline"
                  onMouseEnter={
                    getMarketActionHoverHandlers?.(
                      market.asset,
                      market.marketInfo?.poolId || market.poolId,
                      (market as { _sortKey?: string })._sortKey
                    )?.onBorrowMouseEnter
                  }
                  onClick={e => {
                    e.stopPropagation();
                    if (isAtBorrowCap(Number(market.totalBorrow ?? 0), Number(market.borrowCap ?? 0))) return;
                    onBorrowClick(
                      market.asset,
                      market.marketInfo?.poolId || market.poolId,
                      (market as { _sortKey?: string })._sortKey
                    );
                  }}
                  disabled={isAtBorrowCap(Number(market.totalBorrow ?? 0), Number(market.borrowCap ?? 0))}
                  title={
                    isAtBorrowCap(Number(market.totalBorrow ?? 0), Number(market.borrowCap ?? 0))
                      ? "Market at borrow cap"
                      : undefined
                  }
                >Borrow</DorkFiButton>
              </div>
              {(() => {
                // Get token to access originalSymbol if market override exists
                const tokens = getAllTokensWithDisplayInfo(currentNetwork);
                const token = tokens.find((t) => t.symbol === market.asset);
                const originalSymbol =
                  token && "originalSymbol" in token
                    ? (token as any).originalSymbol
                    : market.asset;
                const tokenConfigRaw = getTokenConfig(currentNetwork, originalSymbol);
                // Handle case where tokenConfig might be an array (multiple markets)
                let tokenConfig: any;
                if (Array.isArray(tokenConfigRaw)) {
                  // Try to find matching config by poolId
                  const marketPoolId = market.marketInfo?.poolId || market.poolId;
                  if (marketPoolId) {
                    tokenConfig = tokenConfigRaw.find(tc => String(tc.poolId) === String(marketPoolId)) || tokenConfigRaw[0];
                  } else {
                    tokenConfig = tokenConfigRaw[0];
                  }
                } else {
                  tokenConfig = tokenConfigRaw;
                }
                const hasMigration = !!tokenConfig?.migration;
                const migrationBalance = migrationBalances[market.asset];

                return (
                  onMigrateClick &&
                  hasMigration &&
                  migrationBalance && (
                    <DorkFiButton
                      variant="secondary"
                      onClick={e => { e.stopPropagation(); onMigrateClick(market.asset); }}
                      className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <ArrowRightLeft className="h-4 w-4" /> 
                      Migrate {migrationBalance} {market.asset}
                    </DorkFiButton>
                  )
                );
              })()}
            </div>
          </DorkFiCard>
        );
      })}
    </div>
  );
};

export default MarketCardView;
