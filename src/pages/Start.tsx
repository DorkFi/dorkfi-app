import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Landmark, Coins, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StartHero from "@/components/start/StartHero";
import AnalyticsSection from "@/components/analytics/AnalyticsSection";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { H2, Body, Caption } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/skeleton";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import {
  getAllTokensWithDisplayInfo,
  type NetworkId,
} from "@/config";
import { fetchMarketInfo } from "@/services/lendingService";
import {
  CURATED_LIQUIDITY_POOLS,
  getTinymanAddLiquidityUrl,
  getTinymanFarmingProgramUrl,
  getTinymanPoolUrl,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import { useLiquidityPoolSnapshot } from "@/hooks/useLiquidityPoolData";
import type { LiquidityPoolApr } from "@/services/tinymanLiquidityService";

const ALGORAND_MAINNET: NetworkId = "algorand-mainnet";

/** User-provided Tinyman yield snapshots when analytics have not loaded yet. */
const FALLBACK_WAD_USDC_YIELD = 5;
const FALLBACK_WAD_ALGO_YIELD = 38;
const FALLBACK_UNIT_ALGO_FARM_YIELD = 20;

function requirePair(id: string): LiquidityPoolPairConfig {
  const pair = CURATED_LIQUIDITY_POOLS.find((item) => item.id === id);
  if (!pair?.poolAddr) {
    throw new Error(`Missing curated Tinyman pool: ${id}`);
  }
  return pair;
}

const WAD_USDC_PAIR = requirePair("wad-usdc");
const WAD_ALGO_PAIR = requirePair("wad-algo");
const UNIT_ALGO_PAIR = requirePair("unit-algo");

function liveYieldPercent(apr: LiquidityPoolApr | null | undefined): number | null {
  if (!apr) return null;
  const value =
    apr.totalApyPercent ??
    apr.totalAprPercent ??
    apr.feeApyPercent ??
    apr.feeAprPercent ??
    null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatYield(
  formatPercent: (value: number, options?: { maximumFractionDigits: number }) => string,
  live: number | null,
  fallback: number
): { label: string; isLive: boolean } {
  if (live != null) {
    return {
      label: formatPercent(live / 100, { maximumFractionDigits: 2 }),
      isLive: true,
    };
  }
  return {
    label: `~${formatPercent(fallback / 100, { maximumFractionDigits: 0 })}`,
    isLive: false,
  };
}

const Start = () => {
  const navigate = useNavigate();
  const { formatPercent } = useNumberI18n();

  const usdcMarket = useMemo(() => {
    return getAllTokensWithDisplayInfo(ALGORAND_MAINNET).find(
      (token) =>
        token.symbol === "USDC" &&
        Boolean(token.poolId) &&
        Boolean(token.underlyingContractId)
    );
  }, []);

  const usdcApyQuery = useQuery({
    queryKey: [
      "start-usdc-deposit-apy",
      usdcMarket?.poolId,
      usdcMarket?.underlyingContractId,
    ],
    enabled: Boolean(usdcMarket?.poolId && usdcMarket?.underlyingContractId),
    staleTime: 30_000,
    queryFn: async () => {
      const info = await fetchMarketInfo(
        usdcMarket!.poolId!,
        usdcMarket!.underlyingContractId!,
        ALGORAND_MAINNET
      );
      const apy = info?.apyCalculation?.apy;
      if (typeof apy === "number" && Number.isFinite(apy)) return apy;
      if (typeof info?.supplyRate === "number" && Number.isFinite(info.supplyRate)) {
        return info.supplyRate * 100;
      }
      return null;
    },
  });

  const wadUsdcSnap = useLiquidityPoolSnapshot(WAD_USDC_PAIR);
  const wadAlgoSnap = useLiquidityPoolSnapshot(WAD_ALGO_PAIR);
  const unitAlgoSnap = useLiquidityPoolSnapshot(UNIT_ALGO_PAIR);

  const usdcApyLabel =
    usdcApyQuery.data != null
      ? formatPercent(usdcApyQuery.data / 100, { maximumFractionDigits: 2 })
      : null;
  const wadUsdcYield = formatYield(
    formatPercent,
    liveYieldPercent(wadUsdcSnap.data?.apr),
    FALLBACK_WAD_USDC_YIELD
  );
  const wadAlgoYield = formatYield(
    formatPercent,
    liveYieldPercent(wadAlgoSnap.data?.apr),
    FALLBACK_WAD_ALGO_YIELD
  );
  const unitAlgoYield = formatYield(
    formatPercent,
    liveYieldPercent(unitAlgoSnap.data?.apr),
    FALLBACK_UNIT_ALGO_FARM_YIELD
  );

  const wadUsdcUrl = getTinymanAddLiquidityUrl(WAD_USDC_PAIR.poolAddr!);
  const wadAlgoUrl = getTinymanAddLiquidityUrl(WAD_ALGO_PAIR.poolAddr!);
  const unitAlgoFarmUrl =
    UNIT_ALGO_PAIR.farms?.[0] != null
      ? getTinymanFarmingProgramUrl(
          UNIT_ALGO_PAIR.poolAddr!,
          UNIT_ALGO_PAIR.farms[0]
        )
      : getTinymanPoolUrl(UNIT_ALGO_PAIR.poolAddr!);
  const unitAlgoAddUrl = getTinymanAddLiquidityUrl(UNIT_ALGO_PAIR.poolAddr!);

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header />

      <main className="relative z-10 mx-auto max-w-[1200px] px-2 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="animate-fade-in space-y-6 md:space-y-8">
          <StartHero />

          <AnalyticsSection title="Start here">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <DorkFiCard className="flex h-full flex-col gap-4 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal">
                    <Landmark className="h-5 w-5" aria-hidden />
                  </div>
                  <Caption className="text-ocean-teal">01</Caption>
                </div>
                <div className="space-y-2">
                  <H2 className="mb-0">Deposit USDC</H2>
                  <Body>
                    Deposit USDC to earn{" "}
                    {usdcApyQuery.isLoading ? (
                      <Skeleton className="inline-block h-5 w-16 align-middle" />
                    ) : usdcApyLabel ? (
                      <span className="font-semibold text-ocean-teal">
                        {usdcApyLabel} APY
                      </span>
                    ) : (
                      <span className="font-semibold text-ocean-teal">
                        the current deposit APY
                      </span>
                    )}{" "}
                    inside DorkFi. This is the straightforward way to put stablecoins
                    to work in the app.
                  </Body>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <DorkFiButton
                    variant="primary"
                    onClick={() => navigate("/market")}
                  >
                    Deposit USDC
                  </DorkFiButton>
                </div>
              </DorkFiCard>

              <DorkFiCard className="flex h-full flex-col gap-4 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal">
                    <Coins className="h-5 w-5" aria-hidden />
                  </div>
                  <Caption className="text-ocean-teal">02</Caption>
                </div>
                <div className="space-y-2">
                  <H2 className="mb-0">Mint WAD for LP yield</H2>
                  <Body>
                    Mint WAD in the app, then pair it with USDC or ALGO on Tinyman
                    to earn LP yield. Search for WAD on Tinyman, or open the pools
                    directly. Currently{" "}
                    <span className="font-semibold text-ocean-teal">
                      {wadUsdcYield.label}
                    </span>{" "}
                    with USDC and{" "}
                    <span className="font-semibold text-ocean-teal">
                      {wadAlgoYield.label}
                    </span>{" "}
                    with ALGO.
                  </Body>
                  <Caption className="block">
                    {wadUsdcYield.isLive || wadAlgoYield.isLive
                      ? "Live Tinyman pool yield."
                      : "Approximate Tinyman LP yield until live data loads."}
                  </Caption>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <DorkFiButton
                    variant="mint"
                    onClick={() => navigate("/market")}
                  >
                    Mint WAD
                  </DorkFiButton>
                  <DorkFiButton
                    variant="secondary"
                    onClick={() => openExternal(wadUsdcUrl)}
                  >
                    WAD / USDC
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </DorkFiButton>
                  <DorkFiButton
                    variant="secondary"
                    onClick={() => openExternal(wadAlgoUrl)}
                  >
                    WAD / ALGO
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </DorkFiButton>
                </div>
              </DorkFiCard>

              <DorkFiCard className="flex h-full flex-col gap-4 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal">
                    <Users className="h-5 w-5" aria-hidden />
                  </div>
                  <Caption className="text-ocean-teal">03</Caption>
                </div>
                <div className="space-y-2">
                  <H2 className="mb-0">Join with UNIT</H2>
                  <Body>
                    Pair UNIT with ALGO to join the Tinyman farm currently producing{" "}
                    <span className="font-semibold text-ocean-teal">
                      {unitAlgoYield.label}
                    </span>{" "}
                    yields. This is the community pool — add liquidity, then stake
                    LP in the farm.
                  </Body>
                  <Caption className="block">
                    {unitAlgoYield.isLive
                      ? "Live Tinyman farm + fee yield."
                      : "Approximate farm yield until live data loads."}
                  </Caption>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <DorkFiButton
                    variant="primary"
                    onClick={() => openExternal(unitAlgoAddUrl)}
                  >
                    Add UNIT / ALGO
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </DorkFiButton>
                  <DorkFiButton
                    variant="secondary"
                    onClick={() => openExternal(unitAlgoFarmUrl)}
                  >
                    Open farm
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </DorkFiButton>
                </div>
              </DorkFiCard>
            </div>
          </AnalyticsSection>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Start;
