import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
} from "@/services/lendingService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import type { UserData } from "@/services/dorkfiAPIService";
import { getAllTokensWithDisplayInfo, type NetworkId } from "@/config";

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

export function portfolioPositionChainKey(
  kind: keyof typeof KEY_PREFIX,
  network: string,
  poolId: string,
  asset: string
): string {
  return `${KEY_PREFIX[kind]}|${network}|${poolId}|${asset}`;
}

function parseChainKey(key: string):
  | { kind: "deposit" | "borrow"; network: string; poolId: string; asset: string }
  | null {
  const parts = key.split("|");
  if (parts.length !== 4) return null;
  const [prefix, network, poolId, asset] = parts;
  if (prefix === "d") return { kind: "deposit", network, poolId, asset };
  if (prefix === "b") return { kind: "borrow", network, poolId, asset };
  return null;
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
 * - **api** — `POST /user-data/user/...` (indexer), with direct reads as fallback
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

    for (const portfolioKey of keys) {
      const parsedKey = parseChainKey(portfolioKey);
      if (!parsedKey) continue;
      const { kind, network, poolId, asset } = parsedKey;
      const networkId = network as NetworkId;
      const tokens = getAllTokensWithDisplayInfo(networkId);
      const token = tokens.find(
        (t) => t.symbol === asset && String(t.poolId) === String(poolId)
      );
      if (!token?.underlyingContractId || !token.poolId) continue;

      const mkt = (
        marketData as {
          symbol?: string;
          poolId?: string;
          price?: string | number;
        }[]
      ).find(
        (m) =>
          m.symbol === token.symbol &&
          String(m.poolId) === String(token.poolId)
      );
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
          batch[portfolioKey] = { balance: bal, value: bal * tp };
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
      const { kind, network, poolId, asset } = parsed;
      const networkId = network as NetworkId;
      const tokens = getAllTokensWithDisplayInfo(networkId);
      const token = tokens.find(
        (t) => t.symbol === asset && String(t.poolId) === String(poolId)
      );
      if (!token?.underlyingContractId || !token.poolId) continue;

      const snapId = `${network}|${token.poolId}|${token.underlyingContractId}`;
      if (!groups.has(snapId)) {
        const market = (
          marketData as {
            symbol?: string;
            poolId?: string;
            price?: string | number;
            depositIndex?: string | number | bigint;
            borrowIndex?: string | number | bigint;
          }[]
        ).find(
          (m) =>
            m.symbol === asset &&
            (poolId ? String(m.poolId) === String(poolId) : true)
        );
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
      const tokenPrice = group.market?.price
        ? formatPriceFromContract(
            group.market.price as string | number,
            group.tokenDecimals
          )
        : 1;

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
            batch[row.portfolioKey] = o;
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
        const { network: fbNet, poolId: fbPool, asset } = parsedKey;
        const networkId = fbNet as NetworkId;
        const tokens = getAllTokensWithDisplayInfo(networkId);
        const token = tokens.find(
          (t) => t.symbol === asset && String(t.poolId) === String(fbPool)
        );
        if (!token?.underlyingContractId || !token.poolId) continue;

        const mkt = (
          marketData as {
            symbol?: string;
            poolId?: string;
            price?: string | number;
          }[]
        ).find(
          (m) =>
            m.symbol === token.symbol &&
            String(m.poolId) === String(token.poolId)
        );
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
            setOverrides((prev) => ({
              ...prev,
              [row.portfolioKey]: {
                balance: bal,
                value: bal * tp,
              },
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
      const key = portfolioPositionChainKey("deposit", net, poolId, row.asset);
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
      const key = portfolioPositionChainKey("borrow", net, poolId, row.asset);
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
