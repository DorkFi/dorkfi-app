import { useQuery } from "@tanstack/react-query";
import type { UserAchievements } from "@/data/userAchievements";
import { getUserAchievementsForAddress } from "@/data/userAchievements";

export function useUserAchievements(address: string | undefined) {
  return useQuery({
    queryKey: ["user-achievements", address],
    queryFn: async (): Promise<UserAchievements> => {
      if (!address) return {};
      return getUserAchievementsForAddress(address);
    },
    enabled: Boolean(address),
    staleTime: 5 * 60 * 1000,
  });
}
