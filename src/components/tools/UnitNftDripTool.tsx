import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import type { UnitNftDripCampaignConfig } from "@/config/nftDrips";
import {
  fetchUserNFTs,
  normalizeNftMetadataImageUrl,
  parseNFTMetadata,
  type NFTToken,
} from "@/services/nftService";
import algorandService from "@/services/algorandService";
import { createSigningBatchesFromEncoded } from "@/lib/algorand/grouping";
import { signAllEncodedBatches } from "@/lib/algorand/signing";
import { submitSignedGroups } from "@/lib/algorand/submission";
import {
  buildNftDripClaimSigningBundle,
  formatDripRewardAmount,
  NFT_DRIP_CLAIMS_PER_GROUP,
  readNftDripInfo,
  type NftDripClaimTarget,
  type NftDripInfo,
} from "@/services/nftDripClaimService";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const DRIP_READ_CONCURRENCY = 10;
const VOI_DRIP_NETWORK = "voi-mainnet" as const;
const MAX_CLAIMS_PER_ACTION = NFT_DRIP_CLAIMS_PER_GROUP;

function tokenKey(contractId: number, tokenId: string): string {
  return `${contractId}-${tokenId}`;
}

type ParsedNft = {
  tokenId: string;
  contractId: number;
  name: string;
  image: string;
};

export type UnitNftDripToolProps = {
  config: UnitNftDripCampaignConfig;
  /** When set, wallet must match this address (portfolio manual claim). */
  requiredAddress?: string;
  compact?: boolean;
};

export function UnitNftDripTool({ config, requiredAddress, compact }: UnitNftDripToolProps) {
  const { activeAccount, signTransactions } = useWallet();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<ParsedNft[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  /** Load failures only — must not hide the claim UI after a cancelled wallet prompt. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [dripInfoByKey, setDripInfoByKey] = useState<Record<string, NftDripInfo | null>>({});
  const [dripLoadingByKey, setDripLoadingByKey] = useState<Record<string, boolean>>({});
  const [dripRefreshTrigger, setDripRefreshTrigger] = useState(0);
  const [dripScanning, setDripScanning] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const ownerAddress = activeAccount?.address?.trim() ?? "";
  const addressOk =
    !requiredAddress ||
    (ownerAddress.length > 0 &&
      ownerAddress.toUpperCase() === requiredAddress.trim().toUpperCase());

  const { rewardTokenDecimals: dec, rewardSymbol: sym } = config;

  const totalPages = Math.max(1, Math.ceil(tokens.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedTokens = tokens.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allClaimableTokens = useMemo(
    () =>
      tokens.filter((t) => {
        const info = dripInfoByKey[tokenKey(t.contractId, t.tokenId)];
        return info && info.claimableAmount > 0;
      }),
    [tokens, dripInfoByKey]
  );

  const totalClaimableAmount = useMemo(
    () =>
      allClaimableTokens.reduce((sum, t) => {
        const info = dripInfoByKey[tokenKey(t.contractId, t.tokenId)];
        return sum + (info?.claimableAmount ?? 0);
      }, 0),
    [allClaimableTokens, dripInfoByKey]
  );

  const selectedClaimableAmount = useMemo(() => {
    let sum = 0;
    for (const key of selectedKeys) {
      const info = dripInfoByKey[key];
      sum += info?.claimableAmount ?? 0;
    }
    return sum;
  }, [selectedKeys, dripInfoByKey]);

  const getAlgod = useCallback(async () => {
    const net = getAlgorandNetworkFromNetworkId(VOI_DRIP_NETWORK);
    if (!net) throw new Error("VOI mainnet not configured");
    const clients = await algorandService.initializeClientsForTransactions(net);
    return clients.algod;
  }, []);

  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      if (next.size >= MAX_CLAIMS_PER_ACTION) {
        toast({
          title: "Selection limit",
          description: `Select at most ${MAX_CLAIMS_PER_ACTION} NFTs per claim.`,
          variant: "destructive",
        });
        return prev;
      }
      next.add(key);
      return next;
    });
  };

  const selectAllClaimable = () => {
    const capped = allClaimableTokens.slice(0, MAX_CLAIMS_PER_ACTION);
    setSelectedKeys(new Set(capped.map((t) => tokenKey(t.contractId, t.tokenId))));
    if (allClaimableTokens.length > MAX_CLAIMS_PER_ACTION) {
      toast({
        title: "Selected first batch",
        description: `${MAX_CLAIMS_PER_ACTION} of ${allClaimableTokens.length} claimable NFTs — claim, then repeat for more.`,
      });
    }
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const targetsFromTokens = (list: ParsedNft[]): NftDripClaimTarget[] => {
    const out: NftDripClaimTarget[] = [];
    for (const t of list) {
      const info = dripInfoByKey[tokenKey(t.contractId, t.tokenId)];
      if (info && info.claimableAmount > 0) {
        out.push({
          contractId: t.contractId,
          tokenId: t.tokenId,
          claimableAmount: info.claimableAmount,
          config,
        });
      }
    }
    return out;
  };

  const notifyClaimError = (err: unknown) => {
    const { userRejected, message } = getTransactionErrorFeedback(err);
    if (userRejected) {
      toast({
        title: "Transaction cancelled",
        description: message,
      });
      return;
    }
    toast({ title: "Claim failed", description: message, variant: "destructive" });
  };

  const prepareClaimTargets = (
    targets: NftDripClaimTarget[],
    opts: { truncateWithNotice: boolean }
  ): NftDripClaimTarget[] => {
    if (targets.length <= MAX_CLAIMS_PER_ACTION) return targets;
    if (opts.truncateWithNotice) {
      toast({
        title: "Claiming first batch",
        description: `Up to ${MAX_CLAIMS_PER_ACTION} NFTs per wallet approval. Claim again for any remaining rewards.`,
      });
      return targets.slice(0, MAX_CLAIMS_PER_ACTION);
    }
    toast({
      title: "Too many NFTs selected",
      description: `Select at most ${MAX_CLAIMS_PER_ACTION} NFTs per claim.`,
      variant: "destructive",
    });
    return [];
  };

  const runClaimTargets = async (targets: NftDripClaimTarget[]) => {
    if (!signTransactions || !ownerAddress) {
      throw new Error("Connect a wallet to sign");
    }

    const algod = await getAlgod();
    const { targetsForSign, preparedGroups } = await buildNftDripClaimSigningBundle(
      config,
      targets,
      ownerAddress,
      algod
    );
    if (preparedGroups.length === 0) {
      throw new Error("Failed to build claim transactions");
    }

    const signingBatches = createSigningBatchesFromEncoded(preparedGroups);
    const { signedGroups } = await signAllEncodedBatches(signingBatches, signTransactions);
    const submission = await submitSignedGroups({ algod, signedGroups });

    const claimCount = targetsForSign.length;
    const totalClaimed = targetsForSign.reduce((s, t) => s + t.claimableAmount, 0);

    if (submission.failedGroups.length > 0) {
      toast({
        title: "Claim failed",
        description: "Transaction group could not be confirmed. Try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Claim submitted",
      description: `Claimed ${formatDripRewardAmount(totalClaimed, dec)} ${sym} from ${claimCount} NFT(s).`,
    });
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      targetsForSign.forEach((t) => next.delete(tokenKey(t.contractId, t.tokenId)));
      return next;
    });
    setDripRefreshTrigger((r) => r + 1);
  };

  const handleClaimSelected = async () => {
    const toClaim = tokens.filter((t) => selectedKeys.has(tokenKey(t.contractId, t.tokenId)));
    const rawTargets = targetsFromTokens(toClaim);
    if (rawTargets.length === 0) {
      toast({ title: "Nothing to claim", description: "No selected NFTs with claimable amount.", variant: "destructive" });
      return;
    }
    const targets = prepareClaimTargets(rawTargets, { truncateWithNotice: false });
    if (targets.length === 0) return;
    setIsClaiming(true);
    try {
      await runClaimTargets(targets);
    } catch (err) {
      notifyClaimError(err);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimAll = async () => {
    const targets = prepareClaimTargets(targetsFromTokens(allClaimableTokens), {
      truncateWithNotice: true,
    });
    if (targets.length === 0) {
      toast({
        title: "Nothing to claim",
        description: dripScanning ? "Still loading claimable amounts…" : "No claimable rewards found.",
        variant: "destructive",
      });
      return;
    }
    setIsClaiming(true);
    try {
      await runClaimTargets(targets);
      clearSelection();
    } catch (err) {
      notifyClaimError(err);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimOne = async (t: ParsedNft) => {
    const key = tokenKey(t.contractId, t.tokenId);
    const info = dripInfoByKey[key];
    if (!info || info.claimableAmount <= 0) {
      toast({ title: "Nothing to claim", variant: "destructive" });
      return;
    }
    setClaimingKey(key);
    try {
      await runClaimTargets([
        {
          contractId: t.contractId,
          tokenId: t.tokenId,
          claimableAmount: info.claimableAmount,
          config,
        },
      ]);
    } catch (err) {
      notifyClaimError(err);
    } finally {
      setClaimingKey(null);
    }
  };

  useEffect(() => {
    if (!ownerAddress || !addressOk) {
      setTokens([]);
      setDripInfoByKey({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetchUserNFTs(ownerAddress, [config.nftContractId], 600)
      .then((data) => {
        if (cancelled) return;
        const parsed: ParsedNft[] = (data.tokens ?? [])
          .filter((t: NFTToken) => !t.isBurned)
          .map((t: NFTToken) => {
            const meta = parseNFTMetadata(t.metadata || "{}");
            return {
              tokenId: t.tokenId,
              contractId: t.contractId,
              name: meta.name ?? `${config.collectionLabel} #${t.tokenId}`,
              image: normalizeNftMetadataImageUrl(meta.image) ?? "",
            };
          });
        setTokens(parsed);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load NFTs");
          setTokens([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerAddress, addressOk, config.nftContractId, config.collectionLabel]);

  useEffect(() => {
    if (!ownerAddress || !addressOk || tokens.length === 0) return;
    let cancelled = false;
    setDripScanning(true);
    void (async () => {
      const algod = await getAlgod();
      for (let i = 0; i < tokens.length; i += DRIP_READ_CONCURRENCY) {
        if (cancelled) return;
        const batch = tokens.slice(i, i + DRIP_READ_CONCURRENCY);
        await Promise.all(
          batch.map(async (t) => {
            const key = tokenKey(t.contractId, t.tokenId);
            setDripLoadingByKey((prev) => ({ ...prev, [key]: true }));
            try {
              const info = await readNftDripInfo(config, t.contractId, t.tokenId, ownerAddress, algod);
              if (!cancelled) {
                setDripInfoByKey((prev) => ({ ...prev, [key]: info }));
                setDripLoadingByKey((prev) => ({ ...prev, [key]: false }));
              }
            } catch {
              if (!cancelled) {
                setDripInfoByKey((prev) => ({ ...prev, [key]: null }));
                setDripLoadingByKey((prev) => ({ ...prev, [key]: false }));
              }
            }
          })
        );
      }
      if (!cancelled) setDripScanning(false);
    })();
    return () => {
      cancelled = true;
      setDripScanning(false);
    };
  }, [ownerAddress, addressOk, tokens, dripRefreshTrigger, config, getAlgod]);

  const collectionUrl = `https://nautilus.sh/#/collection/${config.nftContractId}/trade`;

  return (
    <div className={cn(compact ? "px-0 py-0" : "mx-auto max-w-3xl px-4 py-8")}>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
        {!compact ? (
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-white">
              <span className="mr-2" aria-hidden>
                💧
              </span>
              {config.title}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{config.subtitle}</p>
            <a
              href={collectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-violet-400 hover:underline"
            >
              View collection
            </a>
          </div>
        ) : null}

        {!ownerAddress && (
          <p className="text-center text-sm text-slate-400">
            Connect your wallet to see {config.collectionLabel} NFTs and claim {sym}.
          </p>
        )}

        {ownerAddress && requiredAddress && !addressOk && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            Connected wallet must match portfolio address{" "}
            <span className="font-mono text-amber-200/90">{requiredAddress.slice(0, 8)}…</span> to
            claim on-chain.
          </p>
        )}

        {ownerAddress && addressOk && loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your NFTs…
          </div>
        )}

        {ownerAddress && addressOk && loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-200">
            {loadError}
          </p>
        )}

        {ownerAddress && addressOk && !loading && !loadError && tokens.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            <span className="text-2xl">{config.emptyStateEmoji}</span>
            <br />
            You don&apos;t own any {config.collectionLabel} NFTs yet.
          </p>
        )}

        {ownerAddress && addressOk && !loading && !loadError && tokens.length > 0 && (
          <>
            {(allClaimableTokens.length > 0 || dripScanning) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                    <Checkbox
                      checked={
                        allClaimableTokens.length > 0 &&
                        allClaimableTokens
                          .slice(0, MAX_CLAIMS_PER_ACTION)
                          .every((t) => selectedKeys.has(tokenKey(t.contractId, t.tokenId)))
                      }
                      disabled={dripScanning || allClaimableTokens.length === 0}
                      onCheckedChange={(v) => (v ? selectAllClaimable() : clearSelection())}
                    />
                    Select claimable (up to {MAX_CLAIMS_PER_ACTION})
                    {allClaimableTokens.length > 0 ? (
                      <span className="tabular-nums text-slate-500">({allClaimableTokens.length})</span>
                    ) : null}
                  </label>
                  <span className="text-slate-600">
                    Max {MAX_CLAIMS_PER_ACTION} per wallet approval
                  </span>
                  {dripScanning ? (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Scanning…
                    </span>
                  ) : allClaimableTokens.length > 0 ? (
                    <span className="tabular-nums text-violet-300/90">
                      {formatDripRewardAmount(totalClaimableAmount, dec)} {sym} total
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-600"
                    disabled={
                      isClaiming || dripScanning || !signTransactions || allClaimableTokens.length === 0
                    }
                    onClick={() => void handleClaimAll()}
                  >
                    {isClaiming
                      ? "Claiming…"
                      : (() => {
                          const n = Math.min(allClaimableTokens.length, MAX_CLAIMS_PER_ACTION);
                          const suffix =
                            allClaimableTokens.length > MAX_CLAIMS_PER_ACTION
                              ? ` (next ${n})`
                              : allClaimableTokens.length > 0
                                ? ` (${n})`
                                : "";
                          return `Claim batch${suffix}`;
                        })()}
                  </Button>
                  {selectedKeys.size > 0 ? (
                    <>
                      <span className="tabular-nums text-slate-300">
                        {selectedKeys.size} selected ·{" "}
                        {formatDripRewardAmount(selectedClaimableAmount, dec)} {sym}
                      </span>
                      <Button
                        size="sm"
                        className="bg-violet-700 hover:bg-violet-600"
                        disabled={isClaiming || !signTransactions}
                        onClick={() => void handleClaimSelected()}
                      >
                        {isClaiming ? "Claiming…" : `Claim selected (${selectedKeys.size})`}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection}>
                        Clear
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {paginatedTokens.map((t) => {
                const key = tokenKey(t.contractId, t.tokenId);
                const dripLoading = dripLoadingByKey[key];
                const dripInfo = dripInfoByKey[key];
                const hasClaimable = !!(dripInfo && dripInfo.claimableAmount > 0);
                const isSelected = selectedKeys.has(key);
                return (
                  <div
                    key={key}
                    role={hasClaimable ? "button" : undefined}
                    tabIndex={hasClaimable ? 0 : undefined}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-slate-900/60 transition",
                      isSelected ? "border-violet-500/80 ring-1 ring-violet-500/50" : "border-slate-800",
                      hasClaimable && "cursor-pointer hover:border-violet-500/40"
                    )}
                    onClick={() => hasClaimable && toggleSelection(key)}
                    onKeyDown={(e) => {
                      if (hasClaimable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSelection(key);
                      }
                    }}
                  >
                    <div className="relative aspect-square bg-slate-950">
                      {hasClaimable && (
                        <div className="absolute left-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(key)}
                          />
                        </div>
                      )}
                      {t.image ? (
                        <img src={t.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-slate-600">
                          NFT
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-800 px-2 py-1.5 text-center text-[10px] font-medium text-slate-300 truncate">
                      {t.name}
                    </div>
                    <div className="flex items-center justify-between gap-1 border-t border-slate-800 px-2 py-1.5 text-[10px] text-slate-500">
                      {dripLoading ? (
                        <span>…</span>
                      ) : dripInfo ? (
                        <>
                          <span className={hasClaimable ? "font-semibold text-violet-300" : ""}>
                            {formatDripRewardAmount(dripInfo.claimableAmount, dec)} {sym}
                          </span>
                          {hasClaimable ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[9px]"
                              disabled={
                                isClaiming ||
                                (claimingKey !== null && claimingKey !== key) ||
                                !signTransactions
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleClaimOne(t);
                              }}
                            >
                              {claimingKey === key ? "…" : "Claim"}
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-400">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
