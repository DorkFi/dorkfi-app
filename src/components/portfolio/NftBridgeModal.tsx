import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/contexts/NetworkContext";
import type { NetworkId } from "@/config";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import { filterUserNfts } from "@/components/liquidation/filterUserNfts";
import {
  bridgeCustodyLabel,
  bridgeRegistrationCurrencyLabel,
  isNftBridgeDryRun,
} from "@/config/nftBridge";
import {
  bridgeDirectionForNetwork,
  destinationNetworkLabel,
  enrichNftsForBridge,
  buildNftBridgeSigningBundle,
  bridgeSubmitOutcomeError,
  formatBridgeFeeCurrencyError,
  type BridgeableNft,
} from "@/services/nftBridgeService";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import { signAllEncodedBatches } from "@/lib/algorand/signing";
import { createSigningBatchesFromEncoded } from "@/lib/algorand/grouping";
import { submitSignedGroups } from "@/lib/algorand/submission";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import algosdk from "algosdk";
import { cn } from "@/lib/utils";

type Step = "select" | "destination" | "confirm" | "success";

function nftKey(nft: BridgeableNft): string {
  return `${nft.contractId}-${nft.tokenId}`;
}

/** Compact multi-NFT lists on confirm / success (fill columns before growing height). */
const bridgeSummaryListGrid =
  "grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4";

function BridgeDryRunBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-900 dark:text-amber-200",
        className
      )}
      role="status"
    >
      <p className="font-semibold uppercase tracking-wide">Dry-run mode — not live</p>
      <p className="mt-1 text-justify">
        Sign &amp; send only builds transactions. Nothing is signed or broadcast on-chain. For real
        ALGO ↔ VOI tests, set{" "}
        <code className="rounded bg-background/80 px-1 py-0.5">VITE_NFT_BRIDGE_DRY_RUN=false</code>{" "}
        in <code className="rounded bg-background/80 px-1 py-0.5">.env.local</code> and restart{" "}
        <code className="rounded bg-background/80 px-1 py-0.5">npm run dev</code> (or use a
        production/preview build).
      </p>
    </div>
  );
}

export default function NftBridgeModal({
  open,
  onOpenChange,
  ownerAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerAddress: string;
}) {
  const { signTransactions } = useWallet();
  const { currentNetwork } = useNetwork();
  const { toast } = useToast();
  const { nfts, isLoading, error, refetch } = useUserNFTs(ownerAddress);

  const [step, setStep] = useState<Step>("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [receiveMode, setReceiveMode] = useState<"same" | "different">("same");
  const [customReceiver, setCustomReceiver] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [destAssets, setDestAssets] = useState<
    { receiveLine: string; lineKey: string }[]
  >([]);

  const direction = bridgeDirectionForNetwork(currentNetwork as NetworkId);
  const destNetwork = destinationNetworkLabel(direction);
  const sourceNetwork = currentNetwork === "voi-mainnet" ? "Voi" : "Algorand";
  const custodyLabel = bridgeCustodyLabel(direction);
  const bridgeDryRun = isNftBridgeDryRun();
  const registrationCurrency =
    currentNetwork === "voi-mainnet" || currentNetwork === "algorand-mainnet"
      ? bridgeRegistrationCurrencyLabel(currentNetwork)
      : "ALGO";

  const bridgeable = useMemo(
    () => enrichNftsForBridge(nfts ?? [], direction),
    [nfts, direction]
  );

  const filtered = useMemo(
    () => filterUserNfts(bridgeable, searchQuery),
    [bridgeable, searchQuery]
  );

  const selectedNfts = useMemo(
    () => bridgeable.filter((n) => selectedKeys.has(nftKey(n))),
    [bridgeable, selectedKeys]
  );

  const receiverAddress =
    receiveMode === "same" ? ownerAddress.trim() : customReceiver.trim();

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSearchQuery("");
      setSelectedKeys(new Set());
      setReceiveMode("same");
      setCustomReceiver("");
      setDestAssets([]);
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [open]);

  const handleReceiveModeChange = (mode: "same" | "different") => {
    setReceiveMode(mode);
    if (mode === "different") {
      setCustomReceiver("");
    }
  };

  const toggleNft = (nft: BridgeableNft, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const key = nftKey(nft);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleContinueFromSelect = () => {
    if (selectedNfts.length === 0) {
      toast({
        title: "Select NFTs",
        description: "Choose at least one NFT to bridge.",
        variant: "destructive",
      });
      return;
    }
    setStep("destination");
  };

  const handleContinueFromDestination = () => {
    if (!algosdk.isValidAddress(receiverAddress)) {
      toast({
        title: "Invalid address",
        description: `Enter a valid ${destNetwork} wallet address.`,
        variant: "destructive",
      });
      return;
    }
    setStep("confirm");
  };

  const handleSignAndSend = async () => {
    if (!bridgeDryRun && !signTransactions) {
      toast({
        title: "Wallet required",
        description: "Connect a wallet to sign bridge transactions.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const bundle = await buildNftBridgeSigningBundle({
        networkId: currentNetwork as NetworkId,
        sender: ownerAddress,
        receiver: receiverAddress,
        selected: selectedNfts,
      });

      if (!bridgeDryRun) {
        const signingBatches = createSigningBatchesFromEncoded(bundle.preparedGroups);
        const { signedGroups } = await signAllEncodedBatches(
          signingBatches,
          signTransactions!
        );

        const algoNet = getAlgorandNetworkFromNetworkId(currentNetwork as NetworkId);
        if (!algoNet) throw new Error("Unsupported network.");
        const { algod } = await algorandService.initializeClientsForReads(algoNet);

        let firstGroupError: string | undefined;
        const submitResult = await submitSignedGroups({
          algod,
          signedGroups,
          onGroupSubmitted: (result) => {
            if (result.error && firstGroupError === undefined) {
              firstGroupError = result.error;
            }
          },
        });

        const submitErr = bridgeSubmitOutcomeError({
          failedGroupIndices: submitResult.failedGroups,
          successfulTxIds: submitResult.successfulTxIds,
          totalGroups: signedGroups.length,
          firstGroupError,
          feeCurrency: registrationCurrency,
          custodyLabel,
        });
        if (submitErr) {
          throw new Error(submitErr);
        }
      }

      setDestAssets(bundle.destAssetsForReceiver);
      setStep("success");
      toast({
        title: bridgeDryRun ? "Dry run complete" : "Bridge submitted",
        description: bridgeDryRun
          ? "Transactions were built but not signed or submitted."
          : `Your NFTs were sent to ${custodyLabel}. Our team will complete the bridge.`,
      });
    } catch (err) {
      const feedback = getTransactionErrorFeedback(err);
      const description = formatBridgeFeeCurrencyError(
        feedback.message,
        registrationCurrency
      );
      setSubmitError(description);
      toast({
        title: feedback.userRejected ? "Transaction cancelled" : "Bridge failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <>
      {step === "select" && (
        <>
          <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="min-h-11 flex-1 sm:flex-none" onClick={handleContinueFromSelect}>
            Continue ({selectedKeys.size})
          </Button>
        </>
      )}
      {step === "destination" && (
        <>
          <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setStep("select")}>
            Back
          </Button>
          <Button type="button" className="min-h-11 flex-1 sm:flex-none" onClick={handleContinueFromDestination}>
            Continue
          </Button>
        </>
      )}
      {step === "confirm" && (
        <>
          <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setStep("destination")}>
            Back
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={isSubmitting}
            onClick={() => void handleSignAndSend()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing…
              </>
            ) : bridgeDryRun ? (
              `Dry-run build (${custodyLabel})`
            ) : (
              `Sign & send to ${custodyLabel}`
            )}
          </Button>
        </>
      )}
      {step === "success" && (
        <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90vh,640px)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
          (step === "confirm" || step === "success") && "sm:max-w-lg"
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 px-5 pb-2 pt-5 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="text-center sm:text-left">Bridge Dork NFTs</DialogTitle>
          <DialogDescription className="text-center sm:text-left">
            {bridgeDryRun
              ? step === "success"
                ? "Dry-run only — no transactions were signed or sent."
                : "Dry-run: preview the flow; on-chain send is disabled."
              : step === "success"
                ? direction === "voi-to-algorand"
                  ? `Submitted to ${custodyLabel}. Opt in on Algorand when we send your ASA numbers.`
                  : `Submitted to ${custodyLabel}. We will release your NFTs on Voi when we process the bridge.`
                : `Send from ${sourceNetwork} and receive on ${destNetwork}.`}
          </DialogDescription>
        </DialogHeader>

        {bridgeDryRun && (
          <BridgeDryRunBanner className="mx-5 mb-1 shrink-0 sm:mx-6" />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          {step === "select" && (
            <div className="space-y-3">
              <Input
                placeholder="Search by name or token id"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading NFTs…
                </div>
              )}
              {error && (
                <p className="text-sm text-destructive">
                  {error}{" "}
                  <button type="button" className="underline" onClick={() => void refetch()}>
                    Retry
                  </button>
                </p>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No bridgeable Dork NFTs in this wallet.</p>
              )}
              <div className="grid max-h-64 grid-cols-2 gap-2 sm:grid-cols-3">
                {filtered.map((nft) => {
                  const key = nftKey(nft);
                  const checked = selectedKeys.has(key);
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer flex-col rounded-lg border p-2 transition-colors ${
                        checked ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleNft(nft, v === true)}
                        />
                        <span className="line-clamp-2 text-xs font-medium">{nft.name}</span>
                      </div>
                      <div className="aspect-square overflow-hidden rounded-md bg-muted">
                        {nft.imageUrl ? (
                          <img
                            src={nft.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {step === "destination" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Receive{" "}
                <span className="text-foreground">
                  {selectedNfts.length} NFT{selectedNfts.length === 1 ? "" : "s"}
                </span>{" "}
                on {destNetwork}.
              </p>
              {direction === "algorand-to-voi" && (
                <p className="text-justify text-sm leading-snug text-muted-foreground">
                  ASAs go to DORKHJ on Algorand. Your matching Voi NFT is released from DEVOUR
                  when we process the bridge.
                </p>
              )}
              <RadioGroup
                value={receiveMode}
                onValueChange={(v) => handleReceiveModeChange(v as "same" | "different")}
                className="gap-3"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="same" id="bridge-same-wallet" />
                  <Label htmlFor="bridge-same-wallet" className="cursor-pointer font-normal">
                    Same wallet
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="different" id="bridge-diff-wallet" />
                  <Label htmlFor="bridge-diff-wallet" className="cursor-pointer font-normal">
                    Different {destNetwork} wallet
                  </Label>
                </div>
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="bridge-receiver">Destination address</Label>
                <Input
                  id="bridge-receiver"
                  value={receiveMode === "same" ? ownerAddress : customReceiver}
                  readOnly={receiveMode === "same"}
                  disabled={receiveMode === "same"}
                  onChange={(e) => setCustomReceiver(e.target.value)}
                  placeholder={
                    receiveMode === "different" ? `Paste ${destNetwork} address` : undefined
                  }
                  autoComplete="off"
                  className={cn(
                    "font-mono text-xs sm:text-sm",
                    receiveMode === "same" && "text-muted-foreground"
                  )}
                />
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4 text-sm leading-relaxed">
              {submitError && (
                <p
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {submitError}
                </p>
              )}
              <p className="text-muted-foreground">
                Sign{" "}
                <span className="font-medium text-foreground">{selectedNfts.length}</span>{" "}
                transfer{selectedNfts.length === 1 ? "" : "s"} to {custodyLabel}.
                {direction === "voi-to-algorand" ? (
                  <>
                    {" "}
                    Each includes a{" "}
                    <span className="font-medium text-foreground">
                      0 {registrationCurrency}
                    </span>{" "}
                    registration payment (fees still apply in {registrationCurrency}).
                  </>
                ) : (
                  <>
                    {" "}
                    Registration data is attached to each ASA transfer (fees apply in ALGO).
                  </>
                )}
              </p>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Shipping out
                </p>
                <ul className={bridgeSummaryListGrid}>
                  {selectedNfts.map((nft) => (
                    <li key={nftKey(nft)} className="text-sm leading-snug">
                      {nft.name}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bridge-confirm-receiver">Destination address</Label>
                <Input
                  id="bridge-confirm-receiver"
                  value={receiverAddress}
                  readOnly
                  disabled
                  className="font-mono text-xs text-muted-foreground sm:text-sm"
                />
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-sm leading-relaxed">
              <p className="text-muted-foreground">
                {bridgeDryRun ? (
                  <>
                    This was a dry run. Your NFTs were <span className="font-medium text-foreground">not</span>{" "}
                    sent to {custodyLabel}. Turn off dry-run (see banner above) before mainnet testing.
                  </>
                ) : (
                  <>
                    Your NFTs are on their way to {custodyLabel}. The team checks bridge logs periodically — it
                    can take a while, especially if the receiver wallet differs from the sender.
                  </>
                )}
              </p>
              {destAssets.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {direction === "voi-to-algorand"
                      ? "Receive on Algorand (opt in to ASA)"
                      : `Receive on ${destNetwork}`}
                  </p>
                  <ul className={bridgeSummaryListGrid}>
                    {destAssets.map((row) => (
                      <li key={row.lineKey} className="text-xs leading-snug sm:text-sm">
                        {row.receiveLine}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-muted-foreground">
                Waiting on a transfer? Reach out on{" "}
                <a
                  href="https://discord.gg/dorkfi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-teal underline"
                >
                  Discord
                </a>{" "}
                or{" "}
                <a
                  href="https://x.com/DorkFi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-teal underline"
                >
                  X
                </a>
                .
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-auto shrink-0 gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
