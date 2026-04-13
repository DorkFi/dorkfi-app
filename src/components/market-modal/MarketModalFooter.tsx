import React from "react";
import type { NetworkId } from "@/config";
import {
  getExplorerApplicationUrl,
  getExplorerAssetUrl,
} from "@/utils/explorerLinks";

export interface MarketModalFooterProps {
  /** Display symbol (e.g. WAD) */
  asset: string;
  networkId?: string | null;
  /** Lending pool application ID */
  poolAppId?: string | null;
  /** Underlying ASA / asset ID for explorer link, when known */
  underlyingAssetId?: string | null;
}

export const MarketModalFooter = ({
  asset,
  networkId,
  poolAppId,
  underlyingAssetId,
}: MarketModalFooterProps) => {
  const net = networkId as NetworkId | undefined;
  const poolUrl =
    net && poolAppId != null && String(poolAppId).trim() !== ""
      ? getExplorerApplicationUrl(net, String(poolAppId).trim())
      : null;
  const assetUrl =
    net &&
    underlyingAssetId != null &&
    String(underlyingAssetId).trim() !== ""
      ? getExplorerAssetUrl(net, String(underlyingAssetId).trim())
      : null;

  return (
    <div className="px-1 sm:px-2 py-4 mt-2 flex flex-col gap-2 justify-center text-center text-xs text-muted-foreground rounded-b-xl border-t border-border min-w-0 w-full max-w-full">
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {assetUrl && (
          <a
            href={assetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ocean-teal hover:underline font-semibold break-all"
          >
            View {asset} asset on explorer
          </a>
        )}
        {poolUrl && (
          <a
            href={poolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ocean-teal hover:underline font-semibold break-all"
          >
            View lending pool (app) on explorer
          </a>
        )}
        {!assetUrl && !poolUrl && net && (
          <span className="text-muted-foreground/80">
            Explorer links appear when pool and asset IDs are available for this network.
          </span>
        )}
      </div>
      <div className="mt-1 mb-1 text-xs font-medium break-words hyphens-auto">
        Powered by DorkFi. Data & analytics may be delayed or inaccurate. Not financial advice.
      </div>
    </div>
  );
};
