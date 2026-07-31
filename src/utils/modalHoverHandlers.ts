import type { MouseEvent } from "react";
import type { NetworkId } from "@/config";
import {
  configSymbolFromMarketRowKey,
  createDebouncedPrefetch,
  prefetchMintModalChunk,
  prefetchSupplyBorrowModalChunk,
  prefetchWithdrawModalChunk,
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

function warmBorrowHeavy(params: MarketActionTokenParams): void {
  // Dynamic import keeps adminService / max-borrow simulate out of Markets chunk.
  void import("@/utils/modalPrefetchHeavy").then((m) => {
    m.warmBorrowModalMaxAndPool(params);
  });
}

function warmWithdrawHeavy(params: MarketActionTokenParams): void {
  void import("@/utils/modalPrefetchHeavy").then((m) => {
    m.warmWithdrawModalRpc(params);
  });
}

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
    marketRowKey,
  };
  const keyBase = [
    bundle.networkId,
    asset,
    poolId ?? "",
    resolvedConfig ?? "",
    marketId ?? "",
    marketRowKey ?? "",
  ].join(":");

  const stop = (e: MouseEvent) => e.stopPropagation();

  return {
    onDepositMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          prefetchSupplyBorrowModalChunk();
          // Warm immediately so a quick click still hits a hot cache.
          bundle.warmWalletBalance?.(params);
          bundle.debounced(`deposit:${keyBase}`, () => {
            bundle.warmWalletBalance?.(params);
          }, 0);
        }
      : undefined,
    onBorrowMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          prefetchSupplyBorrowModalChunk();
          bundle.debounced(`borrow:${keyBase}`, () => {
            warmBorrowHeavy(params);
          });
        }
      : undefined,
    onMintMouseEnter: bundle.userAddress
      ? (e: MouseEvent) => {
          stop(e);
          prefetchMintModalChunk();
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
    prefetchSupplyBorrowModalChunk();
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
    prefetchWithdrawModalChunk();
    bundle.debounced(`withdraw:${keyBase}`, () => {
      if (onWithdrawWarm) {
        onWithdrawWarm(params);
      } else {
        warmWithdrawHeavy(params);
      }
    });
  };
}
