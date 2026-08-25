import { useEffect, useMemo, useState } from "react";
import { fetchTinymanAssetUsdMap } from "@/services/tinymanAssetUsd";
import { DISPLAY_USD_POLL_MS } from "@/utils/displayUsdPerToken";

/**
 * Polls Tinyman USD for the given Algorand ASA ids.
 * Keeps last good values across refreshes.
 */
export function useDisplayAssetUsdMap(
  asaIds: readonly number[],
  enabled: boolean = true
): Map<number, number> {
  const [map, setMap] = useState<Map<number, number>>(() => new Map());
  const key = useMemo(
    () =>
      [...new Set(asaIds.filter((id) => Number.isFinite(id) && id >= 0))]
        .sort((a, b) => a - b)
        .join(","),
    [asaIds]
  );

  useEffect(() => {
    if (!enabled || key === "") {
      return;
    }
    let cancelled = false;
    const ids = key.split(",").map(Number);

    const load = async () => {
      try {
        const next = await fetchTinymanAssetUsdMap(ids);
        if (cancelled || next.size === 0) return;
        setMap((prev) => {
          const merged = new Map(prev);
          for (const [id, usd] of next) merged.set(id, usd);
          return merged;
        });
      } catch {
        // keep last good map
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), DISPLAY_USD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, key]);

  return map;
}
