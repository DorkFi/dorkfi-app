import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  fetchNftHolderUnsignedClaim,
  resolveNftHolderClaimRelayerAddress,
  type NftHolderUnsignedClaimResponse,
} from "@/services/paidWorkflowGateway";
import { fetchArc72NftImageUrl } from "@/services/nftService";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function formatUnsignedClaimErrors(errors: unknown[] | undefined): string | null {
  if (!errors?.length) return null;
  const bits: string[] = [];
  for (const e of errors) {
    if (typeof e === "string") {
      bits.push(e);
      continue;
    }
    if (e && typeof e === "object" && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") {
        bits.push(m);
        continue;
      }
    }
    try {
      bits.push(JSON.stringify(e));
    } catch {
      bits.push(String(e));
    }
  }
  return bits.length ? bits.join(" — ") : null;
}

function txnBase64ToUint8(txnBase64: string): Uint8Array {
  return Uint8Array.from(atob(txnBase64.trim()), (c) => c.charCodeAt(0));
}

type NftHolderClaimManualModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Portfolio / claim beneficiary (58-char AVM). */
  beneficiaryAddress: string;
  /** Sign unsigned bytes then broadcast (Portfolio wires algod + network). */
  submitManualNftClaim?: (unsignedTxns: Uint8Array[]) => Promise<void>;
};

export function NftHolderClaimManualModal({
  open,
  onOpenChange,
  beneficiaryAddress,
  submitManualNftClaim,
}: NftHolderClaimManualModalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<NftHolderUnsignedClaimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nftImageUrl, setNftImageUrl] = useState<string | null>(null);
  const [nftImageLoading, setNftImageLoading] = useState(false);

  const loadUnsigned = useCallback(async () => {
    const addr = beneficiaryAddress.trim();
    if (!addr) {
      setData(null);
      setError("No portfolio address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNftHolderUnsignedClaim({
        beneficiaryAddress: addr,
        relayerAddress: resolveNftHolderClaimRelayerAddress(addr),
      });
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load unsigned claim");
    } finally {
      setLoading(false);
    }
  }, [beneficiaryAddress]);

  useEffect(() => {
    if (!open) return;
    void loadUnsigned();
  }, [open, loadUnsigned]);

  useEffect(() => {
    if (!open) {
      setNftImageUrl(null);
      setNftImageLoading(false);
      return;
    }
    const cid = data?.slot?.collectionId;
    const tid = data?.slot?.tokenId?.trim();
    if (typeof cid !== "number" || !tid) {
      setNftImageUrl(null);
      setNftImageLoading(false);
      return;
    }
    let cancelled = false;
    setNftImageLoading(true);
    setNftImageUrl(null);
    void fetchArc72NftImageUrl(cid, tid)
      .then((url) => {
        if (!cancelled) setNftImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setNftImageUrl(null);
      })
      .finally(() => {
        if (!cancelled) setNftImageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data?.slot?.collectionId, data?.slot?.tokenId]);

  const sortedTxns = useMemo(() => {
    if (!data?.transactions?.length) return [];
    return [...data.transactions].sort((a, b) => a.groupIndex - b.groupIndex);
  }, [data]);

  const errDetail = formatUnsignedClaimErrors(data?.errors);
  const canSubmit =
    Boolean(submitManualNftClaim) &&
    data?.claimable === true &&
    sortedTxns.length > 0 &&
    !loading &&
    !submitting;

  const handleSubmit = async () => {
    if (!submitManualNftClaim || !sortedTxns.length) return;
    setSubmitting(true);
    try {
      const unsigned = sortedTxns.map((t) => txnBase64ToUint8(t.txnBase64));
      await submitManualNftClaim(unsigned);
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Manual claim failed",
        description: e instanceof Error ? e.message : "Unknown error while signing or sending.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,880px)] w-full max-w-[min(100vw-1.5rem,42rem)] overflow-y-auto overflow-x-hidden border-slate-800 bg-slate-950 p-0 pt-12 text-slate-100 shadow-2xl sm:max-w-3xl sm:pt-14 z-[110]">
        <div className="border-b border-slate-800">
          <div className="relative w-full overflow-hidden bg-slate-950">
            <img
              src="/nft-manual-claim-hero.png"
              alt="Manual claim ready — review rewards and sign when you choose"
              className="block h-auto w-full max-w-none align-middle"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="space-y-3 px-8 py-5 sm:px-10 sm:py-6">
          <DialogHeader className="space-y-2 pr-6 text-left sm:pr-8">
            <DialogTitle className="text-left text-lg font-semibold tracking-tight text-white">
              Manual claim{" "}
              <span className="text-emerald-400">ready</span>
            </DialogTitle>
            <DialogDescription className="text-left text-xs leading-relaxed text-slate-400">
              Your rewards are ready to be claimed. Review the details below and sign with your
              connected AVM wallet when you are ready.
            </DialogDescription>
          </DialogHeader>
        <div className="space-y-3 pt-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
              Loading unsigned transactions…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : data ? (
            <div className="space-y-3 text-xs">
              <p>
                <span className="text-slate-500">Claimable:</span>{" "}
                <span className={data.claimable ? "text-emerald-400" : "text-amber-300"}>
                  {data.claimable ? "yes" : "no"}
                </span>
                {sortedTxns.length ? (
                  <span className="tabular-nums text-slate-500">
                    {" "}
                    · {sortedTxns.length} transaction{sortedTxns.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </p>
              {data.slot ? (
                <div className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950">
                    {nftImageLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-hidden />
                      </div>
                    ) : nftImageUrl ? (
                      <img
                        src={nftImageUrl}
                        alt={`NFT #${data.slot.tokenId ?? ""}`.trim() || "Reward NFT"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={() => setNftImageUrl(null)}
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wide text-slate-600"
                        aria-hidden
                      >
                        NFT
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-300">
                      {data.slot.campaignName ?? data.slot.campaignId ?? "Reward slot"}
                    </p>
                    {data.slot.rewardSymbol != null || data.slot.claimableDisplay != null ? (
                      <p className="mt-1">
                        {data.slot.claimableDisplay != null ? (
                          <span className="tabular-nums text-white">{data.slot.claimableDisplay}</span>
                        ) : null}{" "}
                        {data.slot.rewardSymbol != null ? (
                          <span className="text-slate-300">{data.slot.rewardSymbol}</span>
                        ) : null}
                      </p>
                    ) : null}
                    {data.slot.tokenId != null ? (
                      <p className="mt-1 text-slate-500">
                        Token <span className="font-mono text-slate-400">{data.slot.tokenId}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {errDetail ? <p className="text-red-300/90">{errDetail}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-200"
              disabled={loading || !beneficiaryAddress.trim()}
              onClick={() => void loadUnsigned()}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Signing…
                </>
              ) : (
                "Claim"
              )}
            </Button>
          </div>
          {!submitManualNftClaim ? (
            <p className="text-[10px] text-amber-200/90">
              Connect a wallet with signing enabled to submit this group from the app.
            </p>
          ) : null}
        </div>
        </div>
        <DialogFooter className="border-t border-slate-800/80 px-8 py-5 sm:justify-center sm:px-10 sm:py-5">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
