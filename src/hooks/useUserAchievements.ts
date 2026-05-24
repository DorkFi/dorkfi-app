import { useQuery } from "@tanstack/react-query";
import type { UserAchievements } from "@/data/mockUserAchievements";
import { getMockAchievementsForAddress } from "@/data/mockUserAchievements";

export function useUserAchievements(address: string | undefined) {
  return useQuery({
    queryKey: ["user-achievements", address],
    queryFn: async (): Promise<UserAchievements> => {
      if (!address) return {};
      // Phase 2: replace with dorkfi API / on-chain indexer
      return getMockAchievementsForAddress(address);
    },
    enabled: Boolean(address),
    staleTime: 5 * 60 * 1000,
  });
}
