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
import { bridgeRegistrationCurrencyLabel } from "@/config/nftBridge";
import {
  bridgeDirectionForNetwork,
  destinationNetworkLabel,
  enrichNftsForBridge,
  buildNftBridgeSigningBundle,
  type BridgeableNft,
} from "@/services/nftBridgeService";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import { signAllEncodedBatches } from "@/lib/algorand/signing";
import { createSigningBatchesFromEncoded } from "@/lib/algorand/grouping";
import { submitSignedGroups } from "@/lib/algorand/submission";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import algosdk from "algosdk";

type Step = "select" | "destination" | "confirm" | "success";

function nftKey(nft: BridgeableNft): string {
  return `${nft.contractId}-${nft.tokenId}`;
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
  const [destAssets, setDestAssets] = useState<{ name: string; assetId: string }[]>([]);

  const direction = bridgeDirectionForNetwork(currentNetwork as NetworkId);
  const destNetwork = destinationNetworkLabel(direction);
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
    }
  }, [open]);

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
    if (!signTransactions) {
      toast({
        title: "Wallet required",
        description: "Connect a wallet to sign bridge transactions.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const bundle = await buildNftBridgeSigningBundle({
        networkId: currentNetwork as NetworkId,
        sender: ownerAddress,
        receiver: receiverAddress,
        selected: selectedNfts,
      });

      const signingBatches = createSigningBatchesFromEncoded(bundle.preparedGroups);
      const { signedGroups } = await signAllEncodedBatches(
        signingBatches,
        signTransactions
      );

      const algoNet = getAlgorandNetworkFromNetworkId(currentNetwork as NetworkId);
      if (!algoNet) throw new Error("Unsupported network.");
      const { algod } = await algorandService.initializeClientsForReads(algoNet);

      await submitSignedGroups({ algod, signedGroups });

      setDestAssets(bundle.destAssetsForReceiver);
      setStep("success");
      toast({
        title: "Bridge submitted",
        description: "Your NFTs were sent to DEVOUR. Our team will complete the bridge.",
      });
    } catch (err) {
      const feedback = getTransactionErrorFeedback(err);
      toast({
        title: feedback.userRejected ? "Transaction cancelled" : "Bridge failed",
        description: feedback.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bridge Dork NFTs</DialogTitle>
          <DialogDescription>
            {step === "success"
              ? "Submitted to DEVOUR — opt in on the destination chain when you receive asset numbers."
              : `Send from ${currentNetwork === "voi-mainnet" ? "Voi" : "Algorand"} and receive on ${destNetwork}.`}
          </DialogDescription>
        </DialogHeader>

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
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
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
            <p className="text-sm text-muted-foreground">
              Where should we send {selectedNfts.length} NFT
              {selectedNfts.length === 1 ? "" : "s"} on {destNetwork}?
            </p>
            <RadioGroup
              value={receiveMode}
              onValueChange={(v) => setReceiveMode(v as "same" | "different")}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="same" id="bridge-same-wallet" />
                <Label htmlFor="bridge-same-wallet">Same wallet ({ownerAddress.slice(0, 8)}…)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="different" id="bridge-diff-wallet" />
                <Label htmlFor="bridge-diff-wallet">Different {destNetwork} wallet</Label>
              </div>
            </RadioGroup>
            {receiveMode === "different" && (
              <div className="space-y-2">
                <Label htmlFor="bridge-receiver">Destination address</Label>
                <Input
                  id="bridge-receiver"
                  value={customReceiver}
                  onChange={(e) => setCustomReceiver(e.target.value)}
                  placeholder={`${destNetwork} address`}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3 text-sm">
            <p>
              You will sign{" "}
              <strong>{selectedNfts.length}</strong> transfer
              {selectedNfts.length === 1 ? "" : "s"} to DEVOUR, each grouped with a{" "}
              <strong>0 {registrationCurrency}</strong> payment to DEVOUR that carries registration
              data for the team (network fees still apply in {registrationCurrency}).
            </p>
            <ul className="max-h-40 list-inside list-disc overflow-y-auto text-muted-foreground">
              {selectedNfts.map((nft) => (
                <li key={nftKey(nft)}>
                  {nft.name} → {nft.destAssetLabel} on {destNetwork}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Receiver on {destNetwork}:{" "}
              <span className="break-all font-mono text-xs">{receiverAddress}</span>
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-3 text-sm">
            <p>
              Your NFTs are on their way to DEVOUR. The team checks bridge logs periodically — it
              can take a while, especially if the receiver wallet differs from the sender.
            </p>
            {direction === "voi-to-algorand" && destAssets.length > 0 && (
              <div>
                <p className="mb-2 font-medium">Opt in on Algorand when ready:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {destAssets.map((row) => (
                    <li key={row.assetId}>
                      {row.name}: ASA <span className="font-mono">{row.assetId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {direction === "algorand-to-voi" && destAssets.length > 0 && (
              <div>
                <p className="mb-2 font-medium">Matching Voi NFTs:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {destAssets.map((row) => (
                    <li key={row.assetId}>
                      {row.name}: <span className="font-mono">{row.assetId}</span>
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
              </a>{" "}
              so we know to release from DEVOUR / DORKHJ.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "select" && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinueFromSelect}>
                Continue ({selectedKeys.size})
              </Button>
            </>
          )}
          {step === "destination" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button type="button" onClick={handleContinueFromDestination}>
                Continue
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("destination")}>
                Back
              </Button>
              <Button type="button" disabled={isSubmitting} onClick={() => void handleSignAndSend()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing…
                  </>
                ) : (
                  "Sign & send to DEVOUR"
                )}
              </Button>
            </>
          )}
          {step === "success" && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
