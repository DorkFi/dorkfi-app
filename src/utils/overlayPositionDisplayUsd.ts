import {
  isDisplayUsdNetwork,
  overlayUsdWithDisplayPrice,
} from "@/utils/displayUsdPerToken";
import { resolveAsaIdForDisplayUsd } from "@/utils/resolveAsaIdForDisplayUsd";

type PositionLike = {
  value?: number;
  tokenPrice?: number;
  balance?: number;
  network?: string;
  poolId?: string;
  marketId?: string;
  configSymbol?: string;
  originalSymbol?: string;
  asset?: string;
  accruedInterest?: number;
  accruedInterestValue?: number;
  interest?: number;
};

export function overlayPositionDisplayUsd<T extends PositionLike>(
  position: T,
  dexUsdByAsaId: Map<number, number>
): T {
  if (!isDisplayUsdNetwork(position.network)) {
    return position;
  }
  const asaId = resolveAsaIdForDisplayUsd({
    networkId: position.network,
    poolId: position.poolId,
    marketId: position.marketId,
    configKey: position.configSymbol,
    originalSymbol: position.originalSymbol,
    displaySymbol: position.asset,
  });
  const dexUsd = asaId != null ? dexUsdByAsaId.get(asaId) : undefined;
  const nextPrice = overlayUsdWithDisplayPrice(
    position.tokenPrice ?? 0,
    dexUsd
  );
  if (!(nextPrice > 0) || nextPrice === position.tokenPrice) {
    return position;
  }
  const balance = position.balance ?? 0;
  const interest = position.accruedInterest ?? position.interest;
  return {
    ...position,
    tokenPrice: nextPrice,
    value: balance * nextPrice,
    accruedInterestValue:
      interest != null && Number.isFinite(interest)
        ? interest * nextPrice
        : position.accruedInterestValue,
  };
}

export function overlayPositionsDisplayUsd<T extends PositionLike>(
  positions: T[],
  dexUsdByAsaId: Map<number, number>
): T[] {
  if (dexUsdByAsaId.size === 0) return positions;
  return positions.map((p) => overlayPositionDisplayUsd(p, dexUsdByAsaId));
}
