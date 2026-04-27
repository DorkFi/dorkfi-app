import { useCallback, useEffect, useRef, useState } from "react";
import BigNumber from "bignumber.js";
import {
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
} from "@/services/lendingService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import type { UserData } from "@/services/dorkfiAPIService";
import {
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  getTokenConfig,
  type NetworkId,
  type TokenConfig,
  getAnyFolksAdapter,
} from "@/config";
import algorandService from "@/services/algorandService";
import {
  estimateFolksDepositMintedFAssetAmount,
  folksFAssetHumanToUnderlyingHuman,
} from "@/services/folksDepositAdapter";
import { marketRowForPortfolioPosition } from "@/utils/marketRowForPortfolioPosition";

export type PortfolioChainLiveOverride = {
  balance?: number;
  value?: number;
  accruedInterest?: number;
  accruedInterestValue?: number;
};

const SCALE = 10n ** 18n;

const KEY_PREFIX = {
  deposit: "d",
  borrow: "b",
} as const;

const CHAIN_KEY_NO_MARKET = "_";

export function portfolioPositionChainKey(
  kind: keyof typeof KEY_PREFIX,
  network: string,
  poolId: string,
  asset: string,
  marketId?: string | null
): string {
  const mid =
    marketId != null && marketId !== "" ? String(marketId) : CHAIN_KEY_NO_MARKET;
  return `${KEY_PREFIX[kind]}|${network}|${poolId}|${mid}|${asset}`;
}

function parseChainKey(key: string):
  | {
      kind: "deposit" | "borrow";
      network: string;
      poolId: string;
      marketId: string;
      asset: string;
    }
  | null {
  const parts = key.split("|");
  if (parts.length === 5) {
    const [prefix, network, poolId, marketIdRaw, asset] = parts;
    const marketId =
      marketIdRaw === CHAIN_KEY_NO_MARKET ? "" : marketIdRaw;
    if (prefix === "d")
      return { kind: "deposit", network, poolId, marketId, asset };
    if (prefix === "b")
      return { kind: "borrow", network, poolId, marketId, asset };
    return null;
  }
  // Legacy: d|network|poolId|asset (display symbol only — collides for ALGO vs fALGO)
  if (parts.length === 4) {
    const [prefix, network, poolId, asset] = parts;
    if (prefix === "d")
      return { kind: "deposit", network, poolId, marketId: "", asset };
    if (prefix === "b")
      return { kind: "borrow", network, poolId, marketId: "", asset };
  }
  return null;
}

function resolvePollToken(
  networkId: NetworkId,
  poolId: string,
  asset: string,
  marketId: string
) {
  const tokens = getAllTokensWithDisplayInfo(networkId);
  if (marketId !== "") {
    const byContract = tokens.find(
      (t) =>
        String(t.underlyingContractId ?? "") === String(marketId) &&
        String(t.poolId ?? "") === String(poolId)
    );
    if (byContract) return byContract;
  }
  return tokens.find(
    (t) => t.symbol === asset && String(t.poolId ?? "") === String(poolId)
  );
}

type PollToken = NonNullable<ReturnType<typeof resolvePollToken>>;

function tokenConfigForPollToken(
  networkId: NetworkId,
  token: PollToken
): TokenConfig | undefined {
  const sym = token.configKey ?? token.originalSymbol ?? token.symbol;
  const raw = getTokenConfig(networkId, sym);
  return Array.isArray(raw)
    ? raw.find((c) => String(c.poolId) === String(token.poolId)) ?? raw[0]
    : raw;
}

/**
 * Folks f-asset deposits are indexed in f-units; portfolio rows show underlying + USD/underlying.
 * Cache key: network + Folks pool name (shared across markets in the same poll sweep).
 */
async function folksMintedFAssetForOneUnderlyingAtomic(
  networkId: NetworkId,
  token: PollToken,
  cache: Map<string, bigint>
): Promise<bigint | null> {
  if (networkId !== "algorand-mainnet") return null;
  const tc = tokenConfigForPollToken(networkId, token);
  const folksPoll = tc ? getAnyFolksAdapter(tc) : undefined;
  if (!folksPoll) return null;
  const poolName = folksPoll.folksParams.pool;
  const cacheKey = `${networkId}|${poolName}`;
  if (cache.has(cacheKey)) {
    const v = cache.get(cacheKey)!;
    return v > 0n ? v : null;
  }
  const algodNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algodNet) return null;
  try {
    const clients = algorandService.initializeClients(algodNet);
    const oneUnderlyingAtomic = BigInt(
      new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
    );
    const { mintedFAsset } = await estimateFolksDepositMintedFAssetAmount({
      poolName,
      underlyingAmount: oneUnderlyingAtomic,
      algod: clients.algod,
    });
    cache.set(cacheKey, mintedFAsset);
    return mintedFAsset > 0n ? mintedFAsset : null;
  } catch {
    return null;
  }
}

function folksDepositOverrideToUnderlying(
  o: PortfolioChainLiveOverride,
  tokenPrice: number,
  tokenDecimals: number,
  minted: bigint | null
): PortfolioChainLiveOverride {
  if (minted == null || minted <= 0n) return o;
  const balance = folksFAssetHumanToUnderlyingHuman(
    o.balance ?? 0,
    minted,
    tokenDecimals
  );
  const accruedInterest = folksFAssetHumanToUnderlyingHuman(
    o.accruedInterest ?? 0,
    minted,
    tokenDecimals
  );
  return {
    ...o,
    balance,
    value: balance * tokenPrice,
    accruedInterest,
    accruedInterestValue: accruedInterest * tokenPrice,
  };
}

function bigIntStr(v: string | number | bigint | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  if (typeof v === "bigint") return v;
  return BigInt(String(v));
}

type MarketRow = {
  depositIndex?: string | number | bigint;
  borrowIndex?: string | number | bigint;
  price?: string | number;
};

/** Same index math as Portfolio `transformedDepositsAndBorrows`. */
function depositFromUserDataAndMarket(
  ud: UserData,
  market: MarketRow | undefined,
  decimals: number,
  tokenPrice: number
): PortfolioChainLiveOverride | null {
  if (!market?.depositIndex) return null;
  const scaledDeposits = bigIntStr(ud.scaledDeposits);
  const depositIndex = bigIntStr(market.depositIndex);
  const userDepositIndex = bigIntStr(ud.depositIndex);
  if (scaledDeposits === 0n) {
    return { balance: 0, value: 0 };
  }
  const actualDepositsRaw = (scaledDeposits * depositIndex) / SCALE;
  const balance = Number(actualDepositsRaw) / 10 ** decimals;
  let accruedInterest = 0;
  if (userDepositIndex > 0n && depositIndex >= userDepositIndex) {
    const interestRaw =
      (scaledDeposits * (depositIndex - userDepositIndex)) / SCALE;
    accruedInterest = Math.max(0, Number(interestRaw) / 10 ** decimals);
  }
  return {
    balance,
    value: balance * tokenPrice,
    accruedInterest,
    accruedInterestValue: accruedInterest * tokenPrice,
  };
}

function borrowFromUserDataAndMarket(
  ud: UserData,
  market: MarketRow | undefined,
  decimals: number,
  tokenPrice: number
): PortfolioChainLiveOverride | null {
  if (!market?.borrowIndex) return null;
  const scaledBorrows = bigIntStr(ud.scaledBorrows);
  const borrowIndex = bigIntStr(market.borrowIndex);
  const userBorrowIndex = bigIntStr(ud.borrowIndex);
  if (scaledBorrows === 0n) {
    return {
      balance: 0,
      value: 0,
      accruedInterest: 0,
      accruedInterestValue: 0,
    };
  }
  const actualBorrowsRaw = (scaledBorrows * borrowIndex) / SCALE;
  const balance = Number(actualBorrowsRaw) / 10 ** decimals;
  let accruedInterest = 0;
  if (userBorrowIndex > 0n && borrowIndex >= userBorrowIndex) {
    const interestRaw =
      (scaledBorrows * (borrowIndex - userBorrowIndex)) / SCALE;
    accruedInterest = Math.max(0, Number(interestRaw) / 10 ** decimals);
  }
  return {
    balance,
    value: balance * tokenPrice,
    accruedInterest,
    accruedInterestValue: accruedInterest * tokenPrice,
  };
}

type PositionRow = {
  asset: string;
  poolId?: string;
  /** Underlying market contract id — required to disambiguate display symbol + pool (e.g. ALGO vs fALGO). */
  marketId?: string;
  balance: number;
  value: number;
  tokenPrice?: number;
  accruedInterest?: number;
  accruedInterestValue?: number;
  interest?: number;
};

type FetchMode = "api" | "chain";

/**
 * After API-backed portfolio load, track visible rows:
 * - **api** — for each visible group, `POST /market-data/...` then
 *   `POST /user-data/user/...` (indexer), with direct reads as fallback
 * - **chain** — direct contract reads only (interval polling)
 */
export function usePortfolioVisibleChainLive(opts: {
  address: string | undefined;
  marketData: unknown[];
  pollIntervalMs?: number;
  enabled?: boolean;
  formatPriceFromContract: (
    contractPrice: string | number,
    tokenDecimals: number
  ) => number;
}) {
  const {
    address,
    marketData,
    pollIntervalMs = Number(
      import.meta.env.VITE_PORTFOLIO_CHAIN_POLL_MS ?? 30_000
    ),
    enabled =
      import.meta.env.VITE_PORTFOLIO_CHAIN_POLL !== "false" &&
      import.meta.env.VITE_PORTFOLIO_CHAIN_POLL !== "0",
    formatPriceFromContract,
  } = opts;

  const useApiUserData =
    import.meta.env.VITE_PORTFOLIO_CHAIN_USE_API_USER_DATA !== "false" &&
    import.meta.env.VITE_PORTFOLIO_CHAIN_USE_API_USER_DATA !== "0";

  const visibleKeysRef = useRef<Set<string>>(new Set());
  const [, bumpVisibility] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  /** Coalesce post-layout polls when many rows mount in one frame. */
  const layoutPollRafRef = useRef<number | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, PortfolioChainLiveOverride>
  >({});

  const processIntersectionEntries = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const visible = visibleKeysRef.current;
      let changed = false;
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.portfolioChainPoll;
        if (!key) continue;
        if (entry.isIntersecting) {
          if (!visible.has(key)) {
            visible.add(key);
            changed = true;
          }
        } else if (visible.delete(key)) {
          changed = true;
        }
      }
      if (changed) bumpVisibility((n) => n + 1);
    },
    []
  );

  const ensureObserver = useCallback(() => {
    if (observerRef.current) return observerRef.current;
    const obs = new IntersectionObserver(
      (entries) => processIntersectionEntries(entries),
      { root: null, rootMargin: "80px", threshold: 0.05 }
    );
    observerRef.current = obs;
    return obs;
  }, [processIntersectionEntries]);

  /** Direct `get_user` + market indices — used for interval refreshes only. */
  const fetchVisibleChainDirect = useCallback(async () => {
    if (!address) return;
    const keys = [...visibleKeysRef.current];
    const batch: Record<string, PortfolioChainLiveOverride> = {};
    const folksMintCache = new Map<string, bigint>();

    for (const portfolioKey of keys) {
      const parsedKey = parseChainKey(portfolioKey);
      if (!parsedKey) continue;
      const { kind, network, poolId, asset, marketId } = parsedKey;
      const networkId = network as NetworkId;
      const token = resolvePollToken(networkId, poolId, asset, marketId);
      if (!token?.underlyingContractId || !token.poolId) continue;

      const mkt = marketRowForPortfolioPosition(marketData as unknown[], {
        marketId: token.underlyingContractId,
        poolId: token.poolId,
        displaySymbol: token.symbol,
      }) as { price?: string | number } | undefined;
      const tp = mkt?.price
        ? formatPriceFromContract(
            mkt.price as string | number,
            token.decimals
          )
        : 1;

      try {
        if (kind === "deposit") {
          const bal = await fetchUserDepositBalance(
            address,
            token.poolId,
            token.underlyingContractId,
            networkId
          );
          if (bal == null) continue;
          const minted = await folksMintedFAssetForOneUnderlyingAtomic(
            networkId,
            token,
            folksMintCache
          );
          batch[portfolioKey] = folksDepositOverrideToUnderlying(
            { balance: bal, value: bal * tp },
            tp,
            token.decimals,
            minted
          );
        } else {
          const borrow = await fetchUserBorrowBalance(
            address,
            token.poolId,
            token.underlyingContractId,
            networkId
          );
          if (!borrow) continue;
          batch[portfolioKey] = {
            balance: borrow.balance,
            value: borrow.balance * tp,
            accruedInterest: borrow.interest,
            accruedInterestValue: borrow.interest * tp,
          };
        }
      } catch (e) {
        console.warn(
          "[usePortfolioVisibleChainLive] chain direct fetch failed",
          portfolioKey,
          e
        );
      }
    }

    if (Object.keys(batch).length > 0) {
      setOverrides((prev) => ({ ...prev, ...batch }));
    }
  }, [address, marketData, formatPriceFromContract]);

  const fetchVisibleWithApiPost = useCallback(async () => {
    if (!address) return;
    const keys = [...visibleKeysRef.current];
    const folksMintCache = new Map<string, bigint>();

    type RowRef = { portfolioKey: string; kind: "deposit" | "borrow" };
    const groups = new Map<
      string,
      {
        network: string;
        networkId: NetworkId;
        appId: number;
        marketId: number;
        tokenDecimals: number;
        market: MarketRow | undefined;
        rows: RowRef[];
      }
    >();

    for (const portfolioKey of keys) {
      const parsed = parseChainKey(portfolioKey);
      if (!parsed) continue;
      const { kind, network, poolId, asset, marketId } = parsed;
      const networkId = network as NetworkId;
      const token = resolvePollToken(networkId, poolId, asset, marketId);
      if (!token?.underlyingContractId || !token.poolId) continue;

      const snapId = `${network}|${token.poolId}|${token.underlyingContractId}`;
      if (!groups.has(snapId)) {
        const market = marketRowForPortfolioPosition(
          marketData as unknown[],
          {
            marketId: token.underlyingContractId,
            poolId: token.poolId,
            displaySymbol: token.symbol,
          }
        ) as MarketRow | undefined;
        groups.set(snapId, {
          network,
          networkId,
          appId: parseInt(String(token.poolId), 10),
          marketId: parseInt(String(token.underlyingContractId), 10),
          tokenDecimals: token.decimals,
          market,
          rows: [],
        });
      }
      groups.get(snapId)!.rows.push({ portfolioKey, kind });
    }

    for (const group of groups.values()) {
      // POST `/market-data/...` so the API refreshes its chain snapshot for this
      // visible position before we load fresh user data (indexer) for the same group.
      try {
        const marketPostRes = await dorkfiAPIService.fetchFreshMarketData(
          group.network,
          group.appId,
          group.marketId
        );
        if (marketPostRes?.success && marketPostRes.data && group.market) {
          const d = marketPostRes.data;
          if (d.price != null) {
            group.market = { ...group.market, price: String(d.price) };
          }
        }
      } catch (e) {
        console.warn(
          "[usePortfolioVisibleChainLive] fetchFreshMarketData (POST) failed",
          {
            network: group.network,
            appId: group.appId,
            marketId: group.marketId,
          },
          e
        );
      }

      const tokenPrice = group.market?.price
        ? formatPriceFromContract(
            group.market.price as string | number,
            group.tokenDecimals
          )
        : 1;

      let groupDepositMinted: bigint | null = null;
      const firstKey = group.rows[0]?.portfolioKey;
      if (firstKey) {
        const fp = parseChainKey(firstKey);
        if (fp) {
          const t0 = resolvePollToken(
            group.networkId,
            fp.poolId,
            fp.asset,
            fp.marketId
          );
          if (t0) {
            groupDepositMinted = await folksMintedFAssetForOneUnderlyingAtomic(
              group.networkId,
              t0,
              folksMintCache
            );
          }
        }
      }

      let ud: UserData | null = null;
      if (useApiUserData) {
        try {
          const res = await dorkfiAPIService.fetchFreshUserData(
            address,
            group.network,
            group.appId,
            group.marketId
          );
          if (res.success && res.data) {
            ud = res.data;
          }
        } catch (e) {
          console.warn(
            "[usePortfolioVisibleChainLive] fetchFreshUserData failed",
            e
          );
        }
      }

      const batch: Record<string, PortfolioChainLiveOverride> = {};
      const needFallback: RowRef[] = [];

      for (const row of group.rows) {
        if (ud && group.market) {
          const o =
            row.kind === "deposit"
              ? depositFromUserDataAndMarket(
                  ud,
                  group.market,
                  group.tokenDecimals,
                  tokenPrice
                )
              : borrowFromUserDataAndMarket(
                  ud,
                  group.market,
                  group.tokenDecimals,
                  tokenPrice
                );
          if (o && Number.isFinite(o.balance)) {
            batch[row.portfolioKey] =
              row.kind === "deposit"
                ? folksDepositOverrideToUnderlying(
                    o,
                    tokenPrice,
                    group.tokenDecimals,
                    groupDepositMinted
                  )
                : o;
            continue;
          }
        }
        needFallback.push(row);
      }

      if (Object.keys(batch).length > 0) {
        setOverrides((prev) => ({ ...prev, ...batch }));
      }

      for (const row of needFallback) {
        const parsedKey = parseChainKey(row.portfolioKey);
        if (!parsedKey) continue;
        const { network: fbNet, poolId: fbPool, asset, marketId: fbMid } =
          parsedKey;
        const networkId = fbNet as NetworkId;
        const token = resolvePollToken(networkId, fbPool, asset, fbMid);
        if (!token?.underlyingContractId || !token.poolId) continue;

        const mkt = marketRowForPortfolioPosition(marketData as unknown[], {
          marketId: token.underlyingContractId,
          poolId: token.poolId,
          displaySymbol: token.symbol,
        }) as { price?: string | number } | undefined;
        const tp = mkt?.price
          ? formatPriceFromContract(
              mkt.price as string | number,
              token.decimals
            )
          : 1;

        try {
          if (row.kind === "deposit") {
            const bal = await fetchUserDepositBalance(
              address,
              token.poolId,
              token.underlyingContractId,
              networkId
            );
            if (bal == null) continue;
            const minted = await folksMintedFAssetForOneUnderlyingAtomic(
              networkId,
              token,
              folksMintCache
            );
            setOverrides((prev) => ({
              ...prev,
              [row.portfolioKey]: folksDepositOverrideToUnderlying(
                { balance: bal, value: bal * tp },
                tp,
                token.decimals,
                minted
              ),
            }));
          } else {
            const borrow = await fetchUserBorrowBalance(
              address,
              token.poolId,
              token.underlyingContractId,
              networkId
            );
            if (!borrow) continue;
            setOverrides((prev) => ({
              ...prev,
              [row.portfolioKey]: {
                balance: borrow.balance,
                value: borrow.balance * tp,
                accruedInterest: borrow.interest,
                accruedInterestValue: borrow.interest * tp,
              },
            }));
          }
        } catch (e) {
          console.warn(
            "[usePortfolioVisibleChainLive] fallback fetch failed",
            row.portfolioKey,
            e
          );
        }
      }
    }
  }, [address, marketData, formatPriceFromContract, useApiUserData]);

  const fetchVisible = useCallback(
    async (mode: FetchMode) => {
      if (mode === "chain") {
        await fetchVisibleChainDirect();
        return;
      }
      await fetchVisibleWithApiPost();
    },
    [fetchVisibleChainDirect, fetchVisibleWithApiPost]
  );

  const runRef = useRef(fetchVisible);
  runRef.current = fetchVisible;

  /** After the next paint, layout/intersection rects are reliable; coalesce many row mounts. */
  const schedulePollAfterLayout = useCallback(() => {
    if (layoutPollRafRef.current !== null) return;
    layoutPollRafRef.current = requestAnimationFrame(() => {
      layoutPollRafRef.current = null;
      queueMicrotask(() => runRef.current("api"));
    });
  }, []);

  const attachChainPollRow = useCallback(
    (key: string | null) => (node: HTMLElement | null) => {
      if (!key || !enabled) return;
      const prev = observedNodesRef.current.get(key);
      if (prev && prev !== node) {
        observerRef.current?.unobserve(prev);
        observedNodesRef.current.delete(key);
      }
      if (!node) {
        if (prev) {
          observerRef.current?.unobserve(prev);
          observedNodesRef.current.delete(key);
          visibleKeysRef.current.delete(key);
        }
        return;
      }
      const obs = ensureObserver();
      node.dataset.portfolioChainPoll = key;
      observedNodesRef.current.set(key, node);
      obs.observe(node);
      // Sync records: IO often delays the first callback until after layout.
      const sync = obs.takeRecords();
      if (sync.length) {
        processIntersectionEntries(sync);
      }
      schedulePollAfterLayout();
    },
    [enabled, ensureObserver, processIntersectionEntries, schedulePollAfterLayout]
  );

  useEffect(() => {
    return () => {
      if (layoutPollRafRef.current !== null) {
        cancelAnimationFrame(layoutPollRafRef.current);
        layoutPollRafRef.current = null;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      visibleKeysRef.current.clear();
      observedNodesRef.current.clear();
    };
  }, []);

  // When rows enter/leave view — POST /user-data (indexer), not chain-only.
  useEffect(() => {
    if (!enabled || !address) return;
    runRef.current("api");
  }, [enabled, address, bumpVisibility]);

  // Interval: direct chain reads only (no POST).
  useEffect(() => {
    if (!enabled || !address || pollIntervalMs <= 0) return;
    const id = window.setInterval(() => runRef.current("chain"), pollIntervalMs);
    return () => window.clearInterval(id);
  }, [enabled, address, pollIntervalMs]);

  const mergeDeposit = useCallback(
    (row: PositionRow): PositionRow => {
      const net = (row as { network?: string }).network ?? "";
      const poolId = String(row.poolId ?? "");
      const key = portfolioPositionChainKey(
        "deposit",
        net,
        poolId,
        row.asset,
        row.marketId
      );
      const o = overrides[key];
      if (!o || (o.balance === undefined && o.value === undefined)) return row;
      return {
        ...row,
        balance: o.balance ?? row.balance,
        value: o.value ?? row.value,
        ...(o.accruedInterest !== undefined
          ? {
              accruedInterest: o.accruedInterest,
              accruedInterestValue:
                o.accruedInterestValue ??
                o.accruedInterest * (row.tokenPrice ?? 1),
            }
          : {}),
      };
    },
    [overrides]
  );

  const mergeBorrow = useCallback(
    (row: PositionRow): PositionRow => {
      const net = (row as { network?: string }).network ?? "";
      const poolId = String(row.poolId ?? "");
      const key = portfolioPositionChainKey(
        "borrow",
        net,
        poolId,
        row.asset,
        row.marketId
      );
      const o = overrides[key];
      if (!o || (o.balance === undefined && o.value === undefined)) return row;
      return {
        ...row,
        balance: o.balance ?? row.balance,
        value: o.value ?? row.value,
        ...(o.accruedInterest !== undefined
          ? {
              accruedInterest: o.accruedInterest,
              interest: o.accruedInterest,
              accruedInterestValue:
                o.accruedInterestValue ??
                o.accruedInterest * (row.tokenPrice ?? 1),
            }
          : {}),
      };
    },
    [overrides]
  );

  return {
    attachChainPollRow,
    mergeDeposit,
    mergeBorrow,
    overrides,
    isChainPollEnabled: enabled,
  };
}
