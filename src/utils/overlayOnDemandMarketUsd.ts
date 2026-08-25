import type { NetworkId } from "@/config";
import { usdPerTokenFromPortfolioMarketRow } from "@/utils/assetDecimals";
import {
  isDisplayUsdNetwork,
  scaleUsdAmountWithDisplayPrice,
} from "@/utils/displayUsdPerToken";
import { resolveAsaIdForDisplayUsd } from "@/utils/resolveAsaIdForDisplayUsd";

type MarketUsdRow = {
  asset: string;
  configSymbol?: string;
  poolId?: string;
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  supplyCapUSD: number;
  marketInfo?: {
    decimals?: number;
    marketId?: string | number;
    price?: string;
    oracleUsdPerToken?: number;
    symbol?: string;
  };
};

export function overlayOnDemandMarketDisplayUsd<T extends MarketUsdRow>(
  row: T,
  networkId: NetworkId | string,
  dexUsdByAsaId: Map<number, number>
): T {
  if (!isDisplayUsdNetwork(networkId) || dexUsdByAsaId.size === 0) {
    return row;
  }
  const protocolUsd = usdPerTokenFromPortfolioMarketRow(
    row.marketInfo,
    row.marketInfo?.decimals || 6,
    { displaySymbol: row.asset }
  );
  if (!(protocolUsd > 0)) return row;

  const asaId = resolveAsaIdForDisplayUsd({
    networkId,
    poolId: row.poolId,
    marketId:
      row.marketInfo?.marketId != null ? String(row.marketInfo.marketId) : null,
    configKey: row.configSymbol,
    displaySymbol: row.asset,
  });
  const dexUsd = asaId != null ? dexUsdByAsaId.get(asaId) : undefined;

  const nextSupply = scaleUsdAmountWithDisplayPrice(
    row.totalSupplyUSD,
    protocolUsd,
    dexUsd
  );
  const nextBorrow = scaleUsdAmountWithDisplayPrice(
    row.totalBorrowUSD,
    protocolUsd,
    dexUsd
  );
  const nextCap = scaleUsdAmountWithDisplayPrice(
    row.supplyCapUSD,
    protocolUsd,
    dexUsd
  );
  if (
    nextSupply === row.totalSupplyUSD &&
    nextBorrow === row.totalBorrowUSD &&
    nextCap === row.supplyCapUSD
  ) {
    return row;
  }
  return {
    ...row,
    totalSupplyUSD: nextSupply,
    totalBorrowUSD: nextBorrow,
    supplyCapUSD: nextCap,
  };
}

export function overlayOnDemandMarketsRecord<T extends MarketUsdRow>(
  marketsData: Record<string, T>,
  networkId: NetworkId | string,
  dexUsdByAsaId: Map<number, number>
): Record<string, T> {
  if (!isDisplayUsdNetwork(networkId) || dexUsdByAsaId.size === 0) {
    return marketsData;
  }
  let changed = false;
  const next: Record<string, T> = {};
  for (const [key, row] of Object.entries(marketsData)) {
    const overlayed = overlayOnDemandMarketDisplayUsd(
      row,
      networkId,
      dexUsdByAsaId
    );
    next[key] = overlayed;
    if (overlayed !== row) changed = true;
  }
  return changed ? next : marketsData;
}
