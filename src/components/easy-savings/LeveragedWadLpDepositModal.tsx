import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { waitForConfirmation } from "algosdk";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DorkFiButton from "@/components/ui/DorkFiButton";
import AssetSelector from "@/components/easy-borrow/AssetSelector";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import { useLeveragedWadLpQuote } from "@/hooks/useLeveragedWadLpQuote";
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import algorandService from "@/services/algorandService";
import {
  PAIR_USDC_SHARE,
  SAFE_COLLATERAL_USDC_SHARE,
  prepareLeveragedWadLpSupply,
  prepareMintAndPairAfterCollateral,
  prepareUsdcCollateralDeposit,
  readWalletLpBalanceHuman,
} from "@/services/leveragedWadLpService";
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import type { SavingsRoute } from "@/types/easySavings";
import { formatUsdAmount, cn } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import LpPairIconStack from "@/components/pools/LpPairIconStack";
import { getTokenImagePath } from "@/utils/tokenImageUtils";

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

type Phase =
  | "idle"
  | "collateral"
  | "mint_pair"
  | "supplying"
  | "done";

type LeveragedWadLpDepositModalProps = {
  isOpen: boolean;
  onClose: () => void;
  route: SavingsRoute | null;
  networkId: NetworkId;
  onConnectWallet?: () => void;
  onSuccess?: (payload: {
    txId: string;
    kind: "deposit";
    amount: string;
    symbol: string;
  }) => void;
};

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/**
 * Higher Yield USDC/WAD — USDC-first deploy:
 * 1) 75% USDC → DorkFi collateral (safe)
 * 2) Mint WAD + pair 25% USDC on Tinyman
 * 3) Supply LP into Higher Yield savings
 */
const LeveragedWadLpDepositModal = ({
  isOpen,
  onClose,
  route,
  networkId,
  onConnectWallet,
  onSuccess,
}: LeveragedWadLpDepositModalProps) => {
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [usdcAmount, setUsdcAmount] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [mintedLp, setMintedLp] = useState<number | null>(null);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

  const savingsQuote = useEasySavingsQuote({
    networkId,
    route,
    amount: "",
  });

  const quote = useLeveragedWadLpQuote({
    networkId,
    totalUsdc: usdcAmount,
    lpMarketInfo: savingsQuote.market,
    enabled: isOpen,
  });

  const usdcNum = parseFloat(usdcAmount) || 0;
  const isSubmitting =
    phase === "collateral" || phase === "mint_pair" || phase === "supplying";

  useEffect(() => {
    if (!isOpen) return;
    setUsdcAmount("");
    setAdvancedOpen(false);
    setPhase("idle");
    setShowSuccess(false);
    setTxId(null);
    setMintedLp(null);
    setRainbowkitSignDialogSuppressed(false);
  }, [isOpen, route?.asset.configKey, route?.poolId]);

  const ctaState = (() => {
    if (!activeAccount) return "connect" as const;
    if (!route || usdcNum <= 0) return "enter_amount" as const;
    if (
      quote.usdcBalance != null &&
      usdcNum > quote.usdcBalance + 1e-12
    ) {
      return "insufficient_usdc" as const;
    }
    if (quote.error && quote.split) return "cap_exceeded" as const;
    if (!quote.split) return "enter_amount" as const;
    return "deploy" as const;
  })();

  const ctaLabel: Record<typeof ctaState, string> = {
    connect: "Connect Wallet",
    enter_amount: "Enter USDC amount",
    insufficient_usdc: "Insufficient USDC",
    cap_exceeded: "Reduce amount (borrow cap)",
    deploy:
      phase === "collateral"
        ? "1/3 Supplying collateral…"
        : phase === "mint_pair"
          ? "2/3 Minting WAD + pairing…"
          : phase === "supplying"
            ? "3/3 Supplying LP…"
            : "Deploy USDC",
  };

  const ctaDisabled =
    isSubmitting || (ctaState !== "connect" && ctaState !== "deploy");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
    void queryClient.invalidateQueries({ queryKey: ["leveragedWadLp"] });
  };

  const signAndSend = async (bytes: Uint8Array[], label: string) => {
    if (!signTransactions) {
      throw new Error("Connected wallet does not support signing.");
    }
    const walletName = activeWallet?.metadata?.name || "your wallet";
    toast({
      title: "Please Sign Transaction",
      description: `Approve ${label} in ${walletName}.`,
      duration: 12_000,
    });
    const signed = await withRainbowkitHostDialogDismissed({
      wallet: activeWallet,
      setSuppressed: setRainbowkitSignDialogSuppressed,
      leaveOverlayDismissedOnSuccess: true,
      run: () => signTransactions(bytes),
    });
    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) {
      throw new Error("This network is not Algorand-compatible.");
    }
    const { algod } =
      await algorandService.initializeClientsForTransactions(algorandNetwork);
    const res = await algod.sendRawTransaction(signed).do();
    await waitForConfirmation(algod, res.txid, 8);
    return res.txid as string;
  };

  const handleDeploy = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "deploy" || !route || !activeAccount?.address) return;

    try {
      // —— 1) 75% USDC as safe collateral ——
      setPhase("collateral");
      const step1 = await prepareUsdcCollateralDeposit({
        networkId,
        userAddress: activeAccount.address,
        totalUsdcHuman: usdcNum,
      });
      await signAndSend(
        step1.unsignedBytes,
        `supply ${formatToken(step1.split.safeCollateralUsdc, 2)} USDC collateral`
      );

      // —— 2) Mint WAD + pair 25% USDC on Tinyman ——
      setPhase("mint_pair");
      const step2 = await prepareMintAndPairAfterCollateral({
        networkId,
        userAddress: activeAccount.address,
        split: step1.split,
        preferredPoolId: step1.preferredPoolId,
      });
      const mintTxId = await signAndSend(
        step2.unsignedBytes,
        "mint WAD + add Tinyman liquidity"
      );

      // —— 3) Supply LP to Higher Yield ——
      setPhase("supplying");
      let lpToSupply = step2.estimatedLpTokens || step1.estimatedLpTokens;
      try {
        const walletLp = await readWalletLpBalanceHuman(
          networkId,
          activeAccount.address,
          step2.lpTokenId || step1.lpTokenId
        );
        if (walletLp > 0) lpToSupply = walletLp;
      } catch {
        // keep quote estimate
      }

      const supplyPrep = await prepareLeveragedWadLpSupply({
        networkId,
        userAddress: activeAccount.address,
        lpAmountHuman: lpToSupply,
        savingsPoolId: route.poolId,
        savingsMarketId: route.asset.contractId,
        tokenStandard: route.asset.tokenStandard,
        decimals: route.asset.decimals,
      });
      const supplyTxId = await signAndSend(
        supplyPrep.unsignedBytes,
        "supply LP to Higher Yield"
      );

      setMintedLp(lpToSupply);
      setTxId(supplyTxId || mintTxId);
      setShowSuccess(true);
      setPhase("done");
      setRainbowkitSignDialogSuppressed(false);
      invalidate();
      const finalTxId = supplyTxId || mintTxId;
      if (finalTxId) {
        onSuccess?.({
          txId: finalTxId,
          kind: "deposit",
          amount: usdcAmount,
          symbol: "USDC",
        });
      }
      toast({
        title: "Position opened",
        description: `75% USDC safe · 25% paired as LP (~${formatToken(lpToSupply)}).`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      setPhase("idle");
      const msg = e instanceof Error ? e.message : "Deploy failed.";
      toast({
        title: "Deploy failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setMintedLp(null);
    setUsdcAmount("");
    setPhase("idle");
    setAdvancedOpen(false);
  };

  if (!route) return null;

  const split = quote.split;
  const walletUsdc = quote.usdcBalance;

  return (
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className={MODAL_SHELL}>
        <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
          {showSuccess ? (
            <SupplyBorrowCongrats
              transactionType="deposit"
              asset="USDC / WAD LP"
              assetIcon={route.asset.logoPath || "/placeholder.svg"}
              amount={
                mintedLp != null ? String(mintedLp) : usdcAmount
              }
              onViewTransaction={() => {
                if (!txId) return;
                window.open(
                  getExplorerTransactionUrl(networkId, txId),
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              onGoToPortfolio={() => {
                onClose();
                window.location.href = "/portfolio";
              }}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
              viewTransactionDisabled={!txId}
            />
          ) : (
            <>
              <DialogHeader className="space-y-2 text-center pr-6">
                <DialogTitle className="text-2xl font-bold">
                  Deploy USDC
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {(SAFE_COLLATERAL_USDC_SHARE * 100).toFixed(0)}% safe
                  </span>{" "}
                  as USDC collateral, then mint WAD and pair the remaining{" "}
                  <span className="font-medium text-foreground">
                    {(PAIR_USDC_SHARE * 100).toFixed(0)}%
                  </span>{" "}
                  on Tinyman. LP is supplied to Higher Yield.{" "}
                  <span className="text-whale-gold font-medium">
                    Higher risk
                  </span>
                </DialogDescription>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <LpPairIconStack
                    asset1Icon={getTokenImagePath("WAD")}
                    asset2Icon="/lovable-uploads/USDC.webp"
                    fallbackIcon="/lovable-uploads/LP_TMPOOL2_WAD_USDC_pair.png"
                    size="lg"
                    alt="USDC / WAD"
                  />
                  <span className="text-lg font-semibold ml-1">USDC / WAD</span>
                </div>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <AssetSelector
                  label="USDC to deploy"
                  options={[
                    {
                      configKey: "USDC",
                      symbol: "USDC",
                      logoPath: "/lovable-uploads/USDC.webp",
                      balance: walletUsdc,
                      subtitle: "75% safe · 25% LP pair",
                    },
                  ]}
                  value="USDC"
                  onChange={() => {}}
                  amount={usdcAmount}
                  onAmountChange={setUsdcAmount}
                  amountUsd={usdcNum > 0 ? usdcNum : null}
                  amountDisabled={isSubmitting}
                  showMax
                  onMax={() => {
                    if (walletUsdc != null && walletUsdc > 0) {
                      setUsdcAmount(String(walletUsdc));
                    }
                  }}
                  footer={
                    <span>
                      Wallet: {formatToken(walletUsdc)} USDC
                      {walletUsdc != null
                        ? ` · ${formatUsdAmount(walletUsdc)}`
                        : ""}
                    </span>
                  }
                />

                <div className="rounded-xl border border-border/50 p-3 text-sm space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Safe collateral (75%)
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatToken(split?.safeCollateralUsdc, 2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Pair on Tinyman (25%)
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatToken(split?.pairUsdc, 2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">WAD minted</span>
                    <span className="tabular-nums font-medium">
                      {formatToken(split?.wadToMint)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Est. LP</span>
                    <span className="tabular-nums font-medium">
                      {formatToken(quote.estimatedLpTokens)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Health after
                    </span>
                    <span className="tabular-nums font-medium">
                      {quote.healthAfter != null
                        ? quote.healthAfter.toFixed(2)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">LP APY</span>
                    <span className="tabular-nums font-medium text-emerald-600">
                      {quote.lpSupplyApyPercent != null
                        ? `${quote.lpSupplyApyPercent.toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>
                  {isSubmitting ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <Loader2 className="size-3.5 animate-spin" />
                      {phase === "collateral"
                        ? "Step 1/3 — supply 75% USDC as collateral"
                        : phase === "mint_pair"
                          ? "Step 2/3 — mint WAD + pair 25% USDC"
                          : "Step 3/3 — supply LP to Higher Yield"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground pt-1">
                      Three signatures: collateral → mint + pair → supply LP.
                    </p>
                  )}
                  {quote.error ? (
                    <p className="text-xs text-destructive">{quote.error}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  Advanced details
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      advancedOpen && "rotate-180"
                    )}
                  />
                </button>
                {advancedOpen ? (
                  <dl className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">LP market</dt>
                      <dd>
                        {route.marketLabel} · {route.asset.configKey}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        USDC collateral market
                      </dt>
                      <dd>
                        {quote.usdcCollateralRoute
                          ? `${quote.usdcCollateralRoute.marketLabel} · USDC`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Pool ratio</dt>
                      <dd>
                        {quote.usdcPerWad != null
                          ? `${quote.usdcPerWad.toFixed(4)} USDC / WAD`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        Max WAD after collateral
                      </dt>
                      <dd>
                        {formatToken(quote.maxWadAfterCollateral)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">ALGO (fees)</dt>
                      <dd>
                        {quote.algoBalance != null
                          ? `${formatToken(quote.algoBalance, 3)} spendable`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                <DorkFiButton
                  className="w-full h-12 rounded-xl text-base"
                  disabled={ctaDisabled}
                  onClick={() => void handleDeploy()}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {ctaLabel[ctaState]}
                    </span>
                  ) : (
                    ctaLabel[ctaState]
                  )}
                </DorkFiButton>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeveragedWadLpDepositModal;
