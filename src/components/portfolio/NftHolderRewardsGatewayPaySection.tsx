import { useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStorage, WagmiProvider, useAccount, useBalance, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import {
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { getAddress, isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { NftHolderClaimSuccessDetails } from "@/components/portfolio/NftHolderClaimSuccessModal";
import {
  executeClaimlayerPaidClaimAll,
  extractWorkflowTxHash,
  getClaimlayerTargetChain,
  getClaimlayerUsdAmount,
  getPaidWorkflowGatewayOrigin,
} from "@/services/paidWorkflowGateway";
import { AlertTriangle, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNftHolderClaimableDisplayFromAgent } from "@/utils/nftHolderClaimAgentDisplay";

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ??
  "cd7fe0125d88d239da79fa286e6de2a8";

/** Isolated claim-wallet persistence — session-only (tab close clears); not `localStorage`. */
const NFT_REWARD_CLAIM_WAGMI_STORAGE_KEY = "dorkfi-wagmi.nft-reward-claim";

function nftRewardClaimWagmiPersistedStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    window.localStorage.removeItem(NFT_REWARD_CLAIM_WAGMI_STORAGE_KEY);
  } catch {
    /* private mode / blocked storage */
  }
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const nftRewardClaimAppOrigin =
  typeof window !== "undefined" ? window.location.origin : "https://app.dork.fi";

const nftRewardClaimWagmiConfig = getDefaultConfig({
  appName: "DorkFi",
  appDescription: "NFT holder reward claim — Base x402 settlement",
  appUrl: nftRewardClaimAppOrigin,
  appIcon: `${nftRewardClaimAppOrigin}/favicon.ico`,
  projectId: walletConnectProjectId,
  chains: [base],
  ssr: false,
  /** Isolate from main-app xChain Wagmi; sessionStorage avoids long-lived local persistence for this payer. */
  storage: createStorage({
    storage: nftRewardClaimWagmiPersistedStorage(),
    key: NFT_REWARD_CLAIM_WAGMI_STORAGE_KEY,
  }),
  walletConnectParameters: {
    metadata: {
      name: "DorkFi NFT rewards",
      description: "Connect an EVM wallet on Base to pay the x402 claim fee",
      url: nftRewardClaimAppOrigin,
      icons: [`${nftRewardClaimAppOrigin}/favicon.ico`],
    },
    qrModalOptions: {
      themeMode: "dark" as const,
    },
  },
});

/** Module singleton — not recreated each time the modal opens. */
const nftRewardClaimQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

/** Circle USDC on Base mainnet — x402 fee is paid in this asset. */
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Portfolio `useQuery` cache shape for `["nft-holder-claim-agent", address]`. */
function optimisticClaimAgentAfterClaim(prev: unknown, avmAddress: string) {
  const prior = prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {};
  return {
    ...prior,
    address: typeof prior.address === "string" ? prior.address : avmAddress,
    claimable: false,
    eligible: false,
    totalClaimableRaw: "0",
    totalClaimableDisplay: "0",
    batches: [] as Array<{ slots?: Array<{ rewardSymbol?: string }> }>,
  };
}

type NftHolderRewardsGatewayPayInnerProps = {
  /** Portfolio / claim context (may match route or beneficiary). */
  algorandPortfolioAddress: string;
  /** Connected AVM wallet (Voi / Algorand) — must be connected to run this flow; not sent as `targetAddress` (gateway expects Base `0x` there). */
  activeAvmAddress: string;
  /** All NFT reward eligibility rows (agent + portfolio) must be met before paying. */
  rewardsEligibilityMet: boolean;
  /** App root `QueryClient` — claim-agent `useQuery` lives here, not in {@link nftRewardClaimQueryClient}. */
  appQueryClient: QueryClient;
  onClose: () => void;
  /** After a successful paid claim: `onClose` runs first; parent opens success UI with these details. */
  onClaimSuccessShare?: (details: NftHolderClaimSuccessDetails) => void;
};

function NftHolderRewardsGatewayPayInner({
  algorandPortfolioAddress,
  activeAvmAddress,
  rewardsEligibilityMet,
  appQueryClient,
  onClose,
  onClaimSuccessShare,
}: NftHolderRewardsGatewayPayInnerProps) {
  const { toast } = useToast();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState(false);

  const {
    data: baseUsdcBalance,
    isLoading: baseUsdcBalanceLoading,
    isFetching: baseUsdcBalanceFetching,
    isError: baseUsdcBalanceError,
    refetch: refetchBaseUsdcBalance,
  } = useBalance({
    address,
    chainId: base.id,
    token: BASE_MAINNET_USDC,
    query: { enabled: Boolean(address && isConnected) },
  });

  const gatewayOrigin = getPaidWorkflowGatewayOrigin();
  const usdAmount = getClaimlayerUsdAmount();
  const targetChain = getClaimlayerTargetChain();
  const feeUsd = Number.parseFloat(usdAmount) || 0;
  const usdcBalanceNum =
    baseUsdcBalance && !baseUsdcBalanceLoading && !baseUsdcBalanceError
      ? Number.parseFloat(baseUsdcBalance.formatted)
      : null;
  const insufficientUsdc =
    Boolean(isConnected && address) &&
    usdcBalanceNum !== null &&
    !Number.isNaN(usdcBalanceNum) &&
    feeUsd > 0 &&
    usdcBalanceNum + 1e-9 < feeUsd;
  const wrongChain = Boolean(isConnected && address && chainId !== undefined && chainId !== base.id);
  const portfolioMismatch = Boolean(
    activeAvmAddress.trim() &&
      algorandPortfolioAddress.trim() &&
      activeAvmAddress.trim().toLowerCase() !== algorandPortfolioAddress.trim().toLowerCase()
  );

  const runPaidClaim = useCallback(async () => {
    if (!gatewayOrigin) {
      toast({
        title: "Gateway not configured",
        description: "Set VITE_PAID_WORKFLOW_GATEWAY_URL for paid NFT reward claims.",
        variant: "destructive",
      });
      return;
    }
    if (!address) {
      toast({
        title: "Connect a Base wallet",
        description: "Use the button above to connect the EVM wallet that will pay the x402 fee on Base.",
        variant: "destructive",
      });
      return;
    }
    if (!activeAvmAddress.trim()) {
      toast({
        title: "Connect AVM wallet",
        description: "Connect your Voi or Algorand wallet in the app header before paying on Base.",
        variant: "destructive",
      });
      return;
    }
    if (!isAddress(address)) {
      toast({
        title: "Invalid wallet address",
        description: "Reconnect your Base wallet and try again.",
        variant: "destructive",
      });
      return;
    }

    const evm = getAddress(address);

    setBusy(true);
    try {
      if (chainId !== base.id) {
        if (switchChainAsync) {
          await switchChainAsync({ chainId: base.id });
        } else {
          throw new Error("Switch to Base network in your wallet, then try again.");
        }
      }
      /** Pass `account` so the connector client is not built from `accounts[0]` alone (can be undefined vs `useAccount`). */
      const walletClient = await getWalletClient(nftRewardClaimWagmiConfig, {
        chainId: base.id,
        account: evm,
      });
      if (!walletClient) {
        throw new Error("No wallet client on Base");
      }

      const avmBeneficiary = algorandPortfolioAddress.trim();
      if (!avmBeneficiary) {
        throw new Error("Missing portfolio Algorand / Voi address for workflow input.");
      }

      const { body: workflowResult, x402PaymentTransaction } = await executeClaimlayerPaidClaimAll({
        gatewayOrigin,
        walletClient,
        body: {
          address: avmBeneficiary,
          algorandAddress: avmBeneficiary,
          paymentAddress: evm,
          targetAddress: evm,
          chain: "eip155:8453",
          targetChain,
          amount: usdAmount,
        },
      });
      const transactionHash = x402PaymentTransaction ?? extractWorkflowTxHash(workflowResult);

      const claimAgentKey = ["nft-holder-claim-agent", algorandPortfolioAddress] as const;
      await appQueryClient.cancelQueries({ queryKey: claimAgentKey });
      const priorAgent = appQueryClient.getQueryData(claimAgentKey);
      const claimableSummarySnapshot = formatNftHolderClaimableDisplayFromAgent(priorAgent);
      appQueryClient.setQueryData(claimAgentKey, (prev) =>
        optimisticClaimAgentAfterClaim(prev, algorandPortfolioAddress)
      );
      await appQueryClient.invalidateQueries({
        queryKey: claimAgentKey,
        refetchType: "none",
      });
      await refetchBaseUsdcBalance();

      onClose();
      toast({
        title: "Claim submitted",
        description:
          "Paid workflow submitted. UNIT reward balances may take a few minutes to update in your portfolio.",
      });
      onClaimSuccessShare?.({
        payerAddress: evm,
        algorandAddress: avmBeneficiary,
        transactionHash,
        claimableSummarySnapshot,
      });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[nft-holder-reward-claim]", e);
      }
      toast({
        title: "Paid claim failed",
        description:
          e instanceof Error ? e.message : "Unknown error during gateway / x402 flow.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [
    activeAvmAddress,
    address,
    algorandPortfolioAddress,
    chainId,
    appQueryClient,
    gatewayOrigin,
    onClose,
    onClaimSuccessShare,
    switchChainAsync,
    targetChain,
    toast,
    usdAmount,
    refetchBaseUsdcBalance,
  ]);

  return (
    <div className="space-y-4 text-slate-100">
      {portfolioMismatch ? (
        <div
          role="status"
          className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 leading-snug">
            Connected AVM wallet{" "}
            <span className="font-mono font-medium">{activeAvmAddress.trim().slice(0, 10)}…</span>{" "}
            does not match this portfolio{" "}
            <span className="font-mono font-medium">
              {algorandPortfolioAddress.trim().slice(0, 10)}…
            </span>
            . The paid request still uses this portfolio&apos;s <code className="rounded bg-muted/80 px-0.5">address</code> field — confirm before paying.
          </p>
        </div>
      ) : null}
      {!activeAvmAddress.trim() ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Connect your Voi or Algorand wallet in the app header so this paid claim runs in the
          correct portfolio context.
        </p>
      ) : null}
      {wrongChain ? (
        <div className="flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-50 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 leading-snug">
            Your wallet is not on <span className="font-semibold">Base</span>. Switch before signing
            the USDC authorization, or we will prompt a network switch when you pay.
          </p>
          {switchChainAsync ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-sky-600/40 bg-background/80"
              onClick={() => void switchChainAsync({ chainId: base.id })}
            >
              Switch to Base
            </Button>
          ) : null}
        </div>
      ) : null}
      {insufficientUsdc ? (
        <div
          role="status"
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">
            This Base wallet needs at least{" "}
            <span className="font-semibold tabular-nums">{usdAmount} USDC</span> for the agent fee.
            Current balance:{" "}
            <span className="font-mono font-medium tabular-nums">
              {baseUsdcBalance?.formatted} {baseUsdcBalance?.symbol}
            </span>
            .
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-600/80 bg-slate-900/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-slate-400">USDC on Base</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-100"
              disabled={!isConnected || !address || baseUsdcBalanceLoading}
              aria-label="Refresh USDC balance on Base"
              onClick={() => void refetchBaseUsdcBalance()}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (baseUsdcBalanceLoading || baseUsdcBalanceFetching) && "animate-spin"
                )}
                aria-hidden
              />
            </Button>
          </div>
          {!isConnected || !address ? (
            <span className="text-xs text-slate-500">Connect wallet below</span>
          ) : baseUsdcBalanceLoading ? (
            <span className="flex items-center gap-2 tabular-nums text-slate-100">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Loading…
            </span>
          ) : baseUsdcBalanceError ? (
            <span className="text-xs text-destructive">Could not load balance</span>
          ) : baseUsdcBalance ? (
            <span className="font-mono font-medium tabular-nums text-white">
              {baseUsdcBalance.formatted} {baseUsdcBalance.symbol}
            </span>
          ) : (
            <span className="font-mono tabular-nums text-slate-500">0 USDC</span>
          )}
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          Balance on Base for the {usdAmount} USDC x402 authorization (agent fee).
        </p>
      </div>
      <div className="flex justify-center">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
      {!rewardsEligibilityMet ? (
        <p className="text-center text-[11px] leading-snug text-amber-200/90">
          Meet every eligibility requirement above (each row must show met) before paying the agent.
        </p>
      ) : null}
      <Button
        id="nft-reward-primary-pay"
        type="button"
        title={
          !rewardsEligibilityMet ? "Eligibility requirements not met or still loading" : undefined
        }
        disabled={
          busy ||
          !isConnected ||
          !gatewayOrigin ||
          !activeAvmAddress.trim() ||
          insufficientUsdc ||
          !rewardsEligibilityMet
        }
        className="w-full border-2 border-yellow-500 bg-yellow-400 font-bold text-slate-900 shadow hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-700"
        onClick={() => void runPaidClaim()}
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
            Processing…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Pay agent on Base ({usdAmount} USDC)
            <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
          </span>
        )}
      </Button>
    </div>
  );
}

type NftHolderRewardsGatewayPaySectionProps = {
  algorandPortfolioAddress: string;
  /** Connected AVM account from the app wallet (required for this flow; not sent as `targetAddress`). */
  activeAvmAddress: string | undefined;
  rewardsEligibilityMet: boolean;
  appQueryClient: QueryClient;
  onClose: () => void;
  onClaimSuccessShare?: (details: NftHolderClaimSuccessDetails) => void;
};

/**
 * Isolated Wagmi + RainbowKit on Base only, for x402 payment to the paid-workflow gateway.
 */
export function NftHolderRewardsGatewayPaySection({
  algorandPortfolioAddress,
  activeAvmAddress,
  rewardsEligibilityMet,
  appQueryClient,
  onClose,
  onClaimSuccessShare,
}: NftHolderRewardsGatewayPaySectionProps) {
  const gatewayOrigin = getPaidWorkflowGatewayOrigin();

  if (!gatewayOrigin) {
    return (
      <p className="text-sm text-muted-foreground">
        Paid Base (x402) claims are disabled: set{" "}
        <code className="rounded bg-muted px-1 text-xs">VITE_PAID_WORKFLOW_GATEWAY_URL</code>{" "}
        to an absolute <code className="rounded bg-muted px-1 text-xs">https://</code> gateway origin
        (no trailing slash; not a Vite <code className="rounded bg-muted px-1 text-xs">/api/…</code> proxy path).
      </p>
    );
  }

  return (
    <QueryClientProvider client={nftRewardClaimQueryClient}>
      <WagmiProvider config={nftRewardClaimWagmiConfig}>
        <RainbowKitProvider
          initialChain={base}
          theme={darkTheme()}
          modalSize="compact"
          appInfo={{
            appName: "DorkFi",
            learnMoreUrl: "https://docs.dork.fi",
          }}
        >
          <NftHolderRewardsGatewayPayInner
            algorandPortfolioAddress={algorandPortfolioAddress}
            activeAvmAddress={activeAvmAddress?.trim() ?? ""}
            rewardsEligibilityMet={rewardsEligibilityMet}
            appQueryClient={appQueryClient}
            onClose={onClose}
            onClaimSuccessShare={onClaimSuccessShare}
          />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
