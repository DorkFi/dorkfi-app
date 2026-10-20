/**
 * Portfolio positions are painted from the API user snapshot. That snapshot is
 * filled by a background sweep (measured ~15 min for per-market rows), and a
 * configured market is usually already present as a zero row — so a new
 * deposit is not "missing" and is not chain-filled.
 *
 * After a confirmed supply/borrow/withdraw/repay, remember the market and
 * overlay a direct algod `get_user` / `get_global_user` read on the next
 * portfolio fetch.
 */

export const PORTFOLIO_CHAIN_REFRESH_MS = 60_000;

const STORAGE_KEY = "dorkfi.portfolioChainRefresh";

export type PortfolioPositionRefreshScope = {
  network: string;
  poolId: string;
  marketId: string;
};

export type PortfolioChainRefreshHint = PortfolioPositionRefreshScope & {
  address: string;
  until: number;
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

function poolIdOf(row: LooseRow): string {
  return String(row.poolId ?? row.appId ?? "");
}

function marketIdOf(row: LooseRow): string {
  return String(row.marketId ?? row.underlyingContractId ?? "");
}

export function rememberPortfolioChainRefresh(
  hint: Omit<PortfolioChainRefreshHint, "until"> & { until?: number }
): void {
  const record: PortfolioChainRefreshHint = {
    address: hint.address,
    network: hint.network,
    poolId: String(hint.poolId),
    marketId: String(hint.marketId),
    until: hint.until ?? Date.now() + PORTFOLIO_CHAIN_REFRESH_MS,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* private mode / SSR */
  }
}

export function readPortfolioChainRefresh(
  address: string
): PortfolioChainRefreshHint | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioChainRefreshHint;
    if (
      !parsed ||
      parsed.address !== address ||
      !parsed.network ||
      !parsed.poolId ||
      !parsed.marketId
    ) {
      return null;
    }
    if (typeof parsed.until !== "number" || parsed.until < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      ...parsed,
      poolId: String(parsed.poolId),
      marketId: String(parsed.marketId),
    };
  } catch {
    return null;
  }
}

export function clearPortfolioChainRefresh(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Replace the API row for this pool/market (including a stored 0/0 row) with
 * the algod read. Append when the snapshot has no row yet.
 * Global totals for the same pool are replaced so header collateral is not
 * double-counted.
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
