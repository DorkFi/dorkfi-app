import React from "react";
import { ExternalLink } from "lucide-react";
import type { NetworkId } from "@/config";
import {
  getExplorerApplicationUrl,
  getExplorerAssetUrl,
} from "@/utils/explorerLinks";

export interface TransactionSignPreviewProps {
  mode: "deposit" | "borrow";
  asset: string;
  amount: string;
  networkId: NetworkId;
  poolAppId: string;
  marketContractId: string;
  underlyingAssetId?: string | null;
  txnCount: number;
  /** Sum of min fees in ALGO (Algorand/AVM-style), for display only */
  estimatedFeeAlgoDisplay: string;
  reserveFactorPercent?: number | null;
}

/**
 * Structured summary shown after transactions are built and before the wallet prompts for a signature.
 */
const TransactionSignPreview: React.FC<TransactionSignPreviewProps> = ({
  mode,
  asset,
  amount,
  networkId,
  poolAppId,
  marketContractId,
  underlyingAssetId,
  txnCount,
  estimatedFeeAlgoDisplay,
  reserveFactorPercent,
}) => {
  const poolUrl = getExplorerApplicationUrl(networkId, poolAppId);
  const marketUrl = getExplorerApplicationUrl(networkId, marketContractId);
  const assetUrl =
    underlyingAssetId != null && String(underlyingAssetId).trim() !== ""
      ? getExplorerAssetUrl(networkId, String(underlyingAssetId).trim())
      : null;

  const methodLabel =
    mode === "deposit" ? "supply / deposit" : "borrow";

  return (
    <div className="rounded-lg border border-ocean-teal/30 bg-muted/40 dark:bg-slate-800/50 p-3 text-sm space-y-2">
      <p className="font-semibold text-slate-800 dark:text-white">
        Review transaction (before signing)
      </p>
      <ul className="space-y-1.5 text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
        <li>
          <span className="text-muted-foreground">Action:</span>{" "}
          <span className="font-medium">
            {mode === "deposit" ? "Deposit" : "Borrow"} {amount} {asset}
          </span>
        </li>
        <li>
          <span className="text-muted-foreground">Network:</span>{" "}
          <span className="font-mono">{networkId}</span>
        </li>
        <li>
          <span className="text-muted-foreground">Contract call shape:</span>{" "}
          lending pool application — <span className="font-medium">{methodLabel}</span> for this market
        </li>
        <li className="break-all">
          <span className="text-muted-foreground">Pool (application) ID:</span>{" "}
          <a
            href={poolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
          >
            {poolAppId}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        </li>
        <li className="break-all">
          <span className="text-muted-foreground">Market / asset contract ID:</span>{" "}
          <a
            href={marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
          >
            {marketContractId}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        </li>
        {assetUrl && (
          <li className="break-all">
            <span className="text-muted-foreground">Underlying asset ID:</span>{" "}
            <a
              href={assetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
            >
              {String(underlyingAssetId)}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </li>
        )}
        <li>
          <span className="text-muted-foreground">Transactions to sign:</span>{" "}
          {txnCount}
        </li>
        <li>
          <span className="text-muted-foreground">Est. network fee:</span>{" "}
          ~{estimatedFeeAlgoDisplay} ALGO (minimum per transaction; actual fee may differ)
        </li>
        {reserveFactorPercent != null && Number.isFinite(reserveFactorPercent) && (
          <li>
            <span className="text-muted-foreground">Protocol reserve factor (from market data):</span>{" "}
            {reserveFactorPercent}%
          </li>
        )}
      </ul>
      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
        Expected result depends on on-chain state at execution time. Signing sends these
        transaction(s) to the network as built by the protocol contracts—not investment advice.
      </p>
    </div>
  );
};

export default TransactionSignPreview;
