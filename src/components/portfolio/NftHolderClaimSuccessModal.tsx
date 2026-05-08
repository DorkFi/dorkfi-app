import { useCallback, useState, type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Gift,
  Shield,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const appUrl =
  typeof window !== "undefined" ? window.location.origin : "https://app.dork.fi";

export type NftHolderClaimSuccessDetails = {
  payerAddress: string;
  algorandAddress: string;
  transactionHash?: string;
  /** Claimable line before cache reset — used in success copy / share while portfolio cache shows 0. */
  claimableSummarySnapshot?: string;
};

type NftHolderClaimSuccessModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: NftHolderClaimSuccessDetails | null;
  claimableSummary: string;
};

function truncateMiddle(s: string, left = 6, right = 4): string {
  const t = s.trim();
  if (t.length <= left + right + 3) return t;
  return `${t.slice(0, left)}…${t.slice(-right)}`;
}

function StepRow({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-emerald-500/20 bg-slate-900/50 px-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/35">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-300/95">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{body}</p>
      </div>
      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
    </div>
  );
}

export function NftHolderClaimSuccessModal({
  open,
  onOpenChange,
  details,
  claimableSummary,
}: NftHolderClaimSuccessModalProps) {
  const [copied, setCopied] = useState<null | "payer" | "tx">(null);

  const copyToClipboard = useCallback(async (label: "payer" | "tx", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const claimableLine =
    details?.claimableSummarySnapshot?.trim() || claimableSummary.trim() || "—";
  const hasAmount = Boolean(claimableLine && claimableLine !== "—");
  const shareText = hasAmount
    ? `Rewards claimed on @dork_fi — paid the agent on Base with x402. Claimable was ${claimableLine}.`
    : "Rewards claimed on @dork_fi — paid the agent on Base with x402.";
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${shareText} 🎁`
  )}&url=${encodeURIComponent(appUrl)}`;

  const payer = details?.payerAddress?.trim() ?? "";
  const avm = details?.algorandAddress?.trim() ?? "";
  const tx = details?.transactionHash?.trim();
  const explorerUrl = tx ? `https://basescan.org/tx/${tx}` : null;
  const whenUtc = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,880px)] w-full max-w-[min(100vw-1.5rem,44rem)] overflow-y-auto overflow-x-hidden border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl z-[110] sm:max-w-2xl">
        <div className="relative w-full border-b border-slate-800 bg-slate-950">
          <img
            src="/nft-reward-agent-hero.png"
            alt="NFT holder rewards claimed — whale AI agent illustration with protocol dashboards"
            className="mx-auto block h-auto w-full max-w-full object-contain object-center"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Claim successful
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Rewards <span className="text-emerald-400">claimed!</span>
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-400">
              Your paid workflow finished on Base. UNIT balances in your portfolio may take a few
              minutes to reflect the claim.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-[1fr,minmax(0,14rem)] md:items-start">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Workflow
              </p>
              <div className="space-y-2">
                <StepRow icon={Shield} title="Eligibility verified" body="Requirements met for this claim." />
                <StepRow
                  icon={Camera}
                  title="Snapshot checked"
                  body="Claim agent snapshot used for this run."
                />
                <StepRow icon={Gift} title="Rewards claimed" body="x402 authorization and workflow completed." />
                <StepRow
                  icon={Wallet}
                  title="Rewards delivered"
                  body="Settlement routed toward your connected portfolio context."
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-b from-emerald-500/10 to-slate-900/80 p-4 shadow-inner ring-1 ring-emerald-500/20">
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Gift className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                You received
              </p>
              <p className="mt-1 text-center text-xl font-bold tabular-nums text-emerald-300 sm:text-2xl">
                {hasAmount ? claimableLine : "—"}
              </p>
              <div className="mt-3 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  Rewards claimed
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-xs text-slate-400">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Paid from (Base)
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="truncate font-mono text-[11px] text-slate-200">
                    {payer ? truncateMiddle(payer, 6, 4) : "—"}
                  </code>
                  {payer ? (
                    <button
                      type="button"
                      className={cn(
                        "shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-400",
                        copied === "payer" && "text-emerald-400"
                      )}
                      aria-label="Copy payer address"
                      onClick={() => void copyToClipboard("payer", payer)}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Portfolio (AVM)
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-200">
                  {avm ? truncateMiddle(avm, 8, 6) : "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Transaction
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {tx ? (
                    <>
                      <code className="font-mono text-[11px] text-emerald-400">
                        {truncateMiddle(tx, 8, 6)}
                      </code>
                      <button
                        type="button"
                        className={cn(
                          "rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-400",
                          copied === "tx" && "text-emerald-400"
                        )}
                        aria-label="Copy transaction hash"
                        onClick={() => void copyToClipboard("tx", tx)}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      {explorerUrl ? (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/95 underline-offset-2 hover:text-emerald-300 hover:underline"
                        >
                          View on Explorer
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500">Hash not returned — check Base activity in your wallet.</span>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-[11px] text-slate-500">{whenUtc} UTC</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="order-2 w-full border-slate-600 bg-transparent text-slate-200 hover:bg-slate-900 sm:order-1 sm:w-auto"
              asChild
            >
              <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                  </svg>
                  Share on X
                </span>
              </a>
            </Button>
            <Button
              type="button"
              className="order-1 w-full border-2 border-emerald-500/60 bg-emerald-500 font-bold text-slate-950 shadow hover:bg-emerald-400 sm:order-2 sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              <span className="flex items-center justify-center gap-2">
                Done
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
