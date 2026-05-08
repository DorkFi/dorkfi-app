import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Images,
  Landmark,
  Link2,
  Loader2,
  Minus,
  UserCircle,
  X,
} from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NftHolderClaimSuccessDetails } from "@/components/portfolio/NftHolderClaimSuccessModal";
import { NftHolderRewardsGatewayPaySection } from "./NftHolderRewardsGatewayPaySection";

/** Claim-agent `GET …/:address` JSON (Portfolio query). */
export type NftHolderClaimAgentPayload = {
  address: string;
  claimable: boolean;
  eligible?: boolean;
  transactionCount: number;
  totalClaimableRaw: string;
  totalClaimableDisplay: string;
  batches: Array<{ slots?: Array<{ rewardSymbol?: string }> }>;
  errors: unknown[];
} | null;

/** Live portfolio values used to evaluate collateral, borrow, health, and profile avatar. */
export type NftHolderEligibilitySnapshot = {
  collateralUsd: number;
  borrowedUsd: number;
  healthFactor: number;
  hasProfileAvatar: boolean;
};

type EligibilityCheck = "checking" | "met" | "not_met" | "na";

function EligibilityCheckIcon({ status }: { status: EligibilityCheck }) {
  if (status === "checking") {
    return (
      <Loader2
        className="h-4 w-4 shrink-0 animate-spin text-slate-400"
        aria-label="Checking"
      />
    );
  }
  if (status === "met") {
    return (
      <Check
        className="h-4 w-4 shrink-0 text-emerald-400"
        strokeWidth={2.5}
        aria-label="Met"
      />
    );
  }
  if (status === "not_met") {
    return <X className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={2.5} aria-label="Not met" />;
  }
  return <Minus className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.25} aria-hidden />;
}

function formatNftClaimAgentErrors(errors: unknown[] | undefined): string | null {
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

type NftHolderRewardsModalBodyProps = {
  claimableDisplay: string;
  feeUsd: string;
  displayAddress: string | undefined;
  activeAvmAddress: string | undefined;
  isViewOnly: boolean;
  claimAgent: NftHolderClaimAgentPayload;
  claimAgentPending: boolean;
  claimAgentFetching: boolean;
  claimAgentIsError: boolean;
  claimAgentFetchError: unknown;
  eligibilitySnapshot: NftHolderEligibilitySnapshot | null;
  onPayClose: () => void;
  onClaimSuccessShare?: (details: NftHolderClaimSuccessDetails) => void;
  /** App `QueryClient` for claim-agent cache updates after paid claim (not the nested Wagmi provider client). */
  appQueryClient: QueryClient;
  /** Close rewards modal and open the manual-claim dialog (parent-controlled). */
  onRequestOpenManualClaim?: () => void;
};

export function NftHolderRewardsModalBody({
  claimableDisplay,
  feeUsd,
  displayAddress,
  activeAvmAddress,
  isViewOnly,
  claimAgent,
  claimAgentPending,
  claimAgentFetching,
  claimAgentIsError,
  claimAgentFetchError,
  onPayClose,
  onClaimSuccessShare,
  appQueryClient,
  onRequestOpenManualClaim,
  eligibilitySnapshot,
}: NftHolderRewardsModalBodyProps) {
  const errText =
    claimAgentFetchError instanceof Error ? claimAgentFetchError.message : null;
  const agentOk = Boolean(claimAgent?.eligible ?? claimAgent?.claimable);
  const errDetail = formatNftClaimAgentErrors(claimAgent?.errors);

  const claimAgentDisabled = !displayAddress || isViewOnly;
  /** Only spin before we have a snapshot. Background refetch must not clear met/not_met (avoids stuck "checking"). */
  const claimAgentAwaitingFirstData =
    !claimAgentDisabled &&
    !claimAgent &&
    (claimAgentPending || claimAgentFetching);

  const nftCheck: EligibilityCheck = claimAgentDisabled
    ? "na"
    : claimAgentIsError
      ? "not_met"
      : claimAgentAwaitingFirstData
        ? "checking"
        : claimAgent
          ? agentOk
            ? "met"
            : "not_met"
          : "not_met";

  const localDisabled = eligibilitySnapshot === null;
  const avatarCheck: EligibilityCheck = localDisabled
    ? "na"
    : eligibilitySnapshot.hasProfileAvatar
      ? "met"
      : "not_met";
  const collateralCheck: EligibilityCheck = localDisabled
    ? "na"
    : eligibilitySnapshot.collateralUsd >= 100
      ? "met"
      : "not_met";
  const borrowCheck: EligibilityCheck = localDisabled
    ? "na"
    : eligibilitySnapshot.borrowedUsd >= 10
      ? "met"
      : "not_met";
  const healthCheck: EligibilityCheck = localDisabled
    ? "na"
    : eligibilitySnapshot.healthFactor > 1.1 + 1e-9
      ? "met"
      : "not_met";

  const rewardsEligibilityMet =
    nftCheck === "met" &&
    avatarCheck === "met" &&
    collateralCheck === "met" &&
    borrowCheck === "met" &&
    healthCheck === "met";

  const processSteps = [
    {
      n: 1,
      title: "Connect",
      Icon: Link2,
      body: "Connect your Voi or Algorand wallet that holds the eligible NFT.",
    },
    {
      n: 2,
      title: "Pay agent",
      Icon: CircleDollarSign,
      body: `Connect a Base wallet with at least ${feeUsd} USDC to pay the agent fee.`,
    },
    {
      n: 3,
      title: "Authorize & run",
      Icon: Bot,
      body: "Use Pay agent on Base below to authorize x402 and run the workflow.",
    },
  ] as const;

  return (
    <div className="space-y-0">
      {/* Hero: edge-to-edge; image scales to full modal width (natural aspect) */}
      <div className="border-b border-slate-800">
        <div className="relative w-full overflow-hidden bg-slate-950">
          <img
            src="/nft-reward-agent-hero.png"
            alt="Let the agent handle it — automate eligibility checks and claim NFT holder rewards"
            className="block h-auto w-full max-w-none align-middle"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      <div className="space-y-6 px-8 py-8 sm:px-10 sm:py-9">
        <div className="space-y-1">
          <p className="text-base text-slate-300">
            Claimable now:{" "}
            <span className="text-lg font-bold tabular-nums text-white sm:text-xl">
              {claimableDisplay}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            Pay agent on Base (x402,{" "}
            <span className="font-medium tabular-nums text-slate-300">{feeUsd} USDC</span>) to run
            workflow.
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between md:gap-2">
          {processSteps.map((step, index) => (
            <Fragment key={step.title}>
              <div className="flex min-w-0 flex-1 gap-3 rounded-xl border border-slate-700/70 bg-slate-900/45 p-4 md:border-0 md:bg-transparent md:p-0">
                <span className="text-lg font-bold leading-none text-emerald-400 tabular-nums">
                  {step.n}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <step.Icon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/95">
                      {step.title}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
                </div>
              </div>
              {index < processSteps.length - 1 ? (
                <div className="hidden shrink-0 items-center justify-center self-center md:flex md:px-1">
                  <ChevronRight className="h-5 w-5 text-slate-600" aria-hidden />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 ring-1 ring-slate-800/80 sm:p-5">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            NFT holder rewards eligibility
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Opening this modal refreshes the claim agent. NFT row follows that snapshot; avatar,
            collateral, borrows, and health use your live portfolio totals.
          </p>
          <div className="mt-4 flex flex-col divide-y divide-slate-700/90 lg:flex-row lg:divide-x lg:divide-y-0">
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center lg:flex-1 lg:py-3 lg:first:pl-0">
              <div className="flex items-center gap-2">
                <Images className="h-7 w-7 text-emerald-400" aria-hidden />
                <EligibilityCheckIcon status={nftCheck} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Hold at least
              </p>
              <p className="text-sm font-bold text-emerald-400">1 NFT</p>
              <p className="text-[11px] leading-snug text-slate-400">
                Dork or <span className="text-slate-300">Dork V2</span>
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center lg:flex-1 lg:py-3">
              <div className="flex items-center gap-2">
                <UserCircle className="h-7 w-7 text-emerald-400" aria-hidden />
                <EligibilityCheckIcon status={avatarCheck} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Profile
              </p>
              <p className="text-sm font-bold text-emerald-400">Set avatar</p>
              <p className="text-[11px] leading-snug text-slate-400">in your Dork.fi profile</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center lg:flex-1 lg:py-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-7 w-7 text-emerald-400" aria-hidden />
                <EligibilityCheckIcon status={collateralCheck} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                At least
              </p>
              <p className="text-sm font-bold text-emerald-400">100 USD</p>
              <p className="text-[11px] text-slate-400">in collateral</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center lg:flex-1 lg:py-3">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-7 w-7 text-emerald-400" aria-hidden />
                <EligibilityCheckIcon status={borrowCheck} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                At least
              </p>
              <p className="text-sm font-bold text-emerald-400">10 USD</p>
              <p className="text-[11px] text-slate-400">in borrows</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center lg:flex-1 lg:py-3 lg:last:pr-0">
              <div className="flex items-center gap-2">
                <Activity className="h-7 w-7 text-emerald-400" aria-hidden />
                <EligibilityCheckIcon status={healthCheck} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Health score
              </p>
              <p className="text-sm font-bold text-emerald-400">&gt; 1.10</p>
              <p className="text-[11px] text-slate-400">portfolio health</p>
            </div>
          </div>

          {displayAddress && !isViewOnly ? (
            <div className="mt-4 rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Claim agent snapshot
              </p>
              {claimAgentPending && !claimAgent ? (
                <div className="mt-2 space-y-2" aria-busy="true">
                  <Skeleton className="h-3 w-full bg-slate-800" />
                  <Skeleton className="h-3 w-2/3 bg-slate-800" />
                </div>
              ) : claimAgentIsError ? (
                <p className="mt-2 text-xs text-red-400">
                  Could not load snapshot.{errText ? ` ${errText}` : ""}
                </p>
              ) : claimAgent ? (
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <p>
                    <span
                      className={
                        !agentOk
                          ? "text-amber-300"
                          : errDetail
                            ? "text-amber-200"
                            : "text-emerald-400"
                      }
                    >
                      {!agentOk
                        ? "Does not meet agent checks"
                        : errDetail
                          ? "Meets agent checks (see messages below)"
                          : "Meets agent checks"}
                    </span>
                    {typeof claimAgent.transactionCount === "number" ? (
                      <span className="tabular-nums text-slate-500">
                        {" "}
                        · {claimAgent.transactionCount} indexed action
                        {claimAgent.transactionCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </p>
                  {errDetail ? <p className="text-red-400/90">{errDetail}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {displayAddress ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/25 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300/95">
                Claim manually
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Skip the in-app Base payer ({feeUsd} USDC x402). Opens the manual claim dialog so you
                can review and sign on-chain yourself.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-sky-500/40 text-sky-100 hover:bg-sky-950/60 hover:text-white"
                disabled={!onRequestOpenManualClaim}
                onClick={() => onRequestOpenManualClaim?.()}
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5 shrink-0" aria-hidden />
                Open manual claim
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/30 p-4">
              <NftHolderRewardsGatewayPaySection
                algorandPortfolioAddress={displayAddress}
                activeAvmAddress={activeAvmAddress}
                rewardsEligibilityMet={rewardsEligibilityMet}
                appQueryClient={appQueryClient}
                onClose={onPayClose}
                onClaimSuccessShare={onClaimSuccessShare}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No portfolio address is available. Connect a wallet or open a portfolio route, then try
            again.
          </p>
        )}

        <p className="text-center">
          <a
            href="https://docs.dork.fi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
          >
            How this works
          </a>
        </p>
      </div>
    </div>
  );
}
