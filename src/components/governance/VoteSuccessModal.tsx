import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Loader2,
  Download,
} from "lucide-react";
import { Proposal } from "@/types/governanceTypes";
import { useToast } from "@/hooks/use-toast";
import {
  generateGovernanceShareImage,
  revokeGovernanceShareResult,
} from "@/utils/governanceShare/generateGovernanceShareImage";
import {
  disconnectXShare,
  getShareServerHealth,
  getXShareHelperText,
  getXShareStatus,
  startXShareConnect,
  type XShareStatus,
} from "@/services/xShareService";
import {
  downloadGovernanceShareImage,
  getShareOutcomeMessage,
  shareGovernanceVote,
  supportsNativeFileShare,
} from "@/utils/governanceShare/shareGovernanceVote";
import { storeVoteSuccessRestore } from "@/utils/governanceShare/xShareOAuthReturn";
import type { GovernanceShareResult } from "@/utils/governanceShare/types";

interface VoteSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  support: boolean;
  votingPower: number;
  userVote?: boolean; // undefined = no vote, true = voted for, false = voted against
}

export const VoteSuccessModal = ({
  open,
  onOpenChange,
  proposal,
  support,
  votingPower,
  userVote,
}: VoteSuccessModalProps) => {
  const { toast } = useToast();

  const currentVotesFor = proposal.votesFor - (userVote === true ? votingPower : 0);
  const currentVotesAgainst = proposal.votesAgainst - (userVote === false ? votingPower : 0);

  const updatedVotesFor = support ? currentVotesFor + votingPower : currentVotesFor;
  const updatedVotesAgainst = !support ? currentVotesAgainst + votingPower : currentVotesAgainst;
  const updatedTotal = updatedVotesFor + updatedVotesAgainst;

  const [shareImage, setShareImage] = useState<GovernanceShareResult | null>(null);
  const shareImageRef = useRef<GovernanceShareResult | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [xShareStatus, setXShareStatus] = useState<XShareStatus>({
    connected: false,
    configured: false,
  });
  const [isLoadingXShareStatus, setIsLoadingXShareStatus] = useState(false);
  const [isDisconnectingX, setIsDisconnectingX] = useState(false);
  const [linkShareServerOk, setLinkShareServerOk] = useState(true);

  useEffect(() => {
    shareImageRef.current = shareImage;
  }, [shareImage]);

  useEffect(() => {
    if (!open) {
      revokeGovernanceShareResult(shareImageRef.current);
      shareImageRef.current = null;
      setShareImage(null);
      setShareError(null);
      setIsGeneratingShare(false);
      setIsSharing(false);
      return;
    }

    let cancelled = false;

    const generate = async () => {
      setIsGeneratingShare(true);
      setShareError(null);
      revokeGovernanceShareResult(shareImageRef.current);
      shareImageRef.current = null;
      setShareImage(null);

      try {
        const result = await generateGovernanceShareImage({
          votingPower,
          support,
          proposalTitle: proposal.title,
        });
        if (!cancelled) {
          shareImageRef.current = result;
          setShareImage(result);
        } else {
          revokeGovernanceShareResult(result);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to generate share image";
          setShareError(message);
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingShare(false);
        }
      }
    };

    void generate();

    return () => {
      cancelled = true;
      revokeGovernanceShareResult(shareImageRef.current);
      shareImageRef.current = null;
    };
  }, [open, votingPower, support, proposal.title]);

  useEffect(() => {
    if (!shareImage) {
      setCanNativeShare(false);
      return;
    }

    const file = new File([shareImage.blob], "dorkfi-governance-vote.png", {
      type: "image/png",
    });
    setCanNativeShare(supportsNativeFileShare(file));
  }, [shareImage]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadStatus = async () => {
      setIsLoadingXShareStatus(true);
      try {
        const [statusResult, healthResult] = await Promise.allSettled([
          getXShareStatus(),
          getShareServerHealth(),
        ]);
        if (!cancelled) {
          setXShareStatus(
            statusResult.status === "fulfilled"
              ? statusResult.value
              : { connected: false, configured: false }
          );
          setLinkShareServerOk(
            healthResult.status === "fulfilled" &&
              healthResult.value.ok &&
              healthResult.value.linkShareEnabled
          );
        }
      } catch {
        if (!cancelled) {
          setXShareStatus({ connected: false, configured: false });
          setLinkShareServerOk(false);
        }
      } finally {
        if (!cancelled) setIsLoadingXShareStatus(false);
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("x_connected") === "1") {
      toast({
        title: "X account connected",
        description: "You can now share your vote image directly to X.",
      });
    }
    const xError = params.get("x_error");
    if (xError) {
      toast({
        title: "X connection failed",
        description: xError,
        variant: "destructive",
      });
    }
  }, [open, toast]);

  const handleConnectX = useCallback(() => {
    storeVoteSuccessRestore({
      proposalId: proposal.id,
      support,
      votingPower,
    });
    startXShareConnect("/governance?x_connected=1");
  }, [proposal.id, support, votingPower]);

  const handleDisconnectX = useCallback(async () => {
    setIsDisconnectingX(true);
    try {
      await disconnectXShare();
      setXShareStatus({ connected: false, configured: xShareStatus.configured });
      toast({
        title: "Disconnected from X",
        description: "Connect again before posting with the X API.",
      });
    } catch {
      toast({
        title: "Disconnect failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnectingX(false);
    }
  }, [toast, xShareStatus.configured]);

  const handleShare = useCallback(async () => {
    if (!shareImage || isSharing) return;

    setIsSharing(true);
    try {
      const result = await shareGovernanceVote(shareImage, {
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        support,
        votingPower,
      });
      const message = getShareOutcomeMessage(result.outcome, result.tweetUrl);
      toast(message);
      if (result.outcome === "api" && result.tweetUrl) {
        window.open(result.tweetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast({
        title: "Share failed",
        description:
          error instanceof Error
            ? error.message
            : "Please try again or save the image manually.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [shareImage, isSharing, toast, proposal.id, proposal.title, support, votingPower]);

  const handleSaveImage = useCallback(() => {
    if (!shareImage) return;
    downloadGovernanceShareImage(shareImage.blob);
    toast({
      title: "Image saved",
      description: "Your governance share image was downloaded.",
    });
  }, [shareImage, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Vote submitted</DialogTitle>

        <div className="px-6 pt-6 pb-4 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/40">
              {isGeneratingShare && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/60">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Creating your share image...
                  </span>
                </div>
              )}
              {!isGeneratingShare && shareImage && (
                <img
                  src={shareImage.objectUrl}
                  alt="Your governance vote share preview"
                  className="h-full w-full object-cover"
                />
              )}
              {!isGeneratingShare && shareError && (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                  <span className="text-xs text-destructive">{shareError}</span>
                </div>
              )}
            </div>

            {xShareStatus.configured && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {isLoadingXShareStatus
                      ? "Checking X connection..."
                      : xShareStatus.connected
                        ? `Connected ${xShareStatus.username ?? "to X"}`
                        : "X account not connected"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {xShareStatus.connected
                      ? "Share on X posts your image automatically."
                      : "Connect once for one-click image posts, or share via link preview."}
                  </p>
                </div>
                {xShareStatus.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 min-h-[36px]"
                    disabled={isDisconnectingX}
                    onClick={() => void handleDisconnectX()}
                  >
                    {isDisconnectingX ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Disconnect"
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 min-h-[36px] bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                    disabled={isLoadingXShareStatus}
                    onClick={handleConnectX}
                  >
                    Connect X
                  </Button>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {getXShareHelperText(xShareStatus, canNativeShare, linkShareServerOk)}
            </p>

            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={!shareImage || isGeneratingShare || isSharing}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-semibold text-base text-center transition border border-border min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSharing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
              )}
              Share on X
            </button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSaveImage}
              disabled={!shareImage || isGeneratingShare}
              className="w-full min-h-[44px]"
            >
              <Download className="h-4 w-4 mr-2" />
              Save image
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Vote details</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Proposal</span>
              <span className="text-sm font-medium text-foreground text-right max-w-[200px] truncate">
                {proposal.title}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Vote</span>
              <span
                className={`flex items-center gap-1 text-sm font-medium ${support ? "text-green-500" : "text-destructive"}`}
              >
                {support ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {support ? "For" : "Against"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Voting Power Used</span>
              <span className="text-sm font-medium text-foreground">
                {votingPower.toLocaleString()} $UNIT
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Updated Balance
            </div>

            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-full overflow-hidden flex relative">
                <div
                  className={`bg-green-500 h-full transition-all ${support ? "ring-2 ring-green-400 ring-offset-1 animate-pulse" : ""}`}
                  style={{
                    width: `${(updatedVotesFor / Math.max(updatedTotal, 1)) * 100}%`,
                  }}
                />
                <div
                  className={`bg-destructive h-full transition-all ${!support ? "ring-2 ring-destructive/80 ring-offset-1 animate-pulse" : ""}`}
                  style={{
                    width: `${(updatedVotesAgainst / Math.max(updatedTotal, 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`flex items-center gap-1.5 font-semibold ${support ? "text-green-500" : "text-muted-foreground"}`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${support ? "bg-green-500 ring-2 ring-green-400 animate-pulse" : "bg-green-500"}`}
                  />
                  {updatedVotesFor.toLocaleString()} For
                  {support && (
                    <span className="text-green-400 font-medium ml-1">
                      +{votingPower.toLocaleString()}
                    </span>
                  )}
                  {userVote === true && !support && (
                    <span className="text-muted-foreground font-medium ml-1">
                      -{votingPower.toLocaleString()}
                    </span>
                  )}
                </span>
                <span
                  className={`flex items-center gap-1.5 font-semibold ${!support ? "text-destructive" : "text-muted-foreground"}`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${!support ? "bg-destructive ring-2 ring-destructive/80 animate-pulse" : "bg-destructive"}`}
                  />
                  {updatedVotesAgainst.toLocaleString()} Against
                  {!support && (
                    <span className="text-destructive/80 font-medium ml-1">
                      +{votingPower.toLocaleString()}
                    </span>
                  )}
                  {userVote === false && support && (
                    <span className="text-muted-foreground font-medium ml-1">
                      -{votingPower.toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary hover:bg-primary/10 transition-colors min-h-[44px]">
            <ExternalLink className="h-4 w-4" />
            View Transaction
          </button>
        </div>

        <div className="px-6 pb-6">
          <Button onClick={() => onOpenChange(false)} className="w-full min-h-[44px]">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
