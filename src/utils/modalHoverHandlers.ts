import type { MouseEvent } from "react";
import type { NetworkId } from "@/config";
import {
  configSymbolFromMarketRowKey,
  createDebouncedPrefetch,
  warmBorrowModalMaxAndPool,
  warmMintModalRpc,
  warmRepayModalRpc,
  type MarketActionTokenParams,
} from "@/utils/modalPrefetch";

export type ModalHoverPrefetchBundle = {
  debounced: ReturnType<typeof createDebouncedPrefetch>;
  userAddress?: string;
  networkId: NetworkId;
  /** Portfolio / Markets: warm wallet balance via parent fetcher. */
  warmWalletBalance?: (params: MarketActionTokenParams) => void;
};

export function buildMarketHoverHandlers(
  bundle: ModalHoverPrefetchBundle,
  asset: string,
  poolId?: string,
  marketRowKey?: string,
  configSymbol?: string,
  marketId?: string
) {
  const resolvedConfig =
    configSymbol ?? configSymbolFromMarketRowKey(marketRowKey);
  const params: MarketActionTokenParams = {
    userAddress: bundle.userAddress ?? "",
    networkId: bundle.networkId,
    asset,
    poolId,
    configSymbol: resolvedConfig,
    marketId,
  };
  const keyBase = [
    bundle.networkId,
    asset,
    poolId ?? "",
    resolvedConfig ?? "",
    marketId ?? "",
  ].join(":");

  const stop = (e: MouseEvent) => e.stopPropagation();

  return {
    onDepositMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          bundle.debounced(`deposit:${keyBase}`, () => {
            bundle.warmWalletBalance?.(params);
          });
        }
      : undefined,
    onBorrowMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          bundle.debounced(`borrow:${keyBase}`, () => {
            warmBorrowModalMaxAndPool(params);
          });
        }
      : undefined,
    onMintMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          bundle.debounced(`mint:${keyBase}`, () => {
            warmMintModalRpc(params);
          });
        }
      : undefined,
  };
}

export function buildRepayHoverHandler(
  bundle: ModalHoverPrefetchBundle,
  asset: string,
  poolId?: string,
  configSymbol?: string,
  marketId?: string,
  networkIdOverride?: string
) {
  if (!bundle.userAddress) return undefined;
  const networkId = (networkIdOverride ?? bundle.networkId) as NetworkId;
  const params: MarketActionTokenParams = {
    userAddress: bundle.userAddress,
    networkId,
    asset,
    poolId,
    configSymbol,
    marketId,
  };
  const keyBase = [networkId, asset, poolId ?? "", configSymbol ?? "", marketId ?? ""].join(
    ":"
  );
  return (e: MouseEvent) => {
    e.stopPropagation();
    bundle.debounced(`repay:${keyBase}`, () => {
      warmRepayModalRpc(params);
      bundle.warmWalletBalance?.(params);
    });
  };
}

export function buildWithdrawHoverHandler(
  bundle: ModalHoverPrefetchBundle,
  asset: string,
  poolId?: string,
  configSymbol?: string,
  marketId?: string,
  networkIdOverride?: string,
  onWithdrawWarm?: (params: MarketActionTokenParams) => void
) {
  if (!bundle.userAddress) return undefined;
  const networkId = (networkIdOverride ?? bundle.networkId) as NetworkId;
  const params: MarketActionTokenParams = {
    userAddress: bundle.userAddress,
    networkId,
    asset,
    poolId,
    configSymbol,
    marketId,
  };
  const keyBase = [networkId, asset, poolId ?? "", configSymbol ?? "", marketId ?? ""].join(
    ":"
  );
  return (e: MouseEvent) => {
    e.stopPropagation();
    bundle.debounced(`withdraw:${keyBase}`, () => {
      onWithdrawWarm?.(params);
    });
  };
}
