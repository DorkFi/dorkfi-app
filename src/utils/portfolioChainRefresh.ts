/**
 * Portfolio positions are painted from the API user snapshot. That snapshot is
 * filled by a background sweep, and a configured market is usually already
 * stored as a zero row, so a new deposit is not chain-filled.
 *
 * After a confirmed supply, borrow, withdraw, or repay, remember the market in
 * localStorage (shared across tabs) and overlay algod `get_user` /
 * `get_global_user` until the API row has the same scaled amounts.
 */

export const PORTFOLIO_CHAIN_REFRESH_STORAGE_KEY = "dorkfi.portfolioPendingMarkets";

export type PortfolioPositionRefreshScope = {
  network: string;
  poolId: string;
  marketId: string;
};

export type PortfolioChainRefreshHint = PortfolioPositionRefreshScope & {
  address: string;
  /** Last successful chain amounts. Shown again if a later read fails. */
  scaledDeposits?: string;
  scaledBorrows?: string;
  depositIndex?: string;
  borrowIndex?: string;
  totalCollateralValue?: string;
  totalBorrowValue?: string;
};

export type ChainUserOverlay = {
  network: string;
  poolId: string;
  appId: string;
  marketId: string;
  underlyingContractId: string;
  scaledDeposits: string;
  scaledBorrows: string;
  depositIndex: string;
  borrowIndex: string;
};

export type ChainGlobalOverlay = {
  network: string;
  poolId: string;
  totalCollateralValue: string;
  totalBorrowValue: string;
};

type LooseRow = Record<string, unknown>;

type ChainReadForHint = {
  hint: PortfolioChainRefreshHint;
  userRow: ChainUserOverlay | null;
  globalRow: ChainGlobalOverlay | null;
};

function poolIdOf(row: LooseRow): string {
  return String(row.poolId ?? row.appId ?? "");
}

function marketIdOf(row: LooseRow): string {
  return String(row.marketId ?? row.underlyingContractId ?? "");
}

function hintKey(hint: PortfolioChainRefreshHint): string {
  return `${hint.address}|${hint.network}|${hint.poolId}|${hint.marketId}`;
}

function normalizeHint(hint: PortfolioChainRefreshHint): PortfolioChainRefreshHint {
  return {
    ...hint,
    address: hint.address,
    network: hint.network,
    poolId: String(hint.poolId),
    marketId: String(hint.marketId),
  };
}

function readAll(): PortfolioChainRefreshHint[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_CHAIN_REFRESH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (hint): hint is PortfolioChainRefreshHint =>
          Boolean(hint) &&
          typeof hint === "object" &&
          typeof (hint as PortfolioChainRefreshHint).address === "string" &&
          typeof (hint as PortfolioChainRefreshHint).network === "string" &&
          (hint as PortfolioChainRefreshHint).poolId != null &&
          (hint as PortfolioChainRefreshHint).marketId != null
      )
      .map((hint) => normalizeHint(hint));
  } catch {
    return [];
  }
}

function writeAll(hints: PortfolioChainRefreshHint[]): void {
  try {
    if (hints.length === 0) {
      localStorage.removeItem(PORTFOLIO_CHAIN_REFRESH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      PORTFOLIO_CHAIN_REFRESH_STORAGE_KEY,
      JSON.stringify(hints)
    );
  } catch {
    /* private mode / SSR */
  }
}

export function rememberPortfolioChainRefresh(
  hint: PortfolioPositionRefreshScope & { address: string } & Partial<
      Pick<
        PortfolioChainRefreshHint,
        | "scaledDeposits"
        | "scaledBorrows"
        | "depositIndex"
        | "borrowIndex"
        | "totalCollateralValue"
        | "totalBorrowValue"
      >
    >
): void {
  if (!hint.address || !hint.network || hint.poolId == null || hint.marketId == null) {
    return;
  }
  const next = normalizeHint(hint);
  const all = readAll();
  const key = hintKey(next);
  const idx = all.findIndex((row) => hintKey(row) === key);
  if (idx >= 0) {
    const prev = all[idx];
    all[idx] = {
      ...prev,
      ...next,
      scaledDeposits: next.scaledDeposits ?? prev.scaledDeposits,
      scaledBorrows: next.scaledBorrows ?? prev.scaledBorrows,
      depositIndex: next.depositIndex ?? prev.depositIndex,
      borrowIndex: next.borrowIndex ?? prev.borrowIndex,
      totalCollateralValue:
        next.totalCollateralValue ?? prev.totalCollateralValue,
      totalBorrowValue: next.totalBorrowValue ?? prev.totalBorrowValue,
    };
  } else {
    all.push(next);
  }
  writeAll(all);
}

export function readPortfolioChainRefresh(
  address: string
): PortfolioChainRefreshHint[] {
  return readAll().filter((hint) => hint.address === address);
}

export function clearPortfolioChainRefresh(address?: string): void {
  if (!address) {
    writeAll([]);
    return;
  }
  writeAll(readAll().filter((hint) => hint.address !== address));
}

/**
 * Replace processed hints for this address with `keep`. Hints remembered for
 * the same address while the chain read was in flight stay in place.
 */
export function commitPortfolioChainRefreshHints(
  address: string,
  processed: PortfolioChainRefreshHint[],
  keep: PortfolioChainRefreshHint[]
): void {
  const processedKeys = new Set(processed.map((hint) => hintKey(hint)));
  const keepByKey = new Map(
    keep.map((hint) => [hintKey(normalizeHint(hint)), normalizeHint(hint)])
  );
  const next: PortfolioChainRefreshHint[] = [];
  for (const hint of readAll()) {
    if (hint.address !== address) {
      next.push(hint);
      continue;
    }
    const key = hintKey(hint);
    if (!processedKeys.has(key)) {
      next.push(hint);
      continue;
    }
    const kept = keepByKey.get(key);
    if (kept) next.push(kept);
  }
  writeAll(next);
}

function scaledBigInt(value: unknown): bigint | null {
  try {
    const raw = String(value ?? "0").split(".")[0].trim();
    if (!raw) return 0n;
    return BigInt(raw);
  } catch {
    return null;
  }
}

export function apiRowMatchesChainAmounts(
  apiRow: LooseRow | undefined,
  chain: { scaledDeposits: string; scaledBorrows: string }
): boolean {
  if (!apiRow) return false;
  const deposits = scaledBigInt(apiRow.scaledDeposits);
  const borrows = scaledBigInt(apiRow.scaledBorrows);
  const chainDeposits = scaledBigInt(chain.scaledDeposits);
  const chainBorrows = scaledBigInt(chain.scaledBorrows);
  if (
    deposits == null ||
    borrows == null ||
    chainDeposits == null ||
    chainBorrows == null
  ) {
    return false;
  }
  return deposits === chainDeposits && borrows === chainBorrows;
}

export function findApiUserRow(
  userData: LooseRow[],
  network: string,
  poolId: string,
  marketId: string
): LooseRow | undefined {
  return userData.find(
    (row) =>
      String(row.network ?? "") === network &&
      poolIdOf(row) === String(poolId) &&
      marketIdOf(row) === String(marketId)
  );
}

function storedUserOverlay(hint: PortfolioChainRefreshHint): ChainUserOverlay | null {
  if (hint.scaledDeposits == null || hint.scaledBorrows == null) return null;
  return {
    network: hint.network,
    poolId: hint.poolId,
    appId: hint.poolId,
    marketId: hint.marketId,
    underlyingContractId: hint.marketId,
    scaledDeposits: hint.scaledDeposits,
    scaledBorrows: hint.scaledBorrows,
    depositIndex: hint.depositIndex ?? "0",
    borrowIndex: hint.borrowIndex ?? "0",
  };
}

function placeholderGlobal(
  hint: PortfolioChainRefreshHint
): ChainGlobalOverlay {
  return {
    network: hint.network,
    poolId: hint.poolId,
    totalCollateralValue: hint.totalCollateralValue ?? "0",
    totalBorrowValue: hint.totalBorrowValue ?? "0",
  };
}

function hasPoolGlobal(rows: LooseRow[], network: string, poolId: string): boolean {
  return rows.some(
    (row) =>
      String(row.network ?? "") === network && poolIdOf(row) === String(poolId)
  );
}

/**
 * Replace the API row for this pool/market (including a stored 0/0 row or a
 * stale non-zero withdraw) with the algod read. Append when the snapshot has
 * no row yet. A zero chain balance stays on the row so the portfolio can drop
 * it from the supplied and borrowed lists. Global totals for the same pool are
 * replaced so header collateral is not double-counted.
 */
export function mergeChainPositionIntoApiSnapshot(
  userData: LooseRow[],
  globalUserData: LooseRow[],
  chainUser: ChainUserOverlay | null,
  chainGlobal: ChainGlobalOverlay | null
): { userData: LooseRow[]; globalUserData: LooseRow[] } {
  const nextUser = userData.slice();
  if (chainUser) {
    const idx = nextUser.findIndex(
      (row) =>
        String(row.network ?? "") === chainUser.network &&
        poolIdOf(row) === chainUser.poolId &&
        marketIdOf(row) === chainUser.marketId
    );
    const overlay: LooseRow = {
      ...(idx >= 0 ? nextUser[idx] : {}),
      network: chainUser.network,
      poolId: chainUser.poolId,
      appId: chainUser.appId,
      marketId: chainUser.marketId,
      underlyingContractId: chainUser.underlyingContractId,
      scaledDeposits: chainUser.scaledDeposits,
      scaledBorrows: chainUser.scaledBorrows,
      depositIndex: chainUser.depositIndex,
      borrowIndex: chainUser.borrowIndex,
    };
    if (idx >= 0) nextUser[idx] = overlay;
    else nextUser.push(overlay);
  }

  const nextGlobal = globalUserData.slice();
  if (chainGlobal) {
    const idx = nextGlobal.findIndex(
      (row) =>
        String(row.network ?? "") === chainGlobal.network &&
        poolIdOf(row) === chainGlobal.poolId
    );
    const overlay: LooseRow = {
      ...(idx >= 0 ? nextGlobal[idx] : {}),
      network: chainGlobal.network,
      poolId: chainGlobal.poolId,
      appId: chainGlobal.poolId,
      totalCollateralValue: chainGlobal.totalCollateralValue,
      totalBorrowValue: chainGlobal.totalBorrowValue,
    };
    if (idx >= 0) nextGlobal[idx] = overlay;
    else nextGlobal.push(overlay);
  }

  return { userData: nextUser, globalUserData: nextGlobal };
}

/**
 * Merge fresh chain reads onto an API snapshot. A pending market is kept until
 * the API row already has the same scaled deposit and borrow. When the fresh
 * read fails, the last stored amounts are used instead.
 */
export function applyChainReadsToSnapshot(
  apiUserData: LooseRow[],
  apiGlobalUserData: LooseRow[],
  reads: ChainReadForHint[],
  poolGlobals: ChainGlobalOverlay[] | null
): {
  userData: LooseRow[];
  globalUserData: LooseRow[];
  hintsToKeep: PortfolioChainRefreshHint[];
  painted: boolean;
} {
  let userData = apiUserData.slice();
  let globalUserData = apiGlobalUserData.slice();
  const hintsToKeep: PortfolioChainRefreshHint[] = [];
  let painted = false;

  for (const read of reads) {
    const hint = normalizeHint(read.hint);
    const fresh = read.userRow;
    const stored = storedUserOverlay(hint);
    const effective = fresh ?? stored;
    const nextHint: PortfolioChainRefreshHint = {
      ...hint,
      scaledDeposits: fresh?.scaledDeposits ?? hint.scaledDeposits,
      scaledBorrows: fresh?.scaledBorrows ?? hint.scaledBorrows,
      depositIndex: fresh?.depositIndex ?? hint.depositIndex,
      borrowIndex: fresh?.borrowIndex ?? hint.borrowIndex,
      totalCollateralValue:
        read.globalRow?.totalCollateralValue ?? hint.totalCollateralValue,
      totalBorrowValue:
        read.globalRow?.totalBorrowValue ?? hint.totalBorrowValue,
    };

    if (effective) {
      const globalForMarket =
        read.globalRow ??
        (hasPoolGlobal(globalUserData, effective.network, effective.poolId)
          ? null
          : placeholderGlobal(nextHint));
      const merged = mergeChainPositionIntoApiSnapshot(
        userData,
        globalUserData,
        effective,
        globalForMarket
      );
      userData = merged.userData;
      globalUserData = merged.globalUserData;
      painted = true;
    }

    const comparable = fresh ?? stored;
    const apiRow = findApiUserRow(
      apiUserData,
      hint.network,
      hint.poolId,
      hint.marketId
    );
    if (comparable && apiRowMatchesChainAmounts(apiRow, comparable)) {
      continue;
    }
    hintsToKeep.push(nextHint);
  }

  if (poolGlobals && poolGlobals.length > 0) {
    for (const globalRow of poolGlobals) {
      const merged = mergeChainPositionIntoApiSnapshot(
        userData,
        globalUserData,
        null,
        globalRow
      );
      userData = merged.userData;
      globalUserData = merged.globalUserData;
    }
  }

  return { userData, globalUserData, hintsToKeep, painted };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read every pending market for this address and overlay it on the snapshot.
 * `apiUserData` may be empty when `GET /users` 404s.
 */
export async function overlayPendingPortfolioPositions(options: {
  userAddress: string;
  apiUserData: LooseRow[];
  apiGlobalUserData: LooseRow[];
  isCurrent?: () => boolean;
  readMarket: (hint: PortfolioChainRefreshHint) => Promise<{
    userRow: ChainUserOverlay | null;
    globalRow: ChainGlobalOverlay | null;
  }>;
  readPoolGlobals: () => Promise<ChainGlobalOverlay[]>;
  attempts?: number;
  retryDelayMs?: number;
}): Promise<{
  userData: LooseRow[];
  globalUserData: LooseRow[];
  painted: boolean;
}> {
  const isCurrent = options.isCurrent ?? (() => true);
  const hints = readPortfolioChainRefresh(options.userAddress);
  if (hints.length === 0 || !isCurrent()) {
    return {
      userData: options.apiUserData,
      globalUserData: options.apiGlobalUserData,
      painted: false,
    };
  }

  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 350;
  const reads: ChainReadForHint[] = [];

  for (const hint of hints) {
    let userRow: ChainUserOverlay | null = null;
    let globalRow: ChainGlobalOverlay | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!isCurrent()) break;
      try {
        const snap = await options.readMarket(hint);
        userRow = snap.userRow;
        globalRow = snap.globalRow;
      } catch {
        userRow = null;
        globalRow = null;
      }
      if (userRow || globalRow) break;
      if (attempt < attempts - 1) await sleep(retryDelayMs);
    }
    reads.push({ hint, userRow, globalRow });
  }

  if (!isCurrent()) {
    return {
      userData: options.apiUserData,
      globalUserData: options.apiGlobalUserData,
      painted: false,
    };
  }

  let poolGlobals: ChainGlobalOverlay[] | null = null;
  try {
    poolGlobals = await options.readPoolGlobals();
  } catch {
    poolGlobals = null;
  }

  if (!isCurrent()) {
    return {
      userData: options.apiUserData,
      globalUserData: options.apiGlobalUserData,
      painted: false,
    };
  }

  const applied = applyChainReadsToSnapshot(
    options.apiUserData,
    options.apiGlobalUserData,
    reads,
    poolGlobals
  );
  commitPortfolioChainRefreshHints(
    options.userAddress,
    hints,
    applied.hintsToKeep
  );
  return {
    userData: applied.userData,
    globalUserData: applied.globalUserData,
    painted: applied.painted,
  };
}
