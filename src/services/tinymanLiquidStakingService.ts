const TINYMAN_LIQUID_STAKING_STATISTICS_URL =
  "https://mainnet.analytics.tinyman.org/api/v1/liquid-staking/statistics/";

export type TinymanLiquidStakingStatistics = {
  liquid_staking_annual_percentage_rate?: string;
  talgo_staking_annual_percentage_rate?: string;
  highest_talgo_pool_annual_percentage_rate?: string;
  total_staked_algo_amount?: string;
  total_staked_talgo_amount?: string;
};

/** API rates are decimal fractions (e.g. 0.043774); returns percentage points (e.g. 4.3774). */
export function tinymanRateFractionToPercentPoints(
  fraction: string | undefined
): number | null {
  if (fraction == null || String(fraction).trim() === "") return null;
  const n = Number.parseFloat(fraction);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * 100;
}

export async function fetchTinymanLiquidStakingStatistics(): Promise<TinymanLiquidStakingStatistics> {
  const res = await fetch(TINYMAN_LIQUID_STAKING_STATISTICS_URL);
  if (!res.ok) {
    throw new Error(
      `Tinyman liquid staking statistics failed: HTTP ${res.status}`
    );
  }
  return (await res.json()) as TinymanLiquidStakingStatistics;
}

