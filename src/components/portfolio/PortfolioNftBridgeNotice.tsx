import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { DORK_NFT_BRIDGE_ADDRESS } from "@/config/nftBridge";
import type { NetworkId } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { fetchUserNFTs } from "@/services/nftService";
import { fetchOwnedDorkNftsOnAlgorand } from "@/services/algorandNftService";
import NftBridgeModal from "@/components/portfolio/NftBridgeModal";

/** Dorks v1, Lil Chubs, Dorks v2 on VOI. */
const VOI_DORK_CONTRACTS = [313597, 313705, 894888];

async function walletHasBridgeableDorks(
  networkId: NetworkId,
  address: string
): Promise<boolean> {
  if (networkId === "algorand-mainnet") {
    const owned = await fetchOwnedDorkNftsOnAlgorand(networkId, address);
    return owned.length > 0;
  }
  if (networkId === "voi-mainnet") {
    const response = await fetchUserNFTs(address, VOI_DORK_CONTRACTS, 100);
    return response.tokens.some(
      (token) =>
        !token.isBurned &&
        token.owner === address &&
        VOI_DORK_CONTRACTS.includes(token.contractId)
    );
  }
  return false;
}

export default function PortfolioNftBridgeNotice({
  address,
  networkId,
  canBridge,
}: {
  address?: string | null;
  networkId: NetworkId;
  /** Connected wallet matches the portfolio address (not view-only). */
  canBridge: boolean;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const holdings = useQuery({
    queryKey: ["dork-nft-bridge-holdings", networkId, address],
    enabled: Boolean(address) && (networkId === "voi-mainnet" || networkId === "algorand-mainnet"),
    staleTime: 60_000,
    queryFn: () => walletHasBridgeableDorks(networkId, address!),
  });

  if (!holdings.data) return null;

  const markCopied = () => {
    setCopied(true);
    toast({
      title: "Wallet copied",
      description: "DEVOUR address copied.",
    });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyWallet = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await Promise.race([
          navigator.clipboard.writeText(DORK_NFT_BRIDGE_ADDRESS),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("clipboard timeout")), 700);
          }),
        ]);
        markCopied();
        return;
      }
    } catch {
      // Fall through to the selection copy below.
    }
    try {
      const field = document.createElement("textarea");
      field.value = DORK_NFT_BRIDGE_ADDRESS;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      if (!ok) throw new Error("copy failed");
      markCopied();
    } catch {
      toast({
        title: "Copy failed",
        description: DORK_NFT_BRIDGE_ADDRESS,
        variant: "destructive",
      });
    }
  };

  const bridgeLabel =
    networkId === "voi-mainnet" ? "Bridge NFTs to Algorand" : "Bridge NFTs to Voi";

  return (
    <>
      <DorkFiCard className="p-4 md:p-5">
        <div className="flex items-end gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Bridge your Dork NFTs through DEVOUR and receive the matching NFT on the other
              chain, plus weekly UNIT airdrops on Algorand.
            </p>
            <p className="text-sm text-muted-foreground">
              When we send you an Algorand asset number, opt in to that ASA. Expect a delay if
              the receiver wallet is different from the sender — the team releases manually from
              DEVOUR and DORKHJ.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <DorkFiButton
                type="button"
                size="sm"
                disabled={!canBridge || !address}
                onClick={() => setModalOpen(true)}
              >
                {bridgeLabel}
              </DorkFiButton>
              <DorkFiButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void copyWallet()}
              >
                <Copy className="mr-1.5 h-3 w-3" />
                {copied ? "Copied" : "Copy DEVOUR"}
              </DorkFiButton>
            </div>
            {!canBridge && (
              <p className="text-xs text-muted-foreground">
                Connect this wallet to sign bridge transactions (view-only addresses cannot bridge).
              </p>
            )}
          </div>
          <img
            src="/devour-chub.png"
            alt=""
            className="w-2/5 shrink-0 object-contain sm:h-32 sm:w-auto"
          />
        </div>
      </DorkFiCard>
      {address && canBridge && (
        <NftBridgeModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          ownerAddress={address}
        />
      )}
    </>
  );
}
