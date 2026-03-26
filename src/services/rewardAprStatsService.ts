import { normalizeRewardsPublicBaseUrl } from "@/config";

/** Response shape from `GET /api/reward-apr-stats` (subset used by the app). */
export interface RewardAprStatsResponse {
  targetAprAdjustedToSupplyPercent?: number;
  publicBaseUrl?: string;
  generatedAt?: string;
  dorkfi?: {
    chain?: string;
    poolId?: number;
    contractId?: number;
  };
}

export async function fetchRewardAprStats(
  rewardsPublicBaseUrl: string
): Promise<RewardAprStatsResponse> {
  const origin = normalizeRewardsPublicBaseUrl(rewardsPublicBaseUrl);
  const url = `${origin}/api/reward-apr-stats`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`reward-apr-stats ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<RewardAprStatsResponse>;
}
