import React from "react";
import { ExternalLink } from "lucide-react";
import type { NetworkId } from "@/config";
import {
  getExplorerApplicationUrl,
  getExplorerAssetUrl,
} from "@/utils/explorerLinks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface TransactionSignPreviewProps {
  mode: "deposit" | "borrow" | "withdraw";
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
  /** Lending pool app (DorkFi) when previewing an xALGO consensus mint in the deposit modal. */
  lendingPoolAppId?: string | null;
  previewVariant?:
    | "lending"
    | "xalgo-consensus-mint"
    | "xalgo-mint-supply-combined"
    | "xalgo-borrow-burn-combined"
    | "xalgo-withdraw-burn-combined"
    | "talgo-tinyman-mint-supply-combined";
  /** Minimum xALGO (human) supplied after mint when `previewVariant` is combined. */
  mintThenSupplyXalgoHumanMin?: string | null;
  /** Folks governance consensus app id (combined flow); mint-only still passes consensus via `poolAppId`. */
  governanceConsensusAppId?: string | null;
}

/**
 * Structured summary shown after transactions are built and before the wallet prompts for a signature.
 * Collapsed by default so the Sign Transaction CTA stays visible without scrolling.
 */
export default function TransactionSignPreview({
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
  lendingPoolAppId,
  previewVariant = "lending",
  mintThenSupplyXalgoHumanMin,
  governanceConsensusAppId,
}: TransactionSignPreviewProps) {
  const isCombo = previewVariant === "xalgo-mint-supply-combined";
  const isTalgoCombo = previewVariant === "talgo-tinyman-mint-supply-combined";
  const isBorrowBurn = previewVariant === "xalgo-borrow-burn-combined";
  const isWithdrawBurn = previewVariant === "xalgo-withdraw-burn-combined";
  const isMintOnlyConsensus = previewVariant === "xalgo-consensus-mint";
  const poolUrl = getExplorerApplicationUrl(networkId, poolAppId);
  const marketUrl = getExplorerApplicationUrl(networkId, marketContractId);
  const lendingPoolUrl =
    lendingPoolAppId != null && String(lendingPoolAppId).trim() !== ""
      ? getExplorerApplicationUrl(networkId, String(lendingPoolAppId).trim())
      : null;
  const consensusAppForUrl =
    (isCombo || isTalgoCombo || isBorrowBurn || isWithdrawBurn) &&
    governanceConsensusAppId
      ? String(governanceConsensusAppId).trim()
      : isMintOnlyConsensus
        ? poolAppId
        : "";
  const consensusUrl =
    consensusAppForUrl !== ""
      ? getExplorerApplicationUrl(networkId, consensusAppForUrl)
      : null;
  const assetUrl =
    underlyingAssetId != null && String(underlyingAssetId).trim() !== ""
      ? getExplorerAssetUrl(networkId, String(underlyingAssetId).trim())
      : null;

  const methodLabel =
    mode === "deposit"
      ? "supply / deposit"
      : mode === "withdraw"
        ? "withdraw"
        : "borrow";

  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-lg border border-ocean-teal/30 bg-muted/40 dark:bg-slate-800/50 text-sm"
    >
      <AccordionItem value="review" className="border-none">
        <AccordionTrigger className="px-3 py-3 hover:no-underline hover:bg-ocean-teal/5 rounded-lg [&[data-state=open]]:rounded-b-none">
          <span className="font-semibold text-slate-800 dark:text-white text-left">
            Review transaction (before signing)
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-0">
          <div className="space-y-2">
            <ul className="space-y-1.5 text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
              <li>
                <span className="text-muted-foreground">Action:</span>{" "}
                <span className="font-medium">
                  {isWithdrawBurn ? (
                    <>
                      Withdraw {amount} {asset} from lending; nt200 releases xALGO, then
                      governance <code className="text-[11px]">burn</code> sends ALGO to
                      your wallet — one atomic wallet group.
                    </>
                  ) : isBorrowBurn && mintThenSupplyXalgoHumanMin ? (
                    <>
                      Borrow at least {mintThenSupplyXalgoHumanMin} xALGO from lending,
                      burn via Folks Governance consensus, receive at least {amount}{" "}
                      ALGO — one atomic wallet group.
                    </>
                  ) : isTalgoCombo && mintThenSupplyXalgoHumanMin ? (
                    <>
                      Mint tALGO (Tinyman liquid staking) with {amount} ALGO, then supply
                      at least {mintThenSupplyXalgoHumanMin} {asset} to the lending pool —
                      one atomic wallet group.
                    </>
                  ) : isCombo && mintThenSupplyXalgoHumanMin ? (
                    <>
                      Mint xALGO (consensus) with {amount} ALGO, then supply at least{" "}
                      {mintThenSupplyXalgoHumanMin} {asset} to the lending pool — one
                      atomic wallet group.
                    </>
                  ) : isMintOnlyConsensus ? (
                    <>Mint xALGO (consensus) with {amount} ALGO</>
                  ) : (
                    <>
                      {mode === "deposit"
                        ? "Deposit"
                        : mode === "withdraw"
                          ? "Withdraw"
                          : "Borrow"}{" "}
                      {amount} {asset}
                    </>
                  )}
                </span>
              </li>
              <li>
                <span className="text-muted-foreground">Network:</span>{" "}
                <span className="font-mono">{networkId}</span>
              </li>
              <li>
                <span className="text-muted-foreground">Contract call shape:</span>{" "}
                {isWithdrawBurn ? (
                  <span className="font-medium">
                    Atomic group: DorkFi lending withdraw, nt200 withdraw (xALGO), then
                    governance <code className="text-[11px]">burn</code> → ALGO
                  </span>
                ) : isBorrowBurn ? (
                  <span className="font-medium">
                    Atomic group: DorkFi lending borrow, nt200 withdraw (xALGO), then
                    governance <code className="text-[11px]">burn</code> → ALGO
                  </span>
                ) : isTalgoCombo ? (
                  <span className="font-medium">
                    Atomic group: Tinyman <code className="text-[11px]">mint</code>{" "}
                    (ALGO → tALGO), nt200, and DorkFi lending deposit
                  </span>
                ) : isCombo ? (
                  <span className="font-medium">
                    Atomic group: governance <code className="text-[11px]">immediate_mint</code>
                    , Folks pool, nt200, and DorkFi lending deposit
                  </span>
                ) : isMintOnlyConsensus ? (
                  <span className="font-medium">
                    Folks Governance xALGO — <code className="text-[11px]">immediate_mint</code>
                  </span>
                ) : (
                  <>
                    lending pool application — <span className="font-medium">{methodLabel}</span> for this market
                  </>
                )}
              </li>
              {(isCombo || isTalgoCombo || isBorrowBurn || isWithdrawBurn) &&
                consensusUrl &&
                consensusAppForUrl ? (
                <li className="break-all">
                  <span className="text-muted-foreground">
                    {isTalgoCombo
                      ? "Tinyman tALGO staking app:"
                      : "Governance consensus app:"}
                  </span>{" "}
                  <a
                    href={consensusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
                  >
                    {consensusAppForUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </li>
              ) : null}
              <li className="break-all">
                <span className="text-muted-foreground">
                  {isMintOnlyConsensus && !isCombo
                    ? "Consensus application ID:"
                    : "Pool (application) ID:"}
                </span>{" "}
                <a
                  href={isMintOnlyConsensus && !isCombo ? (consensusUrl ?? poolUrl) : poolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
                >
                  {isMintOnlyConsensus && !isCombo ? consensusAppForUrl || poolAppId : poolAppId}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              </li>
              <li className="break-all">
                <span className="text-muted-foreground">
                  {isMintOnlyConsensus && !isCombo
                    ? "Related lending market (supply step):"
                    : "Market / asset contract ID:"}
                </span>{" "}
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
              {isMintOnlyConsensus && !isCombo && lendingPoolUrl && lendingPoolAppId && (
                <li className="break-all">
                  <span className="text-muted-foreground">Lending pool (after mint):</span>{" "}
                  <a
                    href={lendingPoolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-teal hover:underline font-mono inline-flex items-center gap-0.5"
                  >
                    {lendingPoolAppId}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </li>
              )}
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
              {previewVariant === "lending" &&
                reserveFactorPercent != null &&
                Number.isFinite(reserveFactorPercent) && (
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
