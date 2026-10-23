import { useCallback, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { NetworkId } from "@/config";
import {
  DORK_NFT_ALGORAND_RESERVE_ADDRESS,
  DORK_NFT_BRIDGE_ADDRESS,
  type NftBridgeIntentItem,
} from "@/config/nftBridge";
import {
  buildBridgeReleaseSigningBundle,
  fetchPendingBridgeIntents,
  type ParsedBridgeIntent,
} from "@/services/nftBridgeService";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import { createSigningBatchesFromEncoded } from "@/lib/algorand/grouping";
import { signAllEncodedBatches } from "@/lib/algorand/signing";
import { submitSignedGroups } from "@/lib/algorand/submission";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";

const SCAN_NETWORKS: NetworkId[] = ["voi-mainnet", "algorand-mainnet"];

function releaseNetworkForIntent(intent: ParsedBridgeIntent): NetworkId {
  return intent.dir === "voi-to-algorand" ? "algorand-mainnet" : "voi-mainnet";
}

function operatorHint(intent: ParsedBridgeIntent): string {
  return intent.dir === "voi-to-algorand"
    ? `Connect DORKHJ (${DORK_NFT_ALGORAND_RESERVE_ADDRESS.slice(0, 10)}…) on Algorand`
    : `Connect DEVOUR on Voi`;
}

export function NftBridgeAdminTool() {
  const { activeAccount, signTransactions } = useWallet();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [releasingKey, setReleasingKey] = useState<string | null>(null);
  const [intents, setIntents] = useState<ParsedBridgeIntent[]>([]);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const batches = await Promise.all(
        SCAN_NETWORKS.map((networkId) => fetchPendingBridgeIntents(networkId, 40))
      );
      const merged = batches
        .flat()
        .sort((a, b) => b.round - a.round);
      setIntents(merged);
      toast({
        title: "Bridge queue refreshed",
        description: `${merged.length} registration note(s) found on DEVOUR.`,
      });
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Could not load bridge intents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const releaseItem = async (intent: ParsedBridgeIntent, item: NftBridgeIntentItem) => {
    if (!signTransactions || !activeAccount?.address) {
      toast({
        title: "Wallet required",
        description: "Connect the operator wallet to release bridged NFTs.",
        variant: "destructive",
      });
      return;
    }
    const key = `${intent.txId}-${item.sourceId}`;
    setReleasingKey(key);
    try {
      const releaseNetwork = releaseNetworkForIntent(intent);
      const preparedGroups = await buildBridgeReleaseSigningBundle({
        networkId: releaseNetwork,
        operatorAddress: activeAccount.address,
        intent,
        item,
      });
      const signingBatches = createSigningBatchesFromEncoded(preparedGroups);
      const { signedGroups } = await signAllEncodedBatches(signingBatches, signTransactions);
      const algoNet = getAlgorandNetworkFromNetworkId(releaseNetwork);
      if (!algoNet) throw new Error("Unsupported network.");
      const { algod } = await algorandService.initializeClientsForReads(algoNet);
      await submitSignedGroups({ algod, signedGroups });
      toast({
        title: "Release submitted",
        description: `Sent ${item.name} to ${intent.receiver.slice(0, 10)}…`,
      });
    } catch (err) {
      const feedback = getTransactionErrorFeedback(err);
      toast({
        title: feedback.userRejected ? "Transaction cancelled" : "Release failed",
        description: feedback.message,
        variant: "destructive",
      });
    } finally {
      setReleasingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={loading} onClick={() => void scan()}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning DEVOUR…
            </>
          ) : (
            "Scan bridge registrations"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Voi → Algorand releases use DORKHJ on Algorand; Algorand → Voi releases use DEVOUR on Voi.
        </p>
      </div>

      {intents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No registrations loaded yet. Scan DEVOUR for payment notes tagged{" "}
          <code className="text-xs">dorkfi-bridge:v1:</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {intents.map((intent) =>
            intent.items.map((item) => {
              const rowKey = `${intent.txId}-${item.sourceId}`;
              return (
                <li
                  key={rowKey}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground">
                    {intent.dir} · receiver{" "}
                    <span className="font-mono text-xs">{intent.receiver}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tx {intent.txId.slice(0, 12)}… · round {intent.round}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={releasingKey === rowKey}
                      onClick={() => void releaseItem(intent, item)}
                    >
                      {releasingKey === rowKey ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Releasing…
                        </>
                      ) : (
                        "Release to receiver"
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">{operatorHint(intent)}</span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
