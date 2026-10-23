import { useCallback, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { NetworkId } from "@/config";
import { NFT_BRIDGE_NOTE_PREFIX } from "@/config/nftBridge";
import {
  fetchPendingBridgeIntents,
  type ParsedBridgeIntent,
} from "@/services/nftBridgeService";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";

const SCAN_NETWORKS: NetworkId[] = ["voi-mainnet", "algorand-mainnet"];

type LogRow = ParsedBridgeIntent & {
  itemKey: string;
  itemName: string;
  itemSourceId: string;
  itemDestAssetId: string;
};

function flattenIntents(intents: ParsedBridgeIntent[]): LogRow[] {
  const rows: LogRow[] = [];
  for (const intent of intents) {
    for (const item of intent.items) {
      rows.push({
        ...intent,
        itemKey: `${intent.txId}-${item.sourceId}`,
        itemName: item.name,
        itemSourceId: item.sourceId,
        itemDestAssetId: item.destAssetId,
      });
    }
  }
  return rows.sort((a, b) => b.round - a.round);
}

export function NftBridgeAdminTool() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const batches = await Promise.all(
        SCAN_NETWORKS.map((networkId) => fetchPendingBridgeIntents(networkId, 50))
      );
      const merged = flattenIntents(batches.flat());
      setRows(merged);
      toast({
        title: "Bridge log refreshed",
        description: `${merged.length} registration(s) on DEVOUR (read-only).`,
      });
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Could not load bridge log.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={loading} onClick={() => void scan()}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading log…
            </>
          ) : (
            "Refresh bridge log"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Read-only view of{" "}
          <code className="text-xs">{NFT_BRIDGE_NOTE_PREFIX}</code> notes on DEVOUR. Release is
          handled from the engagement dashboard on your machine (DEVOUR / DORKHJ keys stay local).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No registrations loaded. Refresh to pull recent bridge intents from Voi and Algorand
          indexers.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Registered on</th>
                <th className="px-3 py-2 font-medium">NFT</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Sender</th>
                <th className="px-3 py-2 font-medium">Receiver</th>
                <th className="px-3 py-2 font-medium">Assets</th>
                <th className="px-3 py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.itemKey} className="border-b last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div>{row.sourceNetworkId}</div>
                    <div className="text-xs text-muted-foreground">round {row.round}</div>
                  </td>
                  <td className="px-3 py-2 align-top font-medium">{row.itemName}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{row.dir}</td>
                  <td className="max-w-[120px] truncate px-3 py-2 align-top font-mono text-xs">
                    {row.sender}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 align-top font-mono text-xs">
                    {row.receiver}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    <div>
                      src{" "}
                      <span className="font-mono text-foreground">{row.itemSourceId}</span>
                    </div>
                    <div>
                      dest{" "}
                      <span className="font-mono text-foreground">{row.itemDestAssetId}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.txId ? (
                      <a
                        href={getExplorerTransactionUrl(row.sourceNetworkId, row.txId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ocean-teal underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
