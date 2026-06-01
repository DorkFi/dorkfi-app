import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@txnlab/use-wallet-react";
import { useToast } from "@/hooks/use-toast";
import { useAlgorandAssetBalance, useNt200Arc200Balance } from "@/hooks/useLiquidityPoolData";
import { Loader2 } from "lucide-react";
import { waitForConfirmation } from "algosdk";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";
import {
  buildNt200LpDepositTransactions,
  buildNt200LpWithdrawTransactions,
  buildRemoveLiquidityTransactions,
  encodeSignerTxnsForWallet,
  formatLiquidityAtomic,
  quoteRemoveLiquidity,
  type LiquidityPoolSnapshot,
} from "@/services/tinymanLiquidityService";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";

export type PoolLiquidityMode = "deposit" | "withdraw";

interface PoolLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PoolLiquidityMode;
  pair: LiquidityPoolPairConfig;
  snapshot: LiquidityPoolSnapshot | null;
  onSuccess?: () => void;
  /** Human-unit LP supplied in the platform lending market; shown only when &gt; 0. */
  suppliedLpBalance?: number;
}

const PoolLiquidityModal = ({
  isOpen,
  onClose,
  mode,
  pair,
  snapshot,
  onSuccess,
  suppliedLpBalance = 0,
}: PoolLiquidityModalProps) => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { toast } = useToast();
  const [tab, setTab] = useState<PoolLiquidityMode>(mode);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(mode);
      setAmount("");
      setRainbowkitSignDialogSuppressed(false);
    }
  }, [isOpen, mode]);

  const label =
    pair.label ??
    (snapshot
      ? `${snapshot.asset1.symbol} / ${snapshot.asset2.symbol}`
      : "Liquidity pool");

  const lpAssetId = snapshot?.poolTokenId ?? pair.lpTokenId;

  const { data: lpTokenBalance, isLoading: lpBalanceLoading } = useAlgorandAssetBalance(
    pair.networkId,
    activeAccount?.address,
    lpAssetId,
    isOpen
  );

  const { data: nt200LpBalance, isLoading: nt200BalanceLoading } =
    useNt200Arc200Balance(
      pair.networkId,
      pair.lpContractId,
      activeAccount?.address,
      isOpen
    );

  const lpBalanceHuman = formatLiquidityAtomic(lpTokenBalance ?? 0n, 6);
  const nt200LpBalanceHuman = formatLiquidityAtomic(nt200LpBalance ?? 0n, 6);
  const hasLpBalance = Boolean(lpTokenBalance && lpTokenBalance > 0n);
  const hasNt200Balance = Boolean(nt200LpBalance && nt200LpBalance > 0n);
  const canDeposit = hasLpBalance;
  const canWithdraw = hasNt200Balance || hasLpBalance;
  const balancesLoading = lpBalanceLoading || nt200BalanceLoading;

  const withdrawUsesNt200 = tab === "withdraw" && hasNt200Balance;

  const withdrawQuote = useMemo(() => {
    if (!snapshot || tab !== "withdraw" || withdrawUsesNt200) return null;
    return quoteRemoveLiquidity(snapshot, amount);
  }, [snapshot, tab, amount, withdrawUsesNt200]);

  const handleMaxAmount = () => {
    if (tab === "deposit") {
      if (lpTokenBalance && lpTokenBalance > 0n) {
        setAmount(lpBalanceHuman);
      }
      return;
    }
    if (nt200LpBalance && nt200LpBalance > 0n) {
      setAmount(nt200LpBalanceHuman);
    } else if (lpTokenBalance && lpTokenBalance > 0n) {
      setAmount(lpBalanceHuman);
    }
  };

  const showAmountInput =
    tab === "deposit" ? canDeposit : canWithdraw;

  const handleSubmit = useCallback(async () => {
    if (!activeAccount?.address || !signTransactions || !snapshot) {
      toast({
        title: "Connect wallet",
        description: "Connect an Algorand wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
    if (!algodNetwork) {
      toast({
        title: "Unsupported network",
        description: "Switch to Algorand mainnet to use liquidity pools.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: tab === "deposit" ? "Sign deposit" : "Sign withdrawal",
        description: `Approve the transaction in ${walletName}.`,
        duration: 12_000,
      });

      let signed: Uint8Array[];
      if (tab === "deposit") {
        const txnsB64 = await buildNt200LpDepositTransactions({
          pair,
          userAddress: activeAccount.address,
          poolTokenAmountHuman: amount,
        });
        const unsigned = txnsB64.map((txn) =>
          Uint8Array.from(Buffer.from(txn, "base64"))
        );
        signed = await withRainbowkitHostDialogDismissed({
          wallet: activeWallet,
          setSuppressed: setRainbowkitSignDialogSuppressed,
          leaveOverlayDismissedOnSuccess: true,
          run: () => signTransactions(unsigned),
        });
      } else if (hasNt200Balance) {
        const txnsB64 = await buildNt200LpWithdrawTransactions({
          pair,
          userAddress: activeAccount.address,
          poolTokenAmountHuman: amount,
        });
        const unsigned = txnsB64.map((txn) =>
          Uint8Array.from(Buffer.from(txn, "base64"))
        );
        signed = await withRainbowkitHostDialogDismissed({
          wallet: activeWallet,
          setSuppressed: setRainbowkitSignDialogSuppressed,
          leaveOverlayDismissedOnSuccess: true,
          run: () => signTransactions(unsigned),
        });
      } else {
        const txGroup = await buildRemoveLiquidityTransactions({
          pair,
          userAddress: activeAccount.address,
          poolTokenAmountHuman: amount,
        });
        const unsigned = encodeSignerTxnsForWallet(txGroup);
        signed = await withRainbowkitHostDialogDismissed({
          wallet: activeWallet,
          setSuppressed: setRainbowkitSignDialogSuppressed,
          leaveOverlayDismissedOnSuccess: true,
          run: () => signTransactions(unsigned),
        });
      }

      const { algod } = await algorandService.initializeClientsForTransactions(
        algodNetwork
      );
      const res = await algod.sendRawTransaction(signed).do();
      await waitForConfirmation(algod, res.txid, 4);

      toast({
        title: tab === "deposit" ? "LP deposited" : "Liquidity withdrawn",
        description: `Transaction ${res.txid.slice(0, 10)}… confirmed.`,
      });
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      toast({
        title: "Transaction failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [
    tab,
    activeAccount?.address,
    signTransactions,
    snapshot,
    pair,
    amount,
    activeWallet,
    hasNt200Balance,
    toast,
    onSuccess,
    onClose,
  ]);

  const lpBalanceSection = (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1.5">
      <div>
        <p className="text-muted-foreground">Wallet LP balance</p>
        <p className="font-medium tabular-nums">
          {balancesLoading ? "…" : lpBalanceHuman}
        </p>
      </div>
      {suppliedLpBalance > 0 ? (
        <div>
          <p className="text-muted-foreground">In platform</p>
          <p className="font-medium tabular-nums">
            {suppliedLpBalance.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}
          </p>
        </div>
      ) : null}
    </div>
  );

  const lpAmountInput = showAmountInput ? (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="pool-lp-amount">LP amount</Label>
        <button
          type="button"
          className="text-xs font-medium text-ocean-teal hover:underline disabled:opacity-50"
          onClick={handleMaxAmount}
        >
          Max
        </button>
      </div>
      <Input
        id="pool-lp-amount"
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </div>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-w-md flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {tab === "deposit"
              ? "Deposit LP tokens into the platform market for this pool."
              : hasNt200Balance
                ? "Withdraw LP from the platform back to your wallet."
                : "Burn wallet LP tokens to withdraw your share of both pool assets."}
          </DialogDescription>
        </DialogHeader>

        {!snapshot ? (
          <p className="text-sm text-muted-foreground">Pool data is not available.</p>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as PoolLiquidityMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw" disabled={!canWithdraw}>
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="space-y-4 pt-2">
              {lpBalanceSection}
              {lpAmountInput}
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-4 pt-2">
              {lpBalanceSection}
              {lpAmountInput}
              {withdrawQuote ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <p>
                    {snapshot.asset1.symbol}:{" "}
                    <span className="font-medium tabular-nums">
                      {formatLiquidityAtomic(
                        withdrawQuote.asset1Out.amount,
                        snapshot.asset1.decimals
                      )}
                    </span>
                  </p>
                  <p>
                    {snapshot.asset2.symbol}:{" "}
                    <span className="font-medium tabular-nums">
                      {formatLiquidityAtomic(
                        withdrawQuote.asset2Out.amount,
                        snapshot.asset2.decimals
                      )}
                    </span>
                  </p>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        )}

        <Button
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90"
          disabled={
            busy ||
            !snapshot ||
            !amount.trim() ||
            !activeAccount?.address ||
            (tab === "deposit" ? !canDeposit : !canWithdraw)
          }
          onClick={() => void handleSubmit()}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Processing…
            </span>
          ) : tab === "deposit" ? (
            "Deposit liquidity"
          ) : (
            "Withdraw liquidity"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PoolLiquidityModal;
