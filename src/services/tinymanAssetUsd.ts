import { withRpcReadCache } from "@/utils/rpcReadCache";
import { runWithConcurrency } from "@/utils/runWithConcurrency";
import { isPositiveUsd } from "@/utils/displayUsdPerToken";

const TINYMAN_ASSET_USD_URL =
  "https://mainnet.analytics.tinyman.org/api/v1/assets";
const FETCH_TTL_MS = 25_000;
const FETCH_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 8_000;

async function fetchTinymanAssetUsd(asaId: number): Promise<number | null> {
  return withRpcReadCache(
    `tinymanAssetUsd:${asaId}`,
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${TINYMAN_ASSET_USD_URL}/${asaId}/`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { price_in_usd?: unknown };
        const usd = Number.parseFloat(String(data.price_in_usd ?? ""));
        return isPositiveUsd(usd) ? usd : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    FETCH_TTL_MS,
    { shouldCache: (v) => v != null && isPositiveUsd(v) }
  );
}

/** Live Tinyman USD for each ASA. Failed ids are omitted — never invented. */
export async function fetchTinymanAssetUsdMap(
  asaIds: readonly number[]
): Promise<Map<number, number>> {
  const unique = [
    ...new Set(asaIds.filter((id) => Number.isFinite(id) && id >= 0)),
  ];
  const out = new Map<number, number>();
  await runWithConcurrency(unique, FETCH_CONCURRENCY, async (asaId) => {
    const usd = await fetchTinymanAssetUsd(asaId);
    if (isPositiveUsd(usd)) out.set(asaId, usd);
  });
  return out;
}
