import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { DORK_NFT_BRIDGE_ADDRESS } from "@/config/nftBridge";
import { useToast } from "@/hooks/use-toast";
import { fetchUserNFTs } from "@/services/nftService";

/** Dorks v1, Lil Chubs, Dorks v2 on VOI. */
const VOI_DORK_CONTRACTS = [313597, 313705, 894888];

export default function PortfolioNftBridgeNotice({
  address,
}: {
  address?: string | null;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const holdings = useQuery({
    queryKey: ["voi-dork-nft-holdings", address],
    enabled: Boolean(address),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetchUserNFTs(address!, VOI_DORK_CONTRACTS, 100);
      return response.tokens.some(
        (token) =>
          !token.isBurned &&
          token.owner === address &&
          VOI_DORK_CONTRACTS.includes(token.contractId)
      );
    },
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

  return (
    <DorkFiCard className="p-4 md:p-5">
      <div className="flex items-end gap-3 sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Send your VOI NFTs to be DEVOURED, and receive weekly airdrops of
            UNIT.
          </p>
          <p className="text-sm text-muted-foreground">
            When the bridge sends you the asset number, opt in to that asset on
            Algorand. Expect a delay if the receiver wallet is different from
            the sender.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://nftnavigator.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-teal hover:bg-ocean-teal/10"
            >
              Bridge on VOI
            </a>
            <DorkFiButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyWallet()}
            >
              <Copy className="mr-1.5 h-3 w-3" />
              {copied ? "Copied" : "Copy wallet"}
            </DorkFiButton>
          </div>
        </div>
        <img
          src="/devour-chub.png"
          alt=""
          className="w-2/5 shrink-0 object-contain sm:h-32 sm:w-auto"
        />
      </div>
    </DorkFiCard>
  );
}
